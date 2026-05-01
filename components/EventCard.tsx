import EventBadge from "@/components/EventBadge";
import { formatRange, formatStatus, statusOf } from "@/lib/date-utils";
import type { EventItem } from "@/types/event";

export default function EventCard({ event, onOpen }: { event: EventItem; onOpen: (event: EventItem) => void }) {
  return (
    <article className="rounded-3xl border border-white/10 bg-zinc-900/80 p-5 shadow-xl shadow-black/30 transition hover:-translate-y-1 hover:border-orange-300/40">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <EventBadge discipline={event.discipline} />
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-zinc-300">
          {event.level}
        </span>
        <span className="rounded-full bg-black/30 px-3 py-1 text-xs font-bold text-zinc-300">
          {formatStatus(statusOf(event))}
        </span>
        {event.featured ? (
          <span className="rounded-full bg-yellow-300 px-3 py-1 text-xs font-black text-zinc-950">
            Destacado
          </span>
        ) : null}
      </div>

      <button onClick={() => onOpen(event)} className="text-left">
        <h3 className="text-xl font-black leading-tight text-white hover:text-orange-200">
          {event.title}
        </h3>
      </button>

      <p className="mt-1 text-sm text-zinc-400">{event.championship}</p>

      <div className="mt-4 grid gap-2 text-sm text-zinc-300 sm:grid-cols-2">
        <p>Fecha: {formatRange(event)} de 2026</p>
        <p>Lugar: {event.city}, {event.province}</p>
        <p>Circuito: {event.venue}</p>
        <p>Fuente: {event.source}</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {event.tags.map((tag) => (
          <span key={`${event.id}-${tag}`} className="rounded-full bg-white/5 px-2 py-1 text-xs text-zinc-400">
            #{tag}
          </span>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap gap-2 border-t border-white/10 pt-4">
        <button
          onClick={() => onOpen(event)}
          className="rounded-2xl bg-white px-4 py-2 text-sm font-black text-zinc-950 hover:bg-orange-200"
        >
          Ver ficha
        </button>

        {event.ticketUrl ? (
          <a
            href={event.ticketUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white hover:bg-white/10"
          >
            Entradas
          </a>
        ) : null}

        {event.sourceUrl ? (
          <a
            href={event.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white hover:bg-white/10"
          >
            Fuente
          </a>
        ) : null}
      </div>
    </article>
  );
}
