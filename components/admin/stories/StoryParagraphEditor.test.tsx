import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { renderToStaticMarkup } from "react-dom/server";
import StoryParagraphEditor from "./StoryParagraphEditor";
import { commercialFixture } from "@/tests/stories/commercial-fixture";
import { parseStoryBlocksJson } from "@/lib/stories/story-admin";
import type { StoryParagraphBlock } from "@/lib/stories/story-types";
const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => { module.exports = { __esModule: true, default: new Proxy({}, { get: (_, name) => name }) }; };
const { default: StoryRenderer } = require("@/components/redesign-v2/stories/StoryRenderer") as typeof import("@/components/redesign-v2/stories/StoryRenderer");

test("actual paragraph control edits neighbouring text, roundtrips approved LINK nodes and renders sponsored only on commercial link", () => {
  let block = commercialFixture().story.content_blocks[0] as StoryParagraphBlock;
  const original = structuredClone(block);
  for (let edit = 0; edit < 5; edit++) {
  const element = StoryParagraphEditor({ block, onChange(next) { block = next; } });
  const controls: Array<{ type: unknown; props: Record<string, unknown> }> = [];
  function visit(value: unknown) {
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (value && typeof value === "object" && "props" in value) {
      const e = value as { type: unknown; props: Record<string, unknown> }; controls.push(e); visit(e.props.children);
    }
  }
  visit(element);
  const textarea = controls.find((c) => c.type === "textarea")!;
  (textarea.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: `Texto editado ${edit} ` } });
  assert.deepEqual(block.content[1], original.content[1]); assert.deepEqual(block.content[3], original.content[3]);
  const form = new FormData(); form.set("contentBlocks", JSON.stringify([block]));
  const document = parseStoryBlocksJson(String(form.get("contentBlocks")))!; assert.ok(document);
  block = document.contentBlocks[0] as StoryParagraphBlock;
  const reopened = StoryParagraphEditor({ block: document.contentBlocks[0] as StoryParagraphBlock, onChange() {} });
  assert.match(renderToStaticMarkup(reopened), /motos trail/);
  const html = renderToStaticMarkup(<StoryRenderer blocks={document.contentBlocks} media={{}} events={{}} />);
  const anchors = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map(([, rawAttributes, content]) => ({
    attributes: Object.fromEntries([...rawAttributes.matchAll(/(?:^|\s)([a-z-]+)="([^"]*)"/g)]
      .map(([, name, value]) => [name, value])),
    content,
  }));
  assert.equal(anchors.length, 2);
  const commercial = anchors.find(({ attributes }) => attributes.href === "https://www.kawasaki.es/es_es/Motorcycles/Adventure.html");
  const internal = anchors.find(({ attributes }) => attributes.href === "https://www.eventomotor.com/disciplinas/rutas");
  assert.ok(commercial); assert.ok(internal);
  assert.match(commercial.content, />motos trail</);
  assert.equal(commercial.attributes.target, "_blank");
  assert.deepEqual(commercial.attributes.rel?.split(/\s+/).sort(), ["noopener", "noreferrer", "sponsored"]);
  assert.match(internal.content, />agenda de rutas moteras</);
  assert.equal(internal.attributes.target, undefined);
  assert.ok(!internal.attributes.rel?.split(/\s+/).includes("sponsored"));
  }
});
