import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { formatImageBytes, imageDimensionWarnings } from "./EventImageUploader";

const source = readFileSync(new URL("./EventImageUploader.tsx", import.meta.url), "utf8");

test("muestra warning de proporción", () => {
  assert.match(imageDimensionWarnings({ width: 1000, height: 1000 }).join(" "), /16:9/);
});

test("muestra warning de resolución", () => {
  assert.match(imageDimensionWarnings({ width: 1199, height: 674 }).join(" "), /resolución/);
});

test("no bloquea una imagen 1600 × 900", () => {
  assert.deepEqual(imageDimensionWarnings({ width: 1600, height: 900 }), []);
});

test("formatea el peso", () => {
  assert.equal(formatImageBytes(2 * 1024 * 1024), "2.00 MB");
});

test("el selector tiene accept exacto", () => {
  assert.match(source, /accept="\.jpg,\.jpeg,\.png,\.webp"/);
});

test("la autorización es obligatoria para habilitar el botón", () => {
  assert.match(source, /disabled=\{!file \|\| !authorized \|\| busy\}/);
});

test("libera cada object URL", () => {
  assert.match(source, /URL\.revokeObjectURL\(previewUrl\)/);
});

test("previene doble envío", () => {
  assert.match(source, /if \(!file \|\| !authorized \|\| busy\) return/);
});

test("la sustitución pide confirmación explícita", () => {
  assert.match(source, /window\.confirm/);
  assert.match(source, /anterior no se eliminará/);
});

test("usa uploadToSignedUrl", () => {
  assert.match(source, /\.uploadToSignedUrl\(/);
  assert.match(source, /upsert: false/);
});
