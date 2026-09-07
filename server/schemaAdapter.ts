/**
 * Schema Adapter for SD Commercial Supabase Database
 * Converts between frontend application models and exact Supabase PostgreSQL table schemas.
 * Ensures zero data loss, exact column matching, and bidirectional mapping.
 * 
 * CANONICAL TABLES ONLY (no duplicates):
 * - laundry_logs (not laundry_records)
 * - hot_food_logs (not food_records)
 * - audit_trails (not audit_logs)
 */

// Known valid columns for each Supabase table according to schema
export const TABLE_COLUMNS: Record<string, Set<string>> = {
  referrals: new Set([
    'id', 'site', 'su_name', 'su_port_reference', 'port_ref', 'room_number',
    'date_referred', 'referral_type', 'reason', 'status', 'priority',
    'actions_taken', 'assigned_to', 'notes', 'follow_up_date',
    'created_by', 'created_at', 'updated_at'
  ]),
  vulnerable_residents: new Set([
    'id', 'site', 'su_name', 'su_port_reference', 'room_or_flat_no',
    'vulnerability_category', 'risk_level', 'description', 'care_plan',
    'emergency_contact', 'medical_notes', 'status', 'last_review_date',
    'next_review_date', 'flagged_by', 'created_by', 'created_at', 'updated_at'
  ]),
  challenging_behavior: new Set([
    'id', 'site', 'name', 'port_ref', 'room_or_flat_no',
    'date_of_incident', 'type_of_issue', 'risk_to_others', 'description',
    'police_involved', 'police_cad_number', 'warning_issued', 'warning_level',
    'actions_taken', 'status', 'logged_by', 'created_by', 'created_at', 'updated_at'
  ]),
  maintenance_records: new Set([
    'id', 'site', 'room_or_area', 'defect_status', 'description',
    'contractor', 'contractor_quote', 'priority', 'reported_date',
    'completion_date', 'sign_off_status', 'notes', 'category', 'reported_by',
    'created_by', 'created_at', 'updated_at'
  ]),
  spcd_records: new Set([
    'id', 'site_name', 'su_name', 'su_port_reference', 'check_type',
    'status', 'declaration_date', 'officer_name', 'verified', 'comments',
    'expires_date', 'created_by', 'created_at', 'updated_at'
  ]),
  sites: new Set([
    'id', 'name', 'pid', 'address', 'city', 'total_rooms', 'active_residents',
    'status', 'manager_name', 'manager_email', 'manager_phone',
    'created_by', 'created_at', 'updated_at'
  ]),
  laundry_logs: new Set([
    'id', 'site_id', 'site', 'room_no', 'resident_name', 'ref', 'date', 'tokens_issued',
    'bag_count', 'dirty_laundry_sent', 'clean_laundry_returned', 'discrepancies',
    'discrepancy_count', 'remarks_actions_taken', 'status', 'staff_initials',
    'notes', 'created_by', 'created_at', 'updated_at'
  ]),
  hot_food_logs: new Set([
    'id', 'site_id', 'site', 'date', 'meal_type', 'vendor_name', 'supplier_name',
    'meals_delivered', 'temperature_c', 'quality_check', 'staff_name',
    'staff_signoff', 'notes', 'created_by', 'created_at', 'updated_at'
  ]),
  escalations: new Set([
    'id', 'site', 'title', 'category', 'severity', 'status', 'description',
    'reported_by', 'assigned_to', 'resolution_notes',
    'created_by', 'created_at', 'updated_at'
  ]),
  documents: new Set([
    'id', 'title', 'category', 'site', 'file_url', 'file_size',
    'uploaded_by', 'uploaded_date', 'version',
    'created_by', 'created_at', 'updated_at'
  ]),
  audit_trails: new Set([
    'id', 'timestamp', 'user', 'user_id', 'role', 'action', 'details',
    'site', 'entity_type', 'entity_id', 'created_by', 'created_at', 'updated_at'
  ]),
  profiles: new Set([
    'id', 'email', 'name', 'role', 'assigned_site', 'status',
    'created_by', 'created_at', 'updated_at'
  ]),
  user_groups: new Set([
    'id', 'name', 'description', 'assigned_property', 'assigned_properties',
    'user_ids', 'created_by', 'created_at', 'updated_at'
  ]),
  data_change_requests: new Set([
    'id', 'module', 'action_type', 'requested_by', 'site', 'status',
    'payload', 'reason', 'created_by', 'created_at', 'updated_at'
  ]),
  property_user_assignments: new Set([
    'id', 'user_id', 'user_email', 'user_name', 'group_id', 'group_name',
    'property_id', 'property_name', 'role', 'assigned_properties',
    'created_by', 'created_at', 'updated_at'
  ]),
  password_audit_logs: new Set([
    'id', 'timestamp', 'admin_email', 'target_email', 'target_user_id',
    'action', 'status', 'error', 'created_by', 'created_at', 'updated_at'
  ])
};

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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function isValidUuid(val: any): boolean {
  return typeof val === 'string' && UUID_REGEX.test(val.trim());
}

/**
 * Maps a frontend record into the exact schema-compliant row for the Supabase table.
 */
export function toDatabaseRow(tableName: string, record: any, callerUserId?: string | null): Record<string, any> {
  if (!record || typeof record !== 'object') return {};
  const validCols = TABLE_COLUMNS[tableName];
  const nowIso = new Date().toISOString();
  const dbRow: Record<string, any> = {};

  // Preserve ID — profiles MUST use the auth.users UUID (never generate a random one)
  if (record.id) {
    const rawId = String(record.id).trim();
    if (tableName === 'profiles') {
      // Only accept valid UUIDs for profiles — these must come from auth.users
      if (isValidUuid(rawId)) {
        dbRow.id = rawId;
      }
      // If not a valid UUID, skip — the caller must provide a proper auth UUID
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
      dbRow.priority = record.priority || record.riskLevel || 'Normal';
      dbRow.actions_taken = record.actionsTaken || '';
      dbRow.assigned_to = record.assignedTo || record.allocatedWorker || '';
      dbRow.follow_up_date = record.followUpDate || record.expectedCheckOutDate || null;

      // Pack extra fields into notes JSON
      const extraFields = {
        gender: record.gender,
        dob: record.dob,
        ethnicity: record.ethnicity,
        countryOfOrigin: record.countryOfOrigin,
        primaryLanguage: record.primaryLanguage,
        interpreterRequired: record.interpreterRequired,
        medicalConditions: record.medicalConditions,
        dietaryRequirements: record.dietaryRequirements,
        mobilityRequirements: record.mobilityRequirements,
        riskLevel: record.riskLevel || record.urgency,
        urgency: record.urgency || record.riskLevel,
        expectedCheckOutDate: record.expectedCheckOutDate,
        actualCheckOutDate: record.actualCheckOutDate,
        acknowledgementReceived: record.acknowledgementReceived,
        mosaicId: record.mosaicId,
        raisedBy: record.raisedBy || record.officerLeadingHotel || record.reportedBy || '',
        officerLeadingHotel: record.officerLeadingHotel || record.raisedBy || '',
        referralCouncil: record.referralCouncil || '',
        methodOfReferral: record.methodOfReferral || '',
        responseReceivedFromLA: record.responseReceivedFromLA || '',
        laOfficerLeading: record.laOfficerLeading || '',
        notesActionTaken: record.notesActionTaken || record.actionsTaken || '',
        sgReview: record.sgReview || '',
        userNotes: typeof record.notes === 'string' ? record.notes : ''
      };
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
      dbRow.medical_notes = record.medicalNotes || '';
      dbRow.status = record.status || 'Active';
      dbRow.last_review_date = record.lastReviewDate || record.lastAssessmentDate || null;
      dbRow.next_review_date = record.nextReviewDate || record.reviewDate || null;
      dbRow.flagged_by = record.raisedBy || record.flaggedBy || record.allocatedWorker || record.allocatedStaff || '';
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
      dbRow.police_involved = record.policeInvolved === true || record.policeInvolved === 'Yes' || record.policeCalled === true ? 'Yes' : 'No';
      dbRow.police_cad_number = record.policeCadNumber || '';
      dbRow.warning_issued = record.warningIssued === true || record.warningIssued === 'Yes' ? 'Yes' : 'No';
      dbRow.warning_level = record.warningLevel || record.warningFlag || '';
      dbRow.actions_taken = record.actionTaken || record.actionsTaken || record.deEscalationProtocol || '';
      dbRow.status = record.status || 'Open';
      dbRow.logged_by = record.raisedBy || record.loggedBy || record.reportedBy || record.staffName || '';
      break;
    }

    case 'maintenance_records': {
      dbRow.site = record.site || record.assignedSite || record.siteName || 'All Sites';
      dbRow.room_or_area = String(record.roomNumber || record.roomOrArea || record.roomNo || 'General Area');
      dbRow.defect_status = record.status || record.defectStatus || 'Reported';
      dbRow.description = record.description || record.notes || '';
      dbRow.contractor = record.allocatedContractor || record.contractor || '';
      dbRow.contractor_quote = record.costEstimate !== undefined ? String(record.costEstimate) : (record.contractorQuote || '');
      dbRow.priority = record.priority || 'Normal';
      dbRow.reported_date = record.reportedDate || record.createdAt?.split('T')[0] || nowIso.split('T')[0];
      dbRow.completion_date = record.completionDate || record.completedDate || record.targetCompletionDate || null;
      dbRow.sign_off_status = record.signOffStatus || (record.status === 'Completed' ? 'Signed Off' : 'Pending');
      dbRow.category = record.issueCategory || record.category || 'General';
      dbRow.reported_by = record.reportedBy || record.loggedBy || '';
      
      const extraMaint = {
        actualCost: record.actualCost,
        targetCompletionDate: record.targetCompletionDate,
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
      const roomNumber = record.roomNumber || record.room || record.room_no || '';
      const staffReporting = record.staffReporting || record.raisedBy || record.officerName || record.staffName || '';
      const suDob = record.suDob || record.dob || '';
      const briefDescriptionActionTaken = record.briefDescriptionActionTaken || record.description || record.observations || record.comments || '';
      const followUpNotes = record.followUpNotes || record.notes || '';
      const updates = record.updates || '';
      const sgReview = record.sgReview || record.status || 'Pending Safeguarding Lead Review';
      const isArchived = record.isArchived === true || record.isArchived === 'true';
      const dateLeft = record.dateLeft || record.expiresDate || null;
      const reasonForLeaving = record.reasonForLeaving || null;

      const fullPayload = {
        id: record.id,
        date,
        siteName,
        site: siteName,
        roomNumber,
        staffReporting,
        raisedBy: staffReporting,
        suName,
        serviceUserName: suName,
        suPortReference,
        suDob,
        briefDescriptionActionTaken,
        followUpNotes,
        updates,
        sgReview,
        isArchived,
        dateLeft,
        reasonForLeaving
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
      dbRow.pid = record.pid || record.code || `SITE-${record.id || Math.floor(Math.random()*1000)}`;
      dbRow.address = record.address || record.addressLine1 || '';
      dbRow.city = record.city || 'London';
      dbRow.total_rooms = Number(record.totalRooms || record.capacity || 20);
      dbRow.active_residents = Number(record.activeResidents || record.occupiedRooms || 0);
      dbRow.status = record.status || 'Active';
      dbRow.manager_name = record.leadOfficer || record.managerName || '';
      dbRow.manager_email = record.contactEmail || record.managerEmail || '';
      dbRow.manager_phone = record.contactNumber || record.managerPhone || '';
      break;
    }

    case 'laundry_logs': {
      dbRow.site = record.site || record.assignedSite || 'All Sites';
      dbRow.room_no = String(record.roomNumber || record.roomNo || 'N/A');
      dbRow.resident_name = record.serviceUserName || record.residentName || record.suName || '';
      dbRow.ref = record.suPortReference || record.ref || '';
      dbRow.date = record.date || record.dropOffDate || nowIso.split('T')[0];
      // Counted quantities are attested figures — store what was supplied, or
      // NULL. Defaulting an absent count to 1 invented laundry movements that
      // nobody recorded (BUG-012).
      dbRow.tokens_issued = numberOrNull(record.tokensIssued ?? record.bagCount);
      dbRow.bag_count = numberOrNull(record.bagCount);
      dbRow.dirty_laundry_sent = numberOrNull(record.dirtyLaundrySent ?? record.bagCount);
      dbRow.clean_laundry_returned = numberOrNull(record.cleanLaundryReturned);
      dbRow.discrepancies = record.discrepancies || 'None';
      dbRow.discrepancy_count = Number(record.discrepancyCount || 0);
      dbRow.remarks_actions_taken = record.remarksActionsTaken || record.remarks || '';
      dbRow.status = record.status || 'Pending';
      dbRow.staff_initials = record.staffInitials || record.staffName || 'Staff';
      dbRow.notes = typeof record.notes === 'string' ? record.notes : '';
      break;
    }

    case 'hot_food_logs': {
      dbRow.site = record.site || record.assignedSite || 'All Sites';
      dbRow.date = record.date || record.mealDate || nowIso.split('T')[0];
      dbRow.meal_type = record.mealType || 'Dinner';
      // Attested food-safety values are never invented. Previously an absent
      // temperature was stored as 65.0 and the quality check stamped 'Passed',
      // which fabricated safety evidence nobody recorded (BUG-012). Missing
      // measurements are now persisted as NULL so an unrecorded check is
      // visibly unrecorded rather than silently passing.
      dbRow.vendor_name = record.vendorName || record.supplierName || null;
      dbRow.supplier_name = record.supplierName || record.vendorName || null;
      dbRow.meals_delivered = numberOrNull(record.mealsDelivered ?? record.mealsOrdered);
      dbRow.temperature_c = numberOrNull(record.temperatureC ?? record.temperatureReadingC);
      dbRow.quality_check = record.qualityCheck || null;
      dbRow.staff_name = record.staffName || null;
      dbRow.staff_signoff = record.staffSignoff || record.staffName || null;
      dbRow.notes = typeof record.notes === 'string' ? record.notes : '';
      break;
    }

    case 'escalations': {
      const suName = record.suName || record.name || (record.residentName || '');
      const suPortNassRef = record.suPortNassRef || record.refNumber || record.portRef || '';
      const dateOfIncident = record.dateOfIncident || (record.dateTime ? record.dateTime.slice(0, 10) : '') || record.incidentDate || (record.createdAt ? record.createdAt.slice(0, 10) : nowIso.split('T')[0]);
      const personReporting = record.personReporting || record.reportedBy || record.submittedBy || record.staffName || '';
      const incidentType = record.incidentType || record.incidentTitle || record.title || 'Safeguarding Incident';
      const wlIssued = record.wlIssued || 'No';
      const reportedAuthorities = record.reportedAuthorities || record.assignedTo || record.escalatedTo || '';
      const incidentNotes = record.incidentNotes || record.incidentSummary || record.description || record.notes || '';
      const actionTaken = record.actionTaken || record.resolutionNotes || record.immediateAction || '';
      const urgency = record.urgency || record.severity || 'High';
      const status = record.status || 'Active';
      const attachments = Array.isArray(record.attachments) ? record.attachments : [];

      const fullPayload = {
        suName,
        suPortNassRef,
        dateOfIncident,
        personReporting,
        incidentType,
        wlIssued,
        reportedAuthorities,
        incidentNotes,
        actionTaken,
        urgency,
        status,
        attachments
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
      dbRow.title = record.title || 'Document';
      dbRow.category = record.category || 'General';
      dbRow.site = record.site || 'All Sites';
      dbRow.file_url = record.fileUrl || record.storagePath || '';
      dbRow.file_size = typeof record.fileSize === 'string' ? record.fileSize : `${Math.round((record.fileSizeBytes || 1024) / 1024)} KB`;
      dbRow.uploaded_by = record.uploadedBy || 'Staff';
      dbRow.uploaded_date = record.uploadedDate || record.createdAt?.split('T')[0] || nowIso.split('T')[0];
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
      dbRow.action_type = record.actionType || record.requestType || 'UPDATE';
      dbRow.requested_by = record.requestedBy || 'Staff';
      dbRow.site = record.site || 'All Sites';
      dbRow.status = record.status || 'Pending';
      dbRow.payload = typeof record.payload === 'object' ? record.payload : (record.requestedChanges ? { changes: record.requestedChanges } : {});
      dbRow.reason = record.reason || '';
      break;
    }

    case 'audit_trails': {
      dbRow.timestamp = record.timestamp || nowIso;
      dbRow.user = record.user || record.userName || 'Staff';
      if (isValidUuid(record.userId || record.user_id)) {
        dbRow.user_id = record.userId || record.user_id;
      }
      dbRow.role = record.role || 'Staff';
      dbRow.action = record.action || 'UPDATE';
      dbRow.details = record.details || '';
      dbRow.site = record.site || 'All Sites';
      dbRow.entity_type = record.entityType || record.entity_type || 'General';
      dbRow.entity_id = record.entityId ? String(record.entityId) : null;
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
      // Generic fallback: snake_case keys and filter against valid columns if known
      for (const [k, v] of Object.entries(record)) {
        const snakeKey = k.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        if (!validCols || validCols.has(snakeKey)) {
          dbRow[snakeKey] = v;
        }
      }
    }
  }

  // Strict column whitelist filter: eliminate ANY column not present in the database table schema
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

/**
 * Converts a database row back into the rich frontend model.
 */
export function fromDatabaseRow(tableName: string, row: any): any {
  if (!row || typeof row !== 'object') return row;

  switch (tableName) {
    case 'referrals': {
      let extra: any = {};
      if (row.notes && typeof row.notes === 'string' && row.notes.startsWith('{')) {
        try { extra = JSON.parse(row.notes); } catch {}
      }
      return {
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
        gender: extra.gender || 'Unknown',
        dob: extra.dob || '',
        ethnicity: extra.ethnicity || '',
        countryOfOrigin: extra.countryOfOrigin || '',
        primaryLanguage: extra.primaryLanguage || 'English',
        interpreterRequired: extra.interpreterRequired || false,
        medicalConditions: extra.medicalConditions || [],
        dietaryRequirements: extra.dietaryRequirements || 'None',
        mobilityRequirements: extra.mobilityRequirements || 'None',
        riskLevel: extra.riskLevel || row.priority || 'Low',
        expectedCheckOutDate: extra.expectedCheckOutDate || row.follow_up_date || '',
        actualCheckOutDate: extra.actualCheckOutDate || '',
        acknowledgementReceived: extra.acknowledgementReceived !== false,
        mosaicId: extra.mosaicId || '',
        referralCouncil: extra.referralCouncil || '',
        methodOfReferral: extra.methodOfReferral || 'Mosaic Portal',
        responseReceivedFromLA: extra.responseReceivedFromLA || 'Awaiting Allocation',
        laOfficerLeading: extra.laOfficerLeading || '',
        officerLeadingHotel: extra.officerLeadingHotel || extra.raisedBy || '',
        raisedBy: extra.raisedBy || extra.officerLeadingHotel || '',
        sgReview: extra.sgReview || '',
        notes: extra.userNotes !== undefined ? extra.userNotes : (row.notes && !row.notes.startsWith('{') ? row.notes : ''),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        createdBy: row.created_by
      };
    }

    case 'vulnerable_residents': {
      return {
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
        medicalNotes: row.medical_notes,
        status: row.status,
        lastReviewDate: row.last_review_date,
        nextReviewDate: row.next_review_date,
        reviewDate: row.next_review_date || row.last_review_date || '',
        flaggedBy: row.flagged_by,
        allocatedWorker: row.flagged_by,
        raisedBy: row.flagged_by || '',
        group: 'Single Adult',
        gender: 'Female',
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        createdBy: row.created_by
      };
    }

    case 'challenging_behavior': {
      return {
        id: row.id,
        date: row.date_of_incident || '',
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
        riskFactor: row.risk_to_others || 'Medium',
        description: row.description,
        incidentDescription: row.description || '',
        policeInvolved: row.police_involved === 'Yes',
        policeCadNumber: row.police_cad_number,
        warningIssued: row.warning_issued === 'Yes',
        warningLevel: row.warning_level,
        actionTaken: row.actions_taken,
        actionsTaken: row.actions_taken,
        status: row.status,
        loggedBy: row.logged_by,
        raisedBy: row.logged_by || '',
        group: 'Single Adult',
        gender: 'Male',
        followUpRequired: 'Yes',
        adviceGivenBySGTeam: '',
        followUpNotes: '',
        comments: '',
        reviewBySGTeam: '',
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        createdBy: row.created_by
      };
    }

    case 'maintenance_records': {
      let extra: any = {};
      if (row.notes && typeof row.notes === 'string' && row.notes.startsWith('{')) {
        try { extra = JSON.parse(row.notes); } catch {}
      }
      return {
        id: row.id,
        site: row.site,
        roomNumber: row.room_or_area,
        roomOrArea: row.room_or_area,
        status: row.defect_status,
        defectStatus: row.defect_status,
        description: row.description,
        allocatedContractor: row.contractor,
        contractor: row.contractor,
        costEstimate: extra.costEstimate !== undefined ? extra.costEstimate : (row.contractor_quote ? Number(row.contractor_quote) || 0 : 0),
        actualCost: extra.actualCost || 0,
        priority: row.priority,
        reportedDate: row.reported_date,
        targetCompletionDate: extra.targetCompletionDate || row.completion_date,
        completionDate: row.completion_date,
        signOffStatus: row.sign_off_status,
        issueCategory: row.category,
        category: row.category,
        reportedBy: row.reported_by,
        notes: extra.userNotes !== undefined ? extra.userNotes : (row.notes && !row.notes.startsWith('{') ? row.notes : ''),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        createdBy: row.created_by
      };
    }

    case 'spcd_records': {
      let extra: any = {};
      if (row.comments && typeof row.comments === 'string' && row.comments.trim().startsWith('{')) {
        try { extra = JSON.parse(row.comments); } catch {}
      }

      const siteName = extra.siteName || extra.site || row.site_name || 'All Sites';
      const suName = extra.suName || row.su_name || extra.serviceUserName || '';
      const suPortReference = extra.suPortReference || row.su_port_reference || '';
      const date = extra.date || row.declaration_date || (row.created_at ? row.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10));
      const roomNumber = extra.roomNumber || extra.room || '';
      const staffReporting = extra.staffReporting || extra.raisedBy || row.officer_name || '';
      const suDob = extra.suDob || '';
      const briefDescriptionActionTaken = extra.briefDescriptionActionTaken || (typeof row.comments === 'string' && !row.comments.trim().startsWith('{') ? row.comments : '');
      const followUpNotes = extra.followUpNotes || '';
      const updates = extra.updates || '';
      const sgReview = extra.sgReview || (row.status !== 'Archived' ? row.status : 'Pending Safeguarding Lead Review') || 'Pending Safeguarding Lead Review';
      const isArchived = extra.isArchived !== undefined ? extra.isArchived : (row.status === 'Archived');
      const dateLeft = extra.dateLeft || row.expires_date || undefined;
      const reasonForLeaving = extra.reasonForLeaving || undefined;

      return {
        id: row.id,
        date,
        site: siteName,
        siteName,
        roomNumber,
        staffReporting,
        raisedBy: staffReporting,
        suName,
        serviceUserName: suName,
        suPortReference,
        suDob,
        briefDescriptionActionTaken,
        followUpNotes,
        updates,
        sgReview,
        status: sgReview,
        isArchived,
        dateLeft,
        reasonForLeaving,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        createdBy: row.created_by,
        // Legacy compatibility
        checkDate: date,
        declarationDate: date,
        officerName: staffReporting,
        comments: typeof row.comments === 'string' && !row.comments.startsWith('{') ? row.comments : briefDescriptionActionTaken,
        observations: briefDescriptionActionTaken
      };
    }

    case 'sites': {
      return {
        id: row.id,
        name: row.name,
        pid: row.pid,
        code: row.pid,
        address: row.address,
        addressLine1: row.address,
        city: row.city,
        totalRooms: Number(row.total_rooms || 20),
        capacity: Number(row.total_rooms || 20),
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
        // `Number(x || 1)` both invented a count for unrecorded rows AND turned a
        // genuine stored 0 into 1. Preserve what was recorded; null means unrecorded.
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
      return {
        id: row.id,
        site: row.site,
        date: row.date,
        mealDate: row.date,
        mealType: row.meal_type,
        vendorName: row.vendor_name,
        supplierName: row.supplier_name,
        mealsDelivered: numberOrNull(row.meals_delivered),
        mealsOrdered: numberOrNull(row.meals_delivered),
        // Previously `Number(row.temperature_c || 65.0)`: an unrecorded reading —
        // or a genuine 0 °C — was reported as a compliant 65 °C, which also
        // inflated the dashboard's food-temperature compliance figure.
        temperatureC: numberOrNull(row.temperature_c),
        qualityCheck: row.quality_check,
        temperatureCheckPassed: row.quality_check === 'Passed',
        staffName: row.staff_name,
        staffSignoff: row.staff_signoff,
        status: row.quality_check === 'Passed' ? 'Delivered' : 'Flagged',
        notes: row.notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    }

    case 'escalations': {
      let extra: any = {};
      if (row.description && typeof row.description === 'string' && row.description.trim().startsWith('{')) {
        try { extra = JSON.parse(row.description); } catch {}
      }

      const suName = extra.suName || row.su_name || (row.title && row.title.includes(' - ') ? row.title.split(' - ')[0] : '') || '';
      const suPortNassRef = extra.suPortNassRef || row.su_port_nass_ref || '';
      const dateOfIncident = extra.dateOfIncident || row.date_of_incident || (row.created_at ? row.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10));
      const personReporting = extra.personReporting || row.reported_by || '';
      const incidentType = extra.incidentType || (row.title && row.title.includes(' - ') ? row.title.split(' - ').slice(1).join(' - ') : row.title) || row.category || 'Safeguarding Incident';
      const wlIssued = extra.wlIssued || 'No';
      const reportedAuthorities = extra.reportedAuthorities || row.assigned_to || '';
      const incidentNotes = extra.incidentNotes || (typeof row.description === 'string' && !row.description.trim().startsWith('{') ? row.description : '') || '';
      const actionTaken = extra.actionTaken || row.resolution_notes || '';
      const urgency = extra.urgency || row.severity || 'High';
      const attachments = Array.isArray(extra.attachments) ? extra.attachments : [];

      return {
        id: row.id,
        site: row.site,
        siteName: row.site,
        title: incidentType,
        incidentTitle: incidentType,
        category: incidentType,
        incidentCategory: incidentType,
        severity: urgency,
        urgency,
        status: row.status || 'Active',
        suName,
        suPortNassRef,
        dateOfIncident,
        dateTime: dateOfIncident,
        personReporting,
        reportedBy: personReporting,
        submittedBy: personReporting,
        incidentType,
        wlIssued,
        reportedAuthorities,
        assignedTo: reportedAuthorities,
        escalatedTo: reportedAuthorities,
        incidentNotes,
        incidentSummary: incidentNotes,
        description: incidentNotes,
        actionTaken,
        resolutionNotes: actionTaken,
        immediateAction: actionTaken,
        attachments,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
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
