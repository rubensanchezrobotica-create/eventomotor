import type { Metadata } from "next";
import Link from "next/link";
import EventBadge from "@/components/EventBadge";
import UnderConstruction from "@/components/UnderConstruction";
import { getListingLinks } from "@/lib/event-listing-slugs";
import { getVisibleEvents } from "@/lib/public-events";
import { getSiteUrl } from "@/lib/site-url";
import { isUnderConstruction } from "@/lib/under-construction";

export async function generateMetadata(): Promise<Metadata> {
  const url = `${getSiteUrl()}/eventos-moto`;
  const description =
    "Calendario de eventos de motociclismo en Espana por disciplina y region: MotoGP, motocross, trial, enduro, superbike y mas.";

  return {
    title: "Eventos de moto en Espana | EventoMotor",
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: "Eventos de moto en Espana | EventoMotor",
      description,
      url,
      siteName: "EventoMotor",
      type: "website",
    },
  };
}

export default async function EventosMotoPage() {
  if (isUnderConstruction()) {
    return <UnderConstruction />;
  }

  const events = await getVisibleEvents();
  const links = getListingLinks(events);
  const siteUrl = getSiteUrl();
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Eventos de moto en Espana",
    itemListElement: events.map((event, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: event.title,
      url: `${siteUrl}/evento/${event.slug}`,
    })),
  };

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }}
      />
      <div className="mx-auto max-w-6xl">
        <Link className="text-sm font-bold text-orange-200 hover:text-orange-100" href="/">
          Volver al calendario
        </Link>

        <header className="mt-8 border-b border-white/10 pb-8">
          <p className="text-sm font-bold uppercase tracking-widest text-orange-200">
            EventoMotor
          </p>
          <h1 className="mt-3 text-4xl font-black leading-tight sm:text-6xl">
            Eventos de moto en Espana
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-zinc-300">
            Listados SEO de eventos visibles por disciplina y region, con fichas indexables para
            cada prueba.
          </p>
        </header>

        <section className="mt-8 grid gap-4 md:grid-cols-2">
          <ListingGroup title="Por disciplina" items={links.disciplines} />
          <ListingGroup title="Por region" items={links.regions} />
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-black">Ultimos eventos visibles</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {events.slice(0, 12).map((event) => (
              <Link
                className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:bg-white/10"
                href={`/evento/${event.slug}`}
                key={event.id}
              >
                <div className="mb-2">
                  <EventBadge discipline={event.discipline} />
                </div>
                <h3 className="font-black text-white">{event.title}</h3>
                <p className="mt-1 text-sm text-zinc-400">
                  {event.start} - {event.city}, {event.province}
                </p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function ListingGroup({
  title,
  items,
}: {
  title: string;
  items: Array<{ slug: string; name: string; count: number }>;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <h2 className="text-xl font-black">{title}</h2>
      <div className="mt-4 flex flex-wrap gap-2">
        {items.map((item) => (
          <Link
            className="rounded-full border border-white/10 bg-black/20 px-3 py-2 text-sm font-bold text-zinc-200 hover:bg-white/10"
            href={`/eventos-moto/${item.slug}`}
            key={item.slug}
          >
            {item.name} ({item.count})
          </Link>
        ))}
      </div>
    </section>
  );
}
