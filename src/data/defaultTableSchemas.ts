import React from 'react';
import { TableColumnConfig } from '../types/tableSchema';
import { TableAttachmentCell } from '../components/common/TableAttachmentCell';
import { 
  EscalationRecord, 
  GPAppointmentRecord, 
  RFAWelfareCheckRecord, 
  PublicTransportRecord, 
  DispersalRecord, 
  SDComplianceRecord, 
  BookletCollectionRecord, 
  SDVCSAgency,
  DocumentRecord,
  PropertyLaundryLog,
  PropertyFoodVendorBuffetLog,
  FinanceBill,
  IRRecord,
  FoodWastageRecord,
  DailyRegisterRoom,
  DailyRegisterRecord,
  NewArrivalRecord,
  EvictionRecord
} from '../types';

export const renderSchemaAttachmentCell = (val: any, row: any) =>
  React.createElement(TableAttachmentCell, {
    attachments: row?.attachments || (Array.isArray(val) ? val : undefined),
    attachmentUrl: row?.attachmentUrl || row?.attachment_url || row?.fileUrl || row?.file_url || (typeof val === 'string' ? val : undefined)
  });

export const resolveSiteOptions = (ctx: any) => {
  if (ctx?.allowedSites && Array.isArray(ctx.allowedSites) && ctx.allowedSites.length > 0) {
    return ctx.allowedSites.filter((s: string) => s && s !== 'All Sites' && s !== 'all');
  }
  if (ctx?.sites && Array.isArray(ctx.sites) && ctx.sites.length > 0) {
    return ctx.sites.map((s: any) => typeof s === 'string' ? s : s?.name).filter(Boolean);
  }
  return ['Brit Hotel', 'Holiday Inn Lambeth', 'Victoria House', 'Stansted Hotel (Ibis Budget Bisop Stortford)'];
};

export const resolveSiteDefault = (ctx: any) => {
  if (ctx?.assignedSite && ctx.assignedSite !== 'All Sites' && ctx.assignedSite !== 'all') {
    return ctx.assignedSite;
  }
  if (ctx?.allowedSites && ctx.allowedSites.length > 0 && ctx.allowedSites[0] !== 'All Sites' && ctx.allowedSites[0] !== 'all') {
    return ctx.allowedSites[0];
  }
  if (ctx?.sites && ctx.sites.length > 0) {
    const first = typeof ctx.sites[0] === 'string' ? ctx.sites[0] : ctx.sites[0]?.name;
    if (first && first !== 'All Sites') return first;
  }
  return '';
};

export const ESCALATIONS_TABLE_COLUMNS: TableColumnConfig<EscalationRecord>[] = [
  { key: 'dateOfIncident', label: 'Date of Incident', type: 'date', required: true, section: 'Incident Details' },
  { key: 'siteName', label: 'Site / Property', type: 'select', required: true, options: resolveSiteOptions, defaultValue: resolveSiteDefault, section: 'Incident Details' },
  { key: 'suName', label: 'Resident Name', type: 'text', required: true, section: 'Resident Information' },
  { key: 'suPortNassRef', label: 'Port / NASS Ref', type: 'text', section: 'Resident Information' },
  { key: 'personReporting', label: 'Submitted By', type: 'text', section: 'Incident Details' },
  { 
    key: 'incidentType', 
    label: 'Incident Type', 
    type: 'select', 
    optionCategory: 'incidentTypes',
    allowQuickAdd: true,
    options: ['Safeguarding Incident', 'Medical Emergency', 'Verbal / Physical Dispute', 'Missing Person / Absconded', 'Property Damage', 'Mental Health Crisis', 'Anti-Social Behaviour', 'Other'],
    section: 'Incident Details' 
  },
  { 
    key: 'urgency', 
    label: 'Urgency / Risk', 
    type: 'select', 
    optionCategory: 'riskLevels',
    allowQuickAdd: true,
    options: ['Critical', 'High', 'Medium', 'Low'],
    badgeColors: {
      Critical: 'bg-red-200 text-red-900 border border-red-300',
      High: 'bg-red-100 text-red-800 border border-red-200',
      Medium: 'bg-amber-100 text-amber-800 border border-amber-200',
      Low: 'bg-emerald-100 text-emerald-800 border border-emerald-200'
    },
    section: 'Incident Details'
  },
  { 
    key: 'wlIssued', 
    label: 'WL Issued', 
    type: 'select', 
    optionCategory: 'wlIssuedStatuses',
    allowQuickAdd: true,
    options: ['No', 'Yes', 'Warning Letter Issued', 'Notice to Quit', 'N/A'],
    badgeColors: {
      Yes: 'bg-red-100 text-red-800',
      'Warning Letter Issued': 'bg-amber-100 text-amber-800',
      'Notice to Quit': 'bg-purple-100 text-purple-800',
      No: 'bg-gray-100 text-gray-700',
      'N/A': 'bg-gray-100 text-gray-600'
    },
    section: 'Action & Multi-Agency'
  },
  { key: 'reportedAuthorities', label: 'Reported Authorities', type: 'text', section: 'Action & Multi-Agency' },
  { 
    key: 'status', 
    label: 'Status', 
    type: 'select', 
    optionCategory: 'escalationStatuses',
    allowQuickAdd: true,
    options: ['Active', 'Under Investigation', 'Awaiting Multi-Agency Review', 'Resolved'],
    badgeColors: {
      Active: 'bg-amber-100 text-amber-800 border border-amber-200',
      'Under Investigation': 'bg-blue-100 text-blue-800 border border-blue-200',
      'Awaiting Multi-Agency Review': 'bg-purple-100 text-purple-800 border border-purple-200',
      Resolved: 'bg-emerald-100 text-emerald-800 border border-emerald-200'
    },
    section: 'Action & Multi-Agency'
  },
  { key: 'actionTaken', label: 'Action Taken', type: 'textarea', colSpan: 2, section: 'Action & Multi-Agency' },
  { key: 'incidentNotes', label: 'Incident Notes', type: 'textarea', colSpan: 2, section: 'Incident Details' },
  { key: 'attachments' as any, label: 'Attached Files', type: 'text', section: 'Attachments & Evidence', renderCell: renderSchemaAttachmentCell }
];

export const GP_APPOINTMENTS_TABLE_COLUMNS: TableColumnConfig<GPAppointmentRecord>[] = [
  { key: 'roomNo', label: 'Room No', type: 'text', required: true, section: 'Resident & Room' },
  { key: 'portReference', label: 'Port Reference', type: 'text', required: true, section: 'Resident & Room' },
  { key: 'suName', label: 'Service User Name', type: 'text', section: 'Resident & Room' },
  { key: 'siteName', label: 'Hotel Site', type: 'select', required: true, options: resolveSiteOptions, defaultValue: resolveSiteDefault, section: 'Resident & Room' },
  { key: 'referralSentOn', label: 'Referral Sent On', type: 'date', section: 'Consultation Details' },
  { key: 'appointmentDate', label: 'Appointment Date', type: 'date', required: true, section: 'Consultation Details' },
  { key: 'timeOfGp', label: 'Time of GP', type: 'text', placeholder: '10:00', section: 'Consultation Details' },
  { 
    key: 'status', 
    label: 'Status', 
    type: 'select', 
    optionCategory: 'gpAppointmentStatuses',
    allowQuickAdd: true,
    options: ['Scheduled', 'Attended', 'Did Not Attend (DNA)', 'Cancelled', 'Rescheduled'],
    badgeColors: {
      Scheduled: 'bg-blue-100 text-blue-800 border border-blue-200',
      Attended: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
      'Did Not Attend (DNA)': 'bg-red-100 text-red-800 border border-red-200',
      Cancelled: 'bg-gray-100 text-gray-800 border border-gray-200',
      Rescheduled: 'bg-amber-100 text-amber-800 border border-amber-200'
    },
    section: 'Consultation Details'
  },
  { key: 'comments', label: 'Comments / Clinic Notes', type: 'textarea', colSpan: 2, section: 'Consultation Details' },
  { key: 'attachments' as any, label: 'Attached Files', type: 'text', section: 'Attachments & Evidence', renderCell: renderSchemaAttachmentCell }
];

export const RFA_WELFARE_TABLE_COLUMNS: TableColumnConfig<RFAWelfareCheckRecord>[] = [
  { key: 'date', label: 'Date', type: 'date', required: true, section: 'Check Details' },
  { key: 'siteName', label: 'Hotel / Site', type: 'select', required: true, options: resolveSiteOptions, defaultValue: resolveSiteDefault, section: 'Location' },
  { key: 'roomOrFlatNo', label: 'Room / Flat No', type: 'text', required: true, section: 'Location' },
  { key: 'name', label: 'Resident Name', type: 'text', required: true, section: 'Resident Details' },
  { key: 'dob', label: 'Date of Birth', type: 'date', section: 'Resident Details' },
  { 
    key: 'group', 
    label: 'Group', 
    type: 'select', 
    optionCategory: 'welfareResidentGroups',
    allowQuickAdd: true,
    options: ['Single Adult', 'Family', 'Couple', 'Vulnerable Adult'],
    section: 'Resident Details'
  },
  { 
    key: 'gender', 
    label: 'Gender', 
    type: 'select', 
    options: ['Male', 'Female', 'Other'],
    section: 'Resident Details'
  },
  { key: 'portOrNassRef', label: 'Port / NASS Ref', type: 'text', section: 'Resident Details' },
  { key: 'vulnerability', label: 'Vulnerability / Issue', type: 'text', section: 'Check Details' },
  { key: 'actionTaken', label: 'Action Taken', type: 'textarea', colSpan: 2, section: 'Check Details' },
  { key: 'mhTicket', label: 'MH Ticket Ref', type: 'text', section: 'Check Details' },
  { key: 'attachments' as any, label: 'Attached Files', type: 'text', section: 'Attachments & Evidence', renderCell: renderSchemaAttachmentCell }
];

export const PUBLIC_TRANSPORT_TABLE_COLUMNS: TableColumnConfig<PublicTransportRecord>[] = [
  { key: 'approvalUrn', label: 'Approval URN', type: 'text', required: true, section: 'Approval' },
  { key: 'suNames', label: 'Service User Name(s)', type: 'text', required: true, section: 'Traveler Details' },
  { key: 'portRefs', label: 'Port Ref(s)', type: 'text', section: 'Traveler Details' },
  { key: 'accommodationAddress', label: 'Accommodation Address', type: 'text', section: 'Traveler Details' },
  { key: 'appointmentDate', label: 'Appointment Date', type: 'date', required: true, section: 'Journey Details' },
  { key: 'appointmentTime', label: 'Appointment Time', type: 'text', section: 'Journey Details' },
  { key: 'appointmentLocation', label: 'Appointment Location', type: 'text', section: 'Journey Details' },
  { 
    key: 'modeOfTransport', 
    label: 'Mode of Transport', 
    type: 'select', 
    optionCategory: 'transportModes',
    allowQuickAdd: true,
    options: ['Bus', 'Train', 'Underground', 'Tram', 'Taxi', 'Walking'],
    badgeColors: {
      Bus: 'bg-blue-100 text-blue-800',
      Train: 'bg-purple-100 text-purple-800',
      Underground: 'bg-indigo-100 text-indigo-800',
      Tram: 'bg-teal-100 text-teal-800',
      Taxi: 'bg-amber-100 text-amber-800',
      Walking: 'bg-emerald-100 text-emerald-800'
    },
    section: 'Journey Details' 
  },
  { key: 'distanceMiles', label: 'Distance (Miles)', type: 'number', step: 0.1, section: 'Journey Details' },
  { 
    key: 'status', 
    label: 'Status', 
    type: 'select', 
    optionCategory: 'transportApprovalStatuses',
    allowQuickAdd: true,
    options: ['Approved', 'Pending', 'Completed', 'Cancelled'],
    badgeColors: {
      Approved: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
      Pending: 'bg-amber-100 text-amber-800 border border-amber-200',
      Completed: 'bg-blue-100 text-blue-800 border border-blue-200',
      Cancelled: 'bg-red-100 text-red-800 border border-red-200'
    },
    section: 'Approval' 
  },
  { key: 'exceptionalCircumstances', label: 'Exceptional Circumstances', type: 'textarea', colSpan: 2, section: 'Approval' },
  { key: 'attachments' as any, label: 'Attached Files', type: 'text', section: 'Attachments & Evidence', renderCell: renderSchemaAttachmentCell }
];

export const DISPERSAL_TABLE_COLUMNS: TableColumnConfig<DispersalRecord>[] = [
  { key: 'sno', label: 'S.No', type: 'number', section: 'Dispersal Identification' },
  { key: 'siteName', label: 'Site / Hotel', type: 'select', required: true, options: resolveSiteOptions, defaultValue: resolveSiteDefault, section: 'Dispersal Identification' },
  { key: 'flatRoomNumber', label: 'Flat / Room No', type: 'text', required: true, section: 'Dispersal Identification' },
  { key: 'suPortNassRef', label: 'SU Port / NASS Ref', type: 'text', required: true, section: 'Dispersal Identification' },
  { key: 'reasonForDeparture', label: 'Reason for Departure', type: 'text', section: 'Departure Details' },
  { key: 'dateReceived', label: 'Date Received', type: 'text', section: 'Departure Details' },
  { key: 'dispersalDate', label: 'Dispersal Date', type: 'text', section: 'Departure Details' },
  { 
    key: 'iaExitBriefingCompleted', 
    label: 'IA Exit Briefing', 
    type: 'select', 
    optionCategory: 'dispersalExitStatuses',
    allowQuickAdd: true,
    options: ['Yes', 'No'],
    badgeColors: { Yes: 'bg-emerald-100 text-emerald-800', No: 'bg-red-100 text-red-800' },
    section: 'Compliance Check' 
  },
  { 
    key: 'hoDispersalLetterReceived', 
    label: 'HO Letter Received', 
    type: 'select', 
    optionCategory: 'dispersalLetterStatuses',
    allowQuickAdd: true,
    options: ['Yes', 'No'],
    badgeColors: { Yes: 'bg-emerald-100 text-emerald-800', No: 'bg-red-100 text-red-800' },
    section: 'Compliance Check' 
  },
  { 
    key: 'travelled', 
    label: 'Travelled', 
    type: 'select', 
    optionCategory: 'dispersalTravelStatuses',
    allowQuickAdd: true,
    options: ['Yes', 'No'],
    badgeColors: { Yes: 'bg-emerald-100 text-emerald-800', No: 'bg-red-100 text-red-800' },
    section: 'Departure Details' 
  },
  { key: 'dateLeftProperty', label: 'Date Left Property', type: 'text', section: 'Departure Details' },
  { 
    key: 'incidentWarningCompleted', 
    label: 'Incident Warning', 
    type: 'select', 
    optionCategory: 'dispersalWarningStatuses',
    allowQuickAdd: true,
    options: ['Yes', 'No', 'No need'],
    section: 'Compliance Check' 
  },
  { key: 'reasonFailedToTravel', label: 'Reason Failed to Travel', type: 'textarea', colSpan: 2, section: 'Exceptions' },
  { key: 'secondDispersalDate', label: '2nd Dispersal Date', type: 'text', section: '2nd Dispersal Cycle' },
  { key: 'attachments' as any, label: 'Attached Files', type: 'text', section: 'Attachments & Evidence', renderCell: renderSchemaAttachmentCell }
];

export const SD_COMPLIANCE_TABLE_COLUMNS: TableColumnConfig<SDComplianceRecord>[] = [
  { key: 'srNo', label: 'Sr No', type: 'number', section: 'Audit' },
  { 
    key: 'complianceType', 
    label: 'Compliance Type', 
    type: 'select', 
    optionCategory: 'complianceTypes',
    allowQuickAdd: true,
    options: [
      'Fire Risk Assessment (FRA)',
      'Gas Safety Certificate (CP12)',
      'Electrical Installation Condition Report (EICR)',
      'Emergency Lighting Testing',
      'Fire Alarm & Detection Inspection',
      'Legionella Risk Assessment (LRA)',
      'PAT Testing',
      'Asbestos Management Survey',
      'Lift Inspection (LOLER)',
      'Building Insurance Certificate'
    ],
    required: true,
    section: 'Certification'
  },
  { key: 'siteName', label: 'Site / Hotel', type: 'select', required: true, options: resolveSiteOptions, defaultValue: resolveSiteDefault, section: 'Certification' },
  { key: 'contractorName', label: 'Contractor Name', type: 'text', required: true, section: 'Contractor Information' },
  { key: 'contractorKeyContact', label: 'Contractor Contact', type: 'text', section: 'Contractor Information' },
  { key: 'contractorEmail', label: 'Contractor Email', type: 'text', section: 'Contractor Information' },
  { key: 'issuedDate', label: 'Issued Date', type: 'date', required: true, section: 'Validity & Schedule' },
  { key: 'expiryDate', label: 'Expiry Date', type: 'date', required: true, section: 'Validity & Schedule' },
  { 
    key: 'status', 
    label: 'Status', 
    type: 'select', 
    optionCategory: 'complianceStatuses',
    allowQuickAdd: true,
    options: ['Compliant', 'Expiring Soon', 'Expired', 'In Progress', 'Overdue'],
    badgeColors: {
      Compliant: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
      'Expiring Soon': 'bg-amber-100 text-amber-800 border border-amber-200',
      Expired: 'bg-red-100 text-red-800 border border-red-200',
      'In Progress': 'bg-blue-100 text-blue-800 border border-blue-200',
      Overdue: 'bg-red-200 text-red-900 border border-red-300'
    },
    section: 'Validity & Schedule'
  },
  { key: 'actionTaken', label: 'Action Taken', type: 'textarea', colSpan: 2, section: 'Validity & Schedule' },
  { key: 'previousContractor', label: 'Previous Contractor', type: 'text', section: 'Contractor Information' },
  { key: 'attachments' as any, label: 'Attached Files', type: 'text', section: 'Attachments & Evidence', renderCell: renderSchemaAttachmentCell }
];

export const BOOKLETS_TABLE_COLUMNS: TableColumnConfig<BookletCollectionRecord>[] = [
  { key: 'hotelName', label: 'Hotel / Site', type: 'select', required: true, options: resolveSiteOptions, defaultValue: resolveSiteDefault, section: 'Location & Agent' },
  { key: 'agentName', label: 'Agent / Provider', type: 'text', required: true, section: 'Location & Agent' },
  { key: 'bookletType', label: 'Booklet Type', type: 'text', required: true, section: 'Booklet Details' },
  { key: 'language', label: 'Language', type: 'text', required: true, section: 'Booklet Details' },
  { key: 'numberForCollection', label: 'Target / To Collect', type: 'number', required: true, section: 'Quantities' },
  { key: 'collectedBooklets', label: 'Collected Booklets', type: 'number', section: 'Quantities' },
  { key: 'bookletsReceived', label: 'Booklets Received', type: 'number', section: 'Quantities' },
  { 
    key: 'status', 
    label: 'Status', 
    type: 'select', 
    optionCategory: 'bookletStatuses',
    allowQuickAdd: true,
    options: ['Pending Collection', 'Partially Collected', 'Received at Site'],
    badgeColors: {
      'Pending Collection': 'bg-amber-100 text-amber-800 border border-amber-200',
      'Partially Collected': 'bg-blue-100 text-blue-800 border border-blue-200',
      'Received at Site': 'bg-emerald-100 text-emerald-800 border border-emerald-200'
    },
    section: 'Quantities'
  },
  { key: 'notes', label: 'Notes', type: 'textarea', colSpan: 2, section: 'Booklet Details' },
  { key: 'attachments' as any, label: 'Attached Files', type: 'text', section: 'Attachments & Evidence', renderCell: renderSchemaAttachmentCell }
];

export const VCS_AGENCIES_TABLE_COLUMNS: TableColumnConfig<SDVCSAgency>[] = [
  { key: 'agencyName', label: 'Agency / Organization', type: 'text', required: true, section: 'Organization' },
  { 
    key: 'category', 
    label: 'Category', 
    type: 'select', 
    optionCategory: 'vcsCategories',
    allowQuickAdd: true,
    options: [
      'Charity & Welfare',
      'Food & Nutrition',
      'Family & Children',
      'ESOL & Education',
      'Faith & Community',
      'Advocacy & Legal',
      'Statutory / Council'
    ],
    required: true,
    section: 'Organization'
  },
  { key: 'hotelName', label: 'Hotel / Site', type: 'select', required: true, options: resolveSiteOptions, defaultValue: resolveSiteDefault, section: 'Organization' },
  { key: 'servicesProvided', label: 'Services Provided', type: 'text', required: true, section: 'Services & Support' },
  { key: 'contactPerson', label: 'Contact Person', type: 'text', section: 'Contact Details' },
  { key: 'contactNumber', label: 'Contact Number', type: 'text', section: 'Contact Details' },
  { key: 'email', label: 'Email Address', type: 'text', section: 'Contact Details' },
  { key: 'address', label: 'Address', type: 'text', section: 'Contact Details' },
  { key: 'notes', label: 'Notes', type: 'textarea', colSpan: 2, section: 'Services & Support' },
  { key: 'attachments' as any, label: 'Attached Files', type: 'text', section: 'Attachments & Evidence', renderCell: renderSchemaAttachmentCell }
];

export const DOCUMENTS_TABLE_COLUMNS: TableColumnConfig<DocumentRecord>[] = [
  { key: 'documentTitle', label: 'Document Title', type: 'text', required: true, section: 'Document Info' },
  { key: 'site', label: 'Hotel / Site', type: 'select', required: true, options: resolveSiteOptions, defaultValue: resolveSiteDefault, section: 'Document Info' },
  { key: 'suName', label: 'Resident Name', type: 'text', section: 'Resident Association' },
  { key: 'refNumber', label: 'Port Ref', type: 'text', section: 'Resident Association' },
  { 
    key: 'category', 
    label: 'Category', 
    type: 'select', 
    optionCategory: 'documentCategories',
    allowQuickAdd: true,
    options: [
      'Risk Assessment',
      'Incident Report',
      'Medical Assessment',
      'Safeguarding Dossier',
      'Police Report',
      'Compliance Certificate',
      'Legal Notice'
    ],
    section: 'Document Info'
  },
  { 
    key: 'fileFormat', 
    label: 'Format', 
    type: 'select', 
    optionCategory: 'fileFormats',
    allowQuickAdd: true,
    options: ['PDF', 'DOCX', 'XLSX', 'JPG', 'PNG'],
    section: 'File Details'
  },
  { 
    key: 'confidentiality', 
    label: 'Confidentiality', 
    type: 'select', 
    optionCategory: 'documentConfidentialities',
    allowQuickAdd: true,
    options: ['General', 'Restricted', 'Strictly Confidential'],
    badgeColors: {
      General: 'bg-blue-100 text-blue-800',
      Restricted: 'bg-amber-100 text-amber-800',
      'Strictly Confidential': 'bg-red-100 text-red-800'
    },
    section: 'Security & Access'
  },
  { key: 'uploadedBy', label: 'Uploaded By', type: 'text', section: 'Audit' },
  { key: 'uploadDate', label: 'Upload Date', type: 'date', section: 'Audit' },
  { key: 'notes', label: 'Notes', type: 'textarea', colSpan: 2, section: 'Document Info' },
  { key: 'attachments' as any, label: 'Attached Files', type: 'text', section: 'Attachments & Evidence', renderCell: renderSchemaAttachmentCell }
];

export const PROPERTY_LAUNDRY_TABLE_COLUMNS: TableColumnConfig<PropertyLaundryLog>[] = [
  { key: 'site', label: 'Property / Hotel', type: 'select', required: true, options: resolveSiteOptions, defaultValue: resolveSiteDefault, section: 'Property & Period' },
  { 
    key: 'periodType', 
    label: 'Log Type', 
    type: 'select', 
    optionCategory: 'laundryPeriodTypes',
    allowQuickAdd: true,
    options: ['Weekly', 'Monthly'], 
    defaultValue: 'Weekly', 
    badgeColors: {
      Weekly: 'bg-teal-100 text-teal-900 border border-teal-200',
      Monthly: 'bg-purple-100 text-purple-900 border border-purple-200'
    },
    section: 'Property & Period' 
  },
  { key: 'periodLabel', label: 'Log Period', type: 'text', required: true, section: 'Property & Period' },
  { key: 'dirtyLaundrySent', label: 'Dirty Laundry Sent', type: 'number', required: true, section: 'Intake Figures' },
  { key: 'cleanLaundryReturned', label: 'Clean Laundry Returned', type: 'number', required: true, section: 'Intake Figures' },
  { key: 'discrepanciesCount', label: 'Discrepancies', type: 'number', section: 'Variance & Reconciliations' },
  { 
    key: 'hasDiscrepancy', 
    label: 'Discrepancy Status', 
    type: 'select', 
    optionCategory: 'discrepancyStatuses',
    allowQuickAdd: true,
    options: ['No', 'Yes'], 
    badgeColors: {
      Yes: 'bg-amber-100 text-amber-900 border border-amber-300',
      No: 'bg-emerald-50 text-emerald-800 border border-emerald-200'
    },
    section: 'Variance & Reconciliations' 
  },
  { key: 'discrepancyDetails', label: 'Discrepancy Details', type: 'textarea', colSpan: 2, section: 'Variance & Reconciliations' },
  { key: 'remarksActionsTaken', label: 'Remarks / Actions Taken', type: 'textarea', colSpan: 2, section: 'Variance & Reconciliations' },
  { key: 'loggedBy', label: 'Staff / Auditor', type: 'text', section: 'Audit Information' },
  { key: 'startDate', label: 'Date From', type: 'date', section: 'Period Dates' },
  { key: 'endDate', label: 'Date To', type: 'date', section: 'Period Dates' },
  { key: 'attachments' as any, label: 'Attached Files', type: 'text', section: 'Attachments & Evidence', renderCell: renderSchemaAttachmentCell }
];

export const FOOD_VENDOR_BUFFET_TABLE_COLUMNS: TableColumnConfig<PropertyFoodVendorBuffetLog>[] = [
  { 
    key: 'vendor', 
    label: 'Food Vendor', 
    type: 'select', 
    optionCategory: 'foodVendors',
    allowQuickAdd: true,
    required: true, 
    options: ['A&M', 'Freshbite', '9 Cuisines', 'Sands'],
    defaultValue: 'A&M',
    badgeColors: {
      'A&M': 'bg-orange-100 text-orange-900 border border-orange-200',
      'Freshbite': 'bg-emerald-100 text-emerald-900 border border-emerald-200',
      '9 Cuisines': 'bg-blue-100 text-blue-900 border border-blue-200',
      'Sands': 'bg-purple-100 text-purple-900 border border-purple-200'
    },
    section: 'Vendor & Property'
  },
  { key: 'site', label: 'Property / Hotel', type: 'select', required: true, options: resolveSiteOptions, defaultValue: resolveSiteDefault, section: 'Vendor & Property' },
  { key: 'weekRange', label: 'Week Range', type: 'text', required: true, section: 'Schedule Details' },
  { key: 'startDate', label: 'Date From', type: 'date', required: true, section: 'Schedule Details' },
  { key: 'endDate', label: 'Date To', type: 'date', required: true, section: 'Schedule Details' },
  { key: 'notes', label: 'Compliance & Quality Notes', type: 'textarea', colSpan: 2, section: 'Audit & Compliance' },
  { key: 'lastUpdatedBy', label: 'Audited By', type: 'text', section: 'Audit & Compliance' },
  { key: 'attachments' as any, label: 'Attached Files', type: 'text', section: 'Attachments & Evidence', renderCell: renderSchemaAttachmentCell }
];

export const FINANCE_STATUS_BADGE_CLASSES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700 border-gray-300',
  submitted: 'bg-purple-100 text-purple-800 border-purple-300',
  under_review: 'bg-blue-100 text-blue-800 border-blue-300',
  verification_pending: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  query_raised: 'bg-amber-100 text-amber-800 border-amber-300',
  awaiting_approval: 'bg-violet-100 text-violet-800 border-violet-300',
  approved: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  rejected: 'bg-rose-100 text-rose-800 border-rose-300',
  payment_pending: 'bg-sky-100 text-sky-800 border-sky-300',
  partially_paid: 'bg-cyan-100 text-cyan-800 border-cyan-300',
  paid: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  reconciliation_pending: 'bg-orange-100 text-orange-800 border-orange-300',
  reconciled: 'bg-teal-100 text-teal-800 border-teal-300',
  cancelled: 'bg-gray-200 text-gray-600 border-gray-400'
};

export const FINANCE_INVOICES_TABLE_COLUMNS: TableColumnConfig<FinanceBill>[] = [
  { key: 'billNumber', label: 'Bill / Invoice #', type: 'text', required: true, section: 'Invoice Details' },
  { key: 'siteId', label: 'Site / Property', type: 'select', required: true, options: resolveSiteOptions, defaultValue: resolveSiteDefault, section: 'Property & Supplier' },
  { key: 'vendorName' as any, label: 'Supplier / Vendor', type: 'text', section: 'Property & Supplier' },
  { key: 'purchaseReference', label: 'PO / Ref #', type: 'text', section: 'Invoice Details' },
  { key: 'billDate', label: 'Invoice Date', type: 'date', required: true, section: 'Schedule & Amounts' },
  { key: 'dueDate', label: 'Due Date', type: 'date', section: 'Schedule & Amounts' },
  { key: 'subtotal', label: 'Subtotal (£)', type: 'number', section: 'Schedule & Amounts' },
  { key: 'taxAmount', label: 'VAT / Tax (£)', type: 'number', section: 'Schedule & Amounts' },
  { key: 'totalAmount', label: 'Total (£)', type: 'number', required: true, section: 'Schedule & Amounts' },
  { 
    key: 'status', 
    label: 'Status', 
    type: 'select', 
    options: ['draft', 'submitted', 'under_review', 'verification_pending', 'query_raised', 'awaiting_approval', 'approved', 'rejected', 'payment_pending', 'partially_paid', 'paid', 'reconciled', 'cancelled'],
    badgeColors: FINANCE_STATUS_BADGE_CLASSES,
    section: 'Status & Governance'
  },
  { key: 'submitterName' as any, label: 'Submitted By', type: 'text', section: 'Status & Governance' },
  { key: 'finalApprovedByName' as any, label: 'Finance Sign-off', type: 'text', section: 'Status & Governance' }
];

export const FINANCE_CREDIT_CARD_TABLE_COLUMNS: TableColumnConfig<FinanceBill>[] = [
  { key: 'billNumber', label: 'Receipt / Ref #', type: 'text', section: 'Details' },
  { key: 'siteId', label: 'Site / Property', type: 'select', required: true, options: resolveSiteOptions, defaultValue: resolveSiteDefault, section: 'Location' },
  { key: 'vendorName' as any, label: 'Merchant / Store', type: 'text', section: 'Merchant' },
  { key: 'billDate', label: 'Transaction Date', type: 'date', required: true, section: 'Details' },
  { key: 'totalAmount', label: 'Amount (£)', type: 'number', required: true, section: 'Details' },
  { key: 'description', label: 'Expense Reason', type: 'textarea', colSpan: 2, section: 'Details' },
  { 
    key: 'status', 
    label: 'Status', 
    type: 'select', 
    options: ['draft', 'submitted', 'under_review', 'query_raised', 'awaiting_approval', 'approved', 'rejected', 'paid', 'reconciled'],
    badgeColors: FINANCE_STATUS_BADGE_CLASSES,
    section: 'Governance'
  },
  { key: 'submitterName' as any, label: 'Cardholder / Staff', type: 'text', section: 'Governance' }
];

export const FINANCE_DELIVERY_NOTES_TABLE_COLUMNS: TableColumnConfig<FinanceBill>[] = [
  { key: 'billNumber', label: 'Delivery Note #', type: 'text', required: true, section: 'Delivery Details' },
  { key: 'siteId', label: 'Delivery Site', type: 'select', required: true, options: resolveSiteOptions, defaultValue: resolveSiteDefault, section: 'Location' },
  { key: 'vendorName' as any, label: 'Supplier / Courier', type: 'text', section: 'Delivery Details' },
  { key: 'purchaseReference', label: 'PO Reference', type: 'text', section: 'Delivery Details' },
  { key: 'billDate', label: 'Delivery Date', type: 'date', required: true, section: 'Delivery Details' },
  { key: 'totalAmount', label: 'Invoice Value (£)', type: 'number', section: 'Details' },
  { 
    key: 'status', 
    label: 'Verification Status', 
    type: 'select', 
    options: ['submitted', 'under_review', 'verification_pending', 'query_raised', 'awaiting_approval', 'approved', 'reconciled'],
    badgeColors: FINANCE_STATUS_BADGE_CLASSES,
    section: 'Verification'
  },
  { key: 'submitterName' as any, label: 'Received By', type: 'text', section: 'Verification' },
  { key: 'description', label: 'Goods / Condition Notes', type: 'textarea', colSpan: 2, section: 'Delivery Details' }
];

export const FINANCE_APPROVALS_TABLE_COLUMNS: TableColumnConfig<FinanceBill>[] = [
  { key: 'billNumber', label: 'Bill Reference', type: 'text', required: true, section: 'Invoice Details' },
  { key: 'siteId', label: 'Property / Site', type: 'select', required: true, options: resolveSiteOptions, defaultValue: resolveSiteDefault, section: 'Property' },
  { key: 'vendorName' as any, label: 'Payee / Vendor', type: 'text', section: 'Payee' },
  { key: 'billType', label: 'Type', type: 'text', section: 'Invoice Details' },
  { key: 'billDate', label: 'Bill Date', type: 'date', section: 'Schedule' },
  { key: 'dueDate', label: 'Due Date', type: 'date', section: 'Schedule' },
  { key: 'totalAmount', label: 'Payable (£)', type: 'number', required: true, section: 'Amounts' },
  { 
    key: 'status', 
    label: 'Workflow Stage', 
    type: 'select', 
    options: ['submitted', 'under_review', 'verification_pending', 'query_raised', 'awaiting_approval', 'approved', 'rejected'],
    badgeColors: FINANCE_STATUS_BADGE_CLASSES,
    section: 'Approval Status'
  },
  { key: 'submitterName' as any, label: 'Submitted By', type: 'text', section: 'Submitter' },
  { key: 'finalApprovedByName' as any, label: 'Approved By', type: 'text', section: 'Approval Status' }
];

export const IR_TRACKER_TABLE_COLUMNS: TableColumnConfig<IRRecord>[] = [
  { key: 'site', label: 'SITE', type: 'select', required: true, options: resolveSiteOptions, defaultValue: resolveSiteDefault, section: 'Incident Information' },
  { key: 'date', label: 'DATE', type: 'date', required: true, section: 'Incident Information' },
  { key: 'suName', label: 'SU NAME', type: 'text', required: true, section: 'Incident Information' },
  { key: 'portRef', label: 'Port Ref', type: 'text', section: 'Incident Information' },
  { key: 'incidentTime', label: 'Incident Time', type: 'text', placeholder: 'HH:MM e.g. 14:30', section: 'Incident Information' },
  { key: 'irSummary', label: 'IR SUMMARY', type: 'textarea', required: true, colSpan: 2, section: 'Incident Information' },
  { key: 'inFor1stReview', label: 'IN for 1st review', type: 'text', placeholder: 'YYYY-MM-DD HH:MM', section: 'First Review' },
  { key: 'ct1stReview', label: 'CT 1ST Review', type: 'text', placeholder: 'YYYY-MM-DD HH:MM', section: 'First Review' },
  { key: 'inFor2ndReview', label: 'In for 2nd review', type: 'text', placeholder: 'YYYY-MM-DD HH:MM', section: 'Second Review' },
  { key: 'ct2ndReview', label: 'CT 2nd review', type: 'text', placeholder: 'YYYY-MM-DD HH:MM', section: 'Second Review' },
  { 
    key: 'submittedToCrh', 
    label: 'Submitted to CRH', 
    type: 'select', 
    optionCategory: 'crhSubmissionStatuses',
    allowQuickAdd: true,
    options: ['Pending', 'Submitted', 'Under Review', 'CRH Approved', 'CRH Rejected', 'Not Applicable'],
    badgeColors: {
      'Submitted': 'bg-blue-100 text-blue-800 border border-blue-200',
      'CRH Approved': 'bg-emerald-100 text-emerald-800 border border-emerald-200',
      'Pending': 'bg-amber-100 text-amber-800 border border-amber-200',
      'Under Review': 'bg-purple-100 text-purple-800 border border-purple-200',
      'CRH Rejected': 'bg-red-100 text-red-800 border border-red-200',
      'Not Applicable': 'bg-gray-100 text-gray-700'
    },
    section: 'CRH Submission & Attachments'
  },
  { key: 'attachments' as any, label: 'Attached Files', type: 'text', section: 'CRH Submission & Attachments', renderCell: renderSchemaAttachmentCell }
];

export const FOOD_WASTAGE_TABLE_COLUMNS: TableColumnConfig<FoodWastageRecord>[] = [
  { key: 'site', label: 'SITE', type: 'select', required: true, options: resolveSiteOptions, defaultValue: resolveSiteDefault, section: 'Wastage Information' },
  { key: 'date', label: 'DATE', type: 'date', required: true, section: 'Wastage Information' },
  { key: 'foodWastage', label: 'FOOD WASTAGE', type: 'text', required: true, placeholder: 'e.g. Unserved lunch buffet, Spoilage, Over-order', section: 'Wastage Information' },
  { key: 'quantity', label: 'QUANTITY', type: 'text', required: true, placeholder: 'e.g. 5 kg, 12 portions, 3 trays', section: 'Wastage Information' },
  { key: 'comments', label: 'COMMENTS', type: 'textarea', colSpan: 2, section: 'Wastage Information' },
  { key: 'attachments' as any, label: 'Attached Files', type: 'text', section: 'Wastage Information', renderCell: renderSchemaAttachmentCell }
];

export const ROOM_LIST_TABLE_COLUMNS: TableColumnConfig<DailyRegisterRoom>[] = [
  { key: 'date', label: 'Date', type: 'date', section: 'Room Inventory' },
  { key: 'hotel', label: 'Hotel', type: 'select', required: true, options: resolveSiteOptions, defaultValue: resolveSiteDefault, section: 'Room Inventory' },
  { key: 'roomNo', label: 'Room No.', type: 'text', required: true, section: 'Room Inventory' },
  { key: 'floor', label: 'Floor', type: 'text', section: 'Room Inventory' },
  { key: 'roomType', label: 'Room Type', type: 'select', options: ['Single', 'Double', 'Twin', 'Family', 'Accessible', 'Studio'], section: 'Room Inventory' },
  { key: 'currentMaxOccupancy', label: 'Current Max Occupancy', type: 'number', section: 'Occupancy & Bedspaces' },
  { key: 'currentOccupancy', label: 'Current Occupancy', type: 'number', section: 'Occupancy & Bedspaces' },
  { key: 'suCohort', label: 'SU Cohort', type: 'select', options: ['Single Male', 'Single Female', 'Family', 'Couples', 'Mother & Baby', 'Vulnerable Adult'], section: 'Occupancy & Bedspaces' },
  { key: 'bedspacesAvailable', label: 'Bedspaces Available', type: 'number', section: 'Occupancy & Bedspaces' },
  { key: 'voidBedspaces', label: 'Void Bedspaces', type: 'number', section: 'Void Status' },
  { key: 'voidReason', label: 'Void Reason', type: 'textarea', section: 'Void Status' },
  { key: 'sizeSqm', label: 'Size of Room (sq. metre, excluding bathroom)', type: 'number', section: 'Capacity & Physical Specifications' },
  { key: 'maxRoomType', label: 'Max Room Type (Room Size & Inventory)', type: 'text', section: 'Capacity & Physical Specifications' },
  { key: 'potentialMaxCapacity', label: 'Potential Max Capacity', type: 'number', section: 'Capacity & Physical Specifications' },
  { key: 'stepsToIncreaseCapacity', label: 'Steps to Increase Capacity', type: 'textarea', colSpan: 2, section: 'Capacity & Physical Specifications' }
];

export const DAILY_REGISTER_TABLE_COLUMNS: TableColumnConfig<DailyRegisterRecord>[] = [
  { key: 'roomNo', label: 'Room No.', type: 'text', required: true, section: 'Room & Beds' },
  { key: 'floor', label: 'Floor', type: 'text', section: 'Room & Beds' },
  { key: 'roomMakeup', label: 'Room Makeup', type: 'text', section: 'Room & Beds' },
  { key: 'singleBed', label: 'Single Bed', type: 'number', section: 'Room & Beds' },
  { key: 'doubleBed', label: 'Double Bed', type: 'number', section: 'Room & Beds' },
  { key: 'singleBunk', label: 'Single Bunk', type: 'number', section: 'Room & Beds' },
  { key: 'doubleBunk', label: 'Double Bunk', type: 'number', section: 'Room & Beds' },
  { key: 'cot', label: 'Cot', type: 'number', section: 'Room & Beds' },
  { key: 'suMakeup', label: 'SU Make Up', type: 'text', section: 'Resident Profile' },
  { key: 'portRef', label: 'Port Ref', type: 'text', required: true, section: 'Resident Profile' },
  { key: 'name', label: 'Name', type: 'text', required: true, section: 'Resident Profile' },
  { key: 'checkInDate', label: 'Check In Date', type: 'date', required: true, section: 'Resident Profile' },
  { key: 'contactNo', label: 'Contact No.', type: 'text', section: 'Resident Profile' },
  { key: 'email', label: 'Email', type: 'text', section: 'Resident Profile' },
  { key: 'dob', label: 'D.O.B.', type: 'date', section: 'Demographics' },
  { key: 'age', label: 'Age', type: 'number', section: 'Demographics' },
  { key: 'ageGroup', label: 'Age Group', type: 'select', options: ['0-17', '18-25', '26-40', '41-60', '60+'], section: 'Demographics' },
  { key: 'nationality', label: 'Nationality', type: 'text', section: 'Demographics' },
  { key: 'language', label: 'Language', type: 'text', section: 'Demographics' },
  { key: 'gender', label: 'Gender', type: 'select', options: ['Male', 'Female', 'Other', 'Prefer not to say'], section: 'Demographics' },
  { key: 'suComments', label: 'SU Comments', type: 'textarea', colSpan: 2, section: 'Operational Notes' },
  { key: 'availableToBook', label: 'Available to Book', type: 'select', options: ['Yes', 'No'], section: 'Occupancy Controls' },
  { key: 'isVoid', label: 'Void', type: 'select', options: ['Yes', 'No'], section: 'Occupancy Controls' },
  { key: 'voidReason', label: 'Void Reason', type: 'text', section: 'Occupancy Controls' },
  { key: 'maintenanceDateFrom', label: 'Maintenance Date From', type: 'date', section: 'Occupancy Controls' },
  { key: 'allocationToBeReviewed', label: 'Allocation to be Reviewed', type: 'select', options: ['Yes', 'No'], section: 'Occupancy Controls' },
  { key: 'occupied', label: 'Occupied', type: 'select', options: ['Yes', 'No'], required: true, section: 'Occupancy Controls' }
];

export const NEW_ARRIVALS_TABLE_COLUMNS: TableColumnConfig<NewArrivalRecord>[] = [
  { key: 'portReference', label: 'Port Reference', type: 'text', required: true, section: 'Arrival Information' },
  { key: 'name', label: 'Name', type: 'text', required: true, section: 'Arrival Information' },
  { key: 'dob', label: 'Date of Birth', type: 'date', section: 'Arrival Information' },
  { key: 'country', label: 'Country', type: 'text', section: 'Arrival Information' },
  { key: 'language', label: 'Language', type: 'text', section: 'Arrival Information' },
  { key: 'contactNumber', label: 'Contact Number', type: 'text', section: 'Arrival Information' },
  { key: 'hotel', label: 'Hotel', type: 'select', required: true, options: resolveSiteOptions, defaultValue: resolveSiteDefault, section: 'Allocation' },
  { key: 'room', label: 'Room', type: 'text', section: 'Allocation' },
  { key: 'email', label: 'Email', type: 'text', section: 'Allocation' },
  { key: 'aspenCard', label: 'Aspen Card', type: 'text', section: 'Allocation' },
  { 
    key: 'status', 
    label: 'Arrival Status', 
    type: 'select', 
    options: ['Arrived', 'Pending Room Assignment', 'Checked In', 'Transferred', 'Cancelled'],
    badgeColors: {
      'Arrived': 'bg-blue-100 text-blue-800',
      'Pending Room Assignment': 'bg-amber-100 text-amber-800',
      'Checked In': 'bg-emerald-100 text-emerald-800',
      'Transferred': 'bg-purple-100 text-purple-800',
      'Cancelled': 'bg-gray-100 text-gray-700'
    },
    section: 'Allocation' 
  }
];

export const EVICTION_TABLE_COLUMNS: TableColumnConfig<EvictionRecord>[] = [
  { key: 'hotel', label: 'Hotel', type: 'select', required: true, options: resolveSiteOptions, defaultValue: resolveSiteDefault, section: 'Eviction Details' },
  { key: 'roomNo', label: 'Room No.', type: 'text', section: 'Eviction Details' },
  { key: 'portRef', label: 'Port Ref', type: 'text', required: true, section: 'Resident Details' },
  { key: 'suName', label: 'SU Name', type: 'text', required: true, section: 'Resident Details' },
  { key: 'noticeDate', label: 'Notice Date', type: 'date', section: 'Eviction Timeline' },
  { key: 'evictionDate', label: 'Eviction Date', type: 'date', required: true, section: 'Eviction Timeline' },
  { key: 'evictionReason', label: 'Eviction Reason', type: 'textarea', required: true, section: 'Eviction Details' },
  { 
    key: 'status', 
    label: 'Status', 
    type: 'select', 
    options: ['Notice Issued', 'Pending Appeal', 'Evicted', 'Cancelled'],
    badgeColors: {
      'Notice Issued': 'bg-amber-100 text-amber-800',
      'Pending Appeal': 'bg-purple-100 text-purple-800',
      'Evicted': 'bg-red-100 text-red-800',
      'Cancelled': 'bg-gray-100 text-gray-700'
    },
    section: 'Eviction Timeline' 
  },
  { key: 'notes', label: 'Notes', type: 'textarea', colSpan: 2, section: 'Eviction Details' }
];




