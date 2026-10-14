import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";
import { URL } from "node:url";

import journalEntry from "../api/journal-entry.ts";
import journalImages from "../api/journal-images.ts";
import paystackWebhook from "../api/paystack-webhook.ts";
import prices from "../api/prices.ts";
import pricesMultiple from "../api/prices/multiple.ts";
import { invokeVercelHandler, type ApiHandler } from "./vercelAdapter.ts";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain; charset=utf-8",
};

const convexCloud =
  process.env.VITE_CONVEX_URL?.trim() ||
  process.env.CONVEX_URL?.trim() ||
  "https://convex.poscalfx.com";
const convexSite =
  process.env.VITE_CONVEX_SITE_URL?.trim() ||
  process.env.CONVEX_SITE_URL?.trim() ||
  "https://convex-http.poscalfx.com";
const convexWs = convexCloud.replace(/^https:/, "wss:").replace(/^http:/, "ws:");

const csp = [
  "default-src 'self'",
  "script-src 'self' 'sha256-owAtiryeeynyETMCxJ9glbgLtzEawuKtrpDGb4kgkiU=' https://www.googletagmanager.com https://storage.googleapis.com",
  `connect-src 'self' ${convexCloud} ${convexWs} ${convexSite} https://api.frankfurter.dev https://open.er-api.com https://www.google-analytics.com https://analytics.google.com https://*.r2.cloudflarestorage.com https://fcm.googleapis.com https://*.googleapis.com https://updates.push.services.mozilla.com https://*.push.apple.com https://web.push.apple.com`,
  `img-src 'self' data: blob: ${convexCloud} https://www.googletagmanager.com https://www.google-analytics.com https://*.r2.cloudflarestorage.com`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "frame-ancestors 'none'",
].join("; ");

const allowedHosts = new Set(
  (
    process.env.ALLOWED_HOSTS
    || "poscalfx.com,www.poscalfx.com,127.0.0.1,localhost,127.0.0.1:23000,localhost:23000"
  )
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean),
);

const isAllowedHost = (hostHeader: string) => {
  if (!hostHeader) return true;
  if (allowedHosts.has(hostHeader)) return true;
  const hostname = hostHeader.split(":")[0] ?? "";
  return Boolean(hostname) && allowedHosts.has(hostname);
};

// Openship starts from the release root where `dist/` and `server-dist/` sit together.
const distRoot = resolve(
  process.env.STATIC_ROOT?.trim() || join(process.cwd(), "dist"),
);

const handlers: Record<string, ApiHandler> = {
  "/api/prices": prices as ApiHandler,
  "/api/prices/multiple": pricesMultiple as ApiHandler,
  "/api/journal-images": journalImages as ApiHandler,
  "/api/journal-entry": journalEntry as ApiHandler,
  "/api/paystack-webhook": paystackWebhook as ApiHandler,
};

const isSafeDistPath = (candidate: string) => {
  const normalized = normalize(candidate);
  return normalized === distRoot || normalized.startsWith(distRoot + sep);
};

const sendFile = (res: import("node:http").ServerResponse, filePath: string, cacheControl: string) => {
  const stats = statSync(filePath);
  if (!stats.isFile()) {
    res.writeHead(404).end("Not found");
    return;
  }
  const type = MIME[extname(filePath).toLowerCase()] || "application/octet-stream";
  res.writeHead(200, {
    "Content-Type": type,
    "Content-Length": stats.size,
    "Cache-Control": cacheControl,
  });
  createReadStream(filePath).pipe(res);
};

const server = createServer(async (request, response) => {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("Content-Security-Policy", csp);

  try {
    const host = (request.headers.host ?? "").split(",")[0]?.trim().toLowerCase() ?? "";
    if (host && !isAllowedHost(host)) {
      response.writeHead(403).end("Forbidden host");
      return;
    }

    const url = new URL(request.url ?? "/", `http://${host || "127.0.0.1"}`);

    if (url.pathname === "/healthz") {
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.setHeader("Cache-Control", "no-store");
      response.end(
        JSON.stringify({
          ok: true,
          environment: process.env.POSCAL_ENVIRONMENT?.trim() || "vps-production",
          convex: convexCloud,
          runtime: "openship",
        }),
      );
      return;
    }

    const apiHandler = handlers[url.pathname];
    if (apiHandler) {
      response.setHeader("Cache-Control", "no-store");
      await invokeVercelHandler(apiHandler, request, response, url);
      return;
    }

    // Never expose server bundles or dotfiles from the static root.
    if (
      url.pathname.startsWith("/server")
      || url.pathname.includes("..")
      || url.pathname.startsWith("/.")
    ) {
      response.writeHead(404).end("Not found");
      return;
    }

    const requestPath = decodeURIComponent(url.pathname);
    const candidate = resolve(distRoot, requestPath === "/" ? "index.html" : requestPath.slice(1));
    if (!isSafeDistPath(candidate)) {
      response.writeHead(403).end("Forbidden");
      return;
    }

    if (existsSync(candidate) && statSync(candidate).isFile()) {
      const immutable = requestPath.startsWith("/assets/");
      sendFile(
        response,
        candidate,
        immutable
          ? "public, max-age=31536000, immutable"
          : requestPath === "/sw.js" || requestPath.endsWith(".webmanifest") || requestPath === "/index.html" || requestPath === "/"
            ? "public, max-age=0, must-revalidate"
            : "public, max-age=3600",
      );
      return;
    }

    // SPA fallback for client routes.
    const indexPath = join(distRoot, "index.html");
    if (existsSync(indexPath)) {
      sendFile(response, indexPath, "public, max-age=0, must-revalidate");
      return;
    }

    response.writeHead(404).end("Not found");
  } catch (error) {
    console.error("[production-server]", error);
    if (!response.headersSent) {
      response.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
    }
    response.end(JSON.stringify({ ok: false, error: "Internal server error" }));
  }
});

const listenHost = process.env.LISTEN_HOST?.trim() || "127.0.0.1";
const listenPort = Number(process.env.LISTEN_PORT || process.env.PORT || "23000");

server.listen(listenPort, listenHost, () => {
  console.log(
    `Poscal production listening on ${listenHost}:${listenPort} (static=${distRoot})`,
  );
});
