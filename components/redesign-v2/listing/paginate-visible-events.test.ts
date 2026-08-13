import assert from "node:assert/strict";
import test from "node:test";
import { assignV2HomeEventImages } from "../discipline-fallback-resolver";
import type { PreviewEvent } from "../redesign-v2-model";
import { paginateVisibleEvents } from "./paginate-visible-events";

function fixture(index: number): PreviewEvent {
  return {
    id: `event-${index}`,
    slug: `event-${index}`,
    title: `Super Enduro ${index}`,
    championship: "",
    discipline: "Super Enduro",
    start: "2026-09-19",
    end: "2026-09-19",
    city: "Madrid",
    province: "Madrid",
    region: "Comunidad de Madrid",
    venue: "Circuito",
    tags: ["super enduro"],
    vehicleType: "Moto",
    featured: false,
    imageUrl: undefined,
  };
}

test("pagina con un tamaño configurable y normaliza límites", () => {
  const events = Array.from({ length: 26 }, (_, index) => fixture(index));
  const images = assignV2HomeEventImages(events);
  const imageByEventId = Object.fromEntries(events.map((event, index) => [event.id, images[index]]));
  const result = paginateVisibleEvents({ events, imageByEventId, page: 9, pageSize: 12 });

  assert.equal(result.page, 3);
  assert.equal(result.pageCount, 3);
  assert.equal(result.total, 26);
  assert.equal(result.visible.length, 2);
});

test("aplica R3F después de obtener la secuencia final visible", () => {
  const events = Array.from({ length: 15 }, (_, index) => fixture(index));
  const images = assignV2HomeEventImages(events);
  const imageByEventId = Object.fromEntries(events.map((event, index) => [event.id, images[index]]));
  const result = paginateVisibleEvents({ events, imageByEventId, page: 2, pageSize: 12 });

  assert.deepEqual(result.visible.map(({ id }) => id), ["event-12", "event-13", "event-14"]);
  assert.equal(result.visibleImages.length, 3);
  for (let index = 1; index < result.visibleImages.length; index += 1) {
    assert.notEqual(result.visibleImages[index].fallbackId, result.visibleImages[index - 1].fallbackId);
  }
});
