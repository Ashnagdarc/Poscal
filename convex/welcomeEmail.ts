import { v } from "convex/values";

import { internalAction } from "./_generated/server";
import { sendBrevoEmail } from "./lib/brevoEmail";
import { buildWelcomeEmail } from "./lib/welcomeEmailCopy";

export const sendWelcome = internalAction({
  args: {
    email: v.string(),
    name: v.string(),
  },
  returns: v.object({ sent: v.boolean() }),
  handler: async (_ctx, args) => {
    const email = args.email.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      console.error("[welcome] skipped, missing email");
      return { sent: false as const };
    }

    const message = buildWelcomeEmail(args.name);
    await sendBrevoEmail({
      to: email,
      subject: message.subject,
      text: message.text,
      html: message.html,
      idempotencySource: `welcome:${email}`,
      tags: ["welcome"],
    });
    return { sent: true as const };
  },
});
