import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  newsletterRegionForProvince,
} from "../../lib/newsletter/audience";
import {
  parseRequestNewsletterInput,
} from "../../lib/newsletter/http.server";
import {
  NEWSLETTER_PRODUCTION_REPLY_TO,
  NEWSLETTER_PRODUCTION_SENDER,
  evaluateNewsletterProductionCanaryResendConfiguration,
} from "../../lib/newsletter/resend-config.server";
import { createNewsletterService } from "../../lib/newsletter/service.server";
import type {
  NewsletterMailCommand,
  NewsletterRepository,
} from "../../lib/newsletter/service-types";
import {
  NEWSLETTER_PRODUCTION_CANARY_ARMED_VALUE,
} from "../../lib/newsletter/r5a-guard";

const projectRoot = process.cwd();

function source(path: string) {
  return readFileSync(join(projectRoot, path), "utf8");
}

const legalCanaryEnvironment = {
  newsletterMode: "live",
  mailTransport: "resend",
  armed: NEWSLETTER_PRODUCTION_CANARY_ARMED_VALUE,
  canaryOrigin: "https://www.eventomotor.com",
  apiKey: `re_canary_${"a".repeat(32)}`,
  from: NEWSLETTER_PRODUCTION_SENDER,
  replyTo: NEWSLETTER_PRODUCTION_REPLY_TO,
  recipientAllowlist: "legal-review@example.invalid",
  nodeEnv: "production",
  vercel: "1",
  vercelEnv: "production",
} as const;

test("la provincia es opcional y la región se deriva exclusivamente en servidor", () => {
  assert.deepEqual(
    parseRequestNewsletterInput({
      email: "reader@example.invalid",
      consentVersion: "2026-07",
    }),
    {
      ok: true,
      value: {
        email: "reader@example.invalid",
        provinceSlug: null,
        consentVersion: "2026-07",
      },
    },
  );
  assert.deepEqual(
    parseRequestNewsletterInput({
      email: "reader@example.invalid",
      province: "",
      consentVersion: "2026-07",
    }),
    {
      ok: true,
      value: {
        email: "reader@example.invalid",
        provinceSlug: null,
        consentVersion: "2026-07",
      },
    },
  );
  assert.equal(newsletterRegionForProvince(null), null);
  assert.equal(newsletterRegionForProvince("barcelona"), "cataluna");
  assert.equal(newsletterRegionForProvince("madrid"), "comunidad-de-madrid");
  assert.match(
    source("lib/newsletter/http.server.ts"),
    /regionSlug:\s*newsletterRegionForProvince\(input\.provinceSlug\)/,
  );
});

test("el servicio completa confirmación y bienvenida sin provincia", async () => {
  const commands: NewsletterMailCommand[] = [];
  let requestedRegion: string | null | undefined;
  const repository: NewsletterRepository = {
    async requestSubscription(params) {
      requestedRegion = params.regionSlug;
      assert.equal(params.provinceSlug, null);
      return {
        outcome: "confirmation_required",
        subscriberId: "123e4567-e89b-42d3-a456-426614174000",
        tokenPurpose: "subscribe",
      };
    },
    async confirmSubscription() {
      return {
        outcome: "confirmed",
        subscriberId: "123e4567-e89b-42d3-a456-426614174000",
      };
    },
    async prepareWelcomeDelivery() {
      return {
        subscriberId: "123e4567-e89b-42d3-a456-426614174000",
        recipientEmail: "reader@example.invalid",
        provinceSlug: null,
        regionSlug: null,
        locale: "es",
      };
    },
    async unsubscribeSubscriber() {
      return "unsubscribed";
    },
    async unsubscribeByToken() {
      return "unsubscribed";
    },
    async recordProviderEvent() {
      return "recorded";
    },
    async checkDeliveryEligibility() {
      return "allowed";
    },
  };
  const service = createNewsletterService({
    mode: "live",
    repository,
    mailTransport: {
      availability: "ready",
      async send(command) {
        commands.push(command);
        return { status: "accepted" };
      },
    },
    tokenFactory: () => "T".repeat(43),
    tokenHasher: () => "a".repeat(64),
    now: () => new Date("2026-07-29T12:00:00.000Z"),
  });

  const requested = await service.requestSubscription({
    email: "reader@example.invalid",
    source: "r5a1_test",
    sourcePath: "/newsletter",
    consentVersion: "2026-07",
    provinceSlug: null,
    regionSlug: newsletterRegionForProvince(null),
  });
  const confirmed = await service.confirmSubscription({
    token: "T".repeat(43),
  });

  assert.equal(requested.decision, "confirmation_required");
  assert.equal(confirmed.decision, "confirmed");
  assert.equal(requestedRegion, null);
  assert.equal(commands.length, 2);
  assert.equal(commands[1]?.kind, "welcome");
  if (commands[1]?.kind === "welcome") {
    assert.equal(commands[1].provinceSlug, null);
    assert.equal(commands[1].regionSlug, null);
  }
});

test("el formulario integra la primera capa, edad y consentimiento literal desmarcado", () => {
  const form = source("components/newsletter/NewsletterSignupForm.tsx");
  assert.doesNotMatch(form, /Rubén(?: Ginés)? Sánchez(?: García)?/);
  assert.doesNotMatch(form, /Vercel, Supabase, Resend y Zoho/);
  assert.match(form, /Finalidad:/);
  assert.match(form, /Legitimación:/);
  assert.match(form, /Consulta la/);
  assert.match(form, /Provincia — opcional/);
  assert.match(form, /selección general de España/);
  assert.match(
    form,
    /Quiero recibir cada semana “La Agenda Motor”, la newsletter de\s+EventoMotor/,
  );
  assert.match(form, /declaras tener al menos 14 años/);
  assert.match(form, /Quiero recibir La Agenda Motor/);
  assert.match(form, /useState\(false\)/);
  assert.match(form, /if \(!consent\)/);
  assert.doesNotMatch(form, /defaultChecked|checked=\{true\}/);
  assert.match(form, /href="\/privacidad"/);
  assert.match(form, /href="\/aviso-legal"/);
  assert.doesNotMatch(form, /se eliminarán automáticamente a los 7 días/);
});

test("privacidad y aviso legal identifican al responsable sin sociedad inventada", () => {
  const privacy = source("app/privacidad/page.tsx");
  const legalNotice = source("app/aviso-legal/page.tsx");
  const visualStyles = source("app/legal-document.module.css");

  for (const page of [privacy, legalNotice]) {
    assert.match(page, /Rubén Ginés Sánchez García/);
    assert.match(page, /info@eventomotor\.com/);
    assert.doesNotMatch(page, /S\.L\.|EventoMotor es una sociedad mercantil/);
    assert.equal((page.match(/<h1/g) ?? []).length, 1);
    assert.match(page, /legalStyles\.document/);
  }
  assert.match(privacy, /Política de privacidad de EventoMotor/);
  assert.match(privacy, /<h2>13\. Cambios en la política<\/h2>/);
  assert.match(legalNotice, /<h2>Titularidad<\/h2>/);
  assert.match(legalNotice, /Revisión obligatoria:/);
  assert.match(visualStyles, /\.legalPage \.document h2/);
  assert.match(visualStyles, /\.legalPage \.document h3/);
  assert.match(visualStyles, /a:focus-visible/);
  assert.match(visualStyles, /@media \(max-width: 768px\)/);
});

test("los tres emails integran el bloque legal sin prometer la purga inexistente", () => {
  const confirmation = source("emails/newsletter/ConfirmSubscriptionEmail.tsx");
  const welcome = source("emails/newsletter/WelcomeEmail.tsx");
  const weekly = source("emails/newsletter/WeeklyAgendaEmail.tsx");
  const metadata = source("emails/newsletter/email-metadata.ts");

  assert.match(metadata, /Confirma tu suscripción a La Agenda Motor/);
  assert.match(metadata, /Solo falta un paso para recibir cada semana/);
  assert.match(confirmation, /solo puede\s+utilizarse una vez/);
  assert.match(confirmation, /Si no has realizado esta solicitud/);
  assert.doesNotMatch(confirmation, /Rubén Ginés Sánchez García/);
  assert.match(confirmation, /solicitaste tu suscripción/);
  assert.match(confirmation, /Aviso legal/);
  assert.doesNotMatch(confirmation, /7 días/);

  assert.doesNotMatch(welcome, /Rubén Ginés Sánchez García/);
  assert.match(welcome, /confirmaste tu suscripción/);
  assert.match(welcome, /Política de privacidad/);
  assert.match(welcome, /Aviso legal/);
  assert.match(welcome, /Darte de baja/);

  assert.doesNotMatch(weekly, /Rubén Ginés Sánchez García/);
  assert.match(weekly, /porque confirmaste tu suscripción/);
  assert.match(weekly, /no comparte tus datos/);
  assert.doesNotMatch(weekly, /Gestionar preferencias|preferencesUrl/);
  assert.match(weekly, /Política de privacidad/);
  assert.match(weekly, /Aviso legal/);
  assert.match(weekly, /Darme de baja/);
  assert.match(weekly, /Contacto:/);
});

test("la baja usa el copy legal sin exponer dirección ni simular minimización", () => {
  const model = source("components/newsletter/newsletter-token-action-model.ts");
  assert.match(model, /Tu baja se ha completado/);
  assert.match(model, /nueva suscripción y confirmar de nuevo tu correo/);
  assert.match(model, /La solicitud ya no está disponible/);
  assert.match(model, /escribe a info@eventomotor\.com/);
  assert.doesNotMatch(model, /registro mínimo necesario/);
});

test("el formulario de eventos muestra primera capa y nunca acopla la newsletter", () => {
  const form = source("components/public/EventSubmissionForm.tsx");
  assert.match(form, /Protección de datos:/);
  assert.doesNotMatch(form, /Rubén(?: Ginés)? Sánchez(?: García)?/);
  assert.match(form, /hasta 2 años\s+después del evento/);
  assert.match(form, /href="\/privacidad"/);
  assert.doesNotMatch(form, /newsletter|La Agenda Motor|\/api\/newsletter/i);
});

test("la política no simula preferencias publicables, minimización ni webhook activos", () => {
  const privacy = source("app/privacidad/page.tsx");
  assert.match(privacy, /correo y el teléfono se utilizan como datos\s+internos/);
  assert.match(privacy, /integración autenticada[\s\S]*debe completarse/);
  assert.match(privacy, /minimización\s+posterior debe completarse/);
  assert.doesNotMatch(
    privacy,
    /Preferencias expresas sobre qué datos de contacto pueden\s+publicarse|lo haya seleccionado expresamente como\s+público/,
  );
});

test("Analytics exige consentimiento, limpia estado y excluye rutas sensibles", () => {
  const component = source("components/analytics/GoogleAnalytics.tsx");
  const consent = source("lib/cookie-consent.ts");
  const banner = source("components/cookies/CookieConsent.tsx");

  for (const path of [
    "/newsletter",
    "/newsletter/confirm",
    "/newsletter/unsubscribe",
    "/preview/newsletter/confirm",
    "/preview/newsletter/unsubscribe",
  ]) {
    assert.match(component, new RegExp(path.replaceAll("/", "\\/")));
  }
  assert.match(component, /if \(!analyticsAllowed\) return null/);
  assert.match(component, /applyAnalyticsConsent\(GA_ID, allowed\)/);
  assert.match(consent, /ga-disable-/);
  assert.match(consent, /name === "_ga" \|\| name\.startsWith\("_ga_"\)/);
  assert.match(banner, /Rechazar[\s\S]*Configurar[\s\S]*Aceptar/);
  assert.match(banner, /Rechazar las cookies analíticas no limita/);
});

test("el canario exige remitente y Reply-To exactos sin leer valores reales", () => {
  const enabled = evaluateNewsletterProductionCanaryResendConfiguration(
    legalCanaryEnvironment,
  );
  assert.equal(enabled.enabled, true);
  assert.equal(
    NEWSLETTER_PRODUCTION_SENDER,
    "La Agenda Motor · EventoMotor <agenda@news.eventomotor.com>",
  );
  assert.equal(NEWSLETTER_PRODUCTION_REPLY_TO, "info@eventomotor.com");
  assert.deepEqual(
    evaluateNewsletterProductionCanaryResendConfiguration({
      ...legalCanaryEnvironment,
      from: "EventoMotor <agenda@news.eventomotor.com>",
    }),
    { enabled: false, reason: "from_invalid" },
  );
  assert.deepEqual(
    evaluateNewsletterProductionCanaryResendConfiguration({
      ...legalCanaryEnvironment,
      replyTo: "newsletter@eventomotor.com",
    }),
    { enabled: false, reason: "reply_to_invalid" },
  );
});

test("rutas sensibles conservan noindex, no-referrer, no-store y POST", () => {
  const layout = source("app/newsletter/layout.tsx");
  const page = source("app/newsletter/page.tsx");
  const http = source("lib/newsletter/http.server.ts");

  assert.match(layout, /referrer:\s*"no-referrer"/);
  assert.match(layout, /index:\s*false/);
  assert.match(layout, /notFound\(\)/);
  assert.match(page, /await connection\(\)/);
  assert.match(http, /"Cache-Control":\s*"no-store"/);
  for (const operation of ["request", "confirm", "unsubscribe"]) {
    const route = source(`app/api/newsletter/${operation}/route.ts`);
    assert.match(route, /export const POST/);
    assert.doesNotMatch(route, /export const GET/);
  }
});
