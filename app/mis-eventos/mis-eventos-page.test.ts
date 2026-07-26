import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { metadata } from "@/app/mis-eventos/page";
import { SITE_URL } from "@/lib/seo";

test("mis eventos conserva canonical y noindex por ser una agenda local", () => {
  assert.equal(metadata.alternates?.canonical, `${SITE_URL}/mis-eventos`);
  assert.ok(metadata.robots && typeof metadata.robots === "object");
  assert.equal(metadata.robots?.index, false);
  assert.equal(metadata.robots?.follow, true);
});

test("mis eventos sigue fuera del sitemap y no publica datos personales", () => {
  const workspace = process.cwd();
  const sitemap = readFileSync(join(workspace, "app/sitemap.ts"), "utf8");
  const page = readFileSync(join(workspace, "app/mis-eventos/page.tsx"), "utf8");

  assert.doesNotMatch(sitemap, /sitemapEntry\("\/mis-eventos"/);
  assert.doesNotMatch(page, /application\/ld\+json|generateMetadata|SavedEvent/);
});
