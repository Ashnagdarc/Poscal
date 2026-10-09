/**
 * One-off emergency patch against the exact Oct 9 Vercel production-source snapshot.
 * Intentionally no schema, billing, auth-provider or email-transport mutations.
 * Never deploy a different source revision with this script.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const original = "dpl_HzDqNJPgwhUKTuovf3cpKrvzs2H1";
for (const path of ["convex/BrevoOTP.ts", "convex/lib/brevoEmail.ts", "convex/BrevoOTPPasswordReset.ts"]) {
  if (!existsSync(path)) throw new Error(`[poscal-auth-hotfix] Missing live Brevo module: ${path}`);
}

const apply = (path, before, after) => {
  const source = readFileSync(path, "utf8");
  const matches = source.split(before).length - 1;
  if (matches !== 1) {
    throw new Error(`[poscal-auth-hotfix] ${path}: expected one original match, got ${matches}`);
  }
  writeFileSync(path, source.replace(before, after));
};

const loginPage = "src/pages/SignIn.tsx";
apply(loginPage,
  `    if (password.length < 10) {
      const message = "Password must be at least 10 characters";
      setFormError(message);
      toast.error(message, { duration: 5000 });
      return;
    }

`,
  "",
);
apply(loginPage,
  "          minLength={10}\n          showPassword={showPassword}",
  "          showPassword={showPassword}",
);
apply(loginPage,
  "const { error, signedIn } = await signIn(email, password);",
  "const { error, signedIn } = await signIn(email.trim().toLowerCase(), password);",
);
apply(loginPage,
  '      const message = "Invalid email or password";\n      setFormError(message);',
  '      const message = "Could not sign in right now. Please try again or reset your password.";\n      setFormError(message);',
);
apply("src/contexts/AuthContext.tsx",
  'toSafeAuthErrorMessage(error, "Invalid email or password"),',
  'toSafeAuthErrorMessage(error, "Could not sign in right now. Please try again or reset your password."),',
);
apply("src/lib/authErrorMessages.ts",
  '    || normalized.includes("autherror")\n    || normalized.includes("failed to authenticate")\n',
  "",
);
// CRITICAL: make the production frontend build skip the automatic Convex deploy.
// Leave the running Convex backend (Brevo OTP, records, indexes) completely intact.
apply("scripts/vercel-build.mjs",
  'if (process.env.VERCEL_ENV !== "production") {',
  'if (true) { // One-off frontend-only auth hotfix: do not deploy Convex',
);

console.log(`[poscal-auth-hotfix] Applied guarded login patches against ${original}`);
console.log("[poscal-auth-hotfix] Brevo modules present; Convex backend deployment DISABLED.");
