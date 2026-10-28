// Behaviour checks for migration 023 (Oyster card inventory and loans); imported by validate.mjs
export async function run023({ db, t, rejects }) {
  console.log('\n-- 023 behaviour');
  const one = async (sql, params) => (await db.query(sql, params)).rows[0];
  const card = (id, ref, site = 'Site 1', balance = 10) => db.query(
    `INSERT INTO public.oyster_cards (id, card_ref, site_name, status, current_balance, created_by) VALUES ($1,$2,$3,'Available',$4,'Staff')`, [id, ref, site, balance]);
  const issue = (cardId, su, req, bal, role = 'Staff', user = 'u1') => db.query(
    `SELECT * FROM public.issue_oyster_card($1,$2,$3,$4,NULL,$5,$5,$6)`, [cardId, su, req, bal, user, role]);
  const ret = (txn, bal, cond = 'Good', notes = '', role = 'Staff') => db.query(
    `SELECT * FROM public.return_oyster_card($1,$2,$3,$4,NULL,'u2','u2',$5)`, [txn, bal, cond, notes, role]);
  const txnOf = async cardId => (await one(`SELECT id FROM public.oyster_card_transactions WHERE card_id=$1 AND status='Issued'`, [cardId])).id;

  await t('registering a card needs a property and a balance; it starts Available and is logged', async () => {
    await card('c1', 'CARD-1');
    await rejects(`INSERT INTO public.oyster_cards (id, card_ref, status, current_balance) VALUES ('x1','NOSITE','Available',5)`, '23514');
    await rejects(`INSERT INTO public.oyster_cards (id, card_ref, site_name, status) VALUES ('x2','NOBAL','Site 1','Available')`, '23514');
    const e = (await db.query(`SELECT event_type, balance FROM public.oyster_card_events WHERE card_id='c1'`)).rows;
    if (e.length !== 1 || e[0].event_type !== 'Registered' || Number(e[0].balance) !== 10) throw new Error(JSON.stringify(e));
  });
  await t('a card reference is unique across properties', () => rejects(
    `INSERT INTO public.oyster_cards (id, card_ref, site_name, status, current_balance) VALUES ('c1b',' card-1 ','Site 2','Available',1)`, '23505'));
  await t('a card cannot be registered straight into Issued, or with a holder', async () => {
    await rejects(`INSERT INTO public.oyster_cards (id, card_ref, site_name, status, current_balance, su_id) VALUES ('x3','X3','Site 1','Issued',5,'a')`, '42501');
    await rejects(`INSERT INTO public.oyster_cards (id, card_ref, site_name, status, current_balance, su_id) VALUES ('x4','X4','Site 1','Available',5,'a')`, '42501');
  });
  await t('status, holder and issue details cannot be changed by a plain update', async () => {
    await rejects(`UPDATE public.oyster_cards SET status='Issued', su_id='a' WHERE id='c1'`, '42501');
    await rejects(`UPDATE public.oyster_cards SET su_id='a' WHERE id='c1'`, '42501');
  });
  await t('a plain update may still edit notes and mark an available card Lost / Deactivated', async () => {
    await db.query(`UPDATE public.oyster_cards SET notes='kept in safe' WHERE id='c1'`);
    await card('c9', 'CARD-9'); await db.query(`UPDATE public.oyster_cards SET status='Deactivated' WHERE id='c9'`);
  });
  await t('a deactivated card frees its reference', async () => { await card('c9b', 'CARD-9'); });

  await t('issuing records the loan, holder, handover balance and history', async () => {
    const x = (await issue('c1', 'b', null, 12.5)).rows[0];
    if (x.status !== 'Issued' || x.site_name !== 'Site 1' || x.card_ref !== 'CARD-1' || Number(x.balance_at_issue) !== 12.5) throw new Error(JSON.stringify(x));
    const c = await one(`SELECT status, su_id, current_balance FROM public.oyster_cards WHERE id='c1'`);
    if (c.status !== 'Issued' || c.su_id !== 'b' || Number(c.current_balance) !== 12.5) throw new Error(JSON.stringify(c));
    const ev = (await db.query(`SELECT event_type, previous_balance, balance, transaction_id FROM public.oyster_card_events WHERE card_id='c1' ORDER BY changed_at, id`)).rows;
    if (ev.length !== 2 || ev[1].event_type !== 'Issued' || Number(ev[1].previous_balance) !== 10 || ev[1].transaction_id !== x.id) throw new Error(JSON.stringify(ev));
  });
  await t('a card on loan cannot be issued to anyone else', () => rejects(`SELECT * FROM public.issue_oyster_card('c1','c',NULL,5,NULL,'u1','u1','Staff')`, '23505'));
  await t('only available cards: lost, damaged and deactivated cards cannot be issued', async () => {
    await card('c2', 'CARD-2'); await db.query(`UPDATE public.oyster_cards SET status='Lost' WHERE id='c2'`);
    await rejects(`SELECT * FROM public.issue_oyster_card('c2','c',NULL,5,NULL,'u1','u1','Staff')`, '23505');
  });
  await t('the handover balance is required, and so is a permitted role', async () => {
    await card('c3', 'CARD-3');
    await rejects(`SELECT * FROM public.issue_oyster_card('c3','c',NULL,NULL,NULL,'u1','u1','Staff')`, '22023');
    await rejects(`SELECT * FROM public.issue_oyster_card('c3','c',NULL,-1,NULL,'u1','u1','Staff')`, '22023');
    await rejects(`SELECT * FROM public.issue_oyster_card('c3','c',NULL,5,NULL,'u1','u1','Viewer')`, '42501');
  });
  await t('a future issue date is refused', () => rejects(`SELECT * FROM public.issue_oyster_card('c3','c',NULL,5,'2999-01-01','u1','u1','Staff')`, '22023'));
  await t('an archived Service User cannot be issued a card', async () => {
    await db.query(`SELECT * FROM public.request_su_archive('c','Archive','left','u1','U1')`);
    const id = (await one(`SELECT id FROM public.su_archive_requests WHERE su_id='c' AND status='Pending'`)).id;
    await db.query(`SELECT * FROM public.decide_su_archive_request($1,'Approved','ok','u9','U9')`, [id]);
    await rejects(`SELECT * FROM public.issue_oyster_card('c3','c',NULL,5,NULL,'u1','u1','Staff')`, '22023');
  });
  await t('the loan itself cannot be edited or deleted outside the workflow', async () => {
    await rejects(`UPDATE public.oyster_card_transactions SET balance_at_issue = 99`, '42501');
    await rejects(`DELETE FROM public.oyster_card_transactions`, '42501');
    await rejects(`INSERT INTO public.oyster_card_transactions (id, card_id, card_ref, su_id, site_name, issued_date, issued_by, balance_at_issue) VALUES ('hand','c3','CARD-3','b','Site 1','2026-01-01','x',1)`, '42501');
  });

  await t('returning needs the actual remaining balance and a condition', async () => {
    const id = await txnOf('c1');
    await rejects(`SELECT * FROM public.return_oyster_card($1,NULL,'Good','',NULL,'u2','u2','Staff')`, '22023', [id]);
    await rejects(`SELECT * FROM public.return_oyster_card($1,-2,'Good','',NULL,'u2','u2','Staff')`, '22023', [id]);
    await rejects(`SELECT * FROM public.return_oyster_card($1,5,'Mint','',NULL,'u2','u2','Staff')`, '22023', [id]);
    await rejects(`SELECT * FROM public.return_oyster_card($1,5,'Damaged','',NULL,'u2','u2','Staff')`, '22023', [id]);
    await rejects(`SELECT * FROM public.return_oyster_card($1,5,'Good','',NULL,'u2','u2','Viewer')`, '42501', [id]);
  });
  await t('a balance change while the card is out needs a reason and flags the loan', async () => {
    await rejects(`SELECT * FROM public.set_oyster_balance('c1', 20, '', 'Staff', 'Staff')`, '22023');
    await db.query(`SELECT * FROM public.set_oyster_balance('c1', 20, 'Top-up by hotel', 'Staff', 'Staff')`);
    const x = await one(`SELECT balance_adjusted FROM public.oyster_card_transactions WHERE card_id='c1' AND status='Issued'`);
    if (x.balance_adjusted !== true) throw new Error('not flagged');
  });
  await t('a good return makes the card available again with its new balance; history is kept', async () => {
    const id = await txnOf('c1');
    const x = (await ret(id, 7.25)).rows[0];
    if (x.status !== 'Returned' || Number(x.balance_at_return) !== 7.25 || x.return_condition !== 'Good' || x.returned_by !== 'u2') throw new Error(JSON.stringify(x));
    const c = await one(`SELECT status, su_id, current_balance FROM public.oyster_cards WHERE id='c1'`);
    if (c.status !== 'Available' || c.su_id !== null || Number(c.current_balance) !== 7.25) throw new Error(JSON.stringify(c));
    const n = await one(`SELECT count(*)::int AS n FROM public.oyster_card_transactions WHERE card_id='c1'`);
    if (n.n !== 1) throw new Error('loan lost');
    await rejects(`SELECT * FROM public.return_oyster_card($1,7,'Good','',NULL,'u2','u2','Staff')`, '23505', [id]);
  });
  await t('the same card can be issued again after a good return', async () => {
    const x = (await issue('c1', 'a', null, 7.25)).rows[0];
    if (x.status !== 'Issued') throw new Error(x.status);
    const loans = (await db.query(`SELECT status FROM public.oyster_card_transactions WHERE card_id='c1' ORDER BY issued_date, created_at`)).rows.map(r => r.status).join(',');
    if (loans !== 'Returned,Issued') throw new Error(loans);
  });
  await t('a damaged return is recorded but the card is not reusable', async () => {
    const id = await txnOf('c1');
    await ret(id, 3, 'Damaged', 'Chip cracked');
    const c = await one(`SELECT status FROM public.oyster_cards WHERE id='c1'`);
    if (c.status !== 'Damaged') throw new Error(c.status);
    await rejects(`SELECT * FROM public.issue_oyster_card('c1','b',NULL,3,NULL,'u1','u1','Staff')`, '23505');
  });
  await t('a lost card is written off with a note and no balance', async () => {
    await card('c4', 'CARD-4'); const x = (await issue('c4', 'b', null, 6)).rows[0];
    await rejects(`SELECT * FROM public.return_oyster_card($1,NULL,'Lost','',NULL,'u2','u2','Staff')`, '22023', [x.id]);
    const l = (await ret(x.id, null, 'Lost', 'Lost on the bus')).rows[0];
    if (l.status !== 'Lost' || l.balance_at_return !== null) throw new Error(JSON.stringify(l));
    const c = await one(`SELECT status, su_id FROM public.oyster_cards WHERE id='c4'`);
    if (c.status !== 'Lost' || c.su_id !== null) throw new Error(JSON.stringify(c));
  });

  await t('property rule: a request from another property cannot take the card', async () => {
    await card('c5', 'CARD-5', 'Site 1');
    await db.query(`INSERT INTO public.transport_funding_requests (id, site_name, main_app_ref, main_app_initials, status, requested_by_id, requested_by) VALUES ('fr-other','Site 2','R','A','Submitted','req1','Req')`);
    await db.query(`SELECT * FROM public.transition_transport_funding('fr-other','Under Review','','gm1','gm1','General Manager','{}')`);
    await db.query(`SELECT * FROM public.transition_transport_funding('fr-other','Approved','','ad1','ad1','Admin','{"approvedTransportMethod":"Oyster Card","paymentAmount":"5"}')`);
    await rejects(`SELECT * FROM public.issue_oyster_card('c5','b','fr-other',5,NULL,'u1','u1','Staff')`, '22023');
  });
  await t('a request must be approved before a card is issued against it', async () => {
    await db.query(`INSERT INTO public.transport_funding_requests (id, site_name, main_app_ref, main_app_initials, status, requested_by_id, requested_by) VALUES ('fr-sub','Site 1','R','A','Submitted','req1','Req')`);
    await rejects(`SELECT * FROM public.issue_oyster_card('c5','b','fr-sub',5,NULL,'u1','u1','Staff')`, '23505');
  });
  await t('issuing against an approved request moves it to Issued with the card ref, and returning completes it', async () => {
    await db.query(`INSERT INTO public.transport_funding_requests (id, site_name, main_app_ref, main_app_initials, status, requested_by_id, requested_by) VALUES ('fr1','Site 1','R','A','Submitted','req1','Req')`);
    await db.query(`SELECT * FROM public.transition_transport_funding('fr1','Under Review','','gm1','gm1','General Manager','{}')`);
    await db.query(`SELECT * FROM public.transition_transport_funding('fr1','Approved','','ad1','ad1','Admin','{"approvedTransportMethod":"Oyster Card","paymentAmount":"5"}')`);
    const x = (await issue('c5', 'b', 'fr1', 5)).rows[0];
    if (x.funding_request_id !== 'fr1') throw new Error(JSON.stringify(x));
    const r = await one(`SELECT status, journey_urn, issued_by FROM public.transport_funding_requests WHERE id='fr1'`);
    if (r.status !== 'Issued' || r.journey_urn !== 'CARD-5') throw new Error(JSON.stringify(r));
    await ret(x.id, 2.5);
    const done = await one(`SELECT status, completion_notes FROM public.transport_funding_requests WHERE id='fr1'`);
    if (done.status !== 'Completed' || !/CARD-5/.test(done.completion_notes)) throw new Error(JSON.stringify(done));
  });
  await t('one request can have only one loan: no duplicate funding record', async () => {
    await card('c6', 'CARD-6');
    await rejects(`SELECT * FROM public.issue_oyster_card('c6','a','fr1',5,NULL,'u1','u1','Staff')`, '23505');   // fr1 is Completed, not Approved
    const n = await one(`SELECT count(*)::int AS n FROM public.oyster_card_transactions WHERE funding_request_id='fr1'`);
    if (n.n !== 1) throw new Error(String(n.n));
  });
  await t('a failed issue changes nothing (rolled back as one unit)', async () => {
    await db.query(`INSERT INTO public.transport_funding_requests (id, site_name, main_app_ref, main_app_initials, status, requested_by_id, requested_by) VALUES ('fr2','Site 1','R','A','Submitted','req1','Req')`);
    const before = await one(`SELECT (SELECT count(*) FROM public.oyster_card_transactions)::int AS t, (SELECT status FROM public.oyster_cards WHERE id='c6') AS s`);
    await rejects(`SELECT * FROM public.issue_oyster_card('c6','a','fr2',5,NULL,'u1','u1','Staff')`, '23505');
    const after = await one(`SELECT (SELECT count(*) FROM public.oyster_card_transactions)::int AS t, (SELECT status FROM public.oyster_cards WHERE id='c6') AS s`);
    if (before.t !== after.t || after.s !== 'Available') throw new Error(JSON.stringify({ before, after }));
  });
  await t('a card on loan cannot change property or reference', async () => {
    await card('c7', 'CARD-7'); await issue('c7', 'a', null, 4);
    await rejects(`UPDATE public.oyster_cards SET site_name='Site 2' WHERE id='c7'`, '42501');
    await rejects(`UPDATE public.oyster_cards SET card_ref='CHANGED' WHERE id='c7'`, '42501');
  });
  await t('loan history survives: a card with history cannot be deleted', () => rejects(`DELETE FROM public.oyster_cards WHERE id='c1'`, '23001'));
  await t('new table is closed to anon and authenticated', async () => {
    const x = await one(`SELECT has_table_privilege('anon','public.oyster_card_transactions','SELECT') a, has_table_privilege('authenticated','public.oyster_card_transactions','INSERT') b,
      has_function_privilege('authenticated','public.issue_oyster_card(text,text,text,numeric,date,text,text,text)','EXECUTE') c`);
    if (x.a || x.b || x.c) throw new Error(JSON.stringify(x));
  });
}
