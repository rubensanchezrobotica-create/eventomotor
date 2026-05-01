import { FALLBACK_EVENTS } from "@/lib/fallback-events";
import { createSupabaseServerClient, mapEventRowToEventItem } from "@/lib/supabase";
import type { EventRow } from "@/lib/supabase";
import type { EventItem } from "@/types/event";

type EventsResponse = {
  updatedAt: string;
  events: EventItem[];
};

function fallbackResponse(): EventsResponse {
  return {
    updatedAt: new Date().toISOString(),
    events: FALLBACK_EVENTS,
  };
}

export async function GET() {
  const supabase = createSupabaseServerClient();

  if (!supabase) {
    return Response.json(fallbackResponse());
  }

  try {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .order("start_date", { ascending: true });

    if (error || !data?.length) {
      return Response.json(fallbackResponse());
    }

    const rows = data as EventRow[];
    const events = rows.map(mapEventRowToEventItem);
    const updatedAt = rows.reduce((latest, row) => {
      return row.updated_at > latest ? row.updated_at : latest;
    }, rows[0].updated_at);

    return Response.json({ updatedAt, events } satisfies EventsResponse);
  } catch {
    return Response.json(fallbackResponse());
  }
}
