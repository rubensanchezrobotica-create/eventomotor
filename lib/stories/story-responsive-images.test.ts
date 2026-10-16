import assert from "node:assert/strict";
import test from "node:test";
import { resolveStoryPublicImage } from "./story-responsive-images.server";
import { publicStoryImageProps, storyArticleImageSizes } from "./story-responsive-images";
import registry from "./story-responsive-registry.json";

test("every shipped verified entry resolves its complete ordered candidate set", () => {
  const sources = new Set<string>();
  for (const entry of registry.images) {
    assert.ok(!sources.has(entry.source)); sources.add(entry.source);
    const result = resolveStoryPublicImage({ src: entry.source, width: entry.width, height: entry.height, bytes: entry.bytes });
    assert.equal(result?.srcSet?.split(", ").length, entry.variants.length);
    assert.ok(!JSON.stringify(result).includes("sha256"), "integrity evidence stays server-side");
  }
});

// Entirely synthetic: no editorial text, credentials or private media locators.
const src = "https://abcdefghijklmnopqrst.supabase.co/storage/v1/object/public/story-media/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222/asset.png";
const source = { src, width: 1200, height: 900, bytes: 2000 };
const fixture = () => ({ version: 1, profile: "responsive-v1-q90", verificationManifestSha256: "a".repeat(64), images: [{
  source: src, width: 1200, height: 900, bytes: 2000, sha256: "b".repeat(64), variants: [
    { width: 400, height: 300, bytes: 100, sha256: "c".repeat(64) },
    { width: 1200, height: 900, bytes: 200, sha256: "d".repeat(64) },
  ],
}] });

test("verified variants generate direct stable CDN srcset, without PNG or a Next optimizer", () => {
  const result = resolveStoryPublicImage(source, fixture())!;
  assert.equal(result.src, src.replace("asset.png", "responsive-v1-q90-w1200.webp"));
  assert.equal(result.srcSet, `${src.replace("asset.png", "responsive-v1-q90-w400.webp")} 400w, ${result.src} 1200w`);
  assert.ok(!result.srcSet.includes("/_next/image"));
  assert.deepEqual(publicStoryImageProps(result, "600px", true), { ...result, sizes: "600px", loading: "eager", fetchPriority: "high", decoding: "async" });
  assert.equal(publicStoryImageProps(result, "600px").loading, "lazy");
});

test("future unregistered media and stale dimensions/bytes use the approved public original", () => {
  assert.deepEqual(resolveStoryPublicImage(source, { ...fixture(), images: [] }), { src });
  assert.deepEqual(resolveStoryPublicImage({ ...source, width: 1100 }, fixture()), { src });
  assert.deepEqual(resolveStoryPublicImage({ ...source, bytes: 2001 }, fixture()), { src });
  const props = publicStoryImageProps({ src }, "600px");
  assert.equal(props.src, src); assert.equal(props.srcSet, undefined); assert.equal(props.sizes, undefined);
});

test("invalid, duplicated, incomplete or distorted registry entries cannot invent candidates", () => {
  for (const corrupt of [
    (r: ReturnType<typeof fixture>) => { r.profile = "unknown"; },
    (r: ReturnType<typeof fixture>) => { r.images.push(r.images[0]); },
    (r: ReturnType<typeof fixture>) => { r.images[0].variants.pop(); },
    (r: ReturnType<typeof fixture>) => { r.images[0].variants[0].height = 399; },
    (r: ReturnType<typeof fixture>) => { r.images[0].variants[0].sha256 = "invalid"; },
    (r: ReturnType<typeof fixture>) => { r.images[0].variants.reverse(); },
  ]) { const value = fixture(); corrupt(value); assert.deepEqual(resolveStoryPublicImage(source, value), { src }); }
});

test("private/signed/foreign/query URLs never opt into public delivery; admin attributes remain unchanged", () => {
  for (const url of [src.replace("/object/public/", "/object/sign/") + "?token=synthetic", src.replace("story-media/", "story-media-drafts/"),
    src + "?download=1", src + "#fragment", src.replace("https:", "http:"), src.replace(".supabase.co", ".example.test"),
    src.replace("https://", "https://user:password@")]) assert.equal(resolveStoryPublicImage({ ...source, src: url }, fixture()), undefined);
  assert.deepEqual(publicStoryImageProps(undefined, "600px", true), {});
});

test("sizes retain the approved mobile width and desktop hero/portrait/pair caps", () => {
  assert.match(storyArticleImageSizes("hero", 4 / 3), /614px$/);
  assert.match(storyArticleImageSizes("single", .75), /450px$/);
  assert.match(storyArticleImageSizes("pair", .75), /390px$/);
  assert.match(storyArticleImageSizes("single", 4 / 3), /800px$/);
});
