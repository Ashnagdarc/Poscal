import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

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
  : createClient(
      'https://placeholder.supabase.co',
      'placeholder-key',
      {
        auth: {
          storage: localStorage,
          persistSession: true,
          autoRefreshToken: true,
        },
      }
    );
