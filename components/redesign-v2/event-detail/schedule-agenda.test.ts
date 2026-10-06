import assert from "node:assert/strict";
import test from "node:test";
import { parseScheduleAgenda } from "./schedule-agenda";

const wecSchedule = `Viernes 16 de octubre: entrenamientos libres 1 de 11:30 a 13:00 y entrenamientos libres 2 de 16:30 a 18:00.

Sábado 17 de octubre: FP3 de LMGT3 de 08:50 a 09:50; Pit Walk de 10:20 a 11:05; sesión de autógrafos de 10:25 a 10:55; clasificación LMGT3 de 11:50 a 12:02 y Hyperpole LMGT3 de 12:10 a 12:20; FP3 Hypercar de 12:40 a 13:40; clasificación Hypercar de 15:40 a 15:52 y Hyperpole Hypercar de 16:00 a 16:10; Charity Run de 17:30 a 18:30.

Domingo 18 de octubre: Pit Walk de 09:30 a 10:15; sesión de autógrafos de 09:35 a 10:05; vuelta de honor de 10:44 a 10:50; acceso al Grid Walk a las 11:15; salida de las 6 Horas de Barcelona a las 12:00 y llegada prevista a las 18:00.

Horario oficial revisado el 06/10/2026 y sujeto a posibles cambios posteriores del organizador.`;

const rallyRaccSchedule = `Miércoles 14 de octubre: verificaciones administrativas y entrega de GPS de 15:00 a 21:00 en Hotel Caribe. Acreditación y apertura del parque de asistencia de 16:30 a 20:00 en PortAventura World. Reconocimientos opcionales del TC 1/2 de 17:00 a 21:00.

Jueves 15 de octubre: reconocimientos de 09:30 a 22:00; verificaciones técnicas de 15:00 a 21:00 en PortAventura World; reconocimiento del tramo urbano de Salou de 17:30 a 20:00.

Viernes 16 de octubre: shakedown de prioritarios de 09:00 a 10:00 en La Teixeta; tramo de calificación a las 10:15; shakedown del resto de inscritos de 11:15 a 13:00; salida a las 17:00 desde Passeig Jaume I; Riudecanyes 1 a las 18:03 y Riudecanyes 2 a las 20:58; fin de etapa a las 22:35 en PortAventura World; clasificación provisional a las 23:30.

Sábado 17 de octubre: salida a las 07:50; Savallà-Conesa 1 a las 09:18; Querol-Les Pobles 1 a las 10:14; El Montmell 1 a las 11:09; Salou 1 a las 12:53; Savallà-Conesa 2 a las 14:46; Querol-Les Pobles 2 a las 15:42; El Montmell 2 a las 16:37; Salou 2 a las 18:30; llegada final a las 18:40 y entrega de trofeos a las 20:00 en Passeig Jaume I; clasificación final oficial a las 21:30.`;

const riasAltasSchedule = `Jueves 1: verificaciones administrativas de 18:30 a 20:00 en Rallycar, Bergondo.

Viernes 2: verificaciones técnicas de 09:30 a 14:30 en O Parrote; salida a las 17:00; Monfero-1 a las 18:32 y Monfero-2 a las 20:46; fin de etapa a las 22:10 en Betanzos.

Sábado 3: salida a las 10:00; Aranga-1 a las 10:55, Irixoa-1 a las 11:18, Paderne-1 a las 11:56, Aranga-2 a las 14:01, Irixoa-2 a las 14:24 y Paderne-2 a las 15:02.

Llegada final a las 16:00 y trofeos a las 16:45 en O Parrote. Clasificación provisional a las 18:30 y clasificación final a las 19:00.

Horarios sujetos a posibles comunicaciones oficiales posteriores.`;

test("estructura el programa real de WEC por días y actividades sin perder horas", () => {
  const agenda = parseScheduleAgenda(wecSchedule);
  assert.ok(agenda);
  assert.deepEqual(agenda.days.map(({ label }) => label), [
    "Viernes 16 de octubre",
    "Sábado 17 de octubre",
    "Domingo 18 de octubre",
  ]);
  assert.deepEqual(agenda.days.map(({ items }) => items.length), [2, 9, 6]);
  assert.deepEqual(
    agenda.days[0].items.map(({ startTime, endTime }) => [startTime, endTime]),
    [["11:30", "13:00"], ["16:30", "18:00"]],
  );
  assert.equal(agenda.days[2].items.at(-1)?.activity, "llegada prevista");
  assert.equal(
    agenda.footerNote,
    "Horario oficial revisado el 06/10/2026 y sujeto a posibles cambios posteriores del organizador.",
  );
});

test("estructura el RallyRACC real conservando orden, rangos y horas únicas", () => {
  const agenda = parseScheduleAgenda(rallyRaccSchedule);
  assert.ok(agenda);
  assert.deepEqual(agenda.days.map(({ items }) => items.length), [3, 3, 8, 12]);
  const friday = agenda.days[2].items;
  assert.deepEqual(friday.map(({ startTime }) => startTime), [
    "09:00", "10:15", "11:15", "17:00", "18:03", "20:58", "22:35", "23:30",
  ]);
  assert.equal(friday[4].sourceText, "Riudecanyes 1 a las 18:03");
  assert.equal(friday[5].sourceText, "Riudecanyes 2 a las 20:58");
  assert.equal(agenda.footerNote, "");
});

test("adhiere el párrafo continuado y la nota final al último día del rally real", () => {
  const agenda = parseScheduleAgenda(riasAltasSchedule);
  assert.ok(agenda);
  assert.deepEqual(agenda.days.map(({ items }) => items.length), [1, 5, 11]);
  assert.deepEqual(
    agenda.days[2].items.slice(-4).map(({ startTime }) => startTime),
    ["16:00", "16:45", "18:30", "19:00"],
  );
  assert.equal(
    agenda.footerNote,
    "Horarios sujetos a posibles comunicaciones oficiales posteriores.",
  );
});

test("acepta cabecera en línea separada, preámbulo y actividades sin hora", () => {
  const agenda = parseScheduleAgenda(`Programa provisional.

Viernes 7
09:00 Apertura de paddock
Briefing de pilotos

Sábado 8:
Carrera 1 — 10:00
Carrera 2 a las 12:30

Programa sujeto a cambios.`);
  assert.ok(agenda);
  assert.equal(agenda.preamble, "Programa provisional.");
  assert.deepEqual(agenda.days.map(({ items }) => items.length), [2, 2]);
  assert.equal(agenda.days[0].items[1].timeLabel, null);
  assert.equal(agenda.days[1].items[0].startTime, "10:00");
  assert.equal(agenda.footerNote, "Programa sujeto a cambios.");
});

test("acepta rangos inequívocos con guion y sin la preposición de", () => {
  const agenda = parseScheduleAgenda(
    "Viernes 7: 11:30–13:00 entrenamientos libres; clasificación 14:00 a 15:30; salida a las 17:00.",
  );
  assert.ok(agenda);
  assert.deepEqual(
    agenda.days[0].items.map(({ startTime, endTime, activity }) => ({ startTime, endTime, activity })),
    [
      { startTime: "11:30", endTime: "13:00", activity: "entrenamientos libres" },
      { startTime: "14:00", endTime: "15:30", activity: "clasificación" },
      { startTime: "17:00", endTime: null, activity: "salida" },
    ],
  );
});

test("demuestra equivalencia de contenido, orden, horas y ausencia de duplicados", () => {
  const agenda = parseScheduleAgenda(wecSchedule);
  assert.ok(agenda);
  const sourceClocks = [...wecSchedule.matchAll(/\b(?:[01]?\d|2[0-3]):[0-5]\d\b/g)]
    .map(([clock]) => clock);
  const parsedClocks = agenda.days.flatMap(({ items }) => (
    items.flatMap(({ startTime, endTime }) => [startTime, endTime].filter(Boolean))
  ));
  const sourceItems = agenda.days.flatMap(({ items }) => items.map(({ sourceText }) => sourceText));
  assert.deepEqual(parsedClocks, sourceClocks);
  assert.equal(new Set(sourceItems).size, sourceItems.length);
  assert.deepEqual(
    agenda.days[0].items.map(({ activity }) => activity),
    ["entrenamientos libres 1", "entrenamientos libres 2"],
  );
  assert.deepEqual(
    agenda.days[2].items.map(({ activity }) => activity),
    [
      "Pit Walk",
      "sesión de autógrafos",
      "vuelta de honor",
      "acceso al Grid Walk",
      "salida de las 6 Horas de Barcelona",
      "llegada prevista",
    ],
  );
});

test("falla cerrado ante horas ambiguas, inválidas o residuo no demostrable", () => {
  assert.equal(parseScheduleAgenda("Viernes 7: Apertura 09:00 briefing 10:00."), null);
  assert.equal(parseScheduleAgenda("Viernes 7: salida a las 25:00."), null);
  assert.equal(parseScheduleAgenda("Viernes 7: 09:00."), null);
  assert.equal(parseScheduleAgenda("Apertura 09:00\nCarrera 12:00"), null);
});

test("no estructura texto vacío ni un horario sin cabecera diaria", () => {
  assert.equal(parseScheduleAgenda(null), null);
  assert.equal(parseScheduleAgenda(""), null);
  assert.equal(parseScheduleAgenda("Apertura del recinto a las 09:00."), null);
});
