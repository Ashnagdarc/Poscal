const BREVO_CONTACTS_ENDPOINT = "https://api.brevo.com/v3/contacts";

export const DEFAULT_BREVO_CONTACT_LIST_ID = 2;

type FetchImplementation = typeof fetch;

export type BrevoContactInput = {
  email: string;
  externalUserId: string;
  fullName?: string | null;
  listId?: number;
};

export class BrevoContactError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
    this.name = "BrevoContactError";
  }

  get retryable() {
    return this.status === null || this.status === 408 || this.status === 425
      || this.status === 429 || (this.status >= 500 && this.status <= 599);
  }
}

export function resolveBrevoContactListId(value?: string | null): number {
  const trimmed = value?.trim();
  if (!trimmed) return DEFAULT_BREVO_CONTACT_LIST_ID;

  const listId = Number(trimmed);
  if (!Number.isSafeInteger(listId) || listId <= 0) {
    throw new BrevoContactError("BREVO_CONTACT_LIST_ID must be a positive integer", null);
  }
  return listId;
}

export function splitBrevoContactName(fullName?: string | null) {
  const parts = fullName?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (parts.length === 0) return {};
  if (parts.length === 1) return { firstName: parts[0] };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

export async function upsertBrevoContact(
  apiKey: string,
  contact: BrevoContactInput,
  fetchImplementation: FetchImplementation = fetch,
): Promise<"created" | "updated"> {
  const email = contact.email.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    throw new BrevoContactError("A valid contact email is required", null);
  }

  const { firstName, lastName } = splitBrevoContactName(contact.fullName);
  const attributes = {
    EXT_ID: contact.externalUserId,
    ...(firstName ? { FIRSTNAME: firstName } : {}),
    ...(lastName ? { LASTNAME: lastName } : {}),
  };

  let response: Response;
  try {
    response = await fetchImplementation(BREVO_CONTACTS_ENDPOINT, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        email,
        attributes,
        listIds: [contact.listId ?? DEFAULT_BREVO_CONTACT_LIST_ID],
        updateEnabled: true,
      }),
    });
  } catch {
    throw new BrevoContactError("Brevo contact request failed", null);
  }

  if (!response.ok) {
    throw new BrevoContactError("Brevo contact upsert failed", response.status);
  }

  return response.status === 201 ? "created" : "updated";
}

export async function deleteBrevoContact(
  apiKey: string,
  email: string,
  fetchImplementation: FetchImplementation = fetch,
): Promise<"deleted" | "absent"> {
  const normalizedEmail = email.trim().toLowerCase();
  let response: Response;
  try {
    response = await fetchImplementation(
      `${BREVO_CONTACTS_ENDPOINT}/${encodeURIComponent(normalizedEmail)}`,
      {
        method: "DELETE",
        headers: {
          accept: "application/json",
          "api-key": apiKey,
        },
      },
    );
  } catch {
    throw new BrevoContactError("Brevo contact delete request failed", null);
  }

  if (response.status === 404) return "absent";
  if (!response.ok) {
    throw new BrevoContactError("Brevo contact delete failed", response.status);
  }
  return "deleted";
}
