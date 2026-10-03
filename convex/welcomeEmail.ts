import { v } from "convex/values";

import { internalAction } from "./_generated/server";
import { buildWelcomeEmail } from "./lib/welcomeEmailCopy";

export const sendWelcome = internalAction({
  args: {
    email: v.string(),
    name: v.string(),
  },
  handler: async (_ctx, args) => {
    const email = args.email.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      console.error("[welcome] skipped, missing email");
      return { sent: false as const };
    }

    const apiKey = process.env.AUTH_RESEND_KEY ?? process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error("[welcome] RESEND_API_KEY is not configured");
      return { sent: false as const };
    }

    const from = process.env.EMAIL_FROM?.trim() || "Poscal <noreply@poscalfx.com>";
    const message = buildWelcomeEmail(args.name);

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      console.error(`[welcome] Resend request failed: ${status}`);
      if (status === 429 || status >= 500) {
        throw new Error(`Could not send welcome email (${status})`);
      }
      return { sent: false as const };
    }

    return { sent: true as const };
  },
});
