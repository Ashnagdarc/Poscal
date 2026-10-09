#!/usr/bin/env node
/**
 * Production auth-source integrity gate.
 * All paths except convex/auth.ts match the Oct 9 live Vercel source
 * dpl_HzDqNJPgwhUKTuovf3cpKrvzs2H1 exactly (SHA-1 content IDs, not keys).
 *
 * convex/auth.ts is intentionally changed to fix verified-user privilege
 * demotion. Old live SHA-1: 31aca3184c8afa451c43f4ef6bf62d99070e91f7.
 * New reviewed SHA-1 below pins the replacement. Do not silently accept both
 * hashes: the old code can overwrite a linked admin profile with "user".
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const expected = {
  "convex/auth.ts": "32dbefc654829d901ea8d3bfd55034e0704f137d",
  "convex/authRateLimit.ts": "16ab58de2954478eb955f968432b944fed546ce2",
  "convex/BrevoOTP.ts": "5045b4a179b8a2f8632de0532d7662f4e648fabd",
  "convex/BrevoOTPPasswordReset.ts": "6b1ab328c5ccf04117ce6833059a861eeb7348e2",
  "convex/lib/brevoEmail.ts": "3fa0c715816ecfc6f2a8785a483fc29fcf76378d",
  "convex/lib/welcomeEmailCopy.ts": "5ae81c90a286ae8d57cab0519279c9988e8cd041",
  "convex/lib/emailVerificationPolicy.ts": "215dcb6693cdfda80b5e054cf585fe9564d93cb6",
  "convex/welcomeEmail.ts": "819a1bf0b64173334a248d8502619895e546a0e6",
  "convex/schema.ts": "5cc92ccd28a92fe5d16843b2abc26d5f053e5f32",
  "src/pages/VerifyEmail.tsx": "f25108ec622c9dc36dc765419c8a197d0edbf8a1",
  "src/pages/ForgotPassword.tsx": "c9c487e99b11c7f94aa4b906e3b054a3de0958c6"
};

let mismatches = 0;
for (const [path, expectedSha] of Object.entries(expected)) {
  let actual = "MISSING";
  try {
    actual = createHash("sha1").update(readFileSync(path)).digest("hex");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  if (actual !== expectedSha) {
    console.error("[brevo-parity] MISMATCH:", path, "local hash:", actual);
    mismatches++;
  }
}
if (mismatches) {
  console.error("[brevo-parity] Refusing production build:", mismatches, "mismatches.");
  console.error("[brevo-parity] Restore the protected Brevo source and reviewed auth role-sync fix.");
  process.exit(1);
}
console.log("[brevo-parity] Brevo live hashes and reviewed auth-role fix verified.");
