import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test, { mock } from "node:test";
import React from "react";
import type { HomeSponsoredStory, HomeStory } from "@/lib/stories/story-home.server";

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
  let sponsoredStory: HomeSponsoredStory | null = null;
  await moduleMock("@/lib/stories/story-home.server", { exports: {
    listHomeStories: async () => stories,
    getLatestHomeSponsoredStory: async () => sponsoredStory,
  } });
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
  sample.hero.publicImage = { src: "https://example.test/responsive-w1200.webp", srcSet: "https://example.test/responsive-w400.webp 400w, https://example.test/responsive-w1200.webp 1200w" };
  const responsive = renderToStaticMarkup(await section.default());
  assert.match(responsive, /srcSet="https:\/\/example.test\/responsive-w400.webp 400w,/);
  assert.match(responsive, /loading="lazy"/);
  assert.ok(!responsive.includes('src="https://example.test/public-hero.webp"'));
  assert.ok(!responsive.includes("/_next/image"));
  stories = [sample, { ...sample, slug: "synthetic-second", title: "Second published story" }];
  const multiple = renderToStaticMarkup(await section.default());
  assert.match(multiple, /Second published story/); assert.match(multiple, /href="\/historias\/synthetic-second"/);

  const sponsoredSection = await import("../../components/redesign-v2/stories/HomeSponsoredStorySection");
  assert.equal(renderToStaticMarkup(await sponsoredSection.default()), "", "no empty sponsored wrapper or spacing");
  sponsoredStory = { ...sample, slug: "synthetic-sponsored-story", title: "Synthetic sponsored title",
    summary: "Approved sponsored introduction.", label: "Contenido patrocinado" };
  const sponsoredHtml = renderToStaticMarkup(await sponsoredSection.default());
  assert.match(sponsoredHtml, /data-home-sponsored-story/);
  assert.match(sponsoredHtml, /Contenido patrocinado/);
  assert.match(sponsoredHtml, /Synthetic sponsored title/);
  assert.match(sponsoredHtml, /Approved sponsored introduction/);
  assert.match(sponsoredHtml, /href="\/historias\/synthetic-sponsored-story"/);
  assert.equal((sponsoredHtml.match(/<article\b/g) ?? []).length, 1);
  assert.equal((sponsoredHtml.match(/<img\b/g) ?? []).length, 1);
  assert.ok(!/\/admin\/|story-media-drafts|token=|Synthetic advertiser/.test(sponsoredHtml));
});

test("Home keeps editorial and sponsored Stories independent, ordered between zones and the unchanged newsletter", () => {
  const home = readFileSync("components/redesign-v2/RedesignV2Home.tsx", "utf8");
  const editorialInsertion = home.indexOf("<HomeStoriesSection");
  const sponsoredInsertion = home.indexOf("<HomeSponsoredStorySection");
  assert.ok(home.indexOf('id="territories-title"') < editorialInsertion);
  assert.ok(editorialInsertion < sponsoredInsertion);
  assert.ok(sponsoredInsertion < home.indexOf("{newsletterVisible ? <section"));
  assert.match(home, /<Suspense fallback=\{null\}><HomeStoriesSection/);
  assert.match(home, /<Suspense fallback=\{null\}><HomeSponsoredStorySection/);
  assert.ok(!home.includes('navigationId="stories"'));
  const css = readFileSync("components/redesign-v2/stories/HomeStoriesSection.module.css", "utf8");
  assert.match(css, /max-height: 360px/); assert.match(css, /max-width: 760px/);
  assert.ok(!css.includes(":global"), "all styling stays in the editorial CSS module");
  const sponsoredCss = readFileSync("components/redesign-v2/stories/HomeSponsoredStorySection.module.css", "utf8");
  assert.match(sponsoredCss, /grid-template-columns: minmax\(0, \.92fr\) minmax\(0, 1\.08fr\)/);
  assert.match(sponsoredCss, /@media \(max-width: 760px\)/);
  assert.ok(!sponsoredCss.includes(":global"));
});
