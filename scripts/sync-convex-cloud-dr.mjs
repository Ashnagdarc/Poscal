import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  appendFileSync,
  createReadStream,
  existsSync,
  mkdtempSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { assertConvexTarget } from "./guard-convex-target.mjs";
import {
  assertCloudDrConfiguration,
  assertStandbyImportEnvironment,
} from "./guard-convex-cloud-dr.mjs";

const COUNT_LIMIT = "100000";

const CRITICAL_TABLES = [
  "users",
  "authAccounts",
  "profiles",
  "tradingAccounts",
  "tradingJournal",
  "_storage",
];

const run = (command, args, env, options = {}) => {
  const result = spawnSync(command, args, {
    env,
    encoding: "utf8",
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
    shell: process.platform === "win32",
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = options.capture ? result.stderr.trim() : "";
    throw new Error(
      `${command} ${args.join(" ")} failed${detail ? `: ${detail}` : ""}`,
    );
  }
  return result.stdout || "";
};

const countJsonLines = (command, args, env) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env,
      shell: process.platform === "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });
    let count = 0;
    let pending = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      pending += chunk;
      const lines = pending.split("\n");
      pending = lines.pop() || "";
      for (const line of lines) {
        if (line.trim()) count += 1;
      }
    });
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `${command} exited with ${code}`));
        return;
      }
      if (pending.trim()) count += 1;
      resolve(count);
    });
  });

const sha256 = async (path) => {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
};

const sourceEnvironment = () => {
  const env = { ...process.env };
  delete env.CONVEX_DEPLOY_KEY;
  delete env.POSCAL_CLOUD_DR_DEPLOY_KEY;
  return env;
};

const targetEnvironment = () => {
  const env = {
    ...process.env,
    CONVEX_DEPLOY_KEY: process.env.POSCAL_CLOUD_DR_DEPLOY_KEY,
  };
  delete env.CONVEX_SELF_HOSTED_URL;
  delete env.CONVEX_SELF_HOSTED_ADMIN_KEY;
  delete env.POSCAL_PRODUCTION_APPROVAL;
  return env;
};

const appendSummary = (lines) => {
  if (!process.env.GITHUB_STEP_SUMMARY) return;
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join("\n")}\n`);
};

const main = async () => {
  assertConvexTarget({ action: "export", target: "production" });
  const { sourceUrl, targetDeployment } = assertCloudDrConfiguration();
  console.log(`[convex-cloud-dr] source: ${sourceUrl}`);
  console.log(`[convex-cloud-dr] standby: ${targetDeployment}`);

  if (process.argv.includes("--verify-config-only")) {
    console.log("[convex-cloud-dr] configuration verified; no data was exported or imported");
    return;
  }

  if (process.env.POSCAL_CLOUD_DR_IMPORT !== "run") {
    throw new Error(
      "Cloud DR import is paused. Set POSCAL_CLOUD_DR_IMPORT=run only after the standby team is within its Convex plan limits",
    );
  }

  const sourceEnv = sourceEnvironment();
  const targetEnv = targetEnvironment();
  if (sourceEnv.CONVEX_DEPLOY_KEY || sourceEnv.POSCAL_CLOUD_DR_DEPLOY_KEY) {
    throw new Error("Production export environment still contains a Cloud deploy key");
  }
  assertStandbyImportEnvironment(targetEnv);

  const workspace = mkdtempSync(join(tmpdir(), "poscal-convex-dr-"));
  const snapshot = join(workspace, "snapshot.zip");

  try {
    run(
      "npx",
      ["convex", "export", "--include-file-storage", "--path", snapshot],
      sourceEnv,
    );
    if (!existsSync(snapshot) || statSync(snapshot).size === 0) {
      throw new Error("Convex export did not create a non-empty snapshot");
    }
    run("unzip", ["-tqq", snapshot], sourceEnv);

    const entries = new Set(
      run("unzip", ["-Z1", snapshot], sourceEnv, { capture: true })
        .split("\n")
        .filter(Boolean),
    );
    const sourceCounts = {};
    for (const table of CRITICAL_TABLES) {
      const entry = `${table}/documents.jsonl`;
      if (!entries.has(entry)) {
        throw new Error(`Snapshot is missing ${entry}`);
      }
      sourceCounts[table] = await countJsonLines(
        "unzip",
        ["-p", snapshot, entry],
        sourceEnv,
      );
    }
    if (sourceCounts.users === 0 || sourceCounts.authAccounts === 0) {
      throw new Error("Refusing to import a snapshot with no users or auth accounts");
    }

    const digest = await sha256(snapshot);
    console.log(
      `[convex-cloud-dr] verified ${(statSync(snapshot).size / 1024 / 1024).toFixed(1)} MiB snapshot (${digest.slice(0, 12)}...)`,
    );

    run(
      "npx",
      [
        "convex",
        "import",
        snapshot,
        "--replace-all",
        "--yes",
        "--deployment",
        targetDeployment,
      ],
      targetEnv,
    );

    const targetCounts = {};
    for (const table of CRITICAL_TABLES) {
      targetCounts[table] = await countJsonLines(
        "npx",
        [
          "convex",
          "data",
          table,
          "--limit",
          COUNT_LIMIT,
          "--order",
          "asc",
          "--format",
          "jsonLines",
          "--deployment",
          targetDeployment,
        ],
        targetEnv,
      );
      if (sourceCounts[table] === Number(COUNT_LIMIT) || targetCounts[table] === Number(COUNT_LIMIT)) {
        throw new Error(`${table} count reached the verification cap; the comparison is incomplete`);
      }
      if (targetCounts[table] !== sourceCounts[table]) {
        throw new Error(
          `${table} count mismatch: source=${sourceCounts[table]}, standby=${targetCounts[table]}`,
        );
      }
    }

    appendSummary([
      "## Poscal Convex Cloud DR refresh",
      "",
      `- Source: \`${sourceUrl}\``,
      `- Standby: \`${targetDeployment}\``,
      `- Snapshot SHA-256: \`${digest}\``,
      `- Verified tables: ${CRITICAL_TABLES.map((table) => `\`${table}\` (${sourceCounts[table]})`).join(", ")}`,
      "- Snapshot retention: ephemeral runner only; no GitHub artifact uploaded",
    ]);
    console.log("[convex-cloud-dr] standby refresh and critical-count verification succeeded");
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
};

main().catch((error) => {
  console.error(
    `[convex-cloud-dr] ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});
