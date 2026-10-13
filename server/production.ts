import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import prices from "../api/prices";
import multiplePrices from "../api/prices/multiple";
import journalImages from "../api/journal-images";
import journalEntry from "../api/journal-entry";
import featureFlag from "../api/feature-flag";
import verifyPayment from "../api/verify-payment";
import paystackWebhook from "../api/paystack-webhook";
import restorePurchase from "../api/restore-purchase";
import scheduledReminder from "../api/scheduled-reminder";
import scheduledExpiry from "../api/scheduled-expiry";

/**
 * Same-origin production adapter for VPS.
 * Auth/email run through Convex + Brevo (not this process).
 */
const handlers: Record<string, any> = {
  "/api/prices": prices,
  "/api/prices/multiple": multiplePrices,
  "/api/journal-images": journalImages,
  "/api/journal-entry": journalEntry,
  "/api/feature-flag": featureFlag,
  "/api/verify-payment": verifyPayment,
  "/api/paystack-webhook": paystackWebhook,
  "/api/restore-purchase": restorePurchase,
  "/api/scheduled-reminder": scheduledReminder,
  "/api/scheduled-expiry": scheduledExpiry,
};

const allowedHosts = new Set([
  "poscalfx.com",
  "www.poscalfx.com",
  "127.0.0.1:23000",
  "localhost:23000",
]);

const root = resolve("dist");
const types: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

const convexCloud =
  process.env.VITE_CONVEX_URL ?? "https://convex.poscalfx.com";
const convexSite =
  process.env.VITE_CONVEX_SITE_URL ?? "https://convex-http.poscalfx.com";
const convexWs = convexCloud.replace(/^https:/, "wss:").replace(/^http:/, "ws:");

const csp = [
  "default-src 'self'",
  "script-src 'self' 'sha256-owAtiryeeynyETMCxJ9glbgLtzEawuKtrpDGb4kgkiU=' https://www.googletagmanager.com",
  `connect-src 'self' ${convexCloud} ${convexWs} ${convexSite} https://api.frankfurter.dev https://open.er-api.com https://www.google-analytics.com https://analytics.google.com`,
  `img-src 'self' data: blob: ${convexCloud} https://www.googletagmanager.com https://www.google-analytics.com`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "frame-ancestors 'none'",
].join("; ");

export const server = createServer(async (request, response) => {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Security-Policy", csp);
  try {
    const host = (request.headers.host ?? "").split(",")[0].trim().toLowerCase();
    if (!allowedHosts.has(host)) {
      response.writeHead(403).end();
      return;
    }
    const url = new URL(request.url ?? "/", `http://${host}`);
    if (url.pathname === "/healthz") {
      response.setHeader("Content-Type", "application/json");
      response.end(
        JSON.stringify({
          ok: true,
          environment: "vps-production",
          convex: convexCloud,
        }),
      );
      return;
    }
    const handler = handlers[url.pathname];
    if (handler) {
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of request) {
        size += chunk.length;
        if (size > 2 * 1024 * 1024) {
          response.writeHead(413).end();
          return;
        }
        chunks.push(chunk);
      }
      const raw = Buffer.concat(chunks);
      const req = request as any;
      req.query = Object.fromEntries(
        [...new Set(url.searchParams.keys())].map((key) => {
          const values = url.searchParams.getAll(key);
          return [key, values.length === 1 ? values[0] : values];
        }),
      );
      req.rawBody = raw;
      if (raw.length) {
        if ((request.headers["content-type"] ?? "").includes("application/json")) {
          try {
            req.body = JSON.parse(raw.toString());
          } catch {
            response.writeHead(400).end();
            return;
          }
        } else req.body = raw.toString();
      } else req.body = {};
      const res = response as any;
      res.status = (code: number) => {
        res.statusCode = code;
        return res;
      };
      res.json = (value: unknown) => {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(value));
        return res;
      };
      res.send = (value: any) => {
        res.end(value);
        return res;
      };
      await handler(req, res);
      return;
    }
    if (url.pathname.startsWith("/api/")) {
      response.writeHead(404).end();
      return;
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405).end();
      return;
    }
    const path = resolve(root, "." + decodeURIComponent(url.pathname));
    if (path !== root && !path.startsWith(root + sep)) {
      response.writeHead(403).end();
      return;
    }
    let file = path;
    try {
      if (!(await stat(file)).isFile()) file = resolve(root, "index.html");
    } catch {
      if (extname(path)) {
        response.writeHead(404).end();
        return;
      }
      file = resolve(root, "index.html");
    }
    // HTML/SW: short cache so PWA picks up same-origin cutover assets quickly
    if (file.endsWith("index.html") || file.endsWith("sw.js")) {
      response.setHeader("Cache-Control", "no-cache");
    } else if (file.includes(`${sep}assets${sep}`)) {
      response.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    }
    response.setHeader("Content-Type", types[extname(file)] ?? "application/octet-stream");
    const data = await readFile(file);
    response.end(request.method === "HEAD" ? undefined : data);
  } catch {
    if (!response.headersSent) response.writeHead(500);
    response.end("Request failed");
  }
});
server.requestTimeout = 30_000;
server.headersTimeout = 15_000;
const listenHost = process.env.LISTEN_HOST ?? "127.0.0.1";
const listenPort = Number(process.env.LISTEN_PORT ?? "23000");
server.listen(listenPort, listenHost, () =>
  console.log(`VPS production listening on ${listenHost}:${listenPort}`),
);
