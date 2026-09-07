import { Router, Request, Response } from 'express';
import { isSmtpConfigured, testSmtpConnection, sendEmail } from '../mailer.js';

const router = Router();

// GET /api/smtp/status
router.get('/status', async (req: Request, res: Response) => {
  const configured = isSmtpConfigured();
  res.json({
    configured,
    host: process.env.SMTP_HOST || null,
    port: process.env.SMTP_PORT || '587',
    from: process.env.SMTP_FROM || null,
    user: process.env.SMTP_USER ? `${process.env.SMTP_USER.split('@')[0]}@...` : null
  });
});

// POST /api/smtp/test
router.post('/test', async (req: Request, res: Response) => {
  const { testRecipient } = req.body;
  const targetEmail = testRecipient || process.env.SMTP_USER;

  if (!targetEmail) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a test recipient email address or set SMTP_USER in .env'
    });
  }

  if (!isSmtpConfigured()) {
    return res.status(400).json({
      success: false,
      message: 'SMTP is not configured in .env. Please set SMTP_HOST, SMTP_USER, and SMTP_PASSWORD.'
    });
  }

  // First verify connection
  const verifyResult = await testSmtpConnection();
  if (!verifyResult.success) {
    return res.status(500).json(verifyResult);
  }

  // Dispatch test message
  const result = await sendEmail({
    to: targetEmail,
    subject: 'SD Operations - SMTP Test Notification',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1dfdd; border-radius: 4px;">
        <h2 style="color: #004578; margin-top: 0;">SMTP Dispatch Verified</h2>
        <p>This is a test notification confirming that your SD Operations application has successfully connected to your SMTP mail server and can deliver notifications.</p>
        <div style="background-color: #f3f2f1; padding: 12px; border-radius: 4px; font-size: 13px; margin: 15px 0;">
          <strong>Server Host:</strong> ${process.env.SMTP_HOST}<br/>
          <strong>Server Port:</strong> ${process.env.SMTP_PORT || 587}<br/>
          <strong>Sender Address:</strong> ${process.env.SMTP_FROM || process.env.SMTP_USER}<br/>
          <strong>Dispatched At:</strong> ${new Date().toISOString()}
        </div>
        <p style="color: #605e5c; font-size: 12px;">SD Operations Compliance & Property Management System</p>
      </div>
    `
  });

  res.json(result);
});

// POST /api/smtp/alert - Operational alert (safeguarding, urgent maintenance, incident)
router.post('/alert', async (req: Request, res: Response) => {
  const { recipient, alertType, title, message, entityId, site, severity = 'Urgent', metadata } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Title is required for operational alerts.' });
  }

  const targetRecipient = recipient || process.env.SMTP_USER || 'dineshkodali16@gmail.com';

  if (!isSmtpConfigured()) {
    return res.json({
      success: true,
      simulated: true,
      message: 'SMTP not configured in .env. Alert logged in demonstration mode.'
    });
  }

  const severityColor = severity === 'Critical' ? '#a80000' : severity === 'High' ? '#d83b01' : '#0078d4';

  const result = await sendEmail({
    to: targetRecipient,
    subject: `[${severity.toUpperCase()} ALERT] SD Operations: ${title}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 620px; margin: 0 auto; padding: 24px; border: 1px solid #e1dfdd; border-radius: 4px; background: #ffffff;">
        <div style="background-color: ${severityColor}; color: white; padding: 10px 14px; font-weight: bold; font-size: 13px; border-radius: 3px; letter-spacing: 0.5px; text-transform: uppercase;">
          ⚠️ ${severity.toUpperCase()} ALERT: ${alertType || 'Operational Safeguarding Incident'}
        </div>
        <h2 style="color: #201f1e; margin-top: 18px; margin-bottom: 8px; font-size: 18px;">${title}</h2>
        <p style="color: #323130; line-height: 1.6; font-size: 14px; margin-bottom: 16px;">${message || 'No additional details provided.'}</p>
        
        <table style="width: 100%; border-collapse: collapse; background-color: #faf9f8; border: 1px solid #edebe9; border-radius: 4px; font-size: 13px; margin: 16px 0;">
          <tbody>
            <tr>
              <td style="padding: 8px 12px; font-weight: 600; color: #605e5c; border-bottom: 1px solid #edebe9; width: 35%;">Site / Accommodation:</td>
              <td style="padding: 8px 12px; color: #201f1e; font-weight: bold; border-bottom: 1px solid #edebe9;">${site || 'All Sites'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; font-weight: 600; color: #605e5c; border-bottom: 1px solid #edebe9;">Incident Reference:</td>
              <td style="padding: 8px 12px; font-family: monospace; color: #201f1e; border-bottom: 1px solid #edebe9;">${entityId || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; font-weight: 600; color: #605e5c; border-bottom: 1px solid #edebe9;">Priority / Risk:</td>
              <td style="padding: 8px 12px; color: ${severityColor}; font-weight: bold; border-bottom: 1px solid #edebe9;">${severity}</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; font-weight: 600; color: #605e5c;">Dispatched Timestamp:</td>
              <td style="padding: 8px 12px; color: #201f1e;">${new Date().toLocaleString('en-GB', { timeZone: 'UTC' })} UTC</td>
            </tr>
          </tbody>
        </table>

        ${metadata ? `
          <div style="margin-top: 12px; padding: 10px; background: #f3f2f1; border-left: 3px solid ${severityColor}; font-size: 12px; color: #323130;">
            ${Object.entries(metadata).map(([k, v]) => `<div><strong>${k}:</strong> ${v}</div>`).join('')}
          </div>
        ` : ''}

        <div style="margin-top: 20px; padding-top: 14px; border-top: 1px solid #edebe9; font-size: 11px; color: #8a8886; line-height: 1.4;">
          This automated security & safeguarding alert was generated by the <strong>SD Operations & Safeguarding Compliance Portal</strong>.
        </div>
      </div>
    `
  });

  res.json(result);
});

// POST /api/smtp/escalation-alert - Dedicated trigger for critical escalations
router.post('/escalation-alert', async (req: Request, res: Response) => {
  const { 
    suName, 
    site, 
    roomNo,
    incidentTitle, 
    urgency = 'Critical', 
    escalatedTo, 
    reason, 
    actionRequired, 
    reportedBy,
    recipientEmail 
  } = req.body;

  const targetEmail = recipientEmail || process.env.SMTP_USER || 'dineshkodali16@gmail.com';

  if (!isSmtpConfigured()) {
    return res.json({
      success: true,
      simulated: true,
      message: 'SMTP not configured in .env. Escalation alert logged in demo mode.'
    });
  }

  const result = await sendEmail({
    to: targetEmail,
    subject: `🚨 [ESCALATION ALERT - ${urgency.toUpperCase()}] ${site}: ${suName} - ${incidentTitle || 'Immediate Attention Required'}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 620px; margin: 0 auto; padding: 24px; border: 2px solid #a80000; border-radius: 4px; background: #ffffff;">
        <div style="background-color: #a80000; color: #ffffff; padding: 12px 16px; font-weight: bold; font-size: 14px; border-radius: 2px; text-transform: uppercase; letter-spacing: 0.5px;">
          🚨 FORMAL SAFEGUARDING ESCALATION ALERT
        </div>

        <div style="padding: 16px 0;">
          <h2 style="color: #a80000; margin-top: 0; font-size: 19px; margin-bottom: 6px;">
            ${incidentTitle || 'Urgent Escalation Notice'}
          </h2>
          <p style="color: #323130; font-size: 14px; line-height: 1.5; margin: 0 0 12px 0;">
            A formal operational escalation has been filed requiring immediate review and action by designated key workers and management.
          </p>
        </div>

        <table style="width: 100%; border-collapse: collapse; background-color: #fff9f9; border: 1px solid #f3d6d6; font-size: 13px; margin-bottom: 16px;">
          <tbody>
            <tr>
              <td style="padding: 8px 12px; font-weight: 600; color: #605e5c; border-bottom: 1px solid #f3d6d6; width: 35%;">Service User:</td>
              <td style="padding: 8px 12px; color: #201f1e; font-weight: bold; border-bottom: 1px solid #f3d6d6;">${suName || 'Confidential Service User'} ${roomNo ? `(Room ${roomNo})` : ''}</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; font-weight: 600; color: #605e5c; border-bottom: 1px solid #f3d6d6;">Accommodation Site:</td>
              <td style="padding: 8px 12px; color: #201f1e; font-weight: bold; border-bottom: 1px solid #f3d6d6;">${site || 'Unspecified Property'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; font-weight: 600; color: #605e5c; border-bottom: 1px solid #f3d6d6;">Priority / Urgency:</td>
              <td style="padding: 8px 12px; color: #a80000; font-weight: bold; border-bottom: 1px solid #f3d6d6;">${urgency}</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; font-weight: 600; color: #605e5c; border-bottom: 1px solid #f3d6d6;">Escalated To:</td>
              <td style="padding: 8px 12px; color: #004578; font-weight: 600; border-bottom: 1px solid #f3d6d6;">${escalatedTo || 'Assigned Lead Officer'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; font-weight: 600; color: #605e5c; border-bottom: 1px solid #f3d6d6;">Reported By:</td>
              <td style="padding: 8px 12px; color: #201f1e; border-bottom: 1px solid #f3d6d6;">${reportedBy || 'Duty Staff'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; font-weight: 600; color: #605e5c;">Timestamp:</td>
              <td style="padding: 8px 12px; color: #201f1e;">${new Date().toLocaleString('en-GB', { timeZone: 'UTC' })} UTC</td>
            </tr>
          </tbody>
        </table>

        ${reason ? `
          <div style="margin-bottom: 14px; padding: 12px; background: #faf9f8; border-left: 4px solid #a80000; font-size: 13px;">
            <strong style="color: #201f1e; display: block; margin-bottom: 4px;">Incident Details / Reason:</strong>
            <span style="color: #323130; line-height: 1.5;">${reason}</span>
          </div>
        ` : ''}

        ${actionRequired ? `
          <div style="margin-bottom: 16px; padding: 12px; background: #eff6fc; border-left: 4px solid #0078d4; font-size: 13px;">
            <strong style="color: #004578; display: block; margin-bottom: 4px;">Immediate Remedial Action Required:</strong>
            <span style="color: #201f1e; line-height: 1.5;">${actionRequired}</span>
          </div>
        ` : ''}

        <div style="margin-top: 20px; padding-top: 14px; border-top: 1px solid #edebe9; font-size: 11px; color: #8a8886;">
          Confidential Operational Record — SD Operations Compliance System.
        </div>
      </div>
    `
  });

  res.json(result);
});

export default router;
