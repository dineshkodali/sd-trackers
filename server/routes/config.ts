import { Router } from 'express';
import { isSupabaseConfigured, testSupabaseConnection } from '../supabase.js';
import { isSmtpConfigured, testSmtpConnection } from '../mailer.js';
import { getClientOrigin, getNetworkIps } from '../urlHelper.js';

const router = Router();

router.get('/status', async (req, res) => {
  const supabaseSet = isSupabaseConfigured();
  const smtpSet = isSmtpConfigured();

  res.json({
    status: 'ok',
    environment: process.env.NODE_ENV || 'development',
    hostInfo: {
      origin: getClientOrigin(req),
      host: req.get('host'),
      protocol: req.protocol,
      networkIps: getNetworkIps()
    },
    services: {
      supabase: {
        configured: supabaseSet,
        url: process.env.SUPABASE_URL ? `${process.env.SUPABASE_URL.substring(0, 20)}...` : null,
        hasAnonKey: Boolean(process.env.SUPABASE_ANON_KEY),
        hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
      },
      smtp: {
        configured: smtpSet,
        host: process.env.SMTP_HOST || null,
        port: process.env.SMTP_PORT || '587',
        user: process.env.SMTP_USER ? `${process.env.SMTP_USER.split('@')[0]}@...` : null,
        from: process.env.SMTP_FROM || null
      },
      gemini: {
        configured: Boolean(process.env.GEMINI_API_KEY)
      }
    }
  });
});

router.get('/test-supabase', async (req, res) => {
  const result = await testSupabaseConnection();
  res.json(result);
});

router.get('/test-smtp', async (req, res) => {
  const result = await testSmtpConnection();
  res.json(result);
});

export default router;
