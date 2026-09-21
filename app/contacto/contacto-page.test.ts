import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const page = source("app/contacto/page.tsx");
const content = source("components/redesign-v2/contact/ContactV2.tsx");
const styles = source("components/redesign-v2/contact/ContactV2.module.css");
const shell = source("components/redesign-v2/site/V2InteriorShell.tsx");
const navigation = source("components/redesign-v2/site/preview-navigation.ts");
const sitemap = source("app/sitemap.ts");

test("contacto público usa el shell V2 sin modificar URL ni navegación principal", () => {
  assert.match(page, /<V2InteriorShell/);
  assert.match(page, /navigationMode="public"/);
  assert.match(page, /currentNavigationId="contact"/);
  assert.match(page, /heroTitleFontClassName=\{redesignV2DisplayPilot\.variable\}/);
  assert.doesNotMatch(page, /ConceptStyles|ConceptStaticHeader|ConceptFooter/);
  assert.doesNotMatch(navigation.match(/public: \{[\s\S]*?\},\n\}/)?.[0] ?? "", /desktop: \[[^\]]*"contact"/);
  assert.match(navigation, /mobile: \[[^\]]*"publish", "contact"\]/);
  assert.match(navigation, /publish: \{[^\n]*variant: "primary"/);
  assert.match(shell, /<PreviewAwareLink mode=\{navigationMode\} navigationId="contact" \/>/);
  assert.doesNotMatch(page + styles, /\/preview\/redesign-v2/);
});

test("contacto presenta el correo, cuatro interacciones analíticas y los tres motivos sin formulario", () => {
  assert.match(content, /const CONTACT_EMAIL = "info@eventomotor\.com"/);
  assert.match(content, /const GENERAL_EMAIL_HREF = `mailto:\$\{CONTACT_EMAIL\}\?subject=Contacto%20EventoMotor`/);
  assert.equal((content.match(/href=\{GENERAL_EMAIL_HREF\}/g) ?? []).length, 2);
  assert.equal((content.match(/href="\/publicar-evento"/g) ?? []).length, 2);
  assert.doesNotMatch(content, /Volver al calendario|HOME_SECTION_LINKS|calendarLink/);
  assert.match(content, /Corregir un evento/);
  assert.match(content, /Publicar un evento/);
  assert.match(content, /Colaboraciones/);
  assert.doesNotMatch(content + page, /<form|<button|type="submit"|mensaje enviado/i);
  assert.doesNotMatch(content + page, /\/preview\//);
  for (const location of ["contact_page_cta", "contact_page_card", "contact_reason_correction", "contact_reason_collaboration"]) {
    assert.match(content, new RegExp(`location: "${location}"`));
  }
  assert.equal((content.match(/eventName="click_contact_email"/g) ?? []).length, 4);
  assert.match(content, /subject=Correcci%C3%B3n%20de%20evento/);
  assert.match(content, /subject=Colaboraci%C3%B3n%20con%20EventoMotor/);
});

test("contacto mantiene metadata, robots heredados y sitemap públicos", () => {
  assert.match(page, /title: "Contacto y publicación de eventos"/);
  assert.match(page, /description:\s*"Contacta con EventoMotor para corregir o publicar eventos de motor, proponer colaboraciones o enviarnos información\."/);
  assert.match(page, /canonical: `\$\{SITE_URL\}\/contacto`/);
  assert.doesNotMatch(page, /robots:/);
  assert.match(sitemap, /sitemapEntry\("\/contacto", now, "monthly", 0\.6\)/);
  assert.match(styles, /\.pageScope :global\(#redesign-v2-interior-title\),[\s\S]*?font-family: var\(--font-v2-display-pilot\)/);
  assert.match(styles, /padding: clamp\(32px, 4\.4vw, 56px\) 0 clamp\(56px, 6\.2vw, 80px\)/);
  assert.match(styles, /\.reasonsSection \{ margin-top: clamp\(42px, 5\.3vw, 64px\); \}/);
  assert.doesNotMatch(styles, /\.calendarLink/);
});
