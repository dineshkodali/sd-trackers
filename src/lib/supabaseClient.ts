import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Safe project fallbacks for client-side Supabase connectivity
const DEFAULT_SUPABASE_URL = 'https://kxikojvpcyprfbyxsdaa.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_Gyrx4Cg-tpjkXwitgNrLqA_jp0ZJpDd';

const env = (import.meta as any).env || {};
const win = typeof window !== 'undefined' ? (window as any) : {};

const supabaseUrl: string =
  env.VITE_SUPABASE_URL ||
  win.__VITE_SUPABASE_URL__ ||
  DEFAULT_SUPABASE_URL;

const supabaseAnonKey: string =
  env.VITE_SUPABASE_ANON_KEY ||
  env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  win.__VITE_SUPABASE_ANON_KEY__ ||
  win.__VITE_SUPABASE_PUBLISHABLE_KEY__ ||
  DEFAULT_SUPABASE_ANON_KEY;

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

