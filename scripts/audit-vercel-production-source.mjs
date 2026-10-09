#!/usr/bin/env node
/**
 * Read-only audit of source drift between the Oct 9 Vercel CLI production
 * snapshot and the current Git checkout. NO deployment or file mutations.
 *
 * Run: node scripts/audit-vercel-production-source.mjs
 * Requires: npx vercel login (authorized account).
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const deployedId = "dpl_HzDqNJPgwhUKTuovf3cpKrvzs2H1";
const teamId = "team_rxQDJ0We8Q9mka7yxKolfpM7";
const endpoint = `/v6/deployments/${deployedId}/files?teamId=${teamId}`;
let stdout;
try {
  stdout = execFileSync("npx", ["--yes", "vercel", "api", endpoint, "--method", "GET", "--scope", "flowtag-projects"], {
    encoding: "utf8", maxBuffer: 24 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"],
  });
} catch (error) {
  throw new Error(`Vercel file-manifest API failed. Log in via 'npx vercel login'. Exit: ${error.status || "unknown"}`);
}

const payload = JSON.parse(stdout);
const listed = Array.isArray(payload) ? payload : payload?.result ?? payload?.files;
if (!Array.isArray(listed)) throw new Error("Unexpected Vercel manifest response shape.");
const sourceRoot = listed.length === 1 && listed[0]?.name === "src" && listed[0]?.type === "directory"
  && (listed[0].children || []).some((n) => n.name === "package.json");
const roots = sourceRoot ? listed[0].children : listed;

const all = [];
function walk(node, prefix = "") {
  if (typeof node.name !== "string" || node.name.includes("/") || node.name === "..") {
    throw new Error("Unexpected path segment in Vercel source manifest.");
  }
  const current = prefix ? prefix + "/" + node.name : node.name;
  if (node.type === "file") all.push({ path: current, sha1: node.uid });
  for (const child of node.children || []) walk(child, current);
}
for (const item of roots) walk(item);

const runtimeSource = (p) =>
  /^(src|convex|api|shared|scripts|public)\//.test(p)
  || /^(package\.json|package-lock\.json|vercel\.json|vite\.config\.(js|ts)|index\.html|tsconfig\.app\.json)$/.test(p);
const records = [];
for (const entry of all.filter((e) => runtimeSource(e.path))) {
  if (!/^[a-f0-9]{40}$/.test(entry.sha1 || "")) throw new Error("Unexpected source file content hash.");
  const local = join(root, entry.path);
  const actual = existsSync(local)
    ? createHash("sha1").update(readFileSync(local)).digest("hex")
    : "MISSING";
  records.push({ path: entry.path, expected: entry.sha1, actual, status: actual === entry.sha1 ? "MATCH" : actual === "MISSING" ? "MISSING" : "DIFFERENT" });
}

const summary = records.reduce((acc, entry) => (acc[entry.status]++, acc), { MATCH: 0, DIFFERENT: 0, MISSING: 0 });
console.log(`Production deployment: ${deployedId}`);
console.log(`Compared runtime source files: ${records.length}`);
console.log(JSON.stringify(summary, null, 2));
for (const entry of records.filter((r) => r.status !== "MATCH").sort((a, b) => a.path.localeCompare(b.path))) {
  console.log(`${entry.status.padEnd(10)} ${entry.path}`);
}
console.log("No files or live services were changed. Review all differences before production deployment.");
