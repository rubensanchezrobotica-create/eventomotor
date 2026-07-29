import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { isNewsletterPreviewAvailable } from "../../components/newsletter/newsletter-preview-model";
import { NEWSLETTER_EMAIL_LOGO_URL } from "../../emails/newsletter/email-brand";
import { renderNewsletterEmail } from "../../emails/newsletter/email-renderer";
import {
  NEWSLETTER_R4B_ARMED_VALUE,
  NEWSLETTER_R4B_CONTROLLED_STATUS,
} from "../../lib/newsletter/r4b-guard";

const LOCAL_ORIGIN = "http://localhost:3000";

function logoTag(html: string): string {
  const tags = html.match(/<img\b[^>]*>/gi) ?? [];
  const logo = tags.find((tag) => /alt="EventoMotor"/i.test(tag));
  assert.ok(logo, "El email debe incluir el logo de EventoMotor.");
  return logo;
}

function attribute(tag: string, name: string): string {
  const match = tag.match(new RegExp(`\\b${name}="([^"]+)"`, "i"));
  assert.ok(match?.[1], `Falta el atributo ${name} del logo.`);
  return match[1];
}

test("confirmación, bienvenida y agenda comparten el PNG canónico HTTPS", async () => {
  const originalFetch = globalThis.fetch;
  let networkAttempts = 0;
  globalThis.fetch = async () => {
    networkAttempts += 1;
    throw new Error("Network is forbidden in branding tests.");
  };
  try {
    const htmlByKind = await Promise.all(
      (["confirmation", "welcome", "weekly"] as const).map(renderNewsletterEmail),
    );
    const logoUrls = htmlByKind.map((html) => {
      const tag = logoTag(html);
      assert.equal(attribute(tag, "alt"), "EventoMotor");
      assert.equal(attribute(tag, "width"), "203");
      assert.equal(attribute(tag, "height"), "36");
      return attribute(tag, "src");
    });

    assert.deepEqual(logoUrls, [
      NEWSLETTER_EMAIL_LOGO_URL,
      NEWSLETTER_EMAIL_LOGO_URL,
      NEWSLETTER_EMAIL_LOGO_URL,
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(networkAttempts, 0);
});

test("la URL de marca es pública, raster y no contiene datos dinámicos", () => {
  const logo = new URL(NEWSLETTER_EMAIL_LOGO_URL);
  assert.equal(logo.protocol, "https:");
  assert.equal(logo.origin, "https://www.eventomotor.com");
  assert.equal(
    logo.pathname,
    "/brand/eventomotor-logo-horizontal-dark-header.png",
  );
  assert.equal(logo.search, "");
  assert.equal(logo.hash, "");
  assert.doesNotMatch(NEWSLETTER_EMAIL_LOGO_URL, /localhost|127\.0\.0\.1|\.svg(?:$|[?#])/i);
  assert.ok(!NEWSLETTER_EMAIL_LOGO_URL.startsWith("/"));
});

test("el aviso controlado sólo es alcanzable detrás del guard R4B local", () => {
  const r4b = {
    armed: NEWSLETTER_R4B_ARMED_VALUE,
    localOrigin: LOCAL_ORIGIN,
    requestUrl: `${LOCAL_ORIGIN}/preview/newsletter`,
    requestOrigin: LOCAL_ORIGIN,
    requestHost: "localhost:3000",
  };
  assert.equal(
    isNewsletterPreviewAvailable("test", undefined, "development", r4b),
    true,
  );
  assert.equal(
    isNewsletterPreviewAvailable("test", undefined, "development", {
      ...r4b,
      armed: undefined,
    }),
    false,
  );
  assert.equal(
    isNewsletterPreviewAvailable("preview", undefined, "development", r4b),
    false,
  );

  const preview = readFileSync(
    join(process.cwd(), "components/newsletter/NewsletterPreviewPage.tsx"),
    "utf8",
  );
  const tokenAction = readFileSync(
    join(process.cwd(), "components/newsletter/NewsletterTokenAction.tsx"),
    "utf8",
  );
  const layout = readFileSync(
    join(process.cwd(), "app/preview/newsletter/layout.tsx"),
    "utf8",
  );
  assert.match(preview, /NEWSLETTER_R4B_CONTROLLED_STATUS/);
  assert.match(tokenAction, /NEWSLETTER_R4B_CONTROLLED_STATUS/);
  assert.match(layout, /isNewsletterPreviewAvailable/);
  assert.match(layout, /notFound\(\)/);
  assert.doesNotMatch(
    `${preview}\n${tokenAction}`,
    /El envío real de correo todavía no está habilitado/,
  );
  assert.doesNotMatch(
    NEWSLETTER_R4B_CONTROLLED_STATUS,
    /@|api[_-]?key|secret|bearer|token|NEWSLETTER_/i,
  );
});
