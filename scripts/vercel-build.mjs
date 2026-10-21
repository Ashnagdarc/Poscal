import { spawnSync } from "node:child_process";
import { assertConvexTarget } from "./guard-convex-target.mjs";

const run = (command, args, env = process.env) => {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env,
    shell: process.platform === "win32",
  });

  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }

  process.exitCode = result.status ?? 1;
  return result.status ?? 1;
};

// Frontend builds never deploy Convex. Backend releases use the separately
// reviewed self-hosted staging/production commands in package.json.
run("npm", ["run", "gate:fx"]);
if (process.exitCode) process.exit(process.exitCode);

const target = process.env.VERCEL_ENV === "production" ? "production" : "staging";
try {
  assertConvexTarget({ action: "build", target, env: process.env });
} catch (error) {
  console.error(`[frontend-build] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

run("npm", ["run", "build"]);
process.exit(process.exitCode ?? 0);
