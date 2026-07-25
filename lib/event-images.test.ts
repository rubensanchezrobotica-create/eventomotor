import assert from "node:assert/strict";
import test from "node:test";
import { getEventImage, getEventImageAlt } from "./event-images";

test("una concentración de coches clásicos usa fallback de clásicos y no de motos", () => {
  const event = {
    title: "II Concentración de Coches Clásicos Baifest Barañáin 2026",
    discipline: "Clásicos",
    vehicle_type: "coche",
    tags: ["coches clásicos", "concentración"],
  };
  const image = getEventImage(event);
  assert.equal(image, "/images/disciplines/eventomotor-fallback-clasicos.webp");
  assert.match(getEventImageAlt(event), /vehículos clásicos/);
  assert.doesNotMatch(getEventImageAlt(event), /motera/);
});
