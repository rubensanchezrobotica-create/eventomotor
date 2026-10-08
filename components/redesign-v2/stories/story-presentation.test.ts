import assert from "node:assert/strict";
import test from "node:test";
import { groupStoryByline, storyCollectionLabels, storyImageRatio, storyPairGeometry, storyTypeLabels } from "./story-presentation";

test("todos los tipos y colecciones tienen etiquetas humanas", () => {
  assert.deepEqual(Object.values(storyTypeLabels), ["Crónica", "Reportaje", "Historia", "Entrevista"]);
  assert.deepEqual(Object.values(storyCollectionLabels), ["Desde dentro", "Historias de motor", "Conversaciones"]);
});
test("firma agrupa TEXT y PHOTO por ID sin mutar ni agrupar homónimos", () => {
  const credits = Object.freeze([
    { personId: "b", role: "PHOTO" as const, sortOrder: 2 },
    { personId: "a", role: "TEXT" as const, sortOrder: 0 },
    { personId: "a", role: "PHOTO" as const, sortOrder: 1 },
  ]);
  const before = JSON.stringify(credits);
  assert.deepEqual(groupStoryByline(credits, { a: "Mismo nombre", b: "Mismo nombre" }), [
    { personId: "a", name: "Mismo nombre", label: "Texto y fotografía" },
    { personId: "b", name: "Mismo nombre", label: "Fotografía" },
  ]);
  assert.equal(JSON.stringify(credits), before);
});
test("firma distingue vídeo, colaboración y persona no disponible", () => {
  assert.deepEqual(groupStoryByline([
    { personId: "a", role: "VIDEO", sortOrder: 0 },
    { personId: "b", role: "CONTRIBUTOR", sortOrder: 1 },
  ], { a: "Persona" }), [
    { personId: "a", name: "Persona", label: "Vídeo" },
    { personId: "b", name: "Persona no disponible", label: "Colaboración" },
  ]);
  assert.deepEqual(groupStoryByline([], {}), []);
});
test("ratios proceden sólo de dimensiones válidas", () => {
  assert.equal(storyImageRatio({ width: 900, height: 1200 }), .75);
  assert.equal(storyImageRatio({ width: 1200, height: 900 }), 4 / 3);
  for (const item of [undefined, { width: 0, height: 1 }, { width: 1, height: -1 }, { width: Infinity, height: 1 }, { width: 1, height: NaN }]) assert.equal(storyImageRatio(item), null);
});
test("pareja 3:4 + 4:3 usa alturas comunes y anchos proporcionales", () => {
  const result = storyPairGeometry([{ width: 900, height: 1200 }, { width: 1200, height: 900 }]);
  assert.ok(result);
  const height = (960 - 20) / result.sum;
  assert.ok(Math.abs(height - 451.2) < .01);
  assert.ok(Math.abs(height * result.left - 338.4) < .01);
  assert.ok(Math.abs(height * result.right - 601.6) < .01);
});
test("parejas con dimensiones desconocidas o extremas se apilan, sin crop", () => {
  assert.equal(storyPairGeometry([{ width: 900, height: 1200 }, undefined]), null);
  assert.equal(storyPairGeometry([{ width: 100, height: 1200 }, { width: 1200, height: 900 }]), null);
  assert.equal(storyPairGeometry([{ width: 3000, height: 900 }, { width: 1200, height: 900 }]), null);
});
