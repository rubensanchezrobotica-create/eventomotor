import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

import {
  NEWSLETTER_EDITION_17_CAMPAIGN_KEY,
  NEWSLETTER_EDITION_17_EVENTS,
  NEWSLETTER_EDITION_17_PLANNED_IMAGES,
  NEWSLETTER_EDITION_17_PREHEADER,
  NEWSLETTER_EDITION_17_SUBJECT,
  edition17TrackedUrl,
} from "./edition-17-editorial";
import { renderEdition17Draft } from "./edition-17-render";
import {
  NEWSLETTER_EDITION_17_TERRITORIAL_MODULES,
  newsletterEdition17ContentVariantForRegion,
} from "./edition-17-territorial";

const national = renderEdition17Draft("national");
const madrid = renderEdition17Draft("madrid");

test("Ed17 identity and selected events remain draft-only", () => {
  assert.equal(NEWSLETTER_EDITION_17_CAMPAIGN_KEY, "agenda_motor_2026_11_26");
  assert.equal(NEWSLETTER_EDITION_17_EVENTS.length, 5);
  assert.equal(NEWSLETTER_EDITION_17_PLANNED_IMAGES.length, 6);
  assert.equal(new Set(NEWSLETTER_EDITION_17_PLANNED_IMAGES.map(({ file }) => file)).size, 6);
  assert.equal(NEWSLETTER_EDITION_17_PLANNED_IMAGES[0]?.width, 1200);
  assert.equal(NEWSLETTER_EDITION_17_PLANNED_IMAGES[0]?.height, 675);
  assert.ok(NEWSLETTER_EDITION_17_PLANNED_IMAGES.slice(1).every(({ width, height }) => width === 800 && height === 500));
});

test("Madrid alone selects its single territorial module", () => {
  assert.equal(newsletterEdition17ContentVariantForRegion("comunidad-de-madrid"), "madrid");
  for (const value of [null, undefined, "", "galicia", "cataluna", "andalucia", "unknown"]) {
    assert.equal(newsletterEdition17ContentVariantForRegion(value), "national");
  }
  assert.equal(Object.keys(NEWSLETTER_EDITION_17_TERRITORIAL_MODULES).length, 1);
  assert.equal((national.html.match(/Lo próximo cerca de ti/g) ?? []).length, 0);
  assert.equal((madrid.html.match(/Lo próximo cerca de ti/g) ?? []).length, 1);
  assert.equal((madrid.html.match(/X-Trial: equilibrio imposible en Madrid Arena/g) ?? []).length, 1);
  assert.equal((national.text.match(/X-Trial: equilibrio imposible en Madrid Arena/g) ?? []).length, 0);
  assert.equal((madrid.text.match(/LO PRÓXIMO CERCA DE TI/g) ?? []).length, 1);
});

test("subject, preheader, copy and dates are edition-specific", () => {
  for (const output of [national, madrid]) {
    assert.ok(output.html.includes(NEWSLETTER_EDITION_17_SUBJECT));
    assert.ok(output.html.includes(NEWSLETTER_EDITION_17_PREHEADER));
    assert.ok(output.text.includes("EDICIÓN 17\n26 NOVIEMBRE 2026"));
    assert.ok(output.html.includes("Las entradas generales están agotadas"));
    assert.ok(output.html.includes("viernes y sábado de 11:00 a 20:00"));
    assert.ok(output.html.includes("domingo de 11:00 a 15:00"));
    assert.ok(output.html.includes("5–6 diciembre"));
    assert.ok(!/edition-16|EDICIÓN 16|2026-11-19|Ferrari Finali Mondiali/.test(output.html + output.text));
    assert.ok(!output.html.includes("Comprar entradas"));
  }
});

test("approved local images replace every planned slot without enabling production assets", () => {
  for (const output of [national, madrid]) {
    const images = [...output.html.matchAll(/<img src="assets\/([^"]+)"/g)].map((match) => match[1]);
    assert.equal(images[0], "eventomotor-header.png");
    assert.deepEqual(images.slice(1), NEWSLETTER_EDITION_17_PLANNED_IMAGES.slice(0, 5).map(({ file }) => file).concat(
      output === madrid ? ["06-x-trial-madrid.webp"] : [],
    ));
    assert.ok(!/IMAGEN EDITORIAL PENDIENTE|HEADER DEFINITIVO PENDIENTE|data-planned-asset/.test(output.html));
    assert.ok(output.html.includes("SELLO PENDIENTE · NO ENVIAR"));
    assert.ok(output.html.includes("no es una fotografía documental"));
  }
});

test("all CTA links have edition-specific UTM and exact EventoMotor destinations", () => {
  const events = [...NEWSLETTER_EDITION_17_EVENTS, NEWSLETTER_EDITION_17_TERRITORIAL_MODULES["comunidad-de-madrid"]];
  for (const event of events) {
    const url = new URL(edition17TrackedUrl(event.url, event.utmContent));
    assert.equal(url.origin, "https://www.eventomotor.com");
    assert.equal(url.searchParams.get("utm_source"), "la_agenda_motor");
    assert.equal(url.searchParams.get("utm_medium"), "email");
    assert.equal(url.searchParams.get("utm_campaign"), NEWSLETTER_EDITION_17_CAMPAIGN_KEY);
    assert.equal(url.searchParams.get("utm_content"), event.utmContent);
  }
});

test("legal footer and mobile shell remain present, while drafts cannot be sent", () => {
  for (const output of [national, madrid]) {
    assert.ok(output.html.includes("max-width:700px"));
    assert.ok(output.html.includes("stack-column"));
    assert.ok(output.html.includes("/privacidad"));
    assert.ok(output.html.includes("/aviso-legal"));
    assert.ok(output.html.includes("/newsletter/unsubscribe?token=edition17-preview-token-fixture-000000000000"));
    assert.ok(output.text.includes("Darme de baja:"));
    assert.ok(!output.html.includes("NEWSLETTER_RESEND_API_KEY"));
  }
  assert.throws(() => renderEdition17Draft("unknown" as "national"), /inactive content variant/);
  assert.throws(() => renderEdition17Draft("national", "planned-url" as "review-local"), /production asset mode unavailable|inactive asset mode/);
});

test("local HTML and text candidate hashes reproduce from the Ed17 render", () => {
  const root = resolve("docs/newsletter/ediciones/2026-11-26");
  const hashes = JSON.parse(readFileSync(resolve(root, "render-hashes-candidate.json"), "utf8"));
  const digest = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
  for (const [variant, output] of [["national", national], ["madrid", madrid]] as const) {
    for (const format of ["html", "text"] as const) {
      const filename = `preview-${variant}-draft.${format === "text" ? "txt" : "html"}`;
      const rendered = output[format];
      assert.equal(readFileSync(resolve(root, filename), "utf8").replaceAll("\r\n", "\n"), rendered, filename);
      assert.equal(digest(rendered), hashes[`${format}_${variant}_sha256`], filename);
    }
  }
  const assetManifest = JSON.parse(readFileSync(resolve(root, "asset-manifest.json"), "utf8"));
  assert.equal(digest(JSON.stringify(assetManifest)), hashes.asset_manifest_digest_candidate);
});
