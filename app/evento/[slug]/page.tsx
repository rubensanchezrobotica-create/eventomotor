import type { Metadata } from "next";
import { notFound } from "next/navigation";
import EventBadge from "@/components/EventBadge";
import { formatRange } from "@/lib/date-utils";
import { createSupabaseServerClient, mapEventRowToEventItem } from "@/lib/supabase";
import type { EventRow } from "@/lib/supabase";
import type { EventItem } from "@/types/event";

type EventPageProps = {
  params: Promise<{ slug: string }>;
};

function getSiteUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const vercelUrl = process.env.VERCEL_URL;

  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, "");
  }

  if (vercelUrl) {
    return `https://${vercelUrl}`;
  }

  return "http://localhost:3000";
}

async function getEventBySlug(slug: string): Promise<EventItem | null> {
  const supabase = createSupabaseServerClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("slug", slug)
    .eq("visible", true)
    .single();

  if (error || !data) {
    return null;
  }

  return mapEventRowToEventItem(data as EventRow);
}

function buildDescription(event: EventItem) {
  return `${event.title}: ${event.discipline} en ${event.venue}, ${event.city} (${event.province}), del ${event.start} al ${event.end}.`;
}

function buildJsonLd(event: EventItem, url: string) {
  return {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: event.title,
    description: buildDescription(event),
    startDate: event.start,
    endDate: event.end,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    url,
    location: {
      "@type": "Place",
      name: event.venue,
      address: {
        "@type": "PostalAddress",
        addressLocality: event.city,
        addressRegion: event.province,
        addressCountry: "ES",
      },
    },
    organizer: event.source
      ? {
          "@type": "Organization",
          name: event.source,
          url: event.sourceUrl || undefined,
        }
      : undefined,
  };
}

export async function generateMetadata({ params }: EventPageProps): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEventBySlug(slug);

  if (!event) {
    return {};
  }

  const url = `${getSiteUrl()}/evento/${event.slug || slug}`;
  const description = buildDescription(event);

  return {
    title: `${event.title} | EventoMotor`,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: `${event.title} | EventoMotor`,
      description,
      url,
      siteName: "EventoMotor",
      type: "website",
    },
  };
}

export default async function EventPage({ params }: EventPageProps) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);

  if (!event) {
    notFound();
  }

  const url = `${getSiteUrl()}/evento/${event.slug || slug}`;
  const jsonLd = buildJsonLd(event, url);

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <article className="mx-auto max-w-4xl">
        <a className="text-sm font-bold text-orange-200 hover:text-orange-100" href="/">
          Volver al calendario
        </a>

        <header className="mt-8 border-b border-white/10 pb-8">
          <div className="mb-4 flex flex-wrap gap-2">
            <EventBadge discipline={event.discipline} />
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-zinc-300">
              {event.level}
            </span>
            {event.featured ? (
              <span className="rounded-full bg-yellow-300 px-3 py-1 text-xs font-black text-zinc-950">
                Destacado
              </span>
            ) : null}
          </div>

          <h1 className="text-4xl font-black leading-tight text-white sm:text-5xl">
            {event.title}
          </h1>
          <p className="mt-4 text-lg text-zinc-300">{event.championship}</p>
        </header>

        <section className="mt-8 grid gap-4 sm:grid-cols-2">
          <Info label="Fecha" value={`${formatRange(event)} de ${event.start.slice(0, 4)}`} />
          <Info label="Disciplina" value={event.discipline} />
          <Info label="Sede" value={event.venue} />
          <Info label="Ubicacion" value={`${event.city}, ${event.province}`} />
          <Info label="Region" value={event.region} />
          <Info label="Fuente" value={event.source} />
        </section>

        <section className="mt-8 flex flex-wrap gap-3">
          {event.sourceUrl ? (
            <a
              className="rounded-2xl bg-white px-5 py-3 font-black text-zinc-950 hover:bg-orange-200"
              href={event.sourceUrl}
              rel="noreferrer"
              target="_blank"
            >
              Fuente oficial
            </a>
          ) : null}
          {event.ticketUrl ? (
            <a
              className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-black text-white hover:bg-white/10"
              href={event.ticketUrl}
              rel="noreferrer"
              target="_blank"
            >
              Entradas / info
            </a>
          ) : null}
        </section>

        {event.tags.length ? (
          <section className="mt-8 flex flex-wrap gap-2">
            {event.tags.map((tag) => (
              <span
                className="rounded-full bg-white/5 px-3 py-1 text-sm text-zinc-400"
                key={`${event.id}-${tag}`}
              >
                #{tag}
              </span>
            ))}
          </section>
        ) : null}
      </article>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <p className="text-xs uppercase tracking-widest text-zinc-500">{label}</p>
      <p className="mt-2 font-bold text-white">{value}</p>
    </div>
  );
}
