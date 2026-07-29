import assert from "node:assert/strict";
import test from "node:test";

import { renderNewsletterEmailContent } from "../../emails/newsletter/email-renderer";

test("WelcomeEmail comparte el enlace de baja en HTML y texto sin prometer automatización activa", async () => {
  const unsubscribeUrl =
    "http://localhost:3000/preview/newsletter/unsubscribe?token=" + "U".repeat(43);
  const rendered = await renderNewsletterEmailContent("welcome", {
    logoUrl: "http://localhost:3000/brand/eventomotor-logo-horizontal-dark-header.png",
    provinceName: "Barcelona",
    eventsUrl: "http://localhost:3000/eventos-motor-barcelona",
    unsubscribeUrl,
    privacyUrl: "http://localhost:3000/privacidad",
    contactEmail: "info@eventomotor.com",
  });

  assert.match(rendered.html, new RegExp(unsubscribeUrl.replace(/[?]/g, "\\?")));
  assert.match(rendered.text, new RegExp(unsubscribeUrl.replace(/[?]/g, "\\?")));
  assert.match(rendered.html, /darte de baja/i);
  assert.match(rendered.text, /darte de baja/i);
  assert.doesNotMatch(rendered.html, /La primera edición llegará|envío automatizado/i);
  assert.doesNotMatch(rendered.text, /La primera edición llegará|envío automatizado/i);
});
