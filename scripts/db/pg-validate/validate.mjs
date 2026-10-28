// Applies migrations 014, 021, 022 and 023 to an in-process Postgres (PGlite) and checks their rules. No database or .env needed.
// Run:  npm i --no-save @electric-sql/pglite   then   node scripts/db/pg-validate/validate.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import { run022 } from './tests022.mjs';
import { run023 } from './tests023.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const migrations = path.join(here, '..', '..', '..', 'db', 'migrations');
const files = process.argv.length > 2 ? process.argv.slice(2)
  : ['014_public_transport_enhancements.sql', '021_su_enhancements.sql', '022_transport_funding_workflow.sql', '023_oyster_card_inventory.sql'].map(f => path.join(migrations, f));
const db = new PGlite();

// Minimal Supabase-like surroundings the migration expects
await db.exec(`
  CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;
  CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY);
  CREATE SCHEMA storage; CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean);
  CREATE TABLE public.sites (id text PRIMARY KEY, name text);
  CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
  CREATE TABLE public.service_users (
    id TEXT PRIMARY KEY, su_reference TEXT UNIQUE, first_name TEXT NOT NULL, last_name TEXT NOT NULL, status TEXT DEFAULT 'Active',
    site_id TEXT REFERENCES public.sites(id), data JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
  INSERT INTO public.sites VALUES ('s1','Site 1'),('s2','Site 2');
  INSERT INTO public.service_users (id, su_reference, first_name, last_name, site_id) VALUES ('a','SU-1','Ann','A','s1'),('b','SU-2','Bob','B','s1'),('c','SU-3','Cy','C','s1');
`);

for (const f of files) {
  const sql = fs.readFileSync(f, 'utf8');
  try { await db.exec(sql); console.log('APPLIED', f); }
  catch (e) { console.log('FAILED ', f, '\n  ', e.message); process.exit(1); }
  try { await db.exec(sql); console.log('RE-APPLIED (idempotent)', f); }
  catch (e) { console.log('RE-APPLY FAILED', f, '\n  ', e.message); process.exit(1); }
}

let pass = 0, fail = 0;
const t = async (name, fn) => { try { await fn(); pass++; console.log('  ok  ', name); } catch (e) { fail++; console.log('  FAIL', name, '-', e.message); } };
const rejects = async (sql, code, params) => {
  try { await db.query(sql, params); } catch (e) { if (code && e.code !== code) throw new Error(`expected ${code} got ${e.code}: ${e.message}`); return; }
  throw new Error('expected an error but statement succeeded');
};
const one = async (sql, params) => (await db.query(sql, params)).rows[0];

if (files.some(f => f.includes('021'))) {
  console.log('\n-- 021 behaviour');
  await t('direct archive of an SU is refused by the guard', () => rejects(`UPDATE public.service_users SET status='Archived' WHERE id='a'`, '42501'));
  await t('direct change of archive_status is refused', () => rejects(`UPDATE public.service_users SET archive_status='Archived' WHERE id='a'`, '42501'));
  await t('creating an SU as archived is refused', () => rejects(`INSERT INTO public.service_users (id, first_name, last_name, status) VALUES ('z','Z','Z','Archived')`, '42501'));
  await t('routine edit of an active SU still works', async () => { await db.query(`UPDATE public.service_users SET first_name='Anne' WHERE id='a'`); });
  await t('request archive creates a pending request and marks the SU', async () => {
    const r = await one(`SELECT * FROM public.request_su_archive('a','Archive','Left the service','u1','User One')`);
    if (r.status !== 'Pending') throw new Error('status ' + r.status);
    const su = await one(`SELECT archive_status, status FROM public.service_users WHERE id='a'`);
    if (su.archive_status !== 'Pending approval' || su.status !== 'Active') throw new Error(JSON.stringify(su));
  });
  await t('a second pending request for the same SU is refused', () => rejects(`SELECT * FROM public.request_su_archive('a','Archive','again','u3','U3')`, '23505'));
  await t('a request with no reason is refused', () => rejects(`SELECT * FROM public.request_su_archive('b','Archive','  ','u1','User One')`, '22023'));
  await t('requester cannot approve their own request', async () => {
    const id = (await one(`SELECT id FROM public.su_archive_requests WHERE su_id='a'`)).id;
    await rejects(`SELECT * FROM public.decide_su_archive_request($1,'Approved','','u1','User One')`, '42501', [id]);
  });
  await t('rejecting needs a reason', async () => {
    const id = (await one(`SELECT id FROM public.su_archive_requests WHERE su_id='a'`)).id;
    await rejects(`SELECT * FROM public.decide_su_archive_request($1,'Rejected','','u2','User Two')`, '22023', [id]);
  });
  await t('only the requester can cancel', async () => {
    const id = (await one(`SELECT id FROM public.su_archive_requests WHERE su_id='a'`)).id;
    await rejects(`SELECT * FROM public.decide_su_archive_request($1,'Cancelled','','u2','User Two')`, '42501', [id]);
  });
  await t('a different user approves: SU becomes Archived and keeps its prior status', async () => {
    const id = (await one(`SELECT id FROM public.su_archive_requests WHERE su_id='a'`)).id;
    await db.query(`SELECT * FROM public.decide_su_archive_request($1,'Approved','ok','u2','User Two')`, [id]);
    const su = await one(`SELECT status, archive_status, archived_pre_status, archived_at FROM public.service_users WHERE id='a'`);
    if (su.status !== 'Archived' || su.archive_status !== 'Archived' || su.archived_pre_status !== 'Active' || !su.archived_at) throw new Error(JSON.stringify(su));
  });
  await t('an already decided request cannot be decided again', async () => {
    const id = (await one(`SELECT id FROM public.su_archive_requests WHERE su_id='a'`)).id;
    await rejects(`SELECT * FROM public.decide_su_archive_request($1,'Rejected','late','u3','U3')`, '23505', [id]);
  });
  await t('a routine edit cannot reactivate an archived SU', () => rejects(`UPDATE public.service_users SET status='Active' WHERE id='a'`, '42501'));
  await t('an archived SU keeps editable non-status fields only through routine edits (name change allowed)', async () => { await db.query(`UPDATE public.service_users SET last_name='Aa' WHERE id='a'`); });
  await t('restore needs a request and a second person', async () => {
    await db.query(`SELECT * FROM public.request_su_archive('a','Restore','Returned','u1','User One')`);
    const id = (await one(`SELECT id FROM public.su_archive_requests WHERE su_id='a' AND status='Pending'`)).id;
    await rejects(`SELECT * FROM public.decide_su_archive_request($1,'Approved','','u1','User One')`, '42501', [id]);
    await db.query(`SELECT * FROM public.decide_su_archive_request($1,'Approved','ok','u2','User Two')`, [id]);
    const su = await one(`SELECT status, archive_status FROM public.service_users WHERE id='a'`);
    if (su.status !== 'Active' || su.archive_status !== 'Active') throw new Error(JSON.stringify(su));
  });
  await t('rejected archive request returns the SU to Active', async () => {
    await db.query(`SELECT * FROM public.request_su_archive('b','Archive','x y z','u1','User One')`);
    const id = (await one(`SELECT id FROM public.su_archive_requests WHERE su_id='b' AND status='Pending'`)).id;
    await db.query(`SELECT * FROM public.decide_su_archive_request($1,'Rejected','not appropriate','u2','User Two')`, [id]);
    const su = await one(`SELECT status, archive_status FROM public.service_users WHERE id='b'`);
    if (su.status !== 'Active' || su.archive_status !== 'Active') throw new Error(JSON.stringify(su));
  });
  await t('only an archived SU can be restored', () => rejects(`SELECT * FROM public.request_su_archive('b','Restore','x y z','u1','U')`, '23505'));
  await t('table-level check blocks a self-approved row even if the function is bypassed', () => rejects(
    `INSERT INTO public.su_archive_requests (id, su_id, reason, requested_by_id, requested_by, status, decided_by_id, decided_at) VALUES ('q','c','reason','u1','U','Approved','u1',NOW())`, '23514'));

  await t('Meals: one row per SU, date and period; history kept on correction', async () => {
    await db.query(`INSERT INTO public.su_meal_records (id, su_id, meal_date, meal_period, status, recorded_by) VALUES ('m1','b','2026-10-28','Lunch','Provided','Staff')`);
    await rejects(`INSERT INTO public.su_meal_records (id, su_id, meal_date, meal_period, status) VALUES ('m2','b','2026-10-28','Lunch','Accepted')`, '23505');
    await db.query(`UPDATE public.su_meal_records SET status='Declined', notes='unwell', updated_by='Staff2' WHERE id='m1'`);
    const h = (await db.query(`SELECT from_status, to_status FROM public.su_meal_record_history WHERE record_id='m1' ORDER BY changed_at, id`)).rows;
    if (h.length !== 2 || h[1].from_status !== 'Provided' || h[1].to_status !== 'Declined') throw new Error(JSON.stringify(h));
  });
  await t('Meals: only breakfast, lunch or dinner and known statuses', async () => {
    await rejects(`INSERT INTO public.su_meal_records (id, su_id, meal_date, meal_period, status) VALUES ('m3','b','2026-10-28','Supper','Provided')`, '23514');
    await rejects(`INSERT INTO public.su_meal_records (id, su_id, meal_date, meal_period, status) VALUES ('m4','b','2026-10-28','Dinner','Eaten')`, '23514');
  });

  await t('Education: only one current school per child; history rows allowed', async () => {
    await db.query(`INSERT INTO public.su_education_details (id, su_id, school_name, education_status) VALUES ('e1','b','Park','Enrolled')`);
    await rejects(`INSERT INTO public.su_education_details (id, su_id, school_name, education_status) VALUES ('e2','b','Hill','Enrolled')`, '23505');
    await db.query(`UPDATE public.su_education_details SET is_current=false WHERE id='e1'`);
    await db.query(`INSERT INTO public.su_education_details (id, su_id, school_name, education_status) VALUES ('e2','b','Hill','Enrolled')`);
  });
  await t('Education: Enrolled needs a school name', () => rejects(`INSERT INTO public.su_education_details (id, su_id, education_status) VALUES ('e3','c','Enrolled')`, '23514'));

  await t('Family: an SU can be in one active family; a removed link allows joining another', async () => {
    await db.query(`INSERT INTO public.family_groups (id, display_name) VALUES ('f1','F1'),('f2','F2')`);
    await db.query(`INSERT INTO public.family_members (id, family_id, su_id) VALUES ('fm1','f1','b')`);
    await rejects(`INSERT INTO public.family_members (id, family_id, su_id) VALUES ('fm2','f2','b')`, '23505');
    await rejects(`UPDATE public.family_members SET status='Removed' WHERE id='fm1'`, '23514');
    await db.query(`UPDATE public.family_members SET status='Removed', left_at=NOW() WHERE id='fm1'`);
    await db.query(`INSERT INTO public.family_members (id, family_id, su_id) VALUES ('fm2','f2','b')`);
  });
  await t('Family: duplicate family reference refused', async () => {
    await db.query(`UPDATE public.family_groups SET family_ref='FAM-1' WHERE id='f1'`);
    await rejects(`UPDATE public.family_groups SET family_ref=' fam-1 ' WHERE id='f2'`, '23505');
  });
  await t('HC2: one per SU, expiry not before issue, known statuses', async () => {
    await db.query(`INSERT INTO public.su_hc2_details (id, su_id, status, issue_date, expiry_date) VALUES ('h1','b','Active','2026-01-01','2027-01-01')`);
    await rejects(`INSERT INTO public.su_hc2_details (id, su_id) VALUES ('h2','b')`, '23505');
    await rejects(`INSERT INTO public.su_hc2_details (id, su_id, issue_date, expiry_date) VALUES ('h3','c','2026-02-01','2026-01-01')`, '23514');
    await rejects(`INSERT INTO public.su_hc2_details (id, su_id, status) VALUES ('h4','c','Maybe')`, '23514');
  });
  await t('Private storage bucket created and not public', async () => {
    const b = await one(`SELECT public FROM storage.buckets WHERE id='su-health-documents'`);
    if (!b || b.public !== false) throw new Error(JSON.stringify(b));
  });
  await t('anon and authenticated have no table or function access', async () => {
    const r = await db.query(`SELECT has_table_privilege('anon','public.su_hc2_details','SELECT') a, has_table_privilege('authenticated','public.su_archive_requests','SELECT') b,
      has_function_privilege('authenticated','public.request_su_archive(text,text,text,text,text)','EXECUTE') c, has_function_privilege('service_role','public.decide_su_archive_request(text,text,text,text,text)','EXECUTE') d`);
    const x = r.rows[0];
    if (x.a || x.b || x.c || !x.d) throw new Error(JSON.stringify(x));
  });
}

if (files.some(f => f.includes('022'))) await run022({ db, t, rejects });
if (files.some(f => f.includes('023'))) await run023({ db, t, rejects });
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
