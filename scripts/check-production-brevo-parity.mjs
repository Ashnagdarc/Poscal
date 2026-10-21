#!/usr/bin/env node
/**
 * Production Brevo/auth-source integrity gate.
 * These SHA-1 content IDs pin the reviewed self-hosted Convex source after the
 * contact-sync release. Do not silently accept alternate auth hashes: older
 * code can overwrite a linked admin profile with "user" during verification.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const expected = {
  "convex/auth.ts": "e3ac87a91373078f86965742347ef472f762d529",
  "convex/authRateLimit.ts": "16ab58de2954478eb955f968432b944fed546ce2",
  "convex/BrevoOTP.ts": "5045b4a179b8a2f8632de0532d7662f4e648fabd",
  "convex/BrevoOTPPasswordReset.ts": "6b1ab328c5ccf04117ce6833059a861eeb7348e2",
  "convex/lib/brevoEmail.ts": "3fa0c715816ecfc6f2a8785a483fc29fcf76378d",
  "convex/lib/welcomeEmailCopy.ts": "7692822a8f3852b353f655ee44d89e16885fabbb",
  "convex/lib/emailVerificationPolicy.ts": "215dcb6693cdfda80b5e054cf585fe9564d93cb6",
  "convex/welcomeEmail.ts": "819a1bf0b64173334a248d8502619895e546a0e6",
  "convex/schema.ts": "67259360a9abcbd61abe91a5e66a4fa4a485000b",
  "convex/brevoContacts.ts": "b9d8d6218ce7ec8ee65f4166fcfbffc4b59fda86",
  "convex/lib/brevoContacts.ts": "66821a0ebe1dc2933457a1faf777b420c129abc9",
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
  console.error("[brevo-parity] Restore the reviewed Brevo/auth source before production release.");
  process.exit(1);
}
console.log("[brevo-parity] Reviewed Brevo contact sync and auth-role protection verified.");
