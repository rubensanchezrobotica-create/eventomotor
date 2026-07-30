import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { createNewsletterService } from "../../lib/newsletter/service.server";
import type { NewsletterRepository } from "../../lib/newsletter/service-types";
import {
  isNewsletterProductionCanaryPageRequestAllowed,
} from "../../lib/newsletter/r5a-guard";
import {
  evaluateNewsletterProductionCanaryResendConfiguration,
} from "../../lib/newsletter/resend-config.server";

const projectRoot = process.cwd();
const SUBSCRIBER_ID = "123e4567-e89b-42d3-a456-426614174000";
const RECIPIENT = "legacy-reader@example.invalid";

function source(path: string) {
  return readFileSync(join(projectRoot, path), "utf8");
}

test("el canario permanece fail-closed y exige allowlist", () => {
  const disabled = evaluateNewsletterProductionCanaryResendConfiguration({
    newsletterMode: "off",
    mailTransport: "disabled",
  });
  assert.deepEqual(disabled, {
    enabled: false,
    reason: "transport_not_selected",
  });
  assert.equal(
    isNewsletterProductionCanaryPageRequestAllowed(
      disabled,
      "www.eventomotor.com",
      "https",
    ),
    false,
  );

  const configuration = source("lib/newsletter/resend-config.server.ts");
  const layout = source("app/newsletter/layout.tsx");
  assert.match(configuration, /if \(!allowedRecipients\)/);
  assert.match(configuration, /allowlist_invalid/);
  assert.match(layout, /notFound\(\)/);
});

test("la respuesta pública sigue siendo genérica para toda solicitud aceptada", () => {
  const handler = source("lib/newsletter/http.server.ts");
  const service = source("lib/newsletter/service.server.ts");
  assert.match(service, /NEWSLETTER_PUBLIC_MUTATION_RESPONSE/);
  assert.match(handler, /jsonResponse\(mapNewsletterRequestResult\(result\), 202\)/);
  assert.match(handler, /status:\s*"accepted"/);
  assert.doesNotMatch(
    handler,
    /JSON\.stringify\(\s*\{[^}]*subscriberId|JSON\.stringify\(\s*\{[^}]*tokenPurpose/,
  );
});

test("el estado aceptado sustituye el formulario y conserva accesibilidad", () => {
  const form = source("components/newsletter/NewsletterSignupForm.tsx");
  const acceptedBranch = form.indexOf('state === "accepted" ?');
  const formBranch = form.indexOf("<form", acceptedBranch);

  assert.ok(acceptedBranch >= 0);
  assert.ok(formBranch > acceptedBranch);
  assert.match(form, /Solicitud recibida/);
  assert.match(
    form,
    /Si la dirección indicada puede completar la suscripción,[\s\S]+?Spam y Promociones/,
  );
  assert.match(form, /El enlace de confirmación caduca a las 24 horas/);
  assert.match(form, /aria-live="polite"/);
  assert.match(form, /tabIndex=\{-1\}/);
  assert.match(form, /resultRef\.current\?\.focus\(\)/);
  assert.match(form, /aria-busy=\{busy\}/);
  assert.match(form, /disabled=\{busy\}/);
  assert.match(form, /runNewsletterMutationOnce\(submissionLock/);
  assert.doesNotMatch(
    form.slice(acceptedBranch, formBranch),
    /newsletter-preview-email|signupForm/,
  );
});

test("la primera capa legal es breve, completa y muestra una sola identidad", () => {
  const form = source("components/newsletter/NewsletterSignupForm.tsx");
  assert.equal(form.match(/Rubén Ginés Sánchez García/g)?.length, 1);
  for (const requirement of [
    "Responsable:",
    "Finalidad:",
    "Legitimación:",
    "Derechos:",
    "info@eventomotor.com",
    'href="/privacidad"',
    'href="/aviso-legal"',
    "Provincia — opcional",
    "al menos 14 años",
  ]) {
    assert.ok(form.includes(requirement), `missing legal requirement: ${requirement}`);
  }
  assert.match(form, /useState\(false\)/);
  assert.match(form, /if \(!consent\)/);
  assert.doesNotMatch(form, /Proveedores:|Conservación:|transferencias/i);
});

test("el nombre personal no se añade a la agenda semanal", () => {
  const weekly = source("emails/newsletter/WeeklyAgendaEmail.tsx");
  assert.doesNotMatch(weekly, /Rubén Ginés Sánchez García/);
  assert.match(weekly, /EventoMotor no comparte tus datos/);
});

test("la migración es forward-only, idempotente y no borra evidencia", () => {
  const migration = source(
    "database/migrations/20260730100000_newsletter_canary_hardening.sql",
  );
  assert.match(migration, /^--[\s\S]+?\nbegin;/);
  assert.match(migration, /commit;\s*$/);
  assert.match(migration, /create or replace function public\.repair_legacy/);
  assert.match(
    migration,
    /on conflict on constraint newsletter_suppressions_subscriber_key do update/,
  );
  assert.match(migration, /status <> 'unsubscribed'/);
  assert.match(migration, /purpose = 'resubscribe'/);
  assert.match(migration, /set invalidated_at = greatest/);
  assert.doesNotMatch(migration, /delete from public\.newsletter_confirmation_tokens/);
  assert.doesNotMatch(migration, /insert into public\.newsletter_consent_events/);
  assert.doesNotMatch(migration, /supabase db push|supabase link|https?:\/\//);
});

test("la autorreparación precede a la RPC R5A.2 y mantiene doble opt-in", () => {
  const migration = source(
    "database/migrations/20260730100000_newsletter_canary_hardening.sql",
  );
  const repair = migration.lastIndexOf(
    "perform public.repair_legacy_newsletter_unsubscribe(",
  );
  const request = migration.lastIndexOf(
    "from public.newsletter_request_subscription_r5a2_internal(",
  );
  assert.ok(repair >= 0);
  assert.ok(request > repair);
  assert.match(migration, /for update/);
  assert.match(migration, /status = 'unsubscribed'/);
  assert.match(migration, /token_purpose/);
});

test("un resubscribe reparado puede enviarse una vez y una supresión dura no", async () => {
  let allowedSends = 0;
  const allowedService = createNewsletterService({
    mode: "live",
    repository: {
      async requestSubscription() {
        return {
          outcome: "confirmation_required",
          subscriberId: SUBSCRIBER_ID,
          tokenPurpose: "resubscribe",
        };
      },
      async checkDeliveryEligibility() {
        return "allowed";
      },
      async registerOutboundDelivery() {
        return "recorded";
      },
    } as unknown as NewsletterRepository,
    mailTransport: {
      availability: "ready",
      async send() {
        allowedSends += 1;
        return { status: "accepted", providerMessageId: "r5a3-message" };
      },
    },
    tokenFactory: () => "R".repeat(43),
    tokenHasher: () => "a".repeat(64),
  });

  const allowed = await allowedService.requestSubscription({
    email: RECIPIENT,
    source: "r5a3_test",
    consentVersion: "2026-07",
  });
  assert.equal(allowed.decision, "confirmation_required");
  assert.equal(allowed.mailStatus, "accepted");
  assert.equal(allowedSends, 1);

  let blockedSends = 0;
  const blockedService = createNewsletterService({
    mode: "live",
    repository: {
      async requestSubscription() {
        return {
          outcome: "confirmation_required",
          subscriberId: SUBSCRIBER_ID,
          tokenPurpose: "resubscribe",
        };
      },
      async checkDeliveryEligibility() {
        return "blocked";
      },
    } as unknown as NewsletterRepository,
    mailTransport: {
      availability: "ready",
      async send() {
        blockedSends += 1;
        return { status: "accepted", providerMessageId: "must-not-send" };
      },
    },
    tokenFactory: () => "S".repeat(43),
    tokenHasher: () => "b".repeat(64),
  });

  const blocked = await blockedService.requestSubscription({
    email: RECIPIENT,
    source: "r5a3_test",
    consentVersion: "2026-07",
  });
  assert.equal(blocked.mailStatus, "failed");
  assert.equal(blocked.internalErrorCategory, "blocked_state");
  assert.equal(blockedSends, 0);
});
