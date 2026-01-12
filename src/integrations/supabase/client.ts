import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

// Create a client that fails fast when not configured to avoid silent placeholder calls
const createThrowingClient = (): SupabaseClient => {
  const handler: ProxyHandler<Record<string, unknown>> = {
    get() {
      throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
    }
  };

  // Use Proxy to surface clear errors on any method access
  return new Proxy({}, handler) as SupabaseClient;
};

// Only create the real client if we have valid credentials
export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      {
        auth: {
          storage: localStorage,
          persistSession: true,
          autoRefreshToken: true,
        },
      }
    )
  : createThrowingClient();
