import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildFaqPageJsonLd,
  getEventSeoOverride,
  LA_BANEZA_EVENT_SLUG,
} from "@/lib/event-seo-overrides";
import { getOpportunityPage, buildOpportunityMetadata } from "@/lib/opportunity-pages";
import { SITE_NAME, SITE_URL } from "@/lib/seo";
import type { EventItem } from "@/types/event";
import {
  buildEventBreadcrumbJsonLd,
  buildEventJsonLd,
  buildEventMetadata,
} from "@/lib/event-page-seo";

const CANONICAL = `${SITE_URL}/evento/${LA_BANEZA_EVENT_SLUG}`;
const IMAGE = "https://images.example.com/la-baneza-2026.jpg";
const OFFICIAL_TITLE = "LXV Gran Premio de Velocidad Ciudad de La Bañeza 2026";
const SEO_TITLE = "Gran Premio de La Bañeza 2026: programa y horarios | EventoMotor";
const SEO_DESCRIPTION =
  "Consulta las fechas, el programa y todos los horarios del Gran Premio de La Bañeza 2026, del 7 al 9 de agosto, con entrenamientos y carreras.";

function eventFixture(overrides: Partial<EventItem> = {}): EventItem {
  return {
    id: "la-baneza",
    slug: LA_BANEZA_EVENT_SLUG,
    title: OFFICIAL_TITLE,
    championship: "Gran Premio de La Bañeza",
    discipline: "Velocidad",
    start: "2026-08-07",
    end: "2026-08-09",
    venue: "Circuito urbano de La Bañeza",
    city: "La Bañeza",
    province: "León",
    region: "Castilla y León",
    country: "ES",
    level: "Nacional",
    source: "Moto Club Bañezano",
    sourceUrl: "https://www.motoclubbanezano.es/",
    officialUrl: "https://www.motoclubbanezano.es/",
    ticketUrl: "",
    registrationUrl: "",
    imageUrl: IMAGE,
    address: "La Bañeza, León",
    organizerName: "Moto Club Bañezano",
    organizerUrl: "https://www.motoclubbanezano.es/",
    tags: ["Velocidad", "León"],
    vehicleType: "moto",
    featured: true,
    ...overrides,
  };
}

function absoluteTitle(metadata: ReturnType<typeof buildEventMetadata>) {
  assert.equal(typeof metadata.title, "object");
  return (metadata.title as { absolute: string }).absolute;
}

test("La Bañeza usa el title editorial con una sola aparición de EventoMotor", () => {
  const metadata = buildEventMetadata(eventFixture(), SITE_URL, LA_BANEZA_EVENT_SLUG, {
    title: OFFICIAL_TITLE,
    description: "Fallback description",
  });
  const title = absoluteTitle(metadata);

  assert.equal(title, SEO_TITLE);
  assert.equal(title.split(SITE_NAME).length - 1, 1);
  assert.equal(metadata.description, SEO_DESCRIPTION);
});

test("canonical, Open Graph y Twitter conservan URL, imagen y contenido editorial", () => {
  const metadata = buildEventMetadata(eventFixture(), SITE_URL, LA_BANEZA_EVENT_SLUG, {
    title: OFFICIAL_TITLE,
    description: "Fallback description",
  });
  const openGraph = metadata.openGraph as {
    title?: string;
    description?: string;
    url?: string;
    siteName?: string;
    type?: string;
    images?: unknown;
  };
  const twitter = metadata.twitter as {
    card?: string;
    title?: string;
    images?: unknown;
  };

  assert.equal(metadata.alternates?.canonical, CANONICAL);
  assert.equal(openGraph?.title, SEO_TITLE);
  assert.equal(openGraph?.description, SEO_DESCRIPTION);
  assert.equal(openGraph?.url, CANONICAL);
  assert.equal(openGraph?.siteName, SITE_NAME);
  assert.equal(openGraph?.type, "article");
  assert.deepEqual(openGraph?.images, [{
    url: IMAGE,
    alt: `Imagen representativa de evento de motor para ${OFFICIAL_TITLE}`,
  }]);
  assert.equal(twitter.card, "summary_large_image");
  assert.equal(twitter.title, SEO_TITLE);
  assert.deepEqual(twitter.images, [IMAGE]);
});

test("el override no cambia el fallback de otros eventos", () => {
  const other = eventFixture({
    slug: "prueba-velocidad-2026-09-01",
    title: "Prueba de Velocidad 2026",
    start: "2026-09-01",
    end: "2026-09-01",
    city: "Madrid",
    province: "Madrid",
    region: "Comunidad de Madrid",
  });
  const metadata = buildEventMetadata(other, SITE_URL, other.slug!, {
    title: "Prueba de Velocidad 2026 | Madrid, Madrid | 1 de septiembre de 2026",
    description: "Prueba de Velocidad 2026: evento de velocidad en Madrid.",
  });

  assert.equal(getEventSeoOverride(other.slug), undefined);
  assert.equal(
    absoluteTitle(metadata),
    "Prueba de Velocidad 2026 | Madrid, Madrid | 1 de septiembre de 2026 | EventoMotor",
  );
  assert.match(String(metadata.description), /Prueba de Velocidad 2026/);
});

test("el H1 y las migas conservan el título oficial y el slug canónico", () => {
  const source = readFileSync(new URL("../components/events/detail/EventDetailView.tsx", import.meta.url), "utf8");
  const breadcrumbs = buildEventBreadcrumbJsonLd(eventFixture(), CANONICAL, SITE_URL);

  assert.match(source, /<h1[^>]*>\{event\.title\}<\/h1>/);
  assert.match(source, /<li aria-current="page">\{event\.title\}<\/li>/);
  assert.deepEqual(breadcrumbs.itemListElement.map(({ name }) => name), [
    "Inicio",
    "Calendario",
    OFFICIAL_TITLE,
  ]);
  assert.equal(breadcrumbs.itemListElement[2]?.item, CANONICAL);
});

test("FAQ visible y FAQPage nacen de las mismas preguntas y respuestas", () => {
  const faqItems = getEventSeoOverride(LA_BANEZA_EVENT_SLUG)?.faqItems;
  assert.ok(faqItems);

  const faqSource = readFileSync(
    new URL("../components/events/detail/EventFaq.tsx", import.meta.url),
    "utf8",
  );
  const faqJsonLd = buildFaqPageJsonLd(faqItems);

  assert.match(faqSource, /items\.map/);
  assert.match(faqSource, /<h3>\{item\.question\}<\/h3>/);
  assert.match(faqSource, /<p>\{item\.answer\}<\/p>/);
  assert.deepEqual(
    faqJsonLd.mainEntity.map((item) => ({
      question: item.name,
      answer: item.acceptedAnswer.text,
    })),
    faqItems.map((item) => ({ question: item.question, answer: item.answer })),
  );
});

test("Event JSON-LD usa datos reales y no inventa ofertas, precio ni coordenadas", () => {
  const jsonLd = buildEventJsonLd(eventFixture(), CANONICAL, IMAGE, SEO_DESCRIPTION);
  const location = jsonLd.location as Record<string, unknown>;

  assert.equal(jsonLd.name, OFFICIAL_TITLE);
  assert.equal(jsonLd.startDate, "2026-08-07");
  assert.equal(jsonLd.endDate, "2026-08-09");
  assert.equal(jsonLd.url, CANONICAL);
  assert.equal(jsonLd.eventStatus, "https://schema.org/EventScheduled");
  assert.equal(jsonLd.eventAttendanceMode, "https://schema.org/OfflineEventAttendanceMode");
  assert.equal("offers" in jsonLd, false);
  assert.equal("price" in jsonLd, false);
  assert.equal("geo" in location, false);
});

test("los títulos editoriales preexistentes ignoran la plantilla sin duplicar la marca", () => {
  const page = getOpportunityPage("eventos-motor-castilla-y-leon");
  const metadata = buildOpportunityMetadata(page);

  assert.equal(typeof metadata.title, "object");
  assert.equal((metadata.title as { absolute: string }).absolute.split(SITE_NAME).length - 1, 1);
});
