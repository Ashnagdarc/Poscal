import Resend from "@auth/core/providers/resend";
import { Resend as ResendAPI } from "resend";
import { RandomReader, generateRandomString } from "@oslojs/crypto/random";

/**
 * Convex Auth password-reset email provider (OTP via Resend).
 * Env: RESEND_API_KEY (or AUTH_RESEND_KEY), optional EMAIL_FROM.
 * Docs: https://labs.convex.dev/auth/config/passwords#email-reset-setup
 */
export const ResendOTPPasswordReset = Resend({
  id: "resend-otp",
  apiKey: process.env.AUTH_RESEND_KEY ?? process.env.RESEND_API_KEY,
  async generateVerificationToken() {
    const random: RandomReader = {
      read(bytes) {
        crypto.getRandomValues(bytes);
      },
    };
    return generateRandomString(random, "0123456789", 8);
  },
  async sendVerificationRequest({ identifier: email, provider, token }) {
    const apiKey = provider.apiKey;
    if (!apiKey) {
      throw new Error(
        "Password reset email is not configured. Set RESEND_API_KEY (or AUTH_RESEND_KEY) in Convex env.",
      );
    }

    const from =
      process.env.EMAIL_FROM?.trim()
      || "Poscal <noreply@poscalfx.com>";

    const resend = new ResendAPI(apiKey);
    const { error } = await resend.emails.send({
      from,
      to: [email],
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
    });

    if (error) {
      console.error("[auth] Failed to send password reset email", error);
      throw new Error("Could not send password reset email. Please try again later.");
    }
  },
});
