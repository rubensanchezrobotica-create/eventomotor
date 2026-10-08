import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { StoryContentBlock } from "../../../lib/stories/story-types";
import { validateStoryDocument } from "../../../lib/stories/story-validation";
// Node does not process CSS Modules. Keep the real React components and replace
// only the stylesheet loader; layout is verified in the actual Next preview.
const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = { __esModule: true, default: new Proxy({}, { get: (_, name) => name }) };
};
const { default: StoryRenderer } = require("./StoryRenderer") as typeof import("./StoryRenderer");
const { default: StoryArticle } = require("./StoryArticle") as typeof import("./StoryArticle");

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

const syntheticMedia = {
  portrait: { id: "portrait", resolvedUrl: "https://example.com/portrait.png", width: 900, height: 1200, altText: "Vertical sintética", caption: "Pie íntegro", credit: "Autora sintética" },
  horizontal: { id: "horizontal", resolvedUrl: "https://example.com/horizontal.png", width: 1200, height: 900, altText: "Horizontal sintética", caption: "Otro pie íntegro" },
};

test("artículo real: etiquetas humanas, firma por ID, un H1 y hero después de la firma", () => {
  const html = renderToStaticMarkup(<StoryArticle
    title="Título editorial sintético" dek="Introducción sintética" type="CRONICA" collection="DESDE_DENTRO"
    contextLocation="Lugar sintético" heroMediaId="horizontal" media={syntheticMedia} events={{}}
    people={{ person: "Autora sintética" }} credits={[
      { personId: "person", role: "TEXT", sortOrder: 0 }, { personId: "person", role: "PHOTO", sortOrder: 1 },
    ]} blocks={[{ id: "body", type: "PARAGRAPH", content: [{ type: "TEXT", text: "Texto íntegro" }] }]} />);
  assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
  assert.match(html, /Desde dentro · Crónica/);
  assert.match(html, /Texto y fotografía:/);
  assert.doesNotMatch(html, /DESDE_DENTRO|CRONICA|\bTEXT\b|\bPHOTO\b/);
  assert.ok(html.indexOf("Título editorial") < html.indexOf("Introducción sintética"));
  assert.ok(html.indexOf("Texto y fotografía") < html.indexOf('data-story-media-id="horizontal"'));
  assert.ok(html.indexOf('data-story-media-id="horizontal"') < html.indexOf("Texto íntegro"));
});

test("pareja mixta: orden exacto, ratios naturales y columnas proporcionales sin crop", () => {
  const html = renderToStaticMarkup(<StoryRenderer blocks={[{ id: "pair", type: "IMAGE_PAIR", mediaIds: ["portrait", "horizontal"] }]} media={syntheticMedia} events={{}} />);
  assert.match(html, /--story-pair-columns:0.75fr 1.3333333333333333fr/);
  assert.ok(html.indexOf("Vertical sintética") < html.indexOf("Horizontal sintética"));
  assert.match(html, /height="1200"[^>]*width="900"/);
  assert.match(html, /Pie íntegro/);
  assert.match(html, /Fotografía: Autora sintética/);
  assert.doesNotMatch(html, /object-fit|crop|rights_notes/);
});

test("metadata ausente o inválida: degradación legible, sin ratios fabricados ni atributos inválidos", () => {
  const html = renderToStaticMarkup(<StoryRenderer blocks={[
    { id: "missing", type: "IMAGE", mediaId: "missing" },
    { id: "unknown", type: "IMAGE_PAIR", mediaIds: ["portrait", "unknown"] },
  ]} media={{ ...syntheticMedia, unknown: { ...syntheticMedia.horizontal, id: "unknown", width: 0, height: Number.NaN } }} events={{}} />);
  assert.match(html, /Imagen no disponible/);
  assert.match(html, /stackedPair/);
  assert.doesNotMatch(html, /NaN|Infinity|width="0"|--story-pair-columns/);
});

test("jerarquía y bloques: lead único, H2/H3 explícitos, cita conservada y fecha humana", () => {
  const blocks: StoryContentBlock[] = [
    { id: "p1", type: "PARAGRAPH", content: [{ type: "TEXT", text: "Frase deliberadamente repetida" }] },
    { id: "h2", type: "HEADING", level: 2, text: "Capítulo" },
    { id: "quote", type: "PULL_QUOTE", text: "Frase deliberadamente repetida", attribution: "Atribución" },
    { id: "h3", type: "HEADING", level: 3, text: "Subcapítulo" },
    { id: "p2", type: "PARAGRAPH", content: [{ type: "TEXT", text: "Texto posterior" }] },
    { id: "event", type: "EVENT_REFERENCE", eventId: "event" },
  ];
  const html = renderToStaticMarkup(<StoryRenderer blocks={blocks} media={{}} events={{ event: { id: "event", title: "Evento sintético", date: "2026-10-08", location: "Lugar", href: "/evento/sintetico" } }} />);
  assert.equal((html.match(/class="paragraph lead"/g) ?? []).length, 1);
  assert.equal((html.match(/Frase deliberadamente repetida/g) ?? []).length, 2);
  assert.match(html, /<h2 class="heading"/);
  assert.match(html, /<h3 class="heading"/);
  assert.match(html, /<blockquote class="quote"/);
  assert.match(html, /8 de octubre de 2026/);
  assert.doesNotMatch(html, /2026-10-08/);
  assert.deepEqual([...html.matchAll(/data-story-block-id="([^"]+)"/g)].map(m => m[1]), blocks.map(b => b.id));
});

test("Preview conserva servicio/auth/no-store y deja herramientas fuera de StoryArticle", () => {
  const source = readFileSync("app/admin/historias/[id]/preview/page.tsx", "utf8");
  assert.ok(source.indexOf("Volver al editor") < source.indexOf("<StoryArticle"));
  assert.match(source, /getStoryForAdmin\(id\)/);
  assert.match(source, /resolveStoryMediaForAdmin\(id, bundle.media\)/);
  assert.doesNotMatch(source, /\.insert\(|\.update\(|publishStory|promote|createSignedUploadUrl/);
  const css = readFileSync("components/redesign-v2/stories/StoryArticle.module.css", "utf8");
  assert.match(css, /--story-image-cap: min\(64svh, 600px\)/);
  assert.match(css, /--story-pair-cap: min\(60svh, 520px\)/);
  assert.match(css, /grid-template-columns: minmax\(0, 1fr\)/);
  assert.doesNotMatch(css, /overflow[^;]*hidden|object-fit:\s*cover/);
});
