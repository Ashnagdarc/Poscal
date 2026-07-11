"use node";

import webpush from "web-push";
import { v } from "convex/values";

import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

const DEFAULT_BATCH_LIMIT = 50;
const DEFAULT_STALE_AFTER_MS = 5 * 60 * 1000;

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

function buildHtmlEmail(title: string, body: string) {
  const escapedTitle = title
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

  const lines = body
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p>${line.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</p>`)
    .join("");

  return `<!doctype html><html><body><h2>${escapedTitle}</h2>${lines || "<p>No message body.</p>"}</body></html>`;
}

async function sendEmail(
  to: string,
  subject: string,
  body: string,
  html: string | null,
  fromEmail: string | null,
) {
  const resendApiKey = getRequiredEnv("RESEND_API_KEY");
  const sender = fromEmail ?? getOptionalEnv("EMAIL_FROM") ?? "Poscal <noreply@poscalfx.com>";

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${resendApiKey}`,
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

export const processPendingBatch = internalAction({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args: { limit?: number }) => {
    configureWebPush();

    const claimed = await ctx.runMutation(internal.notifications.claimPendingBatch, {
      limit: Math.max(1, Math.min(args.limit ?? DEFAULT_BATCH_LIMIT, 100)),
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

    const subscriptionCache = new Map<string, Awaited<ReturnType<typeof ctx.runQuery>>>();
    const emailCache = new Map<string, string | null>();

    for (const notification of claimed as QueuedNotification[]) {
      try {
        if (notification.channel === "push") {
          const cacheKey = notification.userId ?? "__broadcast__";
          let subscriptions = subscriptionCache.get(cacheKey);
          if (!subscriptions) {
            subscriptions = await ctx.runQuery(internal.notifications.listActivePushSubscriptions, {
              userId: notification.userId ?? null,
            });
            subscriptionCache.set(cacheKey, subscriptions);
          }

          if (!subscriptions.length) {
            throw new Error("No active push subscriptions");
          }

          const payload = JSON.stringify({
            title: notification.title,
            body: notification.body,
            tag: notification.tag ?? "general",
            data: notification.data ?? {},
            icon: "/pwa-192x192.png",
            badge: "/favicon.png",
          });

          let successCount = 0;
          const errors: string[] = [];

          for (const subscription of subscriptions) {
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
              successCount += 1;
            } catch (error) {
              const message = error instanceof Error ? error.message : "Unknown push send error";
              errors.push(message);
              const statusCode = typeof error === "object" && error && "statusCode" in error
                ? Number((error as { statusCode?: unknown }).statusCode)
                : undefined;
              if (statusCode === 404 || statusCode === 410) {
                const deactivated = await ctx.runMutation(internal.notifications.markSubscriptionInactive, {
                  id: subscription._id,
                });
                if (deactivated.success) {
                  summary.deactivatedSubscriptions += 1;
                }
              }
            }
          }

          if (successCount === 0) {
            throw new Error(errors[0] ?? "All push deliveries failed");
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
          await sendEmail(recipientEmail, notification.title, notification.body, html, fromEmail);

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
        });
        summary.failed += 1;
        summary.errors.push({ id: String(notification._id), message });
      }
    }

    return summary;
  },
});
