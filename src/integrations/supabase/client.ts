import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Check if Supabase is configured
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

// Create a placeholder client if not configured (to prevent crashes)
const createSupabaseClient = (): SupabaseClient => {
  if (!isSupabaseConfigured) {
    console.warn('Supabase is not configured. Please connect Supabase in the sidebar.');
    // Return a minimal client that won't work but won't crash
    return createClient('https://placeholder.supabase.co', 'placeholder-key', {
      auth: {
        storage: localStorage,
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }
  
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
};

export const supabase = createSupabaseClient();
