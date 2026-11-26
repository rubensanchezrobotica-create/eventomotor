import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

import {
  NEWSLETTER_EDITION_17_CAMPAIGN_KEY,
  NEWSLETTER_EDITION_17_PREHEADER,
  NEWSLETTER_EDITION_17_SUBJECT,
} from "./edition-17-editorial";
import {
  assertEdition17SealReady,
  canonicalizeEdition17Text,
  NEWSLETTER_EDITION_17_ASSET_MANIFEST,
  newsletterEdition17ContentManifestDigest,
  prepareEdition17Content,
  validateEdition17SourceIntegrity,
  type NewsletterEdition17Source,
} from "./edition-17-content";
import {
  NEWSLETTER_EDITION_17_CANONICAL_UNSUBSCRIBE_URL,
  renderEdition17Draft,
  renderEdition17Sendable,
} from "./edition-17-render";

const assetRoot = "https://www.eventomotor.com/newsletter/2026-11-26/assets/";
const sampleUnsubscribe = "https://www.eventomotor.com/newsletter/unsubscribe?token=edition17-operational-candidate-token-000000000000";
const expected = {
  national: {
    html: "65c8ee462b00959bdebdb63d19ef3fa15e4d2ee0285d89ff982e8b581dee8791",
    text: "0e02e8c03906bdbd44e3294f650f10f7d4c17230b615f0ea6d797bcee77196dd",
  },
  madrid: {
    html: "fc3ce05c1163dd043c329d979b5048fd4eb5db9fdcd8cb3a45decb99c4842bea",
    text: "fb4874ceac840cd744263c0de37f637e6e67c0192897dfb49ad6ff3fb93eb78e",
  },
} as const;

function digest(value: string): string {
  return createHash("sha256").update(canonicalizeEdition17Text(value)).digest("hex");
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function candidateIdentity() {
  const root = resolve("docs/newsletter/ediciones/2026-11-26");
  const assets = JSON.parse(readFileSync(resolve(root, "asset-manifest.json"), "utf8")) as typeof NEWSLETTER_EDITION_17_ASSET_MANIFEST;
  assert.deepEqual(assets, NEWSLETTER_EDITION_17_ASSET_MANIFEST);
  assert.deepEqual(readdirSync(resolve(root, "assets")).sort(), assets.map(({ file }) => file).sort());
  for (const entry of assets) {
    const bytes = readFileSync(resolve(root, "assets", entry.file));
    assert.equal(bytes.byteLength, entry.bytes, entry.file);
    assert.equal(sha256(bytes), entry.sha256, entry.file);
  }
  const renders = {
    national: {
      html: digest(renderEdition17Sendable("national", NEWSLETTER_EDITION_17_CANONICAL_UNSUBSCRIBE_URL).html),
      text: digest(renderEdition17Sendable("national", NEWSLETTER_EDITION_17_CANONICAL_UNSUBSCRIBE_URL).text),
    },
    madrid: {
      html: digest(renderEdition17Sendable("madrid", NEWSLETTER_EDITION_17_CANONICAL_UNSUBSCRIBE_URL).html),
      text: digest(renderEdition17Sendable("madrid", NEWSLETTER_EDITION_17_CANONICAL_UNSUBSCRIBE_URL).text),
    },
  };
  return {
    editionKey: NEWSLETTER_EDITION_17_CAMPAIGN_KEY,
    subject: NEWSLETTER_EDITION_17_SUBJECT,
    preheader: NEWSLETTER_EDITION_17_PREHEADER,
    variantMap: {
      national: null,
      "comunidad-de-madrid": "madrid",
      cataluna: null,
      aragon: null,
      galicia: null,
      "sin-region": null,
      unknown: null,
    },
    assets,
    renders,
  };
}

function localSource(): NewsletterEdition17Source {
  const root = resolve("docs/newsletter/ediciones/2026-11-26");
  return {
    assetManifest: readFileSync(resolve(root, "asset-manifest.json"), "utf8"),
    assets: Object.fromEntries(NEWSLETTER_EDITION_17_ASSET_MANIFEST.map(({ file }) => [
      file,
      readFileSync(resolve(root, "assets", file)),
    ])),
  };
}

test("Ed17 sendable projection keeps approved copy and uses only public assets", () => {
  for (const variant of ["national", "madrid"] as const) {
    const local = renderEdition17Draft(variant);
    const publicDraft = renderEdition17Draft(variant, "public-url");
    const sendable = renderEdition17Sendable(variant, sampleUnsubscribe);
    assert.equal(local.text, publicDraft.text);
    assert.equal(sendable.text, local.text.replace(NEWSLETTER_EDITION_17_CANONICAL_UNSUBSCRIBE_URL, sampleUnsubscribe));
    assert.ok(!sendable.html.includes("PREVIEW LOCAL"));
    assert.ok(!sendable.html.includes("SELLO PENDIENTE"));
    assert.ok(!sendable.html.includes(NEWSLETTER_EDITION_17_CANONICAL_UNSUBSCRIBE_URL));
    assert.ok(!sendable.html.includes('src="assets/'));
    assert.ok(sendable.html.includes(sampleUnsubscribe));
    const images = [...sendable.html.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)].map((match) => match[1]);
    assert.equal(images.length, variant === "madrid" ? 7 : 6);
    assert.ok(images.every((url) => url?.startsWith(assetRoot)));
    assert.equal((sendable.html.match(/Lo próximo cerca de ti/g) ?? []).length, variant === "madrid" ? 1 : 0);
    assert.equal((sendable.text.match(/LO PRÓXIMO CERCA DE TI/g) ?? []).length, variant === "madrid" ? 1 : 0);
    assert.equal(digest(renderEdition17Sendable(variant, NEWSLETTER_EDITION_17_CANONICAL_UNSUBSCRIBE_URL).html), expected[variant].html);
    assert.equal(digest(renderEdition17Sendable(variant, NEWSLETTER_EDITION_17_CANONICAL_UNSUBSCRIBE_URL).text), expected[variant].text);
  }
});

test("Ed17 canonical asset list and candidate content digest are deterministic", () => {
  const identity = candidateIdentity();
  assert.equal(identity.assets.length, 8);
  assert.deepEqual(identity.renders, expected);
  const candidateDigest = sha256(JSON.stringify(identity));
  assert.equal(candidateDigest, "a13009463408077bd45602a28839b6b479db449daf6b6b6ca610eec7fbcaac38");
  assert.equal(candidateDigest.length, 64);
  assert.equal(sha256(JSON.stringify(identity.assets)), "d7d90e27b4fa94edcd373bad25ec81b7e02eca5aee8161321e4f4a4ed1ec3094");
  assert.equal(newsletterEdition17ContentManifestDigest(), candidateDigest);
  for (const index of identity.assets.keys()) {
    const changedAsset = {
      ...identity,
      assets: identity.assets.map((entry, position) => position === index ? { ...entry, sha256: "0".repeat(64) } : entry),
    };
    assert.notEqual(sha256(JSON.stringify(changedAsset)), candidateDigest);
  }
  for (const variant of ["national", "madrid"] as const) {
    for (const format of ["html", "text"] as const) {
      const changedRender = structuredClone(identity);
      changedRender.renders[variant][format] = "0".repeat(64);
      assert.notEqual(sha256(JSON.stringify(changedRender)), candidateDigest);
    }
  }
  assert.notEqual(sha256(JSON.stringify({ ...identity, subject: "Altered subject" })), candidateDigest);
  assert.notEqual(sha256(JSON.stringify({ ...identity, editionKey: "agenda_motor_2026_11_19" })), candidateDigest);
  const actualBytes = readFileSync(resolve("docs/newsletter/ediciones/2026-11-26/assets", identity.assets[0]!.file));
  const tamperedBytes = Buffer.from(actualBytes);
  tamperedBytes[0] = tamperedBytes[0]! ^ 1;
  assert.notEqual(sha256(tamperedBytes), identity.assets[0]!.sha256);
});

test("Ed17 local seal validates exact source bytes and personalized content", () => {
  assert.doesNotThrow(() => assertEdition17SealReady());
  const source = localSource();
  assert.doesNotThrow(() => validateEdition17SourceIntegrity(source));
  for (const variant of ["national", "madrid"] as const) {
    const rendered = prepareEdition17Content(source, variant, sampleUnsubscribe);
    assert.equal(rendered.variant, variant);
    assert.ok(rendered.html.includes(sampleUnsubscribe));
    assert.ok(!rendered.html.includes(NEWSLETTER_EDITION_17_CANONICAL_UNSUBSCRIBE_URL));
    assert.ok(!rendered.text.includes(NEWSLETTER_EDITION_17_CANONICAL_UNSUBSCRIBE_URL));
  }
  assert.throws(() => prepareEdition17Content(source, "national", "https://example.com/unsubscribe?token=wrong"), /unsubscribe_url_invalid/);
  const changedManifest = { ...source, assetManifest: source.assetManifest.replace("858646254061", "000000000000") };
  assert.throws(() => validateEdition17SourceIntegrity(changedManifest), /asset_manifest_mismatch/);
  const firstFile = NEWSLETTER_EDITION_17_ASSET_MANIFEST[0]!.file;
  const changedBytes = Buffer.from(source.assets[firstFile]!);
  changedBytes[0] = changedBytes[0]! ^ 1;
  assert.throws(() => validateEdition17SourceIntegrity({
    ...source,
    assets: { ...source.assets, [firstFile]: changedBytes },
  }), /asset_digest_mismatch/);
  const missingAsset = { ...source.assets };
  delete missingAsset[firstFile];
  assert.throws(() => validateEdition17SourceIntegrity({ ...source, assets: missingAsset }), /asset_set_mismatch/);
});
