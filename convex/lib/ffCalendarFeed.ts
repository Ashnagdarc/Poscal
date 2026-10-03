export type FfDetailLink = {
  country: string;
  title: string;
  dateKey: string;
  url: string;
};

const EVENT_PATTERN = /<event>([\s\S]*?)<\/event>/gi;

export function detailLinkKey(country: string, title: string, dateKey: string): string {
  return `${country.trim().toUpperCase()}|${title.trim().toLowerCase()}|${dateKey}`;
}

/** Forex Factory JSON timestamps are US Eastern. Match them to the XML calendar date. */
export function easternDateKey(value: string | number): string {
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

export function ffXmlDateKey(raw: string): string | null {
  const match = raw.trim().match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) return null;
  return `${match[3]}-${match[1]}-${match[2]}`;
}

export function isForexFactoryUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname === "www.forexfactory.com";
  } catch {
    return false;
  }
}

function tagValue(block: string, tag: string): string {
  const pattern = new RegExp(
    `<${tag}>(?:\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*|([^<]*))</${tag}>`,
    "i",
  );
  const match = block.match(pattern);
  return (match?.[1] ?? match?.[2] ?? "").trim();
}

/** Pull event links from the free Forex Factory weekly XML feed. */
export function parseFfDetailLinks(xml: string): FfDetailLink[] {
  const links: FfDetailLink[] = [];
  for (const match of xml.matchAll(EVENT_PATTERN)) {
    const block = match[1] ?? "";
    const title = tagValue(block, "title");
    const country = tagValue(block, "country");
    const dateKey = ffXmlDateKey(tagValue(block, "date"));
    const url = tagValue(block, "url");
    if (!title || !country || !dateKey || !isForexFactoryUrl(url)) continue;
    links.push({ country: country.toUpperCase(), title, dateKey, url });
  }
  return links;
}

export function indexFfDetailLinks(links: readonly FfDetailLink[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const link of links) {
    index.set(detailLinkKey(link.country, link.title, link.dateKey), link.url);
  }
  return index;
}
