import { spawnSync } from "node:child_process";

// A production Vercel build is FRONTEND ONLY.
// Deploying Convex from Vercel previously pushed ALL backend functions,
// schema, and indexes from whatever branch happened to build. This is unsafe
// until Git main contains the exact live Brevo implementation.
const run = (command, args) => {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
  });
  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
};

if (process.env.VERCEL_ENV === "production") {
  // Remove this ONE-TIME hash baseline only after the live auth source is
  // reconciled to main and an independently reviewed replacement gate exists.
  // Fail closed: do not deploy the older Resend verification UI to users.
  run("node", ["scripts/check-production-brevo-parity.mjs"]);
  console.log("[release] Brevo production source verified; Convex deploy is disabled.");
}

run("npm", ["run", "gate:fx"]);
run("npm", ["run", "build"]);
