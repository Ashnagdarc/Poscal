import type { VercelRequest, VercelResponse } from "@vercel/node";
import { convexServerClient, createConvexServerClient, api } from "./_convex.js";

function getBearerToken(req: VercelRequest) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return null;
  }
  return header.slice("Bearer ".length);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
      const token = getBearerToken(req);
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
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
