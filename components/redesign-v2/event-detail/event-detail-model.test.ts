import assert from "node:assert/strict";
import test from "node:test";
import type { EventItem } from "@/types/event";
import {
  buildEventDetailV2Model,
  distinctChampionship,
  exceptionalEventStatus,
  formatRelatedEventLabel,
  formatEventDetailDate,
  formatEventDetailLocation,
  isLongEventSchedule,
  madridDateKey,
  nonSpanishCountryLabel,
  organizerContext,
} from "./event-detail-model";

function event(overrides: Partial<EventItem> = {}): EventItem {
  return {
    id: "event-1",
    slug: "rally-del-norte-2026",
    title: "Rally del Norte 2026",
    championship: "Campeonato regional",
    discipline: "Rally",
    start: "2026-08-22",
    end: "2026-08-22",
    venue: "Recinto Motor",
    city: "Oviedo",
    province: "Asturias",
    region: "Asturias",
    level: "Publicado",
    source: "Organización del evento",
    sourceUrl: "https://example.com/evento",
    ticketUrl: "",
    tags: ["Rally", "Coche"],
    vehicleType: "coche",
    featured: false,
    ...overrides,
  };
}

const options = { siteUrl: "https://www.eventomotor.com", today: "2026-08-16" };

test("formatea una fecha date-only de un día sin introducir horas", () => {
  assert.deepEqual(formatEventDetailDate("2026-08-22", "2026-08-22"), {
    dateTime: "2026-08-22",
    label: "22 de agosto de 2026",
  });
});

test("formatea un rango multidía inclusivo del mismo mes", () => {
  assert.deepEqual(formatEventDetailDate("2026-08-22", "2026-08-24"), {
    dateTime: "2026-08-22",
    label: "22–24 de agosto de 2026",
  });
});

test("una fecha final ausente o anterior conserva el contrato de un día", () => {
  assert.equal(formatEventDetailDate("2026-08-22", "")?.label, "22 de agosto de 2026");
  assert.equal(formatEventDetailDate("2026-08-22", "2026-08-21")?.label, "22 de agosto de 2026");
  assert.equal(formatEventDetailDate("invalid", "2026-08-22"), null);
});

test("deduplica localidad y provincia equivalentes", () => {
  assert.equal(formatEventDetailLocation(event({ city: "Madrid", province: "Madrid" })), "Madrid");
  assert.equal(formatEventDetailLocation(event({ city: "Alcañiz", province: "Teruel" })), "Alcañiz, Teruel");
});

test("proyecta únicamente información real y oculta campos opcionales ausentes", () => {
  const model = buildEventDetailV2Model(event({
    city: "Por confirmar",
    province: "Por confirmar",
    venue: "Por confirmar",
    source: "",
    sourceUrl: "",
    officialUrl: "",
    organizerUrl: "",
    ticketUrl: "",
    registrationUrl: "",
    shortDescription: "",
    longDescription: "",
    eventStatus: "",
    vehicleType: "otros",
  }), [], options);

  assert.ok(model);
  assert.equal(model.location, "");
  assert.equal(model.venue, "");
  assert.equal(model.vehicle, "");
  assert.equal(model.source, null);
  assert.equal(model.primaryAction, null);
  assert.equal(model.description, "");
  assert.deepEqual(model.practicalItems, []);
  assert.equal(model.exceptionalStatus, null);
  assert.equal(model.countryContext, "");
  assert.equal(model.organizerContext, null);
  assert.equal(model.compactRelatedFlow, true);
});

test("separa la información práctica real sin repetir hero ni action context", () => {
  const model = buildEventDetailV2Model(event({
    scheduleText: "09:00–18:00",
    address: "Carretera del Circuito, km 1",
    organizerName: "Motor Club del Norte",
    officialUrl: "https://organizador.example.com/ficha",
    registrationUrl: "https://entradas.example.com/registro",
  }), [], options);

  assert.ok(model);
  assert.deepEqual(model.practicalItems, [
    { label: "Horario", value: "09:00–18:00" },
    { label: "Dirección", value: "Carretera del Circuito, km 1" },
  ]);
  assert.deepEqual(model.organizerContext, {
    href: null,
    label: "Motor Club del Norte",
  });
  assert.equal(model.venue, "Recinto Motor");
  assert.equal(model.practicalItems.some(({ label }) => ["Fecha", "Lugar", "Espacio", "Disciplina", "Vehículo", "Fuente"].includes(label)), false);
  assert.equal(model.vehicle, "Coche");
  assert.equal(model.source?.label, "Motor Club del Norte");
});

test("no repite valores prácticos ya visibles y conserva una única fuente en action context", () => {
  const model = buildEventDetailV2Model(event({
    venue: "Oviedo, Asturias",
    address: "Oviedo, Asturias",
    officialUrl: "https://organizador.example.com/ficha",
    sourceUrl: "https://organizador.example.com/ficha",
    ticketUrl: "",
  }), [], options);

  assert.ok(model);
  assert.deepEqual(model.practicalItems, []);
  assert.equal(model.primaryAction?.href, "https://organizador.example.com/ficha");
  assert.equal(model.source?.href, "https://organizador.example.com/ficha");
});

test("mantiene título y descripción larga reales sin truncarlos ni crear HTML", () => {
  const title = "Campeonato de España de Resistencia de Vehículos Clásicos en el Circuito del Norte";
  const description = "Primer párrafo editorial real.\n\nSegundo párrafo con información publicada.";
  const model = buildEventDetailV2Model(event({ title, longDescription: description }), [], options);

  assert.ok(model);
  assert.equal(model.title, title);
  assert.equal(model.description, description);
  assert.equal(model.intro, "");
});

test("evita duplicar la entradilla cuando abre la descripción larga", () => {
  const shortDescription = "Una cita nacional de rally.";
  const model = buildEventDetailV2Model(event({
    shortDescription,
    longDescription: `${shortDescription} Consulta el recorrido publicado.`,
  }), [], options);
  assert.ok(model);
  assert.equal(model.intro, "");
});

test("expone sólo enlaces HTTP seguros y conserva la fuente pública", () => {
  const model = buildEventDetailV2Model(event({
    officialUrl: "https://organizador.example.com/ficha",
    registrationUrl: "https://entradas.example.com/registro",
  }), [], options);
  assert.ok(model);
  assert.equal(model.source?.href, "https://organizador.example.com/ficha");
  assert.equal(model.primaryAction?.href, "https://entradas.example.com/registro");

  const unsafe = buildEventDetailV2Model(event({
    sourceUrl: "javascript:alert(1)",
    officialUrl: "",
    registrationUrl: "javascript:alert(1)",
  }), [], options);
  assert.ok(unsafe);
  assert.equal(unsafe.source, null);
  assert.equal(unsafe.primaryAction, null);
});

test("muestra únicamente estados excepcionales con los labels públicos existentes", () => {
  assert.equal(exceptionalEventStatus(event({ eventStatus: "confirmed" })), null);
  assert.equal(exceptionalEventStatus(event({ eventStatus: "tentative" })), null);
  assert.equal(exceptionalEventStatus(event({ eventStatus: "" })), null);
  assert.deepEqual(exceptionalEventStatus(event({ eventStatus: "cancelled" })), {
    kind: "cancelled",
    label: "Cancelado",
  });
  assert.deepEqual(exceptionalEventStatus(event({ eventStatus: "postponed" })), {
    kind: "postponed",
    label: "Aplazado",
  });
});

test("oculta championships equivalentes y conserva sólo contexto distintivo", () => {
  assert.equal(distinctChampionship("MotoGP", "MotoGP"), "");
  assert.equal(distinctChampionship("  motoGP  ", "MOTOGP"), "");
  assert.equal(distinctChampionship("MotoGP   World Championship", "MotoGP"), "MotoGP World Championship");
  assert.equal(distinctChampionship("", "MotoGP"), "");
});

test("oculta España y normaliza países extranjeros reales", () => {
  assert.equal(nonSpanishCountryLabel("ES"), "");
  assert.equal(nonSpanishCountryLabel("España"), "");
  assert.equal(nonSpanishCountryLabel("Spain"), "");
  assert.equal(nonSpanishCountryLabel("PT"), "Portugal");
  assert.equal(nonSpanishCountryLabel("Portugal"), "Portugal");
  assert.equal(nonSpanishCountryLabel("FR"), "Francia");
  assert.equal(nonSpanishCountryLabel("Francia"), "Francia");
  assert.equal(nonSpanishCountryLabel(""), "");
});

test("expone el organizador sin duplicar el enlace de fuente y bloquea URLs inseguras", () => {
  assert.equal(organizerContext(event({ organizerName: "", organizerUrl: "" }), "https://example.com"), null);
  assert.deepEqual(organizerContext(event({
    organizerName: "Motor Club",
    organizerUrl: "https://www.example.com/evento",
  }), "https://example.com/evento/"), { href: null, label: "Motor Club" });
  assert.deepEqual(organizerContext(event({
    organizerName: "Motor Club",
    organizerUrl: "https://organizer.example/agenda",
  }), "https://example.com/evento"), {
    href: "https://organizer.example/agenda",
    label: "Motor Club",
  });
  assert.deepEqual(organizerContext(event({
    organizerName: "Motor Club",
    organizerUrl: "javascript:alert(1)",
  }), "https://example.com/evento"), { href: null, label: "Motor Club" });
});

test("separa horarios breves y programas largos con la regla auditada", () => {
  assert.equal(isLongEventSchedule("09:00–18:00"), false);
  assert.equal(isLongEventSchedule("A".repeat(300)), false);
  assert.equal(isLongEventSchedule("A".repeat(301)), true);
  assert.equal(isLongEventSchedule("Viernes\nSábado\nDomingo"), false);
  assert.equal(isLongEventSchedule("Jueves\nViernes\nSábado\nDomingo"), true);

  const longSchedule = "Viernes\nSábado\nDomingo\nEntrega de premios";
  const longModel = buildEventDetailV2Model(event({ scheduleText: longSchedule }), [], options);
  assert.ok(longModel);
  assert.equal(longModel.programSection, longSchedule);
  assert.equal(longModel.practicalItems.some(({ label }) => label === "Horario"), false);
  assert.equal(longModel.compactRelatedFlow, false);
});

test("activa el ritmo compacto sólo cuando no existe contenido editorial intermedio", () => {
  const minimal = buildEventDetailV2Model(event({
    shortDescription: "",
    longDescription: "",
    scheduleText: "",
    address: "",
  }), [], options);
  const rich = buildEventDetailV2Model(event({ longDescription: "Descripción editorial real." }), [], options);
  assert.ok(minimal && rich);
  assert.equal(minimal.compactRelatedFlow, true);
  assert.equal(rich.compactRelatedFlow, false);
});

test("la imagen real válida gana al resolver y el evento sin imagen recibe fallback semántico", () => {
  const real = buildEventDetailV2Model(event({ imageUrl: "/event-images/rally-real.webp" }), [], options);
  const fallback = buildEventDetailV2Model(event({ imageUrl: "" }), [], options);
  assert.ok(real && fallback);
  assert.equal(real.image.kind, "event");
  assert.equal(real.image.src, "/event-images/rally-real.webp");
  assert.equal(fallback.image.kind, "representative");
  assert.match(fallback.image.src || "", /^\/images\/disciplines\/fallbacks\//);
});

test("reutiliza relacionados reales, excluye el actual y enlaza sólo fichas Preview", () => {
  const current = event();
  const events = [
    current,
    event({ id: "event-2", slug: "rally-asturias-2", title: "Rally Asturias 2", start: "2026-08-23" }),
    event({ id: "event-3", slug: "rally-asturias-3", title: "Rally Asturias 3", start: "2026-08-24" }),
    event({ id: "event-4", slug: "rally-galicia", title: "Rally Galicia", province: "A Coruña", start: "2026-08-25" }),
    event({ id: "event-5", slug: "rally-cantabria", title: "Rally Cantabria", province: "Cantabria", start: "2026-08-26" }),
  ];
  const model = buildEventDetailV2Model(current, events, options);
  assert.ok(model);
  assert.equal(model.related.length, 3);
  assert.equal(model.related.some(({ slug }) => slug === current.slug), false);
  assert.equal(new Set(model.related.map(({ slug }) => slug)).size, model.related.length);
  assert.equal(model.related.every(({ href }) => href.startsWith("/preview/redesign-v2/evento/")), true);
});

test("calcula hoy con Europe/Madrid de forma determinista", () => {
  assert.equal(madridDateKey(new Date("2026-08-15T22:30:00.000Z")), "2026-08-16");
});

test("deduplica labels relacionados visualmente idénticos", () => {
  assert.equal(formatRelatedEventLabel("MotoGP", "MotoGP"), "MotoGP");
});

test("conserva labels relacionados semánticamente distintos", () => {
  assert.equal(formatRelatedEventLabel("Cerca", "Motocross"), "Cerca · Motocross");
});

test("normaliza casing, trim y espacios al deduplicar labels relacionados", () => {
  assert.equal(formatRelatedEventLabel(" MotoGP  ", "motogp"), "MotoGP");
});
