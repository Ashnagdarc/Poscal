import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { processNotifications } from "./notificationsHttp";
import { ingestNews } from "./newsHttp";
import { paystackWebhook } from "./proHttp";
import { ingestPrices } from "./pricesHttp";

const http = httpRouter();

auth.addHttpRoutes(http);
http.route({
  path: "/prices/ingest",
  method: "POST",
  handler: ingestPrices,
});
http.route({
  path: "/news/ingest",
  method: "POST",
  handler: ingestNews,
});
http.route({
  path: "/notifications/process",
  method: "POST",
  handler: processNotifications,
});
http.route({ path: "/billing/paystack-webhook", method: "POST", handler: paystackWebhook });

export default http;
