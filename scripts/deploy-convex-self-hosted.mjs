import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { assertConvexTarget } from "./guard-convex-target.mjs";

const target = process.argv[2];
if (!new Set(["staging", "production"]).has(target)) {
  console.error("Usage: node scripts/deploy-convex-self-hosted.mjs <staging|production>");
  process.exit(1);
}

const envFile = resolve(
  process.env.POSCAL_CONVEX_ENV_FILE
    || (target === "staging" ? ".env.staging.local" : ".env.local"),
);
if (!existsSync(envFile)) {
  console.error(`[convex-deploy] missing environment file: ${envFile}`);
  process.exit(1);
}

process.loadEnvFile(envFile);

try {
  assertConvexTarget({ action: "deploy", target, env: process.env });
} catch (error) {
  console.error(`[convex-deploy] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

const run = (command, args) => {
  const result = spawnSync(command, args, {
    env: process.env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
};

run("npm", ["run", "gate:fx"]);
run("npx", [
  "convex",
  "deploy",
  "--env-file",
  envFile,
  "--message",
  `Poscal ${target} release`,
]);
