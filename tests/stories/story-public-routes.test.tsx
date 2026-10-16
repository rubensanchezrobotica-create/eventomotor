import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test, { mock } from "node:test";
import React from "react";
import type { PublicStory } from "@/lib/stories/story-public.server";

test("actual public route renders the shared article, single-story index and empty/404 privacy states", async () => {
  const require = createRequire(import.meta.url);
  require.extensions[".css"] = (module) => { module.exports = { __esModule: true, default: new Proxy({}, { get: (_, name) => name }) }; };
  const clientReact = require("../../node_modules/react/cjs/react.development.js");
  const runtime = React as unknown as Record<string, unknown>;
  runtime.createContext = clientReact.createContext;
  runtime.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = clientReact.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  const { renderToStaticMarkup } = require("../../node_modules/react-dom/server.node.js");
  const moduleMock = (mock as unknown as { module: (path: string, value: { exports: Record<string, unknown> }) => Promise<unknown> }).module.bind(mock);
  const mediaId = "synthetic-media", personId = "synthetic-person";
  const sample: PublicStory = { slug: "synthetic-public-story", title: "Synthetic public story", dek: "Approved header dek", type: "CRONICA", collection: "DESDE_DENTRO",
    contextLocation: "Synthetic place", heroMediaId: mediaId,
    blocks: [{ id: "p1", type: "PARAGRAPH", content: [{ type: "TEXT", text: "Approved opening body" }] }, { id: "p2", type: "PARAGRAPH", content: [{ type: "TEXT", text: "Approved next body" }] },
      { id: "quote", type: "PULL_QUOTE", text: "Approved quote" }, { id: "photo", type: "IMAGE", mediaId }, { id: "event", type: "EVENT_REFERENCE", eventId: "event-1" }],
    media: { [mediaId]: { id: mediaId, resolvedUrl: "https://example.test/public-photo.webp", width: 1200, height: 800, altText: "Public alt", caption: "Approved caption", credit: "Synthetic author" } },
    events: { "event-1": { id: "event-1", title: "Synthetic event", href: "/evento/synthetic-event" } },
    credits: [{ personId, role: "TEXT", sortOrder: 0 }, { personId, role: "PHOTO", sortOrder: 1 }], people: { [personId]: "Synthetic author" },
    seoTitle: "CMS SEO", seoDescription: "CMS description", publishedAt: "2030-01-02T12:00:00Z", updatedAt: "2030-01-02T12:00:00Z" };
  let current: PublicStory | null = sample;
  await moduleMock("@/lib/stories/story-public.server", { exports: {
    getPublicStory: async () => current, listPublicStories: async () => current ? [current] : [],
  } });
  await moduleMock("@/components/redesign-v2/redesign-v2-fonts", { exports: { redesignV2DisplayPilot: { variable: "approved-font" } } });
  // Framework adapter only; route/Article/Renderer remain the actual components.
  await moduleMock("next/link", { exports: { default: (props: { href: string; children: React.ReactNode }) => React.createElement("a", { href: props.href }, props.children) } });
  await moduleMock("@/components/redesign-v2/site/V2InteriorShell", { exports: { default: (props: { children: React.ReactNode }) => React.createElement("main", null, props.children) } });
  const article = await import("../../app/historias/[slug]/page");
  const index = await import("../../app/historias/page");
  const html = renderToStaticMarkup(await article.default({ params: Promise.resolve({ slug: sample.slug }) }));
  assert.match(html, /data-story-article/); assert.match(html, /data-story-body/);
  assert.equal((html.match(/data-story-block-id=/g) ?? []).length, 5);
  for (const approved of [sample.dek, "Approved opening body", "Approved next body", "Approved quote", "Approved caption", "Synthetic author"]) assert.ok(html.includes(approved));
  assert.match(html, /Texto y fotografía/); assert.match(html, /href="\/evento\/synthetic-event"/);
  assert.ok(!/story-media-drafts|rights_notes|\/admin\/|object_path|token=/.test(html));
  assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
  const list = renderToStaticMarkup(await index.default());
  assert.equal((list.match(/<article\b/g) ?? []).length, 1);
  assert.match(list, /href="\/historias\/synthetic-public-story"/);
  sample.media[mediaId].publicImage = { src: "https://example.test/responsive-w1200.webp", srcSet: "https://example.test/responsive-w400.webp 400w, https://example.test/responsive-w1200.webp 1200w" };
  const responsiveList = renderToStaticMarkup(await index.default());
  const responsiveArticle = renderToStaticMarkup(await article.default({ params: Promise.resolve({ slug: sample.slug }) }));
  for (const markup of [responsiveList, responsiveArticle]) {
    assert.match(markup, /srcSet="https:\/\/example.test\/responsive-w400.webp 400w,/);
    assert.ok(!markup.includes('src="https://example.test/public-photo.webp"'));
    assert.ok(!markup.includes("/_next/image"));
  }
  assert.match(responsiveArticle, /fetchPriority="high"/);
  assert.match(responsiveArticle, /loading="lazy"/);
  const metadata = await article.generateMetadata({ params: Promise.resolve({ slug: sample.slug }) });
  assert.deepEqual(metadata.title, { absolute: "CMS SEO" });
  current = null;
  await assert.rejects(article.default({ params: Promise.resolve({ slug: sample.slug }) }), /NEXT_HTTP_ERROR_FALLBACK;404/);
  await assert.rejects(article.generateMetadata({ params: Promise.resolve({ slug: sample.slug }) }), /NEXT_HTTP_ERROR_FALLBACK;404/);
  assert.ok(!renderToStaticMarkup(await index.default()).includes("Synthetic public story"));
  const { default: RelatedStories } = require("../../components/redesign-v2/stories/RelatedStories");
  assert.equal(renderToStaticMarkup(React.createElement(RelatedStories, { stories: [], eventTitle: "Synthetic event" })), "");
  const related = renderToStaticMarkup(React.createElement(RelatedStories, { stories: [sample], eventTitle: "Synthetic event" }));
  assert.match(related, /Desde dentro · EventoMotor/); assert.match(related, /href="\/historias\/synthetic-public-story"/);
});

test("public integration preserves Article CSS and private noindex guards, without Home/menu additions", () => {
  const read = (path: string) => readFileSync(path, "utf8");
  const article = read("app/historias/[slug]/page.tsx"), index = read("app/historias/page.tsx");
  assert.match(article, /import StoryArticle/); assert.match(article, /<StoryArticle/); assert.match(article, /hideHero/);
  assert.match(article, /force-dynamic/); assert.match(index, /force-dynamic/);
  assert.match(read("app/admin/historias/[id]/preview/page.tsx"), /index: false, follow: false/);
  assert.match(read("app/admin/historias/layout.tsx"), /requireAdminSession/);
  assert.match(read("app/sitemap.ts"), /buildStoriesSitemap\(stories\)/);
});
