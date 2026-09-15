import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  buildSavedEventsViewModel,
  effectiveSavedEventDate,
  formatSavedEventDate,
  hasValidSavedEventStart,
  nextSavedEventFocusSlug,
  readSavedEventsSnapshot,
  removeSavedEventFromSnapshot,
  savedEventsCountLabel,
} from "@/components/events/my-events-view-model";
import { SAVED_EVENTS_STORAGE_KEY, type SavedEvent } from "@/lib/saved-events";

type CssLoaderModule = { exports: unknown };
type NodeModuleWithExtensions = {
  _extensions: Record<string, (module: CssLoaderModule) => void>;
};

const localRequire = createRequire(import.meta.url);
const nodeModule = localRequire("node:module") as NodeModuleWithExtensions;
nodeModule._extensions[".css"] = (module) => {
  module.exports = new Proxy<Record<string, string>>({}, {
    get: (_target, property) => property === "__esModule"
      ? false
      : typeof property === "string" ? property : "",
  });
};
const { SavedEventsView } = localRequire("./MyEventsClient.tsx") as {
  SavedEventsView: typeof import("./MyEventsClient").SavedEventsView;
};

const TODAY = "2026-09-15";

const baseEvent: SavedEvent = {
  slug: "rally-prueba-2026",
  title: "Rally de prueba",
  start: "2026-09-20",
  end: "2026-09-20",
  city: "Madrid",
  province: "Madrid",
  venue: "Circuito de Madrid",
  discipline: "Rallyes",
  vehicle_type: "Coche",
};

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

function event(overrides: Partial<SavedEvent>): SavedEvent {
  return { ...baseEvent, ...overrides };
}

function renderSavedEvents(events: SavedEvent[] | null, announcement = "") {
  return renderToStaticMarkup(createElement(SavedEventsView, {
    announcement,
    events,
    onAddToCalendar: () => undefined,
    onRemove: () => undefined,
    today: TODAY,
  }));
}

test("muestra hidratación explícita sin adelantar el estado vacío", () => {
  const markup = renderSavedEvents(null);

  assert.match(markup, /aria-busy="true"/);
  assert.match(markup, /Cargando tus eventos guardados/);
  assert.doesNotMatch(markup, /0 eventos guardados|Todavía no has/);
});

test("muestra el estado vacío V2 con destinos públicos y sin exportación masiva", () => {
  const markup = renderSavedEvents([]);

  assert.match(markup, />0 eventos guardados</);
  assert.match(markup, /Todavía no has<br\/>guardado<br\/>eventos/i);
  assert.match(markup, /href="\/#calendario"[^>]*>Explorar eventos</);
  assert.match(markup, /href="\/disciplinas"[^>]*>Explorar disciplinas</);
  assert.doesNotMatch(markup, /\/preview\/|Exportar todos|Exportar próximos/i);
});

test("agrupa próximos por fecha ascendente y conserva sus tres acciones", () => {
  const later = event({ slug: "rally-tarde", title: "Rally posterior", start: "2026-09-24", end: "2026-09-25" });
  const sooner = event({ slug: "rally-pronto", title: "Rally inmediato", start: "2026-09-16", end: "2026-09-16" });
  const model = buildSavedEventsViewModel([later, sooner], TODAY);
  const markup = renderSavedEvents([later, sooner]);

  assert.deepEqual(model.upcoming.map(({ event: item }) => item.slug), ["rally-pronto", "rally-tarde"]);
  assert.equal((markup.match(/>Ver evento</g) || []).length, 2);
  assert.equal((markup.match(/>Añadir al calendario</g) || []).length, 2);
  assert.equal((markup.match(/>Quitar</g) || []).length, 2);
  assert.ok(markup.indexOf("Rally inmediato") < markup.indexOf("Rally posterior"));
});

test("clasifica pasado por fecha final efectiva y lo ordena del más reciente al más antiguo", () => {
  const older = event({ slug: "pasado-antiguo", title: "Pasado antiguo", start: "2026-08-01", end: "2026-08-02" });
  const recent = event({ slug: "pasado-reciente", title: "Pasado reciente", start: "2026-09-12", end: "2026-09-14" });
  const crossesToday = event({ slug: "en-curso", title: "Evento en curso", start: "2026-09-10", end: TODAY });
  const model = buildSavedEventsViewModel([older, crossesToday, recent], TODAY);
  const pastMarkup = renderSavedEvents([older, recent]);

  assert.deepEqual(model.past.map(({ event: item }) => item.slug), ["pasado-reciente", "pasado-antiguo"]);
  assert.deepEqual(model.upcoming.map(({ event: item }) => item.slug), ["en-curso"]);
  assert.match(pastMarkup, />Pasados</);
  assert.equal((pastMarkup.match(/>Ver evento</g) || []).length, 2);
  assert.equal((pastMarkup.match(/>Quitar</g) || []).length, 2);
  assert.doesNotMatch(pastMarkup, /Añadir al calendario/);
});

test("conserva fechas inválidas en Sin fecha y no ofrece calendario", () => {
  const invalid = event({ slug: "fecha-invalida", title: "Evento sin fecha", start: "sin-fecha", end: "" });
  const markup = renderSavedEvents([invalid]);
  const model = buildSavedEventsViewModel([invalid], TODAY);

  assert.deepEqual(model.undated.map(({ event: item }) => item.slug), ["fecha-invalida"]);
  assert.match(markup, />Sin fecha</);
  assert.match(markup, /Fecha por confirmar/);
  assert.match(markup, />Ver evento</);
  assert.match(markup, />Quitar</);
  assert.doesNotMatch(markup, /Añadir al calendario/);
});

test("usa semántica de fecha civil estricta y formateo UTC estable", () => {
  const range = event({ start: "2026-10-02", end: "2026-10-04" });
  const invalidEnd = event({ start: "2026-10-02", end: "no-valida" });

  assert.equal(effectiveSavedEventDate(range), "2026-10-04");
  assert.equal(effectiveSavedEventDate(invalidEnd), "2026-10-02");
  assert.equal(hasValidSavedEventStart(range), true);
  assert.equal(hasValidSavedEventStart(event({ start: "" })), false);
  assert.match(formatSavedEventDate(range), /2 oct 2026 – 4 oct 2026/);
});

test("reutiliza un fallback V2 y lo etiqueta como imagen representativa", () => {
  const markup = renderSavedEvents([baseEvent]);
  const [item] = buildSavedEventsViewModel([baseEvent], TODAY).upcoming;

  assert.match(item.image.src || "", /^\/images\/disciplines\/fallbacks\/rallyes\//);
  assert.equal(item.image.kind, "representative");
  assert.match(markup, /Imagen representativa/i);
  assert.doesNotMatch(markup, /imagen real del evento/i);
});

test("la retirada conserva clave, forma, orden y eventos sin fecha del snapshot", () => {
  const storage = new MemoryStorage();
  const undated = event({
    slug: "sin-fecha",
    title: "Sin fecha",
    start: "",
    end: "",
    source_url: "https://example.test/source",
    ticket_url: "https://example.test/tickets",
  });
  const removable = event({ slug: "quitar", title: "Quitar" });
  const remaining = event({ slug: "conservar", title: "Conservar", category: "Nacional" });
  const original = [undated, removable, remaining];
  storage.setItem(SAVED_EVENTS_STORAGE_KEY, JSON.stringify(original));

  assert.deepEqual(readSavedEventsSnapshot(storage), original);
  const next = removeSavedEventFromSnapshot(storage, "quitar");
  assert.deepEqual(next, [undated, remaining]);
  assert.deepEqual(JSON.parse(storage.getItem(SAVED_EVENTS_STORAGE_KEY) || "[]"), [undated, remaining]);
  assert.equal(SAVED_EVENTS_STORAGE_KEY, "eventomotor:saved-events");
});

test("recupera el foco en la acción vecina según el orden visible", () => {
  const events = [
    event({ slug: "ultimo", start: "2026-10-02", end: "2026-10-02" }),
    event({ slug: "primero", start: "2026-09-16", end: "2026-09-16" }),
    event({ slug: "pasado", start: "2026-09-01", end: "2026-09-01" }),
  ];

  assert.equal(nextSavedEventFocusSlug(events, "primero", TODAY), "ultimo");
  assert.equal(nextSavedEventFocusSlug([events[1]], "primero", TODAY), null);
});

test("mantiene singular/plural, anuncio accesible y exportación individual solamente", () => {
  const workspace = process.cwd();
  const clientSource = readFileSync(join(workspace, "components/events/MyEventsClient.tsx"), "utf8");
  const styles = readFileSync(join(workspace, "components/events/MyEventsV2.module.css"), "utf8");
  const markup = renderSavedEvents([baseEvent], "Rally de prueba se ha quitado de Mis eventos.");

  assert.equal(savedEventsCountLabel(1), "1 evento guardado");
  assert.equal(savedEventsCountLabel(2), "2 eventos guardados");
  assert.match(markup, /role="status"/);
  assert.match(markup, /se ha quitado de Mis eventos/);
  assert.match(clientSource, /downloadIcsFile\(`\$\{event\.slug\}\.ics`, \[event\]\)/);
  assert.match(clientSource, /requestAnimationFrame/);
  assert.match(clientSource, /\.focus\(\)/);
  assert.doesNotMatch(clientSource, /exportAll|Exportar todos|Exportar próximos/i);
  assert.match(styles, /\.card[\s\S]*background:\s*var\(--saved-panel\)/);
  assert.match(styles, /\.pastCard[\s\S]*background:\s*#0a0e13/);
  assert.match(styles, /\.emptyState,[\s\S]*background:[\s\S]*#0b1016/);
});
