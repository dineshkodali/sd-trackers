/**
 * Direct API client for seeding and teardown.
 *
 * Seeding through the API rather than the UI keeps table-mechanics tests
 * deterministic and fast. It also guarantees teardown even when a UI flow
 * leaves a record somewhere the table no longer shows it.
 *
 * Note: these calls send no credentials because `/api/db/*` currently requires
 * none (DEF-01). That is convenient here and is itself the defect under test in
 * tests/authorization/api-authorization.spec.ts.
 */
import { APIRequestContext, request as pwRequest } from '@playwright/test';
import { BASE_URL, QA_PREFIX, MASTER } from './env';

/**
 * Obtain a real session token.
 *
 * `/api/db/*` now requires a verified session (BUG-001), and tokens are signed
 * so no value can be fabricated client-side (BUG-002). Seeding and teardown
 * therefore log in exactly as the application does. The token is cached for the
 * process; it is never written to disk or logged.
 */
let cachedToken: string | null = null;

export async function getAuthToken(): Promise<string> {
  if (cachedToken) return cachedToken;

  const anon = await pwRequest.newContext({ baseURL: BASE_URL, timeout: 30_000 });
  try {
    const res = await anon.post('/api/auth/login', {
      data: { email: MASTER.email, password: MASTER.password },
    });
    if (!res.ok()) {
      throw new Error(`test login failed: ${res.status()} — cannot authenticate the API fixtures`);
    }
    const body = await res.json();
    if (!body.token) throw new Error('test login returned no token');
    cachedToken = body.token as string;
    return cachedToken;
  } finally {
    await anon.dispose();
  }
}

export async function ctx(): Promise<APIRequestContext> {
  const token = await getAuthToken();
  return pwRequest.newContext({
    baseURL: BASE_URL,
    timeout: 30_000,
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  });
}

/** An unauthenticated client, for tests that assert endpoints reject anonymity. */
export async function anonCtx(): Promise<APIRequestContext> {
  return pwRequest.newContext({ baseURL: BASE_URL, timeout: 30_000 });
}

export interface SeedReferral {
  id?: string;
  suName: string;
  site?: string;
  portRef?: string;
  mosaicId?: string;
  referralCouncil?: string;
  dateReferred?: string;
  referralType?: string;
  status?: string;
  urgency?: string;
  notesActionTaken?: string;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

export function referralPayload(p: SeedReferral) {
  const id = p.id || `ref-qa-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  return {
    id,
    site: p.site ?? 'Brit Hotel',
    suName: p.suName,
    portRef: p.portRef ?? `PORT-${id.slice(-5)}`,
    mosaicId: p.mosaicId ?? `MOS-${id.slice(-5)}`,
    referralCouncil: p.referralCouncil ?? 'Westminster City Council',
    dateReferred: p.dateReferred ?? iso(new Date()),
    referralType: p.referralType ?? 'Safeguarding Adult',
    status: p.status ?? 'Open',
    urgency: p.urgency ?? 'Medium',
    notesActionTaken: p.notesActionTaken ?? 'Seeded by automated test. Safe to delete.',
    officerLeadingHotel: 'Stack Master',
    lastUpdatedBy: 'Stack Master',
  };
}

/** Create one record. Returns the id the server accepted. */
export async function createRecord(api: APIRequestContext, entity: string, body: Record<string, unknown>) {
  const res = await api.post(`/api/db/${entity}`, { data: body });
  if (!res.ok()) throw new Error(`seed ${entity} failed: ${res.status()} ${await res.text()}`);
  const json = await res.json();
  return (json.record?.id as string) ?? (body.id as string);
}

export async function listRecords(api: APIRequestContext, entity: string): Promise<any[]> {
  const res = await api.get(`/api/db/${entity}`);
  if (!res.ok()) return [];
  const json = await res.json();
  return Array.isArray(json.data) ? json.data : [];
}

export async function deleteRecord(api: APIRequestContext, entity: string, id: string) {
  await api.delete(`/api/db/${entity}/${encodeURIComponent(id)}`).catch(() => undefined);
}

/**
 * Remove every record in `entity` whose text carries the QA prefix.
 * Safe by construction: it can only match data this suite created.
 */
export async function purgeTagged(api: APIRequestContext, entity: string, tag = QA_PREFIX) {
  const rows = await listRecords(api, entity);
  const doomed = rows.filter((r) => JSON.stringify(r ?? {}).includes(tag));
  for (const r of doomed) {
    if (r?.id) await deleteRecord(api, entity, String(r.id));
  }
  return doomed.length;
}

/** Seed N referrals with predictable, sortable names. */
export async function seedReferrals(api: APIRequestContext, tag: string, specs: Partial<SeedReferral>[]) {
  const ids: string[] = [];
  for (const s of specs) {
    const id = await createRecord(api, 'referrals', referralPayload({
      suName: `${tag}-${s.suName ?? 'SU'}`,
      ...s,
      // keep the tag prefix even when the caller passes a name
      ...(s.suName ? { suName: `${tag}-${s.suName}` } : {}),
    } as SeedReferral));
    ids.push(id);
  }
  return ids;
}

export async function countRows(api: APIRequestContext, entity: string) {
  return (await listRecords(api, entity)).length;
}
