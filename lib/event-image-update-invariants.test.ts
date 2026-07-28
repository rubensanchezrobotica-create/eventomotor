import assert from "node:assert/strict";
import test from "node:test";
import { assertOnlyEventImageFieldsChanged } from "./event-image-update-invariants";

const before = {
  id: "event-1",
  slug: "slug-estable",
  title: "Título",
  start_date: "2026-08-15",
  venue: "Recinto",
  data_quality: "published",
  visible: true,
  tags: ["moto"],
  image_url: "https://example.com/old.png",
  image_source_url: null,
  updated_at: "2026-07-28T08:00:00.000Z",
};

test("subir o reemplazar imagen conserva todos los demás campos, incluido slug", () => {
  const after = {
    ...structuredClone(before),
    image_url: "https://example.com/new.png",
    image_source_url: "https://example.com/source",
    updated_at: "2026-07-28T08:01:00.000Z",
  };
  assert.doesNotThrow(() => assertOnlyEventImageFieldsChanged(before, after));
});

test("bloquea cualquier cambio lateral producido durante la actualización de imagen", () => {
  assert.throws(
    () => assertOnlyEventImageFieldsChanged(before, { ...before, slug: "slug-cambiado" }),
    /campo protegido slug/,
  );
});
