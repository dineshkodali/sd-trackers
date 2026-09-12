import { TableColumnConfig } from '../types/tableSchema';
import { 
  MaintenanceRecord, 
  SGReferral, 
  VulnerableSU, 
  ChallengingSU, 
  SPCDRecord, 
  SiteInfo, 
  FoodRecord, 
  LaundryRecord, 
  EscalationRecord, 
  DocumentRecord 
} from '../types';

export const resolveConfigSiteOptions = (ctx: any): string[] => {
  if (ctx?.allowedSites && Array.isArray(ctx.allowedSites) && ctx.allowedSites.length > 0) {
    return ctx.allowedSites.filter((s: string) => s && s !== 'All Sites' && s !== 'all');
  }
  if (ctx?.sites && Array.isArray(ctx.sites) && ctx.sites.length > 0) {
    return ctx.sites.map((s: any) => typeof s === 'string' ? s : s?.name).filter(Boolean);
  }
  return ['Brit Hotel', 'Holiday Inn Lambeth', 'Parmiter PDA', 'Stansted Hotel (Ibis Budget Bisop Stortford)'];
};

export const resolveConfigSiteDefault = (ctx: any): string => {
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

/**
 * 1. MAINTENANCE & DEFECTS TRACKER CONFIGURATION
 * Single source of truth for table headers, Add form, View dossier, and Edit form.
 */
export const maintenanceTableConfig: TableColumnConfig<MaintenanceRecord>[] = [
  {
    key: 'date',
    label: 'Date',
    type: 'date',
    required: true,
    defaultValue: () => new Date().toISOString().slice(0, 10),
    section: 'Defect Details'
  },
  {
    key: 'priority',
    label: 'Priority',
    type: 'select',
    required: true,
    options: [
      { label: 'CAT 1 (Emergency - 4h)', value: 'CAT 1', badgeBg: 'bg-red-100', badgeText: 'text-red-800' },
      { label: 'CAT 2 - Interim (24h)', value: 'CAT 2 - Interim', badgeBg: 'bg-amber-100', badgeText: 'text-amber-800' },
      { label: 'CAT 2 (5 Working Days)', value: 'CAT 2', badgeBg: 'bg-amber-50', badgeText: 'text-amber-700' },
      { label: 'CAT 3 (21 Working Days)', value: 'CAT 3', badgeBg: 'bg-blue-100', badgeText: 'text-blue-800' }
    ],
    defaultValue: 'CAT 1',
    badgeColors: {
      'CAT 1': 'bg-red-100 text-red-800 border-red-200',
      'CAT 2 - Interim': 'bg-amber-100 text-amber-800 border-amber-200',
      'CAT 2': 'bg-amber-50 text-amber-700 border-amber-200',
      'CAT 3': 'bg-blue-100 text-blue-800 border-blue-200'
    },
    section: 'Defect Details'
  },
  {
    key: 'priorityTimeScale',
    label: 'Priority TimeScale',
    type: 'text',
    placeholder: 'e.g. 4 Hours (0 Days), 1 (24 Hours Interim)',
    defaultValue: '4 Hours (0 Days)',
    section: 'Defect Details'
  },
  {
    key: 'location',
    label: 'Location',
    type: 'text',
    placeholder: 'e.g. Brit Hotel - Room 104',
    section: 'Location & Reporting'
  },
  {
    key: 'site',
    label: 'Property / Site',
    type: 'select',
    required: true,
    options: resolveConfigSiteOptions,
    defaultValue: resolveConfigSiteDefault,
    section: 'Location & Reporting'
  },
  {
    key: 'room',
    label: 'Room / Unit',
    type: 'text',
    placeholder: 'e.g. Room 104, Kitchen',
    section: 'Location & Reporting'
  },
  {
    key: 'criteriaCode',
    label: 'HO Criteria Code',
    type: 'text',
    placeholder: 'e.g. H1, E2, P3',
    section: 'Defect Details'
  },
  {
    key: 'description',
    label: 'Defect Description',
    type: 'textarea',
    required: true,
    colSpan: 2,
    placeholder: 'Detailed explanation of the defect, damage or fault...',
    section: 'Defect Details'
  },
  {
    key: 'raisedBy',
    label: 'Raised By',
    type: 'text',
    defaultValue: (ctx) => ctx?.loggedInUserName || 'Duty Officer',
    section: 'Location & Reporting'
  },
  {
    key: 'closeDueDate',
    label: 'Close Due Date',
    type: 'text',
    placeholder: 'YYYY-MM-DD HH:MM',
    section: 'Status & Progression'
  },
  {
    key: 'defectStatus',
    label: 'Defect Status',
    type: 'select',
    required: true,
    options: [
      { label: 'In Process', value: 'In Process' },
      { label: 'Completed', value: 'Completed' }
    ],
    defaultValue: 'In Process',
    badgeColors: {
      'In Process': 'bg-sky-100 text-sky-800',
      'Completed': 'bg-emerald-100 text-emerald-800'
    },
    section: 'Status & Progression'
  },
  {
    key: 'action',
    label: 'Action',
    type: 'select',
    required: true,
    options: ['Open', 'Closed'],
    defaultValue: 'Open',
    badgeColors: {
      'Open': 'bg-amber-100 text-amber-800',
      'Closed': 'bg-neutral-100 text-neutral-600'
    },
    section: 'Status & Progression'
  },
  {
    key: 'progress',
    label: 'Progress',
    type: 'text',
    placeholder: 'e.g. Reported - Assessing issue, Contractor on site',
    defaultValue: 'Reported - Assessing issue',
    section: 'Status & Progression'
  },
  {
    key: 'actualClosedDate',
    label: 'Actual Closed Date',
    type: 'date',
    section: 'Status & Progression'
  },
  {
    key: 'notes',
    label: 'Notes & Follow-up',
    type: 'textarea',
    colSpan: 2,
    placeholder: 'Action notes, parts ordered, contractor communication...',
    section: 'Status & Progression'
  },
  // System metadata fields (filtered out from Add/Edit/View by default)
  { key: 'id', label: 'ID', isSystemMetadata: true },
  { key: 'createdAt', label: 'Created At', isSystemMetadata: true },
  { key: 'updatedAt', label: 'Updated At', isSystemMetadata: true }
];

/**
 * 2. SAFEGUARDING REFERRALS CONFIGURATION
 */
export const referralsTableConfig: TableColumnConfig<SGReferral>[] = [
  {
    key: 'site',
    label: 'Property / Site',
    type: 'select',
    required: true,
    options: resolveConfigSiteOptions,
    defaultValue: resolveConfigSiteDefault,
    section: 'Property & Council'
  },
  {
    key: 'referralCouncil',
    label: 'Referral Council',
    type: 'select',
    required: true,
    options: (ctx) => (ctx?.councilOptions || ['Westminster City Council', 'Lambeth Council', 'Newham Council', 'Croydon Council', 'Camden Council']),
    defaultValue: 'Westminster City Council',
    section: 'Property & Council'
  },
  {
    key: 'suName',
    label: 'Service User Name',
    type: 'text',
    required: true,
    placeholder: 'Full resident name',
    section: 'Service User Identification'
  },
  {
    key: 'portRef',
    label: 'Port / NASS Ref',
    type: 'text',
    required: true,
    placeholder: 'e.g. 10/123456 or PR-001',
    section: 'Service User Identification'
  },
  {
    key: 'mosaicId',
    label: 'Mosaic ID',
    type: 'text',
    placeholder: 'Mosaic system reference',
    section: 'Service User Identification'
  },
  {
    key: 'dob',
    label: 'Date of Birth',
    type: 'date',
    section: 'Service User Identification'
  },
  {
    key: 'referralType',
    label: 'Referral Type',
    type: 'select',
    required: true,
    options: (ctx) => (ctx?.referralTypeOptions || ['Safeguarding Adult', 'Safeguarding Child', 'Mental Health Crisis', 'Modern Slavery / NRM', 'Domestic Abuse']),
    defaultValue: 'Safeguarding Adult',
    section: 'Referral Details'
  },
  {
    key: 'urgency',
    label: 'Urgency / Priority',
    type: 'select',
    required: true,
    options: [
      { label: 'Critical / Immediate Risk', value: 'Critical' },
      { label: 'High Priority', value: 'High' },
      { label: 'Medium Priority', value: 'Medium' },
      { label: 'Low Priority', value: 'Low' }
    ],
    defaultValue: 'Medium',
    badgeColors: {
      'Critical': 'bg-red-100 text-red-800 border-red-200',
      'High': 'bg-amber-100 text-amber-800 border-amber-200',
      'Medium': 'bg-blue-100 text-blue-800 border-blue-200',
      'Low': 'bg-neutral-100 text-neutral-800 border-neutral-200'
    },
    section: 'Referral Details'
  },
  {
    key: 'status',
    label: 'Referral Status',
    type: 'select',
    required: true,
    options: ['Open', 'In Progress', 'Awaiting LA Response', 'Allocated', 'Completed', 'Closed'],
    defaultValue: 'Open',
    badgeColors: {
      'Open': 'bg-emerald-100 text-emerald-800',
      'In Progress': 'bg-blue-100 text-blue-800',
      'Awaiting LA Response': 'bg-amber-100 text-amber-800',
      'Allocated': 'bg-purple-100 text-purple-800',
      'Completed': 'bg-neutral-100 text-neutral-700',
      'Closed': 'bg-neutral-100 text-neutral-500'
    },
    section: 'Referral Details'
  },
  {
    key: 'dateReferred',
    label: 'Date Referred',
    type: 'date',
    required: true,
    defaultValue: () => new Date().toISOString().slice(0, 10),
    section: 'Communication & Handling'
  },
  {
    key: 'methodOfReferral',
    label: 'Method of Referral',
    type: 'select',
    options: ['Mosaic Portal', 'Secure Email', 'Telephone Crisis Line', 'Multi-Agency Safeguarding Hub (MASH)', 'Direct Portal'],
    defaultValue: 'Mosaic Portal',
    section: 'Communication & Handling'
  },
  {
    key: 'acknowledgementReceived',
    label: 'LA Acknowledgement',
    type: 'select',
    options: ['Yes', 'No', 'Pending'],
    defaultValue: 'Pending',
    section: 'Communication & Handling'
  },
  {
    key: 'responseReceivedFromLA',
    label: 'LA Response',
    type: 'select',
    options: ['Yes', 'No', 'Awaiting Allocation'],
    defaultValue: 'Awaiting Allocation',
    section: 'Communication & Handling'
  },
  {
    key: 'laOfficerLeading',
    label: 'LA Officer Leading',
    type: 'text',
    placeholder: 'Named Social Worker / Contact',
    section: 'Communication & Handling'
  },
  {
    key: 'officerLeadingHotel',
    label: 'Duty Officer (Site)',
    type: 'text',
    editable: false,
    defaultValue: (ctx) => ctx?.loggedInUserName || 'Staff Member',
    section: 'Communication & Handling'
  },
  {
    key: 'notesActionTaken',
    label: 'Actions Taken & Case Details',
    type: 'textarea',
    required: true,
    colSpan: 2,
    placeholder: 'Actions taken, emergency measures implemented, communication summary...',
    section: 'Case Notes & Review'
  },
  {
    key: 'sgReview',
    label: 'Safeguarding Review Notes',
    type: 'textarea',
    colSpan: 2,
    placeholder: 'Review comments, outcomes, follow-up dates...',
    section: 'Case Notes & Review'
  },
  // System metadata
  { key: 'id', label: 'ID', isSystemMetadata: true },
  { key: 'srNo', label: 'Sr. No', isSystemMetadata: true },
  { key: 'createdAt', label: 'Created At', isSystemMetadata: true },
  { key: 'updatedAt', label: 'Updated At', isSystemMetadata: true },
  { key: 'lastUpdatedBy', label: 'Last Updated By', isSystemMetadata: true }
];

/**
 * 3. VULNERABLE RESIDENTS TRACKER CONFIGURATION
 */
export const vulnerableTableConfig: TableColumnConfig<VulnerableSU>[] = [
  {
    key: 'site',
    label: 'Property / Site',
    type: 'select',
    required: true,
    options: resolveConfigSiteOptions,
    defaultValue: resolveConfigSiteDefault,
    section: 'Service User Identification'
  },
  {
    key: 'roomOrFlatNo',
    label: 'Room or Flat No',
    type: 'text',
    placeholder: 'e.g. 102, Flat 4',
    section: 'Service User Identification'
  },
  {
    key: 'suName',
    label: 'Service User Name',
    type: 'text',
    required: true,
    placeholder: 'Full resident name',
    section: 'Service User Identification'
  },
  {
    key: 'dob',
    label: 'Date of Birth',
    type: 'date',
    section: 'Service User Identification'
  },
  {
    key: 'portOrNassRef',
    label: 'Port / NASS Ref',
    type: 'text',
    placeholder: 'e.g. 10/123456 or PR-001',
    section: 'Service User Identification'
  },
  {
    key: 'group',
    label: 'Demographic Group',
    type: 'select',
    options: ['Single Adult', 'Family', 'Pregnant Woman', 'Elderly', 'Young Adult (18-21)', 'Medical Need'],
    defaultValue: 'Single Adult',
    section: 'Classification & Vulnerability'
  },
  {
    key: 'gender',
    label: 'Gender',
    type: 'select',
    options: ['Male', 'Female', 'Other', 'Prefer not to say'],
    defaultValue: 'Female',
    section: 'Classification & Vulnerability'
  },
  {
    key: 'vulnerability',
    label: 'Vulnerability Category',
    type: 'select',
    required: true,
    options: ['Medical & Physical Disability', 'Mental Health & Wellbeing', 'Elderly / Frail', 'Pregnancy & Newborn', 'Trauma & PTSD', 'Substance Dependency', 'Language & Complex Needs'],
    defaultValue: 'Medical & Physical Disability',
    section: 'Classification & Vulnerability'
  },
  {
    key: 'riskLevel',
    label: 'Risk Level',
    type: 'select',
    required: true,
    options: ['Critical', 'High', 'Medium', 'Low'],
    defaultValue: 'Medium',
    badgeColors: {
      'Critical': 'bg-red-100 text-red-800 border-red-200',
      'High': 'bg-amber-100 text-amber-800 border-amber-200',
      'Medium': 'bg-blue-100 text-blue-800 border-blue-200',
      'Low': 'bg-neutral-100 text-neutral-800 border-neutral-200'
    },
    section: 'Classification & Vulnerability'
  },
  {
    key: 'status',
    label: 'Care Status',
    type: 'select',
    required: true,
    options: ['Active', 'Monitoring Required', 'Stable Under Care', 'Discharged / Closed'],
    defaultValue: 'Active',
    badgeColors: {
      'Active': 'bg-emerald-100 text-emerald-800',
      'Monitoring Required': 'bg-amber-100 text-amber-800',
      'Stable Under Care': 'bg-blue-100 text-blue-800',
      'Discharged / Closed': 'bg-neutral-100 text-neutral-600'
    },
    section: 'Care & Management'
  },
  {
    key: 'allocatedWorker',
    label: 'Allocated Worker',
    type: 'text',
    placeholder: 'Named key worker or officer',
    section: 'Care & Management'
  },
  {
    key: 'reviewDate',
    label: 'Next Review Date',
    type: 'date',
    section: 'Care & Management'
  },
  {
    key: 'raisedBy',
    label: 'Raised By',
    type: 'text',
    defaultValue: (ctx) => ctx?.loggedInUserName || 'Duty Officer',
    section: 'Care & Management'
  },
  {
    key: 'notesActionTaken',
    label: 'Notes / Action Taken',
    type: 'textarea',
    colSpan: 2,
    placeholder: 'Summary of clinical conditions, support needs, actions taken...',
    section: 'Notes & Updates'
  },
  {
    key: 'sgTeamUpdate',
    label: 'SG Team Update',
    type: 'textarea',
    colSpan: 2,
    placeholder: 'Safeguarding review updates, outcomes, observations...',
    section: 'Notes & Updates'
  },
  // System metadata
  { key: 'id', label: 'ID', isSystemMetadata: true },
  { key: 'createdAt', label: 'Created At', isSystemMetadata: true },
  { key: 'updatedAt', label: 'Updated At', isSystemMetadata: true }
];

/**
 * 4. CHALLENGING BEHAVIOUR TRACKER CONFIGURATION
 */
export const challengingTableConfig: TableColumnConfig<ChallengingSU>[] = [
  {
    key: 'date',
    label: 'Date',
    type: 'date',
    required: true,
    defaultValue: () => new Date().toISOString().slice(0, 10),
    section: 'Incident Details'
  },
  {
    key: 'site',
    label: 'Property / Site',
    type: 'select',
    required: true,
    options: resolveConfigSiteOptions,
    defaultValue: resolveConfigSiteDefault,
    section: 'Service User'
  },
  {
    key: 'name',
    label: 'Service User Name',
    type: 'text',
    required: true,
    placeholder: 'Full resident name',
    section: 'Service User'
  },
  {
    key: 'portRef',
    label: 'Port / NASS Ref',
    type: 'text',
    required: true,
    placeholder: 'e.g. 10/123456 or PR-001',
    section: 'Service User'
  },
  {
    key: 'dob',
    label: 'Date of Birth',
    type: 'date',
    section: 'Service User'
  },
  {
    key: 'group',
    label: 'Demographic Group',
    type: 'select',
    options: ['Single Adult', 'Family', 'Young Adult (18-21)', 'Other'],
    defaultValue: 'Single Adult',
    section: 'Service User'
  },
  {
    key: 'gender',
    label: 'Gender',
    type: 'select',
    options: ['Male', 'Female', 'Other'],
    defaultValue: 'Male',
    section: 'Service User'
  },
  {
    key: 'raisedBy',
    label: 'Raised By',
    type: 'text',
    defaultValue: (ctx) => ctx?.loggedInUserName || 'Duty Officer',
    section: 'Incident Details'
  },
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    required: true,
    options: ['Open', 'Under Review', 'Resolved', 'Archived'],
    defaultValue: 'Open',
    badgeColors: {
      'Open': 'bg-amber-100 text-amber-800',
      'Under Review': 'bg-blue-100 text-blue-800',
      'Resolved': 'bg-emerald-100 text-emerald-800',
      'Archived': 'bg-neutral-100 text-neutral-600'
    },
    section: 'Incident Details'
  },
  {
    key: 'typeOfIssue',
    label: 'Type of Issue',
    type: 'select',
    required: true,
    options: ['Verbal Aggression', 'Curfew Non-compliance', 'Room Damage', 'Substance Misuse', 'Dispute with Resident', 'Other'],
    defaultValue: 'Verbal Aggression',
    section: 'Incident Details'
  },
  {
    key: 'incidentDescription',
    label: 'Incident Description',
    type: 'textarea',
    required: true,
    colSpan: 2,
    placeholder: 'Detailed narrative of the incident...',
    section: 'Incident Details'
  },
  {
    key: 'dateOfIncident',
    label: 'Date of Incident',
    type: 'date',
    required: true,
    defaultValue: () => new Date().toISOString().slice(0, 10),
    section: 'Incident Details'
  },
  {
    key: 'actionTaken',
    label: 'Action Taken',
    type: 'textarea',
    colSpan: 2,
    placeholder: 'De-escalation tactics, separation, security intervention...',
    section: 'Actions & Review'
  },
  {
    key: 'adviceGivenBySGTeam',
    label: 'Advice Given by SG Team',
    type: 'textarea',
    colSpan: 2,
    placeholder: 'Advice given and name of officer...',
    section: 'Actions & Review'
  },
  {
    key: 'followUpRequired',
    label: 'Follow-Up Required',
    type: 'select',
    options: ['Yes', 'No'],
    defaultValue: 'Yes',
    section: 'Actions & Review'
  },
  {
    key: 'riskFactor',
    label: 'Risk Factor',
    type: 'select',
    required: true,
    options: ['Critical', 'High', 'Medium', 'Low'],
    defaultValue: 'Medium',
    badgeColors: {
      'Critical': 'bg-red-100 text-red-800 border-red-200',
      'High': 'bg-amber-100 text-amber-800 border-amber-200',
      'Medium': 'bg-blue-100 text-blue-800 border-blue-200',
      'Low': 'bg-neutral-100 text-neutral-800 border-neutral-200'
    },
    section: 'Actions & Review'
  },
  {
    key: 'followUpNotes',
    label: 'Follow-Up Notes',
    type: 'textarea',
    colSpan: 2,
    placeholder: 'Follow-up actions and ongoing monitoring...',
    section: 'Actions & Review'
  },
  {
    key: 'comments',
    label: 'Comments',
    type: 'textarea',
    colSpan: 2,
    placeholder: 'Additional commentary or observations...',
    section: 'Actions & Review'
  },
  {
    key: 'reviewBySGTeam',
    label: 'Review by SG Team / Site Team',
    type: 'textarea',
    colSpan: 2,
    placeholder: 'Safeguarding review summary and final signoff...',
    section: 'Actions & Review'
  },
  // System metadata
  { key: 'id', label: 'ID', isSystemMetadata: true },
  { key: 'createdAt', label: 'Created At', isSystemMetadata: true },
  { key: 'updatedAt', label: 'Updated At', isSystemMetadata: true }
];

/**
 * 5. SPCD TRACKER CONFIGURATION
 */
export const spcdTableConfig: TableColumnConfig<SPCDRecord>[] = [
  {
    key: 'date',
    label: 'Date',
    type: 'date',
    required: true,
    defaultValue: () => new Date().toISOString().slice(0, 10),
    section: 'Case Details'
  },
  {
    key: 'siteName',
    label: 'Site Name',
    type: 'select',
    required: true,
    options: resolveConfigSiteOptions,
    defaultValue: resolveConfigSiteDefault,
    section: 'Service User & Location'
  },
  {
    key: 'roomNumber',
    label: 'Room Number',
    type: 'text',
    placeholder: 'e.g. 204',
    section: 'Service User & Location'
  },
  {
    key: 'staffReporting',
    label: 'Raised By',
    type: 'text',
    defaultValue: (ctx) => ctx?.loggedInUserName || 'Staff Officer',
    section: 'Service User & Location'
  },
  {
    key: 'suName',
    label: "SU's Name",
    type: 'text',
    required: true,
    placeholder: 'Full resident name',
    section: 'Service User & Location'
  },
  {
    key: 'suPortReference',
    label: "SU's Port Reference",
    type: 'text',
    required: true,
    placeholder: 'e.g. 10/123456 or PR-001',
    section: 'Service User & Location'
  },
  {
    key: 'suDob',
    label: "SU's DOB",
    type: 'date',
    section: 'Service User & Location'
  },
  {
    key: 'briefDescriptionActionTaken',
    label: 'Brief Description / Action Taken',
    type: 'textarea',
    colSpan: 2,
    placeholder: 'Case description and actions taken...',
    section: 'Case Details'
  },
  {
    key: 'followUpNotes',
    label: 'Follow Up Notes',
    type: 'textarea',
    colSpan: 2,
    placeholder: 'Follow up notes and observations...',
    section: 'Case Details'
  },
  {
    key: 'updates',
    label: 'Updates',
    type: 'textarea',
    colSpan: 2,
    placeholder: 'Case updates...',
    section: 'Case Details'
  },
  {
    key: 'sgReview',
    label: 'SG Review',
    type: 'select',
    options: ['Pending Safeguarding Lead Review', 'Reviewed - Compliant', 'Reviewed - Action Required', 'Closed'],
    defaultValue: 'Pending Safeguarding Lead Review',
    badgeColors: {
      'Pending Safeguarding Lead Review': 'bg-amber-100 text-amber-800',
      'Reviewed - Compliant': 'bg-emerald-100 text-emerald-800',
      'Reviewed - Action Required': 'bg-red-100 text-red-800',
      'Closed': 'bg-neutral-100 text-neutral-600'
    },
    section: 'Case Details'
  },
  // System metadata
  { key: 'id', label: 'ID', isSystemMetadata: true },
  { key: 'createdAt', label: 'Created At', isSystemMetadata: true },
  { key: 'updatedAt', label: 'Updated At', isSystemMetadata: true }
];

/**
 * 6. SITES & PROPERTIES CONFIGURATION
 */
export const sitesTableConfig: TableColumnConfig<SiteInfo>[] = [
  {
    key: 'pid',
    label: 'PID (Hotel Code)',
    type: 'text',
    placeholder: 'e.g. 519'
  },
  {
    key: 'name',
    label: 'Property Name',
    type: 'text',
    required: true,
    placeholder: 'e.g. Brit Hotel'
  },
  {
    key: 'city',
    label: 'City / Borough',
    type: 'text',
    required: true,
    placeholder: 'e.g. London (Redbridge)'
  },
  {
    key: 'capacity',
    label: 'Capacity (Residents / Rooms)',
    type: 'number',
    required: true,
    defaultValue: 100
  },
  {
    key: 'leadOfficer',
    label: 'Lead Contact Officer',
    type: 'text',
    placeholder: 'e.g. Sarah Jenkins'
  },
  {
    key: 'contactNumber',
    label: 'Contact Phone',
    type: 'text',
    placeholder: 'e.g. +44 20 8599 0100'
  },
  {
    key: 'status',
    label: 'Operational Status',
    type: 'select',
    required: true,
    options: ['Active', 'Under Maintenance'],
    defaultValue: 'Active',
    badgeColors: {
      'Active': 'bg-emerald-100 text-emerald-800',
      'Under Maintenance': 'bg-amber-100 text-amber-800'
    }
  },
  // System metadata
  { key: 'id', label: 'ID', isSystemMetadata: true },
  { key: 'createdAt', label: 'Created At', isSystemMetadata: true },
  { key: 'updatedAt', label: 'Updated At', isSystemMetadata: true }
];
