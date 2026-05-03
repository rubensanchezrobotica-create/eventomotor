import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import EventBadge from "@/components/EventBadge";
import UnderConstruction from "@/components/UnderConstruction";
import { resolveEventListing } from "@/lib/event-listing-slugs";
import { getVisibleEvents } from "@/lib/public-events";
import { getSiteUrl } from "@/lib/site-url";
import { isUnderConstruction } from "@/lib/under-construction";

type ListingPageProps = {
  params: Promise<{ slug: string }>;
};

async function getListing(slug: string) {
  const events = await getVisibleEvents();

  return resolveEventListing(slug, events);
}

function getListingCopy(kind: "discipline" | "region", name: string) {
  if (kind === "discipline") {
    return {
      title: `Eventos de ${name} en Espana | EventoMotor`,
      heading: `Eventos de ${name}`,
      description: `Calendario de eventos de ${name} en Espana con fechas, sedes, ciudades y enlaces a fichas SEO.`,
    };
  }

  return {
    title: `Eventos de moto en ${name} | EventoMotor`,
    heading: `Eventos de moto en ${name}`,
    description: `Calendario de eventos de motociclismo en ${name} con disciplinas, fechas, sedes y fichas publicas.`,
  };
}

export async function generateMetadata({ params }: ListingPageProps): Promise<Metadata> {
  const { slug } = await params;
  const listing = await getListing(slug);

  if (!listing) {
    return {};
  }

  const copy = getListingCopy(listing.kind, listing.name);
  const url = `${getSiteUrl()}/eventos-moto/${listing.slug}`;

  return {
    title: copy.title,
    description: copy.description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: copy.title,
      description: copy.description,
      url,
      siteName: "EventoMotor",
      type: "website",
    },
  };
}

export default async function EventosMotoSlugPage({ params }: ListingPageProps) {
  if (isUnderConstruction()) {
    return <UnderConstruction />;
  }

  const { slug } = await params;
  const listing = await getListing(slug);

  if (!listing) {
    notFound();
  }

  const siteUrl = getSiteUrl();
  const copy = getListingCopy(listing.kind, listing.name);
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: copy.heading,
    itemListElement: listing.events.map((event, index) => ({
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
        <div className="flex flex-wrap gap-3 text-sm font-bold">
          <Link className="text-orange-200 hover:text-orange-100" href="/">
            Calendario
          </Link>
          <Link className="text-zinc-300 hover:text-white" href="/eventos-moto">
            Eventos moto
          </Link>
        </div>

        <header className="mt-8 border-b border-white/10 pb-8">
          <p className="text-sm font-bold uppercase tracking-widest text-orange-200">
            {listing.kind === "discipline" ? "Disciplina" : "Region"}
          </p>
          <h1 className="mt-3 text-4xl font-black leading-tight sm:text-6xl">
            {copy.heading}
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-zinc-300">{copy.description}</p>
        </header>

        <section className="mt-8 grid gap-4 md:grid-cols-2">
          {listing.events.map((event) => (
            <Link
              className="rounded-2xl border border-white/10 bg-white/5 p-5 hover:bg-white/10"
              href={`/evento/${event.slug}`}
              key={event.id}
            >
              <div className="mb-3">
                <EventBadge discipline={event.discipline} />
              </div>
              <h2 className="text-xl font-black text-white">{event.title}</h2>
              <p className="mt-2 text-sm text-zinc-400">{event.championship}</p>
              <dl className="mt-4 grid gap-2 text-sm text-zinc-300 sm:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase tracking-widest text-zinc-500">Fecha</dt>
                  <dd className="mt-1 font-bold">{event.start}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-widest text-zinc-500">Lugar</dt>
                  <dd className="mt-1 font-bold">
                    {event.city}, {event.province}
                  </dd>
                </div>
              </dl>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
