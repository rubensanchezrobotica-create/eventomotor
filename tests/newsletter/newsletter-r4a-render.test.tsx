import assert from "node:assert/strict";
import test from "node:test";

import { renderNewsletterEmailContent } from "../../emails/newsletter/email-renderer";

test("la fuente React Email real conserva HTML y texto para confirmation y welcome", async () => {
  const confirmationUrl =
    `https://newsletter.example.invalid/preview/newsletter/confirm?token=${"C".repeat(43)}`;
  const unsubscribeUrl =
    `https://newsletter.example.invalid/preview/newsletter/unsubscribe?token=${"U".repeat(43)}`;
  const confirmation = await renderNewsletterEmailContent("confirmation", {
    logoUrl: "https://newsletter.example.invalid/brand/logo.png",
    confirmationUrl,
    expiresInHours: 24,
    privacyUrl: "https://newsletter.example.invalid/privacidad",
    contactEmail: "info@eventomotor.com",
  });
  const welcome = await renderNewsletterEmailContent("welcome", {
    logoUrl: "https://newsletter.example.invalid/brand/logo.png",
    provinceName: "Barcelona",
    eventsUrl: "https://newsletter.example.invalid/eventos-motor-barcelona",
    unsubscribeUrl,
    privacyUrl: "https://newsletter.example.invalid/privacidad",
    contactEmail: "info@eventomotor.com",
  });

  assert.match(confirmation.html, new RegExp(confirmationUrl.replace("?", "\\?")));
  assert.match(confirmation.text, /Confirmar mi suscripci/);
  assert.match(welcome.html, new RegExp(unsubscribeUrl.replace("?", "\\?")));
  assert.match(welcome.text, new RegExp(unsubscribeUrl.replace("?", "\\?")));
});
