import { describe, expect, it } from "vitest";
import { extractBuildSignatureFromHtml } from "@/lib/appVersion";

describe("extractBuildSignatureFromHtml", () => {
  it("collects hashed asset paths from an index shell", () => {
    const html = `
      <!doctype html>
      <html><head>
        <link rel="modulepreload" href="/assets/react-vendor-abc.js" />
        <script type="module" src="/assets/index-XYZ123.js"></script>
      </head></html>
    `;
    expect(extractBuildSignatureFromHtml(html)).toBe(
      "/assets/index-XYZ123.js|/assets/react-vendor-abc.js",
    );
  });

  it("treats different entry hashes as different signatures", () => {
    const a = extractBuildSignatureFromHtml(
      `<script type="module" src="/assets/index-AAA.js"></script>`,
    );
    const b = extractBuildSignatureFromHtml(
      `<script type="module" src="/assets/index-BBB.js"></script>`,
    );
    expect(a).not.toBe(b);
  });
});
