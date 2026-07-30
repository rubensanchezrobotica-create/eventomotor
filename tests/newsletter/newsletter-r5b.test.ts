import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  createNewsletterHttpHandler,
  evaluateNewsletterHttpGuard,
  type NewsletterHttpRuntimeEnvironment,
} from "../../lib/newsletter/http.server";
import type {
  NewsletterResendClient,
  NewsletterResendEmailPayload,
} from "../../lib/newsletter/resend-client.server";
import {
  NEWSLETTER_PRODUCTION_REPLY_TO,
  NEWSLETTER_PRODUCTION_SENDER,
  createNewsletterPublicLaunchResendRuntime,
  evaluateNewsletterProductionCanaryResendConfiguration,
  evaluateNewsletterPublicLaunchResendConfiguration,
  type NewsletterPublicLaunchResendEnvironment,
} from "../../lib/newsletter/resend-config.server";
import {
  NewsletterResendTransportError,
  ResendNewsletterMailTransport,
} from "../../lib/newsletter/resend-transport.server";
import {
  evaluateNewsletterResendWebhookConfiguration,
} from "../../lib/newsletter/resend-webhook.server";
import type {
  NewsletterMailCommand,
  NewsletterService,
} from "../../lib/newsletter/service-types";
import {
  NEWSLETTER_PRODUCTION_CANARY_ARMED_VALUE,
} from "../../lib/newsletter/r5a-guard";
import {
  NEWSLETTER_PUBLIC_LAUNCH_ARMED_VALUE,
  NEWSLETTER_PUBLIC_LAUNCH_CANONICAL_ORIGIN,
  isNewsletterPublicLaunchMutationRequestAllowed,
  isNewsletterPublicLaunchPageRequestAllowed,
  parseNewsletterPublicLaunchOrigin,
} from "../../lib/newsletter/r5b-guard";

const PROJECT_ROOT = process.cwd();
const ORIGIN = "https://www.eventomotor.com";
const API_KEY = `re_public_${"a".repeat(32)}`;
const WEBHOOK_SECRET = `whsec_${"b".repeat(32)}`;
const PUBLIC_RECIPIENT = "reader@example.invalid";
const OTHER_RECIPIENT = "another-reader@example.invalid";
const CONFIRMATION_TOKEN = "C".repeat(43);

const PUBLIC_ENVIRONMENT: NewsletterPublicLaunchResendEnvironment = {
  newsletterMode: "live",
  mailTransport: "resend",
  publicLaunchEnabled: NEWSLETTER_PUBLIC_LAUNCH_ARMED_VALUE,
  publicLaunchOrigin: ORIGIN,
  apiKey: API_KEY,
  webhookSecret: WEBHOOK_SECRET,
  from: NEWSLETTER_PRODUCTION_SENDER,
  replyTo: NEWSLETTER_PRODUCTION_REPLY_TO,
  nodeEnv: "production",
  vercel: "1",
  vercelEnv: "production",
};

class FakeResendClient implements NewsletterResendClient {
  readonly calls: NewsletterResendEmailPayload[] = [];

  async sendEmail(payload: NewsletterResendEmailPayload) {
    this.calls.push(structuredClone(payload));
    return {
      status: "accepted" as const,
      providerMessageId: "r5b-public-message",
    };
  }
}

function source(path: string): string {
  return readFileSync(join(PROJECT_ROOT, path), "utf8");
}

function publicHttpEnvironment(): NewsletterHttpRuntimeEnvironment {
  return {
    mode: "live",
    mailTransport: "resend",
    publicLaunchEnabled: NEWSLETTER_PUBLIC_LAUNCH_ARMED_VALUE,
    publicLaunchOrigin: ORIGIN,
    apiKey: API_KEY,
    webhookSecret: WEBHOOK_SECRET,
    from: NEWSLETTER_PRODUCTION_SENDER,
    replyTo: NEWSLETTER_PRODUCTION_REPLY_TO,
    nodeEnv: "production",
    vercel: "1",
    vercelEnv: "production",
  };
}

test("el lanzamiento público exige la matriz completa y un armamento no booleano", () => {
  const enabled =
    evaluateNewsletterPublicLaunchResendConfiguration(PUBLIC_ENVIRONMENT);
  assert.equal(enabled.enabled, true);
  if (enabled.enabled) {
    assert.equal(enabled.canonicalEndpoint, ORIGIN);
    assert.equal(enabled.recipientPolicy, "public");
    assert.equal("allowedRecipients" in enabled, false);
  }

  for (const [key, value, reason] of [
    ["newsletterMode", "off", "mode_not_live"],
    ["mailTransport", "disabled", "transport_not_selected"],
    ["publicLaunchEnabled", undefined, "public_launch_not_armed"],
    ["publicLaunchEnabled", "true", "public_launch_not_armed"],
    ["publicLaunchOrigin", "https://eventomotor.com", "public_endpoint_invalid"],
    ["apiKey", undefined, "api_key_invalid"],
    ["webhookSecret", undefined, "webhook_secret_invalid"],
    ["from", "EventoMotor <agenda@news.eventomotor.com>", "from_invalid"],
    ["replyTo", "newsletter@eventomotor.com", "reply_to_invalid"],
    ["nodeEnv", "development", "production_environment_required"],
    ["vercel", undefined, "vercel_required"],
    ["vercelEnv", "preview", "production_environment_required"],
  ] as const) {
    assert.deepEqual(
      evaluateNewsletterPublicLaunchResendConfiguration({
        ...PUBLIC_ENVIRONMENT,
        [key]: value,
      }),
      { enabled: false, reason },
    );
  }
});

test("el origen público exige HTTPS canónico, host y Origin exactos", () => {
  assert.equal(
    parseNewsletterPublicLaunchOrigin(ORIGIN)?.origin,
    NEWSLETTER_PUBLIC_LAUNCH_CANONICAL_ORIGIN,
  );
  for (const value of [
    undefined,
    "",
    "http://www.eventomotor.com",
    "https://eventomotor.com",
    "https://preview.eventomotor.com",
    "https://www.eventomotor.com/",
    "https://www.eventomotor.com/newsletter",
    "https://www.eventomotor.com.evil.invalid",
  ]) {
    assert.equal(parseNewsletterPublicLaunchOrigin(value), null);
  }

  const configuration =
    evaluateNewsletterPublicLaunchResendConfiguration(PUBLIC_ENVIRONMENT);
  assert.equal(
    isNewsletterPublicLaunchPageRequestAllowed(
      configuration,
      "www.eventomotor.com",
      "https",
    ),
    true,
  );
  assert.equal(
    isNewsletterPublicLaunchPageRequestAllowed(
      configuration,
      "eventomotor.com",
      "https",
    ),
    false,
  );
  assert.equal(
    isNewsletterPublicLaunchMutationRequestAllowed(
      configuration,
      `${ORIGIN}/api/newsletter/request`,
      ORIGIN,
      "www.eventomotor.com",
    ),
    true,
  );
  assert.equal(
    isNewsletterPublicLaunchMutationRequestAllowed(
      configuration,
      `${ORIGIN}/api/newsletter/request`,
      "https://attacker.invalid",
      "www.eventomotor.com",
    ),
    false,
  );
});

test("public acepta destinatarios válidos sin allowlist y conserva el transporte transaccional", async () => {
  const client = new FakeResendClient();
  const runtime = createNewsletterPublicLaunchResendRuntime(
    {
      ...PUBLIC_ENVIRONMENT,
      recipientAllowlist: "canary-only@example.invalid",
    },
    () => client,
  );
  assert.equal(runtime?.serviceMode, "live");
  assert.ok(runtime);
  assert.equal(client.calls.length, 0);

  const transport = new ResendNewsletterMailTransport({
    client,
    from: NEWSLETTER_PRODUCTION_SENDER,
    replyTo: NEWSLETTER_PRODUCTION_REPLY_TO,
    recipientPolicy: "public",
    linkOrigin: ORIGIN,
    linkProfile: "production-public",
    async renderConfirmation(props) {
      return { html: props.confirmationUrl, text: props.confirmationUrl };
    },
  });

  for (const recipientEmail of [PUBLIC_RECIPIENT, OTHER_RECIPIENT]) {
    await transport.send({
      kind: "confirmation",
      recipientEmail,
      rawConfirmationToken: CONFIRMATION_TOKEN,
      purpose: "subscribe",
      expiresAt: "2026-08-01T00:00:00.000Z",
    });
  }
  assert.deepEqual(
    client.calls.map((call) => call.to),
    [[PUBLIC_RECIPIENT], [OTHER_RECIPIENT]],
  );
  assert.ok(
    client.calls.every(
      (call) =>
        !("cc" in call) &&
        !("bcc" in call) &&
        !("tracking" in call) &&
        call.from === NEWSLETTER_PRODUCTION_SENDER &&
        call.replyTo === NEWSLETTER_PRODUCTION_REPLY_TO,
    ),
  );

  await assert.rejects(
    transport.send({
      kind: "confirmation",
      recipientEmail: `${PUBLIC_RECIPIENT},${OTHER_RECIPIENT}`,
      rawConfirmationToken: CONFIRMATION_TOKEN,
      purpose: "subscribe",
      expiresAt: "2026-08-01T00:00:00.000Z",
    }),
    (error) =>
      error instanceof NewsletterResendTransportError &&
      error.category === "resend_recipient_not_allowed",
  );
});

test("la edición semanal continúa fuera del transporte público", async () => {
  const client = new FakeResendClient();
  const runtime = createNewsletterPublicLaunchResendRuntime(
    PUBLIC_ENVIRONMENT,
    () => client,
  );
  assert.ok(runtime);
  await assert.rejects(
    runtime.transport.send({
      kind: "weekly",
      recipientEmail: PUBLIC_RECIPIENT,
    } as unknown as NewsletterMailCommand),
    (error) =>
      error instanceof NewsletterResendTransportError &&
      error.category === "resend_configuration_invalid",
  );
  assert.equal(client.calls.length, 0);

  const serviceTypes = source("lib/newsletter/service-types.ts");
  assert.match(serviceTypes, /NewsletterMailCommand = ConfirmationMailCommand \| WelcomeMailCommand/);
  assert.doesNotMatch(serviceTypes, /WeeklyMailCommand|CampaignMailCommand/);
});

test("el guard HTTP separa canary y public y cierra configuraciones ambiguas", () => {
  const publicGuard = evaluateNewsletterHttpGuard({
    ...publicHttpEnvironment(),
    requestUrl: `${ORIGIN}/api/newsletter/request`,
    origin: ORIGIN,
    host: "www.eventomotor.com",
  });
  assert.deepEqual(publicGuard, {
    allowed: true,
    mode: "live",
    launch: "public",
  });

  const canaryEnvironment = {
    mode: "live",
    mailTransport: "resend",
    armed: NEWSLETTER_PRODUCTION_CANARY_ARMED_VALUE,
    canaryOrigin: ORIGIN,
    recipientAllowlist: PUBLIC_RECIPIENT,
    apiKey: API_KEY,
    from: NEWSLETTER_PRODUCTION_SENDER,
    replyTo: NEWSLETTER_PRODUCTION_REPLY_TO,
    nodeEnv: "production",
    vercel: "1",
    vercelEnv: "production",
  } satisfies NewsletterHttpRuntimeEnvironment;
  const canaryConfiguration =
    evaluateNewsletterProductionCanaryResendConfiguration({
      newsletterMode: canaryEnvironment.mode,
      ...canaryEnvironment,
    });
  assert.equal(canaryConfiguration.enabled, true);
  const canaryGuard = evaluateNewsletterHttpGuard({
    ...canaryEnvironment,
    requestUrl: `${ORIGIN}/api/newsletter/request`,
    origin: ORIGIN,
    host: "www.eventomotor.com",
  });
  assert.equal(canaryGuard.allowed, true);
  if (canaryGuard.allowed && canaryGuard.mode === "live") {
    assert.equal(canaryGuard.launch, "canary");
    assert.deepEqual(canaryGuard.allowedRecipients, [PUBLIC_RECIPIENT]);
  }

  const ambiguous = evaluateNewsletterHttpGuard({
    ...canaryEnvironment,
    ...publicHttpEnvironment(),
    armed: NEWSLETTER_PRODUCTION_CANARY_ARMED_VALUE,
    canaryOrigin: ORIGIN,
    recipientAllowlist: PUBLIC_RECIPIENT,
    requestUrl: `${ORIGIN}/api/newsletter/request`,
    origin: ORIGIN,
    host: "www.eventomotor.com",
  });
  assert.deepEqual(ambiguous, {
    allowed: false,
    mode: "live",
    reason: "production_configuration_ambiguous",
  });
});

test("la API pública procesa emails fuera de allowlist sin perder anti-enumeración", async () => {
  let serviceCalls = 0;
  const service = {
    async requestSubscription() {
      serviceCalls += 1;
      return {
        publicResponse: {
          message:
            "Si la solicitud es válida, recibirás los próximos pasos por correo.",
        },
        decision: "blocked" as const,
        mailStatus: "not_required" as const,
        internalErrorCategory: "blocked_state" as const,
      };
    },
  } as unknown as NewsletterService;
  const handler = createNewsletterHttpHandler("request", {
    environment: publicHttpEnvironment,
    createService: () => service,
    logger: { error() {} },
  });
  const response = await handler(
    new Request(`${ORIGIN}/api/newsletter/request`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: ORIGIN,
        Host: "www.eventomotor.com",
      },
      body: JSON.stringify({
        email: OTHER_RECIPIENT,
        consentVersion: "2026-07",
      }),
    }),
  );
  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), { ok: true, status: "accepted" });
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(serviceCalls, 1);
});

test("off y el canario no exponen superficies públicas ni crean servicio fuera de allowlist", async () => {
  let serviceCreations = 0;
  const offHandler = createNewsletterHttpHandler("request", {
    environment: () => ({
      ...publicHttpEnvironment(),
      mode: "off",
      mailTransport: "disabled",
    }),
    createService() {
      serviceCreations += 1;
      throw new Error("service must remain closed");
    },
  });
  const offResponse = await offHandler(
    new Request(`${ORIGIN}/api/newsletter/request`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: ORIGIN,
        Host: "www.eventomotor.com",
      },
      body: "{}",
    }),
  );
  assert.equal(offResponse.status, 404);
  assert.equal(serviceCreations, 0);

  const home = source("app/page.tsx");
  const eventPage = source("app/evento/[slug]/page.tsx");
  const eventView = source("components/events/detail/EventDetailView.tsx");
  const footer = source("components/public/concept/ConceptFooter.tsx");
  for (const file of [home, eventPage, eventView, footer]) {
    assert.match(file, /newsletterPublicLaunchEnabled/);
  }
  assert.match(home, /newsletterPublicLaunchEnabled\s*\?\s*<NewsletterCaptureCard/);
  assert.match(eventView, /newsletterPublicLaunchEnabled\s*\?\s*\(/);
  assert.match(
    footer,
    /newsletterPublicLaunchEnabled && column\.id === "organizers"/,
  );
});

test("landing, captación y primera capa legal conservan sus contratos públicos", () => {
  const layout = source("app/newsletter/layout.tsx");
  const page = source("app/newsletter/page.tsx");
  const card = source("components/newsletter/NewsletterCaptureCard.tsx");
  const form = source("components/newsletter/NewsletterSignupForm.tsx");
  const home = source("app/page.tsx");
  const event = [
    source("app/evento/[slug]/page.tsx"),
    source("components/events/detail/EventDetailView.tsx"),
  ].join("\n");
  const footer = source("components/public/concept/ConceptFooter.tsx");
  const emails = [
    "ConfirmSubscriptionEmail.tsx",
    "WelcomeEmail.tsx",
    "WeeklyAgendaEmail.tsx",
    "NewsletterEmailShell.tsx",
    "email-metadata.ts",
  ]
    .map((file) => source(`emails/newsletter/${file}`))
    .join("\n");

  assert.match(layout, /generateMetadata\(\)/);
  assert.match(layout, /canonical: `\$\{SITE_URL\}\/newsletter`/);
  assert.match(layout, /index: true/);
  assert.match(layout, /index: false/);
  assert.match(layout, /notFound\(\)/);
  assert.match(layout, /await connection\(\)/);
  assert.match(page, /experience=\{publicConfiguration\.enabled \? "public" : "production-canary"\}/);
  assert.match(page, /emails\.filter\(\(email\) => email\.kind === "weekly"\)/);

  assert.match(card, /href="\/newsletter"/);
  assert.match(card, /data-newsletter-capture=\{placement\}/);
  assert.match(card, />LA AGENDA MOTOR</);
  assert.match(card, /Recibe La Agenda Motor cada semana/);
  assert.match(
    card,
    /Una selección de eventos y planes de motor para que no se te escape\s+el próximo fin de semana/,
  );
  assert.match(card, /Gratis · Sin ruido · Baja en cualquier momento/);
  assert.doesNotMatch(
    card,
    /<form|<input|checkbox|<img|EventomotorLogo|iconOnly/i,
  );
  assert.doesNotMatch(form, /Rubén(?: Ginés)? Sánchez(?: García)?/);
  assert.match(form, /Provincia — opcional/);
  assert.match(form, /if \(!consent\)/);
  assert.match(form, /href="\/privacidad"/);
  assert.match(form, /href="\/aviso-legal"/);

  for (const surface of [home, event, footer, card, form, emails]) {
    assert.doesNotMatch(surface, /Rubén(?: Ginés)? Sánchez/);
  }
  assert.match(footer, /La Agenda Motor/);
});

test("la captación compacta conserva responsive, foco y jerarquía sin segunda hero", () => {
  const card = source("components/newsletter/NewsletterCaptureCard.tsx");
  const styles = source(
    "components/newsletter/NewsletterCaptureCard.module.css",
  );
  const privacy = source("app/privacidad/page.tsx");
  const legalNotice = source("app/aviso-legal/page.tsx");

  assert.equal((card.match(/<h2/g) ?? []).length, 1);
  assert.match(styles, /grid-template-columns:/);
  assert.match(styles, /overflow: hidden/);
  assert.match(styles, /\.button:focus-visible/);
  assert.match(styles, /@media \(max-width: 640px\)/);
  assert.match(
    styles.slice(styles.indexOf("@media (max-width: 640px)")),
    /grid-template-columns: minmax\(0, 1fr\)/,
  );
  assert.match(
    styles.slice(styles.indexOf("@media (max-width: 640px)")),
    /\.button\s*\{[\s\S]*?width: 100%/,
  );

  assert.equal((privacy.match(/Rubén Ginés Sánchez García/g) ?? []).length, 1);
  assert.equal(
    (legalNotice.match(/Rubén Ginés Sánchez García/g) ?? []).length,
    1,
  );
});

test("webhook acepta un único gate de producción completo y falla cerrado", () => {
  const publicWebhook = {
    newsletterMode: "live",
    mailTransport: "resend",
    publicLaunchEnabled: NEWSLETTER_PUBLIC_LAUNCH_ARMED_VALUE,
    publicLaunchOrigin: ORIGIN,
    apiKey: API_KEY,
    from: NEWSLETTER_PRODUCTION_SENDER,
    replyTo: NEWSLETTER_PRODUCTION_REPLY_TO,
    webhookSecret: WEBHOOK_SECRET,
    nodeEnv: "production",
    vercel: "1",
    vercelEnv: "production",
  };
  assert.deepEqual(evaluateNewsletterResendWebhookConfiguration(publicWebhook), {
    enabled: true,
    webhookSecret: WEBHOOK_SECRET,
  });
  assert.deepEqual(
    evaluateNewsletterResendWebhookConfiguration({
      ...publicWebhook,
      webhookSecret: undefined,
    }),
    { enabled: false },
  );
  assert.deepEqual(
    evaluateNewsletterResendWebhookConfiguration({
      ...publicWebhook,
      canaryArmed: NEWSLETTER_PRODUCTION_CANARY_ARMED_VALUE,
    }),
    { enabled: false },
  );

  const canaryWebhook = {
    newsletterMode: "live",
    mailTransport: "resend",
    canaryArmed: NEWSLETTER_PRODUCTION_CANARY_ARMED_VALUE,
    webhookSecret: WEBHOOK_SECRET,
    nodeEnv: "production",
    vercel: "1",
    vercelEnv: "production",
  };
  assert.deepEqual(evaluateNewsletterResendWebhookConfiguration(canaryWebhook), {
    enabled: true,
    webhookSecret: WEBHOOK_SECRET,
  });
});

test("variables, remitente y Reply-To permanecen exactos y sin valores reales", () => {
  const example = source(".env.example");
  const config = source("lib/newsletter/resend-config.server.ts");
  for (const variable of [
    "NEWSLETTER_PUBLIC_LAUNCH_ENABLED",
    "NEWSLETTER_PUBLIC_LAUNCH_ORIGIN",
  ]) {
    assert.match(example, new RegExp(`^${variable}=$`, "m"));
  }
  assert.doesNotMatch(example, /confirmed-public-launch/);
  assert.equal(
    NEWSLETTER_PRODUCTION_SENDER,
    "La Agenda Motor · EventoMotor <agenda@news.eventomotor.com>",
  );
  assert.equal(NEWSLETTER_PRODUCTION_REPLY_TO, "info@eventomotor.com");
  assert.match(config, /recipientPolicy: configuration\.recipientPolicy/);
});
