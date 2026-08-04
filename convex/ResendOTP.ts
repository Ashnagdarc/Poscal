import Resend from "@auth/core/providers/resend";
import { Resend as ResendAPI } from "resend";
import { RandomReader, generateRandomString } from "@oslojs/crypto/random";

/**
 * Convex Auth email-verification OTP (Password `verify` provider) via Resend.
 * Wired only when REQUIRE_EMAIL_VERIFICATION is truthy (see convex/auth.ts).
 * Soft mode (default) omits Password `verify` so free-tier Resend failures cannot
 * lock users out; this module stays ready to re-enable without a rewrite.
 *
 * Env: RESEND_API_KEY (or AUTH_RESEND_KEY), optional EMAIL_FROM,
 *      REQUIRE_EMAIL_VERIFICATION (default off).
 * Docs: https://labs.convex.dev/auth/config/passwords#email-verification-setup
 *
 * Provider id must differ from password-reset (`resend-otp`).
 */
export const ResendOTP = Resend({
  id: "resend-otp-verify",
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
        "Verification email is not configured. Set RESEND_API_KEY (or AUTH_RESEND_KEY) in Convex env.",
      );
    }

    const from =
      process.env.EMAIL_FROM?.trim()
      || "Poscal <noreply@poscalfx.com>";

    const resend = new ResendAPI(apiKey);
    const { error } = await resend.emails.send({
      from,
      to: [email],
      subject: "Verify your Poscal email",
      text:
        `Your Poscal verification code is ${token}.\n\n`
        + `Enter this code to confirm your email and finish signing in.\n`
        + `If you did not create a Poscal account, you can ignore this email.`,
      html:
        `<p>Your Poscal verification code is:</p>`
        + `<p style="font-size:24px;font-weight:700;letter-spacing:0.2em">${token}</p>`
        + `<p>Enter this code to confirm your email and finish signing in.</p>`
        + `<p>If you did not create a Poscal account, you can ignore this email.</p>`,
    });

    if (error) {
      console.error("[auth] Failed to send verification email", error);
      throw new Error("Could not send verification email. Please try again later.");
    }
  },
});
