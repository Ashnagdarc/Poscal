import { describe, expect, it } from "vitest";
import {
  economicEventWrite,
  externalIdsKept,
} from "../../convex/lib/economicEventMerge";

describe("economic event ingest keep", () => {
  it("patches rows already stored and inserts only new external ids", () => {
    expect(economicEventWrite(true)).toBe("patch");
    expect(economicEventWrite(false)).toBe("insert");
  });

  it("keeps stored weeks that the current feed no longer includes", () => {
    const stored = ["ff-aug-nfp", "ff-aug-cpi", "ff-shared"];
    const incoming = ["ff-shared", "ff-oct-nfp"];

    expect(externalIdsKept(stored, incoming)).toEqual(["ff-aug-nfp", "ff-aug-cpi"]);

    const writes = incoming.map((id) => economicEventWrite(stored.includes(id)));
    expect(writes).toEqual(["patch", "insert"]);
  });
});
