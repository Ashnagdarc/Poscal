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

function badRequest(message: string, status = 400) {
  return jsonResponse({ ok: false, error: message }, status);
}

function requirePaymentSyncSecret(request: Request) {
  const expectedSecret = process.env.PAYMENT_SYNC_SECRET;
  if (!expectedSecret) {
    return badRequest("PAYMENT_SYNC_SECRET is not configured.", 500);
  }

  const providedSecret =
    getBearerToken(request) ?? request.headers.get("x-payment-sync-secret");
  if (providedSecret !== expectedSecret) {
    return badRequest("Unauthorized", 401);
  }

  return null;
}

async function readJsonBody(request: Request): Promise<unknown | Response> {
  try {
    return await request.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }
}

export const syncSubscriptionFromPayment = httpAction(async (ctx, request) => {
  const unauthorized = requirePaymentSyncSecret(request);
  if (unauthorized) return unauthorized;

  const payload = await readJsonBody(request);
  if (payload instanceof Response) return payload;
  if (!payload || typeof payload !== "object") {
    return badRequest("Expected JSON object body.");
  }

  const body = payload as Record<string, unknown>;
  if (
    typeof body.userId !== "string"
    || typeof body.reference !== "string"
    || typeof body.tier !== "string"
    || typeof body.amount !== "number"
    || typeof body.currency !== "string"
    || typeof body.status !== "string"
    || typeof body.paidAtMs !== "number"
  ) {
    return badRequest("Missing or invalid payment sync fields.");
  }

  const expiresAtMs =
    typeof body.expiresAtMs === "number"
      ? body.expiresAtMs
      : body.expiresAtMs === null
        ? null
        : undefined;

  const result = await ctx.runMutation(internal.admin.syncSubscriptionFromPayment, {
    userId: body.userId,
    reference: body.reference,
    tier: body.tier,
    amount: body.amount,
    currency: body.currency,
    status: body.status,
    expiresAtMs,
    paidAtMs: body.paidAtMs,
    metadata: body.metadata ?? null,
  });

  return jsonResponse({ ok: true, ...result });
});

export const expireSubscriptionsBefore = httpAction(async (ctx, request) => {
  const unauthorized = requirePaymentSyncSecret(request);
  if (unauthorized) return unauthorized;

  const payload = await readJsonBody(request);
  if (payload instanceof Response) return payload;
  if (!payload || typeof payload !== "object") {
    return badRequest("Expected JSON object body.");
  }

  const body = payload as Record<string, unknown>;
  const beforeMs = typeof body.beforeMs === "number" ? body.beforeMs : Date.now();

  const result = await ctx.runMutation(internal.admin.expireSubscriptionsBefore, {
    beforeMs,
  });

  return jsonResponse({ ok: true, ...result });
});

export const listExpiringSubscriptions = httpAction(async (ctx, request) => {
  const unauthorized = requirePaymentSyncSecret(request);
  if (unauthorized) return unauthorized;

  const payload = await readJsonBody(request);
  if (payload instanceof Response) return payload;
  if (!payload || typeof payload !== "object") {
    return badRequest("Expected JSON object body.");
  }

  const body = payload as Record<string, unknown>;
  if (typeof body.fromMs !== "number" || typeof body.toMs !== "number") {
    return badRequest("fromMs and toMs are required numbers.");
  }

  const profiles = await ctx.runQuery(internal.admin.listExpiringSubscriptions, {
    fromMs: body.fromMs,
    toMs: body.toMs,
  });

  return jsonResponse({ ok: true, profiles });
});
