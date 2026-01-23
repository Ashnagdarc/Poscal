import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_AUTH_URL = import.meta.env.VITE_SUPABASE_AUTH_URL;

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
          detectSessionInUrl: true,
          flowType: 'pkce',
          // Use separate auth service for local development
          ...(SUPABASE_AUTH_URL && { baseUrl: SUPABASE_AUTH_URL }),
        },
        // Add CORS headers configuration
        headers: {
          'Content-Type': 'application/json',
        },
        // Use real-time subscriptions for better performance
        realtime: {
          params: {
            eventsPerSecond: 10,
          },
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
