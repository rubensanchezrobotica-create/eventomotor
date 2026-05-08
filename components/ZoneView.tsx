import EventCard from "@/components/EventCard";
import type { EventItem } from "@/types/event";

export default function ZoneView({
  items,
  setRegion,
  onOpen,
}: {
  items: EventItem[];
  setRegion: (region: string) => void;
  onOpen: (event: EventItem) => void;
}) {
  const counts = items.reduce<Record<string, number>>((acc, event) => {
    acc[event.province] = (acc[event.province] || 0) + 1;
    return acc;
  }, {});

  const zones = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  return (
    <section className="mt-6 grid gap-5 lg:grid-cols-[360px_1fr]">
      <aside className="rounded-2xl border border-white/[0.08] bg-[#15161A]/78 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-red-300">Zonas</p>
        <h3 className="mt-2 text-2xl font-semibold text-white">Mapa rápido de actividad</h3>

        <div className="mt-5 space-y-2">
          {zones.map(([name, count]) => (
            <button
              className="flex w-full items-center justify-between rounded-xl border border-white/[0.08] bg-black/25 px-4 py-3 text-left transition hover:border-red-500/35 hover:bg-white/[0.045]"
              key={name}
              onClick={() => setRegion(name)}
              type="button"
            >
              <span className="font-semibold text-white">{name}</span>
              <span className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-bold text-red-100">
                {count}
              </span>
            </button>
          ))}
        </div>
      </aside>

      <div className="grid gap-4 md:grid-cols-2">
        {items.slice(0, 18).map((event) => (
          <EventCard key={event.id} event={event} onOpen={onOpen} />
        ))}
      </div>
    </section>
  );
}
