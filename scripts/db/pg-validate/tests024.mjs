// Behaviour checks for migration 024 (shared household); imported by validate.mjs
export async function run024({ db, t, rejects }) {
  console.log('\n-- 024 behaviour');
  const one = async (sql, params) => (await db.query(sql, params)).rows[0];
  const add = (anchor, member, rel, anchorRel = null, role = 'General Manager') =>
    db.query(`SELECT * FROM public.add_household_member($1,$2,$3,$4,'u1',$5)`, [anchor, member, rel, anchorRel, role]);
  const activeOf = async su => (await db.query(
    `SELECT m.su_id, m.relationship FROM public.family_members m WHERE m.status='Active' AND m.family_id = (SELECT family_id FROM public.family_members WHERE su_id=$1 AND status='Active') ORDER BY m.su_id`, [su])).rows;

  // four people: father f, mother m, daughter d, son s (plus an outsider x)
  for (const [id, ref] of [['hf', 'HF'], ['hm', 'HM'], ['hd', 'HD'], ['hs', 'HS'], ['hx', 'HX']]) {
    await db.query(`INSERT INTO public.service_users (id, su_reference, first_name, last_name, site_id) VALUES ($1,$2,$2,'Khan','s1')`, [id, ref]);
  }

  await t('first add from the father creates the household with both people in it', async () => {
    const r = (await add('hf', 'hm', 'Mother', 'Father')).rows[0];
    if (r.su_id !== 'hm' || r.relationship !== 'Mother') throw new Error(JSON.stringify(r));
    const f = await activeOf('hf'); const m = await activeOf('hm');
    if (f.length !== 2 || JSON.stringify(f) !== JSON.stringify(m)) throw new Error(JSON.stringify({ f, m }));
  });
  await t('adding the rest from the father shows the same four members on every profile', async () => {
    await add('hf', 'hd', 'Daughter'); await add('hf', 'hs', 'Son');
    const views = [await activeOf('hf'), await activeOf('hm'), await activeOf('hd'), await activeOf('hs')];
    if (views[0].length !== 4) throw new Error(JSON.stringify(views[0]));
    for (const v of views) if (JSON.stringify(v) !== JSON.stringify(views[0])) throw new Error('profiles differ');
    const fams = (await db.query(`SELECT count(DISTINCT family_id)::int AS n FROM public.family_members WHERE status='Active' AND su_id IN ('hf','hm','hd','hs')`)).rows[0];
    if (fams.n !== 1) throw new Error('more than one household: ' + fams.n);
  });
  await t('adding from a different member (the daughter) reaches the same household', async () => {
    await add('hd', 'hx', 'Other relative');
    if ((await activeOf('hf')).length !== 5) throw new Error('not shared');
  });
  await t('self-link, duplicates and people in another household are refused', async () => {
    await rejects(`SELECT * FROM public.add_household_member('hf','hf','Son',NULL,'u1','Admin')`, '22023');
    await rejects(`SELECT * FROM public.add_household_member('hf','hm','Mother',NULL,'u1','Admin')`, '23505');
    await db.query(`INSERT INTO public.service_users (id, su_reference, first_name, last_name, site_id) VALUES ('oa','OA','OA','Other','s1'),('ob','OB','OB','Other','s1')`);
    await add('oa', 'ob', 'Sister');
    await rejects(`SELECT * FROM public.add_household_member('hf','ob','Son',NULL,'u1','Admin')`, '23505');
  });
  await t('a missing or archived person cannot be added, and Staff cannot change a household', async () => {
    await rejects(`SELECT * FROM public.add_household_member('hf','nobody','Son',NULL,'u1','Admin')`, 'P0002');
    await rejects(`SELECT * FROM public.add_household_member('hf','hx','Son',NULL,'u1','Staff')`, '42501');
    await db.query(`INSERT INTO public.service_users (id, su_reference, first_name, last_name, site_id) VALUES ('oz','OZ','OZ','Zed','s1')`);
    await db.query(`SELECT * FROM public.request_su_archive('oz','Archive','left','u1','U1')`);
    const id = (await one(`SELECT id FROM public.su_archive_requests WHERE su_id='oz' AND status='Pending'`)).id;
    await db.query(`SELECT * FROM public.decide_su_archive_request($1,'Approved','ok','u9','U9')`, [id]);
    await rejects(`SELECT * FROM public.add_household_member('hf','oz','Son',NULL,'u1','Admin')`, '22023');
  });
  await t('relationship changes show on every profile', async () => {
    await db.query(`SELECT * FROM public.set_household_relationship((SELECT family_id FROM public.family_members WHERE su_id='hf' AND status='Active'),'hs','Stepson','u1','Admin')`);
    const seen = (await activeOf('hm')).find(r => r.su_id === 'hs');
    if (seen.relationship !== 'Stepson') throw new Error(JSON.stringify(seen));
  });
  await t('removing a member updates every profile and keeps their Service User record and history row', async () => {
    const fam = (await one(`SELECT family_id FROM public.family_members WHERE su_id='hf' AND status='Active'`)).family_id;
    await rejects(`SELECT * FROM public.remove_household_member($1,'hx','','u1','Admin')`, '22023', [fam]);
    await db.query(`SELECT * FROM public.remove_household_member($1,'hx','Moved out','u1','Admin')`, [fam]);
    for (const su of ['hf', 'hm', 'hd', 'hs']) if ((await activeOf(su)).length !== 4) throw new Error('profile ' + su + ' not updated');
    if ((await activeOf('hx')).length !== 0) throw new Error('removed person still has a household');
    const su = await one(`SELECT status FROM public.service_users WHERE id='hx'`);
    const hist = await one(`SELECT status, removal_reason FROM public.family_members WHERE su_id='hx' ORDER BY created_at DESC LIMIT 1`);
    if (su.status !== 'Active' || hist.status !== 'Removed' || hist.removal_reason !== 'Moved out') throw new Error(JSON.stringify({ su, hist }));
    await rejects(`SELECT * FROM public.remove_household_member($1,'hx','again please','u1','Admin')`, 'P0002', [fam]);
  });
  await t('a removed person can join a household again', async () => { await add('hf', 'hx', 'Other relative'); if ((await activeOf('hf')).length !== 5) throw new Error('not rejoined'); });
  await t('a household left with one person is closed, and its members are free to join another', async () => {
    const fam = (await one(`SELECT family_id FROM public.family_members WHERE su_id='oa' AND status='Active'`)).family_id;
    await db.query(`SELECT * FROM public.remove_household_member($1,'ob','Left','u1','Admin')`, [fam]);
    const f = await one(`SELECT status FROM public.family_groups WHERE id=$1`, [fam]);
    if (f.status !== 'Closed' || (await activeOf('oa')).length !== 0) throw new Error(JSON.stringify(f));
    await add('hf', 'oa', 'Other relative');                 // now allowed
  });
  await t('no duplicate memberships exist anywhere', async () => {
    const d = await one(`SELECT count(*)::int AS n FROM (SELECT su_id FROM public.family_members WHERE status='Active' GROUP BY su_id HAVING count(*) > 1) x`);
    if (d.n !== 0) throw new Error('duplicates: ' + d.n);
  });
  await t('household functions are closed to anon and authenticated', async () => {
    const x = await one(`SELECT has_function_privilege('authenticated','public.add_household_member(text,text,text,text,text,text)','EXECUTE') a,
      has_function_privilege('anon','public.remove_household_member(text,text,text,text,text)','EXECUTE') b,
      has_function_privilege('service_role','public.add_household_member(text,text,text,text,text,text)','EXECUTE') c`);
    if (x.a || x.b || !x.c) throw new Error(JSON.stringify(x));
  });
}
