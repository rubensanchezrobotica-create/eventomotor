import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const shell = source("components/redesign-v2/site/V2InteriorShell.tsx");
const navigation = source("components/redesign-v2/site/preview-navigation.ts");
const styles = source("app/legal-document.module.css");
const sitemap = source("app/sitemap.ts");

function digestBetween(content: string, first: string, last: string) {
  const start = content.indexOf(first);
  const end = content.indexOf(last, start);
  assert.ok(start >= 0 && end > start, `Missing content boundary: ${first}`);
  return createHash("sha256").update(content.slice(start, end).replace(/\r\n/g, "\n")).digest("hex");
}

const routes = [
  { path: "privacidad", title: "Política de privacidad", description: "Información sobre el tratamiento de datos personales en EventoMotor y La Agenda Motor." },
  { path: "aviso-legal", title: "Aviso legal", description: "Aviso legal e información general de EventoMotor." },
  { path: "cookies", title: "Política de cookies", description: "Información sobre cookies necesarias, cookies analíticas y configuración del consentimiento en EventoMotor." },
] as const;

test("las tres páginas legales conservan rutas, SEO y un único h1 semántico del shell público V2", () => {
  assert.equal((shell.match(/<h1\b/g) ?? []).length, 1);
  for (const { path, title, description } of routes) {
    const page = source(`app/${path}/page.tsx`);
    assert.match(page, new RegExp(`title: "${title}"`));
    assert.ok(page.includes(description));
    assert.ok(page.includes(`canonical: \`\${SITE_URL}/${path}\``));
    assert.match(sitemap, new RegExp(`sitemapEntry\\("/${path}"`));
    assert.match(page, /<V2InteriorShell/);
    assert.match(page, /navigationMode="public"/);
    assert.match(page, /heroTitleFontClassName=\{redesignV2DisplayPilot\.variable\}/);
    assert.equal((page.match(/<h1\b/g) ?? []).length, 0);
    assert.doesNotMatch(page, /ConceptStyles|ConceptStaticHeader|ConceptFooter|robots:/);
  }
  assert.match(navigation, /mobile: \[[^\]]*"publish", "contact"\]/);
  assert.doesNotMatch(navigation.match(/public: \{[\s\S]*?\},\n\}/)?.[0] ?? "", /desktop: \[[^\]]*"contact"/);
  for (const id of ["legal", "privacy", "cookies", "contact"]) {
    assert.match(shell, new RegExp(`navigationId="${id}"`));
  }
});

test("el contenido legal de privacidad y aviso conserva su markup y enlaces byte a byte", () => {
  const privacy = source("app/privacidad/page.tsx");
  const notice = source("app/aviso-legal/page.tsx");
  assert.equal(
    digestBetween(privacy, "              <section>", "          </article>"),
    "e495a2da9fd922ebeea50ea22ae49e4a015fe77cabdbe2765d8f395a1e73b352",
  );
  assert.equal(
    digestBetween(notice, "              <section>", "          </article>"),
    "d118e12b294ea79bd5b600d843242184a07b5015df105f14ce8dabd0601627c0",
  );
  assert.match(privacy, /description="Última actualización: 29 de julio de 2026\."/);
  assert.match(notice, /description="Información general sobre el uso de EventoMotor y la naturaleza informativa del calendario de eventos\."/);
});

test("cookies mantiene su texto, categorías y apertura del panel existente", () => {
  const cookies = source("app/cookies/page.tsx");
  const settings = source("components/cookies/CookieSettingsButton.tsx");
  assert.equal(
    digestBetween(cookies, "const cookieSections = [", "];"),
    "355103ab9a4db394ae2f0b7db85e6015ce0be7ce8072d3c6cc70f98cb890b8a1",
  );
  assert.match(cookies, /description="Aquí puedes consultar qué categorías de cookies usa EventoMotor y cómo cambiar o retirar tu consentimiento\."/);
  assert.match(cookies, /Puedes cambiar tu elección en cualquier momento desde el enlace “Configurar cookies” del pie de página\./);
  assert.match(cookies, /<h2>Uso de cookies<\/h2>/);
  assert.match(cookies, /<h3>\{section\.title\}<\/h3>[\s\S]*?<p>\{section\.text\}<\/p>/);
  assert.match(shell, /<CookieSettingsButton \/>/);
  assert.match(settings, /type="button" onClick=\{openCookieSettings\}/);
});

test("el documento comparte lectura estrecha, jerarquía calmada y foco visible", () => {
  assert.match(styles, /width: min\(800px, calc\(100% - 48px\)\)/);
  assert.match(styles, /\.legalPage \.document h2/);
  assert.match(styles, /\.legalPage \.document h3/);
  assert.match(styles, /\.legalPage \.document p,[\s\S]*?line-height: 1\.72/);
  assert.match(styles, /\.legalPage \.document a:focus-visible/);
  assert.match(styles, /overflow-wrap: anywhere/);
  assert.match(styles, /@media \(max-width: 768px\)/);
});
