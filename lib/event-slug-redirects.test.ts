import assert from "node:assert/strict";
import test from "node:test";
import {
  eventSlugRedirectHref,
  resolveEventSlugRedirect,
  shouldRedirectEventSlugBeforeLookup,
} from "./event-slug-redirects";

const accidental = "rpm-fest-night-demons-2026-2026-08-15";
const canonical = "rpm-fest-night-demons-2026";
const vallDuplicate = "rally-vall-sant-pere-2026-09-25";
const vallCanonical = "rally-vall-sant-pere-esporles-2026-09-25";

test("el slug accidental resuelve directamente al canónico", () => {
  assert.equal(resolveEventSlugRedirect(accidental), canonical);
  assert.equal(resolveEventSlugRedirect(canonical), null);
  assert.equal(shouldRedirectEventSlugBeforeLookup(accidental), false);
});

test("preserva query parameters sin crear bucle ni cadena", () => {
  assert.equal(
    eventSlugRedirectHref(accidental, { utm_source: "organizador", tag: ["moto", "festival"] }),
    `/evento/${canonical}?utm_source=organizador&tag=moto&tag=festival`,
  );
  assert.equal(eventSlugRedirectHref(canonical), null);
  assert.equal(resolveEventSlugRedirect(canonical), null);
});

test("Vall de Sant Pere resuelve directamente a Esporles sin bucle", () => {
  assert.equal(resolveEventSlugRedirect(vallDuplicate), vallCanonical);
  assert.equal(eventSlugRedirectHref(vallDuplicate), `/evento/${vallCanonical}`);
  assert.equal(shouldRedirectEventSlugBeforeLookup(vallDuplicate), true);
  assert.equal(resolveEventSlugRedirect(vallCanonical), null);
  assert.equal(eventSlugRedirectHref(vallCanonical), null);
  assert.equal(shouldRedirectEventSlugBeforeLookup(vallCanonical), false);
});
