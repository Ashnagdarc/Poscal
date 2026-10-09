const APP_URL = "https://www.poscalfx.com";
const EMAIL_ASSET_URL = `${APP_URL}/email`;

export type WelcomeEmail = {
  subject: string;
  text: string;
  html: string;
};

type AccountEmailOptions = {
  verificationToken?: string;
  recipientEmail?: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** First word of the name they typed, or null when sign-up left the name blank. */
export function welcomeFirstName(raw: string): string | null {
  const cleaned = raw.replace(/[\u0000-\u001F]/g, "").replace(/\s+/g, " ").trim();
  if (!cleaned || cleaned.includes("@")) {
    return null;
  }
  const first = cleaned.split(" ")[0] ?? "";
  if (!first || first.length > 40) {
    return null;
  }
  return first;
}

function buildAccountEmail(
  rawName: string,
  options: AccountEmailOptions = {},
): WelcomeEmail {
  const firstName = welcomeFirstName(rawName);
  const token = options.verificationToken?.replace(/\D/g, "").slice(0, 8) ?? "";
  const isVerification = token.length === 8;
  const recipientEmail = options.recipientEmail?.trim().toLowerCase() ?? "";
  const verificationUrl = recipientEmail
    ? `${APP_URL}/verify-email?email=${encodeURIComponent(recipientEmail)}`
    : `${APP_URL}/verify-email`;
  const actionUrl = isVerification ? verificationUrl : APP_URL;
  const subject = isVerification
    ? firstName
      ? `Welcome to Poscal, ${firstName} — verify your email`
      : "Welcome to Poscal — verify your email"
    : firstName
      ? `Welcome to Poscal, ${firstName}`
      : "Welcome to Poscal";
  const greeting = firstName ? `Hi ${firstName},` : "Hi there,";
  const safeGreeting = escapeHtml(greeting);

  const text = isVerification
    ? [
        greeting,
        "",
        "Welcome to Poscal. Confirm your email to unlock your journal.",
        "",
        `Your verification code is ${token}.`,
        "This code expires in 15 minutes.",
        "",
        `Enter your code: ${verificationUrl}`,
        "",
        "If you didn't create this account, you can ignore this email.",
        "",
        "Poscal",
        "info@poscalfx.com",
      ].join("\n")
    : [
        greeting,
        "",
        "Your Poscal account is ready.",
        "",
        `Open Poscal: ${APP_URL}`,
        "",
        "You can install Poscal from your browser's Share or Install menu whenever you're ready.",
        "",
        "Poscal",
        "info@poscalfx.com",
      ].join("\n");

  const preheader = isVerification
    ? `Your Poscal verification code is ${token}. It expires in 15 minutes.`
    : "Your Poscal account is ready.";
  const heading = isVerification ? "Confirm your email." : "Your journal is ready.";
  const intro = isVerification
    ? "Use the code below to finish setting up your account and unlock your journal."
    : "Size your trades, record your thinking, and review your progress in one focused place.";
  const actionLabel = isVerification ? "Enter verification code" : "Open Poscal";

  const verificationBlock = isVerification
    ? `<tr>
                    <td style="padding:30px 0 0;">
                      <div style="border:1px solid #dfe5e2;background:#f4f8f6;border-radius:20px;padding:26px 20px;text-align:center;">
                        <div style="font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,'Liberation Mono',monospace;font-size:36px;line-height:1;font-weight:650;letter-spacing:0.22em;color:#17201d;white-space:nowrap;">${escapeHtml(token)}</div>
                        <div style="padding-top:12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:13px;line-height:1.5;color:#6f7774;">Expires in 15 minutes</div>
                      </div>
                    </td>
                  </tr>`
    : "";

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f5f5f7;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;background:#f5f5f7;">
      <tr>
        <td align="center" style="padding:34px 14px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;">
            <tr>
              <td style="overflow:hidden;border-radius:28px;background:#ffffff;box-shadow:0 8px 30px rgba(23,32,29,0.06);">
                <img src="${EMAIL_ASSET_URL}/poscal-email-header.jpg" width="600" alt="" style="display:block;width:100%;height:auto;border:0;" />
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;">
                  <tr>
                    <td style="padding:42px 42px 38px;">
                      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:12px;line-height:1;font-weight:700;letter-spacing:0.2em;color:#1f7a6c;">POSCAL</div>
                      <div style="padding-top:32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:16px;line-height:1.5;color:#69716e;">${safeGreeting}</div>
                      <h1 style="margin:8px 0 0;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Arial,sans-serif;font-size:34px;line-height:1.12;font-weight:650;letter-spacing:-0.035em;color:#17201d;">${heading}</h1>
                      <p style="margin:16px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:16px;line-height:1.6;color:#59615e;">${intro}</p>
                      ${verificationBlock}
                      <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:30px;">
                        <tr>
                          <td bgcolor="#17201d" style="border-radius:999px;">
                            <a href="${escapeHtml(actionUrl)}" style="display:inline-block;padding:14px 23px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:15px;line-height:1;font-weight:650;color:#ffffff;text-decoration:none;">${actionLabel}</a>
                          </td>
                        </tr>
                      </table>
                      <p style="margin:18px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:12px;line-height:1.6;color:#858c89;">${isVerification ? "The button opens the secure code-entry screen with your email already filled in." : "Install Poscal later from your browser's Share or Install menu."}</p>
                    </td>
                  </tr>
                </table>
                <img src="${EMAIL_ASSET_URL}/poscal-email-footer.jpg" width="600" alt="" style="display:block;width:100%;height:auto;border:0;" />
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:22px 24px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:12px;line-height:1.6;color:#8a918e;">
                If you didn't create this account, you can ignore this email.<br />
                Poscal · <a href="mailto:info@poscalfx.com" style="color:#69716e;text-decoration:none;">info@poscalfx.com</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
}

export function buildWelcomeEmail(rawName: string): WelcomeEmail {
  return buildAccountEmail(rawName);
}

export function buildVerificationWelcomeEmail(
  rawName: string,
  verificationToken: string,
  recipientEmail: string,
): WelcomeEmail {
  return buildAccountEmail(rawName, {
    verificationToken,
    recipientEmail,
  });
}
