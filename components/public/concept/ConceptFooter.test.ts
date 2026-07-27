import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ZonasPage from "@/app/zonas/page";
import ConceptFooter, { PUBLIC_FOOTER_COLUMNS } from "@/components/public/concept/ConceptFooter";
import { SEO_COMMUNITIES } from "@/lib/seo-communities";
import { SEO_ZONES } from "@/lib/seo-taxonomy";

const workspace = process.cwd();
const communityPages = Object.values(SEO_COMMUNITIES);

function footerMarkup(variant: "default" | "compact" = "default") {
  return renderToStaticMarkup(createElement(ConceptFooter, { variant }));
}

function footerHrefs(markup: string) {
  return [...markup.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
}

test("el footer público usa seis grupos equilibrados y solo las macrozonas", () => {
  const markup = footerMarkup();
  const zoneColumn = PUBLIC_FOOTER_COLUMNS.find((column) => column.id === "zones");

  assert.deepEqual(PUBLIC_FOOTER_COLUMNS.map((column) => column.title), [
    "Calendario",
    "Rallies y competición",
    "Motos y encuentros",
    "Zonas",
    "Organizadores",
    "Legal",
  ]);
  assert.deepEqual(PUBLIC_FOOTER_COLUMNS.map((column) => column.links.length), [3, 5, 5, 7, 2, 3]);
  assert.deepEqual(zoneColumn?.links, [
    { label: "Todas las zonas", href: "/zonas" },
    ...SEO_ZONES.map((zone) => ({ label: zone.title, href: `/zonas/${zone.slug}` })),
  ]);
  assert.match(markup, /Todas las zonas/);
  for (const zone of SEO_ZONES) {
    assert.match(markup, new RegExp(`href="/zonas/${zone.slug}"`));
  }
  for (const community of communityPages) {
    assert.doesNotMatch(markup, new RegExp(`href="/${community.landingSlug}"`));
  }
  assert.doesNotMatch(markup, /eventos-motor-(barcelona|valencia)/);
});

test("el footer conserva destinos públicos, copyright y navegación segura", () => {
  const markup = footerMarkup();
  const hrefs = footerHrefs(markup);
  const currentYear = new Date().getFullYear();

  assert.equal(hrefs.length, 26);
  assert.ok(hrefs.includes("/#calendario"));
  assert.ok(hrefs.includes("/mis-eventos"));
  assert.ok(hrefs.includes("/publicar-evento"));
  assert.ok(hrefs.includes("/contacto"));
  assert.ok(hrefs.includes("/zonas"));
  assert.ok(!hrefs.some((href) => href.startsWith("/preview/")));
  assert.ok(!hrefs.includes("/calendario"));
  assert.match(
    markup,
    new RegExp(`© ${currentYear} EventoMotor\\. Todos los derechos reservados\\.`),
  );
  assert.match(markup, /aria-label="Enlaces de pie de página"/);
});

test("las variantes desktop y compacta conservan todos los grupos y enlaces", () => {
  const defaultMarkup = footerMarkup();
  const compactMarkup = footerMarkup("compact");

  assert.deepEqual(footerHrefs(compactMarkup), footerHrefs(defaultMarkup));
  for (const column of PUBLIC_FOOTER_COLUMNS) {
    assert.match(defaultMarkup, new RegExp(`emc-footer-column-${column.id}`));
    assert.match(compactMarkup, new RegExp(`emc-footer-column-${column.id}`));
  }
});

test("/zonas descubre todas las comunidades y conserva las páginas territoriales", () => {
  const markup = renderToStaticMarkup(createElement(ZonasPage));

  for (const community of communityPages) {
    const href = `/${community.landingSlug}`;
    assert.match(markup, new RegExp(`href="${href}"`));
    assert.equal(
      existsSync(path.join(workspace, "app", community.landingSlug, "page.tsx")),
      true,
      `Falta la página territorial ${href}`,
    );
  }
  for (const zone of SEO_ZONES) {
    assert.match(markup, new RegExp(`href="/zonas/${zone.slug}"`));
  }
  assert.match(markup, /aria-label="Eventos de motor por comunidad"/);
});

test("el cambio de footer no depende de Supabase ni altera sitemap o canonical", () => {
  const footerSource = readFileSync(
    path.join(workspace, "components/public/concept/ConceptFooter.tsx"),
    "utf8",
  );
  const zonesSource = readFileSync(path.join(workspace, "app/zonas/page.tsx"), "utf8");
  const zonePageSource = readFileSync(path.join(workspace, "app/zonas/[slug]/page.tsx"), "utf8");
  const sitemapSource = readFileSync(path.join(workspace, "app/sitemap.ts"), "utf8");

  assert.doesNotMatch(`${footerSource}\n${zonesSource}`, /supabase/i);
  assert.match(zonesSource, /canonical: `\$\{SITE_URL\}\/zonas`/);
  assert.match(zonePageSource, /const canonical = `\$\{SITE_URL\}\/zonas\/\$\{zone\.slug\}`/);
  assert.match(sitemapSource, /OPPORTUNITY_PAGES/);
  assert.match(sitemapSource, /SEO_ZONES/);
});
