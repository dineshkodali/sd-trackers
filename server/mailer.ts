import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

let transporterInstance: Transporter | null = null;

export function isSmtpConfigured(): boolean {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD || process.env.SMTP_PASS;
  return Boolean(host && host.trim() !== '' && user && user.trim() !== '' && pass && pass.trim() !== '');
}

export function getMailer(): Transporter | null {
  if (!isSmtpConfigured()) {
    return null;
  }

  if (!transporterInstance) {
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
        rejectUnauthorized: false // Allow self-signed or internal relays safely
      }
    });
  }

  return transporterInstance;
}

export async function testSmtpConnection(): Promise<{ success: boolean; message: string; config?: any }> {
  if (!isSmtpConfigured()) {
    return {
      success: false,
      message: 'SMTP credentials are not configured in .env. Please set SMTP_HOST, SMTP_USER, and SMTP_PASSWORD.'
    };
  }

  try {
    const mailer = getMailer();
    if (!mailer) {
      return { success: false, message: 'Failed to create SMTP transporter.' };
    }

    await mailer.verify();
    return {
      success: true,
      message: 'SMTP connection verified successfully! Mail server is reachable and credentials are valid.',
      config: {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT || 587,
        user: process.env.SMTP_USER,
        from: process.env.SMTP_FROM || 'SafeHaven Operations'
      }
    };
  } catch (err: any) {
    return {
      success: false,
      message: `SMTP connection failed: ${err.message || String(err)}`
    };
  }
}

export async function sendEmail(options: {
  to: string;
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

    const fromAddress = process.env.SMTP_FROM || `SafeHaven Operations <${process.env.SMTP_USER}>`;

    const info = await mailer.sendMail({
      from: fromAddress,
      to: options.to,
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
