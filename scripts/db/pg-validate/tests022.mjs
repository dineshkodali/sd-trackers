// Behaviour checks for migration 022; imported by validate.mjs
export async function run022({ db, t, rejects }) {
  console.log('\n-- 022 behaviour');
  const mk = (id, status = 'Draft') => db.query(
    `INSERT INTO public.transport_funding_requests (id, site_name, main_app_ref, main_app_initials, status, requested_by_id, requested_by) VALUES ($1,'Site 1','REF','AB',$2,'req1','Requester')`, [id, status]);
  const tr = (id, to, note, user, role, fields) => db.query(
    `SELECT * FROM public.transition_transport_funding($1,$2,$3,$4,$5,$6,$7::jsonb)`, [id, to, note, user, user, role, JSON.stringify(fields || {})]);

  await t('create as Draft or Submitted works; creation is logged', async () => {
    await mk('t1'); await mk('t2', 'Submitted');
    const h = (await db.query(`SELECT to_status FROM public.transport_funding_status_history WHERE request_id='t1'`)).rows;
    if (h.length !== 1 || h[0].to_status !== 'Draft') throw new Error(JSON.stringify(h));
  });
  await t('creating straight into Approved is refused', () => rejects(`INSERT INTO public.transport_funding_requests (id, site_name, main_app_ref, main_app_initials, status) VALUES ('bad','S','R','A','Approved')`, '42501'));
  await t('creating with decision details is refused', () => rejects(`INSERT INTO public.transport_funding_requests (id, site_name, main_app_ref, main_app_initials, status, approved_by) VALUES ('bad2','S','R','A','Submitted','x')`, '42501'));
  await t('changing status by a plain UPDATE is refused', () => rejects(`UPDATE public.transport_funding_requests SET status='Approved' WHERE id='t2'`, '42501'));
  await t('setting decision details by a plain UPDATE is refused', () => rejects(`UPDATE public.transport_funding_requests SET payment_amount=999, approved_by='me' WHERE id='t2'`, '42501'));
  await t('a draft can still be edited', async () => { await db.query(`UPDATE public.transport_funding_requests SET total_cost=12.5 WHERE id='t1'`); });
  await t('once submitted the request content is locked, attachments still allowed', async () => {
    await rejects(`UPDATE public.transport_funding_requests SET total_cost=1 WHERE id='t2'`, '42501');
    await db.query(`UPDATE public.transport_funding_requests SET attachments='[{"name":"x"}]'::jsonb WHERE id='t2'`);
  });
  await t('Draft -> Submitted by site staff stamps submitted_at', async () => {
    const r = (await tr('t1', 'Submitted', '', 'req1', 'Staff')).rows[0];
    if (r.status !== 'Submitted' || !r.submitted_at) throw new Error(JSON.stringify(r));
  });
  await t('Staff cannot start a review', () => rejects(`SELECT * FROM public.transition_transport_funding('t1','Under Review','','s1','s1','Staff','{}')`, '42501'));
  await t('cannot skip stages (Submitted -> Approved)', () => rejects(`SELECT * FROM public.transition_transport_funding('t1','Approved','','m1','m1','Admin','{}')`, '23505'));
  await t('a General Manager starts the review', async () => {
    const r = (await tr('t1', 'Under Review', '', 'gm1', 'General Manager')).rows[0];
    if (r.reviewed_by !== 'gm1') throw new Error(JSON.stringify(r));
  });
  await t('a General Manager cannot decide', () => rejects(`SELECT * FROM public.transition_transport_funding('t1','Approved','','gm1','gm1','General Manager','{"approvedTransportMethod":"Travelcard","paymentAmount":"5"}')`, '42501'));
  await t('the requester cannot decide their own request even as Admin', () => rejects(`SELECT * FROM public.transition_transport_funding('t1','Approved','','req1','req1','Admin','{"approvedTransportMethod":"Travelcard","paymentAmount":"5"}')`, '42501'));
  await t('approval needs a method and a valid amount', async () => {
    await rejects(`SELECT * FROM public.transition_transport_funding('t1','Approved','','ad1','ad1','Admin','{"paymentAmount":"5"}')`, '22023');
    await rejects(`SELECT * FROM public.transition_transport_funding('t1','Approved','','ad1','ad1','Admin','{"approvedTransportMethod":"Travelcard","paymentAmount":"-5"}')`, '22023');
  });
  await t('rejection and clarification need a reason', async () => {
    await rejects(`SELECT * FROM public.transition_transport_funding('t1','Rejected','','ad1','ad1','Admin','{}')`, '22023');
    await rejects(`SELECT * FROM public.transition_transport_funding('t1','Clarification Required',' ','ad1','ad1','Admin','{}')`, '22023');
  });
  await t('a different Admin approves; decision details are recorded', async () => {
    const r = (await tr('t1', 'Approved', 'ok', 'ad1', 'Admin', { approvedTransportMethod: 'Travelcard', paymentAmount: '12.50' })).rows[0];
    if (r.status !== 'Approved' || r.approved_by !== 'ad1' || Number(r.payment_amount) !== 12.5 || r.decision !== 'Approved') throw new Error(JSON.stringify(r));
  });
  await t('issuing needs a reference', () => rejects(`SELECT * FROM public.transition_transport_funding('t1','Issued','','s1','s1','Staff','{}')`, '22023'));
  await t('Approved -> Issued -> Completed by site staff', async () => {
    const i = (await tr('t1', 'Issued', '', 's1', 'Staff', { journeyUrn: 'TC-123' })).rows[0];
    if (i.journey_urn !== 'TC-123' || i.issued_by !== 's1') throw new Error(JSON.stringify(i));
    const c = (await tr('t1', 'Completed', '', 's1', 'Staff', { completionNotes: 'Travelled' })).rows[0];
    if (c.status !== 'Completed' || !c.completed_at) throw new Error(JSON.stringify(c));
  });
  await t('a completed request is final', () => rejects(`SELECT * FROM public.transition_transport_funding('t1','Cancelled','reason here','ad1','ad1','Admin','{}')`, '23505'));
  await t('history shows every stage in order', async () => {
    const h = (await db.query(`SELECT from_status, to_status FROM public.transport_funding_status_history WHERE request_id='t1' ORDER BY changed_at, id`)).rows.map(x => `${x.from_status || '-'}>${x.to_status}`).join(',');
    const want = '->Draft,Draft>Submitted,Submitted>Under Review,Under Review>Approved,Approved>Issued,Issued>Completed'.replace('->Draft', '-' + '>Draft');
    if (h !== want) throw new Error(h);
  });
  await t('clarification loop: asked, resubmitted, then rejected by someone else', async () => {
    await mk('t3', 'Submitted'); await tr('t3', 'Under Review', '', 'gm1', 'General Manager');
    await tr('t3', 'Clarification Required', 'Need the appointment letter', 'ad1', 'Admin');
    const back = (await tr('t3', 'Submitted', '', 'req1', 'Staff')).rows[0];
    if (back.status !== 'Submitted') throw new Error(back.status);
    await tr('t3', 'Under Review', '', 'gm1', 'General Manager');
    const rej = (await tr('t3', 'Rejected', 'Not eligible', 'ad1', 'Admin')).rows[0];
    if (rej.status !== 'Rejected' || rej.rejection_reason !== 'Not eligible') throw new Error(JSON.stringify(rej));
  });
  await t('only the requester or a decider cancels a draft', async () => {
    await mk('t4');
    await rejects(`SELECT * FROM public.transition_transport_funding('t4','Cancelled','','other','other','Staff','{}')`, '42501');
    await tr('t4', 'Cancelled', '', 'req1', 'Staff');
  });
  await t('only draft or cancelled requests can be deleted', async () => {
    await rejects(`DELETE FROM public.transport_funding_requests WHERE id='t2'`, '42501');
    await rejects(`DELETE FROM public.transport_funding_requests WHERE id='t1'`, '42501');
    await db.query(`DELETE FROM public.transport_funding_requests WHERE id='t4'`);
  });
  await t('history table and function are closed to anon and authenticated', async () => {
    const x = (await db.query(`SELECT has_table_privilege('anon','public.transport_funding_status_history','SELECT') a,
      has_table_privilege('authenticated','public.transport_funding_status_history','INSERT') b,
      has_function_privilege('authenticated','public.transition_transport_funding(text,text,text,text,text,text,jsonb)','EXECUTE') c`)).rows[0];
    if (x.a || x.b || x.c) throw new Error(JSON.stringify(x));
  });
}
