import { describe, expect, it } from "vitest";

import {
  buildVerificationWelcomeEmail,
  buildWelcomeEmail,
  welcomeFirstName,
} from "../../convex/lib/welcomeEmailCopy";

describe("welcome email", () => {
  it("uses the first name in the subject and greeting", () => {
    const message = buildWelcomeEmail("Daniel Samuel");
    expect(welcomeFirstName("Daniel Samuel")).toBe("Daniel");
    expect(message.subject).toBe("Welcome to Poscal, Daniel");
    expect(message.text.startsWith("Hi Daniel,")).toBe(true);
    expect(message.html).toContain("Hi Daniel,");
  });

  it("uses the generic production greeting when no name is provided", () => {
    const message = buildWelcomeEmail("  ");
    expect(message.subject).toBe("Welcome to Poscal");
    expect(message.text.startsWith("Hi there,")).toBe(true);
  });

  it("escapes a name containing HTML without rendering the tag", () => {
    const message = buildWelcomeEmail("<script>");
    expect(message.html).toContain("Hi &lt;script&gt;,");
    expect(message.html).not.toContain("<script>");
  });

  it("links to the live app and describes browser installation", () => {
    const message = buildWelcomeEmail("Amina");
    expect(message.text).toContain("https://www.poscalfx.com");
    expect(message.text).toContain("Share or Install menu");
    expect(message.html).toContain('href="https://www.poscalfx.com"');
    expect(message.html).toContain("/email/poscal-email-header.jpg");
    expect(message.html).toContain("/email/poscal-email-footer.jpg");
  });

  it("includes the 8-digit verification code and 15-minute expiry", () => {
    const message = buildVerificationWelcomeEmail("Amina", "12345678", "Amina@Example.com");
    expect(message.subject).toBe("Welcome to Poscal, Amina — verify your email");
    expect(message.text).toContain("Your verification code is 12345678.");
    expect(message.text).toContain("This code expires in 15 minutes.");
    expect(message.text).toContain("verify-email?email=amina%40example.com");
    expect(message.html).toContain("12345678");
    expect(message.html).toContain("Enter verification code");
  });

  it("escapes untrusted recipient name in verification HTML", () => {
    const message = buildVerificationWelcomeEmail("<script>", "12345678", "example@example.com");
    expect(message.html).not.toContain("<script>");
    expect(message.html).toContain("Hi &lt;script&gt;,");
  });
});
