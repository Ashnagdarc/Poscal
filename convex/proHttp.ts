import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

export const paystackWebhook = httpAction(async (ctx, request) => {
  if (Number(request.headers.get("content-length") ?? 0) > 200_000)
    return new Response("Too large", { status: 413 });
  const raw = await request.text();
  const accepted = await ctx.runAction(internal.proPayments.receiveWebhook, {
    raw,
    signature: request.headers.get("x-paystack-signature") ?? "",
  });
  return new Response(accepted ? "OK" : "Invalid webhook", {
    status: accepted ? 200 : 401,
  });
});
