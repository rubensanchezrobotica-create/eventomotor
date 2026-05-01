import type React from "react";
import EventBadge from "@/components/EventBadge";
import { formatRange, formatStatus, statusOf } from "@/lib/date-utils";
import type { EventItem } from "@/types/event";

export default function EventModal({ event, onClose }: { event: EventItem | null; onClose: () => void }) {
  if (!event) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl shadow-black"
        onClick={(e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-3 flex flex-wrap gap-2">
              <EventBadge discipline={event.discipline} />
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-zinc-300">
                {formatStatus(statusOf(event))}
              </span>
            </div>

            <h2 className="text-3xl font-black text-white">{event.title}</h2>
            <p className="mt-2 text-zinc-400">{event.championship}</p>
          </div>

          <button onClick={onClose} className="rounded-2xl bg-white/10 px-4 py-2 text-white hover:bg-white/20">
            Cerrar
          </button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <InfoBox label="Fecha" value={`${formatRange(event)} de 2026`} />
          <InfoBox label="Circuito / lugar" value={event.venue} />
          <InfoBox label="Ubicación" value={`${event.city}, ${event.province}`} />
          <InfoBox label="Fuente" value={event.source} />
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          {event.sourceUrl ? (
            <a
              href={event.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="flex-1 rounded-2xl bg-white px-4 py-3 text-center font-black text-zinc-950 hover:bg-orange-200"
            >
              Ver fuente oficial
            </a>
          ) : null}

          {event.ticketUrl ? (
            <a
              href={event.ticketUrl}
              target="_blank"
              rel="noreferrer"
              className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center font-black text-white hover:bg-white/10"
            >
              Entradas / info
            </a>
          ) : (
            <span className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center font-black text-zinc-500">
              Sin enlace de entradas
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs uppercase tracking-widest text-zinc-500">{label}</p>
      <p className="mt-2 font-bold text-white">{value}</p>
    </div>
  );
}
