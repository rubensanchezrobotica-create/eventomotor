import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  buildDisciplinePreviewData,
  buildDisciplinePublicMetadata,
  filterDisciplineEvents,
  parseDisciplineFilters,
} from "@/components/disciplines/discipline-preview-model";
import { SEO_DISCIPLINES } from "@/lib/seo-taxonomy";
import type { EventItem } from "@/types/event";
import {
  buildPublicDisciplineDetailPageModel,
  publicDisciplineDetailHref,
  resolveDisciplineDetailDefinition,
  resolveDisciplineHeroVisual,
} from "./discipline-detail-model";

const root = process.cwd();
const source = (path: string) => readFileSync(join(root, path), "utf8");
const publicRoute = source("app/disciplinas/[slug]/page.tsx");
const previewRoute = source("app/preview/redesign-v2/disciplinas/[slug]/page.tsx");
const page = source("components/redesign-v2/discipline-detail/DisciplineDetailPage.tsx");
const filtersUi = source("components/redesign-v2/discipline-detail/DisciplinePublicFilters.client.tsx");
const editorial = source("components/redesign-v2/discipline-detail/DisciplinePublicEditorial.client.tsx");
const legacy = source("components/disciplines/DisciplinePreviewPage.tsx");
const legacyHistory = source("components/disciplines/DisciplineHistory.tsx");
const sitemap = source("app/sitemap.ts");
const now = new Date("2026-08-18T10:00:00Z");

function event(id: string, discipline: string, overrides: Partial<EventItem> = {}): EventItem {
  return {
    id,
    slug: `evento-${id}`,
    title: `Evento ${id}`,
    championship: discipline,
    discipline,
    start: "2026-08-22",
    end: "2026-08-22",
    venue: "Recinto",
    city: "Madrid",
    province: "Madrid",
    region: "Comunidad de Madrid",
    level: "Publicado",
    source: "Test",
    sourceUrl: "https://example.com",
    ticketUrl: "",
    tags: [discipline],
    vehicleType: "coche",
    vehicle_type: "coche",
    featured: false,
    visible: true,
    ...overrides,
  } as EventItem;
}

test("A10F publica los ocho slugs V2 sin alterar SEO, sitemap ni noindex de Preview", () => {
  assert.equal(SEO_DISCIPLINES.length, 8);
  for (const definition of SEO_DISCIPLINES) {
    assert.equal(resolveDisciplineDetailDefinition(definition.slug)?.slug, definition.slug);
    assert.ok(resolveDisciplineHeroVisual(definition.slug)?.src);
    const metadata = buildDisciplinePublicMetadata(definition.slug);
    assert.equal(metadata.title, definition.metaTitle);
    assert.equal(metadata.description, definition.metaDescription);
    assert.equal(metadata.alternates?.canonical, `https://www.eventomotor.com/disciplinas/${definition.slug}`);
    assert.deepEqual(metadata.robots, { follow: true, index: true });
  }
  assert.equal(resolveDisciplineDetailDefinition("inventada"), null);
  assert.match(publicRoute, /if \(!isDisciplineSlug\(slug\)\) notFound\(\)/);
  assert.match(publicRoute, /return buildDisciplinePublicMetadata\(slug\)/);
  assert.match(publicRoute, /export const dynamic = "force-dynamic"/);
  assert.match(sitemap, /SEO_DISCIPLINES\.map/);
  assert.match(previewRoute, /index: false/);
  assert.match(previewRoute, /routeContext="preview"/);
});

test("A10F conserva el conjunto exacto del filtro público para seis params y combinaciones", () => {
  const fixtures = [
    event("rally-madrid", "Rally", { title: "Rally Jarama", city: "Madrid" }),
    event("rallysprint-madrid", "Rallysprint", { title: "Rallysprint Madrid", city: "Madrid" }),
    event("rally-galicia", "Rally", { title: "Rally Ferrol", city: "Ferrol", province: "A Coruña", region: "Galicia" }),
    event("rally-moto", "Rally", { title: "Rally de motos", city: "Oviedo", province: "Asturias", vehicleType: "moto", vehicle_type: "moto" }),
    event("rally-past", "Rally", { title: "Rally anterior", start: "2026-08-10", end: "2026-08-10" }),
    event("other", "Circuito"),
    event("hidden", "Rally", { visible: false }),
  ];
  const data = buildDisciplinePreviewData(fixtures, "rallyes", now);
  const cases = [
    {},
    { q: "Jarama" },
    { provincia: "madrid" },
    { modalidad: "rallysprint-rallycrono" },
    { vehiculo: "moto" },
    { localidad: "ferrol" },
    { periodo: "all" },
    { provincia: "madrid", modalidad: "rallysprint-rallycrono" },
  ];

  for (const params of cases) {
    const filters = parseDisciplineFilters(params);
    const expected = filterDisciplineEvents(data.events, filters, now).map((item) => item.id);
    const actual = buildPublicDisciplineDetailPageModel(fixtures, data, filters, { now, page: 1 });
    assert.deepEqual(actual.items.map(({ event: item }) => item.id), expected, JSON.stringify(params));
    assert.equal(actual.filteredCount, expected.length, JSON.stringify(params));
  }
});

test("A10F preserva filtros en paginación, clampa página inválida y no reutiliza ruta Preview", () => {
  const fixtures = Array.from({ length: 27 }, (_, index) => event(String(index), "Rally", {
    title: `Rally ${index}`,
    start: `2026-09-${String(index + 1).padStart(2, "0")}`,
    end: `2026-09-${String(index + 1).padStart(2, "0")}`,
  }));
  const data = buildDisciplinePreviewData(fixtures, "rallyes", now);
  const filters = parseDisciplineFilters({ provincia: "madrid", q: "Rally" });
  const model = buildPublicDisciplineDetailPageModel(fixtures, data, filters, { now, page: 99 });
  assert.equal(model.page, 3);
  assert.equal(model.pageCount, 3);
  assert.equal(model.items.length, 3);
  assert.equal(
    publicDisciplineDetailHref("rallyes", 2, filters),
    "/disciplinas/rallyes?provincia=madrid&q=Rally&page=2",
  );
  assert.doesNotMatch(publicDisciplineDetailHref("rallyes", 2, filters), /preview/);
});

test("A10F adapta contexto, enlaces, guardado y controles URL sin lógica de filtros duplicada", () => {
  assert.match(publicRoute, /navigationMode="public"/);
  assert.match(publicRoute, /routeContext="public"/);
  assert.match(page, /routeContext === "public"\s*\? `\/evento\//);
  assert.match(page, /routeContext === "public" \? "\/calendario"/);
  assert.match(page, /<DisciplinePublicFilters/);
  assert.match(page, /<DisciplinePublicEditorial/);
  assert.equal((page.match(/<EventRetentionActions/g) ?? []).length, 1);
  assert.match(filtersUi, /useSearchParams\(\)/);
  assert.match(filtersUi, /router\.push\(publicDisciplineDetailHref\(slug, 1, filters\)/);
  assert.match(filtersUi, /name="provincia"/);
  assert.match(filtersUi, /name="modalidad"/);
  assert.match(filtersUi, /name="vehiculo"/);
  assert.match(filtersUi, /name="localidad"/);
  assert.match(filtersUi, /name="periodo"/);
  assert.match(filtersUi, /name="q"/);
  assert.match(filtersUi, /trackEvent\("toggle_discipline_filters"/);
  assert.doesNotMatch(filtersUi, /filterDisciplineEvents|window\.history\.replaceState/);
});

test("A10F preserva las cinco áreas públicas y sus destinos sin importar el diseño legacy", () => {
  for (const text of [
    "Para organizadores", "Guía de la disciplina", "Preguntas frecuentes",
    "Explora otras disciplinas",
    "¿Qué eventos aparecen en esta disciplina?",
    "¿Cómo encuentro un evento próximo?",
    "¿Debo confirmar la información antes de asistir?",
    "Se muestran eventos visibles cuya disciplina o tipo de vehículo estructurado",
    "Utiliza provincia y periodo para acotar la agenda; en Más filtros puedes elegir",
    "Sí. Consulta siempre la ficha y la fuente oficial porque horarios, ubicación,",
  ]) {
    assert.ok(legacy.includes(text), `contenido histórico: ${text}`);
    assert.ok(editorial.includes(text), `contenido V2: ${text}`);
  }
  assert.match(legacyHistory, /Eventos anteriores de \{title\}/);
  assert.match(editorial, /Eventos anteriores de \{data\.discipline\.title\}/);
  for (const href of ["/publicar-evento", "/eventos-motor-este-fin-de-semana", "/zonas"]) {
    assert.ok(editorial.includes(href), href);
  }
  assert.match(editorial, /href=\{PUBLIC_NAVIGATION\.calendar\}/);
  assert.match(editorial, /href=\{`\/evento\/\$\{event\.slug \|\| event\.id\}`\}/);
  assert.match(editorial, /href=\{`\/disciplinas\/\$\{discipline\.slug\}`\}/);
  assert.doesNotMatch(editorial, /\/preview\//);
});
