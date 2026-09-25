import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import dns from 'dns';
import { exec } from 'child_process';
import { createServer as createHttpServer } from 'http';
import { createServer as createViteServer } from 'vite';

// Ensure IPv4 resolution priority to avoid Windows IPv6 network stalls on cloud endpoints
try {
  dns.setDefaultResultOrder('ipv4first');
} catch (_) {}

// Load environment variables strictly from root .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import configRouter from './routes/config.js';
import authRouter from './routes/auth.js';
import dbRouter from './routes/db.js';
import smtpRouter from './routes/smtp.js';
import statusRouter from './routes/status.js';
import financeRouter from './routes/finance.js';
import documentBuilderRouter from './routes/documentBuilder.js';
import { statusMonitor } from './status/monitor.js';
import { runDatabaseMigrations } from './migrate.js';
import { seedReferenceData } from './seed.js';
import { invalidateLiveSchema } from './liveSchema.js';
import { isSupabaseConfigured } from './supabase.js';
import { getNetworkIps, getClientOrigin } from './urlHelper.js';
import { requireAuth, resolveUser } from './middleware/requireAuth.js';

const HOST = process.env.HOST || '0.0.0.0';
const DEFAULT_PORT = Number(process.env.PORT || 3020);
const PUBLIC_URL = process.env.PUBLIC_URL || process.env.VITE_PUBLIC_URL || process.env.APP_URL || '';

function getDisplayUrls(port: number): { local: string; networkUrls: string[]; publicUrl: string } {
  const localUrl = `http://localhost:${port}`;
  const networkIps = getNetworkIps();
  const networkUrls = networkIps.map(ip => `http://${ip}:${port}`);
  let publicUrl = PUBLIC_URL 
    ? PUBLIC_URL.replace(/\/$/, '') 
    : (networkUrls[0] || `http://${HOST === '0.0.0.0' ? '127.0.0.1' : HOST}:${port}`);

  if (publicUrl.includes(':3000')) {
    publicUrl = publicUrl.replace(':3000', `:${port}`);
  }

  return { local: localUrl, networkUrls, publicUrl };
}

function openBrowser(url: string) {
  const safeUrl = url.replace(/&/g, '^&');

  const command = process.platform === 'darwin'
    ? `open "${safeUrl}"`
    : process.platform === 'win32'
      ? `start "" "${safeUrl}"`
      : `xdg-open "${safeUrl}"`;

  exec(command, { windowsHide: true }, (error) => {
    if (error) {
      console.log(`[Browser] Automatic browser open was skipped for ${url}`);
    }
  });
}

function getAvailablePort(startPort: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createHttpServer();

    probe.once('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        resolve(getAvailablePort(startPort + 1));
        return;
      }
      reject(error);
    });

    probe.once('listening', () => {
      const address = probe.address();
      const port = typeof address === 'object' && address ? address.port : startPort;

      probe.close(() => resolve(port));
    });

    probe.listen(startPort, HOST);
  });
}

async function startServer() {
  const app = express();
  const PORT = await getAvailablePort(DEFAULT_PORT);

  if (process.env.NODE_ENV === 'production') {
    if (!process.env.AUTH_TOKEN_SECRET) {
      console.warn('[Startup] AUTH_TOKEN_SECRET is not set: built-in administrator sessions will not survive a restart.');
    }
    if (!isSupabaseConfigured()) {
      console.error('[Startup] Live database is NOT configured (SUPABASE_URL / SUPABASE_SECRET_KEY). Every save will be refused.');
    }
  }

  // Apply the (non-destructive, idempotent) schema, then seed reference data
  // into any empty tables. Neither blocks the server from starting.
  runDatabaseMigrations()
    .then(async (res) => {
      if (res.success) {
        console.log('[Migration]', res.message);
      } else {
        console.warn('[Migration NOT applied]', res.message);
      }
      invalidateLiveSchema();
      const seed = await seedReferenceData();
      if (seed.seeded.length) console.log('[Seed] Seeded:', seed.seeded.join(', '));
      if (seed.errors.length) console.warn('[Seed] Errors:', seed.errors.join('; '));
      const pending = seed.skipped.filter(s => s.includes('migration pending'));
      if (pending.length) console.warn('[Seed] Waiting for migration:', pending.join(', '));
      statusMonitor.setStartupResult({ migrationApplied: res.success, seedErrors: seed.errors.length });
    })
    .catch((err) => {
      console.error('[Migration Error]', err);
      statusMonitor.setStartupResult({ migrationApplied: false, seedErrors: 1 });
    });

  // Trust reverse proxies (Nginx, Apache, Caddy, Cloudflare, Docker, AWS ALB)
  // Ensures req.protocol and req.get('host') adapt automatically to incoming domain/IP
  app.set('trust proxy', true);

  /**
   * CORS allow-list.
   *
   * The platform is reachable over the LAN, behind a proxy, or accessed via VPS IP.
   */
  const allowedOrigins = new Set<string>();
  const addOrigin = (value?: string | null) => {
    const trimmed = (value || '').trim().replace(/\/+$/, '');
    if (trimmed.startsWith('http')) allowedOrigins.add(trimmed);
  };

  (process.env.ALLOWED_ORIGINS || '').split(',').forEach(addOrigin);
  addOrigin(process.env.APP_URL);
  addOrigin(process.env.PUBLIC_URL);
  addOrigin(PUBLIC_URL);
  for (const scheme of ['http', 'https']) {
    addOrigin(`${scheme}://localhost:${PORT}`);
    addOrigin(`${scheme}://127.0.0.1:${PORT}`);
    for (const ip of getNetworkIps()) addOrigin(`${scheme}://${ip}:${PORT}`);
  }

  app.use((req, res, next) => {
    const origin = req.headers.origin;
    const reqHost = req.headers['x-forwarded-host'] || req.headers.host;

    let isAllowed = false;
    if (origin) {
      const cleanOrigin = origin.replace(/\/+$/, '');
      if (
        allowedOrigins.has('*') ||
        allowedOrigins.has(cleanOrigin) ||
        cleanOrigin.endsWith('.amplifyapp.com') ||
        cleanOrigin.endsWith('.sdcdms.co.uk')
      ) {
        isAllowed = true;
      } else if (reqHost) {
        try {
          const originHost = new URL(cleanOrigin).host;
          const currentHost = (typeof reqHost === 'string' ? reqHost.split(',')[0].trim() : '');
          if (originHost === currentHost) {
            isAllowed = true;
          }
        } catch {}
      }
    } else {
      isAllowed = true;
    }

    if (origin && isAllowed) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Admin-Email, Origin, Accept, x-user-id, x-user-email, x-user-name, x-user-role, x-user-site, x-action-type, x-audit-context');
      res.setHeader('Vary', 'Origin');
    }
    if (req.method === 'OPTIONS') {
      return res.sendStatus(isAllowed ? 204 : 403);
    }
    next();
  });

  // Body parser with comfortable limit for bulk sync
  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));

  // Graceful error handling for malformed JSON request bodies
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof SyntaxError && 'status' in err && (err as any).status === 400 && 'body' in err) {
      return res.status(400).json({
        success: false,
        error: 'Malformed JSON payload in request body'
      });
    }
    next(err);
  });

  // API routes FIRST
  app.get('/api/health', (req, res) => {
    const detectedOrigin = getClientOrigin(req);
    const host = (req.headers['x-forwarded-host'] as string) || req.get('host');
    res.json({
      status: 'ok',
      service: 'SD Operations API',
      detectedOrigin,
      host,
      protocol: req.protocol,
      ip: req.ip,
      timestamp: new Date().toISOString()
    });
  });

  // Mount API routers
  app.use('/api/config', configRouter);
  app.use('/api/auth', authRouter);
  // Allow public status monitoring on /api/db/status while enforcing requireAuth on all data endpoints
  app.use('/api/db', (req, res, next) => {
    if (req.path === '/status' || req.path === '/status/' || req.url === '/status' || req.url.startsWith('/status?') || req.originalUrl.startsWith('/api/db/status')) {
      return next();
    }
    return requireAuth(req, res, next);
  }, dbRouter);

  // Allow public status monitoring on /api/smtp/status while securing email sending & rule editing
  app.use('/api/smtp', (req, res, next) => {
    if (req.path === '/status' || req.path === '/status/' || req.url === '/status' || req.url.startsWith('/status?') || req.originalUrl.startsWith('/api/smtp/status')) {
      return next();
    }
    return requireAuth(req, res, next);
  }, smtpRouter);
  // Mount Finance module router
  app.use('/api/finance', requireAuth, financeRouter);
  // Mount HO Report Generator module router (concurrently supporting /api/document-builder and /api/ho-reports)
  app.use(['/api/document-builder', '/api/ho-reports'], async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      if (token) {
        try {
          const user = await resolveUser(token);
          if (user) {
            req.user = user;
            return documentBuilderRouter(req, res, next);
          }
        } catch (_) {}
      }
    }

    const clientRole = (req.headers['x-user-role'] as string) || 'Staff';
    const clientName = (req.headers['x-user-name'] as string) || 'Staff Member';
    const clientEmail = (req.headers['x-user-email'] as string) || 'staff@sdcdms.co.uk';
    const clientSite = (req.headers['x-user-site'] as string) || 'All Sites';
    const clientId = (req.headers['x-user-id'] as string) || 'usr-staff';

    req.user = {
      id: clientId,
      email: clientEmail,
      name: clientName,
      role: clientRole,
      assignedSite: clientSite,
      provider: 'built-in',
    };

    return documentBuilderRouter(req, res, next);
  });
  // Public status monitoring endpoint (real-time health probes & incidents)
  app.use('/api/status', statusRouter);

  // Static route for Pitch Deck presentation
  app.use('/pitch-deck', express.static(path.join(process.cwd(), 'pitch-deck')));

  // Process error monitoring - immediate reflection on status page
  process.on('uncaughtException', (err) => {
    console.error('[Process Error: uncaughtException]', err);
    statusMonitor.recordProcessError('uncaughtException', err.message);
  });
  process.on('unhandledRejection', (reason) => {
    console.error('[Process Error: unhandledRejection]', reason);
    statusMonitor.recordProcessError('unhandledRejection', String(reason));
  });

  // Vite middleware for development / Static files for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        watch: {
          ignored: ['**/server/data/**', '**/dist/**', '**/*.json']
        }
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const { local, networkUrls, publicUrl } = getDisplayUrls(PORT);

  app.listen(PORT, HOST, () => {
    console.log(`\n  ======================================================`);
    console.log(`  SD Operations Platform Ready:`);
    console.log(`  ➜  Local:     ${local}`);
    if (networkUrls.length > 0) {
      networkUrls.forEach(url => console.log(`  ➜  Network:   ${url}`));
    }
    if (PUBLIC_URL) {
      console.log(`  ➜  Public:    ${publicUrl}`);
    }
    console.log(`  ➜  Bound to:  ${HOST}:${PORT}`);
    console.log(`  ======================================================\n`);

    // Start background status probe monitoring immediately
    statusMonitor.start(local);

    if (process.env.OPEN_BROWSER !== 'false') {
      openBrowser(local);
    }
  });
}

startServer();
