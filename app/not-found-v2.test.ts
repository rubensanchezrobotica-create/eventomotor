import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  getInteriorNavigationIds,
  resolveInteriorNavigationItem,
} from "../components/redesign-v2/site/preview-navigation";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const page = source("app/not-found.tsx");
const styles = source("app/not-found.module.css");
const shell = source("components/redesign-v2/site/V2InteriorShell.tsx");
const shellStyles = source("components/redesign-v2/site/V2PreviewShell.module.css");

test("404 usa el shell público V2 y su estado neutro sin cuenta ni navegación activa", () => {
  assert.match(page, /<V2InteriorShell/);
  assert.match(page, /navigationMode="public"/);
  assert.doesNotMatch(page, /upcomingCount=|currentNavigationId=/);
  assert.match(shell, /upcomingCount === undefined \? "La agenda nacional del motor"/);
  assert.match(shell, /aria-current=\{currentNavigationId === id \? "page" : undefined\}/);
  assert.deepEqual(getInteriorNavigationIds("public", "desktop"), ["calendar", "disciplines", "territories", "favorites"]);
  assert.deepEqual(getInteriorNavigationIds("public", "mobile"), ["calendar", "disciplines", "territories", "favorites", "publish", "contact"]);
  assert.match(shell, /<footer className=\{styles\.footer\}>/);
});

test("404 ofrece dos enlaces de recuperación públicos y ningún destino Preview", () => {
  assert.equal(resolveInteriorNavigationItem("calendar", "public").href, "/calendario");
  assert.equal(resolveInteriorNavigationItem("home", "public").href, "/");
  assert.match(page, /navigationId="calendar"[\s\S]*?Volver a la agenda/);
  assert.match(page, /navigationId="home"[\s\S]*?Ir al inicio/);
  assert.doesNotMatch(page, /\/preview\/|redirect\(|permanentRedirect\(/);
});

test("404 conserva un H1 semántico, foco visible y composición responsive sin metadata indexable propia", () => {
  assert.equal((shell.match(/<h1\b/g) ?? []).length, 1);
  assert.equal((page.match(/<h1\b/g) ?? []).length, 0);
  assert.match(page, /title="Esta página no está en la parrilla\."/);
  assert.match(page, /aria-label="Volver a explorar"/);
  assert.match(shellStyles, /:focus-visible/);
  assert.match(styles, /@media \(max-width: 760px\)/);
  assert.match(styles, /@media \(max-width: 430px\)/);
  assert.doesNotMatch(page, /canonical|application\/ld\+json|openGraph|metadata|upcomingCount/);
  assert.doesNotMatch(source("app/sitemap.ts"), /not-found|\/404/);
});

test("rutas de evento y disciplina conservan notFound para slugs no válidos", () => {
  const discipline = source("app/disciplinas/[slug]/page.tsx");
  const event = source("app/evento/[slug]/page.tsx");
  assert.match(discipline, /if \(!isDisciplineSlug\(slug\)\) notFound\(\)/);
  assert.match(event, /if \(!event\) notFound\(\)/);
  assert.ok(event.indexOf("if (!event) notFound();") < event.indexOf("const siteUrl = getSiteUrl();"));
});
