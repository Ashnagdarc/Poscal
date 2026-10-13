"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// server/production.ts
var production_exports = {};
__export(production_exports, {
  server: () => server
});
module.exports = __toCommonJS(production_exports);
var import_node_http = require("node:http");
var import_promises = require("node:fs/promises");
var import_node_path = require("node:path");

// api/_convex.ts
var import_browser = require("convex/browser");

// convex/_generated/api.js
var import_server = require("convex/server");
var api = import_server.anyApi;
var components = (0, import_server.componentsGeneric)();

// api/_convex.ts
var convexUrl = process.env.CONVEX_URL || process.env.VITE_CONVEX_URL;
if (!convexUrl) {
  throw new Error("CONVEX_URL is not configured");
}
var convexServerClient = new import_browser.ConvexHttpClient(convexUrl);
var createConvexServerClient = (token) => {
  const client = new import_browser.ConvexHttpClient(convexUrl);
  if (token) {
    client.setAuth(token);
  }
  return client;
};

// api/prices.ts
var prices_default = async (req, res) => {
  try {
    const { symbols } = req.query;
    if (!symbols) {
      return res.status(400).json({ error: "symbols parameter required" });
    }
    const data = await convexServerClient.query(api.prices.listLatest, {
      symbols: String(symbols).split(",").map((symbol) => symbol.trim()).filter(Boolean)
    });
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "public, max-age=2");
    res.status(200).json(data);
  } catch (error) {
    console.error("[API] Error:", error);
    res.status(500).json({
      error: "Failed to fetch prices",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
};

// api/prices/multiple.ts
var multiple_default = async (req, res) => {
  try {
    const { symbols } = req.query;
    if (!symbols) {
      return res.status(400).json({ error: "symbols parameter required" });
    }
    const data = await convexServerClient.query(api.prices.listLatest, {
      symbols: String(symbols).split(",").map((symbol) => symbol.trim()).filter(Boolean)
    });
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "public, max-age=2");
    res.status(200).json(data);
  } catch (error) {
    console.error("[API] Error:", error);
    res.status(500).json({
      error: "Failed to fetch prices",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
};

// api/_lib/r2.ts
var import_node_crypto = require("node:crypto");
var enc = (value) => encodeURIComponent(value).replace(/[!'()*]/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`);
var sha256Hex = (value) => (0, import_node_crypto.createHash)("sha256").update(value).digest("hex");
var hmac = (key, value) => (0, import_node_crypto.createHmac)("sha256", key).update(value).digest();
var amzDate = (date) => date.toISOString().replace(/[:-]|\.\d{3}/g, "");
var dateStamp = (date) => amzDate(date).slice(0, 8);
var getConfig = () => {
  const endpoint = (process.env.R2_ENDPOINT || "").trim().replace(/\/$/, "");
  const bucket = (process.env.R2_BUCKET_NAME || "").trim();
  const accessKeyId = (process.env.R2_ACCESS_KEY_ID || "").trim();
  const secretAccessKey = (process.env.R2_SECRET_ACCESS_KEY || "").trim();
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 is not configured");
  }
  const url = new URL(endpoint);
  if (url.protocol !== "https:") throw new Error("R2 endpoint must use HTTPS");
  return { endpoint, bucket, accessKeyId, secretAccessKey, host: url.host };
};
var canonicalObjectPath = (bucket, objectKey) => `/${enc(bucket)}/${objectKey.split("/").map(enc).join("/")}`;
var signingKey = (secret, stamp) => {
  const kDate = hmac(`AWS4${secret}`, stamp);
  const kRegion = hmac(kDate, "auto");
  const kService = hmac(kRegion, "s3");
  return hmac(kService, "aws4_request");
};
var presignR2Object = (method, objectKey, expiresSeconds) => {
  const cfg = getConfig();
  const now = /* @__PURE__ */ new Date();
  const stamp = dateStamp(now);
  const timestamp = amzDate(now);
  const credentialScope = `${stamp}/auto/s3/aws4_request`;
  const path = canonicalObjectPath(cfg.bucket, objectKey);
  const params = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${cfg.accessKeyId}/${credentialScope}`,
    "X-Amz-Date": timestamp,
    "X-Amz-Expires": String(Math.min(Math.max(expiresSeconds, 1), 3600)),
    "X-Amz-SignedHeaders": "host"
  };
  const canonicalQuery = Object.entries(params).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${enc(key)}=${enc(value)}`).join("&");
  const canonicalRequest = [
    method,
    path,
    canonicalQuery,
    `host:${cfg.host}
`,
    "host",
    "UNSIGNED-PAYLOAD"
  ].join("\n");
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    timestamp,
    credentialScope,
    sha256Hex(canonicalRequest)
  ].join("\n");
  const signature = (0, import_node_crypto.createHmac)("sha256", signingKey(cfg.secretAccessKey, stamp)).update(stringToSign).digest("hex");
  return `${cfg.endpoint}${path}?${canonicalQuery}&X-Amz-Signature=${signature}`;
};
var hasImageSignature = (bytes, mimeType) => {
  if (mimeType === "image/png") {
    return bytes.length >= 8 && bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71 && bytes[4] === 13 && bytes[5] === 10 && bytes[6] === 26 && bytes[7] === 10;
  }
  if (mimeType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  }
  if (mimeType === "image/webp") {
    return bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  }
  return false;
};
var inspectR2Object = async (objectKey) => {
  const headResponse = await fetch(presignR2Object("HEAD", objectKey, 60), { method: "HEAD" });
  if (!headResponse.ok) {
    throw new Error(`R2 object verification failed (${headResponse.status})`);
  }
  const size = Number(headResponse.headers.get("content-length") || "0");
  const mimeType = (headResponse.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  const signatureResponse = await fetch(presignR2Object("GET", objectKey, 60), {
    method: "GET",
    headers: { Range: "bytes=0-15" }
  });
  if (!signatureResponse.ok && signatureResponse.status !== 206) {
    throw new Error(`R2 image signature verification failed (${signatureResponse.status})`);
  }
  const signature = new Uint8Array(await signatureResponse.arrayBuffer());
  if (!hasImageSignature(signature, mimeType)) {
    throw new Error("Uploaded object is not a valid PNG, JPEG, or WebP image");
  }
  return { size, mimeType };
};
var deleteR2Object = async (objectKey) => {
  const response = await fetch(presignR2Object("DELETE", objectKey, 60), { method: "DELETE" });
  if (!response.ok && response.status !== 404) {
    throw new Error(`R2 object deletion failed (${response.status})`);
  }
};

// api/journal-images.ts
var journalAttachmentsApi = api.tradeJournalAttachments;
var getBearerToken = (req) => {
  const header = req.headers.authorization;
  if (typeof header !== "string") return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
};
var bodyObject = (req) => {
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  return req.body && typeof req.body === "object" ? req.body : {};
};
var errorStatus = (message) => {
  const lower = message.toLowerCase();
  if (lower.includes("not authenticated") || lower.includes("missing auth")) return 401;
  if (lower.includes("not found") || lower.includes("ownership")) return 404;
  if (lower.includes("limit") || lower.includes("too large") || lower.includes("unsupported") || lower.includes("invalid")) return 400;
  return 500;
};
async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(204).end();
  const token = getBearerToken(req);
  if (!token) return res.status(401).json({ success: false, message: "Missing auth token" });
  const client = createConvexServerClient(token);
  try {
    if (req.method === "GET") {
      const tradeId = typeof req.query.tradeId === "string" ? req.query.tradeId : "";
      if (!tradeId) return res.status(400).json({ success: false, message: "Missing tradeId" });
      const [rows, quota] = await Promise.all([
        client.query(journalAttachmentsApi.listForTrade, { tradeId }),
        client.query(journalAttachmentsApi.getUsageForUser, {})
      ]);
      const attachments = rows.map((row) => ({
        id: row._id,
        role: row.role,
        mimeType: row.mimeType,
        sizeBytes: row.sizeBytes,
        width: row.width ?? null,
        height: row.height ?? null,
        url: presignR2Object("GET", row.objectKey, 15 * 60)
      }));
      return res.status(200).json({ success: true, attachments, quota });
    }
    if (req.method === "POST") {
      const body = bodyObject(req);
      const action = String(body.action || "");
      if (action === "reserve") {
        const tradeId = String(body.tradeId || "");
        const role = body.role === "before" || body.role === "after" ? body.role : null;
        const mimeType = String(body.mimeType || "").toLowerCase();
        const sizeBytes = Number(body.sizeBytes);
        const width = body.width == null ? null : Number(body.width);
        const height = body.height == null ? null : Number(body.height);
        if (!tradeId || !role) {
          return res.status(400).json({ success: false, message: "Invalid upload request" });
        }
        const reservation = await client.mutation(journalAttachmentsApi.reserveUpload, {
          tradeId,
          role,
          mimeType,
          sizeBytes,
          width: Number.isFinite(width) ? width : null,
          height: Number.isFinite(height) ? height : null
        });
        if (reservation.staleObjectKeys?.length) {
          await Promise.allSettled(
            reservation.staleObjectKeys.map((key) => deleteR2Object(key))
          );
        }
        return res.status(200).json({
          success: true,
          reservation,
          uploadUrl: presignR2Object("PUT", reservation.objectKey, 5 * 60)
        });
      }
      if (action === "complete") {
        const attachmentId = String(body.attachmentId || "");
        if (!attachmentId) return res.status(400).json({ success: false, message: "Missing attachmentId" });
        const tradeId = String(body.tradeId || "");
        if (!tradeId) return res.status(400).json({ success: false, message: "Missing tradeId" });
        const rows = await client.query(journalAttachmentsApi.listPendingForTrade, {
          tradeId
        });
        const pending = rows.find((row) => String(row._id) === attachmentId);
        if (!pending) return res.status(404).json({ success: false, message: "Pending attachment not found" });
        const head = await inspectR2Object(pending.objectKey);
        const completed = await client.mutation(journalAttachmentsApi.completeUpload, {
          attachmentId,
          actualSizeBytes: head.size,
          actualMimeType: head.mimeType
        });
        await Promise.allSettled(
          completed.replacedObjectKeys.map((key) => deleteR2Object(key))
        );
        return res.status(200).json({
          success: true,
          attachment: {
            id: completed.attachmentId,
            role: completed.role,
            mimeType: completed.mimeType,
            sizeBytes: completed.sizeBytes,
            url: presignR2Object("GET", completed.objectKey, 15 * 60)
          }
        });
      }
      if (action === "cancel") {
        const attachmentId = String(body.attachmentId || "");
        if (!attachmentId) return res.status(400).json({ success: false, message: "Missing attachmentId" });
        const cancelled = await client.mutation(journalAttachmentsApi.cancelUpload, {
          attachmentId
        });
        if (cancelled?.objectKey) {
          await deleteR2Object(cancelled.objectKey).catch(() => void 0);
        }
        return res.status(200).json({ success: true });
      }
      return res.status(400).json({ success: false, message: "Unknown action" });
    }
    if (req.method === "DELETE") {
      const body = bodyObject(req);
      const attachmentId = String(body.attachmentId || "");
      if (!attachmentId) return res.status(400).json({ success: false, message: "Missing attachmentId" });
      const deleted = await client.mutation(journalAttachmentsApi.deleteAttachment, {
        attachmentId
      });
      await deleteR2Object(deleted.objectKey).catch((error) => {
        console.error("[journal-images] orphaned R2 object after metadata delete", error);
      });
      return res.status(200).json({ success: true });
    }
    return res.status(405).json({ success: false, message: "Method not allowed" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Journal image request failed";
    console.error("[journal-images]", message);
    return res.status(errorStatus(message)).json({ success: false, message });
  }
}

// api/journal-entry.ts
var getBearerToken2 = (req) => {
  const header = req.headers.authorization;
  if (typeof header !== "string") return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
};
var bodyObject2 = (req) => {
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  return req.body && typeof req.body === "object" ? req.body : {};
};
async function handler2(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Methods", "DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "DELETE") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }
  const token = getBearerToken2(req);
  if (!token) {
    return res.status(401).json({ success: false, message: "Missing auth token" });
  }
  let body;
  try {
    body = bodyObject2(req);
  } catch {
    return res.status(400).json({ success: false, message: "Invalid JSON body" });
  }
  const tradeId = String(body.tradeId || "");
  if (!tradeId) {
    return res.status(400).json({ success: false, message: "Missing tradeId" });
  }
  const client = createConvexServerClient(token);
  const tradingJournalApi = api.tradingJournal;
  try {
    const prepared = await client.mutation(tradingJournalApi.beginDeleteEntry, {
      id: tradeId
    });
    const keys = Array.from(new Set(prepared.objectKeys ?? []));
    const deletionResults = await Promise.allSettled(
      keys.map((key) => deleteR2Object(key))
    );
    const failedDeletion = deletionResults.find(
      (result) => result.status === "rejected"
    );
    if (failedDeletion) {
      throw failedDeletion.reason;
    }
    await client.mutation(tradingJournalApi.finalizeDeleteEntry, {
      id: tradeId
    });
    return res.status(200).json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not delete journal";
    const lower = message.toLowerCase();
    const status = lower.includes("not authenticated") || lower.includes("missing auth") ? 401 : lower.includes("not found") ? 404 : lower.includes("r2 object deletion failed") ? 502 : 500;
    console.error("[journal-entry-delete]", message);
    return res.status(status).json({ success: false, message });
  }
}

// api/feature-flag.ts
function getBearerToken3(req) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return null;
  }
  return header.slice("Bearer ".length);
}
async function handler3(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.status(200).send("ok");
  }
  try {
    if (req.method === "GET") {
      const enabled = await convexServerClient.query(api.admin.getPaidLock, {});
      return res.status(200).json({ success: true, key: "paid-lock", enabled: !!enabled });
    }
    if (req.method === "POST") {
      const token = getBearerToken3(req);
      if (!token) {
        return res.status(401).json({ success: false, message: "Missing authorization token" });
      }
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      if (typeof body.enabled !== "boolean") {
        return res.status(400).json({ success: false, message: "Missing or invalid enabled boolean in body" });
      }
      const client = createConvexServerClient(token);
      await client.mutation(api.admin.setPaidLock, { enabled: body.enabled });
      return res.status(200).json({ success: true, key: "paid-lock", enabled: body.enabled });
    }
    return res.status(405).json({ success: false, message: "Method not allowed" });
  } catch (error) {
    console.error("[feature-flag] unexpected error", error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
}

// api/verify-payment.ts
var import_browser2 = require("convex/browser");

// api/_lib/paymentReference.ts
var PLAN_AMOUNTS_MINOR = {
  monthly: 500,
  // $5.00
  yearly: 5880
  // $58.80 (2% off annual)
};
var PLAN_IDS = /* @__PURE__ */ new Set(["monthly", "yearly"]);
function isPlanPeriod(value) {
  return PLAN_IDS.has(value);
}
function parseChargeSuccessReference(reference) {
  const parts = (reference || "").split("_");
  if (parts.length < 3 || parts[0] !== "psk") {
    return { error: "Invalid reference format" };
  }
  const maybeTimestamp = parts[parts.length - 1];
  const hasTimestamp = /^\d{10,}$/.test(maybeTimestamp);
  const planPart = hasTimestamp ? parts[parts.length - 2] : parts[parts.length - 1];
  const userId = hasTimestamp ? parts.slice(1, -2).join("_") : parts.slice(1, -1).join("_");
  if (userId && isPlanPeriod(planPart)) {
    return { userId, planPeriod: planPart };
  }
  if (!hasTimestamp && parts.length >= 3) {
    const legacyUser = parts[1];
    const legacyPlan = parts[2];
    if (legacyUser && isPlanPeriod(legacyPlan)) {
      return { userId: legacyUser, planPeriod: legacyPlan };
    }
  }
  return { error: "Invalid reference format" };
}
function subscriptionTierForPlan(_planPeriod) {
  return "premium";
}
function computeSubscriptionExpiry(planPeriod, paidAtMs) {
  const expiryDate = new Date(paidAtMs);
  if (planPeriod === "yearly" || planPeriod === "pro") {
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);
  } else if (planPeriod === "lifetime") {
    expiryDate.setFullYear(expiryDate.getFullYear() + 100);
  } else {
    expiryDate.setMonth(expiryDate.getMonth() + 1);
  }
  return expiryDate.getTime();
}
function expectedAmountMinorUnits(planPeriod) {
  return PLAN_AMOUNTS_MINOR[planPeriod];
}

// api/_lib/paymentSyncClient.ts
function resolveConvexSiteUrl() {
  const explicit = process.env.CONVEX_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const cloudUrl = (process.env.CONVEX_URL || process.env.VITE_CONVEX_URL || "").trim();
  if (!cloudUrl) {
    throw new Error("CONVEX_SITE_URL or CONVEX_URL is not configured");
  }
  return cloudUrl.replace(/\.convex\.cloud\/?$/, ".convex.site").replace(/\/$/, "");
}
async function postPaymentSync(path, body) {
  const secret = process.env.PAYMENT_SYNC_SECRET;
  if (!secret) {
    throw new Error("PAYMENT_SYNC_SECRET is not configured");
  }
  const url = `${resolveConvexSiteUrl()}${path}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${secret}`
    },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Payment sync ${path} returned non-JSON (${response.status})`);
  }
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "error" in payload ? String(payload.error) : `Payment sync ${path} failed (${response.status})`;
    throw new Error(message);
  }
  return payload;
}
async function syncSubscriptionFromPaymentHttp(args) {
  return postPaymentSync("/payments/sync", {
    ...args
  });
}
async function expireSubscriptionsBeforeHttp(beforeMs) {
  return postPaymentSync(
    "/payments/expire",
    { beforeMs }
  );
}
async function listExpiringSubscriptionsHttp(fromMs, toMs) {
  const result = await postPaymentSync("/payments/expiring", { fromMs, toMs });
  return result.profiles ?? [];
}

// api/_lib/paystackVerify.ts
async function verifyPaystackTransaction(reference, secretKey, fetchImpl = fetch) {
  const response = await fetchImpl(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        Accept: "application/json"
      }
    }
  );
  let body;
  try {
    body = await response.json();
  } catch {
    return { ok: false, status: 502, error: "Invalid Paystack verify response" };
  }
  if (!response.ok || !body.status || !body.data) {
    return {
      ok: false,
      status: response.status === 404 ? 404 : 400,
      error: body.message || "Payment could not be verified"
    };
  }
  return { ok: true, data: body.data };
}

// api/verify-payment.ts
var PAYMENT_SYNC_SECRET = process.env.PAYMENT_SYNC_SECRET;
var PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
var CONVEX_URL = process.env.CONVEX_URL || process.env.VITE_CONVEX_URL;
function getBearerToken4(req) {
  const header = req.headers.authorization;
  if (typeof header !== "string") return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}
async function handler4(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.status(200).send("ok");
  }
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }
  if (!PAYMENT_SYNC_SECRET || !PAYSTACK_SECRET_KEY || !CONVEX_URL) {
    return res.status(500).json({
      success: false,
      message: "Payment verification is not configured"
    });
  }
  const token = getBearerToken4(req);
  if (!token) {
    return res.status(401).json({ success: false, message: "Missing auth token" });
  }
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const reference = typeof body.reference === "string" ? body.reference.trim() : "";
    if (!reference) {
      return res.status(400).json({ success: false, message: "Missing payment reference" });
    }
    const authedClient = new import_browser2.ConvexHttpClient(CONVEX_URL);
    authedClient.setAuth(token);
    const viewer = await authedClient.query(api.users.viewer, {});
    if (!viewer?.id) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }
    const parsedRef = parseChargeSuccessReference(reference);
    if ("error" in parsedRef) {
      return res.status(400).json({ success: false, message: parsedRef.error });
    }
    if (parsedRef.userId !== viewer.id) {
      return res.status(403).json({
        success: false,
        message: "Payment reference does not belong to this account"
      });
    }
    const verified = await verifyPaystackTransaction(reference, PAYSTACK_SECRET_KEY);
    if (!verified.ok) {
      return res.status(verified.status).json({ success: false, message: verified.error });
    }
    const tx = verified.data;
    if (tx.status !== "success") {
      return res.status(400).json({ success: false, message: "Payment was not successful" });
    }
    if (tx.reference !== reference) {
      return res.status(400).json({ success: false, message: "Reference mismatch" });
    }
    const expectedMinor = expectedAmountMinorUnits(parsedRef.planPeriod);
    if (Number(tx.amount) !== expectedMinor) {
      return res.status(400).json({
        success: false,
        message: "Paid amount does not match selected plan"
      });
    }
    if (String(tx.currency || "").toUpperCase() !== "USD") {
      return res.status(400).json({ success: false, message: "Unexpected payment currency" });
    }
    const paidAtMs = tx.paid_at ? new Date(tx.paid_at).getTime() : Date.now();
    const paidAtSafe = Number.isFinite(paidAtMs) ? paidAtMs : Date.now();
    const tier = subscriptionTierForPlan(parsedRef.planPeriod);
    const expiresAtMs = computeSubscriptionExpiry(parsedRef.planPeriod, paidAtSafe);
    await syncSubscriptionFromPaymentHttp({
      userId: viewer.id,
      reference,
      tier,
      amount: expectedMinor / 100,
      currency: "USD",
      status: "success",
      expiresAtMs,
      paidAtMs: paidAtSafe,
      metadata: {
        source: "vercel-verify-payment",
        planId: parsedRef.planPeriod,
        paystack_customer_code: tx.customer?.customer_code ?? null
      }
    });
    return res.status(200).json({
      success: true,
      message: "Payment verified and subscription activated",
      data: {
        reference,
        tier,
        planId: parsedRef.planPeriod,
        expiresAt: new Date(expiresAtMs).toISOString()
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
}

// api/_lib/paystackWebhookCore.ts
var import_crypto = __toESM(require("crypto"), 1);
function verifyPaystackSignature(rawBody, signature, secret) {
  if (!signature) {
    return { ok: false, status: 401, error: "Missing signature" };
  }
  const computed = import_crypto.default.createHmac("sha512", secret).update(rawBody).digest("hex");
  const a = Buffer.from(computed, "utf8");
  const b = Buffer.from(signature, "utf8");
  if (a.length !== b.length || !import_crypto.default.timingSafeEqual(a, b)) {
    return { ok: false, status: 401, error: "Invalid signature" };
  }
  return { ok: true };
}
function parseSuccessfulCharge(event, paidAtMs = Date.now()) {
  if (event?.event !== "charge.success" || event?.data?.status !== "success") {
    return null;
  }
  const parsedRef = parseChargeSuccessReference(event.data?.reference);
  if ("error" in parsedRef) {
    return { error: parsedRef.error, status: 400 };
  }
  const { userId, planPeriod } = parsedRef;
  const reference = event.data?.reference;
  const tier = subscriptionTierForPlan(planPeriod);
  return {
    userId,
    planPeriod,
    tier,
    reference,
    amount: Number(event?.data?.amount || 0) / 100,
    currency: event?.data?.currency || "USD",
    expiresAtMs: computeSubscriptionExpiry(planPeriod, paidAtMs),
    paidAtMs,
    metadata: {
      source: "paystack-webhook",
      planId: planPeriod,
      channel: event?.data?.channel,
      ip_address: event?.data?.ip_address,
      fees: event?.data?.fees || 0,
      customer_code: event?.data?.customer?.customer_code || null,
      authorization: event?.data?.authorization,
      gateway_response: event?.data?.gateway_response,
      webhook_event: event?.event
    }
  };
}

// api/paystack-webhook.ts
var PAYSTACK_WEBHOOK_SECRET = process.env.PAYSTACK_WEBHOOK_SECRET;
var PAYMENT_SYNC_SECRET2 = process.env.PAYMENT_SYNC_SECRET;
function buffer(req) {
  return new Promise((resolve2, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve2(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}
async function handler5(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!PAYSTACK_WEBHOOK_SECRET || !PAYMENT_SYNC_SECRET2) {
    const missing = [
      !PAYSTACK_WEBHOOK_SECRET ? "PAYSTACK_WEBHOOK_SECRET" : null,
      !PAYMENT_SYNC_SECRET2 ? "PAYMENT_SYNC_SECRET" : null
    ].filter(Boolean);
    return res.status(500).json({
      error: "Server not configured (missing env vars)",
      missing
    });
  }
  try {
    const rawBody = await buffer(req);
    const signature = req.headers["x-paystack-signature"];
    const signatureCheck = verifyPaystackSignature(rawBody, signature, PAYSTACK_WEBHOOK_SECRET);
    if (!signatureCheck.ok) {
      return res.status(signatureCheck.status).json({ error: signatureCheck.error });
    }
    const event = JSON.parse(rawBody.toString("utf8"));
    const parsed = parseSuccessfulCharge(event);
    if (parsed && "error" in parsed) {
      return res.status(parsed.status).json({ error: parsed.error });
    }
    if (parsed) {
      await syncSubscriptionFromPaymentHttp({
        userId: parsed.userId,
        reference: parsed.reference,
        tier: parsed.tier,
        amount: parsed.amount,
        currency: parsed.currency,
        status: "success",
        expiresAtMs: parsed.expiresAtMs,
        paidAtMs: parsed.paidAtMs,
        metadata: parsed.metadata
      });
    }
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("[paystack-webhook] unexpected error", error);
    return res.status(500).json({ error: error?.message || "Internal server error" });
  }
}

// api/restore-purchase.ts
var import_browser3 = require("convex/browser");
var CONVEX_URL2 = process.env.CONVEX_URL || process.env.VITE_CONVEX_URL;
async function handler6(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).send("ok");
  if (req.method !== "POST") return res.status(405).json({ success: false, message: "Method not allowed" });
  if (!CONVEX_URL2) {
    return res.status(500).json({ success: false, message: "Server not configured (missing CONVEX_URL)" });
  }
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const { userId } = body;
    if (!userId) return res.status(400).json({ success: false, message: "Missing userId" });
    const authorization = req.headers.authorization;
    const token = authorization?.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return res.status(401).json({ success: false, message: "Missing auth token" });
    }
    const client = new import_browser3.ConvexHttpClient(CONVEX_URL2);
    client.setAuth(token);
    const result = await client.mutation(api.admin.restoreLatestPaymentForUser, { userId });
    return res.status(result?.success ? 200 : 404).json(result);
  } catch (err) {
    console.error("[restore-purchase] unexpected error", err);
    return res.status(500).json({ success: false, message: err?.message || String(err) });
  }
}

// api/scheduled-reminder.ts
var RESEND_API_KEY = process.env.RESEND_API_KEY;
var PAYMENT_SYNC_SECRET3 = process.env.PAYMENT_SYNC_SECRET;
var REMINDER_DAYS = 3;
async function sendReminderEmail(to, name, expiresAt) {
  const subject = "Your Poscal subscription is expiring soon";
  const shortName = name || "there";
  const expiresText = expiresAt ? new Date(expiresAt).toUTCString() : "soon";
  const html = `<p>Hi ${shortName},</p>
<p>Your Poscal subscription will expire on <strong>${expiresText}</strong>.</p>
<p>If you'd like to renew and keep access to Pro features, <a href="https://www.poscalfx.com/upgrade">upgrade now</a>.</p>
<p>Thanks \u2014 the Poscal team</p>`;
  if (!RESEND_API_KEY) {
    return { success: false, error: "RESEND_API_KEY is not configured" };
  }
  const from = process.env.EMAIL_FROM || "Poscal <noreply@poscalfx.com>";
  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({ from, to, subject, html })
    });
    if (!resp.ok) {
      const txt = await resp.text();
      console.error("Resend API returned error", resp.status, txt);
      return { success: false, error: `resend_error_${resp.status}` };
    }
    const body = await resp.json();
    return { success: true, id: body.id || null };
  } catch (err) {
    console.error("Failed to send reminder via Resend HTTP", err?.message || err);
    return { success: false, error: err?.message || String(err) };
  }
}
async function handler7(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }
  if (!PAYMENT_SYNC_SECRET3) {
    return res.status(500).json({ success: false, message: "Server not configured (missing PAYMENT_SYNC_SECRET)" });
  }
  const now = /* @__PURE__ */ new Date();
  const soon = new Date(now.getTime() + REMINDER_DAYS * 24 * 60 * 60 * 1e3);
  let expiring;
  try {
    expiring = await listExpiringSubscriptionsHttp(now.getTime(), soon.getTime());
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to list expiring subscriptions"
    });
  }
  const due = expiring || [];
  if (!RESEND_API_KEY && due.length > 0) {
    return res.status(503).json({
      success: false,
      message: "RESEND_API_KEY is not configured; reminder emails were not sent",
      count: due.length
    });
  }
  const results = [];
  for (const user of due) {
    if (!user.email) {
      results.push({ id: user.userId, success: false, error: "missing email" });
      continue;
    }
    const r = await sendReminderEmail(
      user.email,
      user.fullName || null,
      user.subscriptionExpiresAtMs ? new Date(user.subscriptionExpiresAtMs).toISOString() : null
    );
    results.push({ id: user.userId, email: user.email, ...r });
  }
  const failed = results.some((result) => result.success === false);
  return res.status(failed ? 502 : 200).json({
    success: !failed,
    count: due.length,
    results
  });
}

// api/scheduled-expiry.ts
var PAYMENT_SYNC_SECRET4 = process.env.PAYMENT_SYNC_SECRET;
async function handler8(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }
  if (!PAYMENT_SYNC_SECRET4) {
    return res.status(500).json({ success: false, message: "Server not configured (missing PAYMENT_SYNC_SECRET)" });
  }
  try {
    const result = await expireSubscriptionsBeforeHttp(Date.now());
    return res.status(200).json({ success: true, message: "Expired old subscriptions", ...result });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Expiry job failed"
    });
  }
}

// server/production.ts
var handlers = {
  "/api/prices": prices_default,
  "/api/prices/multiple": multiple_default,
  "/api/journal-images": handler,
  "/api/journal-entry": handler2,
  "/api/feature-flag": handler3,
  "/api/verify-payment": handler4,
  "/api/paystack-webhook": handler5,
  "/api/restore-purchase": handler6,
  "/api/scheduled-reminder": handler7,
  "/api/scheduled-expiry": handler8
};
var allowedHosts = /* @__PURE__ */ new Set([
  "poscalfx.com",
  "www.poscalfx.com",
  "127.0.0.1:23000",
  "localhost:23000"
]);
var root = (0, import_node_path.resolve)("dist");
var types = {
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
  ".woff2": "font/woff2"
};
var convexCloud = process.env.VITE_CONVEX_URL ?? "https://convex.poscalfx.com";
var convexSite = process.env.VITE_CONVEX_SITE_URL ?? "https://convex-http.poscalfx.com";
var convexWs = convexCloud.replace(/^https:/, "wss:").replace(/^http:/, "ws:");
var csp = [
  "default-src 'self'",
  "script-src 'self' 'sha256-owAtiryeeynyETMCxJ9glbgLtzEawuKtrpDGb4kgkiU=' https://www.googletagmanager.com",
  `connect-src 'self' ${convexCloud} ${convexWs} ${convexSite} https://api.frankfurter.dev https://open.er-api.com https://www.google-analytics.com https://analytics.google.com`,
  `img-src 'self' data: blob: ${convexCloud} https://www.googletagmanager.com https://www.google-analytics.com`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "frame-ancestors 'none'"
].join("; ");
var server = (0, import_node_http.createServer)(async (request, response) => {
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
          convex: convexCloud
        })
      );
      return;
    }
    const handler9 = handlers[url.pathname];
    if (handler9) {
      const chunks = [];
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
      const req = request;
      req.query = Object.fromEntries(
        [...new Set(url.searchParams.keys())].map((key) => {
          const values = url.searchParams.getAll(key);
          return [key, values.length === 1 ? values[0] : values];
        })
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
      const res = response;
      res.status = (code) => {
        res.statusCode = code;
        return res;
      };
      res.json = (value) => {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(value));
        return res;
      };
      res.send = (value) => {
        res.end(value);
        return res;
      };
      await handler9(req, res);
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
    const path = (0, import_node_path.resolve)(root, "." + decodeURIComponent(url.pathname));
    if (path !== root && !path.startsWith(root + import_node_path.sep)) {
      response.writeHead(403).end();
      return;
    }
    let file = path;
    try {
      if (!(await (0, import_promises.stat)(file)).isFile()) file = (0, import_node_path.resolve)(root, "index.html");
    } catch {
      if ((0, import_node_path.extname)(path)) {
        response.writeHead(404).end();
        return;
      }
      file = (0, import_node_path.resolve)(root, "index.html");
    }
    if (file.endsWith("index.html") || file.endsWith("sw.js")) {
      response.setHeader("Cache-Control", "no-cache");
    } else if (file.includes(`${import_node_path.sep}assets${import_node_path.sep}`)) {
      response.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    }
    response.setHeader("Content-Type", types[(0, import_node_path.extname)(file)] ?? "application/octet-stream");
    const data = await (0, import_promises.readFile)(file);
    response.end(request.method === "HEAD" ? void 0 : data);
  } catch {
    if (!response.headersSent) response.writeHead(500);
    response.end("Request failed");
  }
});
server.requestTimeout = 3e4;
server.headersTimeout = 15e3;
var listenHost = process.env.LISTEN_HOST ?? "127.0.0.1";
var listenPort = Number(process.env.LISTEN_PORT ?? "23000");
server.listen(
  listenPort,
  listenHost,
  () => console.log(`VPS production listening on ${listenHost}:${listenPort}`)
);
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  server
});
