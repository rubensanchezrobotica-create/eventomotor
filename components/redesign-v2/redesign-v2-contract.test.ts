import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(new URL("../../app/preview/redesign-v2/page.tsx", import.meta.url), "utf8");
const home = readFileSync(new URL("./RedesignV2Home.tsx", import.meta.url), "utf8");
const search = readFileSync(new URL("./SearchExperience.client.tsx", import.meta.url), "utf8");
const menu = readFileSync(new URL("./MobileNavigation.client.tsx", import.meta.url), "utf8");
const model = readFileSync(new URL("./redesign-v2-model.ts", import.meta.url), "utf8");

test("la ruta conserva el límite Server Component y la consulta pública actual", () => {
  assert.doesNotMatch(route, /["']use client["']/);
  assert.match(route, /getVisibleEvents\(\)/);
  assert.match(route, /await connection\(\)/);
  assert.match(route, /isRedesignPreviewAvailable\(\)/);
  assert.match(route, /notFound\(\)/);
});

test("la metadata interna impide indexación sin crear canonical", () => {
  assert.match(route, /index:\s*false/);
  assert.match(route, /follow:\s*false/);
  assert.match(route, /noimageindex:\s*true/);
  assert.doesNotMatch(route, /canonical|alternates/);
});

test("el hero usa exactamente el recurso y API de Next 16 aprobados", () => {
  assert.match(home, /src="\/images\/redesign-v2\/hero-eventomotor\.webp"/);
  assert.match(home, /preload/);
  assert.match(home, /quality=\{75\}/);
  assert.match(home, /sizes="100vw"/);
  assert.doesNotMatch(home, /priority/);
});

test("la interactividad se limita a menú y búsqueda", () => {
  assert.doesNotMatch(home, /["']use client["']/);
  assert.match(search, /^["']use client["']/);
  assert.match(menu, /^["']use client["']/);
  assert.match(menu, /event\.key === "Escape"/);
  assert.match(menu, /buttonRef\.current\?\.focus\(\)/);
});

test("newsletter es editorial y reutiliza la entrada existente", () => {
  assert.match(home, /href="\/newsletter"/);
  assert.match(home, /newsletter-phone\.webp/);
  assert.doesNotMatch(home, /NewsletterCaptureCard|<form|subscribe|resend/i);
});

test("los enlaces de ficha y fallbacks respetan el contrato público", () => {
  assert.match(model, /`\/evento\/\$\{event\.slug \|\| event\.id\}`/);
  assert.match(model, /kind:\s*"representative"/);
  assert.match(model, /label:\s*"Imagen representativa"/);
});
