"use node";

import webpush from "web-push";
import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { classifyPushFailure, NOTIFICATION_BATCH_LIMIT, shouldDrainAnotherBatch } from "./lib/notificationStaging";
import { internalAction } from "./_generated/server";

const DEFAULT_BATCH_LIMIT = NOTIFICATION_BATCH_LIMIT;
const DEFAULT_STALE_AFTER_MS = 5 * 60 * 1000;

type BatchSummary = {
  claimed: number;
  sent: number;
  failed: number;
  pushSent: number;
  emailSent: number;
  deactivatedSubscriptions: number;
  errors: Array<{ id: string; message: string }>;
};

type QueuedNotification = {
  _id: any;
  userId?: string | null;
  channel: "push" | "email" | "in_app";
  title: string;
  body: string;
  recipientEmail?: string | null;
  tag?: string | null;
  data?: any;
};

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

function getOptionalEnv(name: string) {
  return process.env[name] ?? null;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildHtmlEmail(title: string, body: string) {
  const escapedTitle = escapeHtml(title);

  const lines = body
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("");

  return `<!doctype html><html><body><h2>${escapedTitle}</h2>${lines || "<p>No message body.</p>"}</body></html>`;
}

async function sendEmail(
  to: string,
  subject: string,
  body: string,
  html: string | null,
  fromEmail: string | null,
  idempotencyKey: string,
) {
  const resendApiKey = getRequiredEnv("RESEND_API_KEY");
  const sender = fromEmail ?? getOptionalEnv("EMAIL_FROM") ?? "Poscal <noreply@poscalfx.com>";

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${resendApiKey}`,
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      from: sender,
      to,
      subject,
      html: html ?? buildHtmlEmail(subject, body),
      text: body,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Resend request failed: ${response.status} ${errorBody}`);
  }
}

function configureWebPush() {
  webpush.setVapidDetails(
    getOptionalEnv("VAPID_SUBJECT") ?? "mailto:info@poscalfx.com",
    getRequiredEnv("VAPID_PUBLIC_KEY"),
    getRequiredEnv("VAPID_PRIVATE_KEY"),
  );
}

function pushStatusCode(error: unknown): number | null {
  if (typeof error === "object" && error && "statusCode" in error) {
    const statusCode = Number((error as { statusCode?: unknown }).statusCode);
    return Number.isFinite(statusCode) ? statusCode : null;
  }
  return null;
}

function clientPushData(data: Record<string, unknown> | null): Record<string, unknown> {
  if (!data) return {};
  const clientData = { ...data };
  delete clientData.subscriptionId;
  delete clientData.displayTag;
  delete clientData.html;
  delete clientData.fromEmail;
  return clientData;
}

function isRetryableNotificationError(message: string): boolean {
  if (/No active push subscription|missing a device|No recipient email|Unsupported notification channel/i.test(message)) {
    return false;
  }
  if (/\b404\b|\b410\b/i.test(message)) {
    return false;
  }
  return true;
}

export const processPendingBatch = internalAction({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args: { limit?: number }): Promise<BatchSummary> => {
    let webPushReady = true;
    try {
      configureWebPush();
    } catch (error) {
      webPushReady = false;
      console.error(
        "Push disabled for this batch; email will still send.",
        error instanceof Error ? error.message : "VAPID configuration failed",
      );
    }

    const limit = Math.max(1, Math.min(args.limit ?? DEFAULT_BATCH_LIMIT, 100));
    const claimed = await ctx.runMutation(internal.notifications.claimPendingBatch, {
      limit,
      staleAfterMs: DEFAULT_STALE_AFTER_MS,
    });

    const summary = {
      claimed: claimed.length,
      sent: 0,
      failed: 0,
      pushSent: 0,
      emailSent: 0,
      deactivatedSubscriptions: 0,
      errors: [] as Array<{ id: string; message: string }>,
    };

    const emailCache = new Map<string, string | null>();

    for (const notification of claimed as QueuedNotification[]) {
      try {
        if (notification.data?.billingOrderId && notification.data?.billingKind) {
          const relevant = await ctx.runQuery(internal.proBilling.notificationStillRelevant, {
            id: notification.data.billingOrderId as Id<"proOrders">, kind: notification.data.billingKind,
          });
          if (!relevant) {
            await ctx.runMutation(internal.notifications.finalizeNotification, { id: notification._id, status: "sent", errorMessage: "Suppressed: superseded billing status" });
            continue;
          }
        }
        if (notification.channel === "push") {
          if (!webPushReady) {
            throw new Error("VAPID keys are not configured");
          }

          const subscriptionId =
            typeof notification.data?.subscriptionId === "string" ? notification.data.subscriptionId : null;
          if (!subscriptionId) {
            throw new Error("Push delivery is missing a device");
          }

          const subscription = await ctx.runQuery(internal.notifications.getPushSubscription, {
            id: subscriptionId as Id<"pushSubscriptions">,
          });
          if (!subscription) {
            throw new Error("No active push subscription");
          }

          const displayTag =
            typeof notification.data?.displayTag === "string"
              ? notification.data.displayTag
              : (notification.tag ?? "general");
          const payload = JSON.stringify({
            title: notification.title,
            body: notification.body,
            tag: displayTag,
            data: clientPushData(notification.data ?? null),
            icon: "/pwa-192x192.png",
            badge: "/favicon.png",
          });

          try {
            await webpush.sendNotification(
              {
                endpoint: subscription.endpoint,
                keys: {
                  p256dh: subscription.p256dhKey,
                  auth: subscription.authKey,
                },
              },
              payload,
            );
          } catch (error) {
            const statusCode = pushStatusCode(error);
            if (classifyPushFailure(statusCode) === "gone") {
              const deactivated = await ctx.runMutation(internal.notifications.markSubscriptionInactive, {
                id: subscription._id,
              });
              if (deactivated.success) {
                summary.deactivatedSubscriptions += 1;
              }
              throw new Error(`Push subscription gone (${statusCode ?? "unknown"})`);
            }
            throw error;
          }

          await ctx.runMutation(internal.notifications.finalizeNotification, {
            id: notification._id,
            status: "sent",
            errorMessage: null,
          });
          summary.sent += 1;
          summary.pushSent += 1;
          continue;
        }

        if (notification.channel === "email") {
          let recipientEmail = notification.recipientEmail ?? null;
          if (!recipientEmail && notification.userId) {
            if (!emailCache.has(notification.userId)) {
              emailCache.set(
                notification.userId,
                await ctx.runQuery(internal.notifications.getUserEmail, { userId: notification.userId }),
              );
            }
            recipientEmail = emailCache.get(notification.userId) ?? null;
          }

          if (!recipientEmail) {
            throw new Error("No recipient email resolved");
          }

          const html = typeof notification.data?.html === "string" ? notification.data.html : null;
          const fromEmail = typeof notification.data?.fromEmail === "string" ? notification.data.fromEmail : null;
          await sendEmail(recipientEmail, notification.title, notification.body, html, fromEmail, `notification-${notification._id}`);

          await ctx.runMutation(internal.notifications.finalizeNotification, {
            id: notification._id,
            status: "sent",
            errorMessage: null,
          });
          summary.sent += 1;
          summary.emailSent += 1;
          continue;
        }

        throw new Error(`Unsupported notification channel: ${notification.channel}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown notification processing error";
        await ctx.runMutation(internal.notifications.finalizeNotification, {
          id: notification._id,
          status: "failed",
          errorMessage: message,
          retryable: isRetryableNotificationError(message),
        });
        summary.failed += 1;
        summary.errors.push({ id: String(notification._id), message });
      }
    }

    if (shouldDrainAnotherBatch(claimed.length, limit)) {
      await ctx.scheduler.runAfter(0, internal.notificationsNode.processPendingBatch, { limit });
    }

    return summary;
  },
});
