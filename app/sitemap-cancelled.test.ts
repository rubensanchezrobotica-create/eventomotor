import assert from "node:assert/strict";
import test from "node:test";
import { isIndexableFutureEvent } from "@/lib/event-sitemap-eligibility";
import type { EventRow } from "@/lib/supabase";

type SitemapFixture = Pick<EventRow, "slug" | "start_date" | "created_at" | "updated_at" | "visible" | "event_status">;

function event(overrides: Partial<SitemapFixture> = {}): SitemapFixture {
  return {
    slug: "5-rallye-historico-comarca-del-ason-2026-11-27",
    start_date: "2099-11-27",
    created_at: "2026-09-30T00:00:00.000Z",
    updated_at: "2026-09-30T00:00:00.000Z",
    visible: true,
    event_status: "cancelled",
    ...overrides,
  };
}

test("una ficha cancelada, visible y futura permanece en sitemap", () => {
  assert.equal(isIndexableFutureEvent(event()), true);
  assert.equal(isIndexableFutureEvent(event({ event_status: "confirmed" })), true);
  assert.equal(isIndexableFutureEvent(event({ event_status: null })), true);
});

test("sitemap conserva las exclusiones por visibilidad, slug y fecha", () => {
  assert.equal(isIndexableFutureEvent(event({ visible: false })), false);
  assert.equal(isIndexableFutureEvent(event({ slug: "slug inválido" })), false);
  assert.equal(isIndexableFutureEvent(event({ start_date: "2000-01-01" })), false);
  assert.equal(isIndexableFutureEvent(event({ start_date: "not-a-date" })), false);
});
