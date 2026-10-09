import { Email } from "@convex-dev/auth/providers/Email";
import type {
  EmailConfig,
  GenericActionCtxWithAuthConfig,
} from "@convex-dev/auth/server";
import { RandomReader, generateRandomString } from "@oslojs/crypto/random";

import type { DataModel } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { sendBrevoEmail } from "./lib/brevoEmail";
import { buildVerificationWelcomeEmail } from "./lib/welcomeEmailCopy";

type EmailRequest = Parameters<EmailConfig["sendVerificationRequest"]>[0];

const sendVerificationRequest = async (
  { identifier: email, token }: EmailRequest,
  ctx?: GenericActionCtxWithAuthConfig<DataModel>,
) => {
  if (!ctx) {
    throw new Error("Verification email context is unavailable");
  }
  const recipient = await ctx.runQuery(internal.authRateLimit.verificationRecipient, {
    email,
  });
  if (recipient.alreadyVerified) {
    return;
  }

  const limit = await ctx.runMutation(internal.authRateLimit.consumeEmailSend, {
    kind: "verification",
    email,
  });
  if (!limit.ok) {
    throw new Error("Too many verification emails. Please wait and try again.");
  }

  const message = buildVerificationWelcomeEmail(recipient.name, token, email);
  await sendBrevoEmail({
    to: email,
    subject: message.subject,
    text: message.text,
    html: message.html,
    tags: ["email-verification", "welcome"],
  });
};

/** Convex Auth email-verification OTP delivered through Brevo. */
export const BrevoOTP = Email({
  id: "brevo-otp-verify",
  maxAge: 15 * 60,
  async generateVerificationToken() {
    const random: RandomReader = {
      read(bytes) {
        crypto.getRandomValues(bytes);
      },
    };
    return generateRandomString(random, "0123456789", 8);
  },
  // Convex Auth supplies its action context as a runtime second argument even
  // though Auth.js's public email-provider type declares only the first one.
  sendVerificationRequest,
});
