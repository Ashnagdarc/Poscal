import { afterEach, describe, expect, it, vi } from "vitest";

import {
  BrevoContactError,
  deleteBrevoContact,
  resolveBrevoContactListId,
  splitBrevoContactName,
  upsertBrevoContact,
} from "../../convex/lib/brevoContacts";

describe("Brevo contact synchronization", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses the Poscal contact list by default", () => {
    expect(resolveBrevoContactListId(undefined)).toBe(2);
    expect(resolveBrevoContactListId(" 7 ")).toBe(7);
    expect(() => resolveBrevoContactListId("invalid")).toThrow(BrevoContactError);
  });

  it("splits a display name into Brevo contact attributes", () => {
    expect(splitBrevoContactName("Ada Lovelace")).toEqual({
      firstName: "Ada",
      lastName: "Lovelace",
    });
    expect(splitBrevoContactName("Prince")).toEqual({ firstName: "Prince" });
    expect(splitBrevoContactName(null)).toEqual({});
  });

  it("upserts a normalized contact with a stable Poscal id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));

    await expect(upsertBrevoContact("secret", {
      email: " Trader@Example.com ",
      externalUserId: "user_123",
      fullName: "Ada Lovelace",
      listId: 2,
    }, fetchMock)).resolves.toBe("created");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.brevo.com/v3/contacts",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          email: "trader@example.com",
          attributes: {
            EXT_ID: "user_123",
            FIRSTNAME: "Ada",
            LASTNAME: "Lovelace",
          },
          listIds: [2],
          updateEnabled: true,
        }),
      }),
    );
  });

  it("marks transient Brevo failures as retryable", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 429 }));
    const result = upsertBrevoContact("secret", {
      email: "trader@example.com",
      externalUserId: "user_123",
    }, fetchMock);

    await expect(result).rejects.toMatchObject({ status: 429, retryable: true });
  });

  it("treats a missing contact as already removed", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
    await expect(deleteBrevoContact(
      "secret",
      "Trader+One@example.com",
      fetchMock,
    )).resolves.toBe("absent");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.brevo.com/v3/contacts/trader%2Bone%40example.com",
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});
