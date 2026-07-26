import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  formatSavedDate,
  hasValidCalendarDate,
  SavedEventsView,
  savedEventsCountLabel,
} from "@/components/events/MyEventsClient";
import type { SavedEvent } from "@/lib/saved-events";

const baseEvent: SavedEvent = {
  slug: "rally-prueba-2026",
  title: "Rally de prueba",
  start: "2026-09-10",
  end: "2026-09-10",
  city: "Madrid",
  province: "Madrid",
  venue: "Circuito de Madrid",
  discipline: "Rallyes",
  vehicle_type: "Coches",
};

function renderSavedEvents(events: SavedEvent[]) {
  return renderToStaticMarkup(createElement(SavedEventsView, {
    events,
    onAddToCalendar: () => undefined,
    onExportAll: () => undefined,
    onRemove: () => undefined,
  }));
}

test("muestra resumen y estado vacío sin ofrecer una exportación vacía", () => {
  const markup = renderSavedEvents([]);

  assert.match(markup, />0 eventos guardados</);
  assert.match(markup, /Aún no has guardado ningún evento/);
  assert.match(markup, /Guarda los eventos que te interesen/);
  assert.match(markup, /href="\/#calendario"[^>]*>Explorar eventos</);
  assert.doesNotMatch(markup, /Exportar todos/);
});

test("usa singular para un evento y conserva todas sus acciones", () => {
  const markup = renderSavedEvents([baseEvent]);

  assert.equal(savedEventsCountLabel(1), "1 evento guardado");
  assert.match(markup, />1 evento guardado</);
  assert.match(markup, /Exportar todos/);
  assert.match(markup, /href="\/evento\/rally-prueba-2026"/);
  assert.match(markup, /Añadir al calendario/);
  assert.match(markup, /aria-label="Quitar Rally de prueba de Mis eventos"/);
});

test("usa plural y conserva los tres eventos sin truncar datos largos", () => {
  const longEvent: SavedEvent = {
    ...baseEvent,
    slug: "encuentro-clasicos-largo",
    title: "Encuentro Internacional de Vehículos Clásicos y Deportivos de Colección",
    city: "San Sebastián de los Reyes",
    province: "Comunidad de Madrid",
    start: "2026-10-02",
    end: "2026-10-04",
  };
  const events = [
    baseEvent,
    longEvent,
    { ...baseEvent, slug: "trackday-tercero", title: "Trackday de otoño", discipline: "Circuito" },
  ];
  const markup = renderSavedEvents(events);

  assert.equal(savedEventsCountLabel(events.length), "3 eventos guardados");
  assert.match(markup, />3 eventos guardados</);
  assert.equal((markup.match(/class="emc-my-event-card"/g) || []).length, 3);
  assert.match(markup, new RegExp(longEvent.title));
  assert.match(markup, /San Sebastián de los Reyes, Comunidad de Madrid/);
  assert.match(formatSavedDate(longEvent), /2 oct 2026 - 4 oct 2026/);
});

test("mantiene la validación de fechas y la lógica exclusivamente en navegador", () => {
  const workspace = process.cwd();
  const clientSource = readFileSync(join(workspace, "components/events/MyEventsClient.tsx"), "utf8");
  const storageSource = readFileSync(join(workspace, "lib/saved-events.ts"), "utf8");

  assert.equal(hasValidCalendarDate(baseEvent), true);
  assert.equal(hasValidCalendarDate({ ...baseEvent, start: "" }), false);
  assert.match(clientSource, /downloadIcsFile\(`\$\{event\.slug\}\.ics`, \[event\]\)/);
  assert.match(clientSource, /removeSavedEvent\(slug\)/);
  assert.match(storageSource, /window\.localStorage\.getItem\(SAVED_EVENTS_STORAGE_KEY\)/);
  assert.match(storageSource, /window\.localStorage\.setItem\(SAVED_EVENTS_STORAGE_KEY/);
  assert.doesNotMatch(`${clientSource}\n${storageSource}`, new RegExp(["supa", "base"].join(""), "i"));
});
