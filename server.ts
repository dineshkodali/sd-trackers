import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { exec } from 'child_process';
import { createServer as createHttpServer } from 'http';
import { createServer as createViteServer } from 'vite';

// Load environment variables from .env
dotenv.config();

import configRouter from './server/routes/config.js';
import authRouter from './server/routes/auth.js';
import dbRouter from './server/routes/db.js';
import smtpRouter from './server/routes/smtp.js';
import { runDatabaseMigrations } from './server/migrate.js';
import { getNetworkIps, getClientOrigin } from './server/urlHelper.js';

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

  // Dynamic CORS & pre-flight handling: adapts to whichever domain or IP the browser loads
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Admin-Email, Origin, Accept');
    }
    if (req.method === 'OPTIONS') {
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
  app.use('/api/db', dbRouter);
  app.use('/api/smtp', smtpRouter);

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
