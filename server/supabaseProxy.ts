import https from 'https';
import tls from 'tls';
import type { IncomingMessage, Server } from 'http';
import type { Duplex } from 'stream';
import type { Request, Response, NextFunction } from 'express';
import { getSupabaseUrl } from './supabase.js';

/**
 * Same-origin reverse proxy for Supabase.
 *
 * The browser talks to https://<app domain>/supabase/... (REST, auth, storage and
 * realtime websocket) and this server forwards it to the Supabase project, so the
 * network tab only ever shows the app's own domain instead of *.supabase.co.
 */
export const SUPABASE_PROXY_PREFIX = '/supabase';

const DEFAULT_SUPABASE_URL = 'https://kxikojvpcyprfbyxsdaa.supabase.co';

const HOP_BY_HOP = new Set([
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailer', 'transfer-encoding', 'upgrade', 'host',
]);

function target(): URL {
  return new URL(getSupabaseUrl() || DEFAULT_SUPABASE_URL);
}

function upstreamPath(originalUrl: string): string {
  const rest = originalUrl.slice(SUPABASE_PROXY_PREFIX.length);
  return rest.startsWith('/') ? rest : `/${rest}`;
}

function forwardHeaders(req: IncomingMessage, host: string, keepUpgrade = false): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const [name, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    const key = name.toLowerCase();
    if (HOP_BY_HOP.has(key) && !(keepUpgrade && (key === 'connection' || key === 'upgrade'))) continue;
    // The app's own session cookies are never meant for Supabase.
    if (key === 'cookie' || key.startsWith('x-forwarded-')) continue;
    out[name] = value;
  }
  out.host = host;
  return out;
}

export function supabaseProxy() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.originalUrl !== SUPABASE_PROXY_PREFIX && !req.originalUrl.startsWith(`${SUPABASE_PROXY_PREFIX}/`)) return next();

    const dest = target();
    const upstream = https.request(
      {
        protocol: 'https:',
        hostname: dest.hostname,
        port: dest.port || 443,
        method: req.method,
        path: upstreamPath(req.originalUrl),
        headers: forwardHeaders(req, dest.host),
      },
      (upRes) => {
        const headers: Record<string, string | string[]> = {};
        for (const [name, value] of Object.entries(upRes.headers)) {
          if (value === undefined || HOP_BY_HOP.has(name.toLowerCase())) continue;
          headers[name] = value;
        }
        res.writeHead(upRes.statusCode || 502, upRes.statusMessage, headers);
        upRes.pipe(res);
      },
    );

    upstream.setTimeout(120000, () => upstream.destroy(new Error('Supabase upstream timed out')));
    upstream.on('error', (err) => {
      console.error('[SupabaseProxy]', req.method, req.originalUrl, err.message);
      if (!res.headersSent) res.status(502).json({ error: 'Database gateway unavailable' });
      else res.destroy();
    });
    req.on('aborted', () => upstream.destroy());
    req.pipe(upstream);
  };
}

/** Tunnels realtime websocket upgrades (/supabase/realtime/v1/websocket) to Supabase. */
export function attachSupabaseUpgrade(server: Server) {
  server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = req.url || '';
    if (url !== SUPABASE_PROXY_PREFIX && !url.startsWith(`${SUPABASE_PROXY_PREFIX}/`)) return;

    const dest = target();
    const upstream = tls.connect({ host: dest.hostname, port: Number(dest.port) || 443, servername: dest.hostname }, () => {
      const headers = forwardHeaders(req, dest.host, true);
      const lines = [`${req.method} ${upstreamPath(url)} HTTP/1.1`];
      for (const [name, value] of Object.entries(headers)) {
        for (const v of Array.isArray(value) ? value : [value]) lines.push(`${name}: ${v}`);
      }
      upstream.write(`${lines.join('\r\n')}\r\n\r\n`);
      if (head?.length) upstream.write(head);
      upstream.pipe(socket);
      socket.pipe(upstream);
    });

    const close = () => {
      upstream.destroy();
      socket.destroy();
    };
    upstream.on('error', (err) => {
      console.error('[SupabaseProxy] websocket', err.message);
      close();
    });
    socket.on('error', close);
    socket.on('close', close);
  });
}
