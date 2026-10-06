import assert from "node:assert/strict";
import test from "node:test";
import type { StoryContentBlock } from "./story-types";
import {
  appendStoryBlock,
  moveStoryBlock,
  parseStoryBlocksJson,
  removeStoryBlock,
  replaceStoryBlock,
  validateStoryAdminInput,
  type StoryAdminInput,
} from "./story-admin";

function validInput(overrides: Partial<StoryAdminInput> = {}): StoryAdminInput {
  return {
    status: "DRAFT",
    type: "REPORTAJE",
    collection: "DESDE_DENTRO",
    title: "Historia sintética",
    dek: "Entradilla sintética",
    contextLocation: "Circuito de pruebas",
    slug: "historia-sintetica",
    disciplineSlugs: ["rallyes"],
    territoryIds: ["madrid"],
    contentBlocks: [{
      id: "paragraph-1",
      type: "PARAGRAPH",
      content: [{ type: "TEXT", text: "Contenido sintético." }],
    }],
    heroMediaId: "",
    seoTitle: "Historia sintética",
    seoDescription: "Descripción sintética para pruebas.",
    ...overrides,
  };
}

test("an incomplete DRAFT remains editable", () => {
  const result = validateStoryAdminInput(validInput({
    title: "",
    dek: "",
    slug: "",
    seoTitle: "",
    seoDescription: "",
    contentBlocks: [],
  }));
  assert.equal(result.ok, true);
});

test("PUBLISHED and ARCHIVED mutations are rejected by the A16C editor", () => {
  assert.equal(validateStoryAdminInput(validInput({ status: "PUBLISHED" })).ok, false);
  assert.equal(validateStoryAdminInput(validInput({ status: "ARCHIVED" })).ok, false);
});

test("an invalid slug is rejected", () => {
  const result = validateStoryAdminInput(validInput({ slug: "Slug con espacios" }));
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.issues.some((item) => item.field === "slug"));
});

for (const [field, overrides] of [
  ["title", { title: "" }],
  ["dek", { dek: "" }],
  ["seoTitle", { seoTitle: "" }],
  ["seoDescription", { seoDescription: "" }],
] as const) {
  test(`READY without ${field} is rejected`, () => {
    const result = validateStoryAdminInput(validInput({ status: "READY", ...overrides }));
    assert.equal(result.ok, false);
    if (!result.ok) assert.ok(result.issues.some((item) => item.field === field));
  });
}

test("READY without a hero is explicitly allowed by the editorial gate", () => {
  const result = validateStoryAdminInput(validInput({ status: "READY", heroMediaId: "" }));
  assert.equal(result.ok, true);
});

test("invalid structured body and arbitrary HTML fail closed", () => {
  const result = validateStoryAdminInput(validInput({
    status: "READY",
    contentBlocks: [{
      id: "unsafe",
      type: "PARAGRAPH",
      html: "<script>alert(1)</script>",
      content: [{ type: "TEXT", text: "Safe text" }],
    }],
  }));
  assert.equal(result.ok, false);
});

test("all seven block types serialize through the A16A1 document contract", () => {
  const blocks: StoryContentBlock[] = [
    { id: "p", type: "PARAGRAPH", content: [{ type: "TEXT", text: "P" }] },
    { id: "h", type: "HEADING", level: 2, text: "H" },
    { id: "q", type: "PULL_QUOTE", text: "Q" },
    { id: "i", type: "IMAGE", mediaId: "media-1" },
    { id: "pair", type: "IMAGE_PAIR", mediaIds: ["media-1", "media-2"] },
    { id: "gallery", type: "GALLERY", mediaIds: ["media-1", "media-2"] },
    { id: "event", type: "EVENT_REFERENCE", eventId: "event-1" },
  ];
  const parsed = parseStoryBlocksJson(JSON.stringify(blocks));
  assert.deepEqual(parsed?.contentBlocks, blocks);
});

test("block add, remove, replace and move preserve deterministic order", () => {
  const first: StoryContentBlock = {
    id: "first",
    type: "PARAGRAPH",
    content: [{ type: "TEXT", text: "First" }],
  };
  const second: StoryContentBlock = { id: "second", type: "HEADING", level: 2, text: "Second" };
  const third: StoryContentBlock = { id: "third", type: "PULL_QUOTE", text: "Third" };
  const added = appendStoryBlock([first, second], third);
  assert.deepEqual(added.map(({ id }) => id), ["first", "second", "third"]);
  assert.deepEqual(moveStoryBlock(added, 2, -1).map(({ id }) => id), ["first", "third", "second"]);
  assert.deepEqual(removeStoryBlock(added, "second").map(({ id }) => id), ["first", "third"]);
  const replacement = { ...second, text: "Updated" };
  assert.equal((replaceStoryBlock(added, replacement)[1] as typeof second).text, "Updated");
});
