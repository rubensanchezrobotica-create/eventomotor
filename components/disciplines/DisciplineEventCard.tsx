"use client";

import type { EventItem } from "@/types/event";
import ZoneEventCard from "@/components/zones/ZoneEventCard";

type DisciplineEventCardProps = {
  event: EventItem;
  source: string;
};

export default function DisciplineEventCard({ event, source }: DisciplineEventCardProps) {
  return (
    <ZoneEventCard
      event={event}
      saveSource={`${source}_favorite`}
      showMultiDayMeta={false}
      showStatus={false}
      source={source}
    />
  );
}
