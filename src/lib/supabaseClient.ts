import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

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

