/**
 * End-to-end check of the finance approval workflow through the real Express router.
 * Runs against a throw-away data folder (never touches server/data) and without Supabase.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

const ORIGINAL_CWD = process.cwd();
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'sdt-finance-wf-'));

const UPLOADER = '11111111-1111-4111-8111-111111111111';
const RM = '22222222-2222-4222-8222-222222222222';
const FIN = '33333333-3333-4333-8333-333333333333';
const OTHER_STAFF = '44444444-4444-4444-8444-444444444444';

let server: Server;
let base = '';
let token: (id: string, role: string, name: string) => string;

const call = async (as: { id: string; role: string; name: string }, method: string, url: string, body?: any) => {
  const res = await fetch(`${base}${url}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token(as.id, as.role, as.name)}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json: any = await res.json().catch(() => ({}));
  return { status: res.status, json };
};
const uploader = { id: UPLOADER, role: 'Staff', name: 'Una Uploader' };
const rm = { id: RM, role: 'Regional Manager', name: 'Rita RM' };
const fin = { id: FIN, role: 'Admin', name: 'Fin Admin' };
const stranger = { id: OTHER_STAFF, role: 'Staff', name: 'Sam Stranger' };

const seedBill = (id: string, over: Record<string, any> = {}) => ({
  id, bill_number: `INV-${id}`, site_id: 'site-brit', siteName: 'Brit Hotel', bill_type: 'vendor_invoice',
  bill_date: '2026-10-01', currency: 'GBP', subtotal: 100, tax_amount: 20, total_amount: 120,
  submitted_by: UPLOADER, submitted_at: '2026-10-01T09:00:00Z', status: 'submitted',
  created_at: '2026-10-01T09:00:00Z', updated_at: '2026-10-01T09:00:00Z', ...over,
});

before(async () => {
  for (const k of ['SUPABASE_URL', 'VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_ANON_KEY', 'VITE_SUPABASE_PUBLISHABLE_KEY', 'VITE_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY']) {
    delete process.env[k];
  }
  process.env.AUTH_TOKEN_SECRET = 'test-secret-for-finance-workflow-tests';
  fs.mkdirSync(path.join(TMP, 'server', 'data'), { recursive: true });
  const store = {
    bills: [
      seedBill('b-route'),
      seedBill('b-assigned', { status: 'awaiting_approval', assigned_approver_id: RM, assigned_approver_name: 'Rita RM' }),
      seedBill('b-final', { status: 'under_review', assigned_approver_id: RM, assigned_approver_name: 'Rita RM' }),
      seedBill('b-closed', { status: 'approved' }),
      seedBill('b-query', { status: 'awaiting_approval', assigned_approver_id: RM, assigned_approver_name: 'Rita RM' }),
      seedBill('b-other-site', { status: 'awaiting_approval', site_id: 'site-far', siteName: 'Far Away', assigned_approver_id: RM, assigned_approver_name: 'Rita RM' }),
      seedBill('b-reject', { status: 'awaiting_approval', assigned_approver_id: RM, assigned_approver_name: 'Rita RM' }),
    ],
    items: [], attachments: [], vendors: [{ id: 'v1', vendor_name: 'Acme' }], history: [], queries: [], query_responses: [], reconciliations: [], payments: [],
  };
  fs.writeFileSync(path.join(TMP, 'server', 'data', 'finance_storage.json'), JSON.stringify(store), 'utf8');
  process.chdir(TMP); // the router reads its data folder from the working directory when it is loaded

  const { default: express } = await import('express');
  const financeRouter = (await import('../server/routes/finance')).default;
  const { signAdminToken } = await import('../server/tokenSigner');
  const { requireAuth } = await import('../server/middleware/requireAuth');
  token = (id, role, name) => signAdminToken({ sub: id, email: `${name.replace(/\s+/g, '.').toLowerCase()}@example.test`, role, iss: 'sdtracker-internal', exp: Math.floor(Date.now() / 1000) + 3600 } as any);

  const app = express();
  app.use(express.json());
  app.use('/api/finance', requireAuth, financeRouter); // same mounting as server/index.ts
  await new Promise<void>(resolve => { server = app.listen(0, '127.0.0.1', () => resolve()); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/finance`;
});

after(async () => {
  await new Promise<void>(resolve => (server ? server.close(() => resolve()) : resolve()));
  process.chdir(ORIGINAL_CWD);
  fs.rmSync(TMP, { recursive: true, force: true });
});

const statusOf = async (id: string) => (await call(fin, 'GET', `/bills/${id}`)).json.data?.status ?? (await call(fin, 'GET', `/bills/${id}`)).json.status;

describe('Finance workflow — real routes', () => {
  test('sending for confirmation: a stranger is refused, the uploader can pick themself, an unknown person is refused', async () => {
    const denied = await call(stranger, 'POST', '/bills/b-route/request-approval', { approverId: UPLOADER });
    // a user with no access to the bill's site cannot even see it (404); otherwise the rules refuse (403)
    assert.ok([403, 404].includes(denied.status), String(denied.status));
    assert.equal(await statusOf('b-route'), 'submitted', 'nothing changed');

    const noChoice = await call(fin, 'POST', '/bills/b-route/request-approval', {});
    assert.equal(noChoice.status, 400);

    const missing = await call(fin, 'POST', '/bills/does-not-exist/request-approval', { approverId: UPLOADER });
    assert.equal(missing.status, 404);

    const ok = await call(fin, 'POST', '/bills/b-route/request-approval', { approverId: UPLOADER, notes: 'Please check the delivery note' });
    assert.equal(ok.status, 200, JSON.stringify(ok.json));
    assert.equal(ok.json.assignedApproverId, UPLOADER);
    assert.equal(await statusOf('b-route'), 'awaiting_approval');
  });

  test('a closed bill cannot be sent for confirmation again', async () => {
    const r = await call(fin, 'POST', '/bills/b-closed/request-approval', { approverId: UPLOADER });
    assert.equal(r.status, 409);
  });

  test('only the chosen person can confirm; then the bill is in final checks', async () => {
    const wrong = await call(fin, 'POST', '/bills/b-assigned/approve', {});
    assert.equal(wrong.status, 403);
    assert.match(wrong.json.error, /assigned to someone else/);

    const confirm = await call(rm, 'POST', '/bills/b-assigned/approve', { comments: 'Looks right' });
    assert.equal(confirm.status, 200, JSON.stringify(confirm.json));
    assert.equal(confirm.json.status, 'under_review');
    assert.equal(confirm.json.stage, 'confirm');
    assert.equal(await statusOf('b-assigned'), 'under_review');

    const again = await call(rm, 'POST', '/bills/b-assigned/approve', {});
    assert.equal(again.status, 403, 'the confirmer cannot also give final approval');
  });

  test('final approval is Finance only and ends the workflow', async () => {
    const notFinance = await call(rm, 'POST', '/bills/b-final/approve', {});
    assert.equal(notFinance.status, 403);

    const approved = await call(fin, 'POST', '/bills/b-final/approve', { comments: 'Signed off' });
    assert.equal(approved.status, 200, JSON.stringify(approved.json));
    assert.equal(approved.json.status, 'approved');
    assert.equal(approved.json.stage, 'final');

    const afterwards = await call(fin, 'POST', '/bills/b-final/approve', {});
    assert.equal(afterwards.status, 409);
    const reject = await call(fin, 'POST', '/bills/b-final/reject', { reason: 'too late' });
    assert.equal(reject.status, 409, 'an approved bill cannot be rejected');
  });

  test('send back with a question, the uploader replies, the bill returns to the approver', async () => {
    const stranger403 = await call(stranger, 'POST', '/bills/b-query/queries', { question: 'x' });
    assert.ok([403, 404].includes(stranger403.status), String(stranger403.status));

    const asked = await call(rm, 'POST', '/bills/b-query/queries', { queryType: 'missing_document', question: 'Please attach the delivery note' });
    assert.equal(asked.status, 201, JSON.stringify(asked.json));
    assert.equal(asked.json.data.assigned_to, UPLOADER, 'goes to the uploader by default');
    assert.equal(await statusOf('b-query'), 'query_raised');

    const blocked = await call(rm, 'POST', '/bills/b-query/approve', {});
    assert.equal(blocked.status, 409, 'cannot confirm while a question is open');

    const wrongReplier = await call(stranger, 'POST', `/queries/${asked.json.data.id}/reply`, { responseText: 'hi' });
    assert.ok([403, 404].includes(wrongReplier.status), String(wrongReplier.status));

    const replied = await call(uploader, 'POST', `/queries/${asked.json.data.id}/reply`, { responseText: 'Attached now' });
    assert.equal(replied.status, 201, JSON.stringify(replied.json));
    assert.equal(replied.json.billStatus, 'awaiting_approval');
    assert.equal(await statusOf('b-query'), 'awaiting_approval');

    const confirmed = await call(rm, 'POST', '/bills/b-query/approve', {});
    assert.equal(confirmed.status, 200);
    assert.equal(confirmed.json.status, 'under_review');
  });

  test('a rejection needs a reason, comes from the assigned person, and stops the workflow', async () => {
    assert.equal((await call(rm, 'POST', '/bills/b-reject/reject', {})).status, 400);
    assert.equal((await call(fin, 'POST', '/bills/b-reject/reject', { reason: 'nope' })).status, 403, 'assigned to someone else');
    const rejected = await call(rm, 'POST', '/bills/b-reject/reject', { reason: 'Duplicate invoice' });
    assert.equal(rejected.status, 200);
    assert.equal(await statusOf('b-reject'), 'rejected');
    assert.equal((await call(rm, 'POST', '/bills/b-reject/approve', {})).status, 409, 'a rejected bill cannot be approved');
  });

  test('the chosen person sees their bill in the list even when it is at another site', async () => {
    const list = await call(rm, 'GET', '/bills');
    assert.equal(list.status, 200);
    const ids = (list.json.data as any[]).map(b => b.id);
    assert.ok(ids.includes('b-other-site'), 'assigned bill at a different site is visible to the assignee');
    const stranger_list = await call(stranger, 'GET', '/bills');
    assert.ok(!(stranger_list.json.data as any[]).some(b => b.id === 'b-other-site'), 'strangers do not see it');
    const detail = await call(rm, 'GET', '/bills/b-other-site');
    assert.equal(detail.status, 200, 'and can open it');
    assert.equal((await call(stranger, 'GET', '/bills/b-other-site')).status, 404);
  });

  test('the assignment survives into the list the browser reads', async () => {
    const list = await call(fin, 'GET', '/bills');
    const b = (list.json.data as any[]).find(x => x.id === 'b-route');
    assert.equal(b.assignedApproverId, UPLOADER);
    assert.equal(b.status, 'awaiting_approval');
  });
});
