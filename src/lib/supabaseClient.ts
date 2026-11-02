import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Safe project fallbacks for client-side Supabase connectivity
const DEFAULT_SUPABASE_URL = 'https://kxikojvpcyprfbyxsdaa.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_Gyrx4Cg-tpjkXwitgNrLqA_jp0ZJpDd';

const env = (import.meta as any).env || {};
const win = typeof window !== 'undefined' ? (window as any) : {};

const directSupabaseUrl: string =
  env.VITE_SUPABASE_URL ||
  win.__VITE_SUPABASE_URL__ ||
  DEFAULT_SUPABASE_URL;

/**
 * Browser traffic goes through this app's own domain (https://<domain>/supabase/...),
 * which the Express server forwards to Supabase, so the network tab never shows the
 * *.supabase.co host. Static Amplify previews have no server to forward, so they keep
 * the direct URL unless VITE_SUPABASE_PROXY=on is set (with a /supabase rewrite rule).
 * VITE_SUPABASE_PROXY=off forces the direct URL everywhere.
 */
function resolveSupabaseUrl(): string {
  const mode = String(env.VITE_SUPABASE_PROXY || '').toLowerCase();
  if (typeof window === 'undefined' || mode === 'off') return directSupabaseUrl;
  const proxyUrl = `${window.location.origin}/supabase`;
  return proxyIsAvailable(proxyUrl) ? proxyUrl : directSupabaseUrl;
}

/**
 * Hosts without the Express server (static hosting) answer /supabase/* with HTML or a
 * redirect, which would break every page with "invalid JSON". Probe once at startup and
 * only use the proxy when it really returns Supabase JSON; otherwise connect directly.
 */
function proxyIsAvailable(proxyUrl: string): boolean {
  try {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', `${proxyUrl}/auth/v1/health`, false);
    xhr.setRequestHeader('apikey', supabaseAnonKey);
    xhr.send();
    const type = xhr.getResponseHeader('content-type') || '';
    return xhr.status >= 200 && xhr.status < 500 && /json/i.test(type);
  } catch {
    return false;
  }
}

const supabaseAnonKey: string =
  env.VITE_SUPABASE_ANON_KEY ||
  env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  win.__VITE_SUPABASE_ANON_KEY__ ||
  win.__VITE_SUPABASE_PUBLISHABLE_KEY__ ||
  DEFAULT_SUPABASE_ANON_KEY;

const supabaseUrl: string = resolveSupabaseUrl();

let supabaseClientInstance: SupabaseClient | null = null;

export function getBrowserSupabaseClient(): SupabaseClient | null {
  if (typeof window === 'undefined') return null;
  
  if (!supabaseClientInstance && supabaseUrl && supabaseAnonKey) {
    try {
      supabaseClientInstance = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });
    } catch (err) {
      console.error('Failed to create browser Supabase client:', err);
    }
  }
  return supabaseClientInstance;
}

export const supabase = getBrowserSupabaseClient();

