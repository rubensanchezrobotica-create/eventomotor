import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test, { mock } from "node:test";
import React from "react";
import type { HomeStory } from "@/lib/stories/story-home.server";

test("real editorial module hides empty content, renders the approved header projection and scales without placeholders", async () => {
  const require = createRequire(import.meta.url);
  require.extensions[".css"] = (module) => { module.exports = { __esModule: true, default: new Proxy({}, { get: (_, name) => name }) }; };
  const clientReact = require("../../node_modules/react/cjs/react.development.js");
  const runtime = React as unknown as Record<string, unknown>;
  runtime.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = clientReact.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  const { renderToStaticMarkup } = require("../../node_modules/react-dom/server.node.js");
  const moduleMock = (mock as unknown as { module: (path: string, value: { exports: Record<string, unknown> }) => Promise<unknown> }).module.bind(mock);
  const sample: HomeStory = { slug: "synthetic-home-story", title: "Synthetic editorial title", summary: "Approved short summary.",
    hero: { src: "https://example.test/public-hero.webp", alt: "Approved hero", width: 1600, height: 1000 } };
  let stories: HomeStory[] = [];
  await moduleMock("@/lib/stories/story-home.server", { exports: { listHomeStories: async () => stories } });
  await moduleMock("next/link", { exports: { default: ({ prefetch, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { prefetch?: boolean }) => { void prefetch; return React.createElement("a", props); } } });
  await moduleMock("next/image", { exports: { default: ({ unoptimized, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { unoptimized?: boolean }) => { void unoptimized; return React.createElement("img", props); } } });
  const section = await import("../../components/redesign-v2/stories/HomeStoriesSection");
  assert.equal(renderToStaticMarkup(await section.default()), "", "no wrapper, headings or empty gap");
  stories = [sample];
  const html = renderToStaticMarkup(await section.default());
  assert.match(html, /data-home-stories/); assert.match(html, /Historias/); assert.match(html, /Desde dentro/);
  assert.match(html, /href="\/historias"/); assert.match(html, /href="\/historias\/synthetic-home-story"/);
  assert.match(html, /Synthetic editorial title/); assert.match(html, /Approved short summary/);
  assert.equal((html.match(/<article\b/g) ?? []).length, 1); assert.equal((html.match(/<img\b/g) ?? []).length, 1);
  assert.ok(!/\/admin\/|story-media-drafts|token=|Más historias publicadas/.test(html));
  stories = [sample, { ...sample, slug: "synthetic-second", title: "Second published story" }];
  const multiple = renderToStaticMarkup(await section.default());
  assert.match(multiple, /Second published story/); assert.match(multiple, /href="\/historias\/synthetic-second"/);
});

test("Home keeps the agenda first and inserts the server module strictly between zones and unchanged newsletter", () => {
  const home = readFileSync("components/redesign-v2/RedesignV2Home.tsx", "utf8");
  const insertion = home.indexOf("<HomeStoriesSection");
  assert.ok(home.indexOf('id="territories-title"') < insertion);
  assert.ok(insertion < home.indexOf("{newsletterVisible ? <section"));
  assert.match(home, /<Suspense fallback=\{null\}><HomeStoriesSection/);
  assert.ok(!home.includes('navigationId="stories"'));
  const css = readFileSync("components/redesign-v2/stories/HomeStoriesSection.module.css", "utf8");
  assert.match(css, /max-height: 360px/); assert.match(css, /max-width: 760px/);
  assert.ok(!css.includes(":global"), "all styling stays in the editorial CSS module");
});
