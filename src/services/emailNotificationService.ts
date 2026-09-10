import { NotificationRule, EmailNotificationLog, NotificationEventCode } from '../types';
import { DEFAULT_NOTIFICATION_RULES } from '../data/defaultNotificationRules';

/**
 * Client Service for Email Notification Management
 * Communicates with backend endpoints (/api/smtp/*) with token authentication and fallback runtime caching.
 */

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  const token = localStorage.getItem('sd_auth_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export const emailNotificationService = {
  /**
   * Fetch all configured notification rules
   */
  async getRules(): Promise<NotificationRule[]> {
    try {
      const res = await fetch('/api/smtp/rules', {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.rules)) {
          return data.rules;
        }
      }
    } catch (err) {
      console.warn('Failed to fetch notification rules from server, using defaults:', err);
    }
    return DEFAULT_NOTIFICATION_RULES;
  },

  /**
   * Update a specific notification rule
   */
  async updateRule(id: string, updates: Partial<NotificationRule>): Promise<{ success: boolean; rule?: NotificationRule; error?: string }> {
    try {
      const res = await fetch(`/api/smtp/rules/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updates)
      });
      const data = await res.json();
      return data;
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Reset all notification rules to factory defaults
   */
  async resetRules(): Promise<{ success: boolean; rules?: NotificationRule[]; message?: string }> {
    try {
      const res = await fetch('/api/smtp/rules/reset', {
        method: 'POST',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      return data;
    } catch (err: any) {
      return { success: false, rules: DEFAULT_NOTIFICATION_RULES, message: err.message };
    }
  },

  /**
   * Trigger an automated event notification across any module
   */
  async triggerNotification(
    eventCode: NotificationEventCode | string,
    payload: Record<string, any>,
    options?: {
      site?: string;
      severity?: 'Low' | 'Medium' | 'High' | 'Critical';
      entityId?: string;
      targetRecipients?: string[];
    }
  ): Promise<{
    success: boolean;
    delivered?: boolean;
    simulated?: boolean;
    skipped?: boolean;
    reason?: string;
    recipients?: string[];
    subject?: string;
    logId?: string;
    error?: string;
  }> {
    try {
      const res = await fetch('/api/smtp/trigger', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          eventCode,
          payload,
          site: options?.site,
          severity: options?.severity || 'Medium',
          entityId: options?.entityId,
          targetRecipients: options?.targetRecipients
        })
      });
      const data = await res.json();
      return data;
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Fetch recent delivery logs
   */
  async getLogs(): Promise<EmailNotificationLog[]> {
    try {
      const res = await fetch('/api/smtp/logs', {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.logs)) {
          return data.logs;
        }
      }
    } catch (err) {
      console.warn('Failed to fetch delivery logs from server:', err);
    }
    return [];
  },

  /**
   * Test dispatch a specific rule with sample data
   */
  async testRule(ruleId: string, targetEmail: string): Promise<{ success: boolean; simulated?: boolean; message?: string; error?: string }> {
    try {
      const res = await fetch('/api/smtp/test-rule', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ ruleId, targetEmail })
      });
      const data = await res.json();
      return data;
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Check SMTP configuration status
   */
  async getStatus(): Promise<{ configured: boolean; host: string | null; port: string | number; from: string | null; user: string | null }> {
    try {
      const res = await fetch('/api/smtp/status', {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {}
    return { configured: false, host: null, port: 587, from: null, user: null };
  },

  /**
   * Verify SMTP connection with a test email
   */
  async testConnection(testRecipient: string): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch('/api/smtp/test', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ testRecipient })
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }
};
