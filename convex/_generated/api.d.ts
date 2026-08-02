/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ResendOTPPasswordReset from "../ResendOTPPasswordReset.js";
import type * as admin from "../admin.js";
import type * as auth from "../auth.js";
import type * as authRateLimit from "../authRateLimit.js";
import type * as calculatorHistory from "../calculatorHistory.js";
import type * as http from "../http.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_tradeValidation from "../lib/tradeValidation.js";
import type * as lib_tradingAlerts from "../lib/tradingAlerts.js";
import type * as news from "../news.js";
import type * as newsHttp from "../newsHttp.js";
import type * as newsIngest from "../newsIngest.js";
import type * as notifications from "../notifications.js";
import type * as notificationsHttp from "../notificationsHttp.js";
import type * as notificationsNode from "../notificationsNode.js";
import type * as prices from "../prices.js";
import type * as pricesHttp from "../pricesHttp.js";
import type * as profiles from "../profiles.js";
import type * as progressSessions from "../progressSessions.js";
import type * as status from "../status.js";
import type * as tradingJournal from "../tradingJournal.js";
import type * as tradingJournals from "../tradingJournals.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ResendOTPPasswordReset: typeof ResendOTPPasswordReset;
  admin: typeof admin;
  auth: typeof auth;
  authRateLimit: typeof authRateLimit;
  calculatorHistory: typeof calculatorHistory;
  http: typeof http;
  "lib/auth": typeof lib_auth;
  "lib/tradeValidation": typeof lib_tradeValidation;
  "lib/tradingAlerts": typeof lib_tradingAlerts;
  news: typeof news;
  newsHttp: typeof newsHttp;
  newsIngest: typeof newsIngest;
  notifications: typeof notifications;
  notificationsHttp: typeof notificationsHttp;
  notificationsNode: typeof notificationsNode;
  prices: typeof prices;
  pricesHttp: typeof pricesHttp;
  profiles: typeof profiles;
  progressSessions: typeof progressSessions;
  status: typeof status;
  tradingJournal: typeof tradingJournal;
  tradingJournals: typeof tradingJournals;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
