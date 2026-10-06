import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { StoryContentBlock } from "../../../lib/stories/story-types";
import { validateStoryDocument } from "../../../lib/stories/story-validation";
import StoryRenderer from "./StoryRenderer";

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

test("StoryRenderer comparte los siete bloques sin HTML arbitrario", () => {
  const blocks: StoryContentBlock[] = [
    { id: "p", type: "PARAGRAPH", content: [{ type: "TEXT", text: "Texto <seguro>" }] },
    { id: "h", type: "HEADING", level: 2, text: "Título" },
    { id: "q", type: "PULL_QUOTE", text: "Cita" },
    { id: "i", type: "IMAGE", mediaId: "media-1" },
    { id: "pair", type: "IMAGE_PAIR", mediaIds: ["media-1", "media-2"] },
    { id: "gallery", type: "GALLERY", mediaIds: ["media-1", "media-2"] },
    { id: "event", type: "EVENT_REFERENCE", eventId: "event-1" },
  ];
  const markup = renderToStaticMarkup(
    <StoryRenderer
      blocks={blocks}
      events={{
        "event-1": { id: "event-1", title: "Evento sintético", href: "/evento/sintetico" },
      }}
      media={{
        "media-1": {
          id: "media-1",
          resolvedUrl: "https://example.com/one.jpg",
          width: 1200,
          height: 800,
          altText: "Imagen uno",
        },
        "media-2": {
          id: "media-2",
          resolvedUrl: "https://example.com/two.jpg",
          width: 1200,
          height: 800,
          altText: "Imagen dos",
        },
      }}
    />,
  );
  assert.match(markup, /Texto &lt;seguro&gt;/);
  assert.match(markup, /Evento sintético/);
  assert.match(markup, /https:\/\/example\.com\/one\.jpg/);
  assert.doesNotMatch(markup, /dangerouslySetInnerHTML/);
});

test("la Preview privada bloquea indexación y no añade JSON-LD editorial", () => {
  const previewSource = readFileSync(
    "app/admin/historias/[id]/preview/page.tsx",
    "utf8",
  );
  const adminLayoutSource = readFileSync("app/admin/historias/layout.tsx", "utf8");
  const rootLayoutSource = readFileSync("app/layout.tsx", "utf8");

  assert.match(adminLayoutSource, /requireAdminSession\("\/admin\/historias"\)/);
  assert.match(previewSource, /export const dynamic = "force-dynamic"/);
  assert.match(previewSource, /export const revalidate = 0/);
  assert.match(previewSource, /robots:\s*\{\s*index: false,\s*follow: false,\s*nocache: true\s*\}/);
  assert.doesNotMatch(previewSource, /alternates\s*:|canonical\s*:/);
  assert.doesNotMatch(
    previewSource,
    /application\/ld\+json|NewsArticle|BlogPosting|["']Article["']|["']WebPage["']/,
  );

  const organizationBlock = rootLayoutSource.match(
    /const organizationJsonLd = \{[\s\S]*?\n\};/,
  )?.[0] ?? "";
  assert.match(organizationBlock, /"@type": "Organization"/);
  assert.doesNotMatch(
    organizationBlock,
    /headline|content_blocks|contentBlocks|hero_media_id|heroMediaId|eventId|story\.slug|story\.title|story\.dek/,
  );
});
