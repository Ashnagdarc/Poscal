import type { VercelRequest, VercelResponse } from "@vercel/node";
export const config = { api: { bodyParser: false } };
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const site = process.env.CONVEX_SITE_URL;
  if (!site || !/^https:\/\/[a-z0-9-]+\.convex\.site$/.test(site))
    return res.status(503).send("Webhook configuration unavailable");
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > 200_000) return res.status(413).end();
    chunks.push(bytes);
  }
  try {
    const response = await fetch(`${site}/billing/paystack-webhook`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-paystack-signature": String(
          req.headers["x-paystack-signature"] ?? "",
        ),
      },
      body: Buffer.concat(chunks),
      signal: AbortSignal.timeout(20_000),
    });
    return res
      .status(response.status)
      .send(response.ok ? "OK" : "Webhook not accepted");
  } catch {
    return res.status(503).send("Retry webhook delivery");
  }
}
