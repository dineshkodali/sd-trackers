import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  availableCardsFor, oysterUsage, summariseUsage, validateRegisterCard, validateIssue, validateReturn, filterOysterTransactions, formatMoney
} from '../src/utils/oysterLogic.ts';
import { sanitizeOysterCardBody, redactSensitiveRows } from '../server/suAccess.ts';
import { ENTITY_REGISTRY, TABLE_SITE_COLUMN, TABLE_PARENT_SCOPE } from '../server/routes/db.ts';
import { toDatabaseRow, fromDatabaseRow } from '../server/schemaAdapter.ts';

test('only available cards held by the selected property are offered', () => {
  const cards = [
    { id: 'a', status: 'Available', siteName: 'Brit Hotel' },
    { id: 'b', status: 'Issued', siteName: 'Brit Hotel' },
    { id: 'c', status: 'Available', siteName: 'Other Hotel' },
    { id: 'd', status: 'Lost', siteName: 'Brit Hotel' },
    { id: 'e', status: 'Available', siteName: ' brit hotel ' }
  ];
  assert.deepEqual(availableCardsFor(cards, 'Brit Hotel').map(c => c.id), ['a', 'e']);
  assert.deepEqual(availableCardsFor(cards, ''), []);
  assert.deepEqual(availableCardsFor(cards, 'Nowhere'), []);
});

test('amount used is calculated only when it can be relied on', () => {
  const ok = { status: 'Returned', balanceAtIssue: 10, balanceAtReturn: 7.35, returnCondition: 'Good', balanceAdjusted: false };
  assert.deepEqual(oysterUsage(ok), { calculable: true, amount: 2.65 });
  assert.deepEqual(oysterUsage({ ...ok, balanceAtReturn: 10 }), { calculable: true, amount: 0 });
  const no = (t: object) => { const u = oysterUsage({ ...ok, ...t }); assert.equal(u.calculable, false); return (u as any).reason as string; };
  assert.match(no({ status: 'Issued', balanceAtReturn: null }), /still out/i);
  assert.match(no({ status: 'Lost', returnCondition: 'Lost', balanceAtReturn: null }), /lost/i);
  assert.match(no({ balanceAtReturn: null }), /not recorded/i);
  assert.match(no({ balanceAtIssue: null }), /not recorded/i);
  assert.match(no({ balanceAdjusted: true }), /changed while the card was out/i);
  assert.match(no({ returnCondition: 'Damaged' }), /damaged/i);
  assert.match(no({ balanceAtReturn: 12 }), /higher/i);
});

test('floating point does not leak into amounts', () => {
  const u = oysterUsage({ status: 'Returned', balanceAtIssue: 0.3, balanceAtReturn: 0.1, returnCondition: 'Good' });
  assert.deepEqual(u, { calculable: true, amount: 0.2 });
  assert.equal(formatMoney(2.5), '£2.50');
  assert.equal(formatMoney(null), '—');
});

test('totals add up reliable differences only and count the rest', () => {
  const s = summariseUsage([
    { status: 'Returned', balanceAtIssue: 10, balanceAtReturn: 8, returnCondition: 'Good' },
    { status: 'Returned', balanceAtIssue: 10, balanceAtReturn: 9.5, returnCondition: 'Good' },
    { status: 'Returned', balanceAtIssue: 10, balanceAtReturn: 4, returnCondition: 'Good', balanceAdjusted: true },
    { status: 'Lost', balanceAtIssue: 5, returnCondition: 'Lost' },
    { status: 'Issued', balanceAtIssue: 5 }
  ]);
  assert.deepEqual(s, { balanceDifferenceTotal: 2.5, reliable: 2, notCalculable: 2, open: 1 });
});

test('registering, issuing and returning are validated', () => {
  assert.ok(validateRegisterCard({ cardRef: '', siteName: 'S', balance: 5 }));
  assert.ok(validateRegisterCard({ cardRef: 'X', siteName: '', balance: 5 }));
  assert.ok(validateRegisterCard({ cardRef: 'X', siteName: 'S', balance: '' }));
  assert.ok(validateRegisterCard({ cardRef: 'X', siteName: 'S', balance: -1 }));
  assert.equal(validateRegisterCard({ cardRef: 'X', siteName: 'S', balance: 0 }), null);

  assert.ok(validateIssue({ suId: 'a', balance: 5 }, '2026-10-28'));
  assert.ok(validateIssue({ cardId: 'c', balance: 5 }, '2026-10-28'));
  assert.ok(validateIssue({ cardId: 'c', suId: 'a' }, '2026-10-28'));
  assert.ok(validateIssue({ cardId: 'c', suId: 'a', balance: 5, issuedDate: '2026-11-01' }, '2026-10-28'));
  assert.equal(validateIssue({ cardId: 'c', suId: 'a', balance: 5, issuedDate: '2026-10-28' }, '2026-10-28'), null);

  assert.match(validateReturn({ condition: 'Good' }, '2026-10-01', '2026-10-28') || '', /remaining balance/i);
  assert.match(validateReturn({ condition: 'Good', balance: '' }, '2026-10-01', '2026-10-28') || '', /remaining balance/i);
  assert.ok(validateReturn({ condition: 'Damaged', balance: 3 }, '2026-10-01', '2026-10-28'));              // needs a note
  assert.ok(validateReturn({ condition: 'Good', balance: 3, returnedDate: '2026-09-30' }, '2026-10-01', '2026-10-28'));
  assert.equal(validateReturn({ condition: 'Good', balance: 0 }, '2026-10-01', '2026-10-28'), null);
  assert.equal(validateReturn({ condition: 'Lost', notes: 'left on a bus' }, '2026-10-01', '2026-10-28'), null);
});

test('funding page filters: property, Service User, card and date', () => {
  const rows = [
    { id: '1', siteName: 'Brit Hotel', cardRef: 'C-1', issuedDate: '2026-10-02', status: 'Issued', suId: 'a' },
    { id: '2', siteName: 'Other Hotel', cardRef: 'C-2', issuedDate: '2026-10-10', status: 'Returned', suId: 'b' },
    { id: '3', siteName: 'Brit Hotel', cardRef: 'C-3', issuedDate: '2026-10-20', status: 'Returned', suId: 'b' }
  ];
  const name = (id: string) => (id === 'a' ? 'Ann Adams PORT-1' : 'Bob Brown PORT-2');
  const ids = (f: object) => filterOysterTransactions(rows, f, name).map(r => r.id);
  assert.deepEqual(ids({}), ['1', '2', '3']);
  assert.deepEqual(ids({ site: 'brit hotel' }), ['1', '3']);
  assert.deepEqual(ids({ site: 'all' }), ['1', '2', '3']);
  assert.deepEqual(ids({ query: 'bob' }), ['2', '3']);
  assert.deepEqual(ids({ query: 'port-1' }), ['1']);
  assert.deepEqual(ids({ query: 'c-3' }), ['3']);
  assert.deepEqual(ids({ from: '2026-10-05', to: '2026-10-15' }), ['2']);
  assert.deepEqual(ids({ status: 'Issued' }), ['1']);
});

test('generic API cannot set the holder, issue details or change a balance; new cards start Available', () => {
  const forged = { id: 'c', cardRef: 'X', siteName: 'Brit', status: 'Issued', suId: 'a', su_id: 'a', issuedDate: '2026-10-01', issuedBy: 'me', currentBalance: 50, notes: 'n' };
  const created = sanitizeOysterCardBody(forged, false, { name: 'Staff One' });
  assert.equal(created.status, 'Available');
  assert.equal(created.currentBalance, 50);                       // opening balance is allowed on registration
  for (const k of ['suId', 'su_id', 'issuedDate', 'issuedBy']) assert.ok(!(k in created), `${k} should be dropped`);
  const updated = sanitizeOysterCardBody(forged, true, { name: 'Staff One' });
  assert.ok(!('currentBalance' in updated));                      // balance changes need a reason, so they use the balance action
  assert.equal(updated.status, 'Issued');                         // the database refuses this move
  assert.equal(updated.updatedBy, 'Staff One');
});

test('card references are visible to staff who issue cards', () => {
  const rows = [{ cardRef: 'CARD-1', card_ref: 'CARD-1' }];
  assert.equal(redactSensitiveRows('oyster_cards', rows, 'Staff')[0].cardRef, 'CARD-1');
});

test('API policies and scope for cards, loans and history', () => {
  assert.equal(ENTITY_REGISTRY.oysterCards.write, 'suEditor');
  assert.equal(ENTITY_REGISTRY.oysterCards.remove, 'none');
  for (const name of ['oysterTransactions', 'oyster_card_transactions', 'oysterCardEvents']) {
    assert.equal(ENTITY_REGISTRY[name].write, 'none', name);
    assert.equal(ENTITY_REGISTRY[name].remove, 'none', name);
    assert.equal(ENTITY_REGISTRY[name].read, 'suEditor', name);
  }
  assert.equal(TABLE_SITE_COLUMN.oyster_cards, 'site_name');
  assert.equal(TABLE_SITE_COLUMN.oyster_card_transactions, 'site_name');
  assert.deepEqual(TABLE_PARENT_SCOPE.oyster_card_events, { linkColumn: 'card_id', linkField: 'cardId', parentTable: 'oyster_cards' });
});

test('card and loan columns map between the app and the database', () => {
  const stamp = { created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z' };
  const card = fromDatabaseRow('oyster_cards', { ...toDatabaseRow('oyster_cards', { id: 'c', cardRef: 'R', siteName: 'Brit', status: 'Available', currentBalance: 7.5 }), ...stamp });
  assert.deepEqual([card.cardRef, card.siteName, card.currentBalance], ['R', 'Brit', 7.5]);
  const txn = fromDatabaseRow('oyster_card_transactions', { ...toDatabaseRow('oyster_card_transactions', { id: 't', cardId: 'c', cardRef: 'R', suId: 'a', siteName: 'Brit', fundingRequestId: 'f', balanceAtIssue: 10, balanceAtReturn: 8, balanceAdjusted: true }), ...stamp });
  assert.deepEqual([txn.fundingRequestId, txn.balanceAtIssue, txn.balanceAtReturn, txn.balanceAdjusted], ['f', 10, 8, true]);
  const req = fromDatabaseRow('transport_funding_requests', { ...toDatabaseRow('transport_funding_requests', { id: 'r', siteName: 'S', mainAppRef: 'R', mainAppInitials: 'A', oysterCardId: 'c' }), ...stamp });
  assert.equal(req.oysterCardId, 'c');
});

test('migration 023 keeps its integrity rules and schema.sql carries it verbatim', () => {
  const sql = fs.readFileSync('db/migrations/023_oyster_card_inventory.sql', 'utf8');
  for (const needle of ['uq_oyster_txn_one_open_per_card', 'uq_oyster_txn_one_per_request', 'oyster_property_required', 'uq_oyster_card_ref', 'trg_oyster_cards_guard',
    'FOR UPDATE', 'REVOKE ALL ON FUNCTION public.issue_oyster_card', 'REVOKE ALL ON FUNCTION public.return_oyster_card', 'ON DELETE RESTRICT']) {
    assert.ok(sql.includes(needle), `migration should contain: ${needle}`);
  }
  const schema = fs.readFileSync('db/schema.sql', 'utf8');
  assert.ok(schema.includes(sql.trim()), 'db/schema.sql must include migration 023 verbatim');
});
