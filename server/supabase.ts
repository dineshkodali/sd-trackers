import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseAdminClient: SupabaseClient | null = null;
let supabaseAnonClient: SupabaseClient | null = null;

export function getSupabaseUrl(): string | undefined {
  return (
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL
  );
}

export function getSupabaseSecretKey(): string | undefined {
  return (
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export function getSupabasePublishableKey(): string | undefined {
  return (
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
}

export function isSupabaseConfigured(): boolean {
  const url = getSupabaseUrl();
  const key = getSupabaseSecretKey() || getSupabasePublishableKey();
  return Boolean(url && url.trim() !== '' && key && key.trim() !== '');
}

export function getSupabaseAdmin(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (!supabaseAdminClient) {
    const url = getSupabaseUrl()!.trim();
    const serviceKey = (getSupabaseSecretKey() || getSupabasePublishableKey())!.trim();
    
    supabaseAdminClient = createClient(url, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }

  return supabaseAdminClient;
}

export function getSupabaseAnon(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (!supabaseAnonClient) {
    const url = getSupabaseUrl()!.trim();
    const anonKey = (getSupabasePublishableKey() || getSupabaseSecretKey())!.trim();
    
    supabaseAnonClient = createClient(url, anonKey, {
      auth: {
        persistSession: false
      }
    });
  }

  return supabaseAnonClient;
}

export async function testSupabaseConnection(): Promise<{ success: boolean; message: string; details?: any }> {
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      message: 'Supabase credentials are not configured in .env. Please set SUPABASE_URL and SUPABASE_SECRET_KEY or SUPABASE_PUBLISHABLE_KEY.'
    };
  }

  try {
    const client = getSupabaseAdmin() || getSupabaseAnon();
    if (!client) {
      return { success: false, message: 'Could not initialize Supabase client.' };
    }

    // Attempt a light probe on sites table (canonical)
    const { data, error } = await client.from('sites').select('id, name').limit(1);

    if (error) {
      // 42P01 is PostgreSQL "relation does not exist" and PGRST205 is PostgREST "Could not find table in schema cache"
      // Both mean the Supabase instance & credentials are 100% valid, but the user needs to run the schema script!
      if (error.code === '42P01' || error.code === 'PGRST205') {
        const supabaseUrl = getSupabaseUrl() || 'your Supabase project';
        return {
          success: true,
          message: `Connected to your Supabase project (${supabaseUrl}) successfully! Tables are not yet created. Run the supabase-schema.sql script in your Supabase SQL Editor to finish setting up your tables.`,
          details: { code: error.code, hint: 'Run supabase-schema.sql' }
        };
      }
      return {
        success: false,
        message: `Supabase query error: ${error.message} (code: ${error.code})`,
        details: error
      };
    }

    return {
      success: true,
      message: 'Successfully connected to Supabase database!',
      details: { sampleCount: data?.length ?? 0 }
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Failed to connect to Supabase: ${err.message || String(err)}`
    };
  }
}
