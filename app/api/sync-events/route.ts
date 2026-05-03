import { scrapeRfmeEvents } from "@/lib/scrapers/rfme";
import { dedupeEvents } from "@/lib/sync/dedupe-events";
import { normalizeSyncEvent } from "@/lib/sync/normalize-sync-event";
import { upsertEvents } from "@/lib/sync/upsert-events";

type SyncEventsResponse = {
  ok: boolean;
  sources: string[];
  insertedOrUpdated: number;
  errors: string[];
};

function jsonResponse(body: SyncEventsResponse, status = 200) {
  return Response.json(body, { status });
}

function validateCronSecret(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return {
      ok: false as const,
      status: 500,
      error: "CRON_SECRET is not configured. Add CRON_SECRET to your environment.",
    };
  }

  const authorization = request.headers.get("authorization");

  if (authorization !== `Bearer ${cronSecret}`) {
    return {
      ok: false as const,
      status: 401,
      error: "Unauthorized. Send Authorization: Bearer CRON_SECRET.",
    };
  }

  return { ok: true as const };
}

export async function GET(request: Request) {
  const auth = validateCronSecret(request);

  if (!auth.ok) {
    return jsonResponse(
      {
        ok: false,
        sources: [],
        insertedOrUpdated: 0,
        errors: [auth.error],
      },
      auth.status,
    );
  }

  const sources: string[] = [];
  const errors: string[] = [];
  let insertedOrUpdated = 0;

  try {
    sources.push("rfme");

    const rawEvents = await scrapeRfmeEvents();
    const normalizedEvents = rawEvents.map(normalizeSyncEvent);
    const dedupedEvents = dedupeEvents(normalizedEvents);

    if (dedupedEvents.length) {
      insertedOrUpdated = await upsertEvents(dedupedEvents);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(message);
  }

  return jsonResponse({
    ok: errors.length === 0,
    sources,
    insertedOrUpdated,
    errors,
  });
}
