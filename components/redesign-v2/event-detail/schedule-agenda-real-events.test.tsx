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

type RealScheduleFixture = {
  activityCount: number;
  days: string[];
  markers: string[];
  name: string;
  schedule: string;
};

const fixtures: RealScheduleFixture[] = [
  {
    name: "Rallye Ciudad de Valencia 2026",
    days: ["Viernes 23 de octubre", "Sábado 24 de octubre"],
    activityCount: 13,
    markers: ["Entrega de documentación", "TC8 Cortes de Pallás–Los Herreros", "Circuit Ricardo Tormo"],
    schedule: `Viernes 23 de octubre:

Entrega de documentación de 08:00 a 11:00 y verificaciones técnicas de 08:15 a 14:30 en Sanz Sport, Alaquàs.

Ceremonia de salida a las 18:00 en el Palau de l’Exposició.

Sábado 24 de octubre:

Salida deportiva a las 07:30 desde el Circuit Ricardo Tormo.

TC1 Buñol: 07:58.
TC2 Gestalgar: 08:41.
TC3 Buñol: 10:46.
TC4 Gestalgar: 11:29.
TC5 Dos Aguas: 14:42.
TC6 Cortes de Pallás–Los Herreros: 15:28.
TC7 Dos Aguas: 18:26.
TC8 Cortes de Pallás–Los Herreros: 19:12.

Entrega de trofeos prevista a las 21:30 en el Circuit Ricardo Tormo.`,
  },
  {
    name: "International GT Open Barcelona 2026",
    days: ["Viernes 23 de octubre", "Sábado 24 de octubre", "Domingo 25 de octubre"],
    activityCount: 6,
    markers: ["entrenamientos libres del International GT Open", "sesión adicional para pilotos Bronze", "GT Cup Europe"],
    schedule: `Programa provisional — Draft 2, publicado el 19/10/2026.

Viernes 23 de octubre: entrenamientos libres del International GT Open de 10:46 a 11:46 y de 14:18 a 15:18; sesión adicional para pilotos Bronze de 17:14 a 17:54.

Sábado 24 de octubre: clasificación 1 del International GT Open de 10:40 a 11:05 y carrera 1 a las 15:10, con una duración prevista de 70 minutos. El programa incluye además clasificación y carreras de GT Cup Europe, Euroformula Open y TCR Europe.

Domingo 25 de octubre: clasificación 2 del International GT Open de 09:00 a 09:25 y carrera 2 a las 13:30, con una duración prevista de 60 minutos. También figuran carreras de Euroformula Open, TCR Europe y GT Cup Europe.

Horarios provisionales sujetos a cambios; comprobar la documentación oficial antes de asistir.`,
  },
  {
    name: "MotorLand Classic Festival 2026",
    days: ["Viernes 23 de octubre", "Sábado 24 de octubre", "Domingo 25 de octubre"],
    activityCount: 11,
    markers: ["Arte + Motor", "MotorLand Classic Parade", "Inscripciones: tandas online"],
    schedule: `Viernes 23 de octubre: tandas para participantes inscritos. La fuente oficial no publica un horario general de acceso para el público.

Sábado 24 de octubre: entrada libre para el público. Curso de fotografía de 09:00 a 10:30; Arte + Motor de 10:30 a 13:00 y de 14:30 a 17:00; Zona Arcade y Scalextric de 11:30 a 17:30; RetroLudoteca de 11:30 a 13:30; vermut musical de 12:00 a 14:30; Lap Parade Citroën AX a las 12:30; MotorLand Classic Parade a las 16:10; tardeo aproximadamente de 16:10 a 18:30; charla sobre el Citroën AX a las 17:30.

Domingo 25 de octubre: tandas para participantes inscritos. La fuente oficial no confirma en esta página las condiciones de acceso del público para esta jornada.

Inscripciones: tandas online hasta el 20 de octubre, con una discrepancia en la hora de cierre publicada por MotorLand —12:00 en un apartado y 23:59 en otro—; Classic Parade online hasta el 22 de octubre a las 12:00. Después, la organización admite inscripciones en el circuito hasta agotar plazas.

Los horarios anteriores corresponden a actividades concretas y no constituyen un horario general de apertura del circuito.`,
  },
  {
    name: "XV Rallysprint Villa de Luarca 2026",
    days: ["Sábado 24", "Domingo 25"],
    activityCount: 8,
    markers: ["verificaciones técnicas y GPS", "Tramo San Feliz", "clasificación final"],
    schedule: `Sábado 24: verificaciones administrativas de 16:00 a 19:00, verificaciones técnicas y GPS de 16:15 a 19:15 y ceremonia de salida a las 20:30 en el Paseo del Muelle.

Domingo 25: salida del primer participante a las 09:17. Tramo San Feliz a las 09:35, 12:25 y 15:15.

Llegada prevista a las 16:00, clasificación provisional a las 17:20 y clasificación final a las 18:00.`,
  },
  {
    name: "48 Rallye San Froilán 2026",
    days: ["Viernes 16 de octubre", "Sábado 17 de octubre"],
    activityCount: 12,
    markers: ["salida del primer participante", "Baralla", "avenida Ramón Ferreiro de Lugo"],
    schedule: `Viernes 16 de octubre: entrega de documentación de 11:00 a 13:00; verificaciones técnicas de 11:15 a 16:00; salida del primer participante a las 18:12 desde Outeiro de Rei. Tramo de Outeiro de Rei a las 18:30 y O Corgo a las 19:10.

Sábado 17 de octubre: segunda sección desde las 08:45. Outeiro de Rei a las 09:45; O Corgo a las 10:30; Baralla a las 14:55 y 18:40; Sarria a las 15:50 y 19:35; Samos a las 16:15 y 20:00.

La llegada se realiza en la avenida Ramón Ferreiro de Lugo.

Consultar el tablón oficial ante posibles modificaciones de última hora.`,
  },
  {
    name: "RallyRACC Catalunya 2026",
    days: ["Miércoles 14 de octubre", "Jueves 15 de octubre", "Viernes 16 de octubre", "Sábado 17 de octubre"],
    activityCount: 26,
    markers: ["Riudecanyes 2", "Savallà-Conesa 2", "clasificación final oficial"],
    schedule: `Miércoles 14 de octubre: verificaciones administrativas y entrega de GPS de 15:00 a 21:00 en Hotel Caribe. Acreditación y apertura del parque de asistencia de 16:30 a 20:00 en PortAventura World. Reconocimientos opcionales del TC 1/2 de 17:00 a 21:00.

Jueves 15 de octubre: reconocimientos de 09:30 a 22:00; verificaciones técnicas de 15:00 a 21:00 en PortAventura World; reconocimiento del tramo urbano de Salou de 17:30 a 20:00.

Viernes 16 de octubre: shakedown de prioritarios de 09:00 a 10:00 en La Teixeta; tramo de calificación a las 10:15; shakedown del resto de inscritos de 11:15 a 13:00; salida a las 17:00 desde Passeig Jaume I; Riudecanyes 1 a las 18:03 y Riudecanyes 2 a las 20:58; fin de etapa a las 22:35 en PortAventura World; clasificación provisional a las 23:30.

Sábado 17 de octubre: salida a las 07:50; Savallà-Conesa 1 a las 09:18; Querol-Les Pobles 1 a las 10:14; El Montmell 1 a las 11:09; Salou 1 a las 12:53; Savallà-Conesa 2 a las 14:46; Querol-Les Pobles 2 a las 15:42; El Montmell 2 a las 16:37; Salou 2 a las 18:30; llegada final a las 18:40 y entrega de trofeos a las 20:00 en Passeig Jaume I; clasificación final oficial a las 21:30.`,
  },
  {
    name: "Rallye Montaña Central 2026",
    days: ["Viernes 16 de octubre", "Sábado 17 de octubre"],
    activityCount: 11,
    markers: ["Espinos", "La Mortera", "Clasificación final y entrega de trofeos"],
    schedule: `Viernes 16 de octubre: verificaciones administrativas de 15:00 a 18:20 en La Fábrica de Guilhou; verificaciones técnicas de 15:30 a 19:00 en Plaza de Abastos; ceremonia de salida a las 20:15 en Parque Jovellanos.

Sábado 17 de octubre: salida a las 08:00.

Espinos: 08:22 y 11:15.
Padrún: 08:45 y 11:38.
La Mortera: 15:30 y 18:07.
Cordal: 15:57 y 18:34.

Llegada prevista del primer participante a las 19:10 en Plaza de Abastos.

Clasificación provisional a las 20:40.

Clasificación final y entrega de trofeos a las 21:10 en Parque Jovellanos.

Horarios sujetos a posibles comunicaciones oficiales posteriores.`,
  },
  {
    name: "XLII Rallye de Cóbreces 2026",
    days: ["Viernes 16 de octubre", "Sábado 17 de octubre"],
    activityCount: 14,
    markers: ["verificaciones administrativas", "TC8 Udías", "Playa de Cóbreces"],
    schedule: `Viernes 16 de octubre: verificaciones administrativas de 15:45 a 18:45 y verificaciones técnicas de 16:00 a 19:00 en Santillana del Mar.
Salida ceremonial a las 19:45 desde la Plaza Mayor.

Sábado 17 de octubre: salida deportiva a las 08:25.

TC1 Santillana del Mar a las 08:43.
TC2 El Monte a las 09:11.
TC3 Santillana del Mar a las 11:33.
TC4 El Monte a las 12:01.
TC5 Caborredondo–Camarao a las 14:58.
TC6 Udías a las 15:39.
TC7 Caborredondo–Camarao a las 17:34.
TC8 Udías a las 18:15.

Llegada prevista a Playa de Cóbreces a las 18:45.

Entrega de trofeos a las 20:30.

Consultar los canales oficiales ante posibles modificaciones de última hora.`,
  },
  {
    name: "Subida Icod-La Guancha 2026",
    days: ["Viernes 30 de octubre", "Sábado 31 de octubre"],
    activityCount: 8,
    markers: ["cierre previsto de la TF-342", "primera manga de carrera", "Clasificación final"],
    schedule: `Programa provisional publicado por la organización.

Viernes 30 de octubre: entrega de documentación de 15:15 a 19:15 y verificaciones técnicas de 15:30 a 19:30.

Sábado 31 de octubre: cierre previsto de la TF-342 desde las 07:00; briefing obligatorio a las 07:40; entrenamientos oficiales a las 09:00; primera manga de carrera a las 11:30 y segunda manga a las 13:30.

Clasificación final y entrega de trofeos previstas a las 16:00.

Horarios sujetos a posibles cambios oficiales.`,
  },
  {
    name: "Rallye Ciudad de Granada 2026",
    days: ["Jueves 29 de octubre", "Viernes 30 de octubre", "Sábado 31 de octubre"],
    activityCount: 8,
    markers: ["verificaciones administrativas optativas", "ceremonia y superespecial", "RTGRANADA26"],
    schedule: `Programa provisional.
Jueves 29 de octubre: presentación a las 11:00; verificaciones administrativas optativas de 12:00 a 14:00 y de 15:30 a 19:30.
Viernes 30 de octubre: verificaciones técnicas de 08:00 a 12:30; shakedown de 14:00 a 16:30; calificación de 16:45 a 17:30; ceremonia y superespecial desde las 21:00.
Sábado 31 de octubre: primera salida a las 07:10 y llegada prevista del primer participante a las 18:15.
Programa sujeto a aprobación y posibles cambios posteriores publicados en el tablón oficial RTGRANADA26.`,
  },
];

const CLOCK = /\b(?:[01]?\d|2[0-3]):[0-5]\d\b/g;

function clocks(value: string) {
  return [...value.matchAll(CLOCK)].map(([clock]) => clock);
}

function htmlText(html: string) {
  return html
    .replace(/<[^>]+>/g, " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&#x27;", "'")
    .replaceAll("&quot;", "\"")
    .replace(/\s+/g, " ")
    .trim();
}

for (const fixture of fixtures) {
  test(`estructura y preserva el programa real: ${fixture.name}`, () => {
    const agenda = parseScheduleAgenda(fixture.schedule);
    assert.ok(agenda);
    assert.deepEqual(agenda.days.map(({ label }) => label), fixture.days);
    assert.equal(agenda.days.reduce((total, day) => total + day.items.length, 0), fixture.activityCount);

    const sourceItems = agenda.days.flatMap(({ items }) => items.map(({ sourceText }) => sourceText));
    assert.equal(new Set(sourceItems).size, sourceItems.length);

    const html = renderToStaticMarkup(
      <ScheduleProgram agenda={agenda} classes={classes} legacyText={fixture.schedule} />,
    );
    const text = htmlText(html);
    assert.match(html, /data-schedule-view="structured"/);
    assert.doesNotMatch(html, /class="legacy"/);
    assert.deepEqual(clocks(text), clocks(fixture.schedule));
    for (const label of fixture.days) assert.ok(text.includes(label));
    for (const marker of fixture.markers) assert.ok(text.includes(marker), `${fixture.name}: falta ${marker}`);
  });
}

test("agrupa repeticiones elípticas sin duplicar la actividad ni convertirlas en un rango", () => {
  const agenda = parseScheduleAgenda(
    "Sábado 17: Espinos: 08:22 y 11:15; Baralla a las 14:55, 18:40 y 20:10; Arte + Motor de 10:30 a 13:00 y de 14:30 a 17:00.",
  );
  assert.ok(agenda);
  assert.deepEqual(
    agenda.days[0].items.map(({ activity, endTime, timeLabels }) => ({ activity, endTime, timeLabels })),
    [
      { activity: "Espinos", endTime: null, timeLabels: ["08:22", "11:15"] },
      { activity: "Baralla", endTime: null, timeLabels: ["14:55", "18:40", "20:10"] },
      { activity: "Arte + Motor", endTime: null, timeLabels: ["10:30–13:00", "14:30–17:00"] },
    ],
  );
});

test("mantiene fallback completo si una repetición contiene residuo no asignable", () => {
  assert.equal(
    parseScheduleAgenda("Viernes 7: apertura 09:00 texto intermedio 10:00 y cierre 12:00."),
    null,
  );
});
