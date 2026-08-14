import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const row = readFileSync(new URL("./CalendarEventRow.tsx", import.meta.url), "utf8");

test("CalendarEventRow muestra sólo datos reales y enlaza al detalle existente", () => {
  assert.match(row, /event\.discipline/);
  assert.match(row, /previewEventStatus/);
  assert.match(row, /event\.title/);
  assert.match(row, /event\.venue/);
  assert.match(row, /previewEventHref/);
  assert.doesNotMatch(row, /Gratis|Inscripciones abiertas|Confirmado|precio|price/i);
});

test("CalendarEventRow reutiliza favoritos e ICS reales", () => {
  assert.match(row, /EventRetentionActions/);
  assert.match(row, /calendarLabel="Añadir al calendario"/);
  assert.match(row, /compactIcons/);
  assert.match(row, /source="redesign_v2_calendar"/);
  assert.doesNotMatch(row, /eventomotor_favorites/);
});

test("la presentación compacta conserva handlers, etiquetas y objetivos táctiles accesibles", () => {
  const actions = readFileSync(new URL("../../events/EventRetentionActions.tsx", import.meta.url), "utf8");
  const styles = readFileSync(new URL("./CalendarEventRow.module.css", import.meta.url), "utf8");

  assert.match(actions, /aria-label=\{saved \? "Quitar de mis eventos" : "Guardar evento"\}/);
  assert.match(actions, /aria-label="Añadir al calendario"/);
  assert.match(actions, /onClick=\{saved \? remove : save\}/);
  assert.match(actions, /onClick=\{addToCalendar\}/);
  assert.match(actions, /aria-pressed=\{saved\}/);
  assert.match(actions, /title=\{saved \? "Quitar de mis eventos" : "Guardar"\}/);
  assert.match(actions, /title="Añadir al calendario"/);
  assert.match(actions, /height="20"/);
  assert.match(actions, /width="20"/);
  assert.match(styles, /width:\s*46px/);
  assert.match(styles, /min-height:\s*46px/);
});
