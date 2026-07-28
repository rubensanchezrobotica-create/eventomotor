import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const intent = readFileSync(
  new URL("./image-upload-intent/route.ts", import.meta.url),
  "utf8",
);
const finalize = readFileSync(
  new URL("./image-upload-finalize/route.ts", import.meta.url),
  "utf8",
);

test("ambas rutas exigen autorización admin", () => {
  assert.match(intent, /validateAdminRequest\(request\)/);
  assert.match(finalize, /validateAdminRequest\(request\)/);
});

test("la intención no actualiza events", () => {
  assert.doesNotMatch(intent, /\.update\(/);
  assert.doesNotMatch(intent, /\.insert\(/);
});

test("la intención crea token sin upsert", () => {
  assert.match(intent, /createSignedUploadUrl\(objectPath, \{ upsert: false \}\)/);
});

test("finalización actualiza solo imagen, fuente y updated_at mediante helper", () => {
  assert.match(finalize, /image_url: imageUrl,\s+image_source_url: imageSourceUrl/);
  assert.match(finalize, /updateExistingEvent/);
  assert.doesNotMatch(finalize, /title:/);
  assert.doesNotMatch(finalize, /slug:/);
});

test("finalización exige concurrencia del cliente", () => {
  assert.match(finalize, /expectedUpdatedAt: currentUpdatedAt/);
  assert.match(finalize, /\.eq\("updated_at", expectedUpdatedAt\)/);
});

test("finalización verifica que la URL pública sea accesible", () => {
  assert.match(finalize, /fetch\(imageUrl/);
  assert.match(finalize, /method: "HEAD"/);
  assert.match(finalize, /publicResponse\.ok/);
});

test("finalización limpia el objeto nuevo tras fallo", () => {
  assert.match(finalize, /\.remove\(\[uploadedObjectPath\]\)/);
  assert.match(finalize, /await cleanupNewObject\(\)/);
});

test("la imagen anterior nunca se elimina", () => {
  assert.doesNotMatch(finalize, /image_source_url[\s\S]*remove/);
  assert.doesNotMatch(finalize, /updated\.image_url[\s\S]*remove/);
});

test("ninguna ruta registra tokens", () => {
  assert.doesNotMatch(intent, /console\./);
  assert.doesNotMatch(finalize, /console\.(log|error).*token/i);
});
