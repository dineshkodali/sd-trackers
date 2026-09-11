/**
 * Round-trip tests for the schema adapter: every page's record, written with
 * toDatabaseRow and read back with fromDatabaseRow, must come back with every
 * field intact (BUG-023). Run with:  npm run test:unit
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toDatabaseRow, fromDatabaseRow, TABLE_COLUMNS, DATA_TABLES, FIELD_SPECS } from './schemaAdapter.ts';

const ts = '2026-09-11T10:00:00.000Z';

/** What PostgREST returns for an upserted row: the columns written plus defaults. */
function storedRow(table: string, row: Record<string, any>) {
  const cols = TABLE_COLUMNS[table];
  const out: Record<string, any> = {};
  for (const c of cols) out[c] = row[c] ?? null;
  out.created_at = row.created_at ?? ts;
  out.updated_at = row.updated_at ?? ts;
  return out;
}

function roundTrip(table: string, record: Record<string, any>, allowed?: Set<string>) {
  const row = toDatabaseRow(table, record, null, allowed);
  return { row, back: fromDatabaseRow(table, storedRow(table, row)) };
}

/** Every field of `record` must be present and equal on `back`. */
function assertPreserved(back: Record<string, any>, record: Record<string, any>, skip: string[] = []) {
  for (const [key, value] of Object.entries(record)) {
    if (skip.includes(key)) continue;
    assert.deepEqual(back[key], value, `field "${key}" was not preserved`);
  }
}

// One realistic record per page, including fields the old adapter dropped
// and an administrator-defined custom column.
const RECORDS: Record<string, { table: string; record: Record<string, any> }> = {
  referrals: {
    table: 'referrals',
    record: {
      id: 'ref-t1', srNo: 42, site: 'Brit Hotel', referralCouncil: 'Barnet', suName: 'QA SU', mosaicId: 'MOS-1',
      portRef: 'PORT-1', dob: '1990-01-01', officerLeadingHotel: 'Officer', raisedBy: 'Staff A', referralType: 'Safeguarding Adult',
      status: 'Open', dateReferred: '2026-09-01', methodOfReferral: 'Encrypted Email', acknowledgementReceived: 'Pending',
      responseReceivedFromLA: 'No', laOfficerLeading: 'LA Officer', notesActionTaken: 'Notes', sgReview: 'Reviewed',
      urgency: 'High', attachments: [{ id: 'a1', name: 'f.pdf', size: 10, type: 'application/pdf', uploadedBy: 'x', uploadedAt: ts }],
      createdAt: ts, updatedAt: ts, lastUpdatedBy: 'Staff A', customRiskScore: 7
    }
  },
  vulnerable: {
    table: 'vulnerable_residents',
    record: {
      id: 'vul-t1', site: 'Brit Hotel', roomOrFlatNo: '12', suName: 'QA V', dob: '1985-02-02', group: 'Family',
      gender: 'Male', portOrNassRef: 'NASS-1', vulnerability: 'Mental Health', notesActionTaken: 'Plan', sgTeamUpdate: 'Update',
      riskLevel: 'Critical', status: 'Open', reviewDate: '2026-10-01', allocatedWorker: 'Worker', raisedBy: 'Staff',
      createdAt: ts, updatedAt: ts, customFlag: true
    }
  },
  challenging: {
    table: 'challenging_behavior',
    record: {
      id: 'chal-t1', date: '2026-09-02', site: 'Brit Hotel', name: 'QA C', portRef: 'P-2', dob: '1999-03-03', group: 'Single Adult',
      gender: 'Female', typeOfIssue: 'Room Damage', incidentDescription: 'Desc', dateOfIncident: '2026-09-02', actionTaken: 'Action',
      adviceGivenBySGTeam: 'Advice', followUpRequired: 'Yes', riskFactor: 'High', followUpNotes: 'Follow', comments: 'Comment',
      reviewBySGTeam: 'Review', status: 'Open', raisedBy: 'Staff', loggedBy: 'Staff', createdAt: ts, updatedAt: ts
    }
  },
  maintenance: {
    table: 'maintenance_records',
    record: {
      id: 'maint-t1', date: '2026-09-03', priority: 'CAT 1', priorityTimeScale: '0 (4 Hours)', location: 'Kitchen', site: 'Brit Hotel',
      room: '1A', description: 'Leak', criteriaCode: 'PL-1', raisedBy: 'Staff', closeDueDate: '2026-09-04', defectStatus: 'In Process',
      action: 'Open', progress: 'Started', notes: 'n', createdAt: ts
    }
  },
  spcd: {
    table: 'spcd_records',
    record: {
      id: 'spcd-t1', date: '2026-09-04', siteName: 'Brit Hotel', roomNumber: '3', staffReporting: 'Staff', suName: 'QA S',
      suPortReference: 'SP-1', suDob: '1970-01-01', briefDescriptionActionTaken: 'Brief', followUpNotes: 'F', updates: 'U',
      sgReview: 'Pending', isArchived: false, createdAt: ts, updatedAt: ts
    }
  },
  sites: {
    table: 'sites',
    record: { id: 'site-t1', pid: 'PID-9', name: 'QA Hotel', city: 'London', capacity: 50, activeResidents: 12, council: 'Camden', leadOfficer: 'Lead', contactNumber: '0123', status: 'Active' }
  },
  laundry: {
    table: 'laundry_logs',
    record: { id: 'lau-t1', site: 'Brit Hotel', roomNo: '4', residentName: 'QA L', ref: 'R1', date: '2026-09-05', tokensIssued: 0, bagCount: 2, status: 'Queued', collectionTime: '14:00', staffInitials: 'AB', notes: 'n', createdAt: ts }
  },
  property_laundry_logs: {
    table: 'laundry_logs',
    record: { id: 'prop-lau-t1', site: 'Brit Hotel', periodType: 'Weekly', periodLabel: 'Week 36', startDate: '2026-09-01', endDate: '2026-09-07', dirtyLaundrySent: 30, cleanLaundryReturned: 28, discrepanciesCount: 2, hasDiscrepancy: true, discrepancyDetails: 'Two missing', remarksActionsTaken: 'Chased', loggedBy: 'Staff', createdAt: ts, updatedAt: ts }
  },
  food: {
    table: 'hot_food_logs',
    record: { id: 'food-t1', site: 'Brit Hotel', roomNo: '5', residentName: 'QA F', vendor: 'A&M', dietaryRequirement: 'Diabetic', mealType: 'Dinner', servings: 2, tempCheckedCelsius: 68.5, deliveredBy: 'Staff', timeDelivered: '18:00', residentSigned: true, status: 'Delivered', notes: 'ok', createdAt: ts }
  },
  food_vendor_buffet_logs: {
    table: 'hot_food_logs',
    record: { id: 'vendor-bf-t1', vendor: 'Freshbite', site: 'Brit Hotel', weekRange: '06th to 12th', startDate: '2026-09-06', endDate: '2026-09-12', dailyCounts: { MON: { lunch: 10, dinner: 12 } }, notes: 'n', lastUpdatedBy: 'Staff', updatedAt: ts }
  },
  escalations: {
    table: 'escalations',
    record: { id: 'esc-t1', dateOfIncident: '2026-09-06', suPortNassRef: 'E-1', suName: 'QA E', siteName: 'Brit Hotel', site: 'Brit Hotel', personReporting: 'Staff', incidentType: 'Assault', wlIssued: 'Notice to Quit', reportedAuthorities: 'Police', incidentNotes: 'Notes', actionTaken: 'Action', status: 'Active', urgency: 'Critical', escalatedTo: 'Police', createdAt: ts }
  },
  documents: {
    table: 'documents',
    record: { id: 'doc-t1', site: 'Brit Hotel', suName: 'QA D', refNumber: 'D-1', documentTitle: 'Risk Plan', category: 'Risk Assessment', fileFormat: 'DOCX', fileSizeKb: 120, confidentiality: 'Restricted', uploadedBy: 'Staff', uploadDate: '2026-09-07', notes: 'n' }
  },
  userGroups: {
    table: 'user_groups',
    record: { id: 'grp-t1', name: 'QA Group', description: 'd', assignedProperty: 'Brit Hotel', assignedProperties: ['Brit Hotel'], userIds: ['u1'] }
  },
  requests: {
    table: 'data_change_requests',
    record: { id: 'req-t1', requestedBy: 'Staff', requestedByRole: 'Staff', site: 'Brit Hotel', module: 'Referrals', recordId: 'ref-1', recordTitle: 'Rec', requestType: 'Edit Correction', reason: 'Typo', proposedChanges: 'Fix', status: 'Pending', createdAt: ts }
  },
  publicTransport: {
    table: 'public_transport_records',
    record: { id: 'pt-t1', approvalUrn: 'URN-1', suNames: 'QA T', portRefs: 'P', accommodationAddress: 'Addr', appointmentDate: '2026-09-15', appointmentTime: '10:30', appointmentLocation: 'Loc', distanceMiles: 18.5, modeOfTransport: 'Bus', exceptionalCircumstances: 'None', status: 'Approved', createdAt: ts, updatedAt: ts }
  },
  compliance: {
    table: 'compliance_records',
    record: { id: 'comp-t1', srNo: 1, complianceType: 'FRA', contractorName: 'C', contractorKeyContact: 'K', contractorEmail: 'c@x.test', issuedDate: '2025-10-12', expiryDate: '2026-10-11', status: 'Compliant', actionTaken: 'A', previousContractor: 'P', siteName: 'Brit Hotel', createdAt: ts, updatedAt: ts }
  },
  gpAppointments: {
    table: 'gp_appointments',
    record: { id: 'gp-t1', roomNo: '6', portReference: 'G-1', referralSentOn: '2026-09-01', appointmentDate: '2026-09-10', timeOfGp: '09:00', comments: 'c', status: 'Scheduled', siteName: 'Brit Hotel', suName: 'QA G', createdAt: ts, updatedAt: ts }
  },
  rfaWelfare: {
    table: 'rfa_welfare_checks',
    record: { id: 'rfa-t1', date: '2026-09-08', siteName: 'Brit Hotel', roomOrFlatNo: '7', name: 'QA R', dob: '2000-01-01', group: 'Family', gender: 'Other', portOrNassRef: 'N-1', vulnerability: 'V', actionTaken: 'A', mhTicket: 'MH-9', createdAt: ts, updatedAt: ts }
  },
  dispersal: {
    table: 'dispersal_records',
    record: {
      id: 'disp-t1', sno: 3, siteName: 'Brit Hotel', dateReceived: '09/01/2026', suPortNassRef: 'D-9', reasonForDeparture: 'Granted',
      flatRoomNumber: '8', dispersalDate: '09/10/2026', dateLetterHandedToSu: '09/02/2026', iaExitBriefingCompleted: 'Yes',
      hoDispersalLetterReceived: 'No', travelled: 'No', dateLeftProperty: '', incidentWarningCompleted: 'No need', reasonFailedToTravel: 'Ill',
      secondDispersalDate: '', dateSecondLetterHanded: '', secondIaExitBriefingCompleted: 'No', secondDispersalTravelled: 'No',
      secondDateLeftProperty: '', secondIncidentWarningCompleted: 'No', reasonFailedToTravelSecond: '', createdAt: ts, updatedAt: ts
    }
  },
  booklets: {
    table: 'booklet_collections',
    record: { id: 'bkl-t1', hotelName: 'IBIS Seven kings', agentName: 'Ready Homes', bookletType: 'Living In IA', language: 'Dari', numberForCollection: 105, collectedBooklets: 0, bookletsReceived: 0, status: 'Pending Collection', notes: 'batch', lastUpdated: '2026-09-10' }
  },
  vcsAgencies: {
    table: 'vcs_agencies',
    record: { id: 'vcs-t1', hotelName: 'Brit Hotel', agencyName: 'QA Charity', category: 'Charity & Welfare', servicesProvided: 'S', contactPerson: 'P', contactNumber: '0', email: 'a@x.test', address: 'A', notes: 'N', isVerified: true, createdAt: '2026-01-01' }
  },
  fieldOptions: {
    table: 'field_options',
    record: { id: 'opt-t1', category: 'councils', label: 'QA Council', value: 'qa-council', color: 'teal', description: 'd', isActive: true, isSystem: false, order: 4 }
  },
  rolePermissions: {
    table: 'role_permissions',
    record: { id: 'Staff', role: 'Staff', canViewAllProperties: false, canCreateRecords: true, canEditRecords: false, canDeleteRecords: false, canArchiveRestore: false, canExportData: true, canManageProperties: false, canManageFiles: false, canManageUsers: false, canManageSettings: false }
  },
  appSettings: {
    table: 'app_settings',
    record: { id: 'global', value: { pageSize: 25, autoLogoutMinutes: 30, strictSiteIsolation: true } }
  },
  tableSchemas: {
    table: 'table_schemas',
    record: { id: 'referrals', moduleKey: 'referrals', columns: [{ key: 'customRiskScore', label: 'Risk Score', type: 'number', isCustom: true }] }
  }
};

for (const [entity, { table, record }] of Object.entries(RECORDS)) {
  test(`${entity} (${table}) round-trips every field`, () => {
    const { row, back } = roundTrip(table, record);
    assert.ok(DATA_TABLES.has(table), `${table} should carry a data column`);
    assert.deepEqual(row.data, JSON.parse(JSON.stringify(record)), 'data column holds the full record');
    // updatedAt is re-anchored on the database's own updated_at.
    assertPreserved(back, record, ['updatedAt']);
    assert.equal(back.id, record.id);
  });
}

test('typed columns are populated for reporting on the new tables', () => {
  for (const table of Object.keys(FIELD_SPECS)) {
    const entry = Object.values(RECORDS).find(r => r.table === table);
    assert.ok(entry, `test record exists for ${table}`);
    const row = toDatabaseRow(table, entry.record);
    for (const [field, column] of FIELD_SPECS[table]) {
      if (entry.record[field] === undefined) continue;
      assert.notEqual(row[column], undefined, `${table}.${column} populated from ${field}`);
    }
  }
  assert.equal(toDatabaseRow('public_transport_records', RECORDS.publicTransport.record).distance_miles, 18.5);
  assert.equal(toDatabaseRow('vcs_agencies', RECORDS.vcsAgencies.record).is_verified, true);
  assert.equal(toDatabaseRow('rfa_welfare_checks', RECORDS.rfaWelfare.record).group_name, 'Family');
  assert.equal(toDatabaseRow('field_options', RECORDS.fieldOptions.record).sort_order, 4);
});

test('documents and food now populate their typed columns (were dropped before)', () => {
  const doc = toDatabaseRow('documents', RECORDS.documents.record);
  assert.equal(doc.title, 'Risk Plan');
  assert.equal(doc.uploaded_date, '2026-09-07');
  assert.equal(doc.file_size, '120 KB');
  const food = toDatabaseRow('hot_food_logs', RECORDS.food.record);
  assert.equal(food.temperature_c, 68.5);
  assert.equal(food.meals_delivered, 2);
  assert.equal(food.staff_name, 'Staff');
});

test('rows written without a data column (migration pending) keep the previously dropped fields', () => {
  const withoutData = (t: string) => new Set([...TABLE_COLUMNS[t]].filter(c => c !== 'data'));

  const ref = roundTrip('referrals', RECORDS.referrals.record, withoutData('referrals'));
  assert.equal(ref.row.data, undefined, 'data is omitted when the column does not exist');
  assert.equal(ref.back.srNo, 42);
  assert.equal(ref.back.acknowledgementReceived, 'Pending', 'categorical value, not coerced to boolean');
  assert.deepEqual(ref.back.attachments, RECORDS.referrals.record.attachments);
  assert.equal(ref.back.customRiskScore, 7);

  const vul = roundTrip('vulnerable_residents', RECORDS.vulnerable.record, withoutData('vulnerable_residents'));
  assert.equal(vul.back.gender, 'Male', 'gender is stored, not hardcoded');
  assert.equal(vul.back.group, 'Family');
  assert.equal(vul.back.dob, '1985-02-02');

  const chal = roundTrip('challenging_behavior', RECORDS.challenging.record, withoutData('challenging_behavior'));
  assert.equal(chal.back.gender, 'Female');
  assert.equal(chal.back.followUpRequired, 'Yes');
  assert.equal(chal.back.adviceGivenBySGTeam, 'Advice');
});

test('challenging police flag is written as a boolean and read back from a boolean column', () => {
  const row = toDatabaseRow('challenging_behavior', { id: 'c', site: 'S', name: 'N', policeInvolved: 'Yes' });
  assert.equal(row.police_involved, true);
  const back = fromDatabaseRow('challenging_behavior', storedRow('challenging_behavior', { ...row, data: null }));
  assert.equal(back.policeInvolved, true);
});

test('audit entries keep module and subject, and always link the record', () => {
  const row = toDatabaseRow('audit_trails', {
    id: 'aud-1', action: 'CREATE', module: 'Referrals', targetItem: 'QA SU (PORT-1)', details: 'Created', site: 'Brit Hotel',
    entityType: 'referrals', entityId: 'ref-1', user: 'Staff A', role: 'Staff'
  });
  assert.equal(row.module, 'Referrals');
  assert.equal(row.target_label, 'QA SU (PORT-1)');
  assert.equal(row.entity_id, 'ref-1');
  const back = fromDatabaseRow('audit_trails', storedRow('audit_trails', row));
  assert.equal(back.module, 'Referrals');
  assert.equal(back.targetItem, 'QA SU (PORT-1)');
  assert.equal(back.performedByUser, 'Staff A');
});

test('transport keys never persist and unknown columns are filtered', () => {
  const row = toDatabaseRow('referrals', { id: 'r', suName: 'x', site: 'y', auditDetails: 'should not persist', bogus_column: 1 });
  assert.equal(row.data.auditDetails, undefined);
  assert.equal((row as any).bogus_column, undefined);
});

test('shared tables stay distinguishable after a round trip', () => {
  assert.ok(roundTrip('laundry_logs', RECORDS.property_laundry_logs.record).back.periodType, 'property log keeps periodType');
  assert.equal(roundTrip('laundry_logs', RECORDS.laundry.record).back.periodType, undefined, 'resident intake has no periodType');
  assert.ok(roundTrip('hot_food_logs', RECORDS.food_vendor_buffet_logs.record).back.dailyCounts, 'buffet log keeps dailyCounts');
  assert.equal(roundTrip('hot_food_logs', RECORDS.food.record).back.dailyCounts, undefined, 'delivery has no dailyCounts');
});
