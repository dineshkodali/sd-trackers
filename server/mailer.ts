import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

let transporterInstance: Transporter | null = null;

export function isSmtpConfigured(): boolean {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD || process.env.SMTP_PASS;
  return Boolean(host && host.trim() !== '' && user && user.trim() !== '' && pass && pass.trim() !== '');
}

export function getSmtpConfigSummary() {
  const host = process.env.SMTP_HOST?.trim() || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER?.trim() || '';
  const from = process.env.SMTP_FROM?.trim() || (user ? `SD Trackers <${user}>` : 'SD Trackers');
  const configured = isSmtpConfigured();
  return {
    configured,
    mode: 'production' as const,
    host,
    port: String(port),
    user,
    from
  };
}

export function getMailer(forceFresh = false): Transporter | null {
  if (!isSmtpConfigured()) {
    return null;
  }

  if (!transporterInstance || forceFresh) {
    const host = process.env.SMTP_HOST!.trim();
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const user = process.env.SMTP_USER!.trim();
    const pass = (process.env.SMTP_PASSWORD || process.env.SMTP_PASS)!.trim();
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;

    transporterInstance = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass
      },
      tls: {
        rejectUnauthorized: false
      }
    });
  }

  return transporterInstance;
}

export async function testSmtpConnection(): Promise<{ success: boolean; message: string; config?: any }> {
  if (!isSmtpConfigured()) {
    return {
      success: false,
      message: 'SMTP credentials are not configured in the root .env file. Please ensure SMTP_HOST, SMTP_USER, and SMTP_PASSWORD/SMTP_PASS are present.'
    };
  }

  try {
    const mailer = getMailer(true);
    if (!mailer) {
      return { success: false, message: 'Failed to create SMTP transporter from .env credentials.' };
    }

    await mailer.verify();
    const summary = getSmtpConfigSummary();
    return {
      success: true,
      message: 'Production SMTP connection verified successfully! Live mail relay is active and authenticated.',
      config: summary
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Production SMTP connection failed: ${err.message || String(err)}`
    };
  }
}

export async function sendEmail(options: {
  to: string;
  cc?: string;
  subject: string;
  text?: string;
  html?: string;
}): Promise<{ success: boolean; messageId?: string; message: string }> {
  if (!isSmtpConfigured()) {
    return {
      success: false,
      message: 'SMTP is not configured in .env. Message could not be dispatched.'
    };
  }

  try {
    const mailer = getMailer();
    if (!mailer) {
      throw new Error('Transporter unavailable');
    }

    const fromAddress = process.env.SMTP_FROM || (process.env.SMTP_USER ? `SD Trackers <${process.env.SMTP_USER}>` : 'SD Trackers');

    const info = await mailer.sendMail({
      from: fromAddress,
      to: options.to,
      cc: options.cc,
      subject: options.subject,
      text: options.text || (options.html ? options.html.replace(/<[^>]+>/g, '') : ''),
      html: options.html || options.text
    });

    return {
      success: true,
      messageId: info.messageId,
      message: `Email successfully dispatched to ${options.to}`
    };
  } catch (err: any) {
    console.error('Error sending email via SMTP:', err);
    return {
      success: false,
      message: `Failed to send email: ${err.message || String(err)}`
    };
  }
}
