import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  getNewsletterTokenActionView,
  type NewsletterTokenActionState,
} from "../../components/newsletter/newsletter-token-action-model";
import { isNewsletterPreviewAvailable } from "../../components/newsletter/newsletter-preview-model";
import { NEWSLETTER_R4B_ARMED_VALUE } from "../../lib/newsletter/r4b-guard";

const projectRoot = process.cwd();

function source(path: string): string {
  return readFileSync(join(projectRoot, path), "utf8");
}

test("confirmación pendiente presenta la acción y el apoyo correctos", () => {
  const view = getNewsletterTokenActionView("confirm", "ready");
  assert.equal(view.eyebrow, "CONFIRMACIÓN DE SUSCRIPCIÓN");
  assert.equal(view.title, "Confirma tu suscripción a La Agenda Motor");
  assert.equal(
    view.introduction,
    "Sólo falta este paso para empezar a recibir nuestra selección semanal de eventos del motor.",
  );
  assert.equal(view.support, "Confirma tu dirección para activar tu suscripción.");
  assert.equal(view.completed, false);
});

test("confirmación completada sustituye todo el copy previo a la acción", () => {
  const view = getNewsletterTokenActionView("confirm", "confirmed");
  assert.equal(view.eyebrow, "SUSCRIPCIÓN CONFIRMADA");
  assert.equal(view.title, "Ya formas parte de La Agenda Motor");
  assert.equal(
    view.introduction,
    "Tu suscripción está activa. Recibirás nuestra selección semanal de planes y eventos del motor.",
  );
  assert.equal(view.resultTitle, "Todo listo");
  assert.equal(
    view.resultCopy,
    "Te avisaremos cuando tengamos preparada tu próxima selección.",
  );
  assert.deepEqual(view.secondaryAction, {
    href: "/#calendario",
    label: "Ver próximos eventos",
  });
  assert.equal(view.support, undefined);
  assert.doesNotMatch(
    `${view.title} ${view.introduction} ${view.resultCopy}`,
    /Sólo falta este paso|Confirma tu dirección/,
  );
});

test("confirmación ya completada es idempotente y no parece un error", () => {
  const view = getNewsletterTokenActionView("confirm", "already_confirmed");
  assert.equal(view.title, "Tu suscripción ya estaba confirmada");
  assert.equal(view.introduction, "No necesitas realizar ninguna otra acción.");
  assert.equal(view.completed, true);
  assert.equal(view.support, undefined);
});

test("baja pendiente mantiene una salida segura y una acción explícita", () => {
  const view = getNewsletterTokenActionView("unsubscribe", "ready");
  const component = source("components/newsletter/NewsletterTokenAction.tsx");
  assert.equal(view.eyebrow, "BAJA DE LA NEWSLETTER");
  assert.equal(view.title, "¿Quieres dejar de recibir La Agenda Motor?");
  assert.equal(
    view.introduction,
    "Confirma la baja para dejar de recibir nuestras próximas ediciones.",
  );
  assert.equal(
    view.support,
    "Puedes cerrar esta página si prefieres mantener tu suscripción.",
  );
  assert.match(component, /Sí, darme de baja/);
  assert.match(component, /Mantener mi suscripción/);
});

test("baja completada y repetida sustituyen el copy pendiente", () => {
  const completed = getNewsletterTokenActionView("unsubscribe", "unsubscribed");
  const repeated = getNewsletterTokenActionView(
    "unsubscribe",
    "already_unsubscribed",
  );

  assert.equal(completed.eyebrow, "BAJA COMPLETADA");
  assert.equal(completed.title, "Tu baja se ha procesado correctamente");
  assert.equal(
    completed.introduction,
    "No recibirás nuevas ediciones de La Agenda Motor.",
  );
  assert.equal(completed.secondaryAction?.label, "Volver a EventoMotor");
  assert.equal(repeated.title, "La baja ya estaba completada");
  assert.equal(repeated.introduction, "No necesitas realizar ninguna otra acción.");

  for (const view of [completed, repeated]) {
    assert.equal(view.support, undefined);
    assert.doesNotMatch(
      `${view.title} ${view.introduction}`,
      /Confirma la baja|Puedes cerrar esta página/,
    );
  }
});

test("ningún estado muestra copy técnico sobre el token", () => {
  const states: NewsletterTokenActionState[] = [
    "checking",
    "token_missing",
    "token_invalid",
    "ready",
    "submitting",
    "confirmed",
    "already_confirmed",
    "unsubscribed",
    "already_unsubscribed",
    "invalid_or_expired",
    "unavailable",
    "temporarily_unavailable",
  ];
  const renderedCopy = states
    .flatMap((state) => [
      getNewsletterTokenActionView("confirm", state),
      getNewsletterTokenActionView("unsubscribe", state),
    ])
    .map((view) => JSON.stringify(view))
    .join("\n");
  const component = source("components/newsletter/NewsletterTokenAction.tsx");

  assert.doesNotMatch(renderedCopy, /token|memoria|variable|guard/i);
  assert.doesNotMatch(
    component,
    /token se mantiene|sólo en memoria|retira de la URL visible/i,
  );
});

test("la cabecera de tarea no contiene navegación completa ni Publicar", () => {
  const shell = source("components/newsletter/NewsletterPreviewShell.tsx");
  const tokenBranch = shell.slice(
    shell.indexOf("if (isTokenAction)"),
    shell.indexOf("\n  return (", shell.indexOf("if (isTokenAction)")),
  );
  assert.match(tokenBranch, /EventoMotor inicio/);
  assert.match(tokenBranch, /La Agenda Motor/);
  assert.match(tokenBranch, /className=\{styles\.taskShell\}/);
  assert.doesNotMatch(tokenBranch, /PublicNavigationMenu|ConceptStaticHeader|Publicar/);
});

test("la landing adapta etiqueta y Publicar sin alterar el header global", () => {
  const page = source("components/newsletter/NewsletterPreviewPage.tsx");
  const shell = source("components/newsletter/NewsletterPreviewShell.tsx");
  const css = source("components/newsletter/NewsletterPreview.module.css");
  const mobile = css.slice(
    css.indexOf("@media (max-width: 640px)"),
    css.indexOf("@media (min-width: 901px)"),
  );

  assert.match(page, /heroEyebrowMobile[^]*LA AGENDA MOTOR/);
  assert.match(page, /heroEyebrowDesktop[^]*LA AGENDA MOTOR · EVENTOMOTOR/);
  assert.match(css, /\.heroEyebrowMobile\s*\{\s*display:\s*none/);
  assert.match(mobile, /\.heroEyebrowMobile\s*\{\s*display:\s*inline/);
  assert.match(mobile, /\.heroEyebrowDesktop\s*\{\s*display:\s*none/);
  assert.match(
    mobile,
    /\.headerShell :global\(\.emc-nav-actions\)\s*\{\s*display:\s*none/,
  );
  assert.match(shell, /<ConceptStaticHeader compactActions \/>/);
  assert.doesNotMatch(css, /\.heroEyebrow[^}]*content:/);
});

test("R4B sigue fail-closed fuera del carril local armado", () => {
  const local = {
    armed: NEWSLETTER_R4B_ARMED_VALUE,
    localOrigin: "http://localhost:3000",
    requestUrl: "http://localhost:3000/preview/newsletter",
    requestOrigin: "http://localhost:3000",
    requestHost: "localhost:3000",
  };
  assert.equal(isNewsletterPreviewAvailable("off", undefined, "development", local), false);
  assert.equal(
    isNewsletterPreviewAvailable("test", undefined, "development", {
      ...local,
      armed: undefined,
    }),
    false,
  );
  assert.equal(isNewsletterPreviewAvailable("test", undefined, "development", local), true);
  assert.match(
    source("app/preview/newsletter/layout.tsx"),
    /isNewsletterPreviewAvailable[\s\S]*notFound\(\)/,
  );
});

test("las acciones conservan POST y el cliente no ejecuta red durante render", () => {
  const client = source("lib/newsletter/http-client.ts");
  const component = source("components/newsletter/NewsletterTokenAction.tsx");
  assert.match(client, /method:\s*"POST"/);
  assert.match(client, /credentials:\s*"same-origin"/);
  assert.doesNotMatch(component, /\bfetch\s*\(/);
  const captureEffect = component.slice(
    component.indexOf("useEffect(() => {"),
    component.indexOf("}, [kind]);"),
  );
  assert.doesNotMatch(
    captureEffect,
    /confirmNewsletterSubscription\(|unsubscribeNewsletterSubscription\(/,
  );
});

test("la composición incluye escalas responsive, foco y prevención de overflow", () => {
  const css = source("components/newsletter/NewsletterPreview.module.css");
  const mobile = css.slice(
    css.indexOf("@media (max-width: 640px)"),
    css.indexOf("@media (min-width: 901px)"),
  );
  const tokenPage = css.slice(
    css.indexOf(".tokenPage {"),
    css.indexOf(".tokenHero {"),
  );
  const narrowMobile = css.slice(
    css.indexOf("@media (max-width: 360px)"),
    css.indexOf("@media (prefers-reduced-motion: reduce)"),
  );
  assert.match(css, /\.page \.tokenCard h1[\s\S]*clamp\(32px,\s*4\.2vw,\s*48px\)/);
  assert.match(css, /\.page \.heroCopy h1[\s\S]*clamp\(40px,\s*3\.8vw,\s*56px\)/);
  for (const width of [820, 640, 520, 430, 360]) {
    assert.match(css, new RegExp(`max-width: ${width}px`));
  }
  assert.match(
    css,
    /\.taskShell\s*\{[\s\S]*?min-height:\s*100vh[\s\S]*?min-height:\s*100svh[\s\S]*?display:\s*flex[\s\S]*?flex-direction:\s*column/,
  );
  assert.match(tokenPage, /flex:\s*1 0 auto/);
  assert.doesNotMatch(tokenPage, /align-items:\s*center|display:\s*grid/);
  assert.match(mobile, /\.headerShell\.headerShell\s*\{[\s\S]*?padding:\s*5px/);
  assert.match(
    mobile,
    /\.headerShell :global\(\.emc-nav\)\s*\{[\s\S]*?min-height:\s*48px/,
  );
  assert.match(mobile, /\.taskHeaderInner\s*\{[\s\S]*?min-height:\s*58px/);
  assert.match(
    mobile,
    /\.page \.heroGrid\s*\{[\s\S]*?width:\s*calc\(100% - 32px\)[\s\S]*?gap:\s*20px/,
  );
  assert.match(
    mobile,
    /\.page \.heroCopy h1\s*\{[\s\S]*?font-size:\s*32px[\s\S]*?line-height:\s*1\.02/,
  );
  assert.match(mobile, /\.heroProof\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2/);
  assert.match(mobile, /\.heroProof strong\s*\{[\s\S]*?white-space:\s*nowrap/);
  assert.match(
    mobile,
    /\.tokenPage\s*\{[\s\S]*?min-height:\s*0[\s\S]*?display:\s*block/,
  );
  assert.match(mobile, /\.tokenCard\s*\{[\s\S]*?padding:\s*20px 18px/);
  assert.match(
    mobile,
    /\.page \.tokenCard h1\s*\{[\s\S]*?font-size:\s*30px[\s\S]*?line-height:\s*1\.07/,
  );
  assert.match(
    mobile,
    /\.tokenStatus,[\s\S]*?margin-top:\s*18px[\s\S]*?padding:\s*16px/,
  );
  assert.match(
    mobile,
    /\.tokenAction \.primaryButton,[\s\S]*?min-height:\s*48px/,
  );
  assert.match(
    mobile,
    /\.page \.cancelAction\s*\{[\s\S]*?min-height:\s*44px[\s\S]*?font-weight:\s*650/,
  );
  assert.match(mobile, /\.taskFooter > div\s*\{[\s\S]*?min-height:\s*52px/);
  assert.match(
    narrowMobile,
    /\.page \.heroCopy h1\s*\{[\s\S]*?font-size:\s*30px/,
  );
  assert.match(
    narrowMobile,
    /\.page \.tokenCard h1\s*\{[\s\S]*?font-size:\s*28px/,
  );
  assert.doesNotMatch(narrowMobile, /\.heroProof,[\s\S]*?\.flowList/);
  assert.match(css, /overflow-x:\s*clip/);
  assert.match(css, /focus-visible/);
  assert.match(css, /primaryButton:not\(:disabled\):hover/);
  assert.match(css, /secondaryActionButton:not\(:disabled\):hover/);
});
