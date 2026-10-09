const BREVO_EMAIL_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

export const DEFAULT_EMAIL_FROM = "Poscal <noreply@mail.poscalfx.com>";

type BrevoSender = {
  email: string;
  name?: string;
};

export type BrevoEmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
  from?: string | null;
  idempotencySource?: string;
  tags?: string[];
};

export class BrevoEmailError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
    this.name = "BrevoEmailError";
  }
}

export function parseEmailSender(value: string): BrevoSender {
  const trimmed = value.trim();
  const match = trimmed.match(/^(.+?)\s*<([^<>\s]+@[^<>\s]+)>$/);
  if (match) {
    return {
      name: match[1].trim().replace(/^['"]|['"]$/g, ""),
      email: match[2].trim().toLowerCase(),
    };
  }
  return { email: trimmed.toLowerCase() };
}

export async function deterministicUuid(source: string): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source)),
  );
  digest[6] = (digest[6] & 0x0f) | 0x40;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  const hex = Array.from(digest.slice(0, 16), (byte) => byte.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-");
}

export async function sendBrevoEmail(message: BrevoEmailMessage): Promise<string | null> {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  if (!apiKey) {
    throw new BrevoEmailError("BREVO_API_KEY is not configured", null);
  }

  const sender = parseEmailSender(
    message.from?.trim() || process.env.EMAIL_FROM?.trim() || DEFAULT_EMAIL_FROM,
  );
  const headers = message.idempotencySource
    ? { "Idempotency-Key": await deterministicUuid(message.idempotencySource) }
    : undefined;

  const response = await fetch(BREVO_EMAIL_ENDPOINT, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      sender,
      to: [{ email: message.to.trim().toLowerCase() }],
      subject: message.subject,
      textContent: message.text,
      htmlContent: message.html,
      ...(headers ? { headers } : {}),
      ...(message.tags?.length ? { tags: message.tags } : {}),
    }),
  });

  if (!response.ok) {
    console.error(`[brevo] transactional email request failed: ${response.status}`);
    if (response.status === 429 || response.status === 402) {
      throw new BrevoEmailError(
        "Email sending is temporarily unavailable because of a rate limit or quota.",
        response.status,
      );
    }
    throw new BrevoEmailError("Could not send email. Please try again later.", response.status);
  }

  const payload: unknown = await response.json().catch(() => null);
  if (
    payload
    && typeof payload === "object"
    && "messageId" in payload
    && typeof payload.messageId === "string"
  ) {
    return payload.messageId;
  }
  return null;
}
