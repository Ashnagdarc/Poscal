import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization) {
    return null;
  }
  const [scheme, token] = authorization.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }
  return token;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const processNotifications = httpAction(async (ctx, request) => {
  const expectedSecret = process.env.NOTIFICATION_WORKER_SECRET;
  if (!expectedSecret) {
    return jsonResponse({ ok: false, error: "NOTIFICATION_WORKER_SECRET is not configured." }, 500);
  }

  const providedSecret = getBearerToken(request) ?? request.headers.get("x-notification-worker-secret");
  if (providedSecret !== expectedSecret) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  }

  const url = new URL(request.url);
  const limitValue = Number(url.searchParams.get("limit") ?? "50");
  const limit = Number.isFinite(limitValue) ? limitValue : 50;

  const result = await ctx.runAction(internal.notificationsNode.processPendingBatch, { limit });
  return jsonResponse({ ok: true, ...result });
});
