import { createHash, createHmac } from "node:crypto";

type Method = "GET" | "PUT" | "HEAD" | "DELETE";

const enc = (value: string) =>
  encodeURIComponent(value)
    .replace(/[!'()*]/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`);

const sha256Hex = (value: string) => createHash("sha256").update(value).digest("hex");
const hmac = (key: Buffer | string, value: string) => createHmac("sha256", key).update(value).digest();

const amzDate = (date: Date) =>
  date.toISOString().replace(/[:-]|.d{3}/g, "");

const dateStamp = (date: Date) => amzDate(date).slice(0, 8);

const getConfig = () => {
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

const canonicalObjectPath = (bucket: string, objectKey: string) =>
  `/${enc(bucket)}/${objectKey.split("/").map(enc).join("/")}`;

const signingKey = (secret: string, stamp: string) => {
  const kDate = hmac(`AWS4${secret}`, stamp);
  const kRegion = hmac(kDate, "auto");
  const kService = hmac(kRegion, "s3");
  return hmac(kService, "aws4_request");
};

export const presignR2Object = (
  method: Method,
  objectKey: string,
  expiresSeconds: number,
) => {
  const cfg = getConfig();
  const now = new Date();
  const stamp = dateStamp(now);
  const timestamp = amzDate(now);
  const credentialScope = `${stamp}/auto/s3/aws4_request`;
  const path = canonicalObjectPath(cfg.bucket, objectKey);

  const params: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${cfg.accessKeyId}/${credentialScope}`,
    "X-Amz-Date": timestamp,
    "X-Amz-Expires": String(Math.min(Math.max(expiresSeconds, 1), 3600)),
    "X-Amz-SignedHeaders": "host",
  };

  const canonicalQuery = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${enc(key)}=${enc(value)}`)
    .join("&");

  const canonicalRequest = [
    method,
    path,
    canonicalQuery,
    `host:${cfg.host}\n`,
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    timestamp,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const signature = createHmac("sha256", signingKey(cfg.secretAccessKey, stamp))
    .update(stringToSign)
    .digest("hex");

  return `${cfg.endpoint}${path}?${canonicalQuery}&X-Amz-Signature=${signature}`;
};

const hasImageSignature = (bytes: Uint8Array, mimeType: string) => {
  if (mimeType === "image/png") {
    return bytes.length >= 8
      && bytes[0] === 0x89
      && bytes[1] === 0x50
      && bytes[2] === 0x4e
      && bytes[3] === 0x47
      && bytes[4] === 0x0d
      && bytes[5] === 0x0a
      && bytes[6] === 0x1a
      && bytes[7] === 0x0a;
  }
  if (mimeType === "image/jpeg") {
    return bytes.length >= 3
      && bytes[0] === 0xff
      && bytes[1] === 0xd8
      && bytes[2] === 0xff;
  }
  if (mimeType === "image/webp") {
    return bytes.length >= 12
      && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
      && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  }
  return false;
};

export const inspectR2Object = async (objectKey: string) => {
  const headResponse = await fetch(presignR2Object("HEAD", objectKey, 60), { method: "HEAD" });
  if (!headResponse.ok) {
    throw new Error(`R2 object verification failed (${headResponse.status})`);
  }

  const size = Number(headResponse.headers.get("content-length") || "0");
  const mimeType = (headResponse.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();

  const signatureResponse = await fetch(presignR2Object("GET", objectKey, 60), {
    method: "GET",
    headers: { Range: "bytes=0-15" },
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

export const deleteR2Object = async (objectKey: string) => {
  const response = await fetch(presignR2Object("DELETE", objectKey, 60), { method: "DELETE" });
  if (!response.ok && response.status !== 404) {
    throw new Error(`R2 object deletion failed (${response.status})`);
  }
};
