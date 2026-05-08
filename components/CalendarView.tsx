import Link from "next/link";
import type React from "react";
import { useMemo, useState } from "react";
import EventBadge from "@/components/EventBadge";
import {
  cls,
  daysForMonth,
  formatRange,
  getDisciplineColor,
  isOnDay,
  MONTHS,
  parseDate,
  TODAY,
  WEEK_DAYS,
} from "@/lib/date-utils";
import { createEventSlug } from "@/lib/slug";
import type { EventItem } from "@/types/event";

export default function CalendarView({
  year,
  month,
  setMonth,
  items,
  onOpen,
}: {
  year: number;
  month: number;
  setMonth: React.Dispatch<React.SetStateAction<number>>;
  items: EventItem[];
  onOpen: (event: EventItem) => void;
}) {
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const days = daysForMonth(year, month);

  const monthEvents = items.filter((event) => {
    return parseDate(event.start).getMonth() === month || parseDate(event.end).getMonth() === month;
  });

  const selectedDayEvents = useMemo(() => {
    if (!selectedDay) {
      return [];
    }

    return items
      .filter((event) => isOnDay(event, selectedDay))
      .sort((a, b) => parseDate(a.start).getTime() - parseDate(b.start).getTime());
  }, [items, selectedDay]);

  const legendDisciplines = useMemo(() => {
    return Array.from(new Set(monthEvents.map((event) => event.discipline))).sort();
  }, [monthEvents]);

  return (
    <section className="mt-6">
      <div className="mb-3 flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-[#15161A]/78 p-3 shadow-[0_18px_70px_rgba(0,0,0,0.22)] lg:flex-row lg:items-center lg:justify-between">
        <button
          className="rounded-lg border border-white/[0.08] bg-white/[0.035] px-3 py-2 text-sm font-semibold text-white transition hover:border-white/[0.16]"
          onClick={() => setMonth((m) => (m + 11) % 12)}
          type="button"
        >
          Anterior
        </button>

        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-300">Vista mensual</p>
          <h2 className="text-2xl font-semibold text-white">{MONTHS[month]} {year}</h2>
          <p className="text-xs text-[#A6A6A6]">{monthEvents.length} eventos este mes</p>
        </div>

        <div className="flex justify-end gap-2">
          <button
            className="rounded-lg border border-white/[0.08] bg-white/[0.035] px-3 py-2 text-sm font-semibold text-white transition hover:border-white/[0.16]"
            onClick={() => setMonth(TODAY.getMonth())}
            type="button"
          >
            Hoy
          </button>
          <button
            className="rounded-lg border border-white/[0.08] bg-white/[0.035] px-3 py-2 text-sm font-semibold text-white transition hover:border-white/[0.16]"
            onClick={() => setMonth((m) => (m + 1) % 12)}
            type="button"
          >
            Siguiente
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-[#15161A]/78 p-3 shadow-[0_24px_80px_rgba(0,0,0,0.26)]">
        {legendDisciplines.length ? (
          <div className="mb-4 flex flex-wrap gap-2 border-b border-white/[0.06] pb-3">
            {legendDisciplines.map((discipline) => {
              const color = getDisciplineColor(discipline);

              return (
                <span
                  className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.025] px-2.5 py-1 text-[11px] font-semibold text-[#A6A6A6]"
                  key={discipline}
                >
                  <span className={`h-2 w-2 rounded-full ${color.dot}`} />
                  {discipline}
                </span>
              );
            })}
          </div>
        ) : null}

        <div className="grid grid-cols-7 gap-1.5 pb-3 text-center text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
          {WEEK_DAYS.map((day) => (
            <div key={day}>{day}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {days.map((day) => {
            const dayEvents = items.filter((event) => isOnDay(event, day));
            const inMonth = day.getMonth() === month;
            const isToday = day.toDateString() === TODAY.toDateString();

            const dayClass = cls(
                "min-h-24 cursor-pointer rounded-xl border p-2 text-left transition sm:min-h-28",
                inMonth
                ? "border-white/[0.07] bg-black/18 hover:border-red-500/35 hover:bg-white/[0.04] hover:shadow-[0_12px_38px_rgba(0,0,0,0.20)]"
                : "border-white/[0.04] bg-black/10 opacity-45",
              isToday ? "ring-1 ring-red-500/70" : "",
            );

            return (
              <button
                className={dayClass}
                key={day.toISOString()}
                onClick={() => setSelectedDay(day)}
                title="Ver eventos de este día"
                type="button"
              >
                <span className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">{day.getDate()}</span>
                  {dayEvents.length > 0 ? (
                    <span className="rounded-full border border-white/[0.08] bg-white/[0.05] px-2 py-0.5 text-[11px] font-semibold text-white">
                      {dayEvents.length}
                    </span>
                  ) : null}
                </span>

                <span className="block space-y-1">
                  {dayEvents.slice(0, 2).map((event) => (
                    <span
                      className={`block truncate rounded-lg border border-white/[0.06] border-l-2 px-2 py-1 text-[11px] font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] ${getDisciplineColor(event.discipline).calendar}`}
                      key={event.id}
                    >
                      {event.title}
                    </span>
                  ))}

                  {dayEvents.length > 2 ? (
                    <span className="block px-1 text-[11px] font-medium text-red-200">
                      +{dayEvents.length - 2} más
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <DayEventsModal
        day={selectedDay}
        events={selectedDayEvents}
        onClose={() => setSelectedDay(null)}
        onOpen={onOpen}
      />
    </section>
  );
}

function DayEventsModal({
  day,
  events,
  onClose,
  onOpen,
}: {
  day: Date | null;
  events: EventItem[];
  onClose: () => void;
  onOpen: (event: EventItem) => void;
}) {
  if (!day) {
    return null;
  }

  const dateLabel = new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(day);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-3 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[86vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-white/[0.10] bg-[#101114] shadow-[0_30px_120px_rgba(0,0,0,0.55)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.07] p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-red-300">Calendario</p>
            <h3 className="mt-1 text-2xl font-semibold capitalize text-white">
              Eventos del {dateLabel}
            </h3>
            <p className="mt-1 text-sm text-[#A6A6A6]">
              {events.length ? `${events.length} eventos encontrados` : "No hay eventos para este día."}
            </p>
          </div>
          <button
            className="grid h-9 w-9 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.035] text-lg text-white transition hover:border-white/[0.16]"
            onClick={onClose}
            type="button"
          >
            x
          </button>
        </div>

        <div className="max-h-[62vh] overflow-auto p-5">
          {events.length ? (
            <div className="flex flex-col gap-3">
              {events.map((event) => {
                const eventHref = `/evento/${event.slug || createEventSlug(event.title, event.start)}`;

                return (
                  <article
                    className="rounded-xl border border-white/[0.08] bg-[#15161A] p-4"
                    key={event.id}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap gap-2">
                          <EventBadge discipline={event.discipline} />
                          {event.featured ? (
                            <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-1 text-[11px] font-semibold text-amber-100">
                              Destacado
                            </span>
                          ) : null}
                        </div>
                        <h4 className="text-base font-semibold text-white">{event.title}</h4>
                        <p className="mt-1 text-sm text-[#A6A6A6]">
                          {formatRange(event)} / {event.city}, {event.province}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">Lugar: {event.venue}</p>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <button
                          className="rounded-md border border-white/[0.08] bg-white/[0.035] px-3 py-2 text-xs font-semibold text-white transition hover:border-white/[0.16]"
                          onClick={() => onOpen(event)}
                          type="button"
                        >
                          Vista rápida
                        </button>
                        <Link
                          className="rounded-md bg-white px-3 py-2 text-xs font-bold text-zinc-950 transition hover:bg-red-100"
                          href={eventHref}
                        >
                          Ver evento
                        </Link>
                        {event.ticketUrl ? (
                          <a
                            className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-100 transition hover:border-red-400/60"
                            href={event.ticketUrl}
                            rel="noreferrer"
                            target="_blank"
                          >
                            Entradas
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-white/[0.10] bg-white/[0.03] p-8 text-center">
              <p className="text-base font-semibold text-white">No hay eventos para este día.</p>
              <p className="mt-2 text-sm text-[#A6A6A6]">Prueba otra fecha del calendario.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
