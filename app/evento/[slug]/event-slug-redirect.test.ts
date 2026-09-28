import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const seo = readFileSync(new URL("../../../lib/event-page-seo.ts", import.meta.url), "utf8");
const schema = readFileSync(new URL("../../../database/schema.sql", import.meta.url), "utf8");
const slugMigration = readFileSync(
  new URL("../../../database/migrations/add-event-slug.sql", import.meta.url),
  "utf8",
);

function sourceBetween(source: string, start: string, end: string) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex);

  assert.notEqual(startIndex, -1, `No se encontró el inicio: ${start}`);
  assert.notEqual(endIndex, -1, `No se encontró el final: ${end}`);

  return source.slice(startIndex, endIndex);
}

test("la ficha aplica redirect permanente en servidor antes del 404", () => {
  assert.match(page, /permanentRedirect\(redirectHref\)/);
  assert.match(page, /eventSlugRedirectHref\(slug, await searchParams\)/);
  assert.ok(page.indexOf("permanentRedirect(redirectHref)") < page.indexOf("notFound();"));
});

test("canonical, Open Graph y JSON-LD se construyen con el slug almacenado", () => {
  assert.match(seo, /event\.slug \|\| requestedSlug/);
  assert.match(seo, /alternates: \{ canonical: url \}/);
  assert.match(seo, /openGraph: \{[\s\S]*?\n\s+url,/);
  assert.match(seo, /url,\s+mainEntityOfPage: url,/);
});

test("un evento visible válido se consulta por slug exacto y se mapea", () => {
  const lookup = sourceBetween(
    page,
    "async function getEventBySlug",
    "function absoluteImageUrl",
  );

  assert.match(lookup, /\.eq\("slug", slug\)/);
  assert.match(lookup, /\.eq\("visible", true\)/);
  assert.match(lookup, /\.select\(EVENT_DETAIL_SELECT\)/);
  assert.match(lookup, /\.maybeSingle\(\)/);
  assert.match(lookup, /return mapEventRowToEventItem\(data as unknown as EventRow\);/);
  assert.doesNotMatch(lookup, /\.select\("\*"\)/);
});

test("un evento inexistente devuelve ausencia y conserva notFound", () => {
  const lookup = sourceBetween(
    page,
    "async function getEventBySlug",
    "function absoluteImageUrl",
  );
  const route = sourceBetween(
    page,
    "export default async function EventPage",
    "const siteUrl = getSiteUrl()",
  );

  assert.match(lookup, /if \(error \|\| !data\) return null;/);
  assert.match(route, /if \(!event\) notFound\(\);/);
});

test("un evento no visible queda fuera de la consulta dirigida", () => {
  const lookup = sourceBetween(
    page,
    "async function getEventBySlug",
    "function absoluteImageUrl",
  );

  assert.match(lookup, /\.eq\("visible", true\)/);
  assert.match(lookup, /if \(error \|\| !data\) return null;/);
});

test("la resolución no depende de cargar las primeras 1.000 filas", () => {
  const lookup = sourceBetween(
    page,
    "async function getEventBySlug",
    "function absoluteImageUrl",
  );
  const route = sourceBetween(
    page,
    "export default async function EventPage",
    "const siteUrl = getSiteUrl()",
  );

  assert.doesNotMatch(lookup, /getVisibleEvents\(\)/);
  assert.doesNotMatch(lookup, /\.find\(/);
  assert.match(route, /getEventBySlug\(slug\)/);
  assert.doesNotMatch(route, /events\.find\(/);
});

test("maybeSingle está respaldado por unicidad real de events.slug", () => {
  assert.match(schema, /slug text unique/i);
  assert.match(slugMigration, /create unique index if not exists events_slug_key/i);
});
