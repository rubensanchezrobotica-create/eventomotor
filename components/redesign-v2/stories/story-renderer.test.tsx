import assert from "node:assert/strict";
import test from "node:test";
import type { StoryContentBlock } from "../../../lib/stories/story-types";
import { validateStoryDocument } from "../../../lib/stories/story-validation";

function futureRendererContract(block: StoryContentBlock) {
  switch (block.type) {
    case "PARAGRAPH":
      return "inline-content";
    case "HEADING":
      return `h${block.level}`;
    case "IMAGE":
      return "media-id";
    case "IMAGE_PAIR":
      return "two-media-ids";
    case "GALLERY":
      return "ordered-media-ids";
    case "PULL_QUOTE":
      return "escaped-quote";
    case "EVENT_REFERENCE":
      return "opaque-event-id";
    default: {
      const exhaustive: never = block;
      return exhaustive;
    }
  }
}

test("el contrato futuro del renderer cubre exhaustivamente los siete bloques", () => {
  const blocks: StoryContentBlock[] = [
    { id: "p", type: "PARAGRAPH", content: [{ type: "TEXT", text: "Texto" }] },
    { id: "h", type: "HEADING", level: 2, text: "Título" },
    { id: "i", type: "IMAGE", mediaId: "media-1" },
    { id: "ip", type: "IMAGE_PAIR", mediaIds: ["media-1", "media-2"] },
    { id: "g", type: "GALLERY", mediaIds: ["media-1", "media-2"] },
    { id: "q", type: "PULL_QUOTE", text: "Cita" },
    { id: "e", type: "EVENT_REFERENCE", eventId: "event-key" },
  ];
  assert.deepEqual(blocks.map(futureRendererContract), [
    "inline-content",
    "h2",
    "media-id",
    "two-media-ids",
    "ordered-media-ids",
    "escaped-quote",
    "opaque-event-id",
  ]);
});

test("raw HTML, style, className y handlers no forman parte del contrato", () => {
  const result = validateStoryDocument({
    schemaVersion: 1,
    contentBlocks: [{
      id: "paragraph",
      type: "PARAGRAPH",
      html: "<strong>HTML</strong>",
      style: { color: "red" },
      className: "arbitrary",
      onclick: "alert(1)",
      content: [{ type: "TEXT", text: "Contenido" }],
    }],
  });
  assert.equal(result.ok, false);
  assert.equal(result.errors.filter((item) => item.code === "UNKNOWN_FIELD").length, 4);
});

test("el contrato de IMAGE usa mediaId y rechaza una URL directa", () => {
  const result = validateStoryDocument({
    schemaVersion: 1,
    contentBlocks: [{
      id: "image",
      type: "IMAGE",
      mediaId: "media-1",
      url: "https://example.com/image.jpg",
    }],
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((item) => item.field.endsWith(".url") && item.code === "UNKNOWN_FIELD"));
});

test("EVENT_REFERENCE conserva únicamente el eventId opaco", () => {
  const accepted = validateStoryDocument({
    schemaVersion: 1,
    contentBlocks: [{ id: "event", type: "EVENT_REFERENCE", eventId: "opaque/event:key" }],
  });
  const rejected = validateStoryDocument({
    schemaVersion: 1,
    contentBlocks: [{
      id: "event",
      type: "EVENT_REFERENCE",
      eventId: "opaque/event:key",
      relationType: "PRIMARY",
      url: "/evento/copied-url",
      title: "Metadata copiada",
      slug: "metadata-copiada",
    }],
  });
  assert.equal(accepted.ok, true);
  assert.equal(rejected.ok, false);
  assert.equal(rejected.errors.filter((item) => item.code === "UNKNOWN_FIELD").length, 4);
});

test("un enlace inseguro no puede llegar a un renderer futuro", () => {
  const result = validateStoryDocument({
    schemaVersion: 1,
    contentBlocks: [{
      id: "paragraph",
      type: "PARAGRAPH",
      content: [{
        type: "LINK",
        href: "javascript:alert(document.cookie)",
        children: [{ type: "TEXT", text: "Abrir" }],
      }],
    }],
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((item) => item.code === "UNSAFE_LINK"));
});
