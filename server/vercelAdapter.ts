import type { IncomingMessage, ServerResponse } from "node:http";
import { URL } from "node:url";

type VercelLikeRequest = IncomingMessage & {
  method?: string;
  url?: string;
  headers: IncomingMessage["headers"];
  query: Record<string, string | string[]>;
  body: unknown;
};

type VercelLikeResponse = ServerResponse & {
  statusCode: number;
  status: (code: number) => VercelLikeResponse;
  json: (body: unknown) => void;
  send: (body: unknown) => void;
};

export type ApiHandler = (
  req: VercelLikeRequest,
  res: VercelLikeResponse,
) => unknown | Promise<unknown>;

const readBody = async (req: IncomingMessage): Promise<unknown> => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  if (chunks.length === 0) return undefined;

  const raw = Buffer.concat(chunks).toString("utf8");
  const contentType = String(req.headers["content-type"] ?? "");
  if (contentType.includes("application/json")) {
    try {
      return raw ? JSON.parse(raw) : {};
    } catch {
      return raw;
    }
  }
  return raw;
};

const parseQuery = (url: URL): Record<string, string | string[]> => {
  const query: Record<string, string | string[]> = {};
  for (const [key, value] of url.searchParams.entries()) {
    const existing = query[key];
    if (existing === undefined) {
      query[key] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      query[key] = [existing, value];
    }
  }
  return query;
};

export const invokeVercelHandler = async (
  handler: ApiHandler,
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
) => {
  const body = await readBody(req);
  const vercelReq = req as VercelLikeRequest;
  vercelReq.query = parseQuery(url);
  vercelReq.body = body;

  const vercelRes = res as VercelLikeResponse;
  vercelRes.status = (code: number) => {
    vercelRes.statusCode = code;
    return vercelRes;
  };
  vercelRes.json = (payload: unknown) => {
    if (!vercelRes.getHeader("Content-Type")) {
      vercelRes.setHeader("Content-Type", "application/json; charset=utf-8");
    }
    vercelRes.end(JSON.stringify(payload));
  };
  vercelRes.send = (payload: unknown) => {
    if (typeof payload === "object" && payload !== null && !Buffer.isBuffer(payload)) {
      vercelRes.json(payload);
      return;
    }
    vercelRes.end(payload as string | Buffer);
  };

  await handler(vercelReq, vercelRes);
  if (!vercelRes.writableEnded) {
    vercelRes.end();
  }
};
