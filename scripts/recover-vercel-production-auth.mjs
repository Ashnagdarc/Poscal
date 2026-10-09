#!/usr/bin/env node
/**
 * Read-only recovery of the exact Oct 9 Poscal Brevo source from Vercel.
 *
 * Requires an authenticated Vercel CLI: npx vercel login
 * Usage: node scripts/recover-vercel-production-auth.mjs [output-directory]
 *
 * Downloads ONLY the 11 auth-related paths in check-production-brevo-parity.mjs.
 * Verifies SHA-1 of every file before writing anything, and never deploys,
 * mutates the live project, or copies environment variables.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const DEPLOYMENT = "dpl_HzDqNJPgwhUKTuovf3cpKrvzs2H1";
const TEAM = "team_rxQDJ0We8Q9mka7yxKolfpM7";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PARITY = join(ROOT, "scripts/check-production-brevo-parity.mjs");
const rawParity = readFileSync(PARITY, "utf8");
const entries = [...rawParity.matchAll(/^\s+"(convex\/[^"]+|src\/pages\/[^"]+)": "([a-f0-9]{40})"[,;]/gm)]
  .map((match) => ({ path: match[1], sha1: match[2] }));

const required = new Set([
  "convex/auth.ts", "convex/authRateLimit.ts", "convex/BrevoOTP.ts",
  "convex/BrevoOTPPasswordReset.ts", "convex/lib/brevoEmail.ts",
  "convex/lib/welcomeEmailCopy.ts", "convex/lib/emailVerificationPolicy.ts",
  "convex/welcomeEmail.ts", "convex/schema.ts", "src/pages/VerifyEmail.tsx",
  "src/pages/ForgotPassword.tsx",
]);
if (entries.length !== required.size || entries.some((entry) => !required.has(entry.path))
    || new Set(entries.map((entry) => entry.path)).size !== required.size) {
  throw new Error("The pinned auth manifest is incomplete or has unexpected paths. Refusing recovery.");
}

const destination = resolve(process.argv[2] || join(homedir(), "poscal-brevo-recovery-2026-10-09"));
const withinRepo = relative(ROOT, destination);
if (!withinRepo || (!withinRepo.startsWith(".." + sep) && withinRepo !== "..")) {
  throw new Error("Choose an output folder OUTSIDE the Git repository to prevent accidental commits.");
}
if (existsSync(destination)) {
  throw new Error("Output directory already exists. Choose a NEW empty location; never overwrite recovery files.");
}

const restored = [];
for (const { path, sha1 } of entries) {
  const endpoint = `/v8/deployments/${DEPLOYMENT}/files/${sha1}?teamId=${TEAM}`;
  let stdout;
  try {
    stdout = execFileSync("npx", [
      "--yes", "vercel", "api", endpoint, "--method", "GET", "--scope", "flowtag-projects",
    ], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
  } catch (error) {
    throw new Error(`Cannot retrieve ${path} from Vercel. Check 'npx vercel login' and team access. ${error.status || ""}`);
  }
  let payload;
  try {
    payload = JSON.parse(stdout);
  } catch {
    throw new Error(`Unexpected non-JSON Vercel response for ${path}. No files have been written.`);
  }
  const encoded = payload?.data ?? payload?.result?.data ?? payload?.content;
  if (typeof encoded !== "string" || !/^[a-zA-Z0-9+/]+={0,2}$/.test(encoded)) {
    throw new Error(`Vercel returned an invalid or missing base64 body for ${path}.`);
  }
  const bytes = Buffer.from(encoded, "base64");
  const actualSha1 = createHash("sha1").update(bytes).digest("hex");
  if (actualSha1 !== sha1) {
    throw new Error(`Hash mismatch for ${path}. Expected ${sha1}, got ${actualSha1}. No files have been written.`);
  }
  restored.push({ path, sha1, bytes });
  process.stdout.write(`Verified ${path} (${bytes.length} bytes)\n`);
}

mkdirSync(destination, { recursive: true, mode: 0o700 });
for (const { path, bytes } of restored) {
  const target = join(destination, path);
  mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
  writeFileSync(target, bytes, { flag: "wx", mode: 0o600 });
}
writeFileSync(join(destination, "RECOVERY-MANIFEST.txt"),
  `Deployment: ${DEPLOYMENT}\nTeam: ${TEAM}\n\n` +
  restored.map(({ path, sha1 }) => `${sha1}  ${path}`).join("\n") + "\n",
  { flag: "wx", mode: 0o600 });
process.stdout.write(`\nAll 11 source files verified and written to ${destination}\n`);
process.stdout.write("Review source for secrets before selectively copying it into a GitHub recovery branch.\n");
