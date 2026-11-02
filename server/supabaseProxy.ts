import https from 'https';
import tls from 'tls';
import zlib from 'zlib';
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
 *
 * Nothing that identifies the upstream is passed back: response headers are
 * allow-listed (no sb-*, cf-*, server, via, ...), and the Supabase host inside
 * redirects, cookies and text bodies is rewritten to the app's own gateway address.
 */
export const SUPABASE_PROXY_PREFIX = '/supabase';

const DEFAULT_SUPABASE_URL = 'https://kxikojvpcyprfbyxsdaa.supabase.co';

const HOP_BY_HOP = new Set([
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailer', 'transfer-encoding', 'upgrade', 'host',
]);

/** Response headers that are safe to hand back to the browser; everything else is dropped. */
const RESPONSE_ALLOW = new Set([
  'content-type', 'content-length', 'content-encoding', 'content-range', 'content-disposition',
  'cache-control', 'etag', 'last-modified', 'expires', 'date', 'vary', 'accept-ranges',
  'location', 'set-cookie', 'www-authenticate', 'retry-after', 'preference-applied',
  'content-profile', 'x-total-count',
]);

const WS_RESPONSE_ALLOW = new Set(['upgrade', 'connection', 'sec-websocket-accept', 'sec-websocket-protocol', 'sec-websocket-extensions']);

function target(): URL {
  return new URL(getSupabaseUrl() || DEFAULT_SUPABASE_URL);
}

function upstreamPath(originalUrl: string): string {
  const rest = originalUrl.slice(SUPABASE_PROXY_PREFIX.length);
  return rest.startsWith('/') ? rest : `/${rest}`;
}

function publicHost(req: IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-host'];
  const raw = (Array.isArray(forwarded) ? forwarded[0] : forwarded) || req.headers.host || 'localhost';
  return String(raw).split(',')[0].trim();
}

function publicBase(req: IncomingMessage, secure: boolean): string {
  return `${secure ? 'https' : 'http'}://${publicHost(req)}${SUPABASE_PROXY_PREFIX}`;
}

/** Replace every mention of the upstream host with the app's own gateway address. */
function scrub(text: string, dest: URL, base: string, host: string): string {
  return text
    .split(`https://${dest.host}`).join(base)
    .split(`wss://${dest.host}`).join(base.replace(/^http/, 'ws'))
    .split(dest.host).join(`${host}${SUPABASE_PROXY_PREFIX}`);
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

const isTextual = (type: string) => /json|text|xml|javascript|html/i.test(type);

function decode(buf: Buffer, encoding: string): Buffer {
  switch (encoding) {
    case 'gzip': return zlib.gunzipSync(buf);
    case 'br': return zlib.brotliDecompressSync(buf);
    case 'deflate': return zlib.inflateSync(buf);
    default: return buf;
  }
}

export function supabaseProxy() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.originalUrl !== SUPABASE_PROXY_PREFIX && !req.originalUrl.startsWith(`${SUPABASE_PROXY_PREFIX}/`)) return next();

    const dest = target();
    const base = publicBase(req, req.secure);
    const host = publicHost(req);

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
          const key = name.toLowerCase();
          if (value === undefined || !RESPONSE_ALLOW.has(key)) continue;
          if (key === 'location') {
            headers[key] = scrub(String(value), dest, base, host);
          } else if (key === 'set-cookie') {
            // Cookies must belong to the app's own domain, not the database host.
            headers[key] = (value as string[]).map(c => c.replace(/;\s*domain=[^;]*/i, ''));
          } else {
            headers[key] = value;
          }
        }

        const type = String(upRes.headers['content-type'] || '');
        if (!isTextual(type)) {
          res.writeHead(upRes.statusCode || 502, headers);
          upRes.pipe(res);
          return;
        }

        // Text bodies (JSON, HTML) can carry absolute upstream URLs: buffer and rewrite them.
        const chunks: Buffer[] = [];
        upRes.on('data', (c: Buffer) => chunks.push(c));
        upRes.on('error', () => res.destroy());
        upRes.on('end', () => {
          try {
            const encoding = String(upRes.headers['content-encoding'] || '').toLowerCase();
            let body = Buffer.from(scrub(decode(Buffer.concat(chunks), encoding).toString('utf8'), dest, base, host), 'utf8');
            delete headers['content-encoding'];
            if (body.length > 1024 && /\bgzip\b/.test(String(req.headers['accept-encoding'] || ''))) {
              body = zlib.gzipSync(body);
              headers['content-encoding'] = 'gzip';
            }
            headers['content-length'] = String(body.length);
            res.writeHead(upRes.statusCode || 502, headers);
            res.end(body);
          } catch {
            if (!res.headersSent) res.status(502).json({ error: 'Database gateway unavailable' });
            else res.destroy();
          }
        });
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
    });

    // Filter the handshake response so no upstream identifying headers reach the browser.
    let pending = Buffer.alloc(0);
    const onHandshake = (chunk: Buffer) => {
      pending = Buffer.concat([pending, chunk]);
      const end = pending.indexOf('\r\n\r\n');
      if (end === -1) return;
      upstream.off('data', onHandshake);
      const [statusLine, ...rawHeaders] = pending.subarray(0, end).toString('latin1').split('\r\n');
      const kept = rawHeaders.filter(line => WS_RESPONSE_ALLOW.has(line.split(':')[0].trim().toLowerCase()));
      socket.write(`${[statusLine, ...kept].join('\r\n')}\r\n\r\n`);
      const rest = pending.subarray(end + 4);
      if (rest.length) socket.write(rest);
      upstream.pipe(socket);
      socket.pipe(upstream);
    };
    upstream.on('data', onHandshake);

    const close = () => {
      upstream.destroy();
      socket.destroy();
    };
    upstream.on('error', (err) => {
      console.error('[SupabaseProxy] websocket', err.message);
      close();
    });
    upstream.on('close', close);
    socket.on('error', close);
    socket.on('close', close);
  });
}
