import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("la validación de borradores solo consulta events y no modifica updated_at", async () => {
  const source = await readFile(new URL("./route.ts", import.meta.url), "utf8");

  assert.match(source, /\.from\("events"\)\.select\(/);
  assert.doesNotMatch(source, /\.from\("events"\)[\s\S]*?\.update\(/);
  assert.doesNotMatch(source, /\.from\("events"\)[\s\S]*?\.insert\(/);
  assert.doesNotMatch(source, /\.from\("events"\)[\s\S]*?\.upsert\(/);
  assert.doesNotMatch(source, /\bupdated_at\b/);
});
