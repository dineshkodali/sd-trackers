import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { exec } from 'child_process';
import { createServer as createHttpServer } from 'http';
import { createServer as createViteServer } from 'vite';

// Load environment variables from .env
dotenv.config();

import configRouter from './routes/config.js';
import authRouter from './routes/auth.js';
import dbRouter from './routes/db.js';
import smtpRouter from './routes/smtp.js';
import { runDatabaseMigrations } from './migrate.js';
import { getNetworkIps, getClientOrigin } from './urlHelper.js';
import { requireAuth } from './middleware/requireAuth.js';

const HOST = process.env.HOST || '0.0.0.0';
const DEFAULT_PORT = Number(process.env.PORT || 3000);
const PUBLIC_URL = process.env.PUBLIC_URL || process.env.VITE_PUBLIC_URL || process.env.AI_STUDIO_URL || '';

function getDisplayUrls(port: number): { local: string; networkUrls: string[]; publicUrl: string } {
  const localUrl = `http://localhost:${port}`;
  const networkIps = getNetworkIps();
  const networkUrls = networkIps.map(ip => `http://${ip}:${port}`);
  const publicUrl = PUBLIC_URL 
    ? PUBLIC_URL.replace(/\/$/, '') 
    : (networkUrls[0] || `http://${HOST === '0.0.0.0' ? '127.0.0.1' : HOST}:${port}`);

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

  // Auto-run database schema migrations on bootup if PostgreSQL connection string exists
  runDatabaseMigrations()
    .then((res) => {
      if (res.success) {
        console.log('[Migration]', res.message);
      } else {
        console.log('[Migration Note]', res.message);
      }
    })
    .catch((err) => {
      console.error('[Migration Error]', err);
    });

  // Trust reverse proxies (Nginx, Apache, Caddy, Cloudflare, Docker, AWS ALB)
  // Ensures req.protocol and req.get('host') adapt automatically to incoming domain/IP
  app.set('trust proxy', true);

  /**
   * CORS allow-list.
   *
   * This previously reflected whatever `Origin` the caller sent and paired it
   * with `Access-Control-Allow-Credentials: true`, so any website a signed-in
   * member of staff visited could issue credentialed cross-origin reads and
   * writes against the safeguarding database (BUG-003).
   *
   * The platform is genuinely meant to be reachable over the LAN and behind a
   * proxy, so the list is built rather than hardcoded: explicit configuration
   * first, then this host's own advertised addresses. Anything else gets no CORS
   * headers at all, which the browser turns into a blocked cross-origin request.
   * Same-origin traffic — the application itself — never needs these headers and
   * is unaffected.
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
    if (origin && allowedOrigins.has(origin.replace(/\/+$/, ''))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Admin-Email, Origin, Accept');
      res.setHeader('Vary', 'Origin');
    }
    if (req.method === 'OPTIONS') {
      // Un-allow-listed pre-flight gets no CORS headers, so the browser refuses.
      return res.sendStatus(204);
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
      service: 'SafeHaven Operations API',
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
  // Every data route now requires a verified session. Previously these accepted
  // anonymous requests and ran with the service-role key, bypassing RLS entirely
  // (BUG-001). Authorization decisions downstream use req.user, not the
  // client-supplied x-user-* headers, which any caller can forge.
  app.use('/api/db', requireAuth, dbRouter);
  app.use('/api/smtp', requireAuth, smtpRouter);

  // Vite middleware for development / Static files for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
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
    console.log(`  SafeHaven Operations Platform Ready:`);
    console.log(`  ➜  Local:     ${local}`);
    if (networkUrls.length > 0) {
      networkUrls.forEach(url => console.log(`  ➜  Network:   ${url}`));
    }
    if (PUBLIC_URL) {
      console.log(`  ➜  Public:    ${publicUrl}`);
    }
    console.log(`  ➜  Bound to:  ${HOST}:${PORT}`);
    console.log(`  ======================================================\n`);

    if (process.env.OPEN_BROWSER !== 'false') {
      openBrowser(local);
    }
  });
}

startServer();
