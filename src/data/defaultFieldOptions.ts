import { CustomFieldOption, FieldOptionCategory } from '../types';

export interface CategoryMeta {
  key: FieldOptionCategory;
  name: string;
  department: 'Safeguarding' | 'Facilities' | 'Welfare' | 'Healthcare & Transport' | 'Compliance & Documents' | 'Operations & Governance';
  description: string;
  iconName: string;
}

export const FIELD_CATEGORIES_META: CategoryMeta[] = [
  // --- 1. Safeguarding ---
  {
    key: 'referralTypes',
    name: 'Referral Types',
    department: 'Safeguarding',
    description: 'Statutory safeguarding referral categories used in SG intake',
    iconName: 'FolderHeart'
  },
  {
    key: 'referralMethods',
    name: 'Referral Intake Methods',
    department: 'Safeguarding',
    description: 'Channels used by local authorities and partners to register referrals',
    iconName: 'Send'
  },
  {
    key: 'referralStatuses',
    name: 'Referral Lifecycle Statuses',
    department: 'Safeguarding',
    description: 'Operational progress stages for safeguarding referrals',
    iconName: 'CheckCircle'
  },
  {
    key: 'vulnerabilities',
    name: 'Vulnerability Classifications',
    department: 'Safeguarding',
    description: 'Clinical and physical vulnerability categories for residents',
    iconName: 'HeartHandshake'
  },
  {
    key: 'vulnerableStatuses',
    name: 'Vulnerable Resident Statuses',
    department: 'Safeguarding',
    description: 'Monitoring and review status stages for vulnerable residents',
    iconName: 'Activity'
  },
  {
    key: 'incidentTypes',
    name: 'Incident / Issue Types',
    department: 'Safeguarding',
    description: 'Challenging behavior, ASB, and security incident classifications',
    iconName: 'AlertTriangle'
  },
  {
    key: 'incidentRiskFactors',
    name: 'Incident Severity Levels',
    department: 'Safeguarding',
    description: 'Risk factor severity grading for incidents',
    iconName: 'ShieldAlert'
  },
  {
    key: 'riskLevels',
    name: 'Urgency / Risk Levels',
    department: 'Safeguarding',
    description: 'Urgency grading applied to referrals and safeguarding records',
    iconName: 'ShieldAlert'
  },
  {
    key: 'challengingStatuses',
    name: 'Challenging Behaviour Statuses',
    department: 'Safeguarding',
    description: 'Case resolution and behavioral monitoring statuses',
    iconName: 'AlertCircle'
  },
  {
    key: 'escalationAuthorities',
    name: 'Escalation Authorities',
    department: 'Safeguarding',
    description: 'Statutory emergency and local authority partners escalated to',
    iconName: 'Siren'
  },
  {
    key: 'escalationStatuses',
    name: 'Escalation Case Statuses',
    department: 'Safeguarding',
    description: 'Status of formal and emergency statutory escalations',
    iconName: 'ShieldAlert'
  },
  {
    key: 'wlIssuedStatuses',
    name: 'Warning Letter & Notice Statuses',
    department: 'Safeguarding',
    description: 'Status of behavioral warning letters or tenancy notices issued',
    iconName: 'FileText'
  },

  // --- 2. Facilities & Assets ---
  {
    key: 'maintenancePriorities',
    name: 'Maintenance Priority SLAs',
    department: 'Facilities',
    description: 'Priority levels for defect repairs and emergency maintenance',
    iconName: 'HardHat'
  },
  {
    key: 'maintenanceTimeScales',
    name: 'Maintenance Time Scales',
    department: 'Facilities',
    description: 'SLA target turnaround time scales for property maintenance',
    iconName: 'Clock'
  },
  {
    key: 'maintenanceStatuses',
    name: 'Maintenance Defect Statuses',
    department: 'Facilities',
    description: 'Resolution and repair progress statuses for defect tickets',
    iconName: 'Wrench'
  },
  {
    key: 'propertyRoomTypes',
    name: 'Room / Accommodation Types',
    department: 'Facilities',
    description: 'Classifications of accommodation units across hotel properties',
    iconName: 'Home'
  },
  {
    key: 'propertyStatuses',
    name: 'Property Operational Statuses',
    department: 'Facilities',
    description: 'Operational status stages for contracted property sites',
    iconName: 'Building2'
  },

  // --- 3. Welfare & Catering ---
  {
    key: 'mealTypes',
    name: 'Catering Meal Types',
    department: 'Welfare',
    description: 'Commercial meal service times and food delivery sessions',
    iconName: 'Soup'
  },
  {
    key: 'dietaryTypes',
    name: 'Dietary & Allergy Profiles',
    department: 'Welfare',
    description: 'Religious, clinical, and lifestyle dietary requirements for catering',
    iconName: 'Apple'
  },
  {
    key: 'foodStatuses',
    name: 'Food Service Statuses',
    department: 'Welfare',
    description: 'Distribution and fulfillment statuses for meal deliveries',
    iconName: 'Utensils'
  },
  {
    key: 'foodVendors',
    name: 'Food Catering Vendors',
    department: 'Welfare',
    description: 'Contracted food and buffet preparation partners',
    iconName: 'ChefHat'
  },
  {
    key: 'laundryStages',
    name: 'Laundry Cycle Stages',
    department: 'Welfare',
    description: 'Operational tracking stages for commercial laundry cycles',
    iconName: 'Waves'
  },
  {
    key: 'laundryPeriodTypes',
    name: 'Laundry Log Period Types',
    department: 'Welfare',
    description: 'Reporting frequency periods for laundry distribution logs',
    iconName: 'Calendar'
  },
  {
    key: 'discrepancyStatuses',
    name: 'Discrepancy Statuses',
    department: 'Welfare',
    description: 'Reconciliation status flags for stock or linen variances',
    iconName: 'CheckCircle2'
  },

  // --- 4. Healthcare & Transport ---
  {
    key: 'gpAppointmentStatuses',
    name: 'GP Appointment Statuses',
    department: 'Healthcare & Transport',
    description: 'Clinical consultation attendance and scheduling statuses',
    iconName: 'Stethoscope'
  },
  {
    key: 'transportModes',
    name: 'Public Transport Modes',
    department: 'Healthcare & Transport',
    description: 'Approved transport travel methods for resident journeys',
    iconName: 'Bus'
  },
  {
    key: 'transportApprovalStatuses',
    name: 'Transport Approval Statuses',
    department: 'Healthcare & Transport',
    description: 'Statutory approval stages for public transport requests',
    iconName: 'CheckCircle'
  },

  // --- 5. Compliance & Documents ---
  {
    key: 'complianceTypes',
    name: 'Compliance Certification Types',
    department: 'Compliance & Documents',
    description: 'Statutory building safety certificates (FRA, CP12, EICR, etc.)',
    iconName: 'ShieldCheck'
  },
  {
    key: 'complianceStatuses',
    name: 'Compliance Validity Statuses',
    department: 'Compliance & Documents',
    description: 'Certificate audit and expiry status stages',
    iconName: 'Activity'
  },
  {
    key: 'documentCategories',
    name: 'Document Hub Categories',
    department: 'Compliance & Documents',
    description: 'Categories for compliance, medical, and legal file uploads',
    iconName: 'FileText'
  },
  {
    key: 'fileFormats',
    name: 'File Attachment Formats',
    department: 'Compliance & Documents',
    description: 'Allowed document and evidence file format tags',
    iconName: 'Paperclip'
  },
  {
    key: 'documentConfidentialities',
    name: 'Document Confidentiality Levels',
    department: 'Compliance & Documents',
    description: 'Information security and GDPR privacy access tiers',
    iconName: 'Lock'
  },
  {
    key: 'vcsCategories',
    name: 'VCS Support Agency Categories',
    department: 'Compliance & Documents',
    description: 'Categories for voluntary and community sector partner agencies',
    iconName: 'Heart'
  },

  // --- 6. Operations & Governance ---
  {
    key: 'bookletStatuses',
    name: 'Welcome Booklet Statuses',
    department: 'Operations & Governance',
    description: 'Collection and delivery progress of resident welcome packs',
    iconName: 'BookOpen'
  },
  {
    key: 'welfareResidentGroups',
    name: 'Resident Household Groups',
    department: 'Operations & Governance',
    description: 'Demographic and family composition groups for residents',
    iconName: 'Users'
  },
  {
    key: 'dispersalExitStatuses',
    name: 'IA Exit Briefing Statuses',
    department: 'Operations & Governance',
    description: 'Initial accommodation exit briefing completion statuses',
    iconName: 'LogOut'
  },
  {
    key: 'dispersalLetterStatuses',
    name: 'HO Dispersal Letter Statuses',
    department: 'Operations & Governance',
    description: 'Home Office dispersal notification confirmation flags',
    iconName: 'Mail'
  },
  {
    key: 'dispersalTravelStatuses',
    name: 'Dispersal Travel Statuses',
    department: 'Operations & Governance',
    description: 'Verification of resident travel to permanent dispersal address',
    iconName: 'Plane'
  },
  {
    key: 'dispersalWarningStatuses',
    name: 'Dispersal Warning Statuses',
    department: 'Operations & Governance',
    description: 'Notice compliance check status on dispersal departures',
    iconName: 'AlertTriangle'
  },
  {
    key: 'userRoles',
    name: 'System User Roles',
    department: 'Operations & Governance',
    description: 'Platform access roles and permission tiers',
    iconName: 'Shield'
  },
  {
    key: 'councils',
    name: 'Responsible Councils & LAs',
    department: 'Operations & Governance',
    description: 'Contracted local borough councils and statutory authorities',
    iconName: 'Landmark'
  }
];

export const DEFAULT_FIELD_OPTIONS: CustomFieldOption[] = [
  // 1. Referral Types
  { id: 'opt-ref-1', category: 'referralTypes', label: 'Safeguarding Adult', value: 'Safeguarding Adult', color: 'blue', description: 'Adult safeguarding under Care Act 2014 section 42', isActive: true, isSystem: true, order: 1 },
  { id: 'opt-ref-2', category: 'referralTypes', label: 'Safeguarding Child', value: 'Safeguarding Child', color: 'purple', description: 'Children Act s17 / s47 statutory child protection', isActive: true, isSystem: true, order: 2 },
  { id: 'opt-ref-3', category: 'referralTypes', label: 'Mental Health Crisis', value: 'Mental Health', color: 'amber', description: 'Severe mental illness, sectioning, or acute crisis intervention', isActive: true, isSystem: true, order: 3 },
  { id: 'opt-ref-4', category: 'referralTypes', label: 'Domestic Abuse', value: 'Domestic Abuse', color: 'red', description: 'MARAC, high-risk domestic violence or coercion', isActive: true, isSystem: true, order: 4 },
  { id: 'opt-ref-5', category: 'referralTypes', label: 'Social Care Needs', value: 'Social Care', color: 'teal', description: 'Care package, occupational therapy, or social worker allocation', isActive: true, isSystem: true, order: 5 },
  { id: 'opt-ref-6', category: 'referralTypes', label: 'Emergency Medical Transfer', value: 'Emergency Medical', color: 'rose', description: 'Urgent hospital discharge, post-operative, or complex medical care', isActive: true, isSystem: true, order: 6 },
  { id: 'opt-ref-7', category: 'referralTypes', label: 'Substance & Addiction Support', value: 'Substance Support', color: 'amber', description: 'Referral for detox, harm reduction, or addiction specialist care', isActive: true, isSystem: false, order: 7 },
  { id: 'opt-ref-8', category: 'referralTypes', label: 'Modern Slavery / NRM', value: 'Modern Slavery', color: 'red', description: 'National Referral Mechanism trafficking or modern slavery alert', isActive: true, isSystem: false, order: 8 },

  // 2. Referral Methods
  { id: 'opt-meth-1', category: 'referralMethods', label: 'Mosaic Social Care Portal', value: 'Mosaic Portal', color: 'blue', description: 'Direct electronic submission through council Mosaic system', isActive: true, isSystem: true, order: 1 },
  { id: 'opt-meth-2', category: 'referralMethods', label: 'Encrypted CJSM / Egress Email', value: 'Encrypted Email', color: 'teal', description: 'Secure government encrypted email channel', isActive: true, isSystem: true, order: 2 },
  { id: 'opt-meth-3', category: 'referralMethods', label: 'Phone / Portal Follow-up', value: 'Phone / Portal Follow-up', color: 'slate', description: 'Urgent telephone referral followed by formal portal ticket', isActive: true, isSystem: true, order: 3 },
  { id: 'opt-meth-4', category: 'referralMethods', label: 'LA Direct Case Management', value: 'LA Direct Case Management', color: 'purple', description: 'Allocated social worker direct case handover', isActive: true, isSystem: true, order: 4 },
  { id: 'opt-meth-5', category: 'referralMethods', label: 'Home Office Statutory Form', value: 'Home Office Form', color: 'amber', description: 'Direct asylum support statutory transfer documentation', isActive: true, isSystem: false, order: 5 },

  // 3. Vulnerabilities
  { id: 'opt-vuln-1', category: 'vulnerabilities', label: 'Antenatal / Postnatal & Infant', value: 'Antenatal / Postnatal', color: 'purple', description: 'Expectant mothers or mothers with infant under 1 year', isActive: true, isSystem: true, order: 1 },
  { id: 'opt-vuln-2', category: 'vulnerabilities', label: 'Severe Mobility / Wheelchair Dependent', value: 'Severe Mobility Limitation', color: 'blue', description: 'Requires ground floor room, grab rails, or accessible wet room', isActive: true, isSystem: true, order: 2 },
  { id: 'opt-vuln-3', category: 'vulnerabilities', label: 'Mental Health & PTSD', value: 'Severe Mental Health', color: 'amber', description: 'Active psychiatric treatment, trauma, suicidal ideation monitoring', isActive: true, isSystem: true, order: 3 },
  { id: 'opt-vuln-4', category: 'vulnerabilities', label: 'Chronic Medical / Renal / Cardiac', value: 'Chronic Medical Condition', color: 'red', description: 'Dialysis, insulin-dependent diabetes, cardiac or oncology care', isActive: true, isSystem: true, order: 4 },
  { id: 'opt-vuln-5', category: 'vulnerabilities', label: 'Elderly Frail Resident (65+)', value: 'Elderly / Frail', color: 'slate', description: 'Age-related vulnerability requiring daily welfare visits', isActive: true, isSystem: true, order: 5 },
  { id: 'opt-vuln-6', category: 'vulnerabilities', label: 'Cognitive Impairment / Dementia', value: 'Cognitive Impairment', color: 'teal', description: 'Memory loss, wandering risk, or developmental disability', isActive: true, isSystem: false, order: 6 },
  { id: 'opt-vuln-7', category: 'vulnerabilities', label: 'Sensory Impairment (Visual/Auditory)', value: 'Sensory Impairment', color: 'blue', description: 'Deaf, hard of hearing, or visually impaired requiring vibrating alarms', isActive: true, isSystem: false, order: 7 },

  // 4. Incident Types (Challenging / ASB)
  { id: 'opt-inc-1', category: 'incidentTypes', label: 'Physical Altercation / Violence', value: 'Physical Altercation', color: 'red', description: 'Fighting, assault on staff or fellow resident', isActive: true, isSystem: true, order: 1 },
  { id: 'opt-inc-2', category: 'incidentTypes', label: 'Verbal Abuse & Aggression', value: 'Verbal Abuse / Threats', color: 'amber', description: 'Threatening language, harassment, or verbal intimidation', isActive: true, isSystem: true, order: 2 },
  { id: 'opt-inc-3', category: 'incidentTypes', label: 'Substance Misuse / Contraband', value: 'Substance Misuse', color: 'purple', description: 'Illicit drugs, alcohol intoxication, or smoking in rooms', isActive: true, isSystem: true, order: 3 },
  { id: 'opt-inc-4', category: 'incidentTypes', label: 'Mental Health Crisis / Self-Harm', value: 'Mental Health Crisis', color: 'rose', description: 'Acute distress, threats of self-harm, or severe paranoia', isActive: true, isSystem: true, order: 4 },
  { id: 'opt-inc-5', category: 'incidentTypes', label: 'Curfew & Building Rule Breach', value: 'Curfew / Rule Breach', color: 'slate', description: 'Late return, unauthorized overnight guests, or door tampering', isActive: true, isSystem: true, order: 5 },
  { id: 'opt-inc-6', category: 'incidentTypes', label: 'Property Damage / Vandalism', value: 'Property Damage', color: 'red', description: 'Broken doors, smashed fixtures, fire alarm tampering', isActive: true, isSystem: true, order: 6 },
  { id: 'opt-inc-7', category: 'incidentTypes', label: 'Noise Nuisance & Disturbance', value: 'Noise Nuisance', color: 'blue', description: 'Loud music, shouting after quiet hours (23:00-07:00)', isActive: true, isSystem: false, order: 7 },

  // 5. Incident Severity Levels
  { id: 'opt-sev-1', category: 'incidentRiskFactors', label: 'Minor Concern (Stage 1)', value: 'Minor', color: 'slate', description: 'First minor infraction, resolved with informal warning', isActive: true, isSystem: true, order: 1 },
  { id: 'opt-sev-2', category: 'incidentRiskFactors', label: 'Moderate Risk (Stage 2)', value: 'Moderate', color: 'blue', description: 'Repeated non-compliance or heightened disruption', isActive: true, isSystem: true, order: 2 },
  { id: 'opt-sev-3', category: 'incidentRiskFactors', label: 'High Severity (Stage 3)', value: 'High', color: 'amber', description: 'Requires management intervention, formal written warning', isActive: true, isSystem: true, order: 3 },
  { id: 'opt-sev-4', category: 'incidentRiskFactors', label: 'Critical Emergency (Stage 4)', value: 'Critical', color: 'red', description: 'Immediate police / 999 call or emergency eviction referral', isActive: true, isSystem: true, order: 4 },

  // Urgency / Risk Levels — values MUST match the RiskLevel union in types/index.ts.
  // ReferralsView reads this category for its Urgency Priority control; the
  // category did not exist, so the control rendered a single fallback option and
  // High / Critical could never be selected — which also meant the automated
  // High/Critical safeguarding email alert could never fire (BUG-010).
  { id: 'opt-risk-1', category: 'riskLevels', label: 'Low', value: 'Low', color: 'slate', description: 'Routine monitoring, no immediate action required', isActive: true, isSystem: true, order: 1 },
  { id: 'opt-risk-2', category: 'riskLevels', label: 'Medium', value: 'Medium', color: 'blue', description: 'Standard safeguarding follow-up within agreed timescales', isActive: true, isSystem: true, order: 2 },
  { id: 'opt-risk-3', category: 'riskLevels', label: 'High', value: 'High', color: 'amber', description: 'Priority response required; triggers an automated alert', isActive: true, isSystem: true, order: 3 },
  { id: 'opt-risk-4', category: 'riskLevels', label: 'Critical', value: 'Critical', color: 'red', description: 'Immediate escalation; triggers an automated alert', isActive: true, isSystem: true, order: 4 },

  // 6. Escalation Authorities
  { id: 'opt-esc-1', category: 'escalationAuthorities', label: 'Metropolitan Police Service (999/101)', value: 'Met Police', color: 'blue', description: 'Emergency 999 or non-emergency 101 incident CAD log', isActive: true, isSystem: true, order: 1 },
  { id: 'opt-esc-2', category: 'escalationAuthorities', label: 'NHS London Ambulance (999)', value: 'NHS Ambulance 999', color: 'red', description: 'Acute medical emergencies and hospital transfer', isActive: true, isSystem: true, order: 2 },
  { id: 'opt-esc-3', category: 'escalationAuthorities', label: 'Adult Social Care MASH', value: 'Adult MASH Team', color: 'purple', description: 'Multi-Agency Safeguarding Hub for vulnerable adults', isActive: true, isSystem: true, order: 3 },
  { id: 'opt-esc-4', category: 'escalationAuthorities', label: 'Children’s Emergency Duty Team (EDT)', value: 'Children Social Care EDT', color: 'teal', description: 'Out-of-hours and statutory children social services', isActive: true, isSystem: true, order: 4 },
  { id: 'opt-esc-5', category: 'escalationAuthorities', label: 'NHS 111 & Crisis Line', value: 'NHS 111 Crisis Team', color: 'emerald', description: 'Non-emergency clinical advice or mental health triage', isActive: true, isSystem: true, order: 5 },
  { id: 'opt-esc-6', category: 'escalationAuthorities', label: 'Home Office Safeguarding Hub', value: 'Home Office Safeguarding', color: 'amber', description: 'Statutory notification for Section 95 / Section 98 cases', isActive: true, isSystem: false, order: 6 },

  // 7. Maintenance Priorities
  { id: 'opt-maint-1', category: 'maintenancePriorities', label: 'CAT 1 - Emergency (4 Hours)', value: 'CAT 1', color: 'red', description: 'Risk to life, complete power loss, gas leak, severe water burst', isActive: true, isSystem: true, order: 1 },
  { id: 'opt-maint-2', category: 'maintenancePriorities', label: 'CAT 2 - Urgent (24 Hours)', value: 'CAT 2', color: 'amber', description: 'Heating failure in winter, blocked toilet in single facility', isActive: true, isSystem: true, order: 2 },
  { id: 'opt-maint-3', category: 'maintenancePriorities', label: 'CAT 3 - Routine (7 Days)', value: 'CAT 3', color: 'blue', description: 'Minor leak, faulty window catch, non-urgent door adjustment', isActive: true, isSystem: true, order: 3 },
  { id: 'opt-maint-4', category: 'maintenancePriorities', label: 'CAT 4 - Planned Works (28 Days)', value: 'CAT 4', color: 'slate', description: 'Painting, cyclical redecoration, cosmetic maintenance', isActive: true, isSystem: false, order: 4 },

  // 8. Maintenance Time Scales
  { id: 'opt-scale-1', category: 'maintenanceTimeScales', label: '4 Hours (Immediate)', value: '4 Hours', color: 'red', description: 'Contractor on site within 4 hours', isActive: true, isSystem: true, order: 1 },
  { id: 'opt-scale-2', category: 'maintenanceTimeScales', label: '24 Hours (Next Day)', value: '24 Hours', color: 'amber', description: 'Repaired or made safe within 24 hours', isActive: true, isSystem: true, order: 2 },
  { id: 'opt-scale-3', category: 'maintenanceTimeScales', label: '48 Hours (2 Working Days)', value: '48 Hours', color: 'blue', description: 'Resolution within two calendar days', isActive: true, isSystem: false, order: 3 },
  { id: 'opt-scale-4', category: 'maintenanceTimeScales', label: '7 Days (Standard Week)', value: '7 Days', color: 'teal', description: 'Routine repair cycle turnaround', isActive: true, isSystem: true, order: 4 },

  // 9. Meal Types
  { id: 'opt-meal-1', category: 'mealTypes', label: 'Continental & Hot Breakfast', value: 'Breakfast', color: 'amber', description: 'Morning breakfast service (07:00 - 09:30)', isActive: true, isSystem: true, order: 1 },
  { id: 'opt-meal-2', category: 'mealTypes', label: 'Lunch Hot Entrée Service', value: 'Lunch', color: 'blue', description: 'Midday cooked meal service (12:00 - 14:00)', isActive: true, isSystem: true, order: 2 },
  { id: 'opt-meal-3', category: 'mealTypes', label: 'Evening Hot Dinner', value: 'Dinner', color: 'purple', description: 'Evening main dinner service (18:00 - 20:30)', isActive: true, isSystem: true, order: 3 },
  { id: 'opt-meal-4', category: 'mealTypes', label: 'Packed Lunch / Late Box', value: 'Packed Lunch', color: 'teal', description: 'Portioned takeaway box for residents attending medical appointments', isActive: true, isSystem: false, order: 4 },

  // 10. Dietary Requirements
  { id: 'opt-diet-1', category: 'dietaryTypes', label: 'Halal Certified (HMC)', value: 'Halal', color: 'emerald', description: 'Standard certified Halal meat and ingredients', isActive: true, isSystem: true, order: 1 },
  { id: 'opt-diet-2', category: 'dietaryTypes', label: 'Vegetarian (Lacto-Ovo)', value: 'Vegetarian', color: 'teal', description: 'Meat-free dishes including dairy and eggs', isActive: true, isSystem: true, order: 2 },
  { id: 'opt-diet-3', category: 'dietaryTypes', label: 'Strict Vegan (Plant-Based)', value: 'Vegan', color: 'green', description: '100% plant-based meal, no animal by-products', isActive: true, isSystem: true, order: 3 },
  { id: 'opt-diet-4', category: 'dietaryTypes', label: 'Diabetic Managed Diet', value: 'Diabetic', color: 'blue', description: 'Low GI carbohydrates, zero added sugar', isActive: true, isSystem: true, order: 4 },
  { id: 'opt-diet-5', category: 'dietaryTypes', label: 'Gluten Free (Coeliac Safe)', value: 'Gluten Free', color: 'amber', description: 'Separate preparation to prevent gluten cross-contamination', isActive: true, isSystem: true, order: 5 },
  { id: 'opt-diet-6', category: 'dietaryTypes', label: 'Nut Free (Severe Anaphylaxis)', value: 'Nut Free', color: 'red', description: 'Strict zero-peanut and tree-nut allergen protocol', isActive: true, isSystem: false, order: 6 },
  { id: 'opt-diet-7', category: 'dietaryTypes', label: 'Renal / Low Sodium Diet', value: 'Renal Diet', color: 'slate', description: 'Low potassium and restricted sodium for kidney care', isActive: true, isSystem: false, order: 7 },

  // 11. Laundry Stages
  { id: 'opt-lnd-1', category: 'laundryStages', label: 'Bag Dropped & Queued', value: 'Queued', color: 'slate', description: 'Bag registered at reception and queued for commercial cycle', isActive: true, isSystem: true, order: 1 },
  { id: 'opt-lnd-2', category: 'laundryStages', label: 'In Washing Machine', value: 'In Washing', color: 'blue', description: 'Washing cycle in progress (60°C thermal wash)', isActive: true, isSystem: true, order: 2 },
  { id: 'opt-lnd-3', category: 'laundryStages', label: 'Commercial Tumbler Drying', value: 'In Drying', color: 'amber', description: 'High-temperature industrial tumble drying', isActive: true, isSystem: true, order: 3 },
  { id: 'opt-lnd-4', category: 'laundryStages', label: 'Folded, Packed & Ready', value: 'Clean & Ready', color: 'emerald', description: 'Packed in clean liner bag, awaiting resident collection', isActive: true, isSystem: true, order: 4 },
  { id: 'opt-lnd-5', category: 'laundryStages', label: 'Collected & Signed For', value: 'Collected', color: 'purple', description: 'Handed over to resident with signature confirmed', isActive: true, isSystem: true, order: 5 },

  // 12. Responsible Councils
  { id: 'opt-cl-1', category: 'councils', label: 'Westminster City Council', value: 'Westminster City Council', color: 'blue', description: 'Central London contract authority', isActive: true, isSystem: true, order: 1 },
  { id: 'opt-cl-2', category: 'councils', label: 'Croydon Council', value: 'Croydon Council', color: 'purple', description: 'South London key statutory partner', isActive: true, isSystem: true, order: 2 },
  { id: 'opt-cl-3', category: 'councils', label: 'Camden Council', value: 'Camden Council', color: 'teal', description: 'North London local authority partner', isActive: true, isSystem: true, order: 3 },
  { id: 'opt-cl-4', category: 'councils', label: 'Lambeth Council', value: 'Lambeth Council', color: 'amber', description: 'South London council contractor', isActive: true, isSystem: true, order: 4 },
  { id: 'opt-cl-5', category: 'councils', label: 'Brent Council', value: 'Brent Council', color: 'emerald', description: 'North West London borough contractor', isActive: true, isSystem: true, order: 5 },
  { id: 'opt-cl-6', category: 'councils', label: 'Newham Council', value: 'Newham Council', color: 'red', description: 'East London statutory housing partner', isActive: true, isSystem: true, order: 6 },
  { id: 'opt-cl-7', category: 'councils', label: 'Hackney Council', value: 'Hackney Council', color: 'slate', description: 'East London borough partner', isActive: true, isSystem: true, order: 7 },
  { id: 'opt-cl-8', category: 'councils', label: 'Ealing Council', value: 'Ealing Council', color: 'blue', description: 'West London borough partner', isActive: true, isSystem: false, order: 8 },
  { id: 'opt-cl-9', category: 'councils', label: 'Hillingdon Council', value: 'Hillingdon Council', color: 'teal', description: 'Heathrow corridor statutory partner', isActive: true, isSystem: false, order: 9 },

  // 13. Referral Statuses
  { id: 'opt-rstat-1', category: 'referralStatuses', label: 'Open', value: 'Open', color: 'blue', description: 'New referral pending review or assessment', isActive: true, isSystem: true, order: 1 },
  { id: 'opt-rstat-2', category: 'referralStatuses', label: 'In progress', value: 'In progress', color: 'amber', description: 'Active investigation, multi-agency engagement, or placement ongoing', isActive: true, isSystem: true, order: 2 },
  { id: 'opt-rstat-3', category: 'referralStatuses', label: 'Completed', value: 'Completed', color: 'emerald', description: 'Referral processed and confirmed outcomes archived', isActive: true, isSystem: true, order: 3 },
  { id: 'opt-rstat-4', category: 'referralStatuses', label: 'Archived', value: 'Archived', color: 'purple', description: 'Closed or archived statutory case', isActive: true, isSystem: true, order: 4 },

  // 14. Vulnerable Resident Statuses
  { id: 'opt-vstat-1', category: 'vulnerableStatuses', label: 'Active', value: 'Active', color: 'emerald', description: 'Active safeguarding and daily welfare monitoring', isActive: true, isSystem: true, order: 1 },
  { id: 'opt-vstat-2', category: 'vulnerableStatuses', label: 'Under Review', value: 'Under Review', color: 'amber', description: 'Case undergoing safeguarding panel or risk re-assessment', isActive: true, isSystem: true, order: 2 },
  { id: 'opt-vstat-3', category: 'vulnerableStatuses', label: 'High Risk Review', value: 'High Risk', color: 'red', description: 'Escalated vulnerability needing immediate intervention', isActive: true, isSystem: false, order: 3 },
  { id: 'opt-vstat-4', category: 'vulnerableStatuses', label: 'Archived', value: 'Archived', color: 'purple', description: 'Resident discharged, transferred, or monitoring completed', isActive: true, isSystem: true, order: 4 },

  // 15. Challenging Behaviour Statuses
  { id: 'opt-cstat-1', category: 'challengingStatuses', label: 'Active', value: 'Active', color: 'amber', description: 'Active incident log under operational monitoring', isActive: true, isSystem: true, order: 1 },
  { id: 'opt-cstat-2', category: 'challengingStatuses', label: 'Under Review', value: 'Under Review', color: 'blue', description: 'Under review by safeguarding team or site management', isActive: true, isSystem: true, order: 2 },
  { id: 'opt-cstat-3', category: 'challengingStatuses', label: 'Under Investigation', value: 'Under Investigation', color: 'purple', description: 'Formal inquiry, CCTV review, or police report ongoing', isActive: true, isSystem: false, order: 3 },
  { id: 'opt-cstat-4', category: 'challengingStatuses', label: 'Resolved', value: 'Resolved', color: 'emerald', description: 'De-escalated and mutually agreed behavior plan in place', isActive: true, isSystem: false, order: 4 },
  { id: 'opt-cstat-5', category: 'challengingStatuses', label: 'Archived', value: 'Archived', color: 'slate', description: 'Historical incident logged and archived', isActive: true, isSystem: true, order: 5 },

  // 16. Escalation Case Statuses
  { id: 'opt-estat-1', category: 'escalationStatuses', label: 'Open', value: 'Open', color: 'red', description: 'Active emergency escalation requiring urgent response', isActive: true, isSystem: true, order: 1 },
  { id: 'opt-estat-2', category: 'escalationStatuses', label: 'Under Investigation', value: 'Under Investigation', color: 'amber', description: 'Multi-agency review, police liaison, or emergency services on scene', isActive: true, isSystem: true, order: 2 },
  { id: 'opt-estat-3', category: 'escalationStatuses', label: 'Action Taken', value: 'Action Taken', color: 'blue', description: 'Safeguarding team or management intervention executed', isActive: true, isSystem: true, order: 3 },
  { id: 'opt-estat-4', category: 'escalationStatuses', label: 'Escalated to Police', value: 'Escalated to Police', color: 'purple', description: 'CAD number generated and formal police report logged', isActive: true, isSystem: false, order: 4 },
  { id: 'opt-estat-5', category: 'escalationStatuses', label: 'Resolved', value: 'Resolved', color: 'emerald', description: 'Crisis de-escalated and all safety plans implemented', isActive: true, isSystem: true, order: 5 },
  { id: 'opt-estat-6', category: 'escalationStatuses', label: 'Closed', value: 'Closed', color: 'slate', description: 'Statutory incident file formally signed off and closed', isActive: true, isSystem: true, order: 6 },

  // 17. Maintenance Defect Statuses
  { id: 'opt-mstat-1', category: 'maintenanceStatuses', label: 'Open / Reported', value: 'Open', color: 'red', description: 'Ticket logged and awaiting contractor or site inspection', isActive: true, isSystem: true, order: 1 },
  { id: 'opt-mstat-2', category: 'maintenanceStatuses', label: 'In Progress', value: 'In Progress', color: 'amber', description: 'Contractor assigned and repair works underway', isActive: true, isSystem: true, order: 2 },
  { id: 'opt-mstat-3', category: 'maintenanceStatuses', label: 'Awaiting Parts', value: 'Awaiting Parts', color: 'purple', description: 'Specialist components, glazing, or materials ordered', isActive: true, isSystem: false, order: 3 },
  { id: 'opt-mstat-4', category: 'maintenanceStatuses', label: 'Contractor Booked', value: 'Contractor Booked', color: 'blue', description: 'External trade engineer appointed with site visit date confirmed', isActive: true, isSystem: false, order: 4 },
  { id: 'opt-mstat-5', category: 'maintenanceStatuses', label: 'Completed', value: 'Completed', color: 'emerald', description: 'Defect successfully remedied and signed off', isActive: true, isSystem: true, order: 5 },
  { id: 'opt-mstat-6', category: 'maintenanceStatuses', label: 'Cancelled', value: 'Cancelled', color: 'slate', description: 'Duplicate report or work order cancelled', isActive: true, isSystem: false, order: 6 },

  // 18. Food Service Statuses
  { id: 'opt-fstat-1', category: 'foodStatuses', label: 'Delivered & Accepted', value: 'Delivered', color: 'emerald', description: 'Meal safely delivered to resident and verified', isActive: true, isSystem: true, order: 1 },
  { id: 'opt-fstat-2', category: 'foodStatuses', label: 'Pending Distribution', value: 'Pending', color: 'blue', description: 'Prepared and scheduled for room distribution', isActive: true, isSystem: true, order: 2 },
  { id: 'opt-fstat-3', category: 'foodStatuses', label: 'Refused by Resident', value: 'Refused', color: 'red', description: 'Resident declined meal service at door', isActive: true, isSystem: true, order: 3 },
  { id: 'opt-fstat-4', category: 'foodStatuses', label: 'Not in Room / Absent', value: 'Not in Room', color: 'amber', description: 'Resident did not answer room knock during service window', isActive: true, isSystem: true, order: 4 },
  { id: 'opt-fstat-5', category: 'foodStatuses', label: 'Cancelled', value: 'Cancelled', color: 'slate', description: 'Order cancelled due to hospital appointment or leave', isActive: true, isSystem: false, order: 5 },

  // 19. Warning Letter & Notice Statuses
  { id: 'opt-wl-1', category: 'wlIssuedStatuses', label: 'No Warning Letter', value: 'No', color: 'slate', description: 'No statutory warning letter issued', isActive: true, isSystem: true, order: 1 },
  { id: 'opt-wl-2', category: 'wlIssuedStatuses', label: 'Warning Letter Issued', value: 'Warning Letter Issued', color: 'amber', description: 'Formal written warning issued to resident', isActive: true, isSystem: true, order: 2 },
  { id: 'opt-wl-3', category: 'wlIssuedStatuses', label: 'Notice to Quit (NTQ)', value: 'Notice to Quit', color: 'purple', description: 'Formal eviction notice to quit served', isActive: true, isSystem: true, order: 3 },
  { id: 'opt-wl-4', category: 'wlIssuedStatuses', label: 'Yes (General Action)', value: 'Yes', color: 'red', description: 'Action confirmed and issued', isActive: true, isSystem: true, order: 4 },
  { id: 'opt-wl-5', category: 'wlIssuedStatuses', label: 'Not Applicable', value: 'N/A', color: 'slate', description: 'Not applicable for this incident type', isActive: true, isSystem: true, order: 5 },

  // 20. Room Accommodation Types
  { id: 'opt-room-1', category: 'propertyRoomTypes', label: 'Single En-Suite Room', value: 'Single En-Suite Room', color: 'blue', description: 'Single resident en-suite room', isActive: true, isSystem: true, order: 1 },
  { id: 'opt-room-2', category: 'propertyRoomTypes', label: 'Twin Room', value: 'Twin Room', color: 'teal', description: 'Twin beds for 2 individuals', isActive: true, isSystem: true, order: 2 },
  { id: 'opt-room-3', category: 'propertyRoomTypes', label: 'Double Room', value: 'Double Room', color: 'purple', description: 'Double occupancy room', isActive: true, isSystem: true, order: 3 },
  { id: 'opt-room-4', category: 'propertyRoomTypes', label: 'Family Room / Studio', value: 'Family Room', color: 'amber', description: 'Multiple bed unit for family placements', isActive: true, isSystem: true, order: 4 },
  { id: 'opt-room-5', category: 'propertyRoomTypes', label: 'Self-Contained Flat', value: 'Self-Contained Flat', color: 'emerald', description: 'Kitchen and living space included', isActive: true, isSystem: true, order: 5 },
  { id: 'opt-room-6', category: 'propertyRoomTypes', label: 'Accessible / DDA Room', value: 'Accessible Room', color: 'rose', description: 'Wheelchair accessible unit with hoist/wetroom', isActive: true, isSystem: true, order: 6 },

  // 21. Property Operational Statuses
  { id: 'opt-pstat-1', category: 'propertyStatuses', label: 'Active / Contracted', value: 'Active', color: 'emerald', description: 'Operational hotel receiving resident placements', isActive: true, isSystem: true, order: 1 },
  { id: 'opt-pstat-2', category: 'propertyStatuses', label: 'Under Refurbishment', value: 'Refurbishment', color: 'amber', description: 'Temporary pause for planned maintenance or upgrades', isActive: true, isSystem: true, order: 2 },
  { id: 'opt-pstat-3', category: 'propertyStatuses', label: 'Pending Mobilisation', value: 'Mobilisation', color: 'blue', description: 'Onboarding property undergoing Home Office compliance audit', isActive: true, isSystem: true, order: 3 },
  { id: 'opt-pstat-4', category: 'propertyStatuses', label: 'Decommissioned', value: 'Decommissioned', color: 'slate', description: 'Contract terminated and handed back to landlord', isActive: true, isSystem: true, order: 4 },

  // 22. Food Catering Vendors
  { id: 'opt-fvend-1', category: 'foodVendors', label: 'A&M Catering', value: 'A&M', color: 'amber', description: 'Contracted halal hot meal delivery vendor', isActive: true, isSystem: true, order: 1 },
  { id: 'opt-fvend-2', category: 'foodVendors', label: 'Freshbite Kitchens', value: 'Freshbite', color: 'emerald', description: 'Continental and cultural hot meal catering partner', isActive: true, isSystem: true, order: 2 },
  { id: 'opt-fvend-3', category: 'foodVendors', label: '9 Cuisines Catering', value: '9 Cuisines', color: 'blue', description: 'Multi-dietary meal distribution service', isActive: true, isSystem: true, order: 3 },
  { id: 'opt-fvend-4', category: 'foodVendors', label: 'Sands Catering', value: 'Sands', color: 'purple', description: 'Commercial buffet and dry provision partner', isActive: true, isSystem: true, order: 4 },

  // 23. Laundry Log Period Types
  { id: 'opt-lper-1', category: 'laundryPeriodTypes', label: 'Weekly Log', value: 'Weekly', color: 'teal', description: 'Weekly operational laundry intake and return audit', isActive: true, isSystem: true, order: 1 },
  { id: 'opt-lper-2', category: 'laundryPeriodTypes', label: 'Monthly Reconciled Log', value: 'Monthly', color: 'purple', description: 'Monthly batch invoice and stock reconciliation', isActive: true, isSystem: true, order: 2 },

  // 24. Discrepancy Statuses
  { id: 'opt-disc-1', category: 'discrepancyStatuses', label: 'No Variance / Reconciled', value: 'No', color: 'emerald', description: 'Inventory counts fully balance', isActive: true, isSystem: true, order: 1 },
  { id: 'opt-disc-2', category: 'discrepancyStatuses', label: 'Variance Reported (Yes)', value: 'Yes', color: 'amber', description: 'Discrepancy identified between dispatch and returned stock', isActive: true, isSystem: true, order: 2 },

  // 25. GP Appointment Statuses
  { id: 'opt-gpstat-1', category: 'gpAppointmentStatuses', label: 'Scheduled', value: 'Scheduled', color: 'blue', description: 'Appointment confirmed with clinic', isActive: true, isSystem: true, order: 1 },
  { id: 'opt-gpstat-2', category: 'gpAppointmentStatuses', label: 'Attended', value: 'Attended', color: 'emerald', description: 'Service user attended consultation', isActive: true, isSystem: true, order: 2 },
  { id: 'opt-gpstat-3', category: 'gpAppointmentStatuses', label: 'Did Not Attend (DNA)', value: 'Did Not Attend (DNA)', color: 'red', description: 'Resident missed appointment without prior notice', isActive: true, isSystem: true, order: 3 },
  { id: 'opt-gpstat-4', category: 'gpAppointmentStatuses', label: 'Cancelled', value: 'Cancelled', color: 'slate', description: 'Cancelled by patient or clinic in advance', isActive: true, isSystem: true, order: 4 },
  { id: 'opt-gpstat-5', category: 'gpAppointmentStatuses', label: 'Rescheduled', value: 'Rescheduled', color: 'amber', description: 'Moved to a later consultation date', isActive: true, isSystem: true, order: 5 },

  // 26. Public Transport Modes
  { id: 'opt-tmode-1', category: 'transportModes', label: 'Local Bus Service', value: 'Bus', color: 'blue', description: 'TfL or regional bus route journey', isActive: true, isSystem: true, order: 1 },
  { id: 'opt-tmode-2', category: 'transportModes', label: 'National Rail / Train', value: 'Train', color: 'purple', description: 'Intercity or commuter rail transit', isActive: true, isSystem: true, order: 2 },
  { id: 'opt-tmode-3', category: 'transportModes', label: 'London Underground (Tube)', value: 'Underground', color: 'indigo', description: 'Subway transport transit', isActive: true, isSystem: true, order: 3 },
  { id: 'opt-tmode-4', category: 'transportModes', label: 'Tramway', value: 'Tram', color: 'teal', description: 'Light rail / tram system', isActive: true, isSystem: true, order: 4 },
  { id: 'opt-tmode-5', category: 'transportModes', label: 'Approved Taxi / Cab', value: 'Taxi', color: 'amber', description: 'Authorised private hire vehicle for high vulnerability', isActive: true, isSystem: true, order: 5 },
  { id: 'opt-tmode-6', category: 'transportModes', label: 'Walking Escort', value: 'Walking', color: 'emerald', description: 'Pedestrian staff-accompanied transfer', isActive: true, isSystem: true, order: 6 },

  // 27. Transport Approval Statuses
  { id: 'opt-tstat-1', category: 'transportApprovalStatuses', label: 'Pending Review', value: 'Pending', color: 'amber', description: 'Awaiting manager approval and travel voucher', isActive: true, isSystem: true, order: 1 },
  { id: 'opt-tstat-2', category: 'transportApprovalStatuses', label: 'Approved & Authorised', value: 'Approved', color: 'emerald', description: 'Journey approved and ticket funds issued', isActive: true, isSystem: true, order: 2 },
  { id: 'opt-tstat-3', category: 'transportApprovalStatuses', label: 'Journey Completed', value: 'Completed', color: 'blue', description: 'Resident arrived safely and returned tokens logged', isActive: true, isSystem: true, order: 3 },
  { id: 'opt-tstat-4', category: 'transportApprovalStatuses', label: 'Cancelled / Rejected', value: 'Cancelled', color: 'red', description: 'Booking cancelled or request rejected', isActive: true, isSystem: true, order: 4 },

  // 28. Statutory Compliance Certification Types
  { id: 'opt-ctype-1', category: 'complianceTypes', label: 'Fire Risk Assessment (FRA)', value: 'Fire Risk Assessment (FRA)', color: 'red', description: 'Annual statutory FRA review', isActive: true, isSystem: true, order: 1 },
  { id: 'opt-ctype-2', category: 'complianceTypes', label: 'Gas Safety Certificate (CP12)', value: 'Gas Safety Certificate (CP12)', color: 'amber', description: 'Commercial boiler & gas appliance certification', isActive: true, isSystem: true, order: 2 },
  { id: 'opt-ctype-3', category: 'complianceTypes', label: 'Electrical Condition Report (EICR)', value: 'Electrical Installation Condition Report (EICR)', color: 'blue', description: '5-year fixed electrical installation safety inspection', isActive: true, isSystem: true, order: 3 },
  { id: 'opt-ctype-4', category: 'complianceTypes', label: 'Emergency Lighting Testing', value: 'Emergency Lighting Testing', color: 'teal', description: 'Annual 3-hour discharge and periodic operational check', isActive: true, isSystem: true, order: 4 },
  { id: 'opt-ctype-5', category: 'complianceTypes', label: 'Fire Alarm & Detection Inspection', value: 'Fire Alarm & Detection Inspection', color: 'rose', description: 'Quarterly BS5839 fire alarm maintenance audit', isActive: true, isSystem: true, order: 5 },
  { id: 'opt-ctype-6', category: 'complianceTypes', label: 'Legionella Risk Assessment (LRA)', value: 'Legionella Risk Assessment (LRA)', color: 'cyan', description: 'Water system bacterial risk survey and temperature logging', isActive: true, isSystem: true, order: 6 },
  { id: 'opt-ctype-7', category: 'complianceTypes', label: 'PAT Portable Appliance Testing', value: 'PAT Testing', color: 'purple', description: 'Electrical safety testing for small appliances and irons', isActive: true, isSystem: true, order: 7 },
  { id: 'opt-ctype-8', category: 'complianceTypes', label: 'Asbestos Management Survey', value: 'Asbestos Management Survey', color: 'slate', description: 'Non-domestic property asbestos register and risk rating', isActive: true, isSystem: true, order: 8 },
  { id: 'opt-ctype-9', category: 'complianceTypes', label: 'Lift Inspection (LOLER)', value: 'Lift Inspection (LOLER)', color: 'indigo', description: 'Statutory 6-monthly passenger lift engineering inspection', isActive: true, isSystem: true, order: 9 },
  { id: 'opt-ctype-10', category: 'complianceTypes', label: 'Building Insurance Certificate', value: 'Building Insurance Certificate', color: 'emerald', description: 'Property and public liability coverage policy', isActive: true, isSystem: true, order: 10 },

  // 29. Compliance Validity Statuses
  { id: 'opt-cstat-comp-1', category: 'complianceStatuses', label: 'Compliant (Valid)', value: 'Compliant', color: 'emerald', description: 'Certificate valid and within inspection date', isActive: true, isSystem: true, order: 1 },
  { id: 'opt-cstat-comp-2', category: 'complianceStatuses', label: 'Expiring Soon (30 Days)', value: 'Expiring Soon', color: 'amber', description: 'Renewal scheduled within current month', isActive: true, isSystem: true, order: 2 },
  { id: 'opt-cstat-comp-3', category: 'complianceStatuses', label: 'Expired (Immediate Action)', value: 'Expired', color: 'red', description: 'Certificate lapsed and requires urgent contractor visit', isActive: true, isSystem: true, order: 3 },
  { id: 'opt-cstat-comp-4', category: 'complianceStatuses', label: 'In Progress / Booked', value: 'In Progress', color: 'blue', description: 'Contractor appointed and site inspection underway', isActive: true, isSystem: true, order: 4 },
  { id: 'opt-cstat-comp-5', category: 'complianceStatuses', label: 'Overdue Penalty Notice', value: 'Overdue', color: 'red', description: 'Statutory deadline breached', isActive: true, isSystem: true, order: 5 },

  // 30. Document Hub Categories
  { id: 'opt-doccat-1', category: 'documentCategories', label: 'Risk Assessment', value: 'Risk Assessment', color: 'amber', description: 'Individual risk assessment document', isActive: true, isSystem: true, order: 1 },
  { id: 'opt-doccat-2', category: 'documentCategories', label: 'Incident Report', value: 'Incident Report', color: 'red', description: 'Signed incident log or police disclosure', isActive: true, isSystem: true, order: 2 },
  { id: 'opt-doccat-3', category: 'documentCategories', label: 'Medical Assessment', value: 'Medical Assessment', color: 'blue', description: 'Clinical letter or hospital discharge paperwork', isActive: true, isSystem: true, order: 3 },
  { id: 'opt-doccat-4', category: 'documentCategories', label: 'Safeguarding Dossier', value: 'Safeguarding Dossier', color: 'purple', description: 'Statutory safeguarding case folder', isActive: true, isSystem: true, order: 4 },
  { id: 'opt-doccat-5', category: 'documentCategories', label: 'Police Report / CAD', value: 'Police Report', color: 'slate', description: 'Police CAD log or formal crime reference sheet', isActive: true, isSystem: true, order: 5 },
  { id: 'opt-doccat-6', category: 'documentCategories', label: 'Compliance Certificate', value: 'Compliance Certificate', color: 'emerald', description: 'Statutory property safety signoff', isActive: true, isSystem: true, order: 6 },
  { id: 'opt-doccat-7', category: 'documentCategories', label: 'Legal Notice', value: 'Legal Notice', color: 'rose', description: 'Solicitor or Home Office formal correspondence', isActive: true, isSystem: true, order: 7 },

  // 31. Supported File Formats
  { id: 'opt-fmt-1', category: 'fileFormats', label: 'PDF Document', value: 'PDF', color: 'red', description: 'Adobe Portable Document Format', isActive: true, isSystem: true, order: 1 },
  { id: 'opt-fmt-2', category: 'fileFormats', label: 'Word Document (DOCX)', value: 'DOCX', color: 'blue', description: 'Microsoft Word document', isActive: true, isSystem: true, order: 2 },
  { id: 'opt-fmt-3', category: 'fileFormats', label: 'Excel Spreadsheet (XLSX)', value: 'XLSX', color: 'emerald', description: 'Microsoft Excel workbook', isActive: true, isSystem: true, order: 3 },
  { id: 'opt-fmt-4', category: 'fileFormats', label: 'JPEG Image (JPG)', value: 'JPG', color: 'purple', description: 'Photo evidence file', isActive: true, isSystem: true, order: 4 },
  { id: 'opt-fmt-5', category: 'fileFormats', label: 'PNG Image', value: 'PNG', color: 'teal', description: 'Lossless graphic or screenshot', isActive: true, isSystem: true, order: 5 },

  // 32. Document Confidentialities
  { id: 'opt-conf-1', category: 'documentConfidentialities', label: 'General Staff Access', value: 'General', color: 'blue', description: 'Accessible to all duty officers and operational teams', isActive: true, isSystem: true, order: 1 },
  { id: 'opt-conf-2', category: 'documentConfidentialities', label: 'Restricted (Lead Officers)', value: 'Restricted', color: 'amber', description: 'Accessible only to senior managers and designated safeguarding leads', isActive: true, isSystem: true, order: 2 },
  { id: 'opt-conf-3', category: 'documentConfidentialities', label: 'Strictly Confidential (Super Admin)', value: 'Strictly Confidential', color: 'red', description: 'Encrypted tier for high-sensitivity police / child protection cases', isActive: true, isSystem: true, order: 3 },

  // 33. VCS Support Agency Categories
  { id: 'opt-vcs-1', category: 'vcsCategories', label: 'Charity & Welfare Assistance', value: 'Charity & Welfare', color: 'rose', description: 'Clothing, hardship vouchers, and emergency aid', isActive: true, isSystem: true, order: 1 },
  { id: 'opt-vcs-2', category: 'vcsCategories', label: 'Food & Nutrition Support', value: 'Food & Nutrition', color: 'amber', description: 'Foodbanks and community pantries', isActive: true, isSystem: true, order: 2 },
  { id: 'opt-vcs-3', category: 'vcsCategories', label: 'Family & Children Wellbeing', value: 'Family & Children', color: 'purple', description: 'Playgroups, mother & baby packs, youth mentoring', isActive: true, isSystem: true, order: 3 },
  { id: 'opt-vcs-4', category: 'vcsCategories', label: 'ESOL & Education Providers', value: 'ESOL & Education', color: 'blue', description: 'English language classes and skills training', isActive: true, isSystem: true, order: 4 },
  { id: 'opt-vcs-5', category: 'vcsCategories', label: 'Faith & Community Hubs', value: 'Faith & Community', color: 'teal', description: 'Interfaith community centers and cultural places of worship', isActive: true, isSystem: true, order: 5 },
  { id: 'opt-vcs-6', category: 'vcsCategories', label: 'Advocacy & Legal Advice', value: 'Advocacy & Legal', color: 'indigo', description: 'Legal aid solicitors and immigration advice hubs', isActive: true, isSystem: true, order: 6 },
  { id: 'opt-vcs-7', category: 'vcsCategories', label: 'Statutory Local Council Service', value: 'Statutory / Council', color: 'emerald', description: 'Local authority social work and housing departments', isActive: true, isSystem: true, order: 7 },

  // 34. Welcome Booklet Statuses
  { id: 'opt-bstat-1', category: 'bookletStatuses', label: 'Pending Collection', value: 'Pending Collection', color: 'amber', description: 'Order submitted, awaiting delivery to site', isActive: true, isSystem: true, order: 1 },
  { id: 'opt-bstat-2', category: 'bookletStatuses', label: 'Partially Collected', value: 'Partially Collected', color: 'blue', description: 'Portion of order received', isActive: true, isSystem: true, order: 2 },
  { id: 'opt-bstat-3', category: 'bookletStatuses', label: 'Received at Site', value: 'Received at Site', color: 'emerald', description: 'Complete inventory received at property reception', isActive: true, isSystem: true, order: 3 },

  // 35. Resident Household Groups
  { id: 'opt-rgroup-1', category: 'welfareResidentGroups', label: 'Single Adult', value: 'Single Adult', color: 'blue', description: 'Individual adult service user', isActive: true, isSystem: true, order: 1 },
  { id: 'opt-rgroup-2', category: 'welfareResidentGroups', label: 'Family Unit', value: 'Family', color: 'purple', description: 'Parents with dependent children', isActive: true, isSystem: true, order: 2 },
  { id: 'opt-rgroup-3', category: 'welfareResidentGroups', label: 'Couple / Partners', value: 'Couple', color: 'teal', description: 'Co-habiting adult couple without minors', isActive: true, isSystem: true, order: 3 },
  { id: 'opt-rgroup-4', category: 'welfareResidentGroups', label: 'Vulnerable Adult', value: 'Vulnerable Adult', color: 'rose', description: 'Single resident with documented medical or mental health vulnerability', isActive: true, isSystem: true, order: 4 },

  // 36. Dispersal Exit Briefing Statuses
  { id: 'opt-dexit-1', category: 'dispersalExitStatuses', label: 'Briefing Completed (Yes)', value: 'Yes', color: 'emerald', description: 'Exit briefing conducted and pack issued', isActive: true, isSystem: true, order: 1 },
  { id: 'opt-dexit-2', category: 'dispersalExitStatuses', label: 'Briefing Incomplete (No)', value: 'No', color: 'red', description: 'Resident departed without formal briefing', isActive: true, isSystem: true, order: 2 },

  // 37. HO Dispersal Letter Statuses
  { id: 'opt-dlet-1', category: 'dispersalLetterStatuses', label: 'Letter Received (Yes)', value: 'Yes', color: 'emerald', description: 'Formal Home Office allocation letter verified', isActive: true, isSystem: true, order: 1 },
  { id: 'opt-dlet-2', category: 'dispersalLetterStatuses', label: 'Letter Pending (No)', value: 'No', color: 'red', description: 'Awaiting copy of official dispersal letter', isActive: true, isSystem: true, order: 2 },

  // 38. Dispersal Travel Statuses
  { id: 'opt-dtrav-1', category: 'dispersalTravelStatuses', label: 'Travelled Successfully (Yes)', value: 'Yes', color: 'emerald', description: 'Resident arrived at destination accommodation', isActive: true, isSystem: true, order: 1 },
  { id: 'opt-dtrav-2', category: 'dispersalTravelStatuses', label: 'Failed to Travel (No)', value: 'No', color: 'red', description: 'Resident refused or missed transport', isActive: true, isSystem: true, order: 2 },

  // 39. Dispersal Warning Statuses
  { id: 'opt-dwar-1', category: 'dispersalWarningStatuses', label: 'Warning Completed (Yes)', value: 'Yes', color: 'red', description: 'Breach warning logged and served', isActive: true, isSystem: true, order: 1 },
  { id: 'opt-dwar-2', category: 'dispersalWarningStatuses', label: 'No Warning Needed', value: 'No need', color: 'slate', description: 'Compliance met, no notice required', isActive: true, isSystem: true, order: 2 },
  { id: 'opt-dwar-3', category: 'dispersalWarningStatuses', label: 'Warning Not Completed (No)', value: 'No', color: 'amber', description: 'Pending warning issuance', isActive: true, isSystem: true, order: 3 },

  // 40. User System Roles
  { id: 'opt-urole-1', category: 'userRoles', label: 'Super Administrator', value: 'Super Admin', color: 'purple', description: 'Full system management and configuration permissions', isActive: true, isSystem: true, order: 1 },
  { id: 'opt-urole-2', category: 'userRoles', label: 'Administrator', value: 'Admin', color: 'blue', description: 'Operational administrator with management permissions', isActive: true, isSystem: true, order: 2 },
  { id: 'opt-urole-3', category: 'userRoles', label: 'Duty Staff Officer', value: 'Staff', color: 'emerald', description: 'Standard daily operational and logging permissions', isActive: true, isSystem: true, order: 3 },
  { id: 'opt-urole-4', category: 'userRoles', label: 'Compliance & Quality Auditor', value: 'Auditor', color: 'amber', description: 'Read-only audit and reporting inspector access', isActive: true, isSystem: true, order: 4 },
  { id: 'opt-urole-5', category: 'userRoles', label: 'Security & Concierge Lead', value: 'Security', color: 'slate', description: 'Night concierge and physical perimeter logging', isActive: true, isSystem: true, order: 5 }
];
