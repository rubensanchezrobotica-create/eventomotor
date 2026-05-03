import { createSupabaseServerClient, mapEventRowToEventItem } from "@/lib/supabase";
import type { EventRow } from "@/lib/supabase";
import { FALLBACK_EVENTS } from "@/lib/fallback-events";
import { createEventSlug } from "@/lib/slug";
import type { EventItem } from "@/types/event";

function fallbackVisibleEvents(): EventItem[] {
  return FALLBACK_EVENTS.filter((event) => event.visible !== false).map((event) => ({
    ...event,
    slug: event.slug || createEventSlug(event.title, event.start),
  }));
}

export async function getVisibleEvents() {
  const supabase = createSupabaseServerClient();

  if (!supabase) {
    return fallbackVisibleEvents();
  }

  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("visible", true)
    .order("start_date", { ascending: true });

  if (error || !data) {
    return fallbackVisibleEvents();
  }

  const events = (data as EventRow[]).map(mapEventRowToEventItem);

  return events.length ? events : fallbackVisibleEvents();
}
