import { Email } from "@convex-dev/auth/providers/Email";
import type {
  EmailConfig,
  GenericActionCtxWithAuthConfig,
} from "@convex-dev/auth/server";
import { RandomReader, generateRandomString } from "@oslojs/crypto/random";

import type { DataModel } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { sendBrevoEmail } from "./lib/brevoEmail";

type EmailRequest = Parameters<EmailConfig["sendVerificationRequest"]>[0];

const sendVerificationRequest = async (
  { identifier: email, token }: EmailRequest,
  ctx?: GenericActionCtxWithAuthConfig<DataModel>,
) => {
  if (!ctx) {
    throw new Error("Password reset email context is unavailable");
  }
  const limit = await ctx.runMutation(internal.authRateLimit.consumeEmailSend, {
    kind: "reset",
    email,
  });
  if (!limit.ok) {
    throw new Error("Too many password reset emails. Please wait and try again.");
  }

  await sendBrevoEmail({
    to: email,
    subject: "Reset your Poscal password",
    text:
      `Your Poscal password reset code is ${token}.\n\n`
      + `Enter this code with your new password on the reset screen.\n`
      + `If you did not request a reset, you can ignore this email.`,
    html:
      `<p>Your Poscal password reset code is:</p>`
      + `<p style="font-size:24px;font-weight:700;letter-spacing:0.2em">${token}</p>`
      + `<p>Enter this code with your new password on the reset screen.</p>`
      + `<p>If you did not request a reset, you can ignore this email.</p>`,
    tags: ["password-reset"],
  });
};

/** Convex Auth password-reset OTP delivered through Brevo. */
export const BrevoOTPPasswordReset = Email({
  id: "brevo-otp-reset",
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
