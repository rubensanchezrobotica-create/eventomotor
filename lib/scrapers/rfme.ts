import type { RawEvent } from "@/lib/scrapers/types";

export async function scrapeRfmeEvents(): Promise<RawEvent[]> {
  // TODO: Fetch RFME calendar pages or feeds when the source format is confirmed.
  // TODO: Parse remote event rows into RawEvent objects without writing to Supabase here.
  // TODO: Keep this scraper source-specific; normalization and persistence live in lib/sync.
  return [];
}
