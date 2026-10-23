import { pathToFileURL } from "node:url";

const SOURCE_URL = "https://convex.poscalfx.com";
const CLOUD_DR_DEPLOYMENT = "helpful-sturgeon-546";

const normalizeUrl = (value) => {
  const url = new URL(value);
  url.pathname = url.pathname.replace(/\/$/, "");
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
};

export const assertCloudDrConfiguration = (env = process.env) => {
  const sourceUrl = env.CONVEX_SELF_HOSTED_URL?.trim();
  const sourceKey = env.CONVEX_SELF_HOSTED_ADMIN_KEY?.trim();
  const targetDeployment = env.POSCAL_CLOUD_DR_DEPLOYMENT?.trim();
  const targetKey = env.POSCAL_CLOUD_DR_DEPLOY_KEY?.trim();

  if (!sourceUrl || normalizeUrl(sourceUrl) !== SOURCE_URL) {
    throw new Error(`DR source must be ${SOURCE_URL}`);
  }
  if (!sourceKey) {
    throw new Error("CONVEX_SELF_HOSTED_ADMIN_KEY is required");
  }
  if (env.POSCAL_PRODUCTION_APPROVAL !== "export:convex.poscalfx.com") {
    throw new Error(
      "DR export requires POSCAL_PRODUCTION_APPROVAL=export:convex.poscalfx.com",
    );
  }
  if (targetDeployment !== CLOUD_DR_DEPLOYMENT) {
    throw new Error(`DR target must be ${CLOUD_DR_DEPLOYMENT}`);
  }
  if (!targetKey) {
    throw new Error("POSCAL_CLOUD_DR_DEPLOY_KEY is required");
  }
  if (targetKey === sourceKey) {
    throw new Error("DR deploy key must not be the production admin key");
  }

  const keyDeployment = targetKey.match(/^(?:prod|dev):([^|]+)\|/)?.[1];
  if (keyDeployment !== CLOUD_DR_DEPLOYMENT) {
    throw new Error(
      keyDeployment
        ? `DR deploy key belongs to ${keyDeployment}, not ${CLOUD_DR_DEPLOYMENT}`
        : `DR deploy key must be scoped to ${CLOUD_DR_DEPLOYMENT}`,
    );
  }

  return {
    sourceUrl: SOURCE_URL,
    targetDeployment: CLOUD_DR_DEPLOYMENT,
  };
};

/** The import process must not be able to see the production admin credentials. */
export const assertStandbyImportEnvironment = (env) => {
  if (env.CONVEX_SELF_HOSTED_URL || env.CONVEX_SELF_HOSTED_ADMIN_KEY || env.POSCAL_PRODUCTION_APPROVAL) {
    throw new Error("Standby import environment still contains production credentials");
  }
  const key = env.CONVEX_DEPLOY_KEY?.trim() ?? "";
  const keyDeployment = key.match(/^(?:prod|dev):([^|]+)\|/)?.[1];
  if (keyDeployment !== CLOUD_DR_DEPLOYMENT) {
    throw new Error(`Standby import key must be scoped to ${CLOUD_DR_DEPLOYMENT}`);
  }
};

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  try {
    const result = assertCloudDrConfiguration();
    console.log(
      `[convex-cloud-dr-guard] approved ${result.sourceUrl} -> ${result.targetDeployment}`,
    );
  } catch (error) {
    console.error(
      `[convex-cloud-dr-guard] ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}
