/**
 * Schema Adapter for the SD Operations Supabase database.
 *
 * Converts between frontend application records and database rows.
 *
 * Every data table carries two representations of a record:
 *   - typed columns (su_name, site, status ...) for reporting, indexing and SQL;
 *   - a `data` JSONB column holding the complete application record.
 *
 * Reads prefer `data`, so every field a page submits - including fields added
 * later and administrator-defined custom columns - survives a round trip
 * (BUG-023). Rows written before the `data` column existed have it NULL and
 * are read back through the typed-column mapping instead.
 *
 * CANONICAL TABLES ONLY: laundry_logs (not laundry_records), hot_food_logs
 * (not food_records), audit_trails (not audit_logs).
 */

type ColType = 'text' | 'int' | 'num' | 'bool' | 'json';

/**
 * Typed-column mapping for tables whose records map field-for-field onto
 * columns: [frontend field, column, type].
 */
export const FIELD_SPECS: Record<string, Array<[string, string, ColType]>> = {
  public_transport_records: [
    ['approvalUrn', 'approval_urn', 'text'],
    ['suNames', 'su_names', 'text'],
    ['portRefs', 'port_refs', 'text'],
    ['accommodationAddress', 'accommodation_address', 'text'],
    ['siteName', 'site_name', 'text'],
    ['appointmentDate', 'appointment_date', 'text'],
    ['appointmentTime', 'appointment_time', 'text'],
    ['appointmentLocation', 'appointment_location', 'text'],
    ['distanceMiles', 'distance_miles', 'num'],
    ['modeOfTransport', 'mode_of_transport', 'text'],
    ['exceptionalCircumstances', 'exceptional_circumstances', 'text'],
    ['status', 'status', 'text'],
    ['attachments', 'attachments', 'json'],
    ['attachmentUrl', 'attachment_url', 'text'],
    ['fileUrl', 'file_url', 'text'],
  ],
  compliance_records: [
    ['srNo', 'sr_no', 'int'],
    ['complianceType', 'compliance_type', 'text'],
    ['contractorName', 'contractor_name', 'text'],
    ['contractorKeyContact', 'contractor_key_contact', 'text'],
    ['contractorEmail', 'contractor_email', 'text'],
    ['issuedDate', 'issued_date', 'text'],
    ['expiryDate', 'expiry_date', 'text'],
    ['status', 'status', 'text'],
    ['actionTaken', 'action_taken', 'text'],
    ['previousContractor', 'previous_contractor', 'text'],
    ['siteName', 'site_name', 'text'],
    ['attachments', 'attachments', 'json'],
    ['attachmentUrl', 'attachment_url', 'text'],
    ['fileUrl', 'file_url', 'text'],
  ],
  gp_appointments: [
    ['roomNo', 'room_no', 'text'],
    ['portReference', 'port_reference', 'text'],
    ['referralSentOn', 'referral_sent_on', 'text'],
    ['appointmentDate', 'appointment_date', 'text'],
    ['timeOfGp', 'time_of_gp', 'text'],
    ['comments', 'comments', 'text'],
    ['status', 'status', 'text'],
    ['siteName', 'site_name', 'text'],
    ['suName', 'su_name', 'text'],
    ['attachments', 'attachments', 'json'],
    ['attachmentUrl', 'attachment_url', 'text'],
    ['fileUrl', 'file_url', 'text'],
  ],
  rfa_welfare_checks: [
    ['date', 'date', 'text'],
    ['siteName', 'site_name', 'text'],
    ['roomOrFlatNo', 'room_or_flat_no', 'text'],
    ['name', 'name', 'text'],
    ['dob', 'dob', 'text'],
    ['group', 'group_name', 'text'],
    ['gender', 'gender', 'text'],
    ['portOrNassRef', 'port_or_nass_ref', 'text'],
    ['vulnerability', 'vulnerability', 'text'],
    ['actionTaken', 'action_taken', 'text'],
    ['mhTicket', 'mh_ticket', 'text'],
    ['attachments', 'attachments', 'json'],
    ['attachmentUrl', 'attachment_url', 'text'],
    ['fileUrl', 'file_url', 'text'],
  ],
  dispersal_records: [
    ['sno', 'sno', 'int'],
    ['siteName', 'site_name', 'text'],
    ['dateReceived', 'date_received', 'text'],
    ['suPortNassRef', 'su_port_nass_ref', 'text'],
    ['reasonForDeparture', 'reason_for_departure', 'text'],
    ['flatRoomNumber', 'flat_room_number', 'text'],
    ['dispersalDate', 'dispersal_date', 'text'],
    ['dateLetterHandedToSu', 'date_letter_handed_to_su', 'text'],
    ['iaExitBriefingCompleted', 'ia_exit_briefing_completed', 'text'],
    ['hoDispersalLetterReceived', 'ho_dispersal_letter_received', 'text'],
    ['travelled', 'travelled', 'text'],
    ['dateLeftProperty', 'date_left_property', 'text'],
    ['incidentWarningCompleted', 'incident_warning_completed', 'text'],
    ['reasonFailedToTravel', 'reason_failed_to_travel', 'text'],
    ['secondDispersalDate', 'second_dispersal_date', 'text'],
    ['dateSecondLetterHanded', 'date_second_letter_handed', 'text'],
    ['secondIaExitBriefingCompleted', 'second_ia_exit_briefing_completed', 'text'],
    ['secondDispersalTravelled', 'second_dispersal_travelled', 'text'],
    ['secondDateLeftProperty', 'second_date_left_property', 'text'],
    ['secondIncidentWarningCompleted', 'second_incident_warning_completed', 'text'],
    ['reasonFailedToTravelSecond', 'reason_failed_to_travel_second', 'text'],
    ['attachments', 'attachments', 'json'],
    ['attachmentUrl', 'attachment_url', 'text'],
    ['fileUrl', 'file_url', 'text'],
  ],
  booklet_collections: [
    ['hotelName', 'hotel_name', 'text'],
    ['agentName', 'agent_name', 'text'],
    ['bookletType', 'booklet_type', 'text'],
    ['language', 'language', 'text'],
    ['numberForCollection', 'number_for_collection', 'int'],
    ['collectedBooklets', 'collected_booklets', 'int'],
    ['bookletsReceived', 'booklets_received', 'int'],
    ['status', 'status', 'text'],
    ['notes', 'notes', 'text'],
    ['lastUpdated', 'last_updated', 'text'],
    ['attachments', 'attachments', 'json'],
    ['attachmentUrl', 'attachment_url', 'text'],
    ['fileUrl', 'file_url', 'text'],
  ],
  vcs_agencies: [
    ['hotelName', 'hotel_name', 'text'],
    ['agencyName', 'agency_name', 'text'],
    ['category', 'category', 'text'],
    ['servicesProvided', 'services_provided', 'text'],
    ['contactPerson', 'contact_person', 'text'],
    ['contactNumber', 'contact_number', 'text'],
    ['email', 'email', 'text'],
    ['address', 'address', 'text'],
    ['notes', 'notes', 'text'],
    ['isVerified', 'is_verified', 'bool'],
    ['attachments', 'attachments', 'json'],
    ['attachmentUrl', 'attachment_url', 'text'],
    ['fileUrl', 'file_url', 'text'],
  ],
  field_options: [
    ['category', 'category', 'text'],
    ['label', 'label', 'text'],
    ['value', 'value', 'text'],
    ['color', 'color', 'text'],
    ['description', 'description', 'text'],
    ['isActive', 'is_active', 'bool'],
    ['isSystem', 'is_system', 'bool'],
    ['order', 'sort_order', 'int'],
  ],
  role_permissions: [
    ['role', 'role', 'text'],
    ['canViewAllProperties', 'can_view_all_properties', 'bool'],
    ['canCreateRecords', 'can_create_records', 'bool'],
    ['canEditRecords', 'can_edit_records', 'bool'],
    ['canDeleteRecords', 'can_delete_records', 'bool'],
    ['canArchiveRestore', 'can_archive_restore', 'bool'],
    ['canExportData', 'can_export_data', 'bool'],
    ['canManageProperties', 'can_manage_properties', 'bool'],
    ['canManageFiles', 'can_manage_files', 'bool'],
    ['canManageUsers', 'can_manage_users', 'bool'],
    ['canManageSettings', 'can_manage_settings', 'bool'],
  ],
  app_settings: [
    ['value', 'value', 'json'],
    ['updatedBy', 'updated_by', 'text'],
  ],
  table_schemas: [
    ['moduleKey', 'module_key', 'text'],
    ['columns', 'columns', 'json'],
    ['updatedBy', 'updated_by', 'text'],
  ],
};

/** NOT NULL typed columns on FIELD_SPECS tables, with the fallback used when a record omits them. */
const REQUIRED_SPEC_COLUMNS: Record<string, Record<string, (record: any) => any>> = {
  field_options: { category: () => 'general' },
  role_permissions: { role: (r) => r.id },
  table_schemas: { module_key: (r) => r.id },
};

const AUDIT_COLS = ['created_by', 'created_at', 'updated_at'];
const specColumns = (table: string) => ['id', ...FIELD_SPECS[table].map(([, col]) => col), 'data', ...AUDIT_COLS];

/** Columns each table is expected to have once db/schema.sql has been applied. */
export const TABLE_COLUMNS: Record<string, Set<string>> = {
  referrals: new Set([
    'id', 'site', 'su_name', 'su_port_reference', 'port_ref', 'room_number',
    'date_referred', 'referral_type', 'reason', 'status', 'priority',
    'actions_taken', 'assigned_to', 'notes', 'follow_up_date', 'attachments',
    'attachment_url', 'file_url', 'data', 'created_by', 'created_at', 'updated_at'
  ]),
  vulnerable_residents: new Set([
    'id', 'site', 'su_name', 'su_port_reference', 'room_or_flat_no',
    'vulnerability_category', 'risk_level', 'description', 'care_plan',
    'emergency_contact', 'medical_notes', 'status', 'last_review_date',
    'next_review_date', 'flagged_by', 'attachments', 'attachment_url',
    'file_url', 'data', 'created_by', 'created_at', 'updated_at'
  ]),
  challenging_behavior: new Set([
    'id', 'site', 'name', 'port_ref', 'room_or_flat_no',
    'date_of_incident', 'type_of_issue', 'risk_to_others', 'description',
    'police_involved', 'police_cad_number', 'warning_issued', 'warning_level',
    'actions_taken', 'status', 'logged_by', 'attachments', 'attachment_url',
    'file_url', 'data', 'created_by', 'created_at', 'updated_at'
  ]),
  maintenance_records: new Set([
    'id', 'site', 'room_or_area', 'defect_status', 'description',
    'contractor', 'contractor_quote', 'priority', 'reported_date',
    'completion_date', 'sign_off_status', 'notes', 'category', 'reported_by',
    'attachments', 'attachment_url', 'file_url', 'data',
    'created_by', 'created_at', 'updated_at'
  ]),
  spcd_records: new Set([
    'id', 'site_name', 'su_name', 'su_port_reference', 'check_type',
    'status', 'declaration_date', 'officer_name', 'verified', 'comments',
    'expires_date', 'attachments', 'attachment_url', 'file_url', 'data',
    'created_by', 'created_at', 'updated_at'
  ]),
  sites: new Set([
    'id', 'name', 'pid', 'address', 'city', 'total_rooms', 'active_residents',
    'status', 'manager_name', 'manager_email', 'manager_phone', 'attachments',
    'attachment_url', 'file_url', 'data', 'created_by', 'created_at', 'updated_at'
  ]),
  laundry_logs: new Set([
    'id', 'site_id', 'site', 'room_no', 'resident_name', 'ref', 'date', 'tokens_issued',
    'bag_count', 'dirty_laundry_sent', 'clean_laundry_returned', 'discrepancies',
    'discrepancy_count', 'remarks_actions_taken', 'status', 'staff_initials',
    'notes', 'attachments', 'attachment_url', 'file_url', 'data',
    'created_by', 'created_at', 'updated_at'
  ]),
  hot_food_logs: new Set([
    'id', 'site_id', 'site', 'date', 'meal_type', 'vendor_name', 'supplier_name',
    'meals_delivered', 'temperature_c', 'quality_check', 'staff_name',
    'staff_signoff', 'notes', 'attachments', 'attachment_url', 'file_url', 'data',
    'created_by', 'created_at', 'updated_at'
  ]),
  escalations: new Set([
    'id', 'site', 'title', 'category', 'severity', 'status', 'description',
    'reported_by', 'assigned_to', 'resolution_notes', 'attachments',
    'attachment_url', 'file_url', 'data', 'created_by', 'created_at', 'updated_at'
  ]),
  documents: new Set([
    'id', 'title', 'category', 'site', 'file_url', 'file_size',
    'uploaded_by', 'uploaded_date', 'version', 'attachments', 'attachment_url',
    'data', 'created_by', 'created_at', 'updated_at'
  ]),
  audit_trails: new Set([
    'id', 'timestamp', 'user', 'user_id', 'role', 'action', 'details',
    'site', 'entity_type', 'entity_id', 'module', 'target_label',
    'created_by', 'created_at', 'updated_at'
  ]),
  profiles: new Set([
    'id', 'email', 'name', 'role', 'assigned_site', 'status',
    'created_by', 'created_at', 'updated_at'
  ]),
  user_groups: new Set([
    'id', 'name', 'description', 'assigned_property', 'assigned_properties',
    'user_ids', 'data', 'created_by', 'created_at', 'updated_at'
  ]),
  data_change_requests: new Set([
    'id', 'module', 'action_type', 'requested_by', 'site', 'status',
    'payload', 'reason', 'attachments', 'attachment_url', 'file_url', 'data',
    'created_by', 'created_at', 'updated_at'
  ]),
  property_user_assignments: new Set([
    'id', 'user_id', 'user_email', 'user_name', 'group_id', 'group_name',
    'property_id', 'property_name', 'role', 'assigned_properties', 'data',
    'created_by', 'created_at', 'updated_at'
  ]),
  password_audit_logs: new Set([
    'id', 'timestamp', 'admin_email', 'target_email', 'target_user_id',
    'action', 'status', 'error', 'created_by', 'created_at', 'updated_at'
  ]),
  ...Object.fromEntries(Object.keys(FIELD_SPECS).map(t => [t, new Set(specColumns(t))])),
};

/** Audit-view module label for an API entity, for rows that do not name one. */
export const ENTITY_MODULE_LABELS: Record<string, string> = {
  referrals: 'Referrals', vulnerable: 'Vulnerable SUs', challenging: 'Challenging SUs', spcd: 'Vulnerable SUs',
  rfaWelfare: 'Vulnerable SUs', laundry: 'Laundry', laundry_logs: 'Laundry', property_laundry_logs: 'Laundry',
  food: 'Hot Food', hot_food_logs: 'Hot Food', food_vendor_buffet_logs: 'Hot Food', escalations: 'Escalations',
  documents: 'Documents', sites: 'Properties', users: 'Users', profiles: 'Users', userGroups: 'Users',
  property_user_assignments: 'Users', rolePermissions: 'Roles', gpAppointments: 'Referrals', dispersal: 'Referrals'
};
export const moduleLabelFor = (entity?: string | null) => (entity && ENTITY_MODULE_LABELS[entity]) || entity || 'Settings';

/** Tables that store the full application record in `data`. */
export const DATA_TABLES = new Set(
  Object.entries(TABLE_COLUMNS).filter(([, cols]) => cols.has('data')).map(([t]) => t)
);

/**
 * Coerce to a number, or null when nothing was supplied.
 *
 * Deliberately distinct from `Number(x || fallback)`: a genuine 0 must survive
 * (0 items delivered is a real, meaningful reading) while an absent value must
 * become NULL rather than an invented figure.
 */
function numberOrNull(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toNum(value: any, fallback = 0): number {
  if (value === null || value === undefined || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function boolOrNull(value: any): boolean | null {
  if (value === true || value === 'true' || value === 'Yes' || value === 'yes' || value === 1) return true;
  if (value === false || value === 'false' || value === 'No' || value === 'no' || value === 0) return false;
  return null;
}

function coerce(value: any, type: ColType): any {
  if (value === undefined) return undefined;
  switch (type) {
    case 'int': {
      const n = numberOrNull(value);
      return n === null ? null : Math.trunc(n);
    }
    case 'num':
      return numberOrNull(value);
    case 'bool':
      return boolOrNull(value);
    case 'json':
      return value ?? null;
    case 'text':
    default:
      if (value === null) return null;
      return typeof value === 'object' ? JSON.stringify(value) : String(value);
  }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function isValidUuid(val: any): boolean {
  return typeof val === 'string' && UUID_REGEX.test(val.trim());
}

/** Transport-only keys that must never be persisted as part of a record. */
const TRANSIENT_KEYS = new Set(['auditDetails', '_audit']);

/** A JSON-safe copy of the record: no functions, no undefined, no transport keys. */
export function sanitizeRecord(record: any): Record<string, any> {
  if (!record || typeof record !== 'object') return {};
  const clean = JSON.parse(JSON.stringify(record));
  for (const key of TRANSIENT_KEYS) delete clean[key];
  return clean;
}

/**
 * Maps a frontend record into a schema-compliant row.
 *
 * `allowedColumns` is the live column set for the table when known. It lets
 * writes succeed against a database that has not yet received the latest
 * migration (for example, before the `data` column exists) instead of failing
 * with an unknown-column error.
 */
export function toDatabaseRow(
  tableName: string,
  record: any,
  callerUserId?: string | null,
  allowedColumns?: Set<string> | null
): Record<string, any> {
  if (!record || typeof record !== 'object') return {};
  const validCols = allowedColumns || TABLE_COLUMNS[tableName];
  const nowIso = new Date().toISOString();
  const dbRow: Record<string, any> = {};

  // Preserve ID — profiles MUST use the auth.users UUID (never generate a random one)
  if (record.id) {
    const rawId = String(record.id).trim();
    if (tableName === 'profiles') {
      if (isValidUuid(rawId)) {
        dbRow.id = rawId;
      }
    } else {
      dbRow.id = rawId;
    }
  }

  // Safe caller UUID for created_by
  if (isValidUuid(callerUserId)) {
    dbRow.created_by = callerUserId;
  } else if (isValidUuid(record.createdBy || record.created_by)) {
    dbRow.created_by = record.createdBy || record.created_by;
  }

  if (FIELD_SPECS[tableName]) {
    for (const [field, column, type] of FIELD_SPECS[tableName]) {
      const value = coerce(record[field], type);
      if (value !== undefined) dbRow[column] = value;
    }
    for (const [column, fallback] of Object.entries(REQUIRED_SPEC_COLUMNS[tableName] || {})) {
      if (dbRow[column] === undefined || dbRow[column] === null || dbRow[column] === '') {
        dbRow[column] = fallback(record);
      }
    }
  }

  switch (tableName) {
    case 'referrals': {
      dbRow.site = record.site || record.assignedSite || record.siteName || 'All Sites';
      dbRow.su_name = record.serviceUserName || record.suName || record.name || '';
      dbRow.su_port_reference = record.suPortReference || record.portRef || record.ref || '';
      dbRow.port_ref = record.suPortReference || record.portRef || record.ref || '';
      dbRow.room_number = String(record.roomNumber || record.roomNo || record.room || '');
      dbRow.date_referred = record.dateReferred || record.checkInDate || record.date || nowIso.split('T')[0];
      dbRow.referral_type = record.referralType || record.type || 'Single Adult';
      dbRow.reason = record.reason || '';
      dbRow.status = record.status || 'Active';
      dbRow.priority = record.priority || record.urgency || record.riskLevel || 'Normal';
      dbRow.actions_taken = record.actionsTaken || record.notesActionTaken || '';
      dbRow.assigned_to = record.assignedTo || record.allocatedWorker || record.laOfficerLeading || '';
      dbRow.follow_up_date = record.followUpDate || record.expectedCheckOutDate || null;

      // Pack extra & custom fields into notes JSON (read back when `data` is absent)
      const knownReferralKeys = new Set([
        'id', 'site', 'assignedSite', 'siteName', 'serviceUserName', 'suName', 'name',
        'suPortReference', 'portRef', 'ref', 'roomNumber', 'roomNo', 'room',
        'dateReferred', 'checkInDate', 'date', 'referralType', 'type', 'reason',
        'status', 'priority', 'actionsTaken', 'assignedTo', 'allocatedWorker',
        'followUpDate', 'notes', 'createdAt', 'updatedAt',
        'createdBy', 'created_at', 'updated_at', 'created_by',
        'attachments', 'attachmentUrl', 'attachment_url', 'fileUrl', 'file_url'
      ]);
      const extraFields: Record<string, any> = {};
      for (const [k, v] of Object.entries(record)) {
        if (!knownReferralKeys.has(k) && v !== undefined && typeof v !== 'function' && !TRANSIENT_KEYS.has(k)) {
          extraFields[k] = v;
        }
      }
      extraFields.attachments = Array.isArray(record.attachments) ? record.attachments : [];
      const refPrimaryAtt = extraFields.attachments.length > 0 ? extraFields.attachments[0] : null;
      const refLink = refPrimaryAtt?.url || refPrimaryAtt?.dataUrl || record.attachmentUrl || record.attachment_url || record.fileUrl || '';
      extraFields.attachmentUrl = refLink;
      extraFields.fileUrl = refLink;
      extraFields.userNotes = typeof record.notes === 'string' ? record.notes : '';
      dbRow.notes = JSON.stringify(extraFields);
      break;
    }

    case 'vulnerable_residents': {
      dbRow.site = record.site || record.assignedSite || record.siteName || 'All Sites';
      dbRow.su_name = record.serviceUserName || record.suName || record.name || '';
      dbRow.su_port_reference = record.suPortReference || record.portOrNassRef || record.portRef || '';
      dbRow.room_or_flat_no = String(record.roomNumber || record.roomNo || record.roomOrFlatNo || '');
      dbRow.vulnerability_category = record.vulnerabilityCategory || record.vulnerability || record.category || 'General';
      dbRow.risk_level = record.riskLevel || 'Medium';
      dbRow.description = record.description || record.carePlanSummary || record.notesActionTaken || (typeof record.notes === 'string' ? record.notes : '') || '';
      dbRow.care_plan = record.carePlan || record.carePlanSummary || record.sgTeamUpdate || '';
      dbRow.emergency_contact = record.emergencyContact || '';
      dbRow.status = record.status || 'Active';
      dbRow.last_review_date = record.lastReviewDate || record.lastAssessmentDate || null;
      dbRow.next_review_date = record.nextReviewDate || record.reviewDate || null;
      dbRow.flagged_by = record.raisedBy || record.flaggedBy || record.allocatedWorker || record.allocatedStaff || '';

      const knownVulnKeys = new Set([
        'id', 'site', 'assignedSite', 'siteName', 'serviceUserName', 'suName', 'name',
        'suPortReference', 'portOrNassRef', 'portRef', 'ref', 'roomNumber', 'roomNo',
        'roomOrFlatNo', 'vulnerabilityCategory', 'vulnerability', 'category', 'riskLevel',
        'description', 'carePlanSummary', 'notesActionTaken', 'carePlan', 'sgTeamUpdate',
        'emergencyContact', 'medicalNotes', 'status', 'lastReviewDate', 'lastAssessmentDate',
        'nextReviewDate', 'reviewDate', 'flaggedBy', 'allocatedWorker', 'allocatedStaff',
        'raisedBy', 'notes', 'createdAt', 'updatedAt', 'createdBy', 'created_at', 'updated_at',
        'created_by',
        'attachments', 'attachmentUrl', 'attachment_url', 'fileUrl', 'file_url'
      ]);
      const customVulnFields: Record<string, any> = {};
      for (const [k, v] of Object.entries(record)) {
        if (!knownVulnKeys.has(k) && v !== undefined && typeof v !== 'function' && !TRANSIENT_KEYS.has(k)) {
          customVulnFields[k] = v;
        }
      }

      // Sync attachments into the envelope so they survive round-trip
      const vulnAtts = Array.isArray(record.attachments) ? record.attachments : [];
      customVulnFields.attachments = vulnAtts;
      if (vulnAtts.length > 0) {
        const vulnPrimary = vulnAtts[0];
        const vulnLink = vulnPrimary?.url || vulnPrimary?.dataUrl || '';
        customVulnFields.attachmentUrl = vulnLink;
        customVulnFields.fileUrl = vulnLink;
      } else {
        // Explicit clear: remove stale URLs from the envelope
        delete customVulnFields.attachmentUrl;
        delete customVulnFields.attachment_url;
        delete customVulnFields.fileUrl;
        delete customVulnFields.file_url;
      }

      if (Object.keys(customVulnFields).length > 0 || (record.medicalNotes && typeof record.medicalNotes !== 'string')) {
        dbRow.medical_notes = JSON.stringify({
          _text: typeof record.medicalNotes === 'string' ? record.medicalNotes : '',
          ...customVulnFields
        });
      } else {
        dbRow.medical_notes = record.medicalNotes || '';
      }
      break;
    }

    case 'challenging_behavior': {
      dbRow.site = record.site || record.assignedSite || record.siteName || 'All Sites';
      dbRow.name = record.serviceUserName || record.name || record.suName || '';
      dbRow.port_ref = record.suPortReference || record.portRef || record.ref || '';
      dbRow.room_or_flat_no = String(record.roomNumber || record.roomNo || record.roomOrFlatNo || '');
      dbRow.date_of_incident = record.incidentDate || record.dateOfIncident || record.date || nowIso.split('T')[0];
      dbRow.type_of_issue = record.incidentType || record.typeOfIssue || record.category || 'Incident';
      dbRow.risk_to_others = record.severity || record.riskToOthers || record.riskFactor || record.riskLevel || 'Low';
      dbRow.description = record.description || record.incidentDescription || record.triggerFactors || (typeof record.notes === 'string' ? record.notes : '') || '';
      // BOOLEAN columns: write real booleans.
      dbRow.police_involved = record.policeInvolved === true || record.policeInvolved === 'Yes' || record.policeCalled === true;
      dbRow.police_cad_number = record.policeCadNumber || '';
      dbRow.warning_issued = record.warningIssued === true || record.warningIssued === 'Yes';
      dbRow.warning_level = record.warningLevel || record.warningFlag || '';
      dbRow.status = record.status || 'Open';
      dbRow.logged_by = record.raisedBy || record.loggedBy || record.reportedBy || record.staffName || '';

      const knownChallengingKeys = new Set([
        'id', 'site', 'assignedSite', 'siteName', 'serviceUserName', 'name', 'suName',
        'suPortReference', 'portRef', 'ref', 'roomNumber', 'roomNo', 'roomOrFlatNo',
        'dateOfIncident', 'incidentDate', 'typeOfIssue', 'incidentType', 'category',
        'severity', 'riskToOthers', 'riskLevel', 'description', 'incidentDescription',
        'triggerFactors', 'policeInvolved', 'policeCalled', 'policeCadNumber', 'warningIssued',
        'warningLevel', 'warningFlag', 'actionTaken', 'actionsTaken', 'deEscalationProtocol',
        'status', 'loggedBy', 'reportedBy', 'staffName', 'notes', 'createdAt',
        'updatedAt', 'createdBy', 'created_at', 'updated_at', 'created_by',
        'attachments', 'attachmentUrl', 'attachment_url', 'fileUrl', 'file_url'
      ]);
      const customChallengingFields: Record<string, any> = {};
      for (const [k, v] of Object.entries(record)) {
        if (!knownChallengingKeys.has(k) && v !== undefined && typeof v !== 'function' && !TRANSIENT_KEYS.has(k)) {
          customChallengingFields[k] = v;
        }
      }

      // Sync attachments in actions_taken envelope
      const chalAtts = Array.isArray(record.attachments) ? record.attachments : [];
      customChallengingFields.attachments = chalAtts;
      if (chalAtts.length > 0) {
        const chalPrimary = chalAtts[0];
        const chalLink = chalPrimary?.url || chalPrimary?.dataUrl || record.attachmentUrl || record.fileUrl || '';
        customChallengingFields.attachmentUrl = chalLink;
        customChallengingFields.fileUrl = chalLink;
      } else {
        delete customChallengingFields.attachmentUrl;
        delete customChallengingFields.attachment_url;
        delete customChallengingFields.fileUrl;
        delete customChallengingFields.file_url;
      }

      // Guard: Ensure reviewBySGTeam is never mistakenly saved with hotel/property name
      if (customChallengingFields.reviewBySGTeam) {
        const rev = String(customChallengingFields.reviewBySGTeam);
        if (
          rev.toLowerCase().includes('hotel') ||
          rev.toLowerCase().includes('stansted') ||
          rev.toLowerCase().includes('ibis') ||
          rev === dbRow.site
        ) {
          customChallengingFields.reviewBySGTeam = '';
        }
      }

      const rawActionTaken = record.actionTaken || record.actionsTaken || record.deEscalationProtocol || '';
      if (Object.keys(customChallengingFields).length > 0) {
        dbRow.actions_taken = JSON.stringify({
          _text: rawActionTaken,
          ...customChallengingFields
        });
      } else {
        dbRow.actions_taken = rawActionTaken;
      }
      break;
    }

    case 'maintenance_records': {
      dbRow.site = record.site || record.assignedSite || record.siteName || 'All Sites';
      dbRow.room_or_area = String(record.room || record.roomNumber || record.location || record.roomOrArea || record.roomNo || 'General Area');
      dbRow.defect_status = record.defectStatus || record.status || 'Reported';
      dbRow.description = record.description || record.notes || '';
      dbRow.contractor = record.allocatedContractor || record.contractor || '';
      dbRow.contractor_quote = toNum(record.costEstimate ?? record.contractorQuote, 0);
      dbRow.priority = record.priority || 'Normal';
      dbRow.reported_date = record.date || record.reportedDate || record.createdAt?.split('T')[0] || nowIso.split('T')[0];
      dbRow.completion_date = record.actualClosedDate || record.completionDate || record.completedDate || record.targetCompletionDate || null;
      dbRow.sign_off_status = record.signOffStatus || (record.defectStatus === 'Completed' || record.action === 'Closed' ? 'Signed Off' : 'Pending');
      dbRow.category = record.criteriaCode || record.issueCategory || record.category || 'General';
      dbRow.reported_by = record.raisedBy || record.reportedBy || record.loggedBy || '';

      const knownMaintKeys = new Set([
        'id', 'site', 'assignedSite', 'siteName', 'room', 'roomNumber', 'location',
        'roomOrArea', 'roomNo', 'defectStatus', 'status', 'description', 'allocatedContractor',
        'contractor', 'costEstimate', 'contractorQuote', 'priority', 'date', 'reportedDate',
        'createdAt', 'completionDate', 'actualClosedDate', 'completedDate', 'targetCompletionDate',
        'signOffStatus', 'action', 'criteriaCode', 'issueCategory', 'category', 'raisedBy',
        'reportedBy', 'loggedBy', 'notes', 'userNotes', 'progress', 'priorityTimeScale',
        'closeDueDate', 'actualCost', 'updatedAt', 'createdBy', 'created_at', 'updated_at',
        'created_by',
        'attachments', 'attachmentUrl', 'attachment_url', 'fileUrl', 'file_url'
      ]);
      const customMaintFields: Record<string, any> = {};
      for (const [k, v] of Object.entries(record)) {
        if (!knownMaintKeys.has(k) && v !== undefined && typeof v !== 'function' && !TRANSIENT_KEYS.has(k)) {
          customMaintFields[k] = v;
        }
      }

      // Sync attachments into envelope
      const maintAtts = Array.isArray(record.attachments) ? record.attachments : [];
      customMaintFields.attachments = maintAtts;
      if (maintAtts.length > 0) {
        const maintPrimary = maintAtts[0];
        const maintLink = maintPrimary?.url || maintPrimary?.dataUrl || '';
        customMaintFields.attachmentUrl = maintLink;
        customMaintFields.fileUrl = maintLink;
      } else {
        delete customMaintFields.attachmentUrl;
        delete customMaintFields.attachment_url;
        delete customMaintFields.fileUrl;
        delete customMaintFields.file_url;
      }

      const extraMaint = {
        ...customMaintFields,
        location: record.location || dbRow.room_or_area,
        room: record.room || '',
        action: record.action || (record.defectStatus === 'Completed' ? 'Closed' : 'Open'),
        progress: record.progress || '',
        priorityTimeScale: record.priorityTimeScale || '',
        closeDueDate: record.closeDueDate || '',
        actualClosedDate: record.actualClosedDate || '',
        criteriaCode: record.criteriaCode || '',
        actualCost: record.actualCost || 0,
        userNotes: typeof record.notes === 'string' ? record.notes : ''
      };
      dbRow.notes = JSON.stringify(extraMaint);
      break;
    }

    case 'spcd_records': {
      const siteName = record.siteName || record.site || 'All Sites';
      const suName = record.suName || record.serviceUserName || record.name || '';
      const suPortReference = record.suPortReference || record.portRef || record.ref || '';
      const date = record.date || record.checkDate || record.declarationDate || (record.createdAt ? record.createdAt.slice(0, 10) : nowIso.split('T')[0]);
      const staffReporting = record.staffReporting || record.raisedBy || record.officerName || record.staffName || '';
      const sgReview = record.sgReview || record.status || 'Pending Safeguarding Lead Review';
      const isArchived = record.isArchived === true || record.isArchived === 'true';
      const dateLeft = record.dateLeft || record.expiresDate || null;

      const spcdAtts = Array.isArray(record.attachments) ? record.attachments : [];
      const spcdPrimaryLink = spcdAtts.length > 0
        ? (spcdAtts[0]?.url || spcdAtts[0]?.dataUrl || '')
        : '';

      const fullPayload = {
        ...sanitizeRecord(record),
        date,
        siteName,
        site: siteName,
        roomNumber: record.roomNumber || record.room || record.room_no || '',
        staffReporting,
        raisedBy: staffReporting,
        suName,
        serviceUserName: suName,
        suPortReference,
        suDob: record.suDob || record.dob || '',
        briefDescriptionActionTaken: record.briefDescriptionActionTaken || record.description || record.observations || record.comments || '',
        followUpNotes: record.followUpNotes || record.notes || '',
        updates: record.updates || '',
        sgReview,
        isArchived,
        dateLeft,
        reasonForLeaving: record.reasonForLeaving || null,
        attachments: spcdAtts,
        attachmentUrl: spcdPrimaryLink,
        fileUrl: spcdPrimaryLink
      };

      dbRow.site_name = siteName;
      dbRow.su_name = suName;
      dbRow.su_port_reference = suPortReference;
      dbRow.check_type = 'SPCD Case';
      dbRow.status = isArchived ? 'Archived' : (sgReview || 'Active');
      dbRow.declaration_date = date;
      dbRow.officer_name = staffReporting;
      dbRow.verified = true;
      dbRow.comments = JSON.stringify(fullPayload);
      dbRow.expires_date = dateLeft;
      break;
    }

    case 'sites': {
      dbRow.name = record.name || '';
      dbRow.pid = record.pid || record.code || `SITE-${record.id || Math.floor(Math.random() * 1000)}`;
      dbRow.city = record.city || 'London';
      dbRow.total_rooms = Math.trunc(toNum(record.totalRooms ?? record.capacity, 20));
      dbRow.active_residents = Math.trunc(toNum(record.activeResidents ?? record.occupiedRooms, 0));
      dbRow.status = record.status || 'Active';
      dbRow.manager_name = record.leadOfficer || record.managerName || '';
      dbRow.manager_email = record.contactEmail || record.managerEmail || '';
      dbRow.manager_phone = record.contactNumber || record.managerPhone || '';

      const knownSiteKeys = new Set([
        'id', 'name', 'pid', 'code', 'address', 'addressLine1', 'city', 'totalRooms',
        'capacity', 'activeResidents', 'occupiedRooms', 'status', 'managerName', 'leadOfficer',
        'managerEmail', 'contactEmail', 'managerPhone', 'contactNumber', 'createdAt', 'updatedAt',
        'createdBy', 'created_at', 'updated_at', 'created_by'
      ]);
      const customSiteFields: Record<string, any> = {};
      for (const [k, v] of Object.entries(record)) {
        if (!knownSiteKeys.has(k) && v !== undefined && typeof v !== 'function' && !TRANSIENT_KEYS.has(k)) {
          customSiteFields[k] = v;
        }
      }

      const rawAddress = record.address || record.addressLine1 || '';
      if (Object.keys(customSiteFields).length > 0) {
        dbRow.address = JSON.stringify({
          _text: rawAddress,
          ...customSiteFields
        });
      } else {
        dbRow.address = rawAddress;
      }
      break;
    }

    case 'laundry_logs': {
      dbRow.site = record.site || record.assignedSite || 'All Sites';
      dbRow.room_no = String(record.roomNumber || record.roomNo || 'N/A');
      dbRow.resident_name = record.serviceUserName || record.residentName || record.suName || '';
      dbRow.ref = record.suPortReference || record.ref || '';
      dbRow.date = record.date || record.dropOffDate || record.startDate || nowIso.split('T')[0];
      // Counted quantities are attested figures — store what was supplied, or NULL.
      dbRow.tokens_issued = numberOrNull(record.tokensIssued ?? record.bagCount);
      dbRow.bag_count = numberOrNull(record.bagCount);
      dbRow.dirty_laundry_sent = numberOrNull(record.dirtyLaundrySent ?? record.bagCount);
      dbRow.clean_laundry_returned = numberOrNull(record.cleanLaundryReturned);
      dbRow.discrepancies = typeof record.discrepancies === 'string'
        ? record.discrepancies
        : (record.hasDiscrepancy || record.discrepancies === true ? 'Discrepancy Reported' : 'None');
      dbRow.discrepancy_count = Math.trunc(toNum(record.discrepanciesCount ?? record.discrepancyCount, 0));
      dbRow.remarks_actions_taken = record.remarksActionsTaken || record.remarks || '';
      dbRow.status = record.status || 'Pending';
      dbRow.staff_initials = record.staffInitials || record.staffName || record.loggedBy || 'Staff';

      const isPropertyLog = record.periodType || record.periodLabel || String(record.id || '').startsWith('prop-lau');
      if (isPropertyLog) {
        dbRow.notes = JSON.stringify({
          _type: 'property_laundry_log',
          periodType: record.periodType || 'Weekly',
          periodLabel: record.periodLabel || '',
          startDate: record.startDate || record.date || '',
          endDate: record.endDate || record.date || '',
          hasDiscrepancy: !!record.hasDiscrepancy,
          discrepancyDetails: record.discrepancyDetails || '',
          loggedBy: record.loggedBy || record.staffInitials || 'Staff',
          rawNotes: record.notes || ''
        });
      } else {
        dbRow.notes = typeof record.notes === 'string' ? record.notes : '';
      }
      break;
    }

    case 'hot_food_logs': {
      dbRow.site = record.site || record.assignedSite || 'All Sites';
      dbRow.date = record.date || record.mealDate || record.startDate || (record.createdAt ? String(record.createdAt).slice(0, 10) : nowIso.split('T')[0]);
      dbRow.meal_type = record.mealType || (record.dailyCounts ? 'Buffet' : 'Dinner');
      dbRow.vendor_name = record.vendorName || record.vendor || record.supplierName || null;
      dbRow.supplier_name = record.supplierName || record.vendorName || record.vendor || null;
      dbRow.meals_delivered = numberOrNull(record.mealsDelivered ?? record.servings ?? record.mealsOrdered);
      dbRow.temperature_c = numberOrNull(record.temperatureC ?? record.tempCheckedCelsius ?? record.temperatureReadingC);
      dbRow.quality_check = record.qualityCheck || record.status || null;
      dbRow.staff_name = record.staffName || record.deliveredBy || record.lastUpdatedBy || record.updatedBy || null;
      dbRow.staff_signoff = record.staffSignoff || record.staffName || record.deliveredBy || null;

      const isVendorBuffet = record.dailyCounts || record.weekRange || String(record.id || '').startsWith('vendor-bf');
      if (isVendorBuffet) {
        dbRow.notes = JSON.stringify({
          _type: 'vendor_buffet_log',
          vendor: record.vendor || record.vendorName || 'A&M',
          weekRange: record.weekRange || '',
          startDate: record.startDate || record.date || '',
          endDate: record.endDate || record.date || '',
          dailyCounts: record.dailyCounts || {},
          updatedBy: record.lastUpdatedBy || record.updatedBy || record.staffName || '',
          rawNotes: record.notes || ''
        });
      } else {
        dbRow.notes = typeof record.notes === 'string' ? record.notes : '';
      }
      break;
    }

    case 'escalations': {
      const suName = record.suName || record.name || (record.residentName || '');
      const incidentType = record.incidentType || record.incidentTitle || record.title || 'Safeguarding Incident';
      const urgency = record.urgency || record.severity || 'High';
      const status = record.status || 'Active';
      const personReporting = record.personReporting || record.reportedBy || record.submittedBy || record.staffName || '';
      const reportedAuthorities = record.reportedAuthorities || record.assignedTo || record.escalatedTo || '';
      const actionTaken = record.actionTaken || record.resolutionNotes || record.immediateAction || '';

      const escAtts = Array.isArray(record.attachments) ? record.attachments : [];
      const escPrimaryLink = escAtts.length > 0
        ? (escAtts[0]?.url || escAtts[0]?.dataUrl || '')
        : '';
      const fullPayload = {
        ...sanitizeRecord(record),
        suName,
        suPortNassRef: record.suPortNassRef || record.refNumber || record.portRef || '',
        dateOfIncident: record.dateOfIncident || (record.dateTime ? String(record.dateTime).slice(0, 10) : '') || record.incidentDate || (record.createdAt ? String(record.createdAt).slice(0, 10) : nowIso.split('T')[0]),
        personReporting,
        incidentType,
        wlIssued: record.wlIssued || 'No',
        reportedAuthorities,
        incidentNotes: record.incidentNotes || record.incidentSummary || record.description || record.notes || '',
        actionTaken,
        urgency,
        status,
        attachments: escAtts,
        // Sync primary URL fields (clear stale data: URIs when no attachments)
        attachmentUrl: escPrimaryLink,
        attachment_url: escPrimaryLink,
        fileUrl: escPrimaryLink,
        file_url: escPrimaryLink
      };

      dbRow.site = record.site || record.assignedSite || record.siteName || 'All Sites';
      dbRow.title = suName ? `${suName} - ${incidentType}` : incidentType;
      dbRow.category = incidentType;
      dbRow.severity = urgency;
      dbRow.status = status;
      dbRow.description = JSON.stringify(fullPayload);
      dbRow.reported_by = personReporting;
      dbRow.assigned_to = reportedAuthorities;
      dbRow.resolution_notes = actionTaken;
      break;
    }

    case 'documents': {
      dbRow.title = record.documentTitle || record.title || 'Document';
      dbRow.category = record.category || 'General';
      dbRow.site = record.site || 'All Sites';
      const atts = Array.isArray(record.attachments) ? record.attachments : [];
      dbRow.attachments = atts;
      if (atts.length > 0) {
        const primary = atts[0];
        const link = primary?.url || primary?.dataUrl || record.fileUrl || '';
        dbRow.file_url = link;
        dbRow.attachment_url = link;
      } else if (record.attachments !== undefined) {
        dbRow.file_url = null;
        dbRow.attachment_url = null;
        if (record.fileUrl) record.fileUrl = '';
        if (record.attachmentUrl) record.attachmentUrl = '';
        if (record.storagePath) record.storagePath = '';
      } else {
        dbRow.file_url = record.fileUrl || record.storagePath || null;
      }
      dbRow.file_size = typeof record.fileSize === 'string'
        ? record.fileSize
        : `${Math.round(toNum(record.fileSizeKb, toNum(record.fileSizeBytes, 1024) / 1024))} KB`;
      dbRow.uploaded_by = record.uploadedBy || 'Staff';
      dbRow.uploaded_date = record.uploadDate || record.uploadedDate || record.createdAt?.split('T')[0] || nowIso.split('T')[0];
      dbRow.version = record.version || '1.0';
      break;
    }

    case 'profiles': {
      // profiles.id MUST be set by the caller to match auth.users.id
      dbRow.email = record.email ? String(record.email).toLowerCase().trim() : '';
      dbRow.name = record.name || '';
      dbRow.role = record.role || 'Staff';
      dbRow.assigned_site = record.assignedSite || record.assigned_site || (Array.isArray(record.assignedSites) ? record.assignedSites[0] : 'All Sites');
      dbRow.status = record.status || 'Active';
      break;
    }

    case 'user_groups': {
      dbRow.name = record.name || '';
      dbRow.description = record.description || '';
      dbRow.assigned_property = record.assignedProperty || (Array.isArray(record.assignedProperties) ? record.assignedProperties[0] : '');
      dbRow.assigned_properties = Array.isArray(record.assignedProperties) ? record.assignedProperties : [dbRow.assigned_property];
      dbRow.user_ids = Array.isArray(record.userIds) ? record.userIds : [];
      break;
    }

    case 'data_change_requests': {
      dbRow.module = record.module || record.tableName || 'General';
      dbRow.action_type = record.requestType || record.actionType || 'UPDATE';
      dbRow.requested_by = record.requestedBy || 'Staff';
      dbRow.site = record.site || 'All Sites';
      dbRow.status = record.status || 'Pending';
      dbRow.reason = record.reason || '';
      dbRow.payload = typeof record.payload === 'object' && record.payload !== null
        ? record.payload
        : {
            recordId: record.recordId ?? null,
            recordTitle: record.recordTitle ?? null,
            proposedChanges: record.proposedChanges ?? record.requestedChanges ?? null,
            requestedByRole: record.requestedByRole ?? null,
            reviewedBy: record.reviewedBy ?? null,
            reviewedAt: record.reviewedAt ?? null,
            reviewNotes: record.reviewNotes ?? null
          };
      break;
    }

    case 'audit_trails': {
      dbRow.timestamp = record.timestamp || nowIso;
      dbRow.user = record.user || record.performedByUser || record.userName || 'Staff';
      if (isValidUuid(record.userId || record.user_id)) {
        dbRow.user_id = record.userId || record.user_id;
      }
      dbRow.role = record.role || record.performedByRole || 'Staff';
      dbRow.action = record.action || 'UPDATE';
      dbRow.details = record.details || '';
      dbRow.site = record.site || 'All Sites';
      dbRow.module = record.module || record.entityType || record.entity_type || null;
      dbRow.entity_type = record.entityType || record.entity_type || record.module || 'General';
      dbRow.target_label = record.targetItem || record.targetLabel || null;
      const entityId = record.entityId ?? record.entity_id ?? record.targetItem;
      dbRow.entity_id = entityId !== undefined && entityId !== null ? String(entityId) : null;
      break;
    }

    case 'password_audit_logs': {
      dbRow.timestamp = record.timestamp || nowIso;
      dbRow.admin_email = record.adminEmail || record.admin_email || '';
      dbRow.target_email = record.targetEmail || record.target_email || '';
      dbRow.target_user_id = record.targetUserId || record.target_user_id || '';
      dbRow.action = record.action || 'UPDATE_PASSWORD';
      dbRow.status = record.status || 'SUCCESS';
      dbRow.error = record.error || null;
      break;
    }

    default: {
      if (!FIELD_SPECS[tableName]) {
        // Generic fallback: snake_case keys, filtered against known columns below
        for (const [k, v] of Object.entries(record)) {
          const snakeKey = k.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
          dbRow[snakeKey] = v;
        }
      }
    }
  }

  // Universal file attachments and primary generated link mapping
  if (record.attachments !== undefined) {
    let rawAtts: any[] = [];
    if (Array.isArray(record.attachments)) {
      rawAtts = record.attachments;
    } else if (typeof record.attachments === 'string' && record.attachments.trim().startsWith('[')) {
      try { rawAtts = JSON.parse(record.attachments); } catch { rawAtts = []; }
    }
    dbRow.attachments = rawAtts;
    if (rawAtts.length > 0) {
      const primaryAtt = rawAtts[0];
      const genLink = primaryAtt?.url || primaryAtt?.dataUrl || record.attachmentUrl || record.attachment_url || record.fileUrl || null;
      dbRow.attachment_url = genLink;
      dbRow.file_url = genLink;
    } else {
      dbRow.attachment_url = null;
      dbRow.file_url = null;
      // Also scrub the in-memory record so sanitizeRecord writes clean fields into the data column
      if (record.attachmentUrl) record.attachmentUrl = '';
      if (record.attachment_url) record.attachment_url = '';
      if (record.fileUrl) record.fileUrl = '';
      if (record.file_url) record.file_url = '';
      if (record.storagePath) record.storagePath = '';
      if (record.storage_path) record.storage_path = '';
    }
  } else if (record.attachmentUrl || record.attachment_url || record.fileUrl || record.file_url) {
    const link = record.attachmentUrl || record.attachment_url || record.fileUrl || record.file_url;
    dbRow.attachment_url = link;
    if (!dbRow.file_url) dbRow.file_url = link;
  }

  // Full-fidelity copy of the application record.
  if (DATA_TABLES.has(tableName)) {
    dbRow.data = sanitizeRecord(record);
  }

  // Strict column whitelist filter: drop ANY column the table does not have.
  if (validCols) {
    const finalFiltered: Record<string, any> = {};
    for (const [k, v] of Object.entries(dbRow)) {
      if (validCols.has(k) && v !== undefined) {
        finalFiltered[k] = v;
      }
    }
    return finalFiltered;
  }

  return dbRow;
}

/** Record stored in `data`, re-anchored on the row's id and timestamps; null when absent. */
function fromDataColumn(row: any): any | null {
  const data = row?.data;
  if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).length === 0) {
    return null;
  }
  return {
    ...data,
    id: row.id,
    createdAt: data.createdAt ?? row.created_at,
    updatedAt: row.updated_at ?? data.updatedAt,
  };
}

function parseJsonObject(value: any): Record<string, any> {
  if (typeof value !== 'string' || !value.trim().startsWith('{')) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function categorical(value: any, whenTrue: string, whenFalse: string, fallback: string): string {
  if (typeof value === 'string' && value !== '') return value;
  if (value === true) return whenTrue;
  if (value === false) return whenFalse;
  return fallback;
}

/**
 * Sanitize attachment fields on a converted record.
 *
 * When `attachments` is explicitly an empty array, clear any stale
 * `attachmentUrl` / `fileUrl` strings so the frontend never synthesizes
 * a phantom "DOC" badge from a lingering `data:` base64 URI or an
 * orphaned URL.
 *
 * When `attachments` has items, sync the primary URL fields to the first
 * attachment's link.
 */
function sanitizeRowAttachments(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;

  let atts = obj.attachments;
  if (typeof atts === 'string' && atts.trim().startsWith('[')) {
    try {
      atts = JSON.parse(atts);
      obj.attachments = atts;
    } catch {
      obj.attachments = [];
      atts = obj.attachments;
    }
  }

  if (Array.isArray(atts)) {
    if (atts.length === 0) {
      // Explicit empty: erase any residual URL strings
      obj.attachmentUrl = '';
      obj.attachment_url = '';
      obj.fileUrl = '';
      obj.file_url = '';
      obj.storagePath = '';
      obj.storage_path = '';
    } else {
      // Sync primary URL fields to the first attachment
      const primary = atts[0];
      const link = primary?.url || primary?.dataUrl || '';
      if (link) {
        obj.attachmentUrl = link;
        obj.attachment_url = link;
        obj.fileUrl = link;
        obj.file_url = link;
      }
    }
  } else {
    // If attachments is null/undefined, ensure it defaults to empty array
    obj.attachments = [];
    if (typeof obj.attachmentUrl === 'string' && obj.attachmentUrl.startsWith('data:')) obj.attachmentUrl = '';
    if (typeof obj.attachment_url === 'string' && obj.attachment_url.startsWith('data:')) obj.attachment_url = '';
    if (typeof obj.fileUrl === 'string' && obj.fileUrl.startsWith('data:')) obj.fileUrl = '';
    if (typeof obj.file_url === 'string' && obj.file_url.startsWith('data:')) obj.file_url = '';
  }

  // Guard against stale data: URIs or 'null'/'undefined' string values
  for (const key of ['attachmentUrl', 'attachment_url', 'fileUrl', 'file_url', 'storagePath', 'storage_path'] as const) {
    if (typeof obj[key] === 'string' && (obj[key].startsWith('data:') || obj[key] === 'null' || obj[key] === 'undefined')) {
      obj[key] = '';
    }
  }

  return obj;
}

/**
 * Converts a database row back into the rich frontend model.
 */
export function fromDatabaseRow(tableName: string, row: any): any {
  if (!row || typeof row !== 'object') return row;

  if (DATA_TABLES.has(tableName)) {
    const fromData = fromDataColumn(row);
    if (fromData) {
      if (FIELD_SPECS[tableName]) {
        const typed: Record<string, any> = {};
        for (const [field, column] of FIELD_SPECS[tableName]) {
          if (row[column] !== undefined && row[column] !== null) typed[field] = row[column];
        }
        let atts = typed.attachments !== undefined ? typed.attachments : fromData.attachments;
        if (typeof atts === 'string' && atts.trim().startsWith('[')) {
          try { atts = JSON.parse(atts); } catch { atts = []; }
        }
        const combined = {
          ...fromData,
          ...typed,
          attachments: Array.isArray(atts) ? atts : [],
          id: row.id,
          createdAt: fromData.createdAt ?? row.created_at,
          updatedAt: row.updated_at ?? fromData.updatedAt
        };
        return sanitizeRowAttachments(combined);
      }
      if (row.attachments && (!fromData.attachments || fromData.attachments.length === 0)) {
        try {
          fromData.attachments = typeof row.attachments === 'string' ? JSON.parse(row.attachments) : row.attachments;
        } catch {
          fromData.attachments = row.attachments;
        }
      }
      if (row.attachment_url && !fromData.attachmentUrl) {
        fromData.attachmentUrl = row.attachment_url;
      }
      return sanitizeRowAttachments(fromData);
    }
  }

  if (FIELD_SPECS[tableName]) {
    const obj: Record<string, any> = { id: row.id };
    for (const [field, column] of FIELD_SPECS[tableName]) {
      if (row[column] !== undefined && row[column] !== null) obj[field] = row[column];
    }
    let atts = obj.attachments;
    if (typeof atts === 'string' && atts.trim().startsWith('[')) {
      try { atts = JSON.parse(atts); } catch { atts = []; }
    }
    obj.attachments = Array.isArray(atts) ? atts : [];
    obj.createdAt = row.created_at;
    obj.updatedAt = row.updated_at;
    return sanitizeRowAttachments(obj);
  }

  switch (tableName) {
    case 'referrals': {
      const extra = parseJsonObject(row.notes);
      const result = {
        ...extra,
        id: row.id,
        site: row.site,
        serviceUserName: row.su_name,
        suName: row.su_name,
        suPortReference: row.su_port_reference || row.port_ref,
        portRef: row.port_ref || row.su_port_reference,
        roomNumber: row.room_number,
        dateReferred: row.date_referred,
        checkInDate: row.date_referred,
        referralType: row.referral_type,
        reason: row.reason,
        status: row.status,
        priority: row.priority,
        urgency: extra.urgency || row.priority || 'Medium',
        actionsTaken: row.actions_taken,
        notesActionTaken: extra.notesActionTaken || row.actions_taken || '',
        assignedTo: row.assigned_to,
        followUpDate: row.follow_up_date,
        mosaicId: extra.mosaicId || '',
        referralCouncil: extra.referralCouncil || '',
        methodOfReferral: extra.methodOfReferral || 'Mosaic Portal',
        acknowledgementReceived: categorical(extra.acknowledgementReceived, 'Yes', 'No', 'Pending'),
        responseReceivedFromLA: extra.responseReceivedFromLA || 'Awaiting Allocation',
        laOfficerLeading: extra.laOfficerLeading || '',
        officerLeadingHotel: extra.officerLeadingHotel || extra.raisedBy || '',
        raisedBy: extra.raisedBy || extra.officerLeadingHotel || '',
        sgReview: extra.sgReview || '',
        notes: extra.userNotes !== undefined ? extra.userNotes : (row.notes && !String(row.notes).startsWith('{') ? row.notes : ''),
        attachments: Array.isArray(extra.attachments) ? extra.attachments : (Array.isArray(row.attachments) ? row.attachments : []),
        createdAt: extra.createdAt || row.created_at,
        updatedAt: row.updated_at,
        createdBy: row.created_by
      };
      return sanitizeRowAttachments(result);
    }

    case 'vulnerable_residents': {
      const extra = parseJsonObject(row.medical_notes);
      const result = {
        ...extra,
        id: row.id,
        site: row.site,
        serviceUserName: row.su_name,
        suName: row.su_name,
        suPortReference: row.su_port_reference,
        portOrNassRef: row.su_port_reference || '',
        roomNumber: row.room_or_flat_no,
        roomOrFlatNo: row.room_or_flat_no || '',
        vulnerabilityCategory: row.vulnerability_category,
        vulnerability: row.vulnerability_category || '',
        riskLevel: row.risk_level || 'Medium',
        description: row.description,
        carePlanSummary: row.care_plan || row.description,
        carePlan: row.care_plan,
        notesActionTaken: row.description || '',
        sgTeamUpdate: row.care_plan || '',
        emergencyContact: row.emergency_contact,
        medicalNotes: extra._text !== undefined ? extra._text : (row.medical_notes && !String(row.medical_notes).startsWith('{') ? row.medical_notes : ''),
        status: row.status,
        lastReviewDate: row.last_review_date,
        nextReviewDate: row.next_review_date,
        reviewDate: row.next_review_date || row.last_review_date || '',
        flaggedBy: row.flagged_by,
        allocatedWorker: row.flagged_by,
        raisedBy: row.flagged_by || '',
        group: extra.group || 'Single Adult',
        gender: extra.gender || 'Prefer not to say',
        attachments: Array.isArray(extra.attachments) ? extra.attachments : [],
        createdAt: extra.createdAt || row.created_at,
        updatedAt: row.updated_at,
        createdBy: row.created_by
      };
      return sanitizeRowAttachments(result);
    }

    case 'challenging_behavior': {
      const extra = parseJsonObject(row.actions_taken);
      const plainAction = extra._text !== undefined ? extra._text : (row.actions_taken && !String(row.actions_taken).startsWith('{') ? row.actions_taken : '');
      const result = {
        ...extra,
        id: row.id,
        date: extra.date || row.date_of_incident || '',
        site: row.site,
        serviceUserName: row.name,
        name: row.name,
        suPortReference: row.port_ref,
        portRef: row.port_ref,
        roomNumber: row.room_or_flat_no,
        roomOrFlatNo: row.room_or_flat_no,
        dateOfIncident: row.date_of_incident,
        incidentDate: row.date_of_incident,
        typeOfIssue: row.type_of_issue,
        incidentType: row.type_of_issue,
        severity: row.risk_to_others,
        riskToOthers: row.risk_to_others,
        riskFactor: extra.riskFactor || row.risk_to_others || 'Medium',
        description: row.description,
        incidentDescription: row.description || '',
        policeInvolved: row.police_involved === true || row.police_involved === 'Yes',
        policeCadNumber: row.police_cad_number,
        warningIssued: row.warning_issued === true || row.warning_issued === 'Yes',
        warningLevel: row.warning_level,
        actionTaken: plainAction,
        actionsTaken: plainAction,
        status: row.status,
        loggedBy: row.logged_by,
        raisedBy: extra.raisedBy || row.logged_by || '',
        group: extra.group || 'Single Adult',
        gender: extra.gender || 'Other',
        followUpRequired: extra.followUpRequired || 'No',
        adviceGivenBySGTeam: extra.adviceGivenBySGTeam || '',
        followUpNotes: extra.followUpNotes || '',
        comments: extra.comments || '',
        reviewBySGTeam: (
          typeof extra.reviewBySGTeam === 'string' && (
            extra.reviewBySGTeam.toLowerCase().includes('hotel') ||
            extra.reviewBySGTeam.toLowerCase().includes('stansted') ||
            extra.reviewBySGTeam.toLowerCase().includes('ibis') ||
            extra.reviewBySGTeam === row.site
          )
        ) ? '' : (extra.reviewBySGTeam || ''),
        attachments: Array.isArray(extra.attachments) ? extra.attachments : (Array.isArray(row.attachments) ? row.attachments : []),
        createdAt: extra.createdAt || row.created_at,
        updatedAt: row.updated_at,
        createdBy: row.created_by
      };
      return sanitizeRowAttachments(result);
    }

    case 'maintenance_records': {
      const extra = parseJsonObject(row.notes);
      const result = {
        ...extra,
        id: row.id,
        date: row.reported_date || row.created_at?.split('T')[0] || '',
        reportedDate: row.reported_date,
        site: row.site,
        location: extra.location || row.room_or_area || '',
        room: extra.room || row.room_or_area || '',
        roomNumber: row.room_or_area,
        roomOrArea: row.room_or_area,
        status: row.defect_status,
        defectStatus: row.defect_status,
        action: extra.action || (row.defect_status === 'Completed' ? 'Closed' : 'Open'),
        progress: extra.progress || '',
        priority: row.priority || 'Normal',
        priorityTimeScale: extra.priorityTimeScale || '',
        closeDueDate: extra.closeDueDate || '',
        actualClosedDate: extra.actualClosedDate || row.completion_date || '',
        criteriaCode: extra.criteriaCode || row.category || '',
        description: row.description || '',
        allocatedContractor: row.contractor || '',
        contractor: row.contractor || '',
        costEstimate: extra.costEstimate !== undefined ? extra.costEstimate : (row.contractor_quote ? Number(row.contractor_quote) || 0 : 0),
        actualCost: extra.actualCost || 0,
        completionDate: row.completion_date,
        targetCompletionDate: extra.targetCompletionDate || row.completion_date,
        signOffStatus: row.sign_off_status,
        issueCategory: row.category,
        category: row.category,
        raisedBy: row.reported_by || '',
        reportedBy: row.reported_by || '',
        notes: extra.userNotes !== undefined ? extra.userNotes : (row.notes && !String(row.notes).startsWith('{') ? row.notes : ''),
        attachments: Array.isArray(extra.attachments) ? extra.attachments : [],
        createdAt: extra.createdAt || row.created_at,
        updatedAt: row.updated_at,
        createdBy: row.created_by
      };
      return sanitizeRowAttachments(result);
    }

    case 'spcd_records': {
      const extra = parseJsonObject(row.comments);
      const siteName = extra.siteName || extra.site || row.site_name || 'All Sites';
      const suName = extra.suName || row.su_name || extra.serviceUserName || '';
      const date = extra.date || row.declaration_date || (row.created_at ? row.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10));
      const staffReporting = extra.staffReporting || extra.raisedBy || row.officer_name || '';
      const briefDescriptionActionTaken = extra.briefDescriptionActionTaken || (typeof row.comments === 'string' && !row.comments.trim().startsWith('{') ? row.comments : '');
      const sgReview = extra.sgReview || (row.status !== 'Archived' ? row.status : 'Pending Safeguarding Lead Review') || 'Pending Safeguarding Lead Review';

      const result = {
        ...extra,
        id: row.id,
        date,
        site: siteName,
        siteName,
        roomNumber: extra.roomNumber || extra.room || '',
        staffReporting,
        raisedBy: staffReporting,
        suName,
        serviceUserName: suName,
        suPortReference: extra.suPortReference || row.su_port_reference || '',
        suDob: extra.suDob || '',
        briefDescriptionActionTaken,
        followUpNotes: extra.followUpNotes || '',
        updates: extra.updates || '',
        sgReview,
        status: sgReview,
        isArchived: extra.isArchived !== undefined ? extra.isArchived : (row.status === 'Archived'),
        dateLeft: extra.dateLeft || row.expires_date || undefined,
        reasonForLeaving: extra.reasonForLeaving || undefined,
        attachments: Array.isArray(extra.attachments) ? extra.attachments : [],
        createdAt: extra.createdAt || row.created_at,
        updatedAt: row.updated_at,
        createdBy: row.created_by,
        // Legacy compatibility
        checkDate: date,
        declarationDate: date,
        officerName: staffReporting,
        comments: typeof row.comments === 'string' && !row.comments.startsWith('{') ? row.comments : briefDescriptionActionTaken,
        observations: briefDescriptionActionTaken
      };
      return sanitizeRowAttachments(result);
    }

    case 'sites': {
      const extra = parseJsonObject(row.address);
      return {
        ...extra,
        id: row.id,
        name: row.name,
        pid: row.pid,
        code: row.pid,
        address: extra._text !== undefined ? extra._text : row.address,
        addressLine1: extra._text !== undefined ? extra._text : row.address,
        city: row.city,
        totalRooms: Number(row.total_rooms ?? 20),
        capacity: Number(row.total_rooms ?? 20),
        occupiedRooms: Number(row.active_residents || 0),
        activeResidents: Number(row.active_residents || 0),
        status: row.status,
        leadOfficer: row.manager_name,
        contactEmail: row.manager_email,
        contactNumber: row.manager_phone,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    }

    case 'laundry_logs': {
      let propMeta: any = null;
      if (typeof row.notes === 'string' && row.notes.startsWith('{') && row.notes.includes('property_laundry_log')) {
        try { propMeta = JSON.parse(row.notes); } catch {}
      }
      const isPropLog = propMeta?._type === 'property_laundry_log' || String(row.id || '').startsWith('prop-lau');

      if (isPropLog) {
        return {
          id: row.id,
          site: row.site,
          periodType: propMeta?.periodType || 'Weekly',
          periodLabel: propMeta?.periodLabel || (row.date ? `Period ending ${row.date}` : 'Weekly Log'),
          startDate: propMeta?.startDate || row.date,
          endDate: propMeta?.endDate || row.date,
          dirtyLaundrySent: Number(row.dirty_laundry_sent || 0),
          cleanLaundryReturned: Number(row.clean_laundry_returned || 0),
          discrepanciesCount: Number(row.discrepancy_count || 0),
          hasDiscrepancy: propMeta?.hasDiscrepancy ?? (Number(row.discrepancy_count || 0) > 0),
          discrepancyDetails: propMeta?.discrepancyDetails || row.discrepancies || '',
          remarksActionsTaken: row.remarks_actions_taken || '',
          loggedBy: propMeta?.loggedBy || row.staff_initials || 'Staff',
          notes: propMeta?.rawNotes || '',
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
      }

      return {
        id: row.id,
        site: row.site,
        roomNumber: row.room_no,
        roomNo: row.room_no,
        serviceUserName: row.resident_name,
        residentName: row.resident_name,
        suPortReference: row.ref,
        ref: row.ref,
        date: row.date,
        dropOffDate: row.date,
        tokensIssued: numberOrNull(row.tokens_issued),
        bagCount: numberOrNull(row.bag_count),
        dirtyLaundrySent: numberOrNull(row.dirty_laundry_sent),
        cleanLaundryReturned: numberOrNull(row.clean_laundry_returned),
        discrepancies: row.discrepancies,
        discrepancyCount: numberOrNull(row.discrepancy_count),
        remarksActionsTaken: row.remarks_actions_taken,
        status: row.status,
        staffInitials: row.staff_initials,
        notes: row.notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    }

    case 'hot_food_logs': {
      let buffetMeta: any = null;
      if (typeof row.notes === 'string' && row.notes.startsWith('{') && row.notes.includes('vendor_buffet_log')) {
        try { buffetMeta = JSON.parse(row.notes); } catch {}
      }
      const isBuffetLog = buffetMeta?._type === 'vendor_buffet_log' || String(row.id || '').startsWith('vendor-bf');

      if (isBuffetLog) {
        return {
          id: row.id,
          vendor: buffetMeta?.vendor || row.vendor_name || 'A&M',
          site: row.site,
          weekRange: buffetMeta?.weekRange || (row.date ? `Week of ${row.date}` : 'Weekly Matrix'),
          startDate: buffetMeta?.startDate || row.date,
          endDate: buffetMeta?.endDate || row.date,
          dailyCounts: buffetMeta?.dailyCounts || {},
          notes: buffetMeta?.rawNotes || '',
          updatedAt: row.updated_at,
          lastUpdatedBy: buffetMeta?.updatedBy || row.staff_name || 'Staff',
          updatedBy: buffetMeta?.updatedBy || row.staff_name || 'Staff'
        };
      }

      return {
        id: row.id,
        site: row.site,
        date: row.date,
        mealDate: row.date,
        mealType: row.meal_type,
        vendor: row.vendor_name,
        vendorName: row.vendor_name,
        supplierName: row.supplier_name,
        servings: numberOrNull(row.meals_delivered),
        mealsDelivered: numberOrNull(row.meals_delivered),
        tempCheckedCelsius: numberOrNull(row.temperature_c),
        temperatureC: numberOrNull(row.temperature_c),
        qualityCheck: row.quality_check,
        status: row.quality_check || 'Delivered',
        deliveredBy: row.staff_name,
        staffName: row.staff_name,
        staffSignoff: row.staff_signoff,
        notes: row.notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    }

    case 'escalations': {
      const extra = parseJsonObject(row.description);
      const suName = extra.suName || (row.title && row.title.includes(' - ') ? row.title.split(' - ')[0] : '') || '';
      const incidentType = extra.incidentType || (row.title && row.title.includes(' - ') ? row.title.split(' - ').slice(1).join(' - ') : row.title) || row.category || 'Safeguarding Incident';
      const personReporting = extra.personReporting || row.reported_by || '';
      const reportedAuthorities = extra.reportedAuthorities || row.assigned_to || '';
      const incidentNotes = extra.incidentNotes || (typeof row.description === 'string' && !row.description.trim().startsWith('{') ? row.description : '') || '';
      const actionTaken = extra.actionTaken || row.resolution_notes || '';
      const urgency = extra.urgency || row.severity || 'High';
      const dateOfIncident = extra.dateOfIncident || (row.created_at ? row.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10));

      const result = {
        ...extra,
        id: row.id,
        site: row.site,
        siteName: extra.siteName || row.site,
        title: incidentType,
        incidentTitle: extra.incidentTitle || incidentType,
        category: incidentType,
        incidentCategory: incidentType,
        severity: urgency,
        urgency,
        status: row.status || 'Active',
        suName,
        suPortNassRef: extra.suPortNassRef || '',
        dateOfIncident,
        dateTime: extra.dateTime || dateOfIncident,
        personReporting,
        reportedBy: personReporting,
        submittedBy: extra.submittedBy || personReporting,
        incidentType,
        wlIssued: extra.wlIssued || 'No',
        reportedAuthorities,
        assignedTo: reportedAuthorities,
        escalatedTo: extra.escalatedTo || reportedAuthorities,
        incidentNotes,
        incidentSummary: incidentNotes,
        description: incidentNotes,
        actionTaken,
        resolutionNotes: actionTaken,
        immediateAction: actionTaken,
        attachments: Array.isArray(extra.attachments) ? extra.attachments : [],
        createdAt: extra.createdAt || row.created_at,
        updatedAt: row.updated_at
      };
      return sanitizeRowAttachments(result);
    }

    case 'documents': {
      const sizeKb = parseInt(String(row.file_size || '').replace(/[^0-9]/g, ''), 10);
      let atts = row.attachments;
      if (typeof atts === 'string' && atts.trim().startsWith('[')) {
        try { atts = JSON.parse(atts); } catch { atts = []; }
      }
      return sanitizeRowAttachments({
        id: row.id,
        site: row.site,
        documentTitle: row.title,
        title: row.title,
        category: row.category,
        fileSizeKb: Number.isFinite(sizeKb) ? sizeKb : 0,
        fileSize: row.file_size,
        fileUrl: row.file_url,
        uploadedBy: row.uploaded_by,
        uploadDate: row.uploaded_date,
        uploadedDate: row.uploaded_date,
        version: row.version,
        suName: '',
        refNumber: '',
        fileFormat: 'PDF',
        confidentiality: 'Official',
        attachments: Array.isArray(atts) ? atts : [],
        createdAt: row.created_at,
        updatedAt: row.updated_at
      });
    }

    case 'profiles': {
      return {
        id: row.id,
        email: row.email,
        name: row.name,
        role: row.role,
        assignedSite: row.assigned_site || 'All Sites',
        assignedSites: [row.assigned_site || 'All Sites'],
        status: row.status || 'Active',
        lastActive: row.updated_at ? 'Recently' : 'Just now'
      };
    }

    case 'user_groups': {
      return {
        id: row.id,
        name: row.name || '',
        description: row.description || '',
        assignedProperty: row.assigned_property || (Array.isArray(row.assigned_properties) ? row.assigned_properties[0] : ''),
        assignedProperties: Array.isArray(row.assigned_properties) ? row.assigned_properties : (row.assigned_property ? [row.assigned_property] : []),
        userIds: Array.isArray(row.user_ids) ? row.user_ids : [],
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    }

    case 'data_change_requests': {
      const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
      return {
        id: row.id,
        module: row.module,
        requestType: row.action_type,
        requestedBy: row.requested_by,
        requestedByRole: payload.requestedByRole || 'Staff',
        site: row.site,
        status: row.status,
        reason: row.reason,
        recordId: payload.recordId || undefined,
        recordTitle: payload.recordTitle || '',
        proposedChanges: payload.proposedChanges || undefined,
        reviewedBy: payload.reviewedBy || undefined,
        reviewedAt: payload.reviewedAt || undefined,
        reviewNotes: payload.reviewNotes || undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    }

    case 'audit_trails': {
      return {
        id: row.id,
        timestamp: row.timestamp || row.created_at,
        action: row.action,
        module: row.module || moduleLabelFor(row.entity_type),
        targetItem: row.target_label || row.entity_id || '',
        performedByRole: row.role || 'Staff',
        performedByUser: row.user || 'Staff',
        site: row.site || 'All Sites',
        details: row.details || '',
        entityType: row.entity_type,
        entityId: row.entity_id,
        userId: row.user_id
      };
    }

    default: {
      // Generic camelCase transformation
      const obj: any = {};
      for (const [k, v] of Object.entries(row)) {
        const camelKey = k.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        obj[camelKey] = v;
      }
      return obj;
    }
  }
}
