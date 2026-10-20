import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import ScheduleProgram, { type ScheduleProgramClassNames } from "./ScheduleProgram";
import { parseScheduleAgenda } from "./schedule-agenda";

const classes: ScheduleProgramClassNames = {
  activity: "activity",
  day: "day",
  dayList: "day-list",
  footer: "footer",
  item: "item",
  itemList: "item-list",
  legacy: "legacy",
  note: "note",
  time: "time",
};

test("renderiza la agenda estructurada en SSR con headings y listas semánticas", () => {
  const legacyText = "Viernes 7: verificaciones de 09:00 a 10:00; salida a las 12:30.\n\nSábado 8: llegada a las 18:00.";
  const agenda = parseScheduleAgenda(legacyText);
  assert.ok(agenda);
  const html = renderToStaticMarkup(
    <ScheduleProgram agenda={agenda} classes={classes} legacyText={legacyText} />,
  );
  assert.match(html, /data-schedule-view="structured"/);
  assert.match(html, /<ol class="day-list">/);
  assert.match(html, /<h3>Viernes 7<\/h3>/);
  assert.match(
    html,
    /<span aria-label="09:00–10:00" class="time"><span aria-hidden="true">09:00–10:00<\/span><\/span>/,
  );
  assert.match(html, /<span class="activity">verificaciones<\/span>/);
  assert.doesNotMatch(html, /data-schedule-view="legacy"/);
});

test("agrupa varias horas de una actividad en una única fila accesible", () => {
  const legacyText = "Sábado 24: tramo Espinos a las 09:35, 12:25 y 15:15.";
  const agenda = parseScheduleAgenda(legacyText);
  assert.ok(agenda);
  const html = renderToStaticMarkup(
    <ScheduleProgram agenda={agenda} classes={classes} legacyText={legacyText} />,
  );
  assert.match(html, /aria-label="09:35, 12:25, 15:15"/);
  assert.equal((html.match(/class="activity">tramo Espinos/g) ?? []).length, 1);
  assert.equal((html.match(/aria-hidden="true">/g) ?? []).length, 3);
});

test("renderiza el fallback histórico literal cuando el parser no es concluyente", () => {
  const legacyText = "Viernes 7: Apertura 09:00, briefing 10:00.\nSábado 8: Carrera a las 12:00.";
  const html = renderToStaticMarkup(
    <ScheduleProgram agenda={null} classes={classes} legacyText={legacyText} />,
  );
  assert.match(html, /<p class="legacy">/);
  assert.match(html, /Viernes 7: Apertura 09:00, briefing 10:00\.\nSábado 8: Carrera a las 12:00\./);
  assert.doesNotMatch(html, /<ol|<h3/);
});
