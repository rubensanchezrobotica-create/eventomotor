import type React from "react";
import EventBadge from "@/components/EventBadge";
import { formatRange, formatStatus, statusOf } from "@/lib/date-utils";
import type { EventItem } from "@/types/event";

export default function EventModal({ event, onClose }: { event: EventItem | null; onClose: () => void }) {
  if (!event) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-3 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-white/[0.10] bg-[#101114] shadow-[0_30px_120px_rgba(0,0,0,0.55)]"
        onClick={(e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation()}
      >
        <div className="relative border-b border-white/[0.07] p-5">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-500/60 to-transparent" />
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="mb-3 flex flex-wrap gap-2">
                <EventBadge discipline={event.discipline} />
                <span className="rounded-full border border-white/[0.08] bg-white/[0.035] px-2 py-1 text-[11px] font-semibold text-[#A6A6A6]">
                  {formatStatus(statusOf(event))}
                </span>
                {event.featured ? (
                  <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-1 text-[11px] font-semibold text-amber-100">
                    Destacado
                  </span>
                ) : null}
              </div>

              <h2 className="text-2xl font-semibold leading-tight text-white sm:text-3xl">{event.title}</h2>
              <p className="mt-2 text-sm text-[#A6A6A6]">{event.championship}</p>
            </div>

            <button
              className="grid h-9 w-9 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.035] text-lg text-white transition hover:border-white/[0.16]"
              onClick={onClose}
              type="button"
            >
              x
            </button>
          </div>
        </div>

        <div className="max-h-[68vh] overflow-auto p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoBox label="Fecha" value={`${formatRange(event)} de ${event.start.slice(0, 4)}`} />
            <InfoBox label="Lugar" value={event.venue} />
            <InfoBox label="Ubicacion" value={`${event.city}, ${event.province}`} />
            <InfoBox label="Disciplina" value={event.discipline} />
          </div>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            {event.sourceUrl ? (
              <a
                href={event.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 rounded-lg bg-white px-4 py-3 text-center text-sm font-bold text-zinc-950 transition hover:bg-red-100"
              >
                Más información
              </a>
            ) : null}

            {event.ticketUrl ? (
              <a
                href={event.ticketUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-center text-sm font-semibold text-red-100 transition hover:border-red-400/60"
              >
                Entradas
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#15161A] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-2 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
