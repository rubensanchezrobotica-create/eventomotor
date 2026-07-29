import assert from "node:assert/strict";
import test from "node:test";
import { renderNewsletterEmailContent } from "../../emails/newsletter/email-renderer";

const RAW_TOKEN = "A".repeat(43);

test("el renderer real genera HTML y texto de confirmación con el enlace interno exacto", async () => {
  const confirmationUrl =
    `http://localhost:3000/preview/newsletter/confirm?token=${RAW_TOKEN}`;
  const rendered = await renderNewsletterEmailContent("confirmation", {
    logoUrl: "http://localhost:3000/brand/eventomotor-logo-horizontal-dark-header.png",
    confirmationUrl,
    expiresInHours: 24,
    privacyUrl: "http://localhost:3000/privacidad",
    contactEmail: "info@eventomotor.com",
  });

  assert.match(rendered.html, /<!DOCTYPE html/i);
  assert.match(rendered.html, /Confirmar mi suscripción/);
  assert.match(rendered.html, new RegExp(confirmationUrl.replace("?", "\\?")));
  assert.match(rendered.text, /Confirmar mi suscripción/);
  assert.match(rendered.text, new RegExp(confirmationUrl.replace("?", "\\?")));
  assert.doesNotMatch(rendered.html, /<script|<form/i);
});
