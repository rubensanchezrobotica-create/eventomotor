import assert from "node:assert/strict";
import test from "node:test";
import { GET as getEventsApi } from "@/app/api/events/route";
import { buildEventDetailV2Model } from "@/components/redesign-v2/event-detail/event-detail-model";
import {
  getVisibleEventsStrict,
  VISIBLE_EVENTS_PAGE_SIZE,
} from "@/lib/public-events";
import type { EventRow } from "@/lib/supabase";

const TOTAL_ROWS = 1_205;

function eventRow(index: number): EventRow {
  const suffix = String(index).padStart(4, "0");

  return {
    id: `pagination-event-${suffix}`,
    slug: `pagination-event-${suffix}`,
    title: `Pagination event ${suffix}`,
    championship: null,
    discipline: "Rally",
    start_date: "2026-12-12",
    end_date: "2026-12-12",
    venue: "Test venue",
    city: "Test city",
    province: "Madrid",
    region: "Madrid",
    level: "Publicado",
    source: "Test",
    source_url: "https://example.com/event",
    ticket_url: null,
    tags: ["test"],
    vehicle_type: "coche",
    featured: false,
    visible: true,
    import_method: null,
    data_quality: "reviewed",
    notes: null,
    created_at: "2026-09-30T00:00:00.000Z",
    updated_at: `2026-09-30T00:${String(index % 60).padStart(2, "0")}:00.000Z`,
  };
}

async function withPaginatedSupabase<T>(
  rows: EventRow[],
  action: () => Promise<T>,
) {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const requests: Array<{ from: number; to: number; url: string }> = [];

  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
  globalThis.fetch = (async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    const from = Number(url.searchParams.get("offset"));
    const limit = Number(url.searchParams.get("limit"));
    const to = from + limit - 1;

    assert.equal(Number.isInteger(from), true, "missing pagination offset");
    assert.equal(Number.isInteger(limit), true, "missing pagination limit");
    requests.push({ from, to, url: request.url });

    return new Response(JSON.stringify(rows.slice(from, to + 1)), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Range": `${from}-${Math.min(to, rows.length - 1)}/${rows.length}`,
      },
    });
  }) as typeof fetch;

  try {
    return { result: await action(), requests };
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
  }
}

function assertPaginationRequests(requests: Array<{ from: number; to: number; url: string }>) {
  assert.deepEqual(requests.map(({ from, to }) => [from, to]), [
    [0, 499],
    [500, 999],
    [1_000, 1_499],
  ]);

  for (const { url } of requests) {
    const order = new URL(url).searchParams.get("order");
    assert.equal(order, "start_date.asc,id.asc");
  }
}

test("recupera más de 1.000 eventos en páginas completas y una última parcial", async () => {
  const rows = Array.from({ length: TOTAL_ROWS }, (_, index) => eventRow(index));
  const { result: events, requests } = await withPaginatedSupabase(
    rows,
    getVisibleEventsStrict,
  );

  assert.equal(VISIBLE_EVENTS_PAGE_SIZE, 500);
  assert.equal(events.length, TOTAL_ROWS);
  assert.equal(new Set(events.map(({ id }) => id)).size, TOTAL_ROWS);
  assert.deepEqual(
    events.map(({ id }) => id),
    rows.map(({ id }) => id),
  );
  assertPaginationRequests(requests);
});

test("la API pública conserva el contrato y devuelve todo el inventario visible", async () => {
  const rows = Array.from({ length: TOTAL_ROWS }, (_, index) => eventRow(index));
  const { result: response, requests } = await withPaginatedSupabase(
    rows,
    getEventsApi,
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.events.length, TOTAL_ROWS);
  assert.equal(new Set(payload.events.map(({ id }: EventRow) => id)).size, TOTAL_ROWS);
  assert.deepEqual(
    payload.events.map(({ id }: EventRow) => id),
    rows.map(({ id }) => id),
  );
  assertPaginationRequests(requests);
});

test("la ficha calcula próximos con la colección paginada completa", async () => {
  const rows = Array.from({ length: TOTAL_ROWS }, (_, index) => eventRow(index));
  const { result: events, requests } = await withPaginatedSupabase(
    rows,
    getVisibleEventsStrict,
  );
  const model = buildEventDetailV2Model(events[0], events, {
    routeContext: "public",
    siteUrl: "https://www.eventomotor.com",
    today: "2026-09-30",
  });

  assert.ok(model);
  assert.equal(model.upcomingCount, TOTAL_ROWS);
  assertPaginationRequests(requests);
});
