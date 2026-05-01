import { FALLBACK_EVENTS } from "@/lib/fallback-events";
import type { EventItem } from "@/types/event";

type EventsResponse = {
  updatedAt: string;
  events: EventItem[];
};

export async function GET() {
  const response: EventsResponse = {
    updatedAt: new Date().toISOString(),
    events: FALLBACK_EVENTS,
  };

  return Response.json(response);
}
