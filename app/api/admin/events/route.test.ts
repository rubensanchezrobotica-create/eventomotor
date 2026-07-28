import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(new URL("./route.ts", import.meta.url), "utf8");
const adminPage = readFileSync(
  new URL("../../../admin/page.tsx", import.meta.url),
  "utf8",
);

test("crear puede generar slug, pero guardar un evento existente nunca lo incluye", () => {
  assert.match(route, /parseAdminEventBody\(await request\.json\(\), true\)/);
  assert.match(route, /parseAdminEventBody\(body, false\)/);
  assert.match(route, /includeSlug \? \{ slug:/);
  assert.doesNotMatch(adminPage, /type EventForm = \{[\s\S]*?\n\s+slug:/);
});

test("ediciones normales de título, fecha, lugar, estado y formulario completo preservan slug", () => {
  for (const field of ["title", "start_date", "venue", "event_status", "data_quality"]) {
    assert.match(route, new RegExp(`\\b${field}\\b`));
  }
  assert.match(route, /\.select\("slug,updated_at"\)/);
  assert.match(route, /data\?\.slug !== preservedSlug/);
});

test("el guardado normal aplica concurrencia optimista y actualiza updated_at", () => {
  assert.match(adminPage, /expectedUpdatedAt:/);
  assert.match(route, /expectedUpdatedAt is required/);
  assert.match(route, /expectedUpdatedAt,\s+repository:/);
  assert.match(route, /updateExistingEvent/);
});
