import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outfile = join(root, "server-dist", "production.cjs");

mkdirSync(dirname(outfile), { recursive: true });

await esbuild.build({
  absWorkingDir: root,
  entryPoints: [join(root, "server", "production.ts")],
  outfile,
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  sourcemap: true,
  logLevel: "info",
  // Keep Node built-ins external; bundle app/api code.
  packages: "bundle",
  // api/* imports use ".js" suffixes that map to ".ts" sources.
  resolveExtensions: [".ts", ".tsx", ".js", ".mjs", ".cjs", ".json"],
  loader: {
    ".ts": "ts",
    ".tsx": "tsx",
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV || "production"),
  },
});

console.log(`[build-production-server] wrote ${outfile}`);
