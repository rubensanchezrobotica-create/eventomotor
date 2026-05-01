import { formatRange, MONTHS, parseDate } from "@/lib/date-utils";
import type { EventItem, ViewMode } from "@/types/event";

export default function YearView({ items, setMonth, setView }: {
  items: EventItem[];
  setMonth: (month: number) => void;
  setView: (view: ViewMode) => void;
}) {
  return (
    <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {MONTHS.map((name, month) => {
        const monthItems = items.filter((event) => {
          return parseDate(event.start).getMonth() === month || parseDate(event.end).getMonth() === month;
        });

        return (
          <button
            key={name}
            onClick={() => {
              setMonth(month);
              setView("calendario");
            }}
            className="rounded-3xl border border-white/10 bg-white/5 p-5 text-left hover:border-orange-300/40 hover:bg-white/10"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black text-white">{name}</h3>
              <span className="rounded-full bg-orange-300 px-3 py-1 text-xs font-black text-zinc-950">
                {monthItems.length}
              </span>
            </div>

            <div className="mt-4 space-y-2">
              {monthItems.slice(0, 4).map((event) => (
                <p key={event.id} className="truncate text-sm text-zinc-300">
                  {formatRange(event)} - {event.title}
                </p>
              ))}

              {monthItems.length === 0 ? (
                <p className="text-sm text-zinc-500">Sin eventos con los filtros actuales</p>
              ) : null}

              {monthItems.length > 4 ? (
                <p className="text-xs text-zinc-500">+{monthItems.length - 4} más</p>
              ) : null}
            </div>
          </button>
        );
      })}
    </section>
  );
}
