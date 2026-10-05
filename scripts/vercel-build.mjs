import { spawnSync } from "node:child_process";

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

if (process.env.VERCEL_ENV !== "production") {
  run("npm", ["run", "gate:fx"]);
  if (process.exitCode) process.exit(process.exitCode);
  run("npm", ["run", "build"]);
  process.exit(process.exitCode ?? 0);
}

const deploymentName = "helpful-sturgeon-546";
const token = (process.env.CONVEX_DEPLOY_TOKEN || "").trim();
const configured = (process.env.CONVEX_DEPLOY_KEY || "").trim();

let deployKey = "";

if (token) {
  deployKey = `prod:${deploymentName}|${token}`;
} else if (configured.startsWith("prod:") && configured.includes("|")) {
  deployKey = configured;
} else if (configured && !configured.includes("|") && !configured.startsWith("prod:")) {
  // Backward-compatible path for Vercel values that contain only the token fragment.
  deployKey = `prod:${deploymentName}|${configured}`;
}

if (!deployKey) {
  console.error("[convex-deploy] No usable production deploy credential was found.");
  process.exit(1);
}

console.log(
  "[convex-deploy] credential ready",
  JSON.stringify({
    source: token ? "CONVEX_DEPLOY_TOKEN" : configured.includes("|") ? "CONVEX_DEPLOY_KEY" : "CONVEX_DEPLOY_KEY_TOKEN_FRAGMENT",
    deployment: deploymentName,
  }),
);

run(
  "npx",
  [
    "convex",
    "deploy",
    "--cmd-url-env-var-name",
    "VITE_CONVEX_URL",
    "--cmd",
    "npm run gate:fx && npm run build",
  ],
  { ...process.env, CONVEX_DEPLOY_KEY: deployKey },
);

process.exit(process.exitCode ?? 0);
