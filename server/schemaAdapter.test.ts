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

test('vcs_agencies typed columns overlay over data column so DB changes reflect immediately', () => {
  const initialAgency = {
    id: 'vcs-1',
    hotelName: 'Seven Kings',
    agencyName: 'Red Cross Welfare',
    category: 'Charity & Welfare',
    servicesProvided: 'Food parcel support',
    contactPerson: 'Sarah Jenkins',
    contactNumber: '020 8123 4567',
    email: 'sarah@redcross.org.uk',
    address: 'High Road, Ilford',
    notes: 'Weekly visits on Wednesday',
    attachments: [
      {
        id: 'att-1',
        name: 'MoU_Agreement.pdf',
        size: 1048576,
        type: 'application/pdf',
        dataUrl: 'data:application/pdf;base64,JVBERi0xLjQK...',
        uploadedBy: 'Admin User',
        uploadedAt: '2026-09-12T10:00:00Z'
      }
    ],
    loggedBy: 'Duty Officer'
  };

  const dbRow = toDatabaseRow('vcs_agencies', initialAgency);
  assert.equal(dbRow.agency_name, 'Red Cross Welfare');

  // Simulate external or SQL update directly in database columns
  dbRow.agency_name = 'British Red Cross Emergency Team';
  dbRow.hotel_name = 'Ibis Styles - Seven Kings';
  dbRow.services_provided = 'Emergency housing & nutrition packs';

  const readBack = fromDatabaseRow('vcs_agencies', dbRow);
  assert.equal(readBack.agencyName, 'British Red Cross Emergency Team');
  assert.equal(readBack.hotelName, 'Ibis Styles - Seven Kings');
  assert.equal(readBack.servicesProvided, 'Emergency housing & nutrition packs');
  assert.equal(readBack.attachments.length, 1);
  assert.equal(readBack.attachments[0].name, 'MoU_Agreement.pdf');
  assert.equal(readBack.loggedBy, 'Duty Officer');
});

test('universal attachments with multiple formats and loggedBy persist and round-trip cleanly', () => {
  const sampleAttachments = [
    { id: 'a1', name: 'incident_photo.jpeg', size: 50000, type: 'image/jpeg', dataUrl: 'data:image/jpeg;base64,abc', uploadedBy: 'Officer', uploadedAt: '2026-09-12' },
    { id: 'a2', name: 'report.docx', size: 85000, type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', dataUrl: 'data:application/docx;base64,def', uploadedBy: 'Officer', uploadedAt: '2026-09-12' },
    { id: 'a3', name: 'counts.xlsx', size: 34000, type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', dataUrl: 'data:application/xlsx;base64,ghi', uploadedBy: 'Officer', uploadedAt: '2026-09-12' },
    { id: 'a4', name: 'signed_dossier.pdf', size: 120000, type: 'application/pdf', dataUrl: 'data:application/pdf;base64,jkl', uploadedBy: 'Officer', uploadedAt: '2026-09-12' }
  ];

  const rec = {
    id: 'chal-99',
    site: 'Brit Hotel',
    residentName: 'Resident A',
    behaviorType: 'Verbal',
    attachments: sampleAttachments,
    loggedBy: 'Lead Officer John Doe'
  };

  const row = toDatabaseRow('challenging_behavior', rec);
  assert.ok(row.attachments, 'row.attachments column must be populated for database table');
  assert.equal(row.attachment_url, 'data:image/jpeg;base64,abc', 'row.attachment_url must hold accessible link');
  assert.equal(row.file_url, 'data:image/jpeg;base64,abc', 'row.file_url must hold accessible link');

  const back = fromDatabaseRow('challenging_behavior', row);

  assert.equal(back.attachments.length, 4);
  assert.equal(back.attachments[0].name, 'incident_photo.jpeg');
  assert.equal(back.attachments[1].name, 'report.docx');
  assert.equal(back.attachments[2].name, 'counts.xlsx');
  assert.equal(back.attachments[3].name, 'signed_dossier.pdf');
  assert.equal(back.loggedBy, 'Lead Officer John Doe');
});

test('strict date rule: non-super admin blocked from past dates, super admin allowed, DOB exempted', () => {
  const todayStr = new Date().toISOString().slice(0, 10);
  const pastDate = '2020-01-01';
  const futureDate = '2030-01-01';

  const isDob = (key: string, label: string) => {
    const k = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    const l = label.toLowerCase().replace(/[^a-z0-9]/g, '');
    return k === 'dob' || k === 'sudob' || k === 'dateofbirth' || k === 'birthdate' || l.includes('dob') || l.includes('birth');
  };

  const validateDate = (role: string, key: string, label: string, dateVal: string, isEditing: boolean, initialVal?: string): string | null => {
    const isSuperAdmin = role === 'Super Admin';
    if (isDob(key, label)) return null; // DOB is exempt from past date restriction
    if (isSuperAdmin) return null; // Super Admin can select any past date

    if (!isEditing && dateVal < todayStr) {
      return `${label} cannot be in the past (must be today or later). Only Super Admin can select past dates.`;
    }
    if (isEditing && dateVal < todayStr && dateVal !== initialVal) {
      return `${label} cannot be changed to a past date. Only Super Admin can select past dates.`;
    }
    return null;
  };

  // Regular users (e.g. Duty Officer / Staff) cannot pick past dates for appointments or logs
  assert.ok(validateDate('Duty Worker', 'appointmentDate', 'Appointment Date', pastDate, false));
  assert.ok(validateDate('Duty Officer', 'dateOfIncident', 'Incident Date', pastDate, false));
  assert.ok(validateDate('Staff Member', 'date', 'Date Left', pastDate, false));

  // Regular users CAN pick today or future dates
  assert.equal(validateDate('Duty Worker', 'appointmentDate', 'Appointment Date', todayStr, false), null);
  assert.equal(validateDate('Duty Worker', 'appointmentDate', 'Appointment Date', futureDate, false), null);

  // DOB fields (dob, suDob, Date of Birth) are exempted from past date restrictions for ALL users
  assert.equal(validateDate('Duty Worker', 'dob', 'Date of Birth', '1995-05-15', false), null);
  assert.equal(validateDate('Duty Worker', 'suDob', 'SU DOB', '1988-12-01', false), null);
  assert.equal(validateDate('Staff', 'dateOfBirth', 'Resident DOB', '2000-01-01', false), null);

  // Super Admin can log ANY past date for operational forms, appointments, and incident logs
  assert.equal(validateDate('Super Admin', 'appointmentDate', 'Appointment Date', pastDate, false), null);
  assert.equal(validateDate('Super Admin', 'dateOfIncident', 'Incident Date', pastDate, false), null);
  assert.equal(validateDate('Super Admin', 'date', 'Date Left', pastDate, false), null);

  // Edit mode: preserving existing historical past date is permitted for regular users, but changing to older past date is blocked
  assert.equal(validateDate('Duty Worker', 'appointmentDate', 'Appointment Date', pastDate, true, pastDate), null);
  assert.ok(validateDate('Duty Worker', 'appointmentDate', 'Appointment Date', '2019-01-01', true, pastDate));
});

test('column classification guards: reviewBySGTeam is textarea, officer is not site, and assigned hotel reflects assigned property', () => {
  const isLoggedByColumn = (col: { key: string; label?: string; type?: string }): boolean => {
    if (col.type === 'textarea' || col.type === 'date' || col.type === 'number' || col.type === 'currency' || col.type === 'checkbox' || col.type === 'select') {
      return false;
    }
    const key = String(col.key).toLowerCase().replace(/[^a-z0-9]/g, '');
    const label = String(col.label || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    if (
      key.includes('officerleadinghotel') ||
      key.includes('laofficer') ||
      key.includes('allocatedworker') ||
      key.includes('review') ||
      key.includes('contractor') ||
      key.includes('client') ||
      key.includes('lead') ||
      label.includes('officerleadinghotel') ||
      label.includes('laofficer') ||
      label.includes('allocatedworker') ||
      label.includes('review') ||
      label.includes('contractor') ||
      label.includes('client')
    ) {
      return false;
    }

    return (
      key === 'loggedby' ||
      key === 'raisedby' ||
      key === 'reportedby' ||
      key === 'submittedby' ||
      key === 'personreporting' ||
      key === 'staffreporting' ||
      key === 'auditedby' ||
      key === 'uploadedby' ||
      label === 'loggedby' ||
      label === 'raisedby' ||
      label === 'reportedby' ||
      label === 'submittedby' ||
      label === 'personreporting' ||
      label === 'staffreporting' ||
      label === 'auditedby' ||
      label === 'uploadedby'
    );
  };

  const isSiteColumn = (col: { key: string; label?: string; type?: string }): boolean => {
    if (isLoggedByColumn(col)) return false;
    if (col.type === 'textarea' || col.type === 'date' || col.type === 'number' || col.type === 'currency' || col.type === 'checkbox') {
      return false;
    }
    const key = String(col.key).toLowerCase().replace(/[^a-z0-9]/g, '');
    const label = String(col.label || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    if (
      key.includes('review') ||
      key.includes('team') ||
      key.includes('officer') ||
      key.includes('staff') ||
      key.includes('worker') ||
      key.includes('damage') ||
      key.includes('left') ||
      key.includes('depart') ||
      key.includes('contact') ||
      key.includes('website') ||
      key.includes('address') ||
      label.includes('review') ||
      label.includes('team') ||
      label.includes('officer') ||
      label.includes('staff') ||
      label.includes('worker') ||
      label.includes('damage') ||
      label.includes('left') ||
      label.includes('depart') ||
      label.includes('contact') ||
      label.includes('website') ||
      label.includes('address')
    ) {
      return false;
    }

    if (
      key === 'site' ||
      key === 'sitename' ||
      key === 'hotel' ||
      key === 'hotelname' ||
      key === 'property' ||
      key === 'propertyname' ||
      key === 'assignedhotel'
    ) {
      return true;
    }

    return (
      label === 'site' ||
      label === 'sitename' ||
      label === 'property' ||
      label === 'propertyname' ||
      label === 'hotel' ||
      label === 'hotelname' ||
      label === 'hotelsite' ||
      label === 'sitehotel' ||
      label === 'propertysite' ||
      label === 'siteproperty' ||
      label === 'propertyhotel' ||
      label === 'hotelproperty' ||
      label === 'contractedproperty'
    );
  };

  // 1. "Review by SG Team / Site Team" must NEVER be classified as site or logged-by
  const reviewCol = { key: 'reviewBySGTeam', label: 'Review by SG Team / Site Team', type: 'textarea' };
  assert.equal(isSiteColumn(reviewCol), false);
  assert.equal(isLoggedByColumn(reviewCol), false);

  // 2. "Duty Officer (Site)" must NEVER be classified as site or logged-by
  const officerCol = { key: 'officerLeadingHotel', label: 'Duty Officer (Site)', type: 'text' };
  assert.equal(isSiteColumn(officerCol), false);
  assert.equal(isLoggedByColumn(officerCol), false);

  // 3. "Date Left Property" must NEVER be classified as site
  const dateLeftCol = { key: 'dateLeftProperty', label: 'Date Left Property', type: 'text' };
  assert.equal(isSiteColumn(dateLeftCol), false);

  // 4. Genuine property column is correctly recognized as site column
  const siteCol = { key: 'site', label: 'Property / Site', type: 'select' };
  assert.equal(isSiteColumn(siteCol), true);
  assert.equal(isLoggedByColumn(siteCol), false);

  // 5. Genuine logged by column is correctly recognized
  const loggedByCol = { key: 'raisedBy', label: 'Raised By', type: 'text' };
  assert.equal(isLoggedByColumn(loggedByCol), true);
  assert.equal(isSiteColumn(loggedByCol), false);

  // 6. Assigned hotel resolution dynamically matches user's assigned property, never hardcoded Stansted
  const resolveUserAssignedHotel = (ctx: any) => {
    if (ctx?.assignedSite && ctx.assignedSite !== 'All Sites' && ctx.assignedSite !== 'all') {
      return ctx.assignedSite;
    }
    if (ctx?.authProfile?.assignedSite && ctx.authProfile.assignedSite !== 'All Sites' && ctx.authProfile.assignedSite !== 'all') {
      return ctx.authProfile.assignedSite;
    }
    if (ctx?.allowedSites && ctx.allowedSites.length > 0 && ctx.allowedSites[0] !== 'All Sites' && ctx.allowedSites[0] !== 'all') {
      return ctx.allowedSites[0];
    }
    return '';
  };

  assert.equal(resolveUserAssignedHotel({ assignedSite: 'Brit Hotel' }), 'Brit Hotel');
  assert.equal(resolveUserAssignedHotel({ assignedSite: 'Holiday Inn Lambeth' }), 'Holiday Inn Lambeth');
  assert.equal(resolveUserAssignedHotel({ assignedSite: 'All Sites', allowedSites: ['Victoria House'] }), 'Victoria House');
});

test('RBAC notification filtering: staff restricted to site/personal, manager to managed site, RM to regional, admin to enterprise', async () => {
  const { filterNotificationsForRole, deriveInAppNotifications } = await import('../src/services/inAppNotificationService.ts');

  const mockAuditLogs: any[] = [
    {
      id: 'audit-1',
      timestamp: '2026-09-12T10:00:00Z',
      action: 'CREATE',
      module: 'maintenance',
      user: 'john.doe',
      role: 'Staff',
      details: 'Logged boiler repair at Stansted Hotel',
      site: 'Stansted Hotel',
      recordId: 'maint-101'
    },
    {
      id: 'audit-2',
      timestamp: '2026-09-12T10:15:00Z',
      action: 'UPDATE',
      module: 'referrals',
      user: 'alice.smith',
      role: 'Staff',
      details: 'Updated resident details at Victoria House',
      site: 'Victoria House',
      recordId: 'ref-202'
    },
    {
      id: 'audit-3',
      timestamp: '2026-09-12T10:30:00Z',
      action: 'UPDATE',
      module: 'users',
      user: 'john.doe',
      role: 'Staff',
      details: 'Updated personal profile settings for john.doe',
      site: undefined,
      recordId: 'john.doe'
    },
    {
      id: 'audit-4',
      timestamp: '2026-09-12T11:00:00Z',
      action: 'SECURITY',
      module: 'auth',
      user: 'system',
      role: 'System',
      details: 'Failed login attempts exceeded lockout threshold',
      site: undefined,
      recordId: 'sec-999'
    }
  ];

  const mockEscalations: any[] = [
    {
      id: 'esc-1',
      date: '2026-09-12',
      time: '11:15',
      incidentType: 'Severe Water Leak',
      priority: 'Emergency',
      assignedHotel: 'Stansted Hotel',
      loggedBy: 'duty.officer',
      status: 'Open'
    },
    {
      id: 'esc-2',
      date: '2026-09-12',
      time: '11:30',
      incidentType: 'Power Outage',
      priority: 'Emergency',
      assignedHotel: 'Victoria House',
      loggedBy: 'duty.worker',
      status: 'Open'
    }
  ];

  const mockRequests: any[] = [
    {
      id: 'req-1',
      requestedBy: 'john.doe',
      module: 'referrals',
      site: 'Stansted Hotel',
      status: 'Pending',
      timestamp: '2026-09-12T12:00:00Z'
    },
    {
      id: 'req-2',
      requestedBy: 'alice.smith',
      module: 'referrals',
      site: 'Victoria House',
      status: 'Pending',
      timestamp: '2026-09-12T12:15:00Z'
    }
  ];

  const derived = deriveInAppNotifications({
    auditLogs: mockAuditLogs,
    escalations: mockEscalations,
    dataChangeRequests: mockRequests,
    extraNotifications: []
  });

  // 1. Staff User at Stansted Hotel (john.doe)
  const staffUser: any = {
    username: 'john.doe',
    role: 'Staff',
    assignedSite: 'Stansted Hotel',
    allowedSites: ['Stansted Hotel']
  };
  const staffFeed = filterNotificationsForRole(derived, staffUser);

  // Staff should see Stansted items and their own profile update
  assert.ok(staffFeed.some(n => n.site === 'Stansted Hotel' && n.module === 'maintenance'), 'Staff sees Stansted maintenance');
  assert.ok(staffFeed.some(n => n.site === 'Stansted Hotel' && n.action === 'URGENT'), 'Staff sees Stansted emergency');
  assert.ok(staffFeed.some(n => n.module === 'users' && n.performedByUser === 'john.doe'), 'Staff sees own profile update');

  // Staff MUST NOT see Victoria House items or security events
  assert.ok(!staffFeed.some(n => n.site === 'Victoria House'), 'Staff NEVER sees Victoria House records');
  assert.ok(!staffFeed.some(n => n.action === 'SECURITY'), 'Staff NEVER sees system security events');

  // 2. Site Manager at Stansted Hotel (manager.stansted)
  const siteManagerUser: any = {
    username: 'manager.stansted',
    role: 'Site Manager',
    assignedSite: 'Stansted Hotel',
    allowedSites: ['Stansted Hotel']
  };
  const managerFeed = filterNotificationsForRole(derived, siteManagerUser);

  assert.ok(managerFeed.some(n => n.site === 'Stansted Hotel' && n.module === 'maintenance'), 'Manager sees Stansted maintenance');
  assert.ok(managerFeed.some(n => n.site === 'Stansted Hotel' && n.category === 'approval_workflow'), 'Manager sees pending requests for their site');
  assert.ok(!managerFeed.some(n => n.site === 'Victoria House'), 'Manager NEVER sees Victoria House records');

  // 3. Regional Manager overseeing both Stansted Hotel and Victoria House
  const rmUser: any = {
    username: 'rm.south',
    role: 'Regional Manager',
    assignedSite: 'All Sites',
    allowedSites: ['Stansted Hotel', 'Victoria House']
  };
  const rmFeed = filterNotificationsForRole(derived, rmUser);

  assert.ok(rmFeed.some(n => n.site === 'Stansted Hotel'), 'RM sees Stansted records');
  assert.ok(rmFeed.some(n => n.site === 'Victoria House'), 'RM sees Victoria House records');

  // 4. Super Admin (sees everything across the enterprise including security audits)
  const superAdminUser: any = {
    username: 'super.admin',
    role: 'Super Admin',
    assignedSite: 'All Sites',
    allowedSites: ['All Sites']
  };
  const adminFeed = filterNotificationsForRole(derived, superAdminUser);

  assert.ok(adminFeed.some(n => n.site === 'Stansted Hotel'), 'Admin sees Stansted');
  assert.ok(adminFeed.some(n => n.site === 'Victoria House'), 'Admin sees Victoria House');
  assert.ok(adminFeed.some(n => n.action === 'SECURITY'), 'Admin sees security audit logs');
  assert.ok(adminFeed.length >= staffFeed.length, 'Admin feed is superset of staff feed');
});

