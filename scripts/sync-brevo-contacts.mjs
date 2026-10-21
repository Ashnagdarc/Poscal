#!/usr/bin/env node

import { execFileSync } from "node:child_process";

const apply = process.argv.includes("--apply");
const listIdArg = process.argv.find((argument) => argument.startsWith("--list-id="));
const listId = Number(listIdArg?.split("=")[1] ?? "2");
if (!Number.isSafeInteger(listId) || listId <= 0) {
  throw new Error("--list-id must be a positive integer");
}

const runConvex = (args) => execFileSync("npx", ["convex", ...args], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "inherit"],
});

const profiles = JSON.parse(runConvex([
  "data",
  "profiles",
  "--limit",
  "5000",
  "--format",
  "jsonArray",
]));
if (profiles.length >= 5000) {
  throw new Error("Refusing a partial sync: the profile query reached its 5000-row safety limit");
}

const apiKey = runConvex(["env", "get", "BREVO_API_KEY"]).trim();
if (!apiKey) throw new Error("BREVO_API_KEY is not configured");

const headers = {
  accept: "application/json",
  "content-type": "application/json",
  "api-key": apiKey,
};
const normalizeEmail = (value) => String(value ?? "").trim().toLowerCase();

const fetchContacts = async () => {
  const contacts = [];
  for (let offset = 0; ; offset += 1000) {
    const response = await fetch(
      `https://api.brevo.com/v3/contacts?limit=1000&offset=${offset}&sort=asc`,
      { headers },
    );
    if (!response.ok) throw new Error(`Brevo contact read failed with ${response.status}`);
    const page = await response.json();
    contacts.push(...(page.contacts ?? []));
    if (contacts.length >= page.count || (page.contacts ?? []).length < 1000) break;
  }
  return contacts;
};

const contacts = await fetchContacts();
const existingEmails = new Set(
  contacts.map((contact) => normalizeEmail(contact.email)).filter(Boolean),
);
const missingProfiles = profiles.filter(
  (profile) => !existingEmails.has(normalizeEmail(profile.email)),
);

console.log(JSON.stringify({
  mode: apply ? "apply" : "dry-run",
  convexProfiles: profiles.length,
  brevoContactsBefore: contacts.length,
  missingProfiles: missingProfiles.length,
  listId,
}, null, 2));

if (!apply) {
  console.log("Dry run only. Re-run with --apply to create the missing Brevo contacts.");
  process.exit(0);
}

const splitName = (fullName) => {
  const parts = String(fullName ?? "").trim().split(/\s+/).filter(Boolean);
  return {
    ...(parts[0] ? { FIRSTNAME: parts[0] } : {}),
    ...(parts.length > 1 ? { LASTNAME: parts.slice(1).join(" ") } : {}),
  };
};

const sleep = (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs));
let created = 0;
let failed = 0;

const upsertProfile = async (profile) => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch("https://api.brevo.com/v3/contacts", {
      method: "POST",
      headers,
      body: JSON.stringify({
        email: normalizeEmail(profile.email),
        attributes: {
          EXT_ID: String(profile.externalUserId),
          ...splitName(profile.fullName),
        },
        listIds: [listId],
        updateEnabled: true,
      }),
    });
    if (response.ok) return true;
    if (![408, 425, 429].includes(response.status) && response.status < 500) {
      console.error(`[brevo-contact-sync] contact upsert failed with ${response.status}`);
      return false;
    }
    if (attempt < 2) await sleep(250 * (attempt + 1));
  }
  console.error("[brevo-contact-sync] contact upsert exhausted retries");
  return false;
};

const batchSize = 10;
for (let offset = 0; offset < missingProfiles.length; offset += batchSize) {
  const results = await Promise.all(
    missingProfiles.slice(offset, offset + batchSize).map(upsertProfile),
  );
  created += results.filter(Boolean).length;
  failed += results.filter((result) => !result).length;
  if (offset + batchSize < missingProfiles.length) await sleep(200);
}

const after = await fetchContacts();
const afterEmails = new Set(
  after.map((contact) => normalizeEmail(contact.email)).filter(Boolean),
);
const stillMissing = profiles.filter(
  (profile) => !afterEmails.has(normalizeEmail(profile.email)),
).length;

console.log(JSON.stringify({
  created,
  failed,
  brevoContactsAfter: after.length,
  convexProfilesPresentInBrevo: profiles.length - stillMissing,
  stillMissing,
}, null, 2));

if (failed > 0 || stillMissing > 0) process.exitCode = 1;
