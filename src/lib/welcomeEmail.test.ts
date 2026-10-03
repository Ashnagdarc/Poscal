import { describe, expect, it } from "vitest";

import { buildWelcomeEmail, welcomeFirstName } from "../../convex/lib/welcomeEmailCopy";

describe("welcome email", () => {
  it("uses the first name in the subject and greeting", () => {
    const message = buildWelcomeEmail("Daniel Samuel");
    expect(welcomeFirstName("Daniel Samuel")).toBe("Daniel");
    expect(message.subject).toBe("Welcome to Poscal, Daniel");
    expect(message.text.startsWith("Hey Daniel,")).toBe(true);
    expect(message.html).toContain("Hey Daniel,");
  });

  it("stays generic when no name was entered", () => {
    const message = buildWelcomeEmail("  ");
    expect(message.subject).toBe("Welcome to Poscal");
    expect(message.text.startsWith("Hey boss,")).toBe(true);
  });

  it("escapes a name that contains HTML", () => {
    const message = buildWelcomeEmail("<script>");
    expect(message.html).toContain("Hey &lt;script&gt;,");
    expect(message.html).not.toContain("<script>");
  });

  it("includes phone install steps and the app link", () => {
    const message = buildWelcomeEmail("Amina");
    expect(message.text).toContain("https://www.poscalfx.com");
    expect(message.text).toContain("Add to Home Screen");
    expect(message.text).toContain("Install app");
    expect(message.html).toContain('href="https://www.poscalfx.com"');
  });
});
