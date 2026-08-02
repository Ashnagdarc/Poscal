import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization) return null;
  const [scheme, token] = authorization.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const ingestNews = httpAction(async (ctx, request) => {
  const expectedSecret = process.env.NEWS_INGEST_SECRET;
  if (!expectedSecret) {
    return json({ ok: false, error: "NEWS_INGEST_SECRET is not configured." }, 500);
  }

  const providedSecret =
    getBearerToken(request) ?? request.headers.get("x-news-ingest-secret");
  if (providedSecret !== expectedSecret) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  let force = false;
  try {
    const payload = await request.json();
    force = Boolean((payload as { force?: boolean })?.force);
  } catch {
    // Empty body is fine.
  }

  try {
    const result = await ctx.runAction(internal.newsIngest.runIngest, { force });
    return json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ingest failed";
    return json({ ok: false, error: message }, 500);
  }
});
