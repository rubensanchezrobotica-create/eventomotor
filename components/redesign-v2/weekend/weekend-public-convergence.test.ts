import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildWeekendPreviewData,
  filterWeekendEvents as filterLegacyWeekendEvents,
  parseWeekendFilters,
  type WeekendRange as LegacyWeekendRange,
} from "@/components/preview/weekend/weekend-preview-model";
import { WEEKEND_FAQS, WEEKEND_GUIDE_PARAGRAPHS, WEEKEND_SEO_LINKS } from "@/components/preview/weekend/weekend-public-content";
import type { EventItem } from "@/types/event";
import {
  buildPublicWeekendDayCounts,
  buildPublicWeekendResults,
  calculatePublicWeekendRange,
  paginateWeekendEvents,
  parsePublicWeekendUrlState,
  serializePublicWeekendUrlState,
} from "./weekend-page-model";

function event(id: string, start: string, end = start, overrides: Partial<EventItem> = {}): EventItem {
  return {
    id,
    slug: id,
    title: `Rallye ${id}`,
    championship: "Campeonato",
    discipline: "Rallyes",
    start,
    end,
    venue: "Circuito",
    city: "León",
    province: "León",
    region: "Castilla y León",
    level: "Nacional",
    source: "Fuente",
    sourceUrl: "https://example.com",
    ticketUrl: "",
    tags: ["rally"],
    vehicleType: "coche",
    featured: false,
    ...overrides,
  };
}

const fixtures = [
  event("before", "2026-09-17"),
  event("friday", "2026-09-18"),
  event("friday-sunday", "2026-09-18", "2026-09-20"),
  event("saturday", "2026-09-19"),
  event("ends-saturday", "2026-09-17", "2026-09-19"),
  event("sunday", "2026-09-20"),
  event("beyond-sunday", "2026-09-19", "2026-09-22"),
  event("starts-before", "2026-09-17", "2026-09-18"),
  event("next-weekend", "2026-09-25", "2026-09-27"),
];

test("A10E conserva la ventana pública de lunes a domingo en Europe/Madrid", () => {
  const expected = [
    ["lunes", "2026-09-18", "2026-09-20"],
    ["martes", "2026-09-18", "2026-09-20"],
    ["miércoles", "2026-09-18", "2026-09-20"],
    ["jueves", "2026-09-18", "2026-09-20"],
    ["viernes", "2026-09-18", "2026-09-20"],
    ["sábado", "2026-09-18", "2026-09-20"],
    ["domingo", "2026-09-25", "2026-09-27"],
  ] as const;
  for (const [index, [weekday, start, end]] of expected.entries()) {
    const now = new Date(Date.UTC(2026, 8, 14 + index, 12));
    const range = calculatePublicWeekendRange(now);
    assert.deepEqual([range.friday, range.sunday], [start, end], weekday);
    const legacyRange: LegacyWeekendRange = { friday: start, saturday: range.saturday, sunday: end };
    const legacyData = buildWeekendPreviewData(fixtures, now, legacyRange);
    const legacySlugs = filterLegacyWeekendEvents(legacyData.events, parseWeekendFilters({}), legacyRange).map((item) => item.slug);
    const v2Slugs = buildPublicWeekendResults(legacyData.events, parsePublicWeekendUrlState({}), range).map((item) => item.slug);
    assert.deepEqual(v2Slugs, legacySlugs, weekday);
    assert.equal(v2Slugs.includes("before"), false, weekday);
    assert.equal(v2Slugs.includes("next-weekend"), weekday === "domingo", weekday);
  }
});

test("A10E conserva intersección multidía y filtros sábado, domingo y varios", () => {
  const range = calculatePublicWeekendRange("2026-09-18T10:00:00Z");
  const data = buildWeekendPreviewData(fixtures, new Date("2026-09-18T10:00:00Z"), range);
  for (const dia of ["sabado", "domingo", "varios"] as const) {
    const state = parsePublicWeekendUrlState({ dia });
    const legacy = filterLegacyWeekendEvents(data.events, parseWeekendFilters({ dia }), data.range);
    assert.deepEqual(buildPublicWeekendResults(data.events, state, range).map((item) => item.slug), legacy.map((item) => item.slug), dia);
  }
  assert.equal(buildPublicWeekendResults(data.events, parsePublicWeekendUrlState({}), range).some((item) => item.id === "starts-before"), true);
  assert.deepEqual(buildPublicWeekendDayCounts(data.events, parsePublicWeekendUrlState({}), range), {
    all: data.dayCounts.todos,
    fri: data.dayCounts.viernes,
    sat: data.dayCounts.sabado,
    sun: data.dayCounts.domingo,
    multi: data.dayCounts.varios,
  });
});

test("A10E acepta y conserva los cinco parámetros públicos sin confundir tipo con vehículo", () => {
  const input = new URLSearchParams("q=Rallye&provincia=Le%C3%B3n&disciplina=Rallyes&dia=sabado&tipo=rallyes&page=2");
  const state = parsePublicWeekendUrlState(input);
  assert.deepEqual(state, {
    q: "Rallye", province: "leon", discipline: "rallyes", day: "sat", family: "rallyes", vehicle: "", page: 2,
  });
  assert.equal(serializePublicWeekendUrlState(state), "q=Rallye&provincia=leon&disciplina=rallyes&dia=sabado&tipo=rallyes&page=2");
  assert.deepEqual(parsePublicWeekendUrlState({ dia: "lunes", tipo: "inventado", page: "-3" }), {
    q: "", province: "", discipline: "", day: "all", family: "", vehicle: "", page: 1,
  });
  const range = calculatePublicWeekendRange("2026-09-18T10:00:00Z");
  const data = buildWeekendPreviewData(fixtures, new Date("2026-09-18T10:00:00Z"), range);
  for (const query of [
    { q: "Rallye" }, { provincia: "León" }, { disciplina: "Rallyes" },
    { dia: "sabado" }, { tipo: "rallyes" },
    { q: "Rallye", provincia: "León", disciplina: "Rallyes", dia: "sabado", tipo: "rallyes" },
  ]) {
    assert.deepEqual(
      buildPublicWeekendResults(data.events, parsePublicWeekendUrlState(query), range).map((item) => item.slug),
      filterLegacyWeekendEvents(data.events, parseWeekendFilters(query), data.range).map((item) => item.slug),
      JSON.stringify(query),
    );
  }
  assert.equal(paginateWeekendEvents(data.events, 999).page, 1);
});

test("A10E conserva el contrato SEO público y su ItemList sigue el resultado visible", () => {
  const page = readFileSync(new URL("../../../app/eventos-motor-este-fin-de-semana/page.tsx", import.meta.url), "utf8");
  const sitemap = readFileSync(new URL("../../../app/sitemap.ts", import.meta.url), "utf8");
  assert.match(page, /export const metadata: Metadata = buildOpportunityMetadata\(page\)/);
  assert.match(page, /await connection\(\)/);
  assert.match(page, /<V2InteriorShell[\s\S]*?navigationMode="public"/);
  assert.match(page, /currentNavigationId="weekend"/);
  assert.match(page, /<WeekendPageExperience[\s\S]*?routeContext="public"/);
  assert.equal((page.match(/type="application\/ld\+json"/g) ?? []).length, 4);
  for (const schema of ["BreadcrumbList", "CollectionPage", "FAQPage", "ItemList"]) assert.match(page, new RegExp(schema));
  assert.match(page, /paginateWeekendEvents\(filteredEvents, initialState\.page\)\.visible/);
  assert.match(page, /itemListJsonLd\(visibleEvents\)/);
  assert.match(page, /<WeekendPublicEditorial/);
  assert.match(sitemap, /sitemapEntry\(`\/\$\{page\.slug\}`/);
  assert.equal(WEEKEND_FAQS.length, 4);
  assert.equal(WEEKEND_GUIDE_PARAGRAPHS.length, 2);
  assert.equal(WEEKEND_SEO_LINKS.length, 8);
});

test("A10E separa rutas públicas y Preview sin fuga de enlaces ni duplicar guardado", () => {
  const preview = readFileSync(new URL("../../../app/preview/redesign-v2/eventos-motor-este-fin-de-semana/page.tsx", import.meta.url), "utf8");
  const experience = readFileSync(new URL("./WeekendPageExperience.client.tsx", import.meta.url), "utf8");
  const card = readFileSync(new URL("./WeekendEventCard.tsx", import.meta.url), "utf8");
  const editorial = readFileSync(new URL("./WeekendPublicEditorial.tsx", import.meta.url), "utf8");
  assert.match(preview, /routeContext="preview"/);
  assert.match(preview, /index:\s*false/);
  assert.match(experience, /routeContext === "public" \? PUBLIC_WEEKEND_ROUTE : WEEKEND_ROUTE/);
  assert.match(experience, /routeContext === "public" \? "\/calendario" : "\/preview\/redesign-v2\/calendario"/);
  assert.match(card, /routeContext === "public" \? `\/evento\/\$\{event\.slug \|\| event\.id\}` : previewEventHref\(event\)/);
  assert.equal((card.match(/<EventRetentionActions/g) ?? []).length, 1);
  assert.match(card, /weekend_public_results/);
  assert.match(editorial, /weekend_public_organizer_cta/);
  assert.match(editorial, /WEEKEND_GUIDE_PARAGRAPHS/);
  assert.match(editorial, /WEEKEND_FAQS/);
});

test("A10E-R2 limita la nueva jerarquía editorial al bloque público y conserva el FAQ nativo", () => {
  const editorial = readFileSync(new URL("./WeekendPublicEditorial.tsx", import.meta.url), "utf8");
  const styles = readFileSync(new URL("./WeekendPageExperience.module.css", import.meta.url), "utf8");
  assert.match(editorial, /redesignV2DisplayPilot\.variable/);
  assert.match(editorial, /faqFont\.variable/);
  assert.match(editorial, /weight: \["700", "800"\]/);
  assert.match(editorial, /WEEKEND_GUIDE_PARAGRAPHS\.map/);
  assert.match(editorial, /WEEKEND_SEO_LINKS\.map/);
  assert.match(editorial, /WEEKEND_FAQS\.map\(\(faq\) => \(\s*<details key=\{faq\.question\}>\s*<summary>\{faq\.question\}<\/summary>\s*<p>\{faq\.answer\}<\/p>/);
  assert.match(styles, /\.publicEditorial h2\s*\{[^}]*font-family: var\(--font-v2-display-pilot\)[^}]*font-style: normal;[^}]*font-weight: 900;/);
  assert.match(styles, /\.editorialFaq summary\s*\{[^}]*font-family: var\(--font-v2-weekend-faq\)[^}]*font-weight: 800;/);
  assert.match(styles, /\.editorialFaq details\[open\] summary::after/);
  assert.match(styles, /\.editorialFaq summary:focus-visible/);
  assert.match(styles, /\.editorialLinks a:focus-visible|\.publicEditorial a:focus-visible/);
});

test("A10E-R3 comparte Archivo 900 italic con Calendar en ambos héroes Weekend", () => {
  const publicRoute = readFileSync(new URL("../../../app/eventos-motor-este-fin-de-semana/page.tsx", import.meta.url), "utf8");
  const previewRoute = readFileSync(new URL("../../../app/preview/redesign-v2/eventos-motor-este-fin-de-semana/page.tsx", import.meta.url), "utf8");
  const calendarRoute = readFileSync(new URL("../../../app/calendario/page.tsx", import.meta.url), "utf8");
  const font = readFileSync(new URL("../redesign-v2-fonts.ts", import.meta.url), "utf8");
  for (const route of [publicRoute, previewRoute, calendarRoute]) {
    assert.match(route, /heroTitleFontClassName=\{redesignV2DisplayPilot\.variable\}/);
  }
  assert.match(font, /Archivo\(\{[\s\S]*?weight: "900"[\s\S]*?style: \["normal", "italic"\]/);
  assert.match(publicRoute, /title="Este fin de semana"/);
  assert.match(previewRoute, /title="Este fin de semana"/);
});

test("A10E-R3 alinea los cuatro H2 y conserva FAQ, copy y flujo Weekend", () => {
  const experience = readFileSync(new URL("./WeekendPageExperience.client.tsx", import.meta.url), "utf8");
  const editorial = readFileSync(new URL("./WeekendPublicEditorial.tsx", import.meta.url), "utf8");
  const styles = readFileSync(new URL("./WeekendPageExperience.module.css", import.meta.url), "utf8");
  assert.match(experience, /className=\{`\$\{styles\.weekendSection\} \$\{redesignV2DisplayPilot\.variable\}`\}/);
  assert.match(styles, /\.resultsHeader h2,\s*\.calendarCta h2\s*\{[^}]*font-family: var\(--font-v2-display-pilot\)[^}]*font-style: normal;[^}]*font-weight: 900;/);
  assert.match(styles, /\.publicEditorial h2\s*\{[^}]*font-family: var\(--font-v2-display-pilot\)[^}]*font-style: normal;[^}]*font-weight: 900;/);
  assert.match(styles, /@media \(max-width: 700px\)\s*\{\s*\.publicEditorial h2\s*\{[^}]*font-size: clamp\(/);
  assert.match(styles, /\.editorialFaq summary\s*\{[^}]*font-family: var\(--font-v2-weekend-faq\)[^}]*font-weight: 800;/);
  assert.match(editorial, /<h2>¿Organizas un evento de motor\?<\/h2>/);
  assert.match(editorial, /<h2>Sobre esta agenda<\/h2>/);
  assert.match(experience, /<h2>Planifica todo el mes<\/h2>/);
  assert.match(experience, /routeContext === "public" \? PUBLIC_WEEKEND_ROUTE : WEEKEND_ROUTE/);
  assert.match(experience, /routeContext === "public" \? serializePublicWeekendUrlState : serializeWeekendUrlState/);
  assert.match(experience, /<WeekendEventCard event=\{event\} image=\{visibleImages\[index\]\}/);
});
