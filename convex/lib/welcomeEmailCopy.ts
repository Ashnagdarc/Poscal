const APP_URL = "https://www.poscalfx.com";

export type WelcomeEmail = {
  subject: string;
  text: string;
  html: string;
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
  const cleaned = Array.from(raw).filter(char => char.charCodeAt(0) > 31).join("").replace(/\s+/g, " ").trim();
  if (!cleaned || cleaned.includes("@")) {
    return null;
  }
  const first = cleaned.split(" ")[0] ?? "";
  if (!first || first.length > 40) {
    return null;
  }
  return first;
}

export function buildWelcomeEmail(rawName: string): WelcomeEmail {
  const firstName = welcomeFirstName(rawName);
  const subject = firstName ? `Welcome to Poscal, ${firstName}` : "Welcome to Poscal";
  const greeting = firstName ? `Hey ${firstName},` : "Hey boss,";
  const safeGreeting = escapeHtml(greeting);

  const text = [
    greeting,
    "",
    "Your account is ready. Poscal is where you size a trade, write it down, and check what is on the calendar.",
    "",
    `Open Poscal: ${APP_URL}`,
    "",
    "Put it on your phone",
    "",
    "iPhone (Safari)",
    "1. Open www.poscalfx.com in Safari.",
    "2. Tap Share.",
    "3. Tap Add to Home Screen.",
    "4. Tap Add.",
    "",
    "Android (Chrome)",
    "1. Open www.poscalfx.com in Chrome.",
    "2. Tap the three-dot menu.",
    "3. Tap Install app. If you don't see that, tap Add to Home screen.",
    "4. Tap Install.",
    "",
    "The icon on your home screen opens Poscal like an app. You can also keep using it in the browser.",
    "",
    "If you didn't create this account, you can ignore this email.",
    "",
    "Poscal",
    "info@poscalfx.com",
  ].join("\n");

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f6f5;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f5;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;padding:32px 28px;font-family:Georgia, 'Times New Roman', serif;color:#1c2422;">
            <tr>
              <td style="font-family:Arial, Helvetica, sans-serif;font-size:13px;letter-spacing:0.18em;font-weight:700;color:#22796c;">POSCAL</td>
            </tr>
            <tr>
              <td style="padding-top:20px;font-size:28px;line-height:1.3;">${safeGreeting}</td>
            </tr>
            <tr>
              <td style="padding-top:12px;font-family:Arial, Helvetica, sans-serif;font-size:16px;line-height:1.5;color:#3d4744;">
                Your account is ready. Poscal is where you size a trade, write it down, and check what is on the calendar.
              </td>
            </tr>
            <tr>
              <td style="padding-top:24px;">
                <a href="${APP_URL}" style="display:inline-block;background:#22796c;color:#ffffff;font-family:Arial, Helvetica, sans-serif;font-size:15px;font-weight:700;text-decoration:none;padding:12px 20px;border-radius:999px;">Open Poscal</a>
              </td>
            </tr>
            <tr>
              <td style="padding-top:32px;font-family:Arial, Helvetica, sans-serif;font-size:18px;font-weight:700;color:#1c2422;">Put it on your phone</td>
            </tr>
            <tr>
              <td style="padding-top:16px;font-family:Arial, Helvetica, sans-serif;font-size:14px;line-height:1.5;color:#3d4744;">
                <strong style="color:#1c2422;">iPhone (Safari)</strong><br />
                1. Open www.poscalfx.com in Safari.<br />
                2. Tap Share.<br />
                3. Tap Add to Home Screen.<br />
                4. Tap Add.
              </td>
            </tr>
            <tr>
              <td style="padding-top:16px;font-family:Arial, Helvetica, sans-serif;font-size:14px;line-height:1.5;color:#3d4744;">
                <strong style="color:#1c2422;">Android (Chrome)</strong><br />
                1. Open www.poscalfx.com in Chrome.<br />
                2. Tap the three-dot menu.<br />
                3. Tap Install app. If you don't see that, tap Add to Home screen.<br />
                4. Tap Install.
              </td>
            </tr>
            <tr>
              <td style="padding-top:16px;font-family:Arial, Helvetica, sans-serif;font-size:14px;line-height:1.5;color:#3d4744;">
                The icon on your home screen opens Poscal like an app. You can also keep using it in the browser.
              </td>
            </tr>
            <tr>
              <td style="padding-top:28px;border-top:1px solid #e4eae8;font-family:Arial, Helvetica, sans-serif;font-size:12px;line-height:1.5;color:#6b7572;">
                If you didn't create this account, you can ignore this email.<br />
                Poscal · info@poscalfx.com
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
