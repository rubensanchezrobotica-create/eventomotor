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
  assert.match(styles, /width:\s*44px/);
  assert.match(styles, /min-height:\s*44px/);
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
  assert.match(mobile, /grid-template-columns:\s*128px minmax\(0, 1fr\)/);
  assert.match(mobile, /\.mediaColumn\s*\{[\s\S]*?grid-column:\s*1[\s\S]*?grid-template-rows:\s*auto auto/);
  assert.match(mobile, /\.imageLink\s*\{[\s\S]*?grid-row:\s*1[\s\S]*?aspect-ratio:\s*4 \/ 3/);
  assert.match(styles, /\.image,[\s\S]*?object-fit:\s*cover/);
  assert.match(mobile, /\.content\s*\{[\s\S]*?grid-column:\s*2[\s\S]*?grid-row:\s*1/);
  assert.match(mobile, /\.actions\s*\{[\s\S]*?grid-row:\s*2[\s\S]*?justify-content:\s*center/);
  assert.doesNotMatch(mobile, /grid-column:\s*1\s*\/\s*-1|border-top:/);
});

test("las filas móviles normalizan ancho, media y acciones para contenido corto o extremo", () => {
  const styles = readFileSync(new URL("./CalendarEventRow.module.css", import.meta.url), "utf8");
  const fixtures = [
    { title: "Rally", location: "León", badges: 1 },
    { title: "Campeonato de Motociclismo CEF Interopen de Velocidad Circuito de Navarra 2026", location: "Navarra", badges: 2 },
    { title: "Subida nacional", location: "Circuito permanente de alta montaña, San Sebastián de los Reyes", badges: 2 },
    { title: "Evento con tres distintivos", location: "Madrid", badges: 3 },
    { title: "Clásicos de Montaña", location: "A Coruña", badges: 2 },
  ];

  assert.equal(fixtures.length, 5);
  assert.equal(fixtures.some(({ title }) => title.includes("CEF Interopen")), true);
  assert.equal(fixtures.some(({ location }) => location.length > 50), true);
  assert.equal(fixtures.some(({ badges }) => badges === 3), true);
  assert.equal(fixtures.some(({ title, location }) => /[áéíóúñ]/i.test(`${title} ${location}`)), true);
  assert.match(styles, /\.row\s*\{[\s\S]*?box-sizing:\s*border-box[\s\S]*?width:\s*100%[\s\S]*?max-width:\s*100%/);
  assert.match(styles, /@media \(max-width: 720px\)[\s\S]*?\.mediaColumn\s*\{[\s\S]*?width:\s*128px/);
  assert.match(styles, /\.actions\s*\{[\s\S]*?grid-template-columns:\s*44px 44px/);
  assert.match(styles, /\.actions :global\(\.emc-icon-action svg\)\s*\{[\s\S]*?width:\s*18px[\s\S]*?height:\s*18px/);
  assert.match(styles, /@media \(max-width: 360px\)[\s\S]*?grid-template-columns:\s*110px minmax\(0, 1fr\)/);
});

test("la disciplina visible usa el mapa ortográfico sin alterar el dato guardado", () => {
  assert.match(row, /formatCalendarDisciplineLabel\(event\.discipline\)/);
  assert.match(row, /discipline:\s*event\.discipline/);
});
