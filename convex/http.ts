import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { processNotifications } from "./notificationsHttp";
import { ingestNews } from "./newsHttp";
import {
  expireSubscriptionsBefore,
  listExpiringSubscriptions,
  syncSubscriptionFromPayment,
} from "./paymentHttp";
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
http.route({
  path: "/payments/sync",
  method: "POST",
  handler: syncSubscriptionFromPayment,
});
http.route({
  path: "/payments/expire",
  method: "POST",
  handler: expireSubscriptionsBefore,
});
http.route({
  path: "/payments/expiring",
  method: "POST",
  handler: listExpiringSubscriptions,
});

export default http;
