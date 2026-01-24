// Supabase is deprecated; provide a safe shim to prevent runtime ReferenceErrors.
// Any call into this shim will throw a clear error so we can migrate each feature.

declare global {
  // eslint-disable-next-line no-var
  var supabase: any;
  // eslint-disable-next-line no-var
  var isSupabaseConfigured: boolean;
}

const buildDisabledResponse = (message = 'Supabase is disabled; use the new backend API') => {
  const error = new Error(message);
  return { data: null, error };
};

const buildThenable = () => {
  const thenable = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'then') {
          return (resolve: any, reject?: any) => Promise.resolve(buildDisabledResponse()).then(resolve, reject);
        }
        return () => thenable; // allow chaining any method name
      },
    }
  );
  return thenable;
};

if (!globalThis.supabase) {
  const disabled = () => buildDisabledResponse();

  globalThis.supabase = {
    from: () => buildThenable(),
    rpc: async () => buildDisabledResponse(),
    auth: {
      getSession: async () => ({ data: { session: null }, error: new Error('Supabase auth disabled') }),
      updateUser: async () => buildDisabledResponse('Supabase auth disabled'),
      signOut: async () => buildDisabledResponse('Supabase auth disabled'),
    },
    storage: {
      from: () => ({
        upload: async () => buildDisabledResponse('Supabase storage disabled'),
        remove: async () => buildDisabledResponse('Supabase storage disabled'),
        getPublicUrl: () => ({ data: { publicUrl: '' }, error: new Error('Supabase storage disabled') }),
      }),
    },
    removeChannel: () => {},
    channel: () => ({
      on: () => ({
        subscribe: async () => buildDisabledResponse(),
      }),
    }),
  };
}

// Mark Supabase as off so guards that check this flag can short-circuit.
globalThis.isSupabaseConfigured = false;

export const supabase = globalThis.supabase;
export const isSupabaseConfigured = globalThis.isSupabaseConfigured;
