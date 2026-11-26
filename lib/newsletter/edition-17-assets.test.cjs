/* eslint-disable @typescript-eslint/no-require-imports -- Node CJS asset check can use existing local Sharp installation. */
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { readFile, readdir } = require("node:fs/promises");
const { resolve } = require("node:path");
const { test } = require("node:test");
const sharp = require("sharp");

const root = resolve("docs/newsletter/ediciones/2026-11-26");

test("Ed17 has exactly eight approved local assets matching the candidate manifest", async () => {
  const manifest = JSON.parse(await readFile(resolve(root, "asset-manifest.json"), "utf8"));
  assert.equal(manifest.length, 8);
  assert.deepEqual((await readdir(resolve(root, "assets"))).sort(), manifest.map(({ file }) => file).sort());
  for (const entry of manifest) {
    const bytes = await readFile(resolve(root, "assets", entry.file));
    const metadata = await sharp(bytes).metadata();
    assert.equal(bytes.length, entry.bytes, entry.file);
    assert.ok(bytes.length > 0 && bytes.length <= 300_000, entry.file);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), entry.sha256, entry.file);
    assert.equal(metadata.width, entry.width, entry.file);
    assert.equal(metadata.height, entry.height, entry.file);
    assert.equal(metadata.format, entry.file.endsWith(".webp") ? "webp" : "png", entry.file);
  }
});

test("Ed17 header is opaque on the canonical near-black background", async () => {
  const header = await readFile(resolve(root, "assets/eventomotor-header.png"));
  const { data } = await sharp(header).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let index = 3; index < data.length; index += 4) assert.equal(data[index], 255);
  assert.deepEqual([...data.subarray(0, 3)], [5, 6, 8]);
});
