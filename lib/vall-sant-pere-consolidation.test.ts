import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isIndexableFutureEvent } from "@/app/sitemap";
import { isPublicEventVisible } from "@/lib/public-events";

const duplicateSlug = "rally-vall-sant-pere-2026-09-25";
const canonicalSlug = "rally-vall-sant-pere-esporles-2026-09-25";

const canonical = {
  slug: canonicalSlug,
  start_date: "2026-09-25",
  created_at: "2026-07-08T18:13:12.655697+00:00",
  updated_at: "2026-07-08T18:15:40.674+00:00",
  visible: true,
  event_status: "confirmed",
};
const duplicate = {
  ...canonical,
  slug: duplicateSlug,
  created_at: "2026-07-10T08:35:00.769545+00:00",
  updated_at: "2026-07-10T08:37:29.838+00:00",
  visible: false,
};

test("una ocultación local reversible deja un único Vall en listados y sitemap", () => {
  const fixtures = [canonical, duplicate];

  assert.deepEqual(fixtures.filter(isPublicEventVisible).map(({ slug }) => slug), [canonicalSlug]);
  assert.equal(isIndexableFutureEvent(canonical), true);
  assert.equal(isIndexableFutureEvent(duplicate), false);
});

test("las consultas públicas reales exigen visible=true", () => {
  const publicEvents = readFileSync(new URL("./public-events.ts", import.meta.url), "utf8");
  const sitemap = readFileSync(new URL("../app/sitemap.ts", import.meta.url), "utf8");

  assert.equal((publicEvents.match(/\.eq\("visible", true\)/g) || []).length, 2);
  assert.match(sitemap, /\.eq\("visible", true\)/);
});
