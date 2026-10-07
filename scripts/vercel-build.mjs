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

// Verify before any backend deployment, so a test failure cannot remove APIs
// from the running app while leaving the previous frontend in production.
run("npm", ["run", "gate:fx"]);
if (process.exitCode) process.exit(process.exitCode);

if (process.env.VERCEL_ENV === "preview") {
  // Convex's official Vercel setup uses CONVEX_DEPLOY_KEY scoped to Preview.
  // Keep the legacy custom name as a fallback while migrating project settings.
  const previewKey = (
    process.env.CONVEX_PREVIEW_DEPLOY_KEY ||
    process.env.CONVEX_DEPLOY_KEY ||
    ""
  ).trim();
  if (!previewKey.startsWith("preview:") || !previewKey.includes("|")) {
    console.error("[convex-preview] Configure a dedicated Convex Preview Deploy Key in the Vercel Preview environment. Do not point this billing preview at the production backend.");
    process.exit(1);
  }
  run(
    "npx",
    [
      "convex",
      "deploy",
      "--preview-name",
      process.env.VERCEL_GIT_COMMIT_REF || "poscal-pro-preview",
      "--cmd-url-env-var-name",
      "VITE_CONVEX_URL",
      "--cmd",
      "npm run build",
    ],
    { ...process.env, CONVEX_DEPLOY_KEY: previewKey },
  );
  process.exit(process.exitCode ?? 0);
}
if (process.env.VERCEL_ENV !== "production") {
  run("npm", ["run", "build"]);
  process.exit(process.exitCode ?? 0);
}

// Compile once before deploying. Convex's --cmd below rebuilds with its exact URL.
run("npm", ["run", "build"]);
if (process.exitCode) process.exit(process.exitCode);

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
    "npm run build",
  ],
  { ...process.env, CONVEX_DEPLOY_KEY: deployKey },
);

process.exit(process.exitCode ?? 0);
