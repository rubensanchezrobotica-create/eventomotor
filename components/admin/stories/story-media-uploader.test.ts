import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  STORY_MEDIA_UPLOAD_BATCH_LIMIT,
  STORY_MEDIA_UPLOAD_CONCURRENCY,
  retryableStoryMediaQueueItems,
  runStoryMediaQueue,
  storyMediaBadge,
  storyMediaQueueStatusLabel,
  storyMediaReadinessMessage,
  validateStoryMediaBatch,
  validateStoryMediaFile,
} from "./story-media-uploader";

const valid = { name: "foto.jpg", type: "image/jpeg", size: 1_000 };

test("accepts only the approved image contract and caps batches at 20", () => {
  assert.equal(validateStoryMediaFile(valid), null);
  assert.match(validateStoryMediaFile({ ...valid, type: "image/svg+xml", name: "foto.svg" }) ?? "", /JPEG/);
  assert.match(validateStoryMediaFile({ ...valid, name: "foto.png" }) ?? "", /extensión/);
  for (const [name, type] of [
    ["foto.gif", "image/gif"],
    ["foto.svg", "image/svg+xml"],
    ["foto.heic", "image/heic"],
    ["foto.raw", "image/x-raw"],
    ["foto.pdf", "application/pdf"],
  ]) {
    assert.ok(validateStoryMediaFile({ ...valid, name, type }));
  }
  assert.match(validateStoryMediaBatch(Array.from({ length: STORY_MEDIA_UPLOAD_BATCH_LIMIT + 1 }, () => valid)) ?? "", /20/);
});

test("queue exposes the complete Spanish status contract", () => {
  assert.deepEqual(
    ["PENDING", "SIGNING", "UPLOADING", "FINALIZING", "COMPLETE", "ERROR"].map(
      (status) => storyMediaQueueStatusLabel(status as Parameters<typeof storyMediaQueueStatusLabel>[0]),
    ),
    ["PENDIENTE", "OBTENIENDO PERMISO", "SUBIENDO", "VALIDANDO", "LISTA", "ERROR"],
  );
});

test("queue uses concurrency three and isolates individual failures", async () => {
  assert.equal(STORY_MEDIA_UPLOAD_CONCURRENCY, 3);
  let active = 0;
  let peak = 0;
  const completed: number[] = [];
  await runStoryMediaQueue([1, 2, 3, 4, 5], async (value) => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 2));
    active -= 1;
    if (value === 2) throw new Error("synthetic");
    completed.push(value);
  });
  assert.equal(peak, 3);
  assert.deepEqual(completed.sort(), [1, 3, 4, 5]);
});

test("uploader retry preserves the original operationId after a failed attempt", async () => {
  const item = {
    operationId: "22222222-2222-4222-8222-222222222222",
    status: "ERROR" as const,
  };
  const observed: string[] = [];
  let attempt = 0;
  const worker = async (current: typeof item) => {
    attempt += 1;
    observed.push(current.operationId);
    if (attempt === 1) throw new Error("synthetic upload failure");
  };

  await runStoryMediaQueue(retryableStoryMediaQueueItems([item]), worker);
  await runStoryMediaQueue(retryableStoryMediaQueueItems([item]), worker);
  assert.deepEqual(observed, [item.operationId, item.operationId]);
});

test("readiness presentation never labels drafts or unconfirmed public media as ready", () => {
  const ready = { ready: true, publicationErrors: [], storageIssues: [] };
  const blocked = {
    ready: false,
    publicationErrors: [{ code: "MEDIA_ALT_REQUIRED" }],
    storageIssues: [],
  };
  assert.equal(storyMediaBadge("story-media-drafts", ready), "DRAFT");
  assert.equal(storyMediaBadge("story-media", undefined), "PUBLIC");
  assert.equal(storyMediaBadge("story-media", null), "PUBLIC");
  assert.equal(storyMediaBadge("story-media", blocked), "PUBLIC");
  assert.equal(storyMediaBadge("story-media", ready), "PUBLIC ASSET READY");
  assert.match(storyMediaReadinessMessage(ready), /supera el gate/);
  assert.match(storyMediaReadinessMessage(blocked), /sigue bloqueada/);
  assert.match(storyMediaReadinessMessage(null), /no se pudo confirmar/);
});

test("editor uploads directly with the signed token and exposes no delete path", () => {
  const source = readFileSync(
    new URL("./StoryMediaUploader.client.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /uploadToSignedUrl\(/);
  assert.match(source, /upsert:\s*false/);
  assert.match(source, /upload-intent/);
  assert.match(source, /upload-finalize/);
  assert.match(source, /preview-url/);
  assert.match(source, /Preparar para publicar/);
  assert.match(source, /crypto\.randomUUID\(\)/);
  assert.match(source, /retryableStoryMediaQueueItems\(queue\)/);
  assert.match(source, /setReadiness\(result\.readiness\)/);
  assert.match(source, /storyMediaBadge\(item\.bucket_id, readiness\)/);
  assert.match(source, /result\.code === "story_version_conflict"/);
  const editorSource = readFileSync(
    new URL("./StoryEditor.client.tsx", import.meta.url),
    "utf8",
  );
  assert.match(editorSource, /key=\{media\.map\(/);
  assert.match(source, /multiple/);
  assert.match(source, /status:\s*"SIGNING"/);
  assert.match(source, /status:\s*"UPLOADING"/);
  assert.match(source, /status:\s*"FINALIZING"/);
  assert.match(source, /status:\s*"COMPLETE"/);
  assert.match(source, /status:\s*"ERROR"/);
  assert.match(source, /router\.refresh\(\)/);
  assert.doesNotMatch(source, /\.remove\(|delete-media|Eliminar imagen/);
});
