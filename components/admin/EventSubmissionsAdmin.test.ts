import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("el panel ofrece formulario editable y JSON técnico de solo lectura", async () => {
  const source = await readFile(new URL("./EventSubmissionsAdmin.tsx", import.meta.url), "utf8");

  assert.match(source, /Revisar datos antes de publicar/);
  assert.match(source, /Validar cambios/);
  assert.match(source, /Restablecer borrador/);
  assert.match(source, /<details[\s\S]*Ver JSON del borrador[\s\S]*<pre/);
  assert.doesNotMatch(source, /contentEditable/);
  assert.match(source, /Has modificado el borrador\. Valida de nuevo antes de publicar\./);
  assert.match(source, /validatedExactDraft/);
});

test("validación y publicación reciben el borrador mantenido en estado, sin regenerarlo", async () => {
  const source = await readFile(new URL("./EventSubmissionsAdmin.tsx", import.meta.url), "utf8");

  assert.match(source, /body: JSON\.stringify\(draft\)/);
  assert.match(source, /body: JSON\.stringify\(\{\s*draft,/);
  assert.doesNotMatch(source, /handlePublishDraft[\s\S]*buildDraftPreview\(submission\)/);
});
