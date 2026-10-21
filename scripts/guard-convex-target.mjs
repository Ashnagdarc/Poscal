import { pathToFileURL } from "node:url";

const PRODUCTION_URL = "https://convex.poscalfx.com";
const CLOUD_HOST_SUFFIX = ".convex.cloud";

const normalizeUrl = (value) => {
  const url = new URL(value);
  url.pathname = url.pathname.replace(/\/$/, "");
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
};

const readOption = (args, name) => {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value`);
  }
  return value;
};

export const assertConvexTarget = ({
  action,
  target,
  env = process.env,
}) => {
  if (!new Set(["build", "deploy", "export", "import", "run"]).has(action)) {
    throw new Error(`Unsupported Convex action: ${action}`);
  }
  if (!new Set(["development", "staging", "production"]).has(target)) {
    throw new Error(`Unsupported Convex target: ${target}`);
  }

  const rawUrl = action === "build"
    ? env.VITE_CONVEX_URL
    : env.CONVEX_SELF_HOSTED_URL;
  if (!rawUrl?.trim()) {
    throw new Error(
      action === "build"
        ? "VITE_CONVEX_URL is required"
        : "CONVEX_SELF_HOSTED_URL is required",
    );
  }

  const url = normalizeUrl(rawUrl.trim());
  const hostname = new URL(url).hostname.toLowerCase();
  if (hostname.endsWith(CLOUD_HOST_SUFFIX)) {
    throw new Error("Convex Cloud targets are prohibited for Poscal");
  }

  if (target === "production" && url !== PRODUCTION_URL) {
    throw new Error(`Production must target ${PRODUCTION_URL}`);
  }
  if (target !== "production" && url === PRODUCTION_URL) {
    throw new Error(`${target} must never target the production Convex deployment`);
  }

  if (target === "staging") {
    const configuredStagingUrl = env.POSCAL_STAGING_CONVEX_URL?.trim();
    if (configuredStagingUrl) {
      if (url !== normalizeUrl(configuredStagingUrl)) {
        throw new Error("Staging target does not match POSCAL_STAGING_CONVEX_URL");
      }
    } else if (!hostname.includes("staging")) {
      throw new Error(
        "Staging hostname must contain 'staging' or match POSCAL_STAGING_CONVEX_URL",
      );
    }
  }

  if (action !== "build") {
    if (!env.CONVEX_SELF_HOSTED_ADMIN_KEY?.trim()) {
      throw new Error("CONVEX_SELF_HOSTED_ADMIN_KEY is required");
    }
    if (target === "production") {
      const expected = `${action}:${new URL(PRODUCTION_URL).hostname}`;
      if (env.POSCAL_PRODUCTION_APPROVAL !== expected) {
        throw new Error(
          `Production ${action} requires POSCAL_PRODUCTION_APPROVAL=${expected}`,
        );
      }
    }
  }

  return { action, target, url };
};

const main = () => {
  const args = process.argv.slice(2);
  const action = readOption(args, "--action");
  const target = readOption(args, "--target");
  if (!action || !target) {
    throw new Error("Usage: guard-convex-target --action <action> --target <target>");
  }
  const result = assertConvexTarget({ action, target });
  console.log(`[convex-guard] approved ${result.action} target: ${result.target} (${result.url})`);
};

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  try {
    main();
  } catch (error) {
    console.error(`[convex-guard] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
