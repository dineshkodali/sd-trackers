import test from 'node:test';
import assert from 'node:assert/strict';
import { selectUnifiedTasks, classifyDeadline, countTasks, filterTasks, NO_TASK_FILTER, type TaskInput, type TaskModule } from '../src/utils/operationsTasks.ts';
import { selectRecentActivity } from '../src/utils/operationsActivity.ts';

const NOW = new Date('2026-11-12T10:00:00Z'); // Thu 12 Nov 2026, 10:00 GMT
const SITES = [{ id: 'site-1', name: 'Brit Hotel' }, { id: 'site-2', name: 'Atlantic BW' }];
const ALL = { allowedSiteIds: 'all' as const, siteId: 'all' as const };
const MODULES: TaskModule[] = ['Maintenance', 'Compliance', 'Escalations', 'PEEP', 'Absence follow-up', 'Room inspection', 'Room issue', 'Room check', 'Welfare check', 'Dispersal', 'Eviction', 'Finance', 'Transport'];
const visible = Object.fromEntries(MODULES.map(m => [m, true])) as Record<TaskModule, boolean>;

const maint = (o: Record<string, any> = {}): any => ({ id: 'm1', site: 'Brit Hotel', priority: 'CAT 2', date: '2026-11-10', description: 'Leak', closeDueDate: '2026-11-20', defectStatus: 'In Process', action: 'Open', room: '12', ...o });
const input = (over: Partial<TaskInput> = {}): TaskInput => ({
  sites: SITES, maintenance: [], compliance: [], escalations: [], properties: [], rooms: [], placements: [], roomIssues: [], peepPlans: [], followUps: [],
  newArrivals: [], dispersals: [], evictions: [], roomRows: [], welfareRows: [], bills: [], transport: [], visible, ...over
});
const ob = (status: string, period: 1 | 2, o: Record<string, any> = {}): any => ({
  key: `k-${period}-${o.roomNumber || 1}`, type: 'room', month: '2026-11', period, deadline: period === 1 ? '2026-11-10' : '2026-11-25', status,
  siteId: 'site-1', siteName: 'Brit Hotel', propertyId: 'p', propertyName: 'Prop', roomId: 'r', roomNumber: '1', suId: '', suName: 'Ann', suReference: '',
  responsible: { name: 'Lee', source: 'property manager' }, ...o
});
const row = (first: any, second: any): any => ({ subjectKey: 's', type: 'room', siteId: 'site-1', siteName: 'Brit Hotel', first, second });

test('deadline classes: overdue, today, tomorrow, this week, upcoming, none', () => {
  const w = '2026-11-12 10:00';
  assert.equal(classifyDeadline('2026-11-12 09:00', w).bucket, 'overdue');
  assert.equal(classifyDeadline('2026-11-12 09:00', w).remaining, '1 h overdue');
  assert.equal(classifyDeadline('2026-11-12', w).bucket, 'today');         // a bare date is due at the end of the day
  assert.equal(classifyDeadline('2026-11-13', w).bucket, 'tomorrow');
  assert.equal(classifyDeadline('2026-11-18', w).bucket, 'week');          // +6
  assert.equal(classifyDeadline('2026-11-19', w).bucket, 'upcoming');      // +7
  assert.equal(classifyDeadline(null, w).bucket, 'none');
  assert.equal(classifyDeadline('2026-11-11', w).remaining, '1 h overdue'.replace('1 h', '10 h'));
});

test('a new maintenance record appears; completing it removes it; reopening restores it', () => {
  const open = selectUnifiedTasks(input({ maintenance: [maint()] }), ALL, NOW).tasks;
  assert.equal(open.length, 1);
  assert.equal(open[0].module, 'Maintenance');
  assert.equal(open[0].recordId, 'm1');
  assert.equal(open[0].bucket, 'upcoming');
  const done = selectUnifiedTasks(input({ maintenance: [maint({ defectStatus: 'Completed', action: 'Closed', actualClosedDate: '2026-11-12' })] }), ALL, NOW).tasks;
  assert.equal(done.length, 0);
  const reopened = selectUnifiedTasks(input({ maintenance: [maint({ defectStatus: 'In Process', action: 'Open' })] }), ALL, NOW).tasks;
  assert.equal(reopened.length, 1);
});

test('changing a deadline changes its class; no deadline is never invented', () => {
  const at = (due: string) => selectUnifiedTasks(input({ maintenance: [maint({ closeDueDate: due })] }), ALL, NOW).tasks[0];
  assert.equal(at('2026-11-20').bucket, 'upcoming');
  assert.equal(at('2026-11-12 23:00').bucket, 'today');
  assert.equal(at('2026-11-12 09:00').bucket, 'overdue');
  assert.equal(at('not a date').bucket, 'none');
  assert.equal(at('not a date').due, '');
});

test('one record is one row: no duplicates, and KPIs equal the rows', () => {
  const r = selectUnifiedTasks(input({
    maintenance: [maint({ id: 'a', closeDueDate: '2026-11-01' }), maint({ id: 'b', closeDueDate: '2026-11-12 23:00' }), maint({ id: 'c', closeDueDate: '2026-11-13' }), maint({ id: 'd', closeDueDate: '2026-11-15' })]
  }), ALL, NOW).tasks;
  assert.equal(new Set(r.map(t => t.key)).size, r.length);
  assert.deepEqual(countTasks(r), { outstanding: 4, overdue: 1, dueToday: 1, dueThisWeek: 2 });
  assert.equal(filterTasks(r, { ...NO_TASK_FILTER, when: 'overdue' }).length, 1);
  assert.equal(filterTasks(r, { ...NO_TASK_FILTER, when: 'week' }).length, 3);   // today + tomorrow + this week
});

test('sorting: overdue first, then due today..., higher priority first within a group', () => {
  const r = selectUnifiedTasks(input({
    maintenance: [maint({ id: 'n', priority: 'CAT 3', closeDueDate: '2026-11-01' }), maint({ id: 'c', priority: 'CAT 1', closeDueDate: '2026-11-02' }), maint({ id: 't', closeDueDate: '2026-11-12 20:00' })]
  }), ALL, NOW).tasks;
  assert.deepEqual(r.map(t => t.recordId), ['c', 'n', 't']);   // CAT 1 (Critical) before the overdue CAT 3, which is bumped to High; today last
  assert.equal(r[0].priority, 'Critical');
  assert.equal(r[1].priority, 'High');
});

test('room and welfare checks follow the 10th / 25th schedule; completed checks are not outstanding', () => {
  const rows = [row(ob('completed', 1), ob('pending', 2)), row(ob('overdue', 1, { roomNumber: '2' }), ob('pending', 2, { roomNumber: '2' }))];
  const t = selectUnifiedTasks(input({ roomRows: rows }), ALL, NOW).tasks;
  assert.equal(t.length, 3);
  const overdue = t.find(x => x.bucket === 'overdue')!;
  assert.equal(overdue.due, '2026-11-10 23:59');
  assert.match(overdue.task, /first review \(by the 10th\)/);
  assert.equal(overdue.assignedTo, 'Lee');
  assert.deepEqual(overdue.filters, { due: 'overdue', month: '2026-11' });
  assert.ok(t.filter(x => x.bucket !== 'overdue').every(x => x.due === '2026-11-25 23:59'));
  const w = selectUnifiedTasks(input({ welfareRows: [row(ob('pending', 2, { type: 'welfare' }), null)] }), ALL, NOW).tasks;
  assert.equal(w[0].module, 'Welfare check');
});

test('compliance, escalations, dispersals and evictions get their own deadlines or none', () => {
  const t = selectUnifiedTasks(input({
    compliance: [{ id: 'c1', siteName: 'Brit Hotel', complianceType: 'Gas', expiryDate: '2026-11-01', status: 'Compliant', contractorName: 'Acme', createdAt: '2026-01-01' } as any,
                 { id: 'c2', siteName: 'Brit Hotel', complianceType: 'EICR', expiryDate: '2028-01-01', status: 'Compliant' } as any],
    escalations: [{ id: 'e1', siteName: 'Brit Hotel', status: 'Active', urgency: 'Critical', incidentType: 'Fire' } as any, { id: 'e2', siteName: 'Brit Hotel', status: 'Resolved' } as any],
    dispersals: [{ id: 'd1', siteName: 'Brit Hotel', dispersalDate: '11/12/2026', travelled: 'No', suName: 'X' } as any, { id: 'd2', siteName: 'Brit Hotel', dispersalDate: '11/12/2026', travelled: 'Yes' } as any],
    evictions: [{ id: 'v1', hotel: 'Brit Hotel', status: 'Notice Issued', evictionDate: '2026-11-05' } as any, { id: 'v2', hotel: 'Brit Hotel', status: 'Cancelled', evictionDate: '2026-11-05' } as any]
  }), ALL, NOW).tasks;
  const by = (k: string) => t.find(x => x.key === k)!;
  assert.equal(by('Compliance:c1').priority, 'Critical');
  assert.equal(by('Compliance:c1').bucket, 'overdue');
  assert.equal(t.find(x => x.key === 'Compliance:c2'), undefined);       // valid for over a year: not actionable
  assert.equal(by('Escalations:e1').bucket, 'none');
  assert.equal(by('Escalations:e1').priority, 'Critical');
  assert.equal(t.find(x => x.key === 'Escalations:e2'), undefined);      // resolved
  assert.equal(by('Dispersal:d1').bucket, 'today');
  assert.equal(t.find(x => x.key === 'Dispersal:d2'), undefined);        // already travelled
  assert.equal(by('Eviction:v1').bucket, 'overdue');
  assert.equal(t.find(x => x.key === 'Eviction:v2'), undefined);         // cancelled
});

test('finance and transport only when they have outstanding work', () => {
  const t = selectUnifiedTasks(input({
    bills: [{ id: 'b1', siteName: 'Brit Hotel', billNumber: 'INV-1', status: 'awaiting_approval', dueDate: '2026-11-14', assignedApproverName: 'Pat', submittedAt: '2026-11-01T09:00:00Z' } as any,
            { id: 'b2', siteName: 'Brit Hotel', billNumber: 'INV-2', status: 'paid', dueDate: '2026-11-14' } as any],
    transport: [{ id: 't1', siteName: 'Brit Hotel', status: 'Under Review', appointmentDate: '2026-11-13', appointmentTime: '09:30', requestDatetime: '2026-11-10T10:00' } as any,
                { id: 't2', siteName: 'Brit Hotel', status: 'Completed', appointmentDate: '2026-11-13' } as any]
  }), ALL, NOW).tasks;
  assert.deepEqual(t.map(x => x.key).sort(), ['Finance:b1', 'Transport:t1']);
  assert.equal(t.find(x => x.key === 'Finance:b1')!.assignedTo, 'Pat');
});

test('site scope and module visibility are enforced before anything is counted', () => {
  const data = { maintenance: [maint({ id: 'a' }), maint({ id: 'b', site: 'Atlantic BW' }), maint({ id: 'x', site: 'Unknown place' })] };
  assert.equal(selectUnifiedTasks(input(data), ALL, NOW).tasks.length, 2);                                        // the unmatched site is left out, not guessed
  assert.equal(selectUnifiedTasks(input(data), { allowedSiteIds: new Set(['site-2']), siteId: 'all' }, NOW).tasks.length, 1);
  assert.equal(selectUnifiedTasks(input(data), { allowedSiteIds: 'all', siteId: 'site-1' }, NOW).tasks.length, 1);
  assert.equal(selectUnifiedTasks(input({ ...data, visible: { ...visible, Maintenance: false } }), ALL, NOW).tasks.length, 0);
});

test('far-future dated work is not listed', () => {
  assert.equal(selectUnifiedTasks(input({ maintenance: [maint({ closeDueDate: '2027-03-01' })] }), ALL, NOW).tasks.length, 0);
});

/* ----------------------------------------------------------------- recent activity */

const log = (o: Record<string, any>): any => ({ id: 'a1', timestamp: '2026-11-12T09:00:00Z', action: 'UPDATE', module: 'Maintenance', targetItem: 'Leak', performedByUser: 'Sam', site: 'Brit Hotel', entityType: 'maintenance', entityId: 'm1', ...o });
const inScope = () => true;

test('activity is the audit trail only: record changes, newest first, deduplicated', () => {
  const rows = selectRecentActivity([
    log({ id: 'a1', timestamp: '2026-11-12T09:00:05Z' }),
    log({ id: 'a1', timestamp: '2026-11-12T09:00:05Z' }),                          // same audit id delivered twice
    log({ id: 'a2', timestamp: '2026-11-12T09:00:40Z' }),                          // same change saved twice in one minute
    log({ id: 'a3', timestamp: '2026-11-12T09:30:00Z', action: 'CREATE', entityId: 'm2' }),
    log({ id: 'a4', timestamp: '2026-11-12T09:31:00Z', action: 'ROLE_CHANGE' }),   // not a record change
    log({ id: 'a5', timestamp: '2026-11-12T09:32:00Z', action: 'DELETE', entityId: 'm3' }),
    log({ id: 'a6', timestamp: 'garbage' })
  ], { inScope });
  assert.deepEqual(rows.map(r => r.id), ['a5', 'a3', 'a2']);                        // a2 (09:00:40) is the surviving burst row
  assert.equal(rows[0].verb, 'Deleted');
  assert.equal(rows[0].recordId, null);                                             // nothing left to open
  assert.equal(rows[1].verb, 'Created');
  assert.equal(rows[1].page, 'maintenance');
  assert.equal(rows[1].recordId, 'm2');
});

test('activity respects scope and the limit, and never invents a link', () => {
  const logs = Array.from({ length: 20 }, (_, i) => log({ id: `x${i}`, entityId: `r${i}`, timestamp: `2026-11-12T08:${String(i).padStart(2, '0')}:00Z` }));
  assert.equal(selectRecentActivity(logs, { inScope, limit: 12 }).length, 12);
  assert.equal(selectRecentActivity(logs, { inScope: () => false }).length, 0);
  const unknown = selectRecentActivity([log({ entityType: 'somethingNew' })], { inScope })[0];
  assert.equal(unknown.page, null);
});
