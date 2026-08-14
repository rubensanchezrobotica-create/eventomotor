import assert from "node:assert/strict";
import test from "node:test";
import type { PreviewEvent, ResolvedEventImage } from "../redesign-v2-model";
import { diversifyCalendarVisibleImages } from "./calendar-visible-images";

function event(index: number, overrides: Partial<PreviewEvent> = {}): PreviewEvent {
  return {
    id: `event-${index}`,
    slug: `event-${index}`,
    title: `Motocross ${index}`,
    championship: "Campeonato regional",
    discipline: "Motocross",
    start: "2026-08-15",
    end: "2026-08-15",
    venue: "Circuito",
    city: "Burgos",
    province: "Burgos",
    region: "Castilla y León",
    tags: ["motocross"],
    vehicleType: "Moto",
    featured: false,
    imageUrl: undefined,
    ...overrides,
  };
}

function representative(fallbackId = "offroad-05", subtype = "supercross", fallbackTier: 1 | 2 | 3 | 4 = 2): ResolvedEventImage {
  return {
    src: `/images/${fallbackId}.webp`,
    kind: "representative",
    alt: "",
    label: "Imagen representativa",
    fallbackId,
    fallbackTier,
    fallbackReason: "disciplina y vehiculo exactos",
    interpretedDiscipline: "offroad",
    interpretedVehicle: "moto",
    interpretedSubtype: subtype,
  };
}

test("Supercross sustituye el fallback Trial por el pool Motocross compatible", () => {
  const supercross = event(1, { title: "Supercross Castrojeriz 2026", discipline: "Supercross", tags: ["Supercross"] });
  const [image] = diversifyCalendarVisibleImages([supercross], [representative()]);
  assert.equal(image.interpretedDiscipline, "offroad");
  assert.equal(image.interpretedVehicle, "moto");
  assert.equal(image.interpretedSubtype, "supercross");
  assert.ok(["offroad-03", "offroad-09", "offroad-10"].includes(image.fallbackId ?? ""));
  assert.notEqual(image.fallbackId, "offroad-05");
});

test("usa todos los fallbacks semánticamente compatibles antes de repetir", () => {
  const events = [event(1), event(2), event(3)];
  const images = diversifyCalendarVisibleImages(events, events.map(() => representative("offroad-03", "motocross", 1)));
  assert.equal(new Set(images.map((image) => image.fallbackId)).size, 3);
  assert.ok(images.every((image) => ["offroad-03", "offroad-09", "offroad-10"].includes(image.fallbackId ?? "")));
});

test("seis concentraciones distribuyen determinísticamente al menos tres escenas compatibles", () => {
  const events = [
    event(1, { title: "Gran concentración motera", discipline: "Concentraciones", tags: ["concentracion"], vehicleType: "Moto" }),
    event(2, { title: "Motoalmuerzo popular", discipline: "Concentraciones", tags: ["motoalmuerzo"], vehicleType: "Moto" }),
    event(3, { title: "Concentración custom nocturna", discipline: "Concentraciones", tags: ["custom", "nocturna"], vehicleType: "Moto" }),
    event(4, { title: "Encuentro motero", discipline: "Concentraciones", tags: ["concentracion"], vehicleType: "Moto" }),
    event(5, { title: "Matinal motera", discipline: "Concentraciones", tags: ["motoalmuerzo"], vehicleType: "Moto" }),
    event(6, { title: "Reunión biker nocturna", discipline: "Concentraciones", tags: ["custom", "biker"], vehicleType: "Moto" }),
  ];
  const assigned = [
    representative("concentraciones-06", "concentracion", 1),
    representative("concentraciones-07", "motoalmuerzo", 1),
    representative("concentraciones-08", "custom-biker", 1),
    representative("concentraciones-06", "concentracion", 1),
    representative("concentraciones-07", "motoalmuerzo", 1),
    representative("concentraciones-08", "custom-biker", 1),
  ];

  const first = diversifyCalendarVisibleImages(events, assigned).map((image) => image.fallbackId);
  const second = diversifyCalendarVisibleImages(events, assigned).map((image) => image.fallbackId);
  assert.deepEqual(first, second);
  assert.ok(new Set(first).size >= 3);
  assert.equal(first.some((id, index) => index > 0 && id === first[index - 1]), false);
  assert.ok(first.every((id) => ["concentraciones-06", "concentraciones-07", "concentraciones-08", "concentraciones-09"].includes(id ?? "")));
});

test("nunca altera una imagen real del evento", () => {
  const real = { src: "https://example.com/event.jpg", kind: "event", alt: "Evento" } as const;
  assert.equal(diversifyCalendarVisibleImages([event(1)], [real])[0], real);
});
