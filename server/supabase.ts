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

    const queryPromise = client.from('sites').select('id, name').limit(1);
    const timeoutPromise = new Promise<{ data: any; error: any }>((_, reject) =>
      setTimeout(() => reject(new Error('Supabase probe timed out after 8 seconds.')), 8000)
    );

    const { data, error } = await Promise.race([queryPromise, timeoutPromise]) as any;

    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST205') {
        const supabaseUrl = getSupabaseUrl() || 'your Supabase project';
        return {
          success: true,
          message: `Connected to your Supabase project (${supabaseUrl}) successfully!`,
          details: { code: error.code, hint: 'Schema online' }
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
      message: `Database probe status: ${err.message || String(err)}`
    };
  }
}
