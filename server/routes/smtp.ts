import { Router, Request, Response } from 'express';
import { isSmtpConfigured, testSmtpConnection, sendEmail, getSmtpConfigSummary } from '../mailer.js';
import { getSupabaseAdmin, isSupabaseConfigured } from '../supabase.js';

const router = Router();

// Canonical default notification rules
const DEFAULT_RULES = [
  // Safeguarding
  {
    id: 'rule-sg-01',
    eventCode: 'referral.created',
    module: 'Safeguarding',
    title: 'New Safeguarding Referral Logged',
    description: 'Triggered whenever a staff member submits a new safeguarding referral record.',
    enabled: true,
    minSeverity: 'All',
    recipientRoles: ['Super Admin', 'Admin'],
    customRecipients: [],
    customCc: [],
    subjectTemplate: '[SAFEGUARDING] New Referral: {{suName}} ({{site}})',
    includeMetadata: true,
    dispatchCount: 0,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z'
  },
  {
    id: 'rule-sg-02',
    eventCode: 'referral.urgent',
    module: 'Safeguarding',
    title: 'Urgent / Immediate Risk Referral',
    description: 'Triggered when a referral is flagged with High or Immediate risk level.',
    enabled: true,
    minSeverity: 'High',
    recipientRoles: ['Super Admin', 'Admin', 'Regional Manager'],
    customRecipients: [],
    customCc: [],
    subjectTemplate: '⚠️ [URGENT REFERRAL] {{suName}} at {{site}} - High Safeguarding Risk',
    includeMetadata: true,
    dispatchCount: 0,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z'
  },
  {
    id: 'rule-sg-03',
    eventCode: 'referral.status_changed',
    module: 'Safeguarding',
    title: 'Referral Status Transition',
    description: 'Triggered when a referral moves to In Review, Closed, or Escalated to Authority.',
    enabled: false,
    minSeverity: 'Medium',
    recipientRoles: ['Admin'],
    customRecipients: [],
    customCc: [],
    subjectTemplate: '[SAFEGUARDING] Status Update: {{suName}} is now {{status}}',
    includeMetadata: false,
    dispatchCount: 0,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z'
  },
  {
    id: 'rule-sg-04',
    eventCode: 'vulnerable.created',
    module: 'Safeguarding',
    title: 'New Vulnerable Resident Identified',
    description: 'Triggered when a resident is added to the Vulnerable Service Users tracker.',
    enabled: true,
    minSeverity: 'Medium',
    recipientRoles: ['Super Admin', 'Admin'],
    customRecipients: [],
    customCc: [],
    subjectTemplate: '[VULNERABLE SU] Registered: {{suName}} ({{site}})',
    includeMetadata: true,
    dispatchCount: 0,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z'
  },
  {
    id: 'rule-sg-05',
    eventCode: 'challenging.critical',
    module: 'Safeguarding',
    title: 'Challenging Behaviour / Violence Incident',
    description: 'Triggered when a severe behavioural incident, weapon, or police involvement is recorded.',
    enabled: true,
    minSeverity: 'Critical',
    recipientRoles: ['Super Admin', 'Admin', 'Regional Manager'],
    customRecipients: [],
    customCc: [],
    subjectTemplate: '🚨 [CRITICAL INCIDENT] Challenging Behaviour at {{site}}: {{suName}}',
    includeMetadata: true,
    dispatchCount: 0,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z'
  },
  {
    id: 'rule-sg-06',
    eventCode: 'escalation.created',
    module: 'Safeguarding',
    title: 'Operational Escalation Raised',
    description: 'Triggered when a formal escalation is raised to external authorities or senior managers.',
    enabled: true,
    minSeverity: 'High',
    recipientRoles: ['Super Admin', 'Admin', 'Regional Manager'],
    customRecipients: [],
    customCc: [],
    subjectTemplate: '🚨 [FORMAL ESCALATION] {{urgency}}: {{site}} - {{suName}}',
    includeMetadata: true,
    dispatchCount: 0,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z'
  },
  {
    id: 'rule-sg-07',
    eventCode: 'escalation.critical',
    module: 'Safeguarding',
    title: 'Critical Emergency Escalation',
    description: 'High-priority alert sent immediately when an escalation has Critical severity.',
    enabled: true,
    minSeverity: 'Critical',
    recipientRoles: ['Super Admin', 'Admin', 'Regional Manager'],
    customRecipients: [],
    customCc: [],
    subjectTemplate: '🚨🚨 [CRITICAL ESCALATION] IMMEDIATE ACTION REQUIRED - {{site}}',
    includeMetadata: true,
    dispatchCount: 0,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z'
  },

  // Compliance & Property Safety
  {
    id: 'rule-cp-01',
    eventCode: 'compliance.created',
    module: 'Compliance',
    title: 'New Compliance Certificate Registered',
    description: 'Triggered when a contractor or site officer uploads a new safety/compliance certificate.',
    enabled: false,
    minSeverity: 'All',
    recipientRoles: ['Admin'],
    customRecipients: [],
    customCc: [],
    subjectTemplate: '[COMPLIANCE] Certificate Registered: {{complianceType}} ({{site}})',
    includeMetadata: true,
    dispatchCount: 0,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z'
  },
  {
    id: 'rule-cp-02',
    eventCode: 'compliance.expiring_soon',
    module: 'Compliance',
    title: 'Compliance Certificate Expiring in ≤30 Days',
    description: 'Alerts operations when a statutory certificate (Gas, EICR, Fire, EPC) approaches expiration.',
    enabled: true,
    minSeverity: 'Medium',
    recipientRoles: ['Super Admin', 'Admin'],
    customRecipients: [],
    customCc: [],
    subjectTemplate: '⚠️ [COMPLIANCE WARNING] {{complianceType}} Expiring Soon at {{site}} ({{daysRemaining}} days left)',
    includeMetadata: true,
    dispatchCount: 0,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z'
  },
  {
    id: 'rule-cp-03',
    eventCode: 'compliance.expired',
    module: 'Compliance',
    title: 'Compliance Certificate Overdue / Expired',
    description: 'Immediate alert when a mandatory statutory certification has passed its expiry date.',
    enabled: true,
    minSeverity: 'Critical',
    recipientRoles: ['Super Admin', 'Admin', 'Regional Manager'],
    customRecipients: [],
    customCc: [],
    subjectTemplate: '🛑 [BREACH RISK] Compliance Certificate EXPIRED: {{complianceType}} ({{site}})',
    includeMetadata: true,
    dispatchCount: 0,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z'
  },

  // Maintenance & Defects
  {
    id: 'rule-mnt-01',
    eventCode: 'maintenance.created',
    module: 'Maintenance',
    title: 'New Maintenance Defect Reported',
    description: 'Triggered when any new defect or repair job is logged in the maintenance system.',
    enabled: false,
    minSeverity: 'All',
    recipientRoles: ['Admin'],
    customRecipients: [],
    customCc: [],
    subjectTemplate: '[MAINTENANCE] New Defect: Room {{roomNo}} at {{site}} ({{priority}})',
    includeMetadata: true,
    dispatchCount: 0,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z'
  },
  {
    id: 'rule-mnt-02',
    eventCode: 'maintenance.cat1_emergency',
    module: 'Maintenance',
    title: 'CAT 1 Emergency Defect (4hr SLA)',
    description: 'Dispatches urgent notification when a Category 1 emergency (gas leak, flooding, electrical hazard) is raised.',
    enabled: true,
    minSeverity: 'Critical',
    recipientRoles: ['Super Admin', 'Admin', 'Regional Manager'],
    customRecipients: [],
    customCc: [],
    subjectTemplate: '🚨 [CAT 1 EMERGENCY REPAIR] {{site}} Room {{roomNo}} - {{defectType}}',
    includeMetadata: true,
    dispatchCount: 0,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z'
  },
  {
    id: 'rule-mnt-03',
    eventCode: 'maintenance.completed',
    module: 'Maintenance',
    title: 'Defect Resolved / Work Completed',
    description: 'Triggered when a contractor marks a defect as Completed or works signed off.',
    enabled: false,
    minSeverity: 'Low',
    recipientRoles: ['Admin'],
    customRecipients: [],
    customCc: [],
    subjectTemplate: '✅ [REPAIR COMPLETED] {{site}} Room {{roomNo}} - Job Closed',
    includeMetadata: false,
    dispatchCount: 0,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z'
  },

  // Public Transport
  {
    id: 'rule-tr-01',
    eventCode: 'transport.created',
    module: 'Transport',
    title: 'Public Transport Journey Booked',
    description: 'Triggered when travel or journey authorization is logged.',
    enabled: false,
    minSeverity: 'All',
    recipientRoles: ['Admin'],
    customRecipients: [],
    customCc: [],
    subjectTemplate: '[TRANSPORT] Journey Logged: {{suName}} (URN: {{urn}})',
    includeMetadata: true,
    dispatchCount: 0,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z'
  },
  {
    id: 'rule-tr-02',
    eventCode: 'transport.exceptional_circumstance',
    module: 'Transport',
    title: 'Exceptional Circumstances Travel Authorisation',
    description: 'Triggered when a travel request includes medical escort, exceptional budget, or emergency justification.',
    enabled: true,
    minSeverity: 'High',
    recipientRoles: ['Super Admin', 'Admin'],
    customRecipients: [],
    customCc: [],
    subjectTemplate: '🚆 [TRAVEL APPROVAL] Exceptional Circumstances: {{suName}} ({{site}})',
    includeMetadata: true,
    dispatchCount: 0,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z'
  },

  // Health & Welfare
  {
    id: 'rule-hw-01',
    eventCode: 'gp.created',
    module: 'Health & Welfare',
    title: 'New GP Appointment Booked',
    description: 'Triggered when a healthcare appointment is scheduled for a service user.',
    enabled: false,
    minSeverity: 'All',
    recipientRoles: ['Admin'],
    customRecipients: [],
    customCc: [],
    subjectTemplate: '[HEALTHCARE] GP Appointment: {{portRef}} on {{appointmentDate}}',
    includeMetadata: true,
    dispatchCount: 0,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z'
  },
  {
    id: 'rule-hw-02',
    eventCode: 'gp.dna_missed',
    module: 'Health & Welfare',
    title: 'Service User DNA (Did Not Attend) Appointment',
    description: 'Alerts key workers and admin when a vulnerable resident misses a scheduled clinical appointment.',
    enabled: true,
    minSeverity: 'Medium',
    recipientRoles: ['Super Admin', 'Admin'],
    customRecipients: [],
    customCc: [],
    subjectTemplate: '⚠️ [APPOINTMENT MISSED - DNA] Room {{roomNo}} - {{portRef}} missed GP visit',
    includeMetadata: true,
    dispatchCount: 0,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z'
  },
  {
    id: 'rule-hw-03',
    eventCode: 'welfare.created',
    module: 'Health & Welfare',
    title: 'RFA Welfare Check Conducted',
    description: 'Triggered when a routine or targeted welfare check is documented.',
    enabled: false,
    minSeverity: 'All',
    recipientRoles: ['Admin'],
    customRecipients: [],
    customCc: [],
    subjectTemplate: '[WELFARE CHECK] Room {{roomNo}} at {{site}}: {{name}}',
    includeMetadata: false,
    dispatchCount: 0,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z'
  },
  {
    id: 'rule-hw-04',
    eventCode: 'welfare.mental_health_ticket',
    module: 'Health & Welfare',
    title: 'Mental Health Ticket Raised During Welfare Check',
    description: 'Triggered when a resident exhibits acute psychiatric distress or an MH ticket is logged.',
    enabled: true,
    minSeverity: 'High',
    recipientRoles: ['Super Admin', 'Admin', 'Regional Manager'],
    customRecipients: [],
    customCc: [],
    subjectTemplate: '🧠 [MENTAL HEALTH ALERT] MH Ticket Logged: {{name}} (Room {{roomNo}}, {{site}})',
    includeMetadata: true,
    dispatchCount: 0,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z'
  },

  // Operations & Dispersal
  {
    id: 'rule-ops-01',
    eventCode: 'dispersal.created',
    module: 'Operations',
    title: 'Service User Dispersal / Departure Recorded',
    description: 'Triggered when a resident moves out or Home Office dispersal is scheduled.',
    enabled: false,
    minSeverity: 'All',
    recipientRoles: ['Admin'],
    customRecipients: [],
    customCc: [],
    subjectTemplate: '[DISPERSAL] Departure Logged: {{suPortNassRef}} at {{site}}',
    includeMetadata: true,
    dispatchCount: 0,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z'
  },
  {
    id: 'rule-ops-02',
    eventCode: 'dispersal.failed_to_travel',
    module: 'Operations',
    title: 'Resident Failed to Travel / Refused Dispersal',
    description: 'Dispatches operational warning when a resident fails or refuses scheduled transfer.',
    enabled: true,
    minSeverity: 'High',
    recipientRoles: ['Super Admin', 'Admin'],
    customRecipients: [],
    customCc: [],
    subjectTemplate: '⚠️ [FAILED TO TRAVEL] Dispersal Aborted: {{suPortNassRef}} ({{site}})',
    includeMetadata: true,
    dispatchCount: 0,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z'
  },
  {
    id: 'rule-ops-03',
    eventCode: 'laundry.variance_flagged',
    module: 'Operations',
    title: 'Laundry Delivery Count Discrepancy Flagged',
    description: 'Triggered when collected bags vs clean returned items differ beyond tolerance.',
    enabled: true,
    minSeverity: 'Medium',
    recipientRoles: ['Admin'],
    customRecipients: [],
    customCc: [],
    subjectTemplate: '🧺 [LAUNDRY DISCREPANCY] Variance Detected at {{site}} (Slip #{{slipNo}})',
    includeMetadata: true,
    dispatchCount: 0,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z'
  },
  {
    id: 'rule-ops-04',
    eventCode: 'food.temp_breach',
    module: 'Operations',
    title: 'Hot Food Catering Temperature Breach',
    description: 'Alerts operations when food service temperatures fail HACCP guidelines (<63°C hot hold or >8°C cold).',
    enabled: true,
    minSeverity: 'Critical',
    recipientRoles: ['Super Admin', 'Admin', 'Regional Manager'],
    customRecipients: [],
    customCc: [],
    subjectTemplate: '🌡️ [FOOD HYGIENE BREACH] Temperature Out of Range at {{site}} ({{vendor}})',
    includeMetadata: true,
    dispatchCount: 0,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z'
  },

  // Governance & Security
  {
    id: 'rule-gov-01',
    eventCode: 'change_request.created',
    module: 'Governance',
    title: 'Data Change Request Submitted',
    description: 'Alerts Super Admins when staff request edits to locked or historic records.',
    enabled: true,
    minSeverity: 'Medium',
    recipientRoles: ['Super Admin'],
    customRecipients: [],
    customCc: [],
    subjectTemplate: '📝 [APPROVAL NEEDED] Data Change Request by {{requestedBy}} for {{targetTable}}',
    includeMetadata: true,
    dispatchCount: 0,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z'
  },
  {
    id: 'rule-gov-02',
    eventCode: 'change_request.reviewed',
    module: 'Governance',
    title: 'Change Request Approved or Rejected',
    description: 'Notifies the requesting staff member and site leads of the approval decision.',
    enabled: true,
    minSeverity: 'Low',
    recipientRoles: ['Admin'],
    customRecipients: [],
    customCc: [],
    subjectTemplate: '📋 [CHANGE REQUEST {{decision}}] Your request #{{requestId}} has been {{decision}}',
    includeMetadata: true,
    dispatchCount: 0,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z'
  },
  {
    id: 'rule-gov-03',
    eventCode: 'user.created',
    module: 'Governance',
    title: 'New Staff Account Provisioned',
    description: 'Triggered when a new user is invited or registered in the system.',
    enabled: true,
    minSeverity: 'Medium',
    recipientRoles: ['Super Admin'],
    customRecipients: [],
    customCc: [],
    subjectTemplate: '👤 [USER REGISTERED] New Account Created: {{userName}} ({{role}})',
    includeMetadata: true,
    dispatchCount: 0,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z'
  },
  {
    id: 'rule-gov-04',
    eventCode: 'user.role_changed',
    module: 'Governance',
    title: 'Security Alert: User Role / Access Permissions Altered',
    description: 'Immediate alert when a user role is promoted, demoted, or property scope is modified.',
    enabled: true,
    minSeverity: 'High',
    recipientRoles: ['Super Admin'],
    customRecipients: [],
    customCc: [],
    subjectTemplate: '🔐 [SECURITY NOTICE] Role Modified: {{targetEmail}} is now {{newRole}}',
    includeMetadata: true,
    dispatchCount: 0,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z'
  }
];

// In-memory runtime cache for notification rules and logs
let runtimeRules: any[] = JSON.parse(JSON.stringify(DEFAULT_RULES));
let runtimeLogs: any[] = [];

// Helper: Replace template tokens like {{suName}} with values
function interpolateTemplate(template: string, data: Record<string, any>): string {
  if (!template) return '';
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key) => {
    return data[key] !== undefined && data[key] !== null ? String(data[key]) : '';
  });
}

// Helper: Severity weight
function severityRank(sev?: string): number {
  switch ((sev || '').toLowerCase()) {
    case 'critical': return 4;
    case 'high': return 3;
    case 'medium': return 2;
    case 'low': return 1;
    default: return 0; // 'All'
  }
}

// Helper: Render modern, professional HTML notification email
function renderNotificationHtml(options: {
  title: string;
  module: string;
  severity: string;
  message?: string;
  details: { label: string; value: string }[];
  actionRequired?: string;
  metadata?: Record<string, any>;
}): string {
  const { title, module, severity, message, details, actionRequired, metadata } = options;

  let bannerBg = '#0d9488'; // Teal
  let bannerTextColor = '#ffffff';

  if (severity === 'Critical') {
    bannerBg = '#b91c1c'; // Red
  } else if (severity === 'High') {
    bannerBg = '#c2410c'; // Amber-orange
  } else if (severity === 'Medium') {
    bannerBg = '#0369a1'; // Sky blue
  }

  const detailRows = details
    .filter(d => d.value)
    .map(
      d => `
      <tr>
        <td style="padding: 9px 14px; font-weight: 600; color: #4b5563; border-bottom: 1px solid #f3f4f6; width: 34%; font-size: 13px;">${d.label}:</td>
        <td style="padding: 9px 14px; color: #111827; font-weight: 500; border-bottom: 1px solid #f3f4f6; font-size: 13px;">${d.value}</td>
      </tr>`
    )
    .join('');

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 620px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
      <!-- Header Bar -->
      <div style="background-color: #0f172a; padding: 16px 20px; display: flex; align-items: center; justify-content: space-between;">
        <span style="color: #ffffff; font-weight: bold; font-size: 15px; letter-spacing: 0.5px;">SD OPERATIONS</span>
        <span style="color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Compliance &amp; Operations Portal</span>
      </div>

      <!-- Severity Banner -->
      <div style="background-color: ${bannerBg}; color: ${bannerTextColor}; padding: 10px 20px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px;">
        ${severity.toUpperCase()} ALERT &bull; ${module.toUpperCase()} MODULE
      </div>

      <!-- Body Content -->
      <div style="padding: 24px 20px;">
        <h2 style="color: #111827; margin: 0 0 8px 0; font-size: 18px; line-height: 1.3;">${title}</h2>
        ${message ? `<p style="color: #374151; font-size: 14px; line-height: 1.5; margin: 0 0 18px 0;">${message}</p>` : ''}

        <!-- Details Table -->
        <table style="width: 100%; border-collapse: collapse; background-color: #fafaf9; border: 1px solid #e7e5e4; border-radius: 4px; margin-bottom: 18px;">
          <tbody>
            ${detailRows}
            <tr>
              <td style="padding: 9px 14px; font-weight: 600; color: #4b5563; width: 34%; font-size: 13px;">Timestamp:</td>
              <td style="padding: 9px 14px; color: #111827; font-size: 13px;">${new Date().toLocaleString('en-GB', { timeZone: 'UTC' })} UTC</td>
            </tr>
          </tbody>
        </table>

        <!-- Action Required Box -->
        ${actionRequired ? `
          <div style="margin-bottom: 18px; padding: 14px; background-color: #f0fdfa; border-left: 4px solid #0d9488; border-radius: 2px;">
            <strong style="color: #0f766e; display: block; font-size: 13px; margin-bottom: 4px;">Immediate Remedial Action Required:</strong>
            <span style="color: #134e4a; font-size: 13px; line-height: 1.4;">${actionRequired}</span>
          </div>
        ` : ''}

        <!-- Additional Metadata -->
        ${metadata && Object.keys(metadata).length > 0 ? `
          <div style="margin-top: 14px; padding: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 12px; color: #475569;">
            <strong style="display: block; margin-bottom: 6px; color: #1e293b;">Additional Event Metadata:</strong>
            ${Object.entries(metadata).map(([k, v]) => `<div><strong>${k}:</strong> ${typeof v === 'object' ? JSON.stringify(v) : v}</div>`).join('')}
          </div>
        ` : ''}
      </div>

      <!-- Footer -->
      <div style="background-color: #f9fafb; padding: 14px 20px; border-top: 1px solid #f3f4f6; font-size: 11px; color: #6b7280; line-height: 1.4;">
        This automated notification was generated by the <strong>SD Operations Management System</strong>. Please do not reply directly to this email address. Access the web portal to review live operational records.
      </div>
    </div>
  `;
}

// -------------------------------------------------------------
// ROUTES
// -------------------------------------------------------------

// GET /api/smtp/status
router.get('/status', async (req: Request, res: Response) => {
  const summary = getSmtpConfigSummary();
  res.json({
    configured: summary.configured,
    mode: 'production',
    host: summary.host,
    port: summary.port,
    from: summary.from,
    user: summary.user ? `${summary.user.split('@')[0]}@...` : null,
    fullUser: summary.user
  });
});

// POST /api/smtp/test
router.post('/test', async (req: Request, res: Response) => {
  const { testRecipient } = req.body;
  const targetEmail = testRecipient || process.env.SMTP_USER;

  if (!targetEmail) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a test recipient email address or set SMTP_USER in root .env'
    });
  }

  if (!isSmtpConfigured()) {
    return res.status(400).json({
      success: false,
      message: 'Production SMTP is not configured. Please ensure SMTP_HOST, SMTP_USER, and SMTP_PASSWORD exist in the root .env file.'
    });
  }

  const verifyResult = await testSmtpConnection();
  if (!verifyResult.success) {
    return res.status(500).json(verifyResult);
  }

  const result = await sendEmail({
    to: targetEmail,
    subject: 'SD Trackers - Production SMTP Live Verification',
    html: renderNotificationHtml({
      title: 'Production SMTP Verified',
      module: 'System Operations',
      severity: 'Low',
      message: 'This live notification confirms that SD Trackers is operating in Production SMTP Mode using the credentials configured in the root .env file.',
      details: [
        { label: 'Mode', value: 'Live Production' },
        { label: 'SMTP Server', value: process.env.SMTP_HOST || 'smtp.gmail.com' },
        { label: 'Port', value: String(process.env.SMTP_PORT || 587) },
        { label: 'Sender Address', value: process.env.SMTP_FROM || process.env.SMTP_USER || 'N/A' },
        { label: 'Recipient', value: targetEmail }
      ]
    })
  });

  res.json(result);
});

// GET /api/smtp/rules - Fetch all configured notification rules
router.get('/rules', async (req: Request, res: Response) => {
  try {
    const admin = getSupabaseAdmin();
    if (admin) {
      const { data, error } = await admin
        .from('email_notification_rules')
        .select('*')
        .order('module', { ascending: true });

      if (!error && data && data.length > 0) {
        // Map database row snake_case back to camelCase
        const mapped = data.map(r => ({
          id: r.id,
          eventCode: r.event_code,
          module: r.module,
          title: r.title,
          description: r.description,
          enabled: r.enabled,
          minSeverity: r.min_severity,
          recipientRoles: r.recipient_roles || [],
          customRecipients: r.custom_recipients || [],
          customCc: r.custom_cc || [],
          subjectTemplate: r.subject_template,
          includeMetadata: r.include_metadata,
          lastDispatchedAt: r.last_dispatched_at,
          dispatchCount: r.dispatch_count || 0,
          createdAt: r.created_at,
          updatedAt: r.updated_at
        }));
        runtimeRules = mapped;
        return res.json({ success: true, rules: mapped, source: 'database' });
      }
    }
  } catch (err) {
    console.error('Failed to load rules from Supabase, using runtime cache:', err);
  }

  res.json({ success: true, rules: runtimeRules, source: 'runtime-memory' });
});

// PUT /api/smtp/rules/:id - Update an individual notification rule
router.put('/rules/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const updates = req.body;

  // Update in runtime cache
  const index = runtimeRules.findIndex(r => r.id === id);
  if (index !== -1) {
    runtimeRules[index] = {
      ...runtimeRules[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
  }

  // Attempt update in Supabase
  try {
    const admin = getSupabaseAdmin();
    if (admin) {
      const dbPayload: any = {
        updated_at: new Date().toISOString()
      };
      if (updates.enabled !== undefined) dbPayload.enabled = updates.enabled;
      if (updates.minSeverity !== undefined) dbPayload.min_severity = updates.minSeverity;
      if (updates.recipientRoles !== undefined) dbPayload.recipient_roles = updates.recipientRoles;
      if (updates.customRecipients !== undefined) dbPayload.custom_recipients = updates.customRecipients;
      if (updates.customCc !== undefined) dbPayload.custom_cc = updates.customCc;
      if (updates.subjectTemplate !== undefined) dbPayload.subject_template = updates.subjectTemplate;
      if (updates.includeMetadata !== undefined) dbPayload.include_metadata = updates.includeMetadata;

      await admin.from('email_notification_rules').update(dbPayload).eq('id', id);
    }
  } catch (err) {
    console.warn('Could not persist rule update to Supabase:', err);
  }

  const updatedRule = runtimeRules.find(r => r.id === id) || updates;
  res.json({ success: true, rule: updatedRule });
});

// POST /api/smtp/rules/reset - Reset rules to system defaults
router.post('/rules/reset', async (req: Request, res: Response) => {
  runtimeRules = JSON.parse(JSON.stringify(DEFAULT_RULES));

  try {
    const admin = getSupabaseAdmin();
    if (admin) {
      for (const rule of DEFAULT_RULES) {
        await admin.from('email_notification_rules').upsert({
          id: rule.id,
          event_code: rule.eventCode,
          module: rule.module,
          title: rule.title,
          description: rule.description,
          enabled: rule.enabled,
          min_severity: rule.minSeverity,
          recipient_roles: rule.recipientRoles,
          custom_recipients: rule.customRecipients,
          custom_cc: rule.customCc,
          subject_template: rule.subjectTemplate,
          include_metadata: rule.includeMetadata,
          dispatch_count: 0,
          updated_at: new Date().toISOString()
        }, { onConflict: 'event_code' });
      }
    }
  } catch (err) {
    console.warn('Could not reset Supabase rules table:', err);
  }

  res.json({ success: true, rules: runtimeRules, message: 'Notification rules successfully reset to system defaults.' });
});

// POST /api/smtp/trigger - Unified event notification dispatcher
router.post('/trigger', async (req: Request, res: Response) => {
  const { 
    eventCode, 
    payload = {}, 
    site, 
    severity = 'Medium', 
    entityId,
    targetRecipients = [] 
  } = req.body;

  if (!eventCode) {
    return res.status(400).json({ success: false, error: 'eventCode is required.' });
  }

  // 1. Match Rule
  const rule = runtimeRules.find(r => r.eventCode === eventCode);
  if (!rule) {
    return res.status(404).json({ success: false, error: `No notification rule registered for event: ${eventCode}` });
  }

  // 2. Check if rule enabled
  if (!rule.enabled) {
    return res.json({ 
      success: true, 
      skipped: true, 
      reason: `Rule '${rule.title}' (${eventCode}) is currently disabled in notification settings.` 
    });
  }

  // 3. Check severity threshold
  if (rule.minSeverity && rule.minSeverity !== 'All') {
    if (severityRank(severity) < severityRank(rule.minSeverity)) {
      return res.json({
        success: true,
        skipped: true,
        reason: `Event severity '${severity}' is below rule minimum threshold '${rule.minSeverity}'.`
      });
    }
  }

  // 4. Resolve Target Recipients
  const resolvedRecipients = new Set<string>();

  // Add custom recipients configured on the rule
  if (Array.isArray(rule.customRecipients)) {
    rule.customRecipients.forEach((email: string) => {
      if (email && email.includes('@')) resolvedRecipients.add(email.trim());
    });
  }

  // Add ad-hoc recipients passed in trigger
  if (Array.isArray(targetRecipients)) {
    targetRecipients.forEach((email: string) => {
      if (email && email.includes('@')) resolvedRecipients.add(email.trim());
    });
  }
  if (payload.recipientEmail && payload.recipientEmail.includes('@')) {
    resolvedRecipients.add(payload.recipientEmail.trim());
  }

  // Fetch recipients matching target roles from Supabase profiles if possible
  if (Array.isArray(rule.recipientRoles) && rule.recipientRoles.length > 0) {
    try {
      const admin = getSupabaseAdmin();
      if (admin) {
        const { data: matchedProfiles } = await admin
          .from('profiles')
          .select('email, role')
          .in('role', rule.recipientRoles)
          .eq('status', 'Active');

        if (matchedProfiles && matchedProfiles.length > 0) {
          matchedProfiles.forEach((p: any) => {
            if (p.email && p.email.includes('@')) resolvedRecipients.add(p.email.trim());
          });
        }
      }
    } catch {}
  }

  // Fallback if no specific recipients resolved
  if (resolvedRecipients.size === 0) {
    const defaultRecipient = process.env.SMTP_USER || 'admin@sdcommercial.co.uk';
    resolvedRecipients.add(defaultRecipient);
  }

  const recipientList = Array.from(resolvedRecipients);
  const ccList = Array.isArray(rule.customCc) ? rule.customCc.filter((e: string) => e && e.includes('@')) : [];

  // 5. Interpolate Dynamic Subject Line
  const mergedContext = {
    ...payload,
    site: site || payload.site || 'All Sites',
    severity,
    entityId: entityId || payload.id || payload.urn || payload.portRef || 'N/A',
    timestamp: new Date().toLocaleDateString('en-GB')
  };
  const subject = interpolateTemplate(rule.subjectTemplate || `[${severity.toUpperCase()}] ${rule.title}`, mergedContext);

  // 6. Build Standardized Details Grid
  const details: { label: string; value: string }[] = [
    { label: 'Accommodation Site', value: mergedContext.site },
    { label: 'Reference / Identifier', value: mergedContext.entityId }
  ];

  if (payload.suName) details.push({ label: 'Service User Name', value: payload.suName });
  if (payload.roomNo || payload.flatRoomNumber) details.push({ label: 'Room / Flat Number', value: payload.roomNo || payload.flatRoomNumber });
  if (payload.defectType) details.push({ label: 'Defect Type', value: payload.defectType });
  if (payload.complianceType) details.push({ label: 'Compliance Item', value: payload.complianceType });
  if (payload.priority) details.push({ label: 'Priority', value: payload.priority });
  if (payload.actionTaken) details.push({ label: 'Action Recorded', value: payload.actionTaken });
  if (payload.reportedBy || payload.assignedOfficer) details.push({ label: 'Staff / Key Worker', value: payload.reportedBy || payload.assignedOfficer });

  // 7. Render HTML Email
  const html = renderNotificationHtml({
    title: rule.title,
    module: rule.module,
    severity,
    message: payload.incidentNotes || payload.reason || payload.description || payload.message || rule.description,
    details,
    actionRequired: payload.actionRequired || payload.actionTaken,
    metadata: rule.includeMetadata ? payload : undefined
  });

  // 8. Dispatch Email via Production SMTP
  if (!isSmtpConfigured()) {
    const errorMsg = 'Production SMTP Error: SMTP credentials (SMTP_HOST, SMTP_USER, SMTP_PASS) not found in root .env';
    console.error(`[Production SMTP] ${errorMsg}`);
    const failEntry = {
      id: 'log-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      ruleId: rule.id,
      eventCode,
      module: rule.module,
      subject,
      recipients: recipientList,
      site: mergedContext.site,
      status: 'failed' as const,
      errorMessage: errorMsg,
      entityId: mergedContext.entityId,
      payloadSummary: JSON.stringify({ site: mergedContext.site, severity, entity: mergedContext.entityId }),
      dispatchedAt: new Date().toISOString()
    };
    runtimeLogs.unshift(failEntry);
    return res.status(500).json({
      success: false,
      delivered: false,
      error: errorMsg,
      ruleId: rule.id
    });
  }

  const dispatchResult = await sendEmail({
    to: recipientList.join(', '),
    cc: ccList.length > 0 ? ccList.join(', ') : undefined,
    subject,
    html
  });

  if (!dispatchResult.success) {
    console.error(`[Production SMTP Error] Failed dispatching ${eventCode} to ${recipientList.join(', ')}:`, dispatchResult.message);
  }

  // 9. Update Rule Dispatch Stats
  rule.dispatchCount = (rule.dispatchCount || 0) + 1;
  rule.lastDispatchedAt = new Date().toISOString();

  try {
    const admin = getSupabaseAdmin();
    if (admin) {
      await admin.from('email_notification_rules').update({
        dispatch_count: rule.dispatchCount,
        last_dispatched_at: rule.lastDispatchedAt
      }).eq('id', rule.id);
    }
  } catch {}

  // 10. Record Audit Log with real delivery outcome
  const logEntry = {
    id: 'log-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
    ruleId: rule.id,
    eventCode,
    module: rule.module,
    subject,
    recipients: recipientList,
    site: mergedContext.site,
    status: dispatchResult.success ? ('delivered' as const) : ('failed' as const),
    errorMessage: dispatchResult.success ? undefined : dispatchResult.message,
    entityId: mergedContext.entityId,
    payloadSummary: JSON.stringify({ site: mergedContext.site, severity, entity: mergedContext.entityId }),
    dispatchedAt: new Date().toISOString()
  };

  runtimeLogs.unshift(logEntry);
  if (runtimeLogs.length > 150) runtimeLogs.pop();

  try {
    const admin = getSupabaseAdmin();
    if (admin) {
      await admin.from('email_notification_logs').insert({
        id: logEntry.id,
        rule_id: logEntry.ruleId,
        event_code: logEntry.eventCode,
        module: logEntry.module,
        subject: logEntry.subject,
        recipients: logEntry.recipients,
        site: logEntry.site,
        status: logEntry.status,
        error_message: logEntry.errorMessage,
        entity_id: logEntry.entityId,
        payload_summary: logEntry.payloadSummary,
        dispatched_at: logEntry.dispatchedAt
      });
    }
  } catch {}

  res.json({
    success: dispatchResult.success,
    delivered: dispatchResult.success,
    recipients: recipientList,
    subject,
    messageId: dispatchResult.messageId,
    logId: logEntry.id
  });
});

// GET /api/smtp/logs - Fetch recent delivery logs
router.get('/logs', async (req: Request, res: Response) => {
  try {
    const admin = getSupabaseAdmin();
    if (admin) {
      const { data, error } = await admin
        .from('email_notification_logs')
        .select('*')
        .order('dispatched_at', { ascending: false })
        .limit(100);

      if (!error && data && data.length > 0) {
        const mapped = data.map(l => ({
          id: l.id,
          ruleId: l.rule_id,
          eventCode: l.event_code,
          module: l.module,
          subject: l.subject,
          recipients: l.recipients || [],
          site: l.site,
          status: l.status,
          errorMessage: l.error_message,
          entityId: l.entity_id,
          payloadSummary: l.payload_summary,
          dispatchedAt: l.dispatched_at
        }));
        return res.json({ success: true, logs: mapped });
      }
    }
  } catch {}

  res.json({ success: true, logs: runtimeLogs });
});

// POST /api/smtp/test-rule - Test dispatch a specific rule with mock payload
router.post('/test-rule', async (req: Request, res: Response) => {
  const { ruleId, targetEmail } = req.body;
  const rule = runtimeRules.find(r => r.id === ruleId);

  if (!rule) {
    return res.status(404).json({ success: false, error: 'Rule not found' });
  }

  const recipient = targetEmail || process.env.SMTP_USER || 'admin@sdcommercial.co.uk';
  const mockPayload = {
    suName: 'Sample Service User',
    site: 'Seven Kings Hotel',
    roomNo: '104',
    defectType: 'Plumbing / Water Leak',
    complianceType: 'Gas Safety Certificate (CP12)',
    urgency: 'High',
    actionRequired: 'Key worker to review and verify property contractor notes.',
    incidentNotes: 'This is a test notification generated to verify the layout, tokens, and delivery for this notification rule.',
    recipientEmail: recipient
  };

  const subject = interpolateTemplate(rule.subjectTemplate, mockPayload);
  const html = renderNotificationHtml({
    title: `[TEST] ${rule.title}`,
    module: rule.module,
    severity: rule.minSeverity === 'All' ? 'Low' : rule.minSeverity,
    message: 'This is a verification test dispatch confirming that the rule configuration and formatting work properly.',
    details: [
      { label: 'Rule Name', value: rule.title },
      { label: 'Event Code', value: rule.eventCode },
      { label: 'Accommodation Site', value: mockPayload.site },
      { label: 'Room / Unit', value: mockPayload.roomNo },
      { label: 'Target Recipient', value: recipient }
    ],
    actionRequired: mockPayload.actionRequired
  });

  if (!isSmtpConfigured()) {
    return res.status(400).json({
      success: false,
      delivered: false,
      message: 'Production SMTP Error: SMTP credentials are not configured in root .env'
    });
  }

  const result = await sendEmail({
    to: recipient,
    subject: `[PROD TEST] ${subject}`,
    html
  });

  // Record in logs
  const logEntry = {
    id: 'test-log-' + Date.now(),
    ruleId: rule.id,
    eventCode: rule.eventCode,
    module: rule.module,
    subject: `[PROD TEST] ${subject}`,
    recipients: [recipient],
    site: mockPayload.site,
    status: result.success ? ('delivered' as const) : ('failed' as const),
    errorMessage: result.success ? undefined : result.message,
    dispatchedAt: new Date().toISOString()
  };
  runtimeLogs.unshift(logEntry);

  res.json({
    success: result.success,
    delivered: result.success,
    messageId: result.messageId,
    message: result.success 
      ? `Live production email successfully dispatched to ${recipient}.`
      : `Failed to dispatch test email to ${recipient}: ${result.message}`
  });
});

// Existing dedicated alert endpoints preserved for backward compatibility
router.post('/alert', async (req: Request, res: Response) => {
  const { recipient, alertType, title, message, entityId, site, severity = 'Urgent', metadata } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required.' });
  const targetRecipient = recipient || process.env.SMTP_USER || 'admin@sdcommercial.co.uk';

  if (!isSmtpConfigured()) {
    return res.status(500).json({ success: false, message: 'Production SMTP Error: SMTP is not configured in root .env' });
  }

  const result = await sendEmail({
    to: targetRecipient,
    subject: `[${severity.toUpperCase()} ALERT] SD Operations: ${title}`,
    html: renderNotificationHtml({
      title,
      module: 'Safeguarding',
      severity,
      message,
      details: [
        { label: 'Site / Accommodation', value: site || 'All Sites' },
        { label: 'Incident Reference', value: entityId || 'N/A' },
        { label: 'Priority / Risk', value: severity }
      ],
      metadata
    })
  });
  res.json(result);
});

router.post('/escalation-alert', async (req: Request, res: Response) => {
  const { suName, site, roomNo, incidentTitle, urgency = 'Critical', escalatedTo, reason, actionRequired, reportedBy, recipientEmail } = req.body;
  const targetEmail = recipientEmail || process.env.SMTP_USER || 'admin@sdcommercial.co.uk';

  if (!isSmtpConfigured()) {
    return res.status(500).json({ success: false, message: 'Production SMTP Error: SMTP is not configured in root .env' });
  }

  const result = await sendEmail({
    to: targetEmail,
    subject: `🚨 [ESCALATION ALERT - ${urgency.toUpperCase()}] ${site}: ${suName} - ${incidentTitle || 'Immediate Attention Required'}`,
    html: renderNotificationHtml({
      title: incidentTitle || 'Safeguarding Escalation Notice',
      module: 'Safeguarding',
      severity: urgency,
      message: reason,
      details: [
        { label: 'Service User', value: `${suName || 'Confidential'} ${roomNo ? `(Room ${roomNo})` : ''}` },
        { label: 'Accommodation Site', value: site || 'Unspecified Property' },
        { label: 'Escalated To', value: escalatedTo || 'Assigned Lead Officer' },
        { label: 'Reported By', value: reportedBy || 'Duty Staff' }
      ],
      actionRequired
    })
  });
  res.json(result);
});

export default router;
