import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const projectRoot = process.cwd();

function source(path: string): string {
  return readFileSync(join(projectRoot, path), "utf8");
}

test("la landing comunica una sola propuesta y elimina los mensajes duplicados", () => {
  const page = source("components/newsletter/NewsletterPreviewPage.tsx");
  const proposition = "Tu próximo plan de motor, <em>cada semana</em> en tu correo.";

  assert.equal(page.split(proposition).length - 1, 1);
  assert.match(
    page,
    /Recibe entre 3 y 7 eventos seleccionados cerca de ti\. Un solo correo semanal, sin ruido\./,
  );
  assert.match(page, /<strong>Recibe La Agenda Motor<\/strong>/);
  assert.doesNotMatch(page, /El próximo plan empieza aquí/);
  assert.doesNotMatch(page, /1<\/strong> correo semanal|3–7|Solo lo que merece la pena/);
});

test("la landing conserva el formulario completo y su orden de teclado natural", () => {
  const form = source("components/newsletter/NewsletterSignupForm.tsx");
  const email = form.indexOf('id="newsletter-preview-email"');
  const province = form.indexOf('id="newsletter-preview-province"');
  const consent = form.indexOf('id="newsletter-preview-consent"');
  const submit = form.indexOf('className={styles.primaryButton}');

  assert.ok(email > -1 && email < province);
  assert.ok(province < consent);
  assert.ok(consent < submit);
  assert.match(form, />Email<\/span>/);
  assert.match(form, />Provincia<\/span>/);
  assert.match(form, /He leído la <Link href="\/privacidad">información de privacidad<\/Link>/);
  assert.match(form, /Recibir la agenda semanal/);
  assert.match(form, /Puedes darte de baja cuando quieras\./);
  assert.match(form, /aria-live="polite"/);
});

test("el texto de ayuda de provincia sólo está asociado al selector correspondiente", () => {
  const form = source("components/newsletter/NewsletterSignupForm.tsx");
  const emailField = form.slice(
    form.indexOf('<label className={styles.field} htmlFor="newsletter-preview-email">'),
    form.indexOf("</label>", form.indexOf('id="newsletter-preview-email"')),
  );
  const provinceField = form.slice(
    form.indexOf('<label className={styles.field} htmlFor="newsletter-preview-province">'),
    form.indexOf("</label>", form.indexOf('id="newsletter-preview-province"')),
  );
  const selector = provinceField.indexOf('id="newsletter-preview-province"');
  const selectorEnd = provinceField.indexOf("</select>");
  const helper = provinceField.indexOf('id="newsletter-province-help"');

  assert.doesNotMatch(emailField, /newsletter-province-help|newsletter-email-help/);
  assert.match(
    provinceField,
    /aria-describedby=\{\[\s*"newsletter-province-help",[\s\S]*"newsletter-province-error"/,
  );
  assert.ok(selector > -1 && selector < selectorEnd && selectorEnd < helper);
  assert.equal(
    form.split('id="newsletter-province-help"').length - 1,
    1,
  );
});

test("la landing usa navegación simplificada sin modificar la cabecera global", () => {
  const shell = source("components/newsletter/NewsletterPreviewShell.tsx");
  const globalHeader = source("components/public/concept/ConceptStaticHeader.tsx");

  assert.match(shell, /<span>LA AGENDA MOTOR<\/span>/);
  assert.doesNotMatch(shell, /ConceptStaticHeader|PublicNavigationMenu|Publicar|Menú/);
  assert.match(globalHeader, /<PublicNavigationMenu \/>/);
  assert.match(globalHeader, />\s*Publicar\s*</);
});

test("el flujo móvil sólo muestra propuesta y formulario con objetivos táctiles", () => {
  const css = source("components/newsletter/NewsletterPreview.module.css");
  const mobile = css.slice(
    css.indexOf("@media (max-width: 640px)"),
    css.indexOf("@media (min-width: 901px)"),
  );

  assert.match(mobile, /\.desktopPreviewContent\s*\{\s*display:\s*none/);
  assert.match(mobile, /\.taskHeaderInner\s*\{[\s\S]*?min-height:\s*58px/);
  assert.match(mobile, /\.page \.heroGrid\s*\{[\s\S]*?width:\s*calc\(100% - 32px\)/);
  assert.match(mobile, /\.page \.heroCopy h1\s*\{[\s\S]*?font-size:\s*32px/);
  assert.match(mobile, /\.formGrid\s*\{[\s\S]*?gap:\s*14px/);
  assert.match(mobile, /\.consentField\s*\{[\s\S]*?min-height:\s*44px/);
  assert.match(mobile, /\.field input,[\s\S]*?height:\s*48px/);
  assert.match(mobile, /\.primaryButton\s*\{[\s\S]*?min-height:\s*48px/);
  assert.match(mobile, /\.microcopy\s*\{[\s\S]*?font-size:\s*14px/);
  assert.match(mobile, /\.landingFooter\s*\{[\s\S]*?font-size:\s*14px/);
  assert.match(css, /overflow-x:\s*clip/);
  assert.match(css, /focus-visible/);
});
