/**
 * TS-22 — Live persistence. Every page that stores data must store it in the
 * live database and give back exactly what it was given.
 *
 * For each entity: create a QA-tagged record through the API, read it back and
 * compare every field, update one field and check the rest survive, delete it
 * and check it is gone. Request-level, no browser.
 *
 * The suite reads /api/db/status first so that a failure says *why*:
 *   - table missing         -> the database migration has not been applied;
 *   - data column missing   -> the table exists but predates the full-fidelity
 *                              column; only the core typed fields are checked
 *                              and the test is annotated.
 */
// API-only: `anonTest` provides the authenticated `api` client and QA cleanup
// without opening a browser for every case.
import { anonTest as test, expect } from '../helpers/fixtures';
import { ctx } from '../helpers/api';
import { QA_PREFIX } from '../helpers/env';

type Payload = Record<string, any>;

interface EntityCase {
  entity: string;
  /** Fields held in typed columns: checked even before the migration. */
  core: string[];
  /** Field changed by the update step. */
  update: [string, any];
  build: (id: string, tag: string) => Payload;
}

const today = new Date().toISOString().slice(0, 10);
const now = new Date().toISOString();

const CASES: EntityCase[] = [
  {
    entity: 'referrals', core: ['suName', 'site', 'status'], update: ['laOfficerLeading', 'QA Officer'],
    build: (id, tag) => ({ id, site: 'Brit Hotel', suName: tag, portRef: `PORT-${id.slice(-5)}`, mosaicId: 'MOS-1', referralCouncil: 'Barnet', dob: '1990-01-01', officerLeadingHotel: 'QA', referralType: 'Safeguarding Adult', status: 'Open', dateReferred: today, methodOfReferral: 'Encrypted Email', acknowledgementReceived: 'Pending', responseReceivedFromLA: 'No', laOfficerLeading: '', notesActionTaken: 'Persistence test', sgReview: '', urgency: 'Medium', srNo: 42, createdAt: now, lastUpdatedBy: 'QA', qaCustomField: 'custom-value' })
  },
  {
    entity: 'vulnerable', core: ['suName', 'site', 'status'], update: ['sgTeamUpdate', 'Updated by QA'],
    build: (id, tag) => ({ id, site: 'Brit Hotel', roomOrFlatNo: '12', suName: tag, dob: '1985-02-02', group: 'Family', gender: 'Male', portOrNassRef: 'NASS-1', vulnerability: 'Mental Health', notesActionTaken: 'Plan', sgTeamUpdate: '', riskLevel: 'Low', status: 'Open', reviewDate: today, allocatedWorker: 'QA', createdAt: now })
  },
  {
    entity: 'challenging', core: ['name', 'site', 'status'], update: ['followUpNotes', 'Followed up'],
    build: (id, tag) => ({ id, date: today, site: 'Brit Hotel', name: tag, portRef: 'P-2', dob: '1999-03-03', group: 'Single Adult', gender: 'Female', typeOfIssue: 'Room Damage', incidentDescription: 'Desc', dateOfIncident: today, actionTaken: 'Action', adviceGivenBySGTeam: 'Advice', followUpRequired: 'Yes', riskFactor: 'Low', followUpNotes: '', comments: '', reviewBySGTeam: '', status: 'Open', createdAt: now })
  },
  {
    entity: 'maintenance', core: ['site', 'description'], update: ['progress', 'Contractor booked'],
    build: (id, tag) => ({ id, date: today, priority: 'CAT 3', priorityTimeScale: '21 Working Days', location: 'Corridor', site: 'Brit Hotel', room: '1A', description: tag, criteriaCode: 'GEN', raisedBy: 'QA', closeDueDate: today, defectStatus: 'In Process', action: 'Open', progress: '', createdAt: now })
  },
  {
    entity: 'spcd', core: ['suName', 'siteName'], update: ['updates', 'QA update'],
    build: (id, tag) => ({ id, date: today, siteName: 'Brit Hotel', roomNumber: '3', staffReporting: 'QA', suName: tag, suPortReference: 'SP-1', suDob: '1970-01-01', briefDescriptionActionTaken: 'Brief', followUpNotes: '', updates: '', sgReview: 'Pending Safeguarding Lead Review', isArchived: false, createdAt: now, updatedAt: now })
  },
  {
    entity: 'laundry', core: ['site', 'residentName'], update: ['status', 'Washing'],
    build: (id, tag) => ({ id, site: 'Brit Hotel', roomNo: '4', residentName: tag, ref: 'R1', date: today, tokensIssued: 1, bagCount: 1, status: 'Queued', staffInitials: 'QA', createdAt: now })
  },
  {
    entity: 'property_laundry_logs', core: ['site', 'periodType', 'periodLabel'], update: ['remarksActionsTaken', 'Chased supplier'],
    build: (id, tag) => ({ id: `prop-lau-${id}`, site: 'Brit Hotel', periodType: 'Weekly', periodLabel: tag, startDate: today, endDate: today, dirtyLaundrySent: 30, cleanLaundryReturned: 28, discrepanciesCount: 2, hasDiscrepancy: true, discrepancyDetails: 'Two missing', remarksActionsTaken: '', loggedBy: 'QA', createdAt: now, updatedAt: now })
  },
  {
    entity: 'food', core: ['site', 'mealType'], update: ['status', 'Refused'],
    build: (id, tag) => ({ id, site: 'Brit Hotel', roomNo: '5', residentName: tag, vendor: 'A&M', dietaryRequirement: 'Diabetic', mealType: 'Dinner', servings: 2, tempCheckedCelsius: 68.5, deliveredBy: 'QA', timeDelivered: '18:00', residentSigned: true, status: 'Delivered', createdAt: now })
  },
  {
    entity: 'food_vendor_buffet_logs', core: ['site', 'weekRange', 'dailyCounts'], update: ['notes', 'Adjusted counts'],
    build: (id, tag) => ({ id: `vendor-bf-${id}`, vendor: 'Freshbite', site: 'Brit Hotel', weekRange: tag, startDate: today, endDate: today, dailyCounts: { MON: { lunch: 10, dinner: 12 } }, notes: '', lastUpdatedBy: 'QA', updatedAt: now })
  },
  {
    entity: 'escalations', core: ['site', 'suName', 'status'], update: ['actionTaken', 'Police informed'],
    build: (id, tag) => ({ id, dateOfIncident: today, suPortNassRef: 'E-1', suName: tag, siteName: 'Brit Hotel', site: 'Brit Hotel', personReporting: 'QA', incidentType: 'Verbal Aggression', wlIssued: 'No', reportedAuthorities: 'Management', incidentNotes: 'Notes', actionTaken: '', status: 'Active', urgency: 'Low', createdAt: now })
  },
  {
    entity: 'documents', core: ['site', 'documentTitle'], update: ['confidentiality', 'Confidential'],
    build: (id, tag) => ({ id, site: 'Brit Hotel', suName: 'QA D', refNumber: 'D-1', documentTitle: tag, category: 'Risk Assessment', fileFormat: 'DOCX', fileSizeKb: 120, confidentiality: 'Restricted', uploadedBy: 'QA', uploadDate: today })
  },
  {
    entity: 'publicTransport', core: ['approvalUrn', 'suNames', 'distanceMiles'], update: ['status', 'Completed'],
    build: (id, tag) => ({ id, approvalUrn: `URN-${id.slice(-5)}`, suNames: tag, portRefs: 'P', accommodationAddress: 'Brit Hotel', appointmentDate: today, appointmentTime: '10:30', appointmentLocation: 'Loc', distanceMiles: 18.5, modeOfTransport: 'Bus', exceptionalCircumstances: '', status: 'Approved', createdAt: now, updatedAt: now })
  },
  {
    entity: 'compliance', core: ['complianceType', 'contractorName', 'expiryDate'], update: ['status', 'Expiring Soon'],
    build: (id, tag) => ({ id, srNo: 99, complianceType: tag, contractorName: 'QA Contractor', contractorKeyContact: 'K', contractorEmail: 'qa@example.test', issuedDate: '2025-10-12', expiryDate: '2026-10-11', status: 'Compliant', actionTaken: 'A', previousContractor: 'P', siteName: 'Brit Hotel', createdAt: now, updatedAt: now })
  },
  {
    entity: 'gpAppointments', core: ['portReference', 'status'], update: ['status', 'Attended'],
    build: (id, tag) => ({ id, roomNo: '6', portReference: tag, referralSentOn: today, appointmentDate: today, timeOfGp: '09:00', comments: '', status: 'Scheduled', siteName: 'Brit Hotel', suName: 'QA G', createdAt: now, updatedAt: now })
  },
  {
    entity: 'rfaWelfare', core: ['name', 'siteName', 'group'], update: ['actionTaken', 'Referred to GP'],
    build: (id, tag) => ({ id, date: today, siteName: 'Brit Hotel', roomOrFlatNo: '7', name: tag, dob: '2000-01-01', group: 'Family', gender: 'Other', portOrNassRef: 'N-1', vulnerability: 'V', actionTaken: '', mhTicket: '', createdAt: now, updatedAt: now })
  },
  {
    entity: 'dispersal', core: ['suPortNassRef', 'siteName', 'travelled'], update: ['travelled', 'Yes'],
    build: (id, tag) => ({ id, sno: 3, siteName: 'Brit Hotel', dateReceived: '09/01/2026', suPortNassRef: tag, reasonForDeparture: 'Granted', flatRoomNumber: '8', dispersalDate: '09/10/2026', dateLetterHandedToSu: '09/02/2026', iaExitBriefingCompleted: 'Yes', hoDispersalLetterReceived: 'No', travelled: 'No', dateLeftProperty: '', incidentWarningCompleted: 'No need', reasonFailedToTravel: 'Ill', secondDispersalDate: '', dateSecondLetterHanded: '', secondIaExitBriefingCompleted: 'No', secondDispersalTravelled: 'No', secondDateLeftProperty: '', secondIncidentWarningCompleted: 'No', reasonFailedToTravelSecond: '', createdAt: now, updatedAt: now })
  },
  {
    entity: 'booklets', core: ['hotelName', 'language', 'numberForCollection'], update: ['collectedBooklets', 5],
    build: (id, tag) => ({ id, hotelName: 'IBIS Seven kings', agentName: 'Ready Homes', bookletType: 'Living In IA', language: tag, numberForCollection: 105, collectedBooklets: 0, bookletsReceived: 0, status: 'Pending Collection', notes: 'batch', lastUpdated: today })
  },
  {
    entity: 'vcsAgencies', core: ['hotelName', 'agencyName', 'isVerified'], update: ['contactPerson', 'QA Contact'],
    build: (id, tag) => ({ id, hotelName: 'Brit Hotel', agencyName: tag, category: 'Charity & Welfare', servicesProvided: 'S', contactPerson: '', contactNumber: '0', email: 'qa@example.test', address: 'A', notes: 'N', isVerified: true, createdAt: today })
  },
  {
    entity: 'requests', core: ['module', 'requestType', 'status'], update: ['status', 'Approved'],
    build: (id, tag) => ({ id, requestedBy: 'QA', requestedByRole: 'Staff', site: 'Brit Hotel', module: 'Referrals', recordId: 'ref-1', recordTitle: tag, requestType: 'Edit Correction', reason: 'Typo', proposedChanges: 'Fix', status: 'Pending', createdAt: now })
  },
  {
    entity: 'fieldOptions', core: ['category', 'label', 'isActive'], update: ['isActive', false],
    build: (id, tag) => ({ id, category: 'councils', label: tag, value: tag.toLowerCase(), color: 'teal', description: 'QA', isActive: true, isSystem: false, order: 999 })
  },
  {
    entity: 'userGroups', core: ['name', 'assignedProperties'], update: ['description', 'Updated by QA'],
    build: (id, tag) => ({ id, name: tag, description: '', assignedProperty: 'Brit Hotel', assignedProperties: ['Brit Hotel'], userIds: [] })
  },
  {
    entity: 'tableSchemas', core: ['moduleKey', 'columns'], update: ['updatedBy', 'QA'],
    build: (id, tag) => ({ id: `qa-module-${id.slice(-8)}`, moduleKey: `qa-module-${id.slice(-8)}`, columns: [{ key: 'qaCol', label: tag, type: 'text', isCustom: true }], updatedBy: '' })
  },
  {
    entity: 'appSettings', core: ['value'], update: ['updatedBy', 'QA'],
    build: (id, tag) => ({ id: `qa-setting-${id.slice(-8)}`, value: { note: tag, pageSize: 25 }, updatedBy: '' })
  },
  {
    entity: 'sites', core: ['name', 'city'], update: ['leadOfficer', 'QA Lead'],
    build: (id, tag) => ({ id: `site-${id}`, pid: `PID-${id.slice(-5)}`, name: tag, city: 'London', capacity: 10, activeResidents: 0, council: 'QA Council', leadOfficer: '', contactNumber: '0', status: 'Active' })
  },
];

let status: any;

test.beforeAll(async () => {
  const api = await ctx();
  status = await (await api.get('/api/db/status')).json();
  await api.dispose();
});

function pageStatus(entity: string) {
  return (status?.pages || []).find((p: any) => p.entity === entity);
}

test.describe('TS-22 live persistence of every page', () => {
  test('22.0 the server is in live mode, not a local fallback', async () => {
    expect(status?.live, `status: ${JSON.stringify(status).slice(0, 300)}`).toBe(true);
    expect(status.mode).toBe('supabase-cloud');
    expect(JSON.stringify(status)).not.toMatch(/offline-local|Safe Fallback/i);
  });

  test('22.1 every page has its database table and columns (migration applied)', async () => {
    const problems = (status.pages || [])
      .filter((p: any) => p.status !== 'connected')
      .map((p: any) => `${p.page} -> ${p.table}: ${p.status}${p.missingColumns?.length ? ` (missing ${p.missingColumns.join(', ')})` : ''}`);
    expect(problems, `pages not fully connected:\n${problems.join('\n')}`).toEqual([]);
  });

  for (const c of CASES) {
    test(`22.${c.entity} create, read, update and delete persist to the database`, async ({ api }) => {
      const info = pageStatus(c.entity);
      expect(info, `no status entry for ${c.entity}`).toBeTruthy();
      expect(info.status, `${info.page}: database table "${info.table}" is missing - apply the migration (npm run db:migrate)`).not.toBe('missing');
      const fullFidelity = !info.missingColumns?.includes('data');
      if (!fullFidelity) {
        test.info().annotations.push({ type: 'migration-pending', description: `${info.table} has no data column yet: only core fields checked` });
      }

      const id = `qa-persist-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const tag = `${QA_PREFIX}-PERSIST-${c.entity}-${Date.now().toString().slice(-6)}`;
      const payload = c.build(id, tag);
      const recordId = String(payload.id);
      const fieldsToCheck = fullFidelity ? Object.keys(payload).filter(k => k !== 'updatedAt') : ['id', ...c.core];

      try {
        // CREATE
        const created = await api.post(`/api/db/${c.entity}`, { data: payload });
        expect(created.status(), `create ${c.entity}: ${await created.text()}`).toBe(201);

        // READ — every submitted field comes back unchanged
        const readBack = async () => {
          const res = await api.get(`/api/db/${c.entity}`);
          expect(res.status(), `read ${c.entity}`).toBe(200);
          const rows: any[] = (await res.json()).data;
          return rows.find(r => String(r.id) === recordId);
        };
        const stored = await readBack();
        expect(stored, `${c.entity} record ${recordId} was not found after create`).toBeTruthy();
        for (const field of fieldsToCheck) {
          expect(stored[field], `${c.entity}.${field} did not round-trip`).toEqual(payload[field]);
        }

        // UPDATE — a partial update changes one field and preserves the rest
        const [field, value] = c.update;
        const updated = await api.put(`/api/db/${c.entity}/${encodeURIComponent(recordId)}`, { data: { [field]: value } });
        expect(updated.status(), `update ${c.entity}: ${await updated.text()}`).toBe(200);
        const afterUpdate = await readBack();
        if (fullFidelity || c.core.includes(field)) {
          expect(afterUpdate?.[field], `${c.entity}.${field} was not updated`).toEqual(value);
        }
        for (const other of fieldsToCheck.filter(f => f !== field)) {
          expect(afterUpdate?.[other], `${c.entity}.${other} was lost by a partial update`).toEqual(payload[other]);
        }

        // DELETE
        const deleted = await api.delete(`/api/db/${c.entity}/${encodeURIComponent(recordId)}`);
        expect(deleted.status(), `delete ${c.entity}`).toBe(200);
        expect(await readBack(), `${c.entity} record still present after delete`).toBeFalsy();
      } finally {
        await api.delete(`/api/db/${c.entity}/${encodeURIComponent(recordId)}`).catch(() => undefined);
      }
    });
  }

  test('22.batch one request loads every page', async ({ api }) => {
    const requests = CASES.map(c => ({ key: c.entity, entity: c.entity }));
    const res = await api.post('/api/db/batch-read', { data: { requests } });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const failed = Object.entries<any>(body.results).filter(([, r]) => !r.success).map(([k, r]) => `${k}: ${r.error}`);
    expect(failed, `entities that failed to load:\n${failed.join('\n')}`).toEqual([]);
  });

  test('22.audit a write produces one audit row that names the record', async ({ api, tag }) => {
    const id = `qa-audit-${Date.now()}`;
    const header = Buffer.from(JSON.stringify({ action: 'CREATE', module: 'Referrals', targetItem: tag, details: 'QA audit link test' })).toString('base64');
    try {
      const res = await api.post('/api/db/referrals', {
        data: { id, site: 'Brit Hotel', suName: tag, status: 'Open' },
        headers: { 'x-audit-context': header }
      });
      expect(res.status()).toBe(201);
      await expect.poll(async () => {
        const rows: any[] = (await (await api.get('/api/db/audit_trails?eq.entity_id=' + encodeURIComponent(id))).json()).data;
        return rows.length;
      }, { timeout: 15_000, message: 'exactly one audit row for the write' }).toBe(1);
      const rows: any[] = (await (await api.get('/api/db/audit_trails?eq.entity_id=' + encodeURIComponent(id))).json()).data;
      expect(rows[0].targetItem).toBe(tag);
      expect(rows[0].performedByUser).toMatch(/Stack Master/);
      expect(rows[0].module).toBe('Referrals');
    } finally {
      await api.delete(`/api/db/referrals/${id}`).catch(() => undefined);
    }
  });

  test('22.policy audit rows cannot be edited through the data API', async ({ api }) => {
    const res = await api.put('/api/db/audit_trails/any-id', { data: { details: 'tampered' } });
    expect(res.status()).toBe(403);
  });
});
