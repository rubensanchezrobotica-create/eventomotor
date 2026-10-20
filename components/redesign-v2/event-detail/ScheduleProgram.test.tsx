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
  assert.match(html, /<h3>VIERNES 7<\/h3>/);
  assert.match(
    html,
    /<span class="time">09:00–10:00<\/span>/,
  );
  assert.match(html, /<span class="activity">Verificaciones<\/span>/);
  assert.doesNotMatch(html, /data-schedule-view="legacy"/);
});

test("cada hora de una actividad repetida tiene su propia etiqueta accesible", () => {
  const legacyText = "Sábado 24: tramo Espinos a las 09:35, 12:25 y 15:15.";
  const agenda = parseScheduleAgenda(legacyText);
  assert.ok(agenda);
  const html = renderToStaticMarkup(
    <ScheduleProgram agenda={agenda} classes={classes} legacyText={legacyText} />,
  );
  assert.equal((html.match(/class="activity">Tramo Espinos/g) ?? []).length, 3);
  for (const time of ["09:35", "12:25", "15:15"]) assert.ok(html.includes(`<span class="time">${time}</span><span class="activity">Tramo Espinos`));
  assert.doesNotMatch(html, /aria-hidden/);
});

test("notas complementarias independientes sin heredar la hora de una carrera", () => {
  const text = "Sábado 24: carrera 1 a las 15:10, duración prevista 70 minutos. El programa incluye además GT Cup Europe y TCR Europe.";
  const agenda = parseScheduleAgenda(text);
  assert.ok(agenda);
  const html = renderToStaticMarkup(<ScheduleProgram agenda={agenda} classes={classes} legacyText={text} />);
  assert.match(html, /<li class="note" data-schedule-note="true"><span class="activity">El programa incluye además/);
  assert.equal((html.match(/class="time"/g) ?? []).length, 1);
  assert.doesNotMatch(html, /text-transform: capitalize/);
});

test("capitalización de frase conserva nombres, siglas y el texto original", () => {
  const text = "Viernes 23: verificaciones técnicas y GPS a las 09:00 en PortAventura World; salida desde Passeig Jaume I a las 10:00; GT Open a las 11:00; TC1 a las 12:00.";
  const agenda = parseScheduleAgenda(text);
  assert.ok(agenda);
  const html = renderToStaticMarkup(<ScheduleProgram agenda={agenda} classes={classes} legacyText={text} />);
  for (const label of ["Verificaciones técnicas y GPS", "PortAventura World", "Salida desde Passeig Jaume I", "GT Open", "TC1"]) assert.ok(html.includes(label));
  assert.ok(agenda.days[0].items[0].activity.startsWith("verificaciones"));
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
