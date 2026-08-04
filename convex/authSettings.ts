import { query } from "./_generated/server";
import { isEmailVerificationRequired } from "./lib/emailVerificationPolicy";

/**
 * Public auth policy for the SPA (not a secret).
 * Clients use this for ProtectedRoute + soft prompts only — backend still enforces.
 */
export const getVerificationPolicy = query({
  args: {},
  handler: async () => {
    return {
      requireEmailVerification: isEmailVerificationRequired(),
    };
  },
});
