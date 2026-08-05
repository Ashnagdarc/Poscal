import { describe, expect, it } from "vitest";
import { extractBuildSignatureFromHtml, pickIndexEntry } from "@/lib/appVersion";

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

describe("pickIndexEntry", () => {
  it("picks the Vite entry chunk from a signature list", () => {
    expect(
      pickIndexEntry("/assets/react-vendor-abc.js|/assets/index-XYZ123.js|/assets/utils-1.js"),
    ).toBe("/assets/index-XYZ123.js");
  });

  it("returns null when no entry is present", () => {
    expect(pickIndexEntry("/assets/react-vendor-abc.js")).toBeNull();
  });
});
