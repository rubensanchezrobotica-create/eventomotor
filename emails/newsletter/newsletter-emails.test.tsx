import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { NEWSLETTER_EMAIL_METADATA } from "./email-metadata";
import { renderAllNewsletterEmailPreviews, renderNewsletterEmail, renderNewsletterEmailText } from "./email-renderer";

const expected = {
  confirmation: {
    subject: "Confirma tu suscripción a La Agenda Motor",
    preheader: "Solo falta un paso para recibir los mejores eventos del motor cerca de ti.",
    cta: "Confirmar mi suscripción",
  },
  welcome: {
    subject: "Ya estás dentro: tu Agenda Motor empieza aquí",
    preheader: "Cada semana recibirás una selección de eventos del motor cerca de ti.",
    cta: "Ver próximos eventos",
  },
  weekly: {
    subject: "La Agenda Motor · 5 planes para este fin de semana",
    preheader: "Clásicos, rallyes, motos y circuito: tu selección semanal de eventos del motor.",
    cta: "Explorar toda la agenda",
  },
} as const;

for (const kind of ["confirmation", "welcome", "weekly"] as const) {
  test(`${kind}: genera HTML completo, texto plano y metadata contractual`, async () => {
    const [html, text] = await Promise.all([
      renderNewsletterEmail(kind),
      renderNewsletterEmailText(kind),
    ]);
    assert.match(html, /<!DOCTYPE html/i);
    assert.match(html, /alt="EventoMotor"/i);
    assert.match(html, new RegExp(expected[kind].cta.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.ok(html.includes(expected[kind].preheader));
    assert.ok(text.includes(expected[kind].cta));
    assert.ok(text.length > 200);
    assert.equal(NEWSLETTER_EMAIL_METADATA[kind].subject, expected[kind].subject);
    assert.equal(NEWSLETTER_EMAIL_METADATA[kind].preheader, expected[kind].preheader);
    assert.doesNotMatch(html, /<script|<form/i);
    assert.doesNotMatch(html, /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i);
    assert.doesNotMatch(html, /(?:api[_-]?key|secret|bearer|token)=/i);
    assert.doesNotMatch(html, /@(?:gmail|hotmail|outlook|yahoo)\./i);
  });
}

test("bienvenida y agenda incluyen baja; confirmación mantiene un único CTA", async () => {
  const [confirmation, welcome, weekly] = await Promise.all([
    renderNewsletterEmail("confirmation"),
    renderNewsletterEmail("welcome"),
    renderNewsletterEmail("weekly"),
  ]);
  assert.doesNotMatch(confirmation, /darte de baja/i);
  assert.match(welcome, /dar(?:me|te) de baja/i);
  assert.match(weekly, /dar(?:me|te) de baja/i);
  assert.equal((confirmation.match(/Confirmar mi suscripción/g) ?? []).length, 1);
});

test("la preview consume los tres renderizados desde las plantillas React únicas", async () => {
  const previews = await renderAllNewsletterEmailPreviews();
  assert.deepEqual(previews.map(({ kind }) => kind), ["confirmation", "welcome", "weekly"]);
  assert.equal(new Set(previews.map(({ html }) => html)).size, 3);

  const renderer = readFileSync(join(process.cwd(), "emails/newsletter/email-renderer.tsx"), "utf8");
  for (const template of ["ConfirmSubscriptionEmail", "WelcomeEmail", "WeeklyAgendaEmail"]) {
    assert.match(renderer, new RegExp(`import ${template}`));
    assert.match(renderer, new RegExp(`createElement\\(${template}`));
  }
  assert.doesNotMatch(renderer, /dangerouslySetInnerHTML|<!DOCTYPE html/i);
});

test("la agenda usa sólo fixtures marcados como preview y una introducción de 40–60 palabras", async () => {
  const html = await renderNewsletterEmail("weekly");
  assert.match(html, /eventos de esta edición son ficticios/i);
  const fixtures = readFileSync(join(process.cwd(), "emails/newsletter/email-fixtures.ts"), "utf8");
  assert.match(fixtures, /Evento ficticio|Ubicación ficticia|Edición de preview/);
  assert.doesNotMatch(fixtures, /supabase|fetch\s*\(/i);
  const introMatch = fixtures.match(/introduction:\s*\n?\s*"([^"]+)"/);
  assert.ok(introMatch);
  const words = introMatch[1].trim().split(/\s+/).length;
  assert.ok(words >= 40 && words <= 60, `La introducción tiene ${words} palabras`);
});
