import { spawnSync } from "node:child_process";
import { assertConvexTarget } from "./guard-convex-target.mjs";

const target = process.env.POSCAL_DEPLOY_TARGET || "production";

try {
  assertConvexTarget({ action: "build", target, env: process.env });
} catch (error) {
  console.error(`[openship-build] ${error instanceof Error ? error.message : String(error)}`);
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
run("npm", ["run", "build"]);
run("npm", ["run", "build:server"]);
