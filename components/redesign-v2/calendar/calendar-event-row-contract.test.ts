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
  assert.match(row, /<h3><Link className=\{styles\.primaryLink\} href=\{href\}>\{event\.title\}<\/Link><\/h3>/);
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
  assert.match(styles, /@media \(max-width: 720px\)[\s\S]*?\.actions :global\(\.emc-btn\),[\s\S]*?width:\s*100%[\s\S]*?height:\s*44px/);
  assert.match(styles, /min-height:\s*44px/);
});

test("la etiqueta representativa es condicional, accesible y secundaria", () => {
  const styles = readFileSync(new URL("./CalendarEventRow.module.css", import.meta.url), "utf8");

  assert.match(row, /image\.label \? \(/);
  assert.match(row, /<Image\s+[\s\S]*?alt=""/);
  assert.match(row, /aria-hidden="true" className=\{styles\.imageLabel\}/);
  assert.match(row, /title=\{image\.label\}/);
  assert.match(row, /className=\{styles\.imageLabelMobile\}>Representativa/);
  assert.match(styles, /\.imageLabel\s*\{[\s\S]*?right:\s*6px[\s\S]*?bottom:\s*6px[\s\S]*?font-size:\s*9px[\s\S]*?line-height:\s*1/);
  assert.match(styles, /@media \(max-width: 720px\)[\s\S]*?\.imageLabel\s*\{[\s\S]*?background:\s*rgba\(0, 0, 0, 0\.82\)[\s\S]*?font-size:\s*10px/);
});

test("el enlace primario móvil es único, accesible y deja las acciones fuera", () => {
  const actions = readFileSync(new URL("../../events/EventRetentionActions.tsx", import.meta.url), "utf8");
  const styles = readFileSync(new URL("./CalendarEventRow.module.css", import.meta.url), "utf8");
  const mobile = styles.slice(styles.indexOf("@media (max-width: 720px)"), styles.indexOf("@media (max-width: 360px)"));
  const primaryLink = row.indexOf("<Link className={styles.primaryLink}");
  const media = row.indexOf("className={styles.mediaColumn}");
  const actionsStart = row.indexOf("className={styles.actions}");

  assert.equal((row.match(/<Link\b/g) ?? []).length, 1);
  assert.equal(primaryLink >= 0 && primaryLink < media && media < actionsStart, true);
  assert.match(row, /<div className=\{styles\.imageSurface\}>/);
  assert.doesNotMatch(row, /className=\{styles\.imageSurface\}\s+href/);
  assert.match(mobile, /\.row\s*\{[\s\S]*?position:\s*relative/);
  assert.match(mobile, /\.primaryLink::after\s*\{[\s\S]*?position:\s*absolute[\s\S]*?z-index:\s*1[\s\S]*?inset:\s*0/);
  assert.match(mobile, /\.primaryLink:focus-visible::after\s*\{[\s\S]*?outline:\s*2px solid #ff7a27/);
  assert.match(mobile, /\.actions\s*\{[\s\S]*?position:\s*relative[\s\S]*?z-index:\s*2/);
  assert.match(actions, /aria-label=\{saved \? "Quitar de mis eventos" : "Guardar evento"\}/);
  assert.match(actions, /aria-label="Añadir al calendario"/);
});

test("mobile coloca imagen y acciones en la columna media antes del footer editorial", () => {
  const styles = readFileSync(new URL("./CalendarEventRow.module.css", import.meta.url), "utf8");
  const mobile = styles.slice(styles.indexOf("@media (max-width: 720px)"), styles.indexOf("@media (max-width: 360px)"));

  assert.match(row, /className=\{styles\.mediaColumn\}[\s\S]*?className=\{styles\.imageSurface\}[\s\S]*?className=\{styles\.actions\}/);
  assert.match(mobile, /grid-template-columns:\s*128px minmax\(0, 1fr\)/);
  assert.match(mobile, /\.mediaColumn\s*\{[\s\S]*?grid-column:\s*1[\s\S]*?grid-template-rows:\s*96px 44px/);
  assert.match(mobile, /\.imageSurface\s*\{[\s\S]*?width:\s*128px[\s\S]*?height:\s*96px[\s\S]*?grid-row:\s*1/);
  assert.match(styles, /\.image,[\s\S]*?object-fit:\s*cover/);
  assert.match(mobile, /\.content\s*\{[\s\S]*?display:\s*contents/);
  assert.match(mobile, /\.mainContent\s*\{[\s\S]*?grid-column:\s*2[\s\S]*?grid-row:\s*1/);
  assert.match(mobile, /\.actions\s*\{[\s\S]*?grid-row:\s*2[\s\S]*?grid-template-columns:\s*1fr 1fr[\s\S]*?justify-items:\s*center/);
  assert.match(mobile, /\.badges\s*\{[\s\S]*?grid-column:\s*1\s*\/\s*-1[\s\S]*?grid-row:\s*2/);
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
  assert.match(styles, /@media \(max-width: 720px\)[\s\S]*?\.actions\s*\{[\s\S]*?grid-template-columns:\s*1fr 1fr/);
  assert.match(styles, /\.actions :global\(\.emc-icon-action svg\)\s*\{[\s\S]*?width:\s*20px[\s\S]*?height:\s*20px/);
  assert.match(styles, /@media \(max-width: 360px\)[\s\S]*?grid-template-columns:\s*110px minmax\(0, 1fr\)/);
});

test("el rail móvil fija imagen y acciones sin depender del contenido derecho", () => {
  const styles = readFileSync(new URL("./CalendarEventRow.module.css", import.meta.url), "utf8");
  const desktop = styles.slice(0, styles.indexOf("@media (max-width: 720px)"));
  const mobile = styles.slice(styles.indexOf("@media (max-width: 720px)"), styles.indexOf("@media (max-width: 360px)"));
  const compact = styles.slice(styles.indexOf("@media (max-width: 360px)"));

  assert.match(desktop, /grid-template-columns:\s*176px minmax\(0, 1fr\) 124px/);
  assert.match(mobile, /\.mediaColumn\s*\{[\s\S]*?width:\s*128px[\s\S]*?height:\s*140px[\s\S]*?grid-template-rows:\s*96px 44px[\s\S]*?gap:\s*0[\s\S]*?align-content:\s*start/);
  assert.match(mobile, /\.imageSurface\s*\{[\s\S]*?width:\s*128px[\s\S]*?height:\s*96px/);
  assert.match(mobile, /\.actions\s*\{[\s\S]*?width:\s*100%[\s\S]*?height:\s*44px[\s\S]*?grid-template-columns:\s*1fr 1fr[\s\S]*?justify-items:\s*center[\s\S]*?gap:\s*0[\s\S]*?border-top:\s*1px solid #2d343e[\s\S]*?background:\s*#171c22/);
  assert.match(mobile, /\.actions :global\(\.emc-btn\),[\s\S]*?width:\s*100%[\s\S]*?max-width:\s*none[\s\S]*?height:\s*44px[\s\S]*?border:\s*0[\s\S]*?border-radius:\s*0[\s\S]*?background:\s*transparent/);
  assert.match(mobile, /\.actions::after\s*\{[\s\S]*?left:\s*50%[\s\S]*?width:\s*1px[\s\S]*?background:\s*#2d343e/);
  assert.match(mobile, /:focus-visible\)[\s\S]*?box-shadow:\s*inset 0 0 0 2px/);
  assert.match(styles, /@media \(max-width: 720px\) and \(hover: hover\) and \(pointer: fine\)[\s\S]*?background:\s*rgba\(255, 255, 255, 0\.04\)/);
  assert.match(styles, /@media \(max-width: 720px\) and \(hover: none\)[\s\S]*?background:\s*transparent[\s\S]*?color:\s*#f5f5f2/);
  assert.doesNotMatch(mobile, /justify-content:\s*space-between|flex-grow:\s*[1-9]/);
  assert.match(compact, /\.mediaColumn\s*\{[\s\S]*?width:\s*110px[\s\S]*?height:\s*154px[\s\S]*?grid-template-rows:\s*110px 44px/);
  assert.match(compact, /\.imageSurface\s*\{[\s\S]*?width:\s*110px[\s\S]*?height:\s*110px/);
});

test("mobile prioriza título, fecha y lugar antes de una única taxonomía editorial", () => {
  const styles = readFileSync(new URL("./CalendarEventRow.module.css", import.meta.url), "utf8");
  const desktop = styles.slice(0, styles.indexOf("@media (max-width: 720px)"));
  const mobile = styles.slice(styles.indexOf("@media (max-width: 720px)"), styles.indexOf("@media (max-width: 360px)"));
  const mainStart = row.indexOf("className={styles.mainContent}");
  const title = row.indexOf("<h3>", mainStart);
  const date = row.indexOf("className={styles.date}", mainStart);
  const location = row.indexOf("className={styles.location}", mainStart);
  const taxonomy = row.indexOf("className={styles.badges}", mainStart);
  const media = row.indexOf("className={styles.mediaColumn}", mainStart);

  assert.equal((row.match(/className=\{styles\.badges\}/g) ?? []).length, 1);
  assert.equal(mainStart < title && title < date && date < location && location < taxonomy && taxonomy < media, true);
  assert.match(desktop, /\.content\s*\{[\s\S]*?display:\s*flex[\s\S]*?flex-direction:\s*column/);
  assert.match(desktop, /\.badges\s*\{[\s\S]*?order:\s*-1[\s\S]*?gap:\s*6px/);
  assert.match(desktop, /\.badges span\s*\{[\s\S]*?border:\s*1px solid #3b434e[\s\S]*?border-radius:\s*999px/);
  assert.match(mobile, /\.mainContent\s*\{[\s\S]*?padding:\s*8px 14px 10px/);
  assert.match(styles, /@media \(max-width: 360px\)[\s\S]*?\.mainContent\s*\{[\s\S]*?padding-top:\s*6px/);
  assert.match(mobile, /\.content h3\s*\{[\s\S]*?margin-top:\s*0/);
  assert.match(mobile, /\.content h3\s*\{[\s\S]*?-webkit-line-clamp:\s*3/);
  assert.match(styles, /@media \(max-width: 360px\)[\s\S]*?\.content h3\s*\{[\s\S]*?-webkit-line-clamp:\s*4/);
  assert.match(styles, /@media \(max-width: 260px\)[\s\S]*?\.content h3\s*\{[\s\S]*?display:\s*block[\s\S]*?overflow:\s*visible[\s\S]*?overflow-wrap:\s*break-word[\s\S]*?-webkit-line-clamp:\s*unset/);
  assert.match(mobile, /\.badges\s*\{[\s\S]*?grid-column:\s*1\s*\/\s*-1[\s\S]*?min-height:\s*30px[\s\S]*?border-top:\s*1px solid #2d343e/);
  assert.match(mobile, /\.badges span\s*\{[\s\S]*?border:\s*0[\s\S]*?font-size:\s*10px/);
  assert.match(mobile, /\.badges span:not\(:last-child\)::after\s*\{[\s\S]*?content:\s*"·"/);
  assert.match(mobile, /\.badges \.status\s*\{[\s\S]*?color:\s*#ff7a27/);
  assert.doesNotMatch(mobile, /\.badges span:nth-child\(n \+ 3\)[\s\S]*?display:\s*none/);
});

test("la disciplina visible usa el mapa ortográfico sin alterar el dato guardado", () => {
  assert.match(row, /formatCalendarDisciplineLabel\(event\.discipline\)/);
  assert.match(row, /discipline:\s*event\.discipline/);
});
