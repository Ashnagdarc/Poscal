import { afterEach, describe, expect, it, vi } from "vitest";

import {
  BrevoEmailError,
  deterministicUuid,
  parseEmailSender,
  sendBrevoEmail,
} from "../../convex/lib/brevoEmail";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Brevo email delivery", () => {
  it("parses a named sender", () => {
    expect(parseEmailSender("Poscal <noreply@mail.poscalfx.com>")).toEqual({
      name: "Poscal",
      email: "noreply@mail.poscalfx.com",
    });
  });

  it("creates a stable UUID for retry idempotency", async () => {
    const first = await deterministicUuid("notification:abc");
    const second = await deterministicUuid("notification:abc");
    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("sends the Brevo transactional payload without exposing the key in the body", async () => {
    vi.stubEnv("BREVO_API_KEY", "xkeysib-test-secret");
    vi.stubEnv("EMAIL_FROM", "Poscal <noreply@mail.poscalfx.com>");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ messageId: "message-1" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendBrevoEmail({
      to: "Trader@Example.com",
      subject: "Verify",
      text: "Code: 12345678",
      html: "<p>Code: 12345678</p>",
      tags: ["email-verification"],
    })).resolves.toBe("message-1");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({ "api-key": "xkeysib-test-secret" });
    const body = JSON.parse(String(init.body));
    expect(body.to).toEqual([{ email: "trader@example.com" }]);
    expect(body.sender).toEqual({ name: "Poscal", email: "noreply@mail.poscalfx.com" });
    expect(String(init.body)).not.toContain("xkeysib-test-secret");
  });

  it("maps provider quota failures to a safe error", async () => {
    vi.stubEnv("BREVO_API_KEY", "xkeysib-test-secret");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("quota", { status: 429 })));
    await expect(sendBrevoEmail({
      to: "trader@example.com",
      subject: "Verify",
      text: "Code",
      html: "<p>Code</p>",
    })).rejects.toEqual(expect.objectContaining<Partial<BrevoEmailError>>({ status: 429 }));
  });
});
