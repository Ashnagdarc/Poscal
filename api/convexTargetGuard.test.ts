import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const runGuard = (env: NodeJS.ProcessEnv, action = "deploy", target = "staging") =>
  spawnSync(
    process.execPath,
    ["scripts/guard-convex-target.mjs", "--action", action, "--target", target],
    {
      cwd: process.cwd(),
      env: { PATH: process.env.PATH, ...env },
      encoding: "utf8",
    },
  );

describe("Convex deployment target guard", () => {
  it("allows the isolated self-hosted staging target", () => {
    const result = runGuard({
      CONVEX_SELF_HOSTED_URL: "https://convex-staging.poscalfx.com",
      CONVEX_SELF_HOSTED_ADMIN_KEY: "test-only",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("approved deploy target: staging");
  });

  it("rejects production when staging is requested", () => {
    const result = runGuard({
      CONVEX_SELF_HOSTED_URL: "https://convex.poscalfx.com",
      CONVEX_SELF_HOSTED_ADMIN_KEY: "test-only",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("must never target the production");
  });

  it("rejects every Convex Cloud deployment", () => {
    const result = runGuard({
      CONVEX_SELF_HOSTED_URL: "https://example.convex.cloud",
      CONVEX_SELF_HOSTED_ADMIN_KEY: "test-only",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Convex Cloud targets are prohibited");
  });

  it("requires an action-scoped approval for production", () => {
    const missingApproval = runGuard(
      {
        CONVEX_SELF_HOSTED_URL: "https://convex.poscalfx.com",
        CONVEX_SELF_HOSTED_ADMIN_KEY: "test-only",
      },
      "deploy",
      "production",
    );
    const approved = runGuard(
      {
        CONVEX_SELF_HOSTED_URL: "https://convex.poscalfx.com",
        CONVEX_SELF_HOSTED_ADMIN_KEY: "test-only",
        POSCAL_PRODUCTION_APPROVAL: "deploy:convex.poscalfx.com",
      },
      "deploy",
      "production",
    );

    expect(missingApproval.status).toBe(1);
    expect(approved.status).toBe(0);
  });

  it("allows a production frontend build without an admin credential", () => {
    const result = runGuard(
      { VITE_CONVEX_URL: "https://convex.poscalfx.com" },
      "build",
      "production",
    );

    expect(result.status).toBe(0);
  });
});
