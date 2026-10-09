import { Router } from 'express';
import { isSupabaseConfigured, testSupabaseConnection } from '../supabase.js';
import { isSmtpConfigured, testSmtpConnection } from '../mailer.js';
import { requireAuth, requireRole } from '../middleware/requireAuth.js';

const router = Router();

// Public (used by the container health check): configuration flags only. Host
// names, network addresses and mail account details are not disclosed.
router.get('/status', async (_req, res) => {
  res.json({
    status: 'ok',
    environment: process.env.NODE_ENV || 'development',
    services: {
      supabase: { configured: isSupabaseConfigured() },
      smtp: { configured: isSmtpConfigured() }
    }
  });
});

// Live connectivity probes open outbound connections and return provider error
// text, so they are administrator-only.
router.get('/test-supabase', requireAuth, requireRole('Super Admin', 'Admin'), async (_req, res) => {
  const result = await testSupabaseConnection();
  res.json(result);
});

router.get('/test-smtp', requireAuth, requireRole('Super Admin', 'Admin'), async (_req, res) => {
  const result = await testSmtpConnection();
  res.json(result);
});

export default router;
