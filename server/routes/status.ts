import { Router } from 'express';
import { statusMonitor } from '../status/monitor.js';

const router = Router();

/**
 * GET /api/status - public service health for the status page (/status/).
 *
 * Served from the monitor's in-memory snapshot: no authentication, no database
 * or dependency access per request, and only public-safe fields. Any origin may
 * read it (without credentials) so the page also works when hosted separately.
 */
router.get('/', async (req, res) => {
  if (!res.getHeader('Access-Control-Allow-Origin')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Cache-Control', 'no-cache');
  if (req.query.live === '1' || req.query.fresh === '1') {
    try {
      await statusMonitor.triggerCycle();
    } catch {
      // Fallback to current snapshot
    }
  }
  res.json(statusMonitor.snapshot());
});

export default router;
