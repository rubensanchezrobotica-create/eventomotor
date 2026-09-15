import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const page = readFileSync(join(process.cwd(), "app/mis-eventos/page.tsx"), "utf8");

test("mis eventos congela título, descripción, canonical y noindex follow", () => {
  assert.match(page, /title:\s*"Mis eventos guardados"/);
  assert.match(
    page,
    /description:\s*"Consulta los eventos de motor que has guardado en este dispositivo\."/,
  );
  assert.match(page, /canonical:\s*`\$\{SITE_URL\}\/mis-eventos`/);
  assert.match(page, /robots:\s*\{[\s\S]*?index:\s*false,[\s\S]*?follow:\s*true/);
});

test("mis eventos reutiliza el shell público V2 con el hero aprobado", () => {
  assert.match(page, /import V2InteriorShell/);
  assert.match(page, /navigationMode="public"/);
  assert.match(page, /currentNavigationId="favorites"/);
  assert.match(page, /eyebrow="Tu agenda"/);
  assert.match(page, /title="Mis eventos"/);
  assert.match(
    page,
    /description="Tus eventos guardados en este dispositivo, reunidos para volver a ellos rápidamente\. No necesitas una cuenta\."/,
  );
  assert.doesNotMatch(page, /ConceptStyles|ConceptStaticHeader|ConceptFooter/);
});

test("mis eventos sigue fuera del sitemap y no publica datos estructurados personales", () => {
  const workspace = process.cwd();
  const sitemap = readFileSync(join(workspace, "app/sitemap.ts"), "utf8");

  assert.doesNotMatch(sitemap, /sitemapEntry\("\/mis-eventos"/);
  assert.doesNotMatch(page, /application\/ld\+json|generateMetadata|SavedEvent/);
});
