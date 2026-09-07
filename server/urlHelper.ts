import { Request } from 'express';
import os from 'os';

/**
 * Discovers all active IPv4 network interface addresses on the host machine.
 * Useful for displaying network access URLs when running on a LAN, VPS, or cloud server.
 */
export function getNetworkIps(): string[] {
  const nets = os.networkInterfaces();
  const results: string[] = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      // Skip over non-IPv4 and internal loopback addresses (127.0.0.1)
      if (net.family === 'IPv4' && !net.internal) {
        results.push(net.address);
      }
    }
  }
  return results;
}

/**
 * Dynamically resolves the origin (protocol + host + port) for any incoming request.
 * Automatically adapts to whatever IP address, local port, domain name, or reverse proxy is used.
 */
export function getClientOrigin(req: Request): string {
  // 1. Explicitly provided origin in request body (e.g. from window.location.origin in client fetch)
  if (req.body && typeof req.body === 'object') {
    const bodyOrigin = req.body.origin || req.body.appUrl || req.body.redirectTo;
    if (typeof bodyOrigin === 'string' && bodyOrigin.trim().startsWith('http')) {
      return bodyOrigin.trim().replace(/\/+$/, '');
    }
  }

  // 2. HTTP Origin header sent by modern browsers on fetch/XHR
  const headerOrigin = req.headers.origin;
  if (typeof headerOrigin === 'string' && headerOrigin.trim().startsWith('http')) {
    return headerOrigin.trim().replace(/\/+$/, '');
  }

  // 3. HTTP Referer header
  const referer = req.headers.referer;
  if (typeof referer === 'string' && referer.trim().startsWith('http')) {
    try {
      const parsed = new URL(referer);
      return parsed.origin.replace(/\/+$/, '');
    } catch {
      // ignore invalid URL
    }
  }

  // 4. Reverse proxy headers: X-Forwarded-Host and X-Forwarded-Proto
  const forwardedHost = req.headers['x-forwarded-host'];
  const host = (typeof forwardedHost === 'string' ? forwardedHost.split(',')[0].trim() : null) || req.get('host');
  if (host) {
    const forwardedProto = req.headers['x-forwarded-proto'];
    const proto = (typeof forwardedProto === 'string' ? forwardedProto.split(',')[0].trim() : null) || req.protocol || 'http';
    return `${proto}://${host}`.replace(/\/+$/, '');
  }

  // 5. Explicit environment variable if configured and not pointing to localhost
  const envUrl = process.env.APP_URL || process.env.PUBLIC_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim() && !envUrl.includes('localhost')) {
    return envUrl.trim().replace(/\/+$/, '');
  }

  // 6. Server network IP fallback if bound to 0.0.0.0
  const networkIps = getNetworkIps();
  const port = process.env.PORT || 3020;
  if (networkIps.length > 0) {
    return `http://${networkIps[0]}:${port}`;
  }

  // 7. Ultimate fallback
  return `http://localhost:${port}`;
}
