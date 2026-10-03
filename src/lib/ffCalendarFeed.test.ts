import { describe, expect, it } from "vitest";
import {
  detailLinkKey,
  easternDateKey,
  indexFfDetailLinks,
  parseFfDetailLinks,
} from "../../convex/lib/ffCalendarFeed";

const SAMPLE = `<?xml version="1.0" encoding="windows-1252"?>
<weeklyevents>
  <event>
    <title>SPPI y/y</title>
    <country>JPY</country>
    <date><![CDATA[09-27-2026]]></date>
    <time><![CDATA[11:50pm]]></time>
    <impact><![CDATA[Low]]></impact>
    <forecast><![CDATA[3.6%]]></forecast>
    <previous />
    <url><![CDATA[https://www.forexfactory.com/calendar/176-jn-sppi-yy]]></url>
  </event>
  <event>
    <title>Ignored</title>
    <country>USD</country>
    <date><![CDATA[09-28-2026]]></date>
    <url>https://example.com/not-ff</url>
  </event>
</weeklyevents>`;

describe("forex factory detail links", () => {
  it("keeps official event links and matches them to the Eastern calendar date", () => {
    const links = parseFfDetailLinks(SAMPLE);
    expect(links).toEqual([
      {
        country: "JPY",
        title: "SPPI y/y",
        dateKey: "2026-09-27",
        url: "https://www.forexfactory.com/calendar/176-jn-sppi-yy",
      },
    ]);

    const index = indexFfDetailLinks(links);
    const jsonDate = "2026-09-27T19:50:00-04:00";
    expect(index.get(detailLinkKey("JPY", "SPPI y/y", easternDateKey(jsonDate)))).toBe(
      "https://www.forexfactory.com/calendar/176-jn-sppi-yy",
    );
  });
});
