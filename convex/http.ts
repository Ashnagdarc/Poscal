import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { ingestPrices } from "./pricesHttp";

const http = httpRouter();

auth.addHttpRoutes(http);
http.route({
  path: "/prices/ingest",
  method: "POST",
  handler: ingestPrices,
});

export default http;
