import assert from "node:assert/strict";
import test from "node:test";
import type { PreviewEvent, ResolvedEventImage } from "../redesign-v2-model";
import { diversifyWeekendVisibleImages } from "./weekend-visible-images";

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
    vehicleType: "moto",
    featured: false,
    imageUrl: undefined,
    ...overrides,
  };
}

function representative(
  fallbackId = "offroad-03",
  subtype = "motocross",
  fallbackTier: 1 | 2 | 3 | 4 = 1,
): ResolvedEventImage {
  return {
    src: `/images/${fallbackId}.webp`,
    kind: "representative",
    alt: "",
    label: "Imagen representativa",
    fallbackId,
    fallbackTier,
    fallbackReason: "disciplina y vehículo exactos",
    interpretedDiscipline: "offroad",
    interpretedVehicle: "moto",
    interpretedSubtype: subtype,
  };
}

test("usa candidatos compatibles antes de repetir y mantiene determinismo", () => {
  const events = Array.from({ length: 6 }, (_, index) => event(index + 1));
  const assigned = events.map(() => representative());
  const first = diversifyWeekendVisibleImages(events, assigned).map((image) => image.fallbackId);
  const second = diversifyWeekendVisibleImages(events, assigned).map((image) => image.fallbackId);
  assert.deepEqual(first, second);
  assert.equal(new Set(first.slice(0, 3)).size, 3);
  assert.equal(new Set(first).size, 3);
  assert.equal(first.some((id, index) => index > 0 && id === first[index - 1]), false);
});

test("un pool de una sola imagen permite repetición sin bajar de tier", () => {
  const events = [1, 2, 3].map((index) => event(index, {
    title: `Trial Indoor ${index}`,
    discipline: "Trial Indoor",
    tags: ["trial-indoor"],
  }));
  const images = diversifyWeekendVisibleImages(
    events,
    events.map(() => representative("offroad-12", "trial-indoor", 1)),
  );
  assert.deepEqual(images.map((image) => image.fallbackId), ["offroad-12", "offroad-12", "offroad-12"]);
  assert.equal(images.every((image) => image.fallbackTier === 1), true);
});

test("Supercross permanece en Offroad, Moto y pool Motocross", () => {
  const supercross = event(1, {
    title: "Supercross Castrojeriz 2026",
    discipline: "Supercross",
    tags: ["supercross"],
  });
  const [image] = diversifyWeekendVisibleImages([supercross], [representative("offroad-05", "supercross", 2)]);
  assert.equal(image.interpretedDiscipline, "offroad");
  assert.equal(image.interpretedVehicle, "moto");
  assert.equal(image.interpretedSubtype, "supercross");
  assert.equal(["offroad-03", "offroad-09", "offroad-10"].includes(image.fallbackId ?? ""), true);
  assert.notEqual(image.fallbackId, "offroad-05");
});

test("una imagen real permanece intacta", () => {
  const real = { src: "https://example.com/event.jpg", kind: "event", alt: "Evento" } as const;
  assert.equal(diversifyWeekendVisibleImages([event(1)], [real])[0], real);
});
