import TrackAnchor from "@/components/analytics/TrackAnchor";
import TrackLink from "@/components/analytics/TrackLink";
import EventBadge from "@/components/EventBadge";
import { formatRange, formatStatus, getDisciplineColor, statusOf } from "@/lib/date-utils";
import { createEventSlug } from "@/lib/slug";
import type { EventItem } from "@/types/event";

export default function EventCard({
  event,
}: {
  event: EventItem;
  onOpen?: (event: EventItem) => void;
}) {
  const eventHref = `/evento/${event.slug || createEventSlug(event.title, event.start)}`;
  const status = formatStatus(statusOf(event));
  const disciplineColor = getDisciplineColor(event.discipline);

  return (
    <article className="group overflow-hidden rounded-xl border border-white/[0.07] bg-[#15161A]/86 shadow-[0_16px_50px_rgba(0,0,0,0.20)] transition hover:-translate-y-0.5 hover:border-white/[0.15] hover:bg-[#1A1A1D]">
      <div className="h-px w-full opacity-70" style={{ backgroundColor: disciplineColor.accent }} />
      <div className="flex gap-4 p-4">
        <div
          className="grid h-[4.35rem] w-[4.35rem] shrink-0 place-items-center rounded-xl border border-white/[0.08] bg-black/25 text-center shadow-[inset_3px_0_0_var(--discipline-accent)]"
          style={{ "--discipline-accent": disciplineColor.accent } as React.CSSProperties}
        >
          <span className="text-[10px] font-semibold uppercase tracking-wide text-[#A6A6A6]">
            {formatRange(event).split(" ").slice(-1).join(" ")}
          </span>
          <span className="text-2xl font-black leading-none text-white">
            {formatRange(event).split(" ")[0]}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <EventBadge discipline={event.discipline} />
            <span className="rounded-full border border-white/[0.08] bg-white/[0.035] px-2 py-1 text-[11px] font-semibold text-[#A6A6A6]">
              {status}
            </span>
            {event.featured ? (
              <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-1 text-[11px] font-semibold text-amber-100">
                Destacado
              </span>
            ) : null}
          </div>

          <TrackLink
            className="block"
            eventName="click_event_detail"
            eventParams={{
              event_slug: event.slug,
              event_title: event.title,
              discipline: event.discipline,
              zone: event.region || event.province,
              vehicle_type: event.vehicleType || event.vehicle_type || "otros",
            }}
            href={eventHref}
          >
            <h3 className="line-clamp-2 text-base font-semibold leading-snug text-white transition group-hover:text-red-100">
              {event.title}
            </h3>
          </TrackLink>

          <p className="mt-2 truncate text-sm text-[#A6A6A6]">
            {event.venue} / {event.city}, {event.province}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.06] px-4 py-3">
        <TrackLink
          className="rounded-md bg-white px-3 py-2 text-xs font-bold text-zinc-950 transition hover:bg-red-100"
          eventName="click_event_detail"
          eventParams={{
            event_slug: event.slug,
            event_title: event.title,
            discipline: event.discipline,
            zone: event.region || event.province,
            vehicle_type: event.vehicleType || event.vehicle_type || "otros",
          }}
          href={eventHref}
        >
          Ver evento
        </TrackLink>
        {event.ticketUrl ? (
          <TrackAnchor
            className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-100 transition hover:border-red-400/60"
            eventName="click_tickets"
            eventParams={{
              event_slug: event.slug,
              event_title: event.title,
              source: event.source,
            }}
            href={event.ticketUrl}
            rel="noreferrer"
            target="_blank"
          >
            Entradas
          </TrackAnchor>
        ) : null}
      </div>
    </article>
  );
}
