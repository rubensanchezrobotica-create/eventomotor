import type React from "react";
import { cls, COLORS, daysForMonth, isOnDay, MONTHS, parseDate, TODAY, WEEK_DAYS } from "@/lib/date-utils";
import type { EventItem } from "@/types/event";

export default function CalendarView({ month, setMonth, items, onOpen }: {
  month: number;
  setMonth: React.Dispatch<React.SetStateAction<number>>;
  items: EventItem[];
  onOpen: (event: EventItem) => void;
}) {
  const days = daysForMonth(2026, month);

  const monthEvents = items.filter((event) => {
    return parseDate(event.start).getMonth() === month || parseDate(event.end).getMonth() === month;
  });

  return (
    <section className="mt-6">
      <div className="mb-4 flex items-center justify-between rounded-3xl border border-white/10 bg-white/5 p-3">
        <button
          onClick={() => setMonth((m) => (m + 11) % 12)}
          className="rounded-2xl bg-white/10 px-4 py-3 text-white hover:bg-white/20"
        >
          Anterior
        </button>

        <div className="text-center">
          <p className="text-xs uppercase tracking-widest text-orange-200">Vista mensual</p>
          <h2 className="text-3xl font-black text-white">{MONTHS[month]} 2026</h2>
          <p className="text-sm text-zinc-400">{monthEvents.length} eventos filtrados este mes</p>
        </div>

        <button
          onClick={() => setMonth((m) => (m + 1) % 12)}
          className="rounded-2xl bg-white/10 px-4 py-3 text-white hover:bg-white/20"
        >
          Siguiente
        </button>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-2xl shadow-black/30">
        <div className="grid grid-cols-7 gap-2 pb-3 text-center text-xs font-black text-zinc-500">
          {WEEK_DAYS.map((day) => (
            <div key={day}>{day}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {days.map((day) => {
            const dayEvents = items.filter((event) => isOnDay(event, day));
            const inMonth = day.getMonth() === month;
            const isToday = day.toDateString() === TODAY.toDateString();

            const dayClass = cls(
              "min-h-28 rounded-2xl border p-2",
              inMonth ? "border-white/10 bg-zinc-950/70" : "border-white/5 bg-zinc-950/20 opacity-50",
              isToday ? "ring-2 ring-orange-300" : "",
            );

            return (
              <div key={day.toISOString()} className={dayClass}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-black text-white">{day.getDate()}</span>
                  {dayEvents.length > 0 ? (
                    <span className="rounded-full bg-white/10 px-2 text-xs font-bold text-white">
                      {dayEvents.length}
                    </span>
                  ) : null}
                </div>

                <div className="space-y-1">
                  {dayEvents.slice(0, 3).map((event) => (
                    <button
                      key={event.id}
                      onClick={() => onOpen(event)}
                      className={cls(
                        "block w-full truncate rounded-lg px-2 py-1 text-left text-xs font-bold",
                        COLORS[event.discipline] || COLORS.Motociclismo,
                      )}
                    >
                      {event.title}
                    </button>
                  ))}

                  {dayEvents.length > 3 ? (
                    <p className="px-1 text-xs text-zinc-500">+{dayEvents.length - 3} más</p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
