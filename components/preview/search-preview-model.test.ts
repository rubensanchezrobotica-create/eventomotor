import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ConceptHomePage from "@/components/public/concept/ConceptHomePage";
import { grammaticalMonthSummary } from "@/components/public/concept/ConceptCalendar";
import { conciseExplorerSummary } from "@/components/public/concept/ConceptEventExplorer";
import type { EventItem } from "@/types/event";
import {
  formatPreviewDisplayText,
  formatPreviewZoneProvinces,
} from "./preview-geography";
import {
  buildPreviewSuggestions,
  normalizePreviewText,
  previewResultLabel,
  previewSearchButtonLabel,
} from "./search-preview-model";

function event(overrides: Partial<EventItem> = {}): EventItem {
  return {
    id: "jarama",
    slug: "rally-jarama",
    title: "Rally Comunidad de Madrid",
    championship: "Campeonato regional",
    discipline: "Rally",
    start: "2026-07-18",
    end: "2026-07-19",
    venue: "Circuito del Jarama",
    city: "San Sebastián de los Reyes",
    province: "Madrid",
    region: "Comunidad de Madrid",
    level: "Nacional",
    source: "Fixture",
    sourceUrl: "https://example.com",
    ticketUrl: "",
    tags: [],
    vehicleType: "coche",
    featured: false,
    ...overrides,
  };
}

test("normaliza búsquedas ignorando mayúsculas y acentos", () => {
  assert.equal(normalizePreviewText("  Próximos en Cataluña  "), "proximos en cataluna");
});

test("normaliza y deduplica la geografía visible sin usar campeonato ni etiquetas", () => {
  const northEvents = [
    event({ id: "coruna-1", province: "A Coruna", region: "Galicia" }),
    event({ id: "coruna-2", province: "A Coruña", region: "Galicia" }),
    event({ id: "alava", province: "Álava", region: "País Vasco" }),
    event({ id: "asturias", province: "Asturias", region: "Asturias" }),
    event({ id: "cantabria", province: "Cantabria", region: "Cantabria" }),
  ];
  const centerEvents = [
    event({ id: "false-alava", championship: "Copa de Castilla y León", province: "Álava", region: "País Vasco" }),
    event({ id: "false-asturias", championship: "Campeonato de Castilla-La Mancha", province: "Asturias", region: "Asturias" }),
    event({ id: "albacete", province: "Albacete", region: "Castilla-La Mancha" }),
    event({ id: "avila", province: "Avila", region: "Castilla y León" }),
    event({ id: "cuenca", province: "Cuenca", region: "Castilla-La Mancha" }),
    event({ id: "toledo", province: "Toledo", region: "Castilla-La Mancha" }),
  ];
  const zone = (name: string, terms: string[], events: EventItem[]) => ({
    name,
    x: 0,
    y: 0,
    color: "transparent",
    terms,
    events,
    upcoming: events,
    provinces: events.map((item) => item.province),
  });

  assert.equal(
    formatPreviewZoneProvinces(zone("Norte", ["galicia", "asturias", "cantabria", "país vasco"], northEvents), ""),
    "A Coruña / Álava / Asturias…",
  );
  assert.equal(
    formatPreviewZoneProvinces(zone("Centro", ["madrid", "castilla-la mancha", "castilla y león"], centerEvents), ""),
    "Albacete / Ávila / Cuenca…",
  );
  assert.equal(
    formatPreviewDisplayText("Espana / Cataluna / Aragon / Andalucia / Castilla y Leon"),
    "España / Cataluña / Aragón / Andalucía / Castilla y León",
  );
});

test("el autocompletado reutiliza los eventos ya cargados", () => {
  const suggestions = buildPreviewSuggestions([event()], "jara");
  assert.deepEqual(suggestions.map((item) => item.label), ["Circuito del Jarama"]);
});

test("el autocompletado encuentra territorio y disciplina", () => {
  const events = [event(), event({ id: "moto", title: "Moto Club", discipline: "Motocross", city: "Alcoy" })];
  assert.equal(buildPreviewSuggestions(events, "madrid").some((item) => item.kind === "ubicacion"), true);
  assert.equal(buildPreviewSuggestions(events, "motocross").some((item) => item.kind === "disciplina"), true);
});

test("el autocompletado elimina duplicados y respeta el límite", () => {
  const suggestions = buildPreviewSuggestions([
    event(),
    event({ id: "otro", title: "Otro rally", province: "Madrid" }),
  ], "ma", 2);
  assert.equal(suggestions.length, 2);
  assert.equal(new Set(suggestions.map((item) => item.id)).size, suggestions.length);
});

test("el botón usa el recuento real con singular y plural", () => {
  assert.equal(previewSearchButtonLabel(0), "Ver 0 eventos");
  assert.equal(previewSearchButtonLabel(1), "Ver 1 evento");
  assert.equal(previewSearchButtonLabel(37), "Ver 37 eventos");
  assert.equal(previewResultLabel(1), "1 evento visible");
});

test("la variante concisa conserva singular y plural", () => {
  assert.equal(conciseExplorerSummary(1), "1 evento próximo con los filtros actuales.");
  assert.equal(conciseExplorerSummary(675), "675 eventos próximos con los filtros actuales.");
  assert.equal(grammaticalMonthSummary(1, 1), "1 evento / 1 disciplina");
  assert.equal(grammaticalMonthSummary(2, 3), "2 eventos / 3 disciplinas");
});

test("la home pública conserva su buscador por defecto", () => {
  const markup = renderToStaticMarkup(createElement(ConceptHomePage));
  assert.match(markup, /id="emc-hero-query"/);
  assert.doesNotMatch(markup, /data-preview-search="true"/);
  assert.match(markup, /Todos los próximos eventos\. 0 eventos visibles con los filtros actuales\./);
  assert.doesNotMatch(markup, /0 eventos próximos con los filtros actuales\./);
});

test("el slot opcional sustituye solo el buscador dentro de la misma home", () => {
  function PreviewSearchMarker() {
    return createElement("form", { "data-preview-search": "true" });
  }

  const markup = renderToStaticMarkup(createElement(ConceptHomePage, {
    explorerSummaryVariant: "concise",
    searchPanel: PreviewSearchMarker,
    useCalendarCountGrammar: true,
  }));
  assert.match(markup, /data-preview-search="true"/);
  assert.doesNotMatch(markup, /id="emc-hero-query"/);
  assert.equal((markup.match(/Calendario de eventos/g) || []).length, 1);
  assert.match(markup, /0 eventos próximos con los filtros actuales\./);
  assert.doesNotMatch(markup, /Todos los próximos eventos/);
  assert.match(markup, /Explora por disciplina/);
  assert.match(markup, /Explora por zona/);
});

test("la jerarquía opcional conserva todas las búsquedas y no altera la home pública", () => {
  const publicMarkup = renderToStaticMarkup(createElement(ConceptHomePage));
  const previewMarkup = renderToStaticMarkup(createElement(ConceptHomePage, {
    popularSearchesVariant: "organized",
    zoneExplorerVariant: "atmospheric",
  }));
  const popularHrefs = [
    "/eventos-motor-este-fin-de-semana",
    "/concentraciones-moteras-2026",
    "/rallyes-espana-2026",
    "/rallysprint-espana-2026",
    "/eventos-motor-cataluna",
    "/eventos-motor-comunidad-valenciana",
    "/eventos-motor-madrid",
    "/eventos-motor-andalucia",
    "/eventos-motor-galicia",
    "/eventos-motor-aragon",
    "/eventos-motor-castilla-la-mancha",
    "/eventos-motor-canarias",
    "/eventos-motor-murcia",
    "/eventos-motor-castilla-y-leon",
    "/eventos-motor-asturias",
    "/eventos-motor-cantabria",
    "/eventos-motor-baleares",
    "/rallyes-valencia-2026",
    "/trackdays-espana-2026",
    "/eventos-motor-barcelona",
    "/eventos-motor-valencia",
    "/karting-espana-2026",
    "/disciplinas/ferias",
  ];

  for (const href of popularHrefs) {
    assert.equal(previewMarkup.split(`href="${href}"`).length, publicMarkup.split(`href="${href}"`).length);
  }

  assert.doesNotMatch(publicMarkup, /data-popular-layout="organized"/);
  assert.doesNotMatch(publicMarkup, /emc-zone-explorer-image/);
  assert.match(publicMarkup, /rallyes en Espana 2026/);
  assert.match(publicMarkup, /eventos de motor en Cataluna/);
  assert.match(previewMarkup, /data-popular-layout="organized"/);
  assert.match(previewMarkup, /rallyes en España 2026/);
  assert.match(previewMarkup, /eventos de motor en Cataluña/);
  assert.doesNotMatch(previewMarkup, /eventos de motor en Cataluna/);
  assert.match(previewMarkup, /<summary><span>Ver todas las búsquedas<\/span><small>15 accesos más<\/small><\/summary>/);
  assert.equal((previewMarkup.match(/emc-popular-featured-card/g) || []).length, 8);
  assert.equal((previewMarkup.match(/emc-zone-explorer-image/g) || []).length, 6);
  for (const image of [
    "zone-norte.webp",
    "zone-centro.webp",
    "zone-cataluna-aragon.webp",
    "zone-levante.webp",
    "zone-sur.webp",
    "zone-canarias.webp",
  ]) {
    assert.match(previewMarkup, new RegExp(image));
    assert.doesNotMatch(publicMarkup, new RegExp(image));
  }
});

test("el footer compacto conserva todos los enlaces y la variante pública original", () => {
  const publicMarkup = renderToStaticMarkup(createElement(ConceptHomePage));
  const compactMarkup = renderToStaticMarkup(createElement(ConceptHomePage, {
    footerVariant: "compact",
  }));
  const footerFragment = (markup: string) => markup.slice(markup.indexOf("<footer"), markup.indexOf("</footer>") + 9);
  const hrefs = (markup: string) => [...footerFragment(markup).matchAll(/href="([^"]+)"/g)]
    .map((match) => match[1])
    .sort();
  const remainingZones = footerFragment(compactMarkup).match(/data-footer-zone-links="remaining">([\s\S]*?)<\/div>/)?.[1] || "";

  assert.deepEqual(hrefs(compactMarkup), hrefs(publicMarkup));
  assert.equal(hrefs(publicMarkup).length, 37);
  assert.doesNotMatch(footerFragment(publicMarkup), /emc-footer-compact/);
  assert.doesNotMatch(footerFragment(publicMarkup), /<details/);
  assert.match(footerFragment(compactMarkup), /class="emc-footer emc-footer-compact"/);
  assert.match(footerFragment(compactMarkup), /Rallyes en España 2026/);
  assert.match(footerFragment(compactMarkup), /Eventos motor Cataluña/);
  assert.match(footerFragment(compactMarkup), /La brújula del motor/);
  assert.match(footerFragment(publicMarkup), /Rallyes en Espana 2026/);
  assert.match(footerFragment(publicMarkup), /La brujula del motor/);
  assert.match(footerFragment(compactMarkup), /<summary>Ver todas las zonas<\/summary>/);
  assert.equal((remainingZones.match(/href=/g) || []).length, 13);
});
