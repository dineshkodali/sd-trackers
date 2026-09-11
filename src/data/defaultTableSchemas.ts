import { TableColumnConfig } from '../types/tableSchema';
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
  PropertyFoodVendorBuffetLog
} from '../types';

export const ESCALATIONS_TABLE_COLUMNS: TableColumnConfig<EscalationRecord>[] = [
  { key: 'dateOfIncident', label: 'Date of Incident', type: 'date', required: true, section: 'Incident Details' },
  { key: 'siteName', label: 'Site / Property', type: 'select', required: true, section: 'Incident Details' },
  { key: 'suName', label: 'Resident Name', type: 'text', required: true, section: 'Resident Information' },
  { key: 'suPortNassRef', label: 'Port / NASS Ref', type: 'text', section: 'Resident Information' },
  { key: 'personReporting', label: 'Submitted By', type: 'text', section: 'Incident Details' },
  { 
    key: 'incidentType', 
    label: 'Incident Type', 
    type: 'select', 
    options: ['Safeguarding Incident', 'Medical Emergency', 'Verbal / Physical Dispute', 'Missing Person / Absconded', 'Property Damage', 'Mental Health Crisis', 'Anti-Social Behaviour', 'Other'],
    section: 'Incident Details' 
  },
  { 
    key: 'urgency', 
    label: 'Urgency / Risk', 
    type: 'select', 
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
  { key: 'incidentNotes', label: 'Incident Notes', type: 'textarea', colSpan: 2, section: 'Incident Details' }
];

export const GP_APPOINTMENTS_TABLE_COLUMNS: TableColumnConfig<GPAppointmentRecord>[] = [
  { key: 'roomNo', label: 'Room No', type: 'text', required: true, section: 'Resident & Room' },
  { key: 'portReference', label: 'Port Reference', type: 'text', required: true, section: 'Resident & Room' },
  { key: 'suName', label: 'Service User Name', type: 'text', section: 'Resident & Room' },
  { key: 'siteName', label: 'Hotel Site', type: 'select', required: true, section: 'Resident & Room' },
  { key: 'referralSentOn', label: 'Referral Sent On', type: 'date', section: 'Consultation Details' },
  { key: 'appointmentDate', label: 'Appointment Date', type: 'date', required: true, section: 'Consultation Details' },
  { key: 'timeOfGp', label: 'Time of GP', type: 'text', placeholder: '10:00', section: 'Consultation Details' },
  { 
    key: 'status', 
    label: 'Status', 
    type: 'select', 
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
  { key: 'comments', label: 'Comments / Clinic Notes', type: 'textarea', colSpan: 2, section: 'Consultation Details' }
];

export const RFA_WELFARE_TABLE_COLUMNS: TableColumnConfig<RFAWelfareCheckRecord>[] = [
  { key: 'date', label: 'Date', type: 'date', required: true, section: 'Check Details' },
  { key: 'siteName', label: 'Hotel / Site', type: 'select', required: true, section: 'Location' },
  { key: 'roomOrFlatNo', label: 'Room / Flat No', type: 'text', required: true, section: 'Location' },
  { key: 'name', label: 'Resident Name', type: 'text', required: true, section: 'Resident Details' },
  { key: 'dob', label: 'Date of Birth', type: 'date', section: 'Resident Details' },
  { 
    key: 'group', 
    label: 'Group', 
    type: 'select', 
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
  { key: 'mhTicket', label: 'MH Ticket Ref', type: 'text', section: 'Check Details' }
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
    options: ['Approved', 'Pending', 'Completed', 'Cancelled'],
    badgeColors: {
      Approved: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
      Pending: 'bg-amber-100 text-amber-800 border border-amber-200',
      Completed: 'bg-blue-100 text-blue-800 border border-blue-200',
      Cancelled: 'bg-red-100 text-red-800 border border-red-200'
    },
    section: 'Approval' 
  },
  { key: 'exceptionalCircumstances', label: 'Exceptional Circumstances', type: 'textarea', colSpan: 2, section: 'Approval' }
];

export const DISPERSAL_TABLE_COLUMNS: TableColumnConfig<DispersalRecord>[] = [
  { key: 'sno', label: 'S.No', type: 'number', section: 'Dispersal Identification' },
  { key: 'siteName', label: 'Site / Hotel', type: 'select', required: true, section: 'Dispersal Identification' },
  { key: 'flatRoomNumber', label: 'Flat / Room No', type: 'text', required: true, section: 'Dispersal Identification' },
  { key: 'suPortNassRef', label: 'SU Port / NASS Ref', type: 'text', required: true, section: 'Dispersal Identification' },
  { key: 'reasonForDeparture', label: 'Reason for Departure', type: 'text', section: 'Departure Details' },
  { key: 'dateReceived', label: 'Date Received', type: 'text', section: 'Departure Details' },
  { key: 'dispersalDate', label: 'Dispersal Date', type: 'text', section: 'Departure Details' },
  { 
    key: 'iaExitBriefingCompleted', 
    label: 'IA Exit Briefing', 
    type: 'select', 
    options: ['Yes', 'No'],
    badgeColors: { Yes: 'bg-emerald-100 text-emerald-800', No: 'bg-red-100 text-red-800' },
    section: 'Compliance Check' 
  },
  { 
    key: 'hoDispersalLetterReceived', 
    label: 'HO Letter Received', 
    type: 'select', 
    options: ['Yes', 'No'],
    badgeColors: { Yes: 'bg-emerald-100 text-emerald-800', No: 'bg-red-100 text-red-800' },
    section: 'Compliance Check' 
  },
  { 
    key: 'travelled', 
    label: 'Travelled', 
    type: 'select', 
    options: ['Yes', 'No'],
    badgeColors: { Yes: 'bg-emerald-100 text-emerald-800', No: 'bg-red-100 text-red-800' },
    section: 'Departure Details' 
  },
  { key: 'dateLeftProperty', label: 'Date Left Property', type: 'text', section: 'Departure Details' },
  { 
    key: 'incidentWarningCompleted', 
    label: 'Incident Warning', 
    type: 'select', 
    options: ['Yes', 'No', 'No need'],
    section: 'Compliance Check' 
  },
  { key: 'reasonFailedToTravel', label: 'Reason Failed to Travel', type: 'textarea', colSpan: 2, section: 'Exceptions' },
  { key: 'secondDispersalDate', label: '2nd Dispersal Date', type: 'text', section: '2nd Dispersal Cycle' }
];

export const SD_COMPLIANCE_TABLE_COLUMNS: TableColumnConfig<SDComplianceRecord>[] = [
  { key: 'srNo', label: 'Sr No', type: 'number', section: 'Audit' },
  { 
    key: 'complianceType', 
    label: 'Compliance Type', 
    type: 'select', 
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
  { key: 'siteName', label: 'Site / Hotel', type: 'select', required: true, section: 'Certification' },
  { key: 'contractorName', label: 'Contractor Name', type: 'text', required: true, section: 'Contractor Information' },
  { key: 'contractorKeyContact', label: 'Contractor Contact', type: 'text', section: 'Contractor Information' },
  { key: 'contractorEmail', label: 'Contractor Email', type: 'text', section: 'Contractor Information' },
  { key: 'issuedDate', label: 'Issued Date', type: 'date', required: true, section: 'Validity & Schedule' },
  { key: 'expiryDate', label: 'Expiry Date', type: 'date', required: true, section: 'Validity & Schedule' },
  { 
    key: 'status', 
    label: 'Status', 
    type: 'select', 
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
  { key: 'previousContractor', label: 'Previous Contractor', type: 'text', section: 'Contractor Information' }
];

export const BOOKLETS_TABLE_COLUMNS: TableColumnConfig<BookletCollectionRecord>[] = [
  { key: 'hotelName', label: 'Hotel / Site', type: 'select', required: true, section: 'Location & Agent' },
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
    options: ['Pending Collection', 'Partially Collected', 'Received at Site'],
    badgeColors: {
      'Pending Collection': 'bg-amber-100 text-amber-800 border border-amber-200',
      'Partially Collected': 'bg-blue-100 text-blue-800 border border-blue-200',
      'Received at Site': 'bg-emerald-100 text-emerald-800 border border-emerald-200'
    },
    section: 'Quantities'
  },
  { key: 'notes', label: 'Notes', type: 'textarea', colSpan: 2, section: 'Booklet Details' }
];

export const VCS_AGENCIES_TABLE_COLUMNS: TableColumnConfig<SDVCSAgency>[] = [
  { key: 'agencyName', label: 'Agency / Organization', type: 'text', required: true, section: 'Organization' },
  { 
    key: 'category', 
    label: 'Category', 
    type: 'select', 
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
  { key: 'hotelName', label: 'Hotel / Site', type: 'select', required: true, section: 'Organization' },
  { key: 'servicesProvided', label: 'Services Provided', type: 'text', required: true, section: 'Services & Support' },
  { key: 'contactPerson', label: 'Contact Person', type: 'text', section: 'Contact Details' },
  { key: 'contactNumber', label: 'Contact Number', type: 'text', section: 'Contact Details' },
  { key: 'email', label: 'Email Address', type: 'text', section: 'Contact Details' },
  { key: 'address', label: 'Address', type: 'text', section: 'Contact Details' },
  { key: 'notes', label: 'Notes', type: 'textarea', colSpan: 2, section: 'Services & Support' }
];

export const DOCUMENTS_TABLE_COLUMNS: TableColumnConfig<DocumentRecord>[] = [
  { key: 'documentTitle', label: 'Document Title', type: 'text', required: true, section: 'Document Info' },
  { key: 'site', label: 'Hotel / Site', type: 'select', required: true, section: 'Document Info' },
  { key: 'suName', label: 'Resident Name', type: 'text', section: 'Resident Association' },
  { key: 'refNumber', label: 'Port Ref', type: 'text', section: 'Resident Association' },
  { 
    key: 'category', 
    label: 'Category', 
    type: 'select', 
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
    options: ['PDF', 'DOCX', 'XLSX', 'JPG', 'PNG'],
    section: 'File Details'
  },
  { 
    key: 'confidentiality', 
    label: 'Confidentiality', 
    type: 'select', 
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
  { key: 'notes', label: 'Notes', type: 'textarea', colSpan: 2, section: 'Document Info' }
];

export const PROPERTY_LAUNDRY_TABLE_COLUMNS: TableColumnConfig<PropertyLaundryLog>[] = [
  { key: 'site', label: 'Property / Hotel', type: 'select', required: true, section: 'Property & Period' },
  { 
    key: 'periodType', 
    label: 'Log Type', 
    type: 'select', 
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
  { key: 'endDate', label: 'Date To', type: 'date', section: 'Period Dates' }
];

export const FOOD_VENDOR_BUFFET_TABLE_COLUMNS: TableColumnConfig<PropertyFoodVendorBuffetLog>[] = [
  { 
    key: 'vendor', 
    label: 'Food Vendor', 
    type: 'select', 
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
  { key: 'site', label: 'Property / Hotel', type: 'select', required: true, section: 'Vendor & Property' },
  { key: 'weekRange', label: 'Week Range', type: 'text', required: true, section: 'Schedule Details' },
  { key: 'startDate', label: 'Date From', type: 'date', required: true, section: 'Schedule Details' },
  { key: 'endDate', label: 'Date To', type: 'date', required: true, section: 'Schedule Details' },
  { key: 'notes', label: 'Compliance & Quality Notes', type: 'textarea', colSpan: 2, section: 'Audit & Compliance' },
  { key: 'lastUpdatedBy', label: 'Audited By', type: 'text', section: 'Audit & Compliance' }
];

