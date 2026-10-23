import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const validEnvironment = {
  CONVEX_SELF_HOSTED_URL: "https://convex.poscalfx.com",
  CONVEX_SELF_HOSTED_ADMIN_KEY: "source-test-only",
  POSCAL_PRODUCTION_APPROVAL: "export:convex.poscalfx.com",
  POSCAL_CLOUD_DR_DEPLOYMENT: "helpful-sturgeon-546",
  POSCAL_CLOUD_DR_DEPLOY_KEY: "prod:helpful-sturgeon-546|target-test-only",
};

const runGuard = (overrides: NodeJS.ProcessEnv = {}) =>
  spawnSync(process.execPath, ["scripts/guard-convex-cloud-dr.mjs"], {
    cwd: process.cwd(),
    env: { PATH: process.env.PATH, ...validEnvironment, ...overrides },
    encoding: "utf8",
  });

describe("Convex Cloud disaster-recovery guard", () => {
  it("refuses to export or import while the Cloud copy is paused", () => {
    const result = spawnSync(process.execPath, ["scripts/sync-convex-cloud-dr.mjs"], {
      cwd: process.cwd(),
      env: { PATH: process.env.PATH, ...validEnvironment },
      encoding: "utf8",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Cloud DR import is paused");
  });

  it("allows only the known production source and standby", () => {
    const result = runGuard();

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      "https://convex.poscalfx.com -> helpful-sturgeon-546",
    );
  });

  it("rejects a different Cloud deployment", () => {
    const result = runGuard({
      POSCAL_CLOUD_DR_DEPLOYMENT: "effervescent-fly-962",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("DR target must be helpful-sturgeon-546");
  });

  it("rejects a deployment key for another target", () => {
    const result = runGuard({
      POSCAL_CLOUD_DR_DEPLOY_KEY: "prod:other-deployment-123|target-test-only",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("not helpful-sturgeon-546");
  });

  it("rejects a key that is not scoped to the standby deployment", () => {
    const result = runGuard({
      POSCAL_CLOUD_DR_DEPLOY_KEY: "self-hosted-admin-key",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("must be scoped to helpful-sturgeon-546");
  });

  it("rejects using the production admin key as the standby key", () => {
    const result = runGuard({
      CONVEX_SELF_HOSTED_ADMIN_KEY: "prod:helpful-sturgeon-546|same-key",
      POSCAL_CLOUD_DR_DEPLOY_KEY: "prod:helpful-sturgeon-546|same-key",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("must not be the production admin key");
  });

  it("requires an action-scoped production export approval", () => {
    const result = runGuard({ POSCAL_PRODUCTION_APPROVAL: "" });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("DR export requires");
  });
});
