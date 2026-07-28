import assert from "node:assert/strict";
import test from "node:test";
import {
  eventSlugRedirectHref,
  resolveEventSlugRedirect,
} from "./event-slug-redirects";

const accidental = "rpm-fest-night-demons-2026-2026-08-15";
const canonical = "rpm-fest-night-demons-2026";

test("el slug accidental resuelve directamente al canónico", () => {
  assert.equal(resolveEventSlugRedirect(accidental), canonical);
  assert.equal(resolveEventSlugRedirect(canonical), null);
});

test("preserva query parameters sin crear bucle ni cadena", () => {
  assert.equal(
    eventSlugRedirectHref(accidental, { utm_source: "organizador", tag: ["moto", "festival"] }),
    `/evento/${canonical}?utm_source=organizador&tag=moto&tag=festival`,
  );
  assert.equal(eventSlugRedirectHref(canonical), null);
  assert.equal(resolveEventSlugRedirect(canonical), null);
});
