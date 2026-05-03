import type { EventUpsert } from "@/lib/supabase";

function dedupeKey(event: EventUpsert) {
  return [event.title, event.start_date, event.venue || ""]
    .map((value) => value.trim().toLowerCase())
    .join("|");
}

export function dedupeEvents(events: EventUpsert[]) {
  const seen = new Set<string>();
  const deduped: EventUpsert[] = [];

  for (const event of events) {
    const key = dedupeKey(event);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(event);
  }

  return deduped;
}
