import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { processNotifications } from "./notificationsHttp";
import { ingestNews } from "./newsHttp";
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

export default http;
