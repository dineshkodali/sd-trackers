import { CustomFieldOption, FieldOptionCategory } from '../types';

export interface CategoryMeta {
  key: FieldOptionCategory;
  name: string;
  department: 'Safeguarding' | 'Facilities' | 'Welfare' | 'Governance';
  description: string;
  iconName: string;
}

export const FIELD_CATEGORIES_META: CategoryMeta[] = [
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
    key: 'laundryStages',
    name: 'Laundry Cycle Stages',
    department: 'Welfare',
    description: 'Operational tracking stages for commercial laundry cycles',
    iconName: 'Waves'
  },
  {
    key: 'councils',
    name: 'Responsible Councils & LAs',
    department: 'Governance',
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
  { id: 'opt-fstat-5', category: 'foodStatuses', label: 'Cancelled', value: 'Cancelled', color: 'slate', description: 'Order cancelled due to hospital appointment or leave', isActive: true, isSystem: false, order: 5 }
];
