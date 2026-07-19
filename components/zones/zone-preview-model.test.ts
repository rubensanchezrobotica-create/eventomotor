import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { join } from "node:path";
import type { EventItem } from "@/types/event";
import {
  buildZonePreviewMetadata,
  buildZonePreviewData,
  classifyZoneDisciplineGroup,
  createWeekendZoneFilters,
  featuredZoneProvinces,
  filterZoneEvents,
  getZoneWeekendRange,
  hasAdvancedZoneFilters,
  hasSpecificZoneFilters,
  isZonePreviewAvailable,
  isZonePreviewId,
  nextZoneVisibleLimit,
  normalizeZoneLocality,
  normalizeZoneProvince,
  parseZoneFilters,
  sortUpcomingZoneEvents,
  type ZoneFilters,
  visibleZoneLocalities,
  visibleZoneProvinces,
  ZONE_PERIOD_TABS,
  zoneEventDateLabel,
  zoneFamilySummary,
  zoneMobileResultTitle,
  zoneResultTitle,
  zoneResultTitleParts,
} from "./zone-preview-model";

function event(overrides: Partial<EventItem> = {}): EventItem {
  return {
    id: "event",
    slug: "event",
    title: "Evento de prueba",
    championship: "",
    discipline: "Rally",
    start: "2026-07-20",
    end: "2026-07-20",
    venue: "Recinto",
    city: "Madrid",
    province: "Madrid",
    region: "Comunidad de Madrid",
    level: "Nacional",
    source: "Test",
    sourceUrl: "https://example.com",
    ticketUrl: "",
    tags: [],
    featured: false,
    vehicleType: "coche",
    ...overrides,
  };
}

const now = new Date("2026-07-16T12:00:00");

test("asigna eventos a las seis zonas con el clasificador territorial compartido", () => {
  const fixtures = [
    event({ id: "norte", slug: "norte", province: "Navarra", region: "Navarra" }),
    event({ id: "centro", slug: "centro", province: "León", region: "Castilla y León" }),
    event({ id: "cataluna", slug: "cataluna", province: "Barcelona", region: "Cataluña" }),
    event({ id: "levante", slug: "levante", province: "Castellón", region: "Comunidad Valenciana" }),
    event({ id: "sur", slug: "sur", province: "Cáceres", region: "Extremadura" }),
    event({ id: "canarias", slug: "canarias", province: "Las Palmas", region: "Canarias" }),
  ];

  assert.deepEqual([
    buildZonePreviewData(fixtures, "norte", now).stats.total,
    buildZonePreviewData(fixtures, "centro", now).stats.total,
    buildZonePreviewData(fixtures, "cataluna-aragon", now).stats.total,
    buildZonePreviewData(fixtures, "levante", now).stats.total,
    buildZonePreviewData(fixtures, "sur", now).stats.total,
    buildZonePreviewData(fixtures, "canarias", now).stats.total,
  ], [1, 1, 1, 1, 1, 1]);
});

test("ordena futuros por inicio, fin y título normalizado", () => {
  const sorted = sortUpcomingZoneEvents([
    event({ id: "z", slug: "z", title: "Zeta", start: "2026-07-21" }),
    event({ id: "b", slug: "b", title: "Beta", start: "2026-07-20", end: "2026-07-22" }),
    event({ id: "a", slug: "a", title: "Álfa", start: "2026-07-20", end: "2026-07-21" }),
  ]);

  assert.deepEqual(sorted.map((item) => item.slug), ["a", "b", "z"]);
});

test("la vista predeterminada excluye pasados y conserva el histórico separado", () => {
  const data = buildZonePreviewData([
    event({ id: "past", slug: "past", start: "2026-07-01", end: "2026-07-02" }),
    event({ id: "future", slug: "future" }),
  ], "centro", now);

  assert.deepEqual(data.upcomingEvents.map((item) => item.slug), ["future"]);
  assert.deepEqual(data.pastEvents.map((item) => item.slug), ["past"]);
  assert.deepEqual(
    filterZoneEvents(data.events, { ...parseZoneFilters({}), period: "upcoming" }, now)
      .map((item) => item.slug),
    ["future"],
  );
});

test("normaliza Leon, León y aliases de provincias solo para presentación", () => {
  assert.equal(normalizeZoneProvince("Leon"), "León");
  assert.equal(normalizeZoneProvince("León"), "León");
  assert.equal(normalizeZoneProvince("La Coruña"), "A Coruña");
  assert.equal(normalizeZoneProvince("Castellon"), "Castellón");
});

test("normaliza localidades seguras y consolida sus variantes solo para presentación", () => {
  assert.equal(normalizeZoneLocality("Caceres"), "Cáceres");
  assert.equal(normalizeZoneLocality("Cáceres"), "Cáceres");
  assert.equal(normalizeZoneLocality("Almodovar del Rio"), "Almodóvar del Río");
  assert.equal(normalizeZoneLocality("Gijon"), "Gijón");
  assert.equal(normalizeZoneLocality("Alcaniz"), "Alcañiz");
  assert.equal(normalizeZoneLocality("Montmelo"), "Montmeló");
  assert.equal(normalizeZoneLocality("Nombre dudoso"), "Nombre dudoso");

  const data = buildZonePreviewData([
    event({ id: "caceres-plain", slug: "caceres-plain", city: "Caceres", province: "Cáceres", region: "Extremadura" }),
    event({ id: "caceres-accent", slug: "caceres-accent", city: "Cáceres", province: "Cáceres", region: "Extremadura" }),
  ], "sur", now);

  assert.deepEqual(data.localityOptions.map(({ label, count }) => ({ label, count })), [
    { label: "Cáceres", count: 2 },
  ]);
});

test("deduplica provincias normalizadas y cuenta disciplinas", () => {
  const data = buildZonePreviewData([
    event({ id: "leon-1", slug: "leon-1", province: "Leon", region: "Castilla y León" }),
    event({ id: "leon-2", slug: "leon-2", province: "León", region: "Castilla y León", discipline: "Montana" }),
  ], "centro", now);

  assert.deepEqual(data.provinceOptions.map(({ label, count }) => ({ label, count })), [
    { label: "León", count: 2 },
  ]);
  assert.equal(data.stats.provinces, 1);
  assert.equal(data.stats.disciplines, 2);
});

test("filtra por provincia, disciplina, agrupación y búsqueda", () => {
  const events = [
    event({ id: "rally", slug: "rally", title: "Rally de Ávila", city: "Ávila", province: "Ávila", region: "Castilla y León" }),
    event({ id: "track", slug: "track", title: "Tandas Jarama", discipline: "Circuito" }),
  ];
  const filters: ZoneFilters = {
    discipline: "rally",
    group: "rallyes",
    period: "upcoming",
    province: "avila",
    query: "avila",
  };

  assert.deepEqual(filterZoneEvents(events, filters, now).map((item) => item.slug), ["rally"]);

  assert.deepEqual(filterZoneEvents([
    event({
      id: "coruna",
      slug: "coruna",
      city: "Moeche",
      province: "A Coruna",
      region: "Galicia",
    }),
  ], {
    discipline: "",
    group: "",
    period: "upcoming",
    province: "a-coruna",
    query: "",
  }, now).map((item) => item.slug), ["coruna"]);
});

test("resuelve periodos de fin de semana, próximos 30 días, mes y todos", () => {
  const events = [
    event({ id: "weekend", slug: "weekend", start: "2026-07-18", end: "2026-07-18" }),
    event({ id: "thirty", slug: "thirty", start: "2026-08-10", end: "2026-08-10" }),
    event({ id: "later", slug: "later", start: "2026-09-10", end: "2026-09-10" }),
    event({ id: "past", slug: "past", start: "2026-06-01", end: "2026-06-01" }),
  ];
  const base = { discipline: "", group: "", province: "", query: "" } as const;

  assert.deepEqual(filterZoneEvents(events, { ...base, period: "weekend" }, now).map((item) => item.slug), ["weekend"]);
  assert.deepEqual(filterZoneEvents(events, { ...base, period: "next30" }, now).map((item) => item.slug), ["weekend", "thirty"]);
  assert.deepEqual(filterZoneEvents(events, { ...base, period: "month" }, now).map((item) => item.slug), ["weekend"]);
  assert.deepEqual(filterZoneEvents(events, { ...base, period: "all" }, now).map((item) => item.slug), ["weekend", "thirty", "later", "past"]);
});

test("calcula el próximo fin de semana de viernes a domingo", () => {
  assert.deepEqual(getZoneWeekendRange(now), {
    friday: "2026-07-17",
    saturday: "2026-07-18",
    sunday: "2026-07-19",
  });
});

test("el CTA de fin de semana selecciona el periodo exclusivo y conserva el listado filtrable", () => {
  const weekendFilters = createWeekendZoneFilters();
  const events = [
    event({ id: "friday", slug: "friday", start: "2026-07-17", end: "2026-07-17" }),
    event({ id: "saturday", slug: "saturday", start: "2026-07-18", end: "2026-07-18" }),
    event({ id: "later", slug: "later", start: "2026-07-25", end: "2026-07-25" }),
  ];

  assert.deepEqual(weekendFilters, {
    discipline: "",
    group: "",
    period: "weekend",
    province: "",
    query: "",
  });
  assert.deepEqual(
    filterZoneEvents(events, weekendFilters, now).map((item) => item.slug),
    ["friday", "saturday"],
  );
});

test("genera títulos territoriales dinámicos para cada periodo", () => {
  assert.equal(zoneResultTitle("upcoming", "Centro"), "Próximos eventos de motor en la zona centro");
  assert.equal(zoneResultTitle("weekend", "Centro"), "Eventos de este fin de semana en la zona centro");
  assert.equal(zoneResultTitle("next30", "Centro"), "Eventos de los próximos 30 días en la zona centro");
  assert.equal(zoneResultTitle("month", "Centro"), "Eventos de este mes en la zona centro");
  assert.equal(zoneResultTitle("all", "Centro"), "Todos los eventos de motor en la zona centro");
});

test("mantiene zona y nombre unidos semánticamente en todos los títulos dinámicos", () => {
  const zoneTitles = ["Norte", "Centro", "Cataluña / Aragón", "Levante", "Sur", "Canarias"];
  const periods = ["upcoming", "weekend", "next30", "month", "all"] as const;

  for (const zoneTitle of zoneTitles) {
    for (const period of periods) {
      const parts = zoneResultTitleParts(period, zoneTitle);
      assert.equal(parts.zone, `zona ${zoneTitle.toLowerCase()}`);
      assert.equal(`${parts.lead} ${parts.zone}`, zoneResultTitle(period, zoneTitle));
    }
  }
});

test("muestra diez localidades al inicio y permite expandir sin alterar el orden", () => {
  const localities = Array.from({ length: 12 }, (_, index) => ({
    count: 20 - index,
    key: `locality-${index}`,
    label: `Localidad ${index}`,
  }));

  assert.equal(visibleZoneLocalities(localities, false).length, 10);
  assert.deepEqual(
    visibleZoneLocalities(localities, false).map((item) => item.key),
    localities.slice(0, 10).map((item) => item.key),
  );
  assert.equal(visibleZoneLocalities(localities, true).length, 12);
});

test("excluye el fin de semana de los chips normales y limita provincias a ocho", () => {
  assert.deepEqual(
    ZONE_PERIOD_TABS.map((period) => [period.id, period.label]),
    [
      ["upcoming", "Próximos"],
      ["next30", "Próximos 30 días"],
      ["month", "Este mes"],
      ["all", "Todos los eventos"],
    ],
  );

  const provinces = Array.from({ length: 12 }, (_, index) => ({
    count: 20 - index,
    key: `province-${index}`,
    label: `Provincia ${index}`,
  }));
  assert.equal(visibleZoneProvinces(provinces, false).length, 8);
  assert.equal(visibleZoneProvinces(provinces, false, 6).length, 6);
  assert.equal(visibleZoneProvinces(provinces, true).length, 12);
});

test("abre los filtros avanzados únicamente cuando la URL contiene uno", () => {
  assert.equal(hasAdvancedZoneFilters(parseZoneFilters({})), false);
  assert.equal(hasAdvancedZoneFilters(parseZoneFilters({ provincia: "Madrid" })), false);
  assert.equal(hasAdvancedZoneFilters(parseZoneFilters({ periodo: "weekend" })), false);
  assert.equal(hasAdvancedZoneFilters(parseZoneFilters({ disciplina: "Rally" })), true);
  assert.equal(hasAdvancedZoneFilters(parseZoneFilters({ q: "Jarama" })), true);
  assert.equal(hasAdvancedZoneFilters(parseZoneFilters({ periodo: "next30" })), true);
  assert.equal(hasAdvancedZoneFilters(parseZoneFilters({ periodo: "month" })), true);
  assert.equal(hasAdvancedZoneFilters(parseZoneFilters({ periodo: "all" })), true);
});

test("genera los cinco títulos móviles compactos del listado", () => {
  assert.equal(zoneMobileResultTitle("upcoming"), "Eventos próximos");
  assert.equal(zoneMobileResultTitle("weekend"), "Eventos este fin de semana");
  assert.equal(zoneMobileResultTitle("next30"), "Eventos de los próximos 30 días");
  assert.equal(zoneMobileResultTitle("month"), "Eventos de este mes");
  assert.equal(zoneMobileResultTitle("all"), "Todos los eventos");
});

test("excluye provincias sin confirmar de la exploración sin perder eventos", () => {
  const data = buildZonePreviewData([
    event({ id: "madrid-1", slug: "madrid-1", province: "Madrid", region: "Comunidad de Madrid" }),
    event({ id: "madrid-2", slug: "madrid-2", province: "Madrid", region: "Comunidad de Madrid" }),
    event({ id: "pending", slug: "pending", province: "Por confirmar", region: "Comunidad de Madrid" }),
  ], "centro", now);
  const featured = featuredZoneProvinces(data.provinceOptions);

  assert.equal(data.stats.future, 3);
  assert.equal(data.provinceOptions.find((item) => item.label === "Por confirmar")?.count, 1);
  assert.deepEqual(featured.map(({ label, count }) => ({ label, count })), [
    { label: "Madrid", count: 2 },
  ]);
});

test("muestra el contador secundario solo con filtros territoriales o editoriales concretos", () => {
  assert.equal(hasSpecificZoneFilters(parseZoneFilters({})), false);
  assert.equal(hasSpecificZoneFilters(parseZoneFilters({ periodo: "weekend" })), false);
  assert.equal(hasSpecificZoneFilters(parseZoneFilters({ provincia: "Madrid" })), true);
  assert.equal(hasSpecificZoneFilters(parseZoneFilters({ disciplina: "Rally" })), true);
  assert.equal(hasSpecificZoneFilters(parseZoneFilters({ q: "Jarama" })), true);
  assert.equal(hasSpecificZoneFilters(parseZoneFilters({ tipo: "circuito" })), true);
});

test("las localidades usan exclusivamente el campo city y no la provincia como fallback", () => {
  const albaceteEvents = Array.from({ length: 15 }, (_, index) => event({
    id: `albacete-${index}`,
    slug: `albacete-${index}`,
    city: "Albacete",
    province: "Albacete",
    region: "Castilla-La Mancha",
  }));
  const data = buildZonePreviewData([
    ...albaceteEvents,
    event({
      id: "province-only",
      slug: "province-only",
      city: "",
      province: "Albacete",
      region: "Castilla-La Mancha",
    }),
  ], "centro", now);

  assert.equal(data.provinceOptions.find((item) => item.label === "Albacete")?.count, 16);
  assert.equal(data.localityOptions.find((item) => item.label === "Albacete")?.count, 15);
});

test("deduplica eventos por slug dentro de la zona", () => {
  const duplicate = event({ id: "one", slug: "same" });
  const data = buildZonePreviewData([duplicate, { ...duplicate, id: "two" }], "centro", now);
  assert.equal(data.stats.total, 1);
});

test("asigna cada evento a una única agrupación de disciplina", () => {
  assert.equal(classifyZoneDisciplineGroup(event({ title: "Concentración y Rally", discipline: "Clásicos" })), "rallyes");
  assert.equal(classifyZoneDisciplineGroup(event({ discipline: "Tandas" })), "circuito");
  assert.equal(classifyZoneDisciplineGroup(event({ discipline: "Motocross" })), "offroad");
  assert.equal(classifyZoneDisciplineGroup(event({ discipline: "Ferias" })), "clasicos-ferias");
  assert.equal(classifyZoneDisciplineGroup(event({ discipline: "Drift" })), "otros");
});

test("los recuentos de agrupaciones suman los próximos eventos", () => {
  const data = buildZonePreviewData([
    event({ id: "rally", slug: "rally", discipline: "Rally" }),
    event({ id: "track", slug: "track", discipline: "Circuito" }),
    event({ id: "offroad", slug: "offroad", discipline: "Trial" }),
    event({ id: "other", slug: "other", discipline: "Drift" }),
  ], "centro", now);

  assert.equal(
    data.disciplineGroups.reduce((total, group) => total + group.count, 0),
    data.stats.future,
  );
});

test("muestra únicamente familias con eventos y un resumen dinámico en las seis zonas", () => {
  const zoneFixtures = [
    { id: "norte", province: "Navarra", region: "Navarra", familyCount: 6 },
    { id: "centro", province: "Madrid", region: "Comunidad de Madrid", familyCount: 6 },
    { id: "cataluna-aragon", province: "Barcelona", region: "Cataluña", familyCount: 6 },
    { id: "levante", province: "Valencia", region: "Comunidad Valenciana", familyCount: 6 },
    { id: "sur", province: "Sevilla", region: "Andalucía", familyCount: 5 },
    { id: "canarias", province: "Las Palmas", region: "Canarias", familyCount: 3 },
  ] as const;
  const disciplines = ["Rally", "Concentración", "Circuito", "Trial", "Ferias", "Drift"];

  for (const fixture of zoneFixtures) {
    const events = disciplines.slice(0, fixture.familyCount).map((discipline, index) => event({
      id: `${fixture.id}-${index}`,
      slug: `${fixture.id}-${index}`,
      discipline,
      province: fixture.province,
      region: fixture.region,
    }));
    const data = buildZonePreviewData(events, fixture.id, now);

    assert.equal(data.disciplineGroups.length, fixture.familyCount);
    assert.ok(data.disciplineGroups.every((group) => group.count > 0));
    assert.equal(
      data.disciplineGroups.reduce((total, group) => total + group.count, 0),
      data.stats.future,
    );
  }

  assert.equal(zoneFamilySummary(29, 5), "Las 29 disciplinas de la zona se agrupan en cinco grandes familias.");
  assert.equal(zoneFamilySummary(10, 3), "Las 10 disciplinas de la zona se agrupan en tres grandes familias.");
  assert.equal(zoneFamilySummary(1, 1), "La disciplina de la zona se agrupa en una gran familia.");
});

test("calcula vehículos y estados públicos relevantes sin exponer estados internos", () => {
  const data = buildZonePreviewData([
    event({ id: "car", slug: "car", vehicleType: "coche", eventStatus: "tentative" }),
    event({ id: "bike", slug: "bike", vehicleType: "moto", eventStatus: "postponed" }),
    event({ id: "review", slug: "review", vehicleType: "moto", dataQuality: "needs_review" }),
  ], "centro", now);

  assert.deepEqual(data.vehicleOptions.map(({ label, count }) => ({ label, count })), [
    { label: "Moto", count: 2 },
    { label: "Coche", count: 1 },
  ]);
  assert.deepEqual(data.statusOptions.map(({ label, count }) => ({ label, count })), [
    { label: "Aplazado", count: 1 },
    { label: "Fecha provisional", count: 1 },
  ]);
});

test("normaliza parámetros y carga progresiva", () => {
  assert.deepEqual(parseZoneFilters({
    disciplina: "Clásicos",
    periodo: "next30",
    provincia: "León",
    q: "  jarama ",
    tipo: "circuito",
  }), {
    discipline: "clasicos",
    group: "circuito",
    period: "next30",
    province: "leon",
    query: "jarama",
  });
  assert.equal(nextZoneVisibleLimit(12, 12, 31), 24);
  assert.equal(nextZoneVisibleLimit(24, 12, 31), 31);
});

test("permite la preview salvo en el deployment Vercel Production", () => {
  assert.equal(isZonePreviewAvailable("preview"), true);
  assert.equal(isZonePreviewAvailable("production"), false);
  assert.equal(isZonePreviewAvailable("development"), true);
  assert.equal(isZonePreviewAvailable(undefined), true);
});

test("rechaza identificadores territoriales no permitidos antes de cargar datos", () => {
  assert.equal(isZonePreviewId("centro"), true);
  assert.equal(isZonePreviewId("zona-invalida"), false);
});

test("la metadata de preview conserva noindex, nofollow y omite canonical", () => {
  const metadata = buildZonePreviewMetadata("centro");

  assert.deepEqual(metadata.robots, {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  });
  assert.equal(metadata.alternates, undefined);
});

test("formatea rangos de tarjeta sin saltos automáticos", () => {
  assert.deepEqual(zoneEventDateLabel(event({ start: "2026-07-18", end: "2026-07-18" })), {
    kind: "single",
    day: "18",
    month: "JUL",
  });
  assert.deepEqual(zoneEventDateLabel(event({ start: "2026-07-17", end: "2026-07-19" })), {
    kind: "range",
    day: "17–19",
    month: "JUL",
  });
  assert.deepEqual(zoneEventDateLabel(event({ start: "2026-06-30", end: "2026-07-01" })), {
    kind: "cross-month",
    endDay: "01",
    endMonth: "JUL",
    startDay: "30",
    startMonth: "JUN",
  });
});

test("la preview integra divulgación progresiva móvil sin alterar la versión de escritorio", () => {
  const explorerSource = readFileSync(
    join(process.cwd(), "components/zones/ZoneExplorer.tsx"),
    "utf8",
  );
  const pageSource = readFileSync(
    join(process.cwd(), "components/zones/ZonePreviewPage.tsx"),
    "utf8",
  );
  const cssSource = readFileSync(
    join(process.cwd(), "components/zones/ZonePreview.module.css"),
    "utf8",
  );
  const routeSource = readFileSync(
    join(process.cwd(), "app/preview/zonas/[zone]/page.tsx"),
    "utf8",
  );
  const selectorSource = readFileSync(
    join(process.cwd(), "components/zones/ZoneMobileSelector.tsx"),
    "utf8",
  );
  const cardSource = readFileSync(
    join(process.cwd(), "components/zones/ZoneEventCard.tsx"),
    "utf8",
  );

  assert.match(explorerSource, /window\.history\.replaceState/);
  assert.match(explorerSource, /function activateWeekend\(\)/);
  assert.match(explorerSource, /aria-pressed=\{isWeekendActive\}/);
  assert.match(explorerSource, /hasAdvancedZoneFilters\(initialFilters\)/);
  assert.match(explorerSource, /aria-controls="zone-advanced-filters"/);
  assert.match(explorerSource, /aria-expanded=\{advancedFiltersOpen\}/);
  assert.match(explorerSource, /Más filtros/);
  assert.match(explorerSource, /Ocultar filtros/);
  assert.match(explorerSource, /Ver \{filteredEvents\.length\}/);
  assert.match(explorerSource, /Periodos principales/);
  assert.match(explorerSource, /Este fin de semana/);
  assert.match(explorerSource, /Periodos avanzados/);
  assert.match(explorerSource, /tabIndex=\{-1\}/);
  assert.match(explorerSource, /focus\(\{ preventScroll: true \}\)/);
  assert.match(explorerSource, /Ver todas las provincias/);
  assert.match(explorerSource, /Ocultar provincias/);
  assert.match(explorerSource, /Mostrar todas las localidades/);
  assert.match(explorerSource, /Ocultar localidades/);
  assert.match(explorerSource, /Familias de eventos/);
  assert.match(explorerSource, /zoneFamilySummary\(data\.stats\.disciplines, data\.disciplineGroups\.length\)/);
  assert.match(explorerSource, /zoneResultTitleParts/);
  assert.match(explorerSource, /styles\.zoneTitleSuffix/);
  assert.match(explorerSource, /zoneMobileResultTitle/);
  assert.match(explorerSource, /Explora la zona/);
  assert.match(explorerSource, /toggleExploreGroup\("provinces"\)/);
  assert.match(explorerSource, /toggleExploreGroup\("families"\)/);
  assert.match(explorerSource, /toggleExploreGroup\("localities"\)/);
  assert.match(explorerSource, /aria-controls="zone-provinces-panel"/);
  assert.match(explorerSource, /aria-controls="zone-families-panel"/);
  assert.match(explorerSource, /aria-controls="zone-localities-panel"/);
  assert.match(explorerSource, /featuredZoneProvinces\(data\.provinceOptions\)/);
  assert.doesNotMatch(explorerSource, /weekendDayCounts/);
  assert.doesNotMatch(explorerSource, /styles\.weekendSection/);
  assert.equal(
    explorerSource.match(/className=\{styles\.exploreSection\}/g)?.length,
    1,
  );
  assert.doesNotMatch(pageSource, /data\.weekendEvents\.slice/);
  assert.match(pageSource, /ZoneMobileSelector/);
  assert.match(pageSource, /styles\.heroSecondaryStat/);
  assert.match(pageSource, /¿Organizas un evento\?/);
  assert.doesNotMatch(explorerSource, /source="zone_preview_weekend"/);
  assert.match(selectorSource, /router\.push\(`\/preview\/zonas\/\$\{event\.target\.value\}`\)/);
  assert.match(selectorSource, /aria-label="Cambiar zona territorial"/);
  assert.match(cardSource, /className=\{styles\.multiDayMeta\}>Varios días/);
  assert.match(cssSource, /text-wrap:\s*balance/);
  assert.match(cssSource, /\.zoneTitleSuffix[\s\S]*white-space:\s*nowrap/);
  assert.match(cssSource, /@media \(max-width: 768px\)[\s\S]*\.desktopFilterGrid[\s\S]*display:\s*none/);
  assert.match(cssSource, /\.exploreAccordionPanel \{[\s\S]*display:\s*none/);
  assert.match(cssSource, /\.exploreAccordionPanelOpen \{[\s\S]*display:\s*block/);
  assert.match(cssSource, /\.cardEyebrows,[\s\S]*\.multiDayMeta[\s\S]*display:\s*none/);
  assert.match(routeSource, /isZonePreviewAvailable\(process\.env\.VERCEL_ENV\)/);
  assert.doesNotMatch(routeSource, /process\.env\.NODE_ENV/);
  assert.match(routeSource, /if \(!isZonePreviewId\(zone\)\) notFound\(\)/);
});
