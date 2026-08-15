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

test("la etiqueta representativa es condicional, accesible y secundaria", () => {
  const styles = readFileSync(new URL("./CalendarEventRow.module.css", import.meta.url), "utf8");

  assert.match(row, /image\.label \? \(/);
  assert.match(row, /aria-label=\{image\.label \? `Ver \$\{event\.title\}\. \$\{image\.label\}`/);
  assert.match(row, /aria-hidden="true" className=\{styles\.imageLabel\}/);
  assert.match(row, /title=\{image\.label\}/);
  assert.match(row, /className=\{styles\.imageLabelMobile\}>Representativa/);
  assert.match(styles, /\.imageLabel\s*\{[\s\S]*?right:\s*6px[\s\S]*?bottom:\s*6px[\s\S]*?font-size:\s*9px[\s\S]*?line-height:\s*1/);
  assert.match(styles, /@media \(max-width: 720px\)[\s\S]*?\.imageLabel\s*\{[\s\S]*?font-size:\s*8px/);
});

test("mobile coloca imagen y acciones en la columna media sin banda inferior", () => {
  const styles = readFileSync(new URL("./CalendarEventRow.module.css", import.meta.url), "utf8");
  const mobile = styles.slice(styles.indexOf("@media (max-width: 720px)"), styles.indexOf("@media (max-width: 360px)"));

  assert.match(row, /className=\{styles\.mediaColumn\}[\s\S]*?className=\{styles\.imageLink\}[\s\S]*?className=\{styles\.actions\}/);
  assert.match(mobile, /grid-template-columns:\s*minmax\(0, 40%\) minmax\(0, 60%\)/);
  assert.match(mobile, /\.mediaColumn\s*\{[\s\S]*?grid-column:\s*1[\s\S]*?grid-template-rows:\s*auto auto/);
  assert.match(mobile, /\.imageLink\s*\{[\s\S]*?grid-row:\s*1[\s\S]*?aspect-ratio:\s*4 \/ 3/);
  assert.match(styles, /\.image,[\s\S]*?object-fit:\s*cover/);
  assert.match(mobile, /\.content\s*\{[\s\S]*?grid-column:\s*2[\s\S]*?grid-row:\s*1/);
  assert.match(mobile, /\.actions\s*\{[\s\S]*?grid-row:\s*2[\s\S]*?justify-content:\s*center/);
  assert.doesNotMatch(mobile, /grid-column:\s*1\s*\/\s*-1|border-top:/);
});

test("la disciplina visible usa el mapa ortográfico sin alterar el dato guardado", () => {
  assert.match(row, /formatCalendarDisciplineLabel\(event\.discipline\)/);
  assert.match(row, /discipline:\s*event\.discipline/);
});
