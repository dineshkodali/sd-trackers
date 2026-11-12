import test from 'node:test';
import assert from 'node:assert/strict';
import {
  londonNow, relativeDay, periodRange, parseIsoDate, parseWall, wallMinutesBetween, addDaysIso, daysBetween, createSiteResolver, complianceInfo
} from '../src/utils/operationsRules.ts';
import {
  selectKpis, selectAttention, selectDeadlines, selectSiteRows, selectOverview, buildSnapshot, type OpsInput, type OpsScope
} from '../src/utils/operationsSelectors.ts';

/* ----------------------------------------------------------------- rules */

test('London time follows GMT and BST regardless of the machine zone', () => {
  assert.equal(londonNow(new Date('2026-11-12T12:00:00Z')).wall, '2026-11-12 12:00'); // GMT
  assert.equal(londonNow(new Date('2026-07-12T23:30:00Z')).wall, '2026-07-13 00:30'); // BST: already the next day
  assert.equal(londonNow(new Date('2026-03-29T00:59:00Z')).wall, '2026-03-29 00:59'); // last minute of GMT
  assert.equal(londonNow(new Date('2026-03-29T01:00:00Z')).wall, '2026-03-29 02:00'); // clocks go forward
});

test('dates are read strictly and never guessed', () => {
  assert.equal(parseIsoDate('2026-11-12'), '2026-11-12');
  assert.equal(parseIsoDate('2026-11-12T10:00:00Z'), '2026-11-12');
  assert.equal(parseIsoDate('12/11/2026'), null);       // day-first or month-first text is rejected
  assert.equal(parseIsoDate('2026-02-31'), null);
  assert.equal(parseIsoDate(''), null);
  assert.equal(parseIsoDate(undefined), null);
  assert.equal(parseWall('2026-11-12'), '2026-11-12 23:59');   // date only = end of day
  assert.equal(parseWall('2026-11-12 9:05'), '2026-11-12 09:05');
  assert.equal(parseWall('2026-11-12 25:00'), null);
});

test('day and minute arithmetic', () => {
  assert.equal(addDaysIso('2026-11-30', 1), '2026-12-01');
  assert.equal(daysBetween('2026-11-12', '2026-11-18'), 6);
  assert.equal(daysBetween('2026-11-12', '2026-11-10'), -2);
  assert.equal(wallMinutesBetween('2026-11-12 12:00', '2026-11-12 18:00'), 360);
  assert.equal(wallMinutesBetween('2026-11-12 12:00', '2026-11-11 23:00'), -780);
});

test('reporting periods end today and include both ends', () => {
  assert.deepEqual(periodRange('today', '2026-11-12'), { from: '2026-11-12', to: '2026-11-12' });
  assert.deepEqual(periodRange('7d', '2026-11-12'), { from: '2026-11-06', to: '2026-11-12' });
  assert.deepEqual(periodRange('30d', '2026-11-12'), { from: '2026-10-14', to: '2026-11-12' });
  assert.deepEqual(periodRange('month', '2026-11-12'), { from: '2026-11-01', to: '2026-11-12' });
  assert.deepEqual(periodRange('7d', '2026-01-03'), { from: '2025-12-28', to: '2026-01-03' }); // across a year end
});

test('relative day wording', () => {
  assert.equal(relativeDay('2026-11-12', '2026-11-12'), 'Today');
  assert.equal(relativeDay('2026-11-13', '2026-11-12'), 'Tomorrow');
  assert.equal(relativeDay('2026-11-11', '2026-11-12'), 'Yesterday');
  assert.equal(relativeDay('2026-11-17', '2026-11-12'), 'in 5 d');
  assert.equal(relativeDay('2026-11-02', '2026-11-12'), '10 d ago');
});

test('site names resolve exactly, not by substring', () => {
  const r = createSiteResolver([{ id: 'site-1', name: 'Brit Hotel' }, { id: 'site-2', name: 'Brit Hotel 2' }]);
  assert.equal(r('Brit Hotel'), 'site-1');
  assert.equal(r('  brit-hotel '), 'site-1');
  assert.equal(r('site-2'), 'site-2');
  assert.equal(r('Brit'), null);          // the substring trap in isSitePermitted
  assert.equal(r('Brit Hotel 2'), 'site-2');
  assert.equal(r(''), null);
  const dup = createSiteResolver([{ id: 'a', name: 'Same' }, { id: 'b', name: 'Same' }]);
  assert.equal(dup('Same'), null);        // an ambiguous name is not guessed
});

test('compliance state comes from the expiry date, not the typed status', () => {
  assert.equal(complianceInfo('2026-11-11', '2026-11-12').state, 'expired');
  assert.equal(complianceInfo('2026-11-12', '2026-11-12').state, 'due-30');   // expires today: still valid today
  assert.equal(complianceInfo('2026-12-12', '2026-11-12').state, 'due-30');   // exactly 30 days
  assert.equal(complianceInfo('2026-12-13', '2026-11-12').state, 'due-90');
  assert.equal(complianceInfo('2027-03-01', '2026-11-12').state, 'valid');
  assert.equal(complianceInfo('soon', '2026-11-12').state, 'unknown');
});

/* ----------------------------------------------------------------- fixtures */

const NOW = new Date('2026-11-12T12:00:00Z'); // London 12:00, 12 Nov 2026

const sites = [{ id: 'site-1', name: 'Brit Hotel' }, { id: 'site-2', name: 'Brit Hotel 2' }];

const maint = (id: string, site: string, priority: string, closeDueDate: string, extra: any = {}): any =>
  ({ id, site, priority, closeDueDate, description: `Defect ${id}`, defectStatus: 'In Process', action: 'Open', room: '1A', ...extra });

function fixture(): OpsInput {
  return {
    sites,
    maintenance: [
      maint('m1', 'Brit Hotel', 'CAT 1', '2026-11-12 08:00'),                      // open CAT 1, overdue 4h
      maint('m2', 'Brit Hotel', 'CAT 2', '2026-11-10 09:00'),                      // overdue
      maint('m3', 'Brit Hotel', 'CAT 3', '2026-11-12 18:00'),                      // due in 6h
      maint('m4', 'Brit Hotel', 'CAT 2', '2026-11-01 09:00', { defectStatus: 'Completed', action: 'Closed', actualClosedDate: '2026-11-10' }),
      maint('m5', 'Brit', 'CAT 1', '2026-11-01 09:00'),                            // matches no site
      maint('m6', 'Brit Hotel 2', 'CAT 3', '2026-12-30 10:00'),                    // not due for weeks
    ],
    compliance: [
      { id: 'c1', siteName: 'Brit Hotel', complianceType: 'Gas Safety', expiryDate: '2026-11-01', status: 'Compliant', contractorName: 'Acme' },
      { id: 'c2', siteName: 'Brit Hotel', complianceType: 'EICR', expiryDate: '2026-11-18', status: 'Compliant', contractorName: 'Volt' },
      { id: 'c3', siteName: 'Brit Hotel', complianceType: 'Legionella', expiryDate: '12/11/2026', status: 'Compliant', contractorName: 'Aqua' },
      { id: 'c4', siteName: 'Brit Hotel 2', complianceType: 'Fire Alarm', expiryDate: '2027-06-01', status: 'Compliant', contractorName: 'Fire' },
    ] as any,
    escalations: [
      { id: 'e1', siteName: 'Brit Hotel', site: 'Brit Hotel', status: 'Active', urgency: 'Critical', incidentType: 'Assault' },
      { id: 'e2', siteName: 'Brit Hotel', site: 'Brit Hotel', status: 'Resolved', urgency: 'Critical', incidentType: 'Old' },
      { id: 'e3', siteName: 'Brit Hotel 2', site: 'Brit Hotel 2', status: 'Active', urgency: 'Low', incidentType: 'Noise' },
    ] as any,
    properties: [
      { id: 'p1', siteId: 'site-1', propertyName: 'Block A' },
      { id: 'p2', siteId: 'site-2', propertyName: 'Block B' },
    ] as any,
    rooms: [
      { id: 'r1', propertyId: 'p1', roomNumber: '1A', capacity: 2, status: 'Available', occupancyStatus: 'Available', nextInspectionDue: '2026-11-01' },
      { id: 'r2', propertyId: 'p1', roomNumber: '1B', capacity: 1, status: 'Void', occupancyStatus: 'Available', nextInspectionDue: '2026-10-01' }, // out of use
      { id: 'room-prop-9', propertyId: 'p1', roomNumber: '9', capacity: 2, status: 'Available', occupancyStatus: 'Available', description: 'Standard Twin Bedroom with en-suite shower. Floor 1.', nextInspectionDue: '2026-10-01' }, // seeded placeholder
      { id: 'r3', propertyId: 'p2', roomNumber: '2A', capacity: 1, status: 'Available', occupancyStatus: 'Available' },
    ] as any,
    placements: [
      { id: 'pl1', suId: 'su1', siteId: 'site-1', propertyId: 'p1', roomId: 'r1', status: 'Active' },
      { id: 'pl2', suId: 'su2', siteId: 'site-1', propertyId: 'p1', roomId: 'r1', status: 'Active' },
      { id: 'pl3', suId: 'su3', siteId: 'site-1', propertyId: 'p1', roomId: 'gone', status: 'Active' },      // orphan
      { id: 'pl4', suId: 'su4', siteId: 'site-1', propertyId: 'p1', roomId: 'r1', status: 'Completed' },     // ended
      { id: 'pl5', suId: 'su5', siteId: 'site-2', propertyId: 'p2', roomId: 'r3', status: 'Active' },
    ] as any,
    roomIssues: [
      { id: 'i1', propertyId: 'p1', roomId: 'r1', title: 'Broken window', status: 'Open', dueDate: '2026-11-08' },
      { id: 'i2', propertyId: 'p1', roomId: 'r1', title: 'Leak', status: 'In Progress', dueDate: '2026-11-08', maintenanceRecordId: 'm2' }, // already counted as defect m2
      { id: 'i3', propertyId: 'p1', roomId: 'r1', title: 'Done', status: 'Resolved', dueDate: '2026-11-01' },
    ] as any,
    peepPlans: [
      { id: 'pp1', suId: 'su1', status: 'Active', riskLevel: 'High', reviewDate: '2026-11-05' },          // overdue
      { id: 'pp2', suId: 'su2', status: 'Active', riskLevel: 'Low', reviewDate: '2027-01-01' },
      { id: 'pp3', suId: 'su1', status: 'Archived', riskLevel: 'High', reviewDate: '2020-01-01' },        // archived: ignored
    ] as any,
    followUps: [
      { id: 'f1', suId: 'su2', status: 'Open', thresholdDays: 3, dueDate: '2026-11-11' },                 // overdue
      { id: 'f2', suId: 'su2', status: 'Resolved', thresholdDays: 7, dueDate: '2026-10-01', resolvedAt: '2026-11-11T09:00:00Z' },
    ] as any,
  };
}

const ALL: OpsScope = { allowedSiteIds: 'all', siteId: 'all' };

/* ----------------------------------------------------------------- KPIs */

test('KPIs use one definition each and ignore closed, orphan and placeholder data', () => {
  const k = selectKpis(fixture(), ALL, NOW);
  assert.equal(k.activeSites, 2);
  assert.equal(k.openMaintenance, 4);          // m1 m2 m3 m6 (m4 closed, m5 unresolved site)
  assert.equal(k.openCat1, 1);                 // m5 is CAT 1 but belongs to no site
  assert.equal(k.overdueMaintenance, 2);       // m1 m2
  assert.equal(k.maintenanceDueIn24h, 1);      // m3
  assert.equal(k.complianceExpired, 1);        // c1 despite status "Compliant"
  assert.equal(k.complianceDue30, 1);          // c2
  assert.deepEqual(k.overdueActions, { total: 4, peep: 1, followUps: 1, inspections: 1, roomIssues: 1 });
  assert.equal(k.openEscalations, 2);
  assert.equal(k.criticalEscalations, 1);
  assert.equal(k.activeResidents, 3);          // pl1 pl2 pl5; orphan pl3 and ended pl4 excluded
});

test('occupancy uses real rooms only', () => {
  const k = selectKpis(fixture(), ALL, NOW);
  assert.equal(k.occupancy.residents, 3);
  assert.equal(k.occupancy.beds, 3);           // r1 (2) + r3 (1); void room and placeholder room excluded
  assert.equal(k.occupancy.roomsOutOfUse, 1);
});

test('a room issue linked to an open defect is counted once, as the defect', () => {
  const k = selectKpis(fixture(), ALL, NOW);
  assert.equal(k.overdueActions.roomIssues, 1); // i1 only; i2 is defect m2
  const rows = selectAttention(fixture(), ALL, NOW);
  assert.equal(rows.filter(r => r.key === 'issue:i2').length, 0);
  assert.equal(rows.filter(r => r.key === 'maintenance:m2').length, 1);
});

test('records that match no site are reported, not counted against another site', () => {
  const snap = buildSnapshot(fixture(), ALL, NOW);
  assert.equal(snap.dataQuality.unresolvedSite.maintenance, 1);
  assert.equal(snap.kpis.openMaintenance, 4);
  assert.equal(snap.dataQuality.unreadableDate.compliance, 1); // c3 "12/11/2026"
});

/* ----------------------------------------------------------------- scope */

test('a site filter narrows every number to that site', () => {
  const s: OpsScope = { allowedSiteIds: 'all', siteId: 'site-2' };
  const k = selectKpis(fixture(), s, NOW);
  assert.equal(k.activeSites, 1);
  assert.equal(k.openMaintenance, 1);
  assert.equal(k.overdueMaintenance, 0);
  assert.equal(k.complianceExpired, 0);
  assert.equal(k.overdueActions.total, 0);
  assert.equal(k.openEscalations, 1);
  assert.equal(k.activeResidents, 1);
});

test('a user can never see sites outside their authorised set, even by selecting one', () => {
  const only2: OpsScope = { allowedSiteIds: new Set(['site-2']), siteId: 'all' };
  const k = selectKpis(fixture(), only2, NOW);
  assert.equal(k.openMaintenance, 1);
  assert.equal(k.activeSites, 1);
  const forced: OpsScope = { allowedSiteIds: new Set(['site-2']), siteId: 'site-1' };
  const none = selectKpis(fixture(), forced, NOW);
  assert.equal(none.openMaintenance, 0);
  assert.equal(none.activeSites, 0);
  assert.deepEqual(selectAttention(fixture(), forced, NOW), []);
  assert.deepEqual(selectSiteRows(fixture(), forced, NOW), []);
});

/* ----------------------------------------------------------------- attention */

test('attention rows are ranked by reason then by how overdue, one row per record', () => {
  const rows = selectAttention(fixture(), ALL, NOW);
  assert.deepEqual(rows.map(r => r.reason), [
    'CAT 1 open',
    'Maintenance overdue',
    'Compliance expired',
    'Escalation',
    'Absence follow-up overdue',
    'PEEP review overdue',
    'Room issue overdue',
    'Room inspection overdue',
    'Compliance due in 7 days'
  ]);
  assert.equal(new Set(rows.map(r => r.key)).size, rows.length);
  assert.equal(rows[0].key, 'maintenance:m1');
  assert.equal(rows.find(r => r.key === 'escalation:e3'), undefined); // Low urgency is not an intervention item
});

test('room items open their property; other items open themselves', () => {
  const rows = selectAttention(fixture(), ALL, NOW);
  assert.equal(rows.find(r => r.key === 'inspection:r1')!.openId, 'p1');
  assert.equal(rows.find(r => r.key === 'issue:i1')!.openId, 'p1');
  assert.equal(rows.find(r => r.key === 'maintenance:m1')!.openId, undefined);
  assert.equal(rows.find(r => r.key === 'peep:pp1')!.openId, undefined);
});

test('a CAT 1 defect appears once even when it is also overdue', () => {
  const rows = selectAttention(fixture(), ALL, NOW).filter(r => r.key === 'maintenance:m1');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].reason, 'CAT 1 open');
  assert.match(rows[0].dueText, /Overdue 4h/);
});

test('KPI numbers equal the rows behind them', () => {
  const snap = buildSnapshot(fixture(), ALL, NOW);
  const actionReasons = ['Absence follow-up overdue', 'PEEP review overdue', 'Room issue overdue', 'Room inspection overdue'];
  assert.equal(snap.attention.filter(r => actionReasons.includes(r.reason)).length, snap.kpis.overdueActions.total);
  assert.equal(snap.attention.filter(r => r.reason === 'Compliance expired').length, snap.kpis.complianceExpired);
  const maintRows = snap.attention.filter(r => r.page === 'maintenance').length;
  assert.equal(maintRows, snap.kpis.overdueMaintenance); // here every overdue defect is listed once (m1 as CAT 1, m2 as overdue)
});

test('the attention list is the same whatever order the data arrives in', () => {
  const a = fixture();
  const b = fixture();
  b.maintenance.reverse(); b.compliance.reverse(); b.peepPlans.reverse(); b.roomIssues.reverse();
  assert.deepEqual(selectAttention(a, ALL, NOW), selectAttention(b, ALL, NOW));
});

/* ----------------------------------------------------------------- deadlines */

test('deadlines are future-dated, inside the window, and sorted by due time', () => {
  const d = selectDeadlines(fixture(), ALL, 14, NOW);
  assert.deepEqual(d.map(x => x.key), ['maintenance:m3', 'compliance:c2']);
  assert.equal(d[0].due, '2026-11-12 18:00');
  assert.equal(selectDeadlines(fixture(), ALL, 90, NOW).some(x => x.key === 'compliance:c4'), false); // June 2027 is outside 90 days
  assert.equal(selectDeadlines(fixture(), ALL, 30, NOW).some(x => x.key === 'maintenance:m6'), false); // 30 Dec is 48 days away: outside 30
  assert.equal(selectDeadlines(fixture(), ALL, 60, NOW).some(x => x.key === 'maintenance:m6'), true);  // ...and inside 60
});

test('overdue items are not listed as upcoming', () => {
  const keys = selectDeadlines(fixture(), ALL, 14, NOW).map(x => x.key);
  assert.equal(keys.includes('maintenance:m1'), false);
  assert.equal(keys.includes('compliance:c1'), false);
});

/* ----------------------------------------------------------------- sites and overview */

test('the site table ranks by plain counts of things needing action', () => {
  const rows = selectSiteRows(fixture(), ALL, NOW);
  assert.deepEqual(rows.map(r => r.siteId), ['site-1', 'site-2']);
  const s1 = rows[0];
  assert.equal(s1.overdueMaintenance, 2);
  assert.equal(s1.openCat1, 1);
  assert.equal(s1.complianceExpired, 1);
  assert.equal(s1.overdueActions, 4);
  assert.equal(s1.attentionCount, 2 + 1 + 1 + 4);
  assert.equal(s1.residents, 2);
  assert.equal(rows[1].attentionCount, 0);
});

test('the overview shows a dash (null) where a cell cannot be calculated', () => {
  const rows = selectOverview(fixture(), ALL, { from: '2026-11-01', to: '2026-11-30' }, NOW);
  const byKey = Object.fromEntries(rows.map(r => [r.key, r]));
  assert.equal(byKey.maintenance.completedInPeriod, 1);       // m4 closed 10 Nov
  assert.equal(byKey.compliance.completedInPeriod, null);
  assert.equal(byKey.escalations.overdue, null);
  assert.equal(byKey.escalations.outstanding, 2);
  assert.equal(byKey.followUps.completedInPeriod, 1);         // f2 resolved 11 Nov
  assert.equal(byKey.peep.overdue, 1);
});

test('the period moves completed counts but never outstanding or overdue counts', () => {
  const wide = selectOverview(fixture(), ALL, { from: '2026-01-01', to: '2026-12-31' }, NOW);
  const narrow = selectOverview(fixture(), ALL, { from: '2026-11-20', to: '2026-11-21' }, NOW);
  const strip = (rows: typeof wide) => rows.map(r => [r.key, r.outstanding, r.overdue, r.dueSoon]);
  assert.deepEqual(strip(wide), strip(narrow));
  assert.equal(narrow.find(r => r.key === 'maintenance')!.completedInPeriod, 0);
});

/* ----------------------------------------------------------------- time zone */

test('overdue is decided on London wall-clock time (BST), not UTC', () => {
  const input: OpsInput = { ...fixture(), maintenance: [maint('s1', 'Brit Hotel', 'CAT 2', '2026-07-13 00:15')] };
  // 23:30 UTC on 12 July = 00:30 BST on 13 July: a 00:15 due time has passed in London
  assert.equal(selectKpis(input, ALL, new Date('2026-07-12T23:30:00Z')).overdueMaintenance, 1);
  // 23:00 UTC = 00:00 BST: not yet
  assert.equal(selectKpis(input, ALL, new Date('2026-07-12T23:00:00Z')).overdueMaintenance, 0);
});

test('a defect with no readable Complete By is open but never overdue, and is reported', () => {
  const input: OpsInput = { ...fixture(), maintenance: [maint('n1', 'Brit Hotel', 'CAT 3', '')] };
  const snap = buildSnapshot(input, ALL, NOW);
  assert.equal(snap.kpis.openMaintenance, 1);
  assert.equal(snap.kpis.overdueMaintenance, 0);
  assert.equal(snap.dataQuality.unreadableDate.maintenance, 1);
});
