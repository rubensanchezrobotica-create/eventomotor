import EventCard from "@/components/EventCard";
import type { EventItem } from "@/types/event";

export default function ZoneView({ items, setRegion, onOpen }: {
  items: EventItem[];
  setRegion: (region: string) => void;
  onOpen: (event: EventItem) => void;
}) {
  const counts = items.reduce<Record<string, number>>((acc, event) => {
    acc[event.region] = (acc[event.region] || 0) + 1;
    return acc;
  }, {});

  const zones = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  return (
    <section className="mt-6 grid gap-5 lg:grid-cols-[360px_1fr]">
      <aside className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <p className="text-sm font-bold uppercase tracking-widest text-orange-200">Zonas</p>
        <h3 className="mt-2 text-2xl font-black text-white">Mapa rápido de actividad</h3>

        <div className="mt-5 space-y-2">
          {zones.map(([name, count]) => (
            <button
              key={name}
              onClick={() => setRegion(name)}
              className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-left hover:bg-white/10"
            >
              <span className="font-bold text-white">{name}</span>
              <span className="rounded-full bg-orange-300 px-3 py-1 text-xs font-black text-zinc-950">
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
