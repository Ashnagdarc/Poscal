// Temporary stub for Supabase client during migration to NestJS
// This will be removed once all React components are migrated to use the new API

export const isSupabaseConfigured = false;

export const supabase = {
  // Auth methods
  auth: {
    signUp: () => {
      throw new Error('Supabase auth is disabled during migration to NestJS backend. Please use the new authentication system.');
    },
    signInWithPassword: () => {
      throw new Error('Supabase auth is disabled during migration to NestJS backend. Please use the new authentication system.');
    },
    signOut: () => {
      throw new Error('Supabase auth is disabled during migration to NestJS backend. Please use the new authentication system.');
    },
    getUser: () => {
      throw new Error('Supabase auth is disabled during migration to NestJS backend. Please use the new authentication system.');
    },
    onAuthStateChange: () => {
      throw new Error('Supabase auth is disabled during migration to NestJS backend. Please use the new authentication system.');
    }
  },

  // Database methods
  from: () => ({
    select: () => {
      throw new Error('Supabase database is disabled during migration to NestJS backend. Please use the new API endpoints.');
    },
    insert: () => {
      throw new Error('Supabase database is disabled during migration to NestJS backend. Please use the new API endpoints.');
    },
    update: () => {
      throw new Error('Supabase database is disabled during migration to NestJS backend. Please use the new API endpoints.');
    },
    delete: () => {
      throw new Error('Supabase database is disabled during migration to NestJS backend. Please use the new API endpoints.');
    },
    rpc: () => {
      throw new Error('Supabase RPC is disabled during migration to NestJS backend. Please use the new API endpoints.');
    }
  }),

  // Storage methods
  storage: {
    from: () => ({
      upload: () => {
        throw new Error('Supabase storage is disabled during migration to NestJS backend. Please use the new file upload endpoints.');
      },
      download: () => {
        throw new Error('Supabase storage is disabled during migration to NestJS backend. Please use the new file download endpoints.');
      },
      remove: () => {
        throw new Error('Supabase storage is disabled during migration to NestJS backend. Please use the new file management endpoints.');
      }
    })
  },

  // Realtime methods
  channel: () => ({
    on: () => {
      throw new Error('Supabase realtime is disabled during migration to NestJS backend. Please use the new WebSocket connections.');
    },
    subscribe: () => {
      throw new Error('Supabase realtime is disabled during migration to NestJS backend. Please use the new WebSocket connections.');
    }
  })
};