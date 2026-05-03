import { createSupabaseServerClient, type EventUpsert } from "@/lib/supabase";

export async function upsertEvents(events: EventUpsert[]) {
  if (!events.length) {
    return 0;
  }

  const supabase = createSupabaseServerClient();

  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  const { data, error } = await supabase
    .from("events")
    .upsert(events, { onConflict: "id" })
    .select("id");

  if (error) {
    throw new Error(error.message);
  }

  return data?.length ?? 0;
}
