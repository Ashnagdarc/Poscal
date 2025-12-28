import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ywnmxrpasfikvwdgexdo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3bm14cnBhc2Zpa3Z3ZGdleGRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1MzI1MTIsImV4cCI6MjA4MTEwODUxMn0.KSZYWWKUJ-M_5tWSYS21AXElOczwGzRu5cX6UiCqFvk';

export const isSupabaseConfigured = true;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
