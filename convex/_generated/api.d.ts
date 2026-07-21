/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as auth from "../auth.js";
import type * as calculatorHistory from "../calculatorHistory.js";
import type * as http from "../http.js";
import type * as notifications from "../notifications.js";
import type * as notificationsHttp from "../notificationsHttp.js";
import type * as notificationsNode from "../notificationsNode.js";
import type * as prices from "../prices.js";
import type * as pricesHttp from "../pricesHttp.js";
import type * as profiles from "../profiles.js";
import type * as progressSessions from "../progressSessions.js";
import type * as signals from "../signals.js";
import type * as status from "../status.js";
import type * as tradingJournal from "../tradingJournal.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  auth: typeof auth;
  calculatorHistory: typeof calculatorHistory;
  http: typeof http;
  notifications: typeof notifications;
  notificationsHttp: typeof notificationsHttp;
  notificationsNode: typeof notificationsNode;
  prices: typeof prices;
  pricesHttp: typeof pricesHttp;
  profiles: typeof profiles;
  progressSessions: typeof progressSessions;
  signals: typeof signals;
  status: typeof status;
  tradingJournal: typeof tradingJournal;
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
