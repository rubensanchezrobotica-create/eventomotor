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
  buildEventSeoDescription,
  buildEventSeoTitle,
  buildMetadataDescription,
  isJaramaTrackdayEvent,
} from "@/lib/event-page-seo";

const CANONICAL = `${SITE_URL}/evento/${LA_BANEZA_EVENT_SLUG}`;
const IMAGE = "https://images.example.com/la-baneza-2026.jpg";
const OFFICIAL_TITLE = "LXV Gran Premio de Velocidad Ciudad de La Bañeza 2026";
const SEO_TITLE = "Gran Premio de La Bañeza 2026: programa y horarios | EventoMotor";
const SEO_DESCRIPTION =
  "Consulta las fechas, el programa y todos los horarios del Gran Premio de La Bañeza 2026, del 7 al 9 de agosto, con entrenamientos y carreras.";
const TWO_WHEELS_SLUG = "2-ruedas-valencia-2026-11-27";
const TWO_WHEELS_TITLE = "Salón 2 Ruedas Valencia 2026: horarios y entradas | EventoMotor";
const TWO_WHEELS_DESCRIPTION =
  "Salón 2 Ruedas del 27 al 29 de noviembre en Feria Valencia. Programa, exhibiciones y pruebas de motos. Entradas: 8 € online y 10 € en taquilla.";

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

function jaramaFixture(overrides: Partial<EventItem> = {}): EventItem {
  return eventFixture({
    id: "jarama-fixture",
    slug: "jarama-fixture-2026-08-22",
    title: "Evento Jarama 2026",
    championship: "",
    discipline: "Automovilismo",
    start: "2026-08-22",
    end: "2026-08-23",
    venue: "Circuito de Madrid Jarama - RACE",
    city: "San Sebastián de los Reyes",
    province: "Madrid",
    region: "Comunidad de Madrid",
    source: "Organizador oficial",
    sourceUrl: "https://example.com/evento",
    officialUrl: "https://example.com/evento",
    organizerName: "Organizador oficial",
    organizerUrl: "https://example.com/",
    tags: [],
    vehicleType: "coche",
    featured: false,
    ...overrides,
  });
}

const JARAMA_CLASSIFICATION_CASES: Array<{
  label: string;
  event: EventItem;
  expectedTrackday: boolean;
}> = [
  {
    label: "Hot Wheels",
    event: jaramaFixture({
      slug: "hot-wheels-legends-tour-espana-jarama-2026-09-19",
      title: "Hot Wheels Legends Tour España 2026",
      championship: "Exposición",
      discipline: "Ferias",
      tags: ["familiar", "exposición"],
    }),
    expectedTrackday: false,
  },
  {
    label: "F4",
    event: jaramaFixture({
      slug: "f4-spanish-championship-jarama-2026",
      title: "F4 Spain Jarama 2026",
      championship: "F4 Spanish Championship",
      discipline: "Monoplazas",
      tags: ["F4", "campeonato"],
    }),
    expectedTrackday: false,
  },
  {
    label: "Drift Masters",
    event: jaramaFixture({
      slug: "drift-masters-round-2-spain-2026-san-sebastian-de-los-reyes-2026-05-16",
      title: "Drift Masters Round 2 Spain 2026",
      championship: "Drift Masters",
      discipline: "Drift",
      tags: ["drift"],
    }),
    expectedTrackday: false,
  },
  {
    label: "test de Fórmula E",
    event: jaramaFixture({
      slug: "test-pretemporada-formula-e-jarama-2026-11-16",
      title: "Test de pretemporada Formula E Jarama 2026",
      championship: "Formula E",
      discipline: "Monoplazas eléctricos",
      tags: ["test", "Formula E"],
    }),
    expectedTrackday: false,
  },
  {
    label: "GP Camión",
    event: jaramaFixture({
      slug: "gran-premio-del-camion-jarama-2026-10-03",
      title: "Gran Premio del Camion Jarama 2026",
      championship: "FIA European Truck Racing Championship",
      discipline: "Camiones",
      tags: ["camiones", "gran premio"],
    }),
    expectedTrackday: false,
  },
  {
    label: "Jarama Classic",
    event: jaramaFixture({
      slug: "jarama-classic-2026",
      title: "Jarama Classic 2026",
      discipline: "Vehículos clásicos",
      tags: ["clásicos"],
    }),
    expectedTrackday: false,
  },
  {
    label: "trackday fuera de Jarama",
    event: jaramaFixture({
      slug: "tandas-libres-motorland-2026",
      title: "Tandas libres MotorLand Aragón 2026",
      discipline: "Track day",
      venue: "MotorLand Aragón",
      city: "Alcañiz",
      province: "Teruel",
      region: "Aragón",
      tags: ["rodada"],
    }),
    expectedTrackday: false,
  },
  {
    label: "venue genérico Circuito",
    event: jaramaFixture({
      slug: "campeonato-turismos-catalunya-2026",
      title: "Campeonato de Turismos Catalunya 2026",
      championship: "Campeonato de Turismos",
      discipline: "Turismos",
      venue: "Circuito de Barcelona-Catalunya",
      city: "Montmeló",
      province: "Barcelona",
      region: "Cataluña",
      tags: ["campeonato"],
    }),
    expectedTrackday: false,
  },
  {
    label: "EasyRace con tandas",
    event: jaramaFixture({
      slug: "tandas-libres-curso-jarama-easyrace-2026-09-04",
      title: "Tandas libres y curso Jarama Easyrace septiembre 2026",
      championship: "Tandas libres",
      discipline: "Tandas",
      start: "2026-09-04",
      end: "2026-09-04",
      tags: ["trackday"],
    }),
    expectedTrackday: true,
  },
  {
    label: "Tandas privadas Jarama",
    event: jaramaFixture({
      slug: "tandas-privadas-jarama-2026",
      title: "Tandas Privadas Jarama 2026",
      discipline: "Tandas privadas",
      tags: ["tandas", "rodada"],
    }),
    expectedTrackday: true,
  },
];

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

test("2 Ruedas aplica solo su metadata editorial y conserva la entidad del evento", () => {
  const event = eventFixture({
    id: "batch-2-ruedas-valencia-2026-11-27",
    slug: TWO_WHEELS_SLUG,
    title: "2 Ruedas Valencia",
    discipline: "Ferias",
    start: "2026-11-27",
    end: "2026-11-29",
    venue: "Feria Valencia",
    city: "Valencia",
    province: "Valencia",
  });
  const description = buildMetadataDescription(event);
  const canonical = `${SITE_URL}/evento/${TWO_WHEELS_SLUG}`;
  const metadata = buildEventMetadata(event, SITE_URL, TWO_WHEELS_SLUG, {
    title: buildEventSeoTitle(event),
    description,
  });
  const jsonLd = buildEventJsonLd(event, canonical, IMAGE, description);
  const openGraph = metadata.openGraph as { title?: string; description?: string; url?: string };
  const twitter = metadata.twitter as { title?: string; description?: string };

  assert.equal(getEventSeoOverride(TWO_WHEELS_SLUG)?.faqItems, undefined);
  assert.equal(absoluteTitle(metadata), TWO_WHEELS_TITLE);
  assert.equal(absoluteTitle(metadata).split(SITE_NAME).length - 1, 1);
  assert.equal(metadata.description, TWO_WHEELS_DESCRIPTION);
  assert.equal(openGraph.title, TWO_WHEELS_TITLE);
  assert.equal(openGraph.description, TWO_WHEELS_DESCRIPTION);
  assert.equal(openGraph.url, canonical);
  assert.equal(twitter.title, TWO_WHEELS_TITLE);
  assert.equal(twitter.description, TWO_WHEELS_DESCRIPTION);
  assert.equal(metadata.alternates?.canonical, canonical);
  assert.equal(event.title, "2 Ruedas Valencia");
  assert.equal(jsonLd.name, event.title);
  assert.equal(jsonLd.description, TWO_WHEELS_DESCRIPTION);
  assert.equal(jsonLd.startDate, "2026-11-27");
  assert.equal(jsonLd.endDate, "2026-11-29");
  assert.equal("offers" in jsonLd, false);
});

test("Comarca Norte aplica solo el override aprobado y conserva la entidad", () => {
  const slug = "rallye-comarca-norte-2026-11-28";
  const event = eventFixture({
    id: "batch-rallye-comarca-norte-2026-11-28",
    slug,
    title: "Rallye Comarca Norte 2026",
    discipline: "Rally",
    start: "2026-11-27",
    end: "2026-11-28",
    city: "Gran Canaria",
    province: "Las Palmas",
  });
  const canonical = SITE_URL + "/evento/" + slug;
  const description = buildMetadataDescription(event);
  const metadata = buildEventMetadata(event, SITE_URL, slug, {
    title: buildEventSeoTitle(event),
    description,
  });
  const jsonLd = buildEventJsonLd(event, canonical, IMAGE, description);
  const expectedTitle = "Rally Comarca Norte 2026: horarios, tramos e inscritos | EventoMotor";
  const expectedDescription =
    "Rally Comarca Norte de Gran Canaria, 27 y 28 de noviembre de 2026. Consulta el programa, los 11 tramos cronometrados y los 67 equipos inscritos.";
  const openGraph = metadata.openGraph as { title?: string; description?: string; url?: string };
  const twitter = metadata.twitter as { title?: string; description?: string };

  assert.equal(getEventSeoOverride(slug)?.faqItems, undefined);
  assert.equal(absoluteTitle(metadata), expectedTitle);
  assert.equal(metadata.description, expectedDescription);
  assert.equal(openGraph.title, expectedTitle);
  assert.equal(openGraph.description, expectedDescription);
  assert.equal(openGraph.url, canonical);
  assert.equal(twitter.title, expectedTitle);
  assert.equal(twitter.description, expectedDescription);
  assert.equal(metadata.alternates?.canonical, canonical);
  assert.equal(event.title, "Rallye Comarca Norte 2026");
  assert.equal(jsonLd.name, event.title);
  assert.equal(jsonLd.description, expectedDescription);
  assert.equal(jsonLd.startDate, "2026-11-27");
  assert.equal(jsonLd.endDate, "2026-11-28");
  assert.equal("offers" in jsonLd, false);
});

for (const candidate of [
  {
    id: "batch-feria-del-automovil-valencia-2026-12-04",
    slug: "feria-del-automovil-valencia-2026-12-04",
    title: "Feria del Automóvil Valencia 2026",
    start: "2026-12-04",
    end: "2026-12-06",
    seoTitle: "Feria del Automóvil Valencia 2026: horarios y entradas | EventoMotor",
    seoDescription:
      "Del 4 al 6 de diciembre en Feria Valencia, de 10:00 a 20:00. Coches nuevos, de ocasión y km 0. Entradas: 6 € online y 8 € en taquilla.",
  },
  {
    id: "batch-l07-enduroc-2026-12-05",
    slug: "enduroc-2026-12-05",
    title: "EnduRoc 2026",
    start: "2026-12-05",
    end: "2026-12-06",
    seoTitle: "EnduRoc 2026 en Les Comes: programa y horarios | EventoMotor",
    seoDescription:
      "EnduRoc Les Comes, 5 y 6 de diciembre en Súria (Barcelona). Consulta los horarios de las carreras, SuperTrail, Superpole e información para asistir.",
  },
]) {
  test(`${candidate.title} aplica solo metadata editorial y conserva la entidad`, () => {
    const event = eventFixture(candidate);
    const canonical = `${SITE_URL}/evento/${candidate.slug}`;
    const description = buildMetadataDescription(event);
    const metadata = buildEventMetadata(event, SITE_URL, candidate.slug, {
      title: buildEventSeoTitle(event),
      description,
    });
    const jsonLd = buildEventJsonLd(event, canonical, IMAGE, description);
    const openGraph = metadata.openGraph as { title?: string; description?: string; url?: string };
    const twitter = metadata.twitter as { title?: string; description?: string };

    assert.equal(getEventSeoOverride(candidate.slug)?.faqItems, undefined);
    assert.equal(absoluteTitle(metadata), candidate.seoTitle);
    assert.equal(candidate.seoTitle.split(SITE_NAME).length - 1, 1);
    assert.equal(metadata.description, candidate.seoDescription);
    assert.equal(openGraph.title, candidate.seoTitle);
    assert.equal(openGraph.description, candidate.seoDescription);
    assert.equal(openGraph.url, canonical);
    assert.equal(twitter.title, candidate.seoTitle);
    assert.equal(twitter.description, candidate.seoDescription);
    assert.equal(metadata.alternates?.canonical, canonical);
    assert.equal(event.title, candidate.title);
    assert.equal(jsonLd.name, candidate.title);
    assert.equal(jsonLd.description, candidate.seoDescription);
    assert.equal(jsonLd.startDate, candidate.start);
    assert.equal(jsonLd.endDate, candidate.end);
    assert.equal("offers" in jsonLd, false);
  });
}
for (const slug of [
  "gran-premio-motul-de-la-comunitat-valenciana-2026-11-27",
  "subida-a-trassierra-2026-11-28",
  "17e-ral-li-vidreres-2026-11-28",
]) {
  test(`2 Ruedas no altera la metadata de ${slug}`, () => {
    const event = eventFixture({ slug, title: slug });
    const description = buildMetadataDescription(event);
    const metadata = buildEventMetadata(event, SITE_URL, slug, {
      title: buildEventSeoTitle(event),
      description,
    });

    assert.equal(getEventSeoOverride(slug), undefined);
    assert.ok(description.startsWith(buildEventSeoDescription(event).slice(0, 80)));
    assert.equal(metadata.description, description);
    assert.equal(absoluteTitle(metadata), `${buildEventSeoTitle(event)} | EventoMotor`);
  });
}

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
  const source = readFileSync(new URL("../components/redesign-v2/event-detail/EventDetailV2.tsx", import.meta.url), "utf8");
  const shell = readFileSync(new URL("../components/redesign-v2/site/V2InteriorShell.tsx", import.meta.url), "utf8");
  const breadcrumbs = buildEventBreadcrumbJsonLd(eventFixture(), CANONICAL, SITE_URL);

  assert.match(source, /title=\{model\.title\}/);
  assert.match(source, /\{ label: model\.title \}/);
  assert.match(shell, /<h1[\s\S]*?>\{title\}<\/h1>/);
  assert.match(shell, /<span aria-current="page">\{item\.label\}<\/span>/);
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
    new URL("../components/redesign-v2/event-detail/EventDetailV2.tsx", import.meta.url),
    "utf8",
  );
  const faqJsonLd = buildFaqPageJsonLd(faqItems);

  assert.match(faqSource, /publicContext\.faqItems\.map/);
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

test("un evento cancelado conserva fechas y URL con EventCancelled", () => {
  const event = eventFixture({ eventStatus: "cancelled" });
  const jsonLd = buildEventJsonLd(event, CANONICAL, IMAGE, SEO_DESCRIPTION);
  assert.equal(jsonLd.eventStatus, "https://schema.org/EventCancelled");
  assert.equal(jsonLd.url, CANONICAL);
  assert.equal(jsonLd.startDate, "2026-08-07");
  assert.equal(jsonLd.endDate, "2026-08-09");
});

test("Event JSON-LD conserva la identidad semántica del organizador", () => {
  const fctaUrl = "https://www.fcta.es/competiciones/1c1357bf-c552-4993-96d9-3d9c42bdc225";
  const municipalUrl = "https://aytovaldemorillo.com/xv-concentracion-clasicos-sierra-oeste-de-madrid/";
  const cefmxUrl = "https://cefmx.com/";
  const cefmxEventUrl = "https://cefmx.com/eventos/freestyle-murcia-2026/";

  const faldaJsonLd = buildEventJsonLd(eventFixture({
    organizerName: "Heras Sport",
    organizerUrl: "",
    source: "Federación Cántabra de Automovilismo",
    sourceUrl: fctaUrl,
    officialUrl: fctaUrl,
  }), CANONICAL, IMAGE, SEO_DESCRIPTION);
  assert.deepEqual(faldaJsonLd.organizer, {
    "@type": "Organization",
    name: "Heras Sport",
  });
  assert.equal(faldaJsonLd.sameAs, fctaUrl);

  const cefmxJsonLd = buildEventJsonLd(eventFixture({
    organizerName: "CEFMX",
    organizerUrl: cefmxUrl,
    source: "CEFMX",
    sourceUrl: cefmxEventUrl,
    officialUrl: cefmxEventUrl,
  }), CANONICAL, IMAGE, SEO_DESCRIPTION);
  assert.deepEqual(cefmxJsonLd.organizer, {
    "@type": "Organization",
    name: "CEFMX",
    url: cefmxUrl,
  });

  const valdemorilloJsonLd = buildEventJsonLd(eventFixture({
    organizerName: "Asociación Clásicos Ruta Imperial",
    organizerUrl: "",
    source: "Ayuntamiento de Valdemorillo",
    sourceUrl: municipalUrl,
    officialUrl: municipalUrl,
  }), CANONICAL, IMAGE, SEO_DESCRIPTION);
  assert.deepEqual(valdemorilloJsonLd.organizer, {
    "@type": "Organization",
    name: "Asociación Clásicos Ruta Imperial",
  });
  assert.equal(valdemorilloJsonLd.sameAs, municipalUrl);

  const sourceFallbackJsonLd = buildEventJsonLd(eventFixture({
    organizerName: "",
    organizerUrl: "",
    source: "Federación de prueba",
    sourceUrl: "https://federacion.example/evento",
    officialUrl: "",
  }), CANONICAL, IMAGE, SEO_DESCRIPTION);
  assert.deepEqual(sourceFallbackJsonLd.organizer, {
    "@type": "Organization",
    name: "Federación de prueba",
    url: "https://federacion.example/evento",
  });
  assert.equal(sourceFallbackJsonLd.sameAs, "https://federacion.example/evento");
});

test("los títulos editoriales preexistentes ignoran la plantilla sin duplicar la marca", () => {
  const page = getOpportunityPage("eventos-motor-castilla-y-leon");
  const metadata = buildOpportunityMetadata(page);

  assert.equal(typeof metadata.title, "object");
  assert.equal((metadata.title as { absolute: string }).absolute.split(SITE_NAME).length - 1, 1);
});

for (const fixture of JARAMA_CLASSIFICATION_CASES) {
  test(`Jarama clasifica ${fixture.label} sin perder la identidad del evento`, () => {
    const { event, expectedTrackday } = fixture;
    const title = buildEventSeoTitle(event);
    const description = buildMetadataDescription(event);
    const canonical = `${SITE_URL}/evento/${event.slug}`;
    const metadata = buildEventMetadata(event, SITE_URL, event.slug!, { title, description });
    const jsonLd = buildEventJsonLd(event, canonical, IMAGE, description);
    const genericJaramaTitle = "Tandas Privadas Jarama 2026";

    assert.equal(isJaramaTrackdayEvent(event), expectedTrackday);
    assert.ok(title.startsWith(event.title), `title sin identidad para ${fixture.label}`);
    assert.ok(description.includes(event.title), `description sin identidad para ${fixture.label}`);
    assert.ok(absoluteTitle(metadata).startsWith(event.title));
    assert.equal((metadata.openGraph as { description?: string }).description, description);
    assert.equal((metadata.twitter as { description?: string }).description, description);
    assert.equal(jsonLd.name, event.title);
    assert.equal(jsonLd.description, description);

    if (!expectedTrackday || event.title !== genericJaramaTitle) {
      assert.equal(title.includes(genericJaramaTitle), false);
      assert.equal(description.includes(genericJaramaTitle), false);
    }
  });
}
