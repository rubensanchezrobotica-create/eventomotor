import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { OPPORTUNITY_PAGES } from "@/lib/opportunity-pages";
import {
  canonicalPublicHref,
  DIRECTORY_ROUTES,
  getPublicNavigationSection,
  HOME_SECTION_IDS,
  HOME_SECTION_LINKS,
  PRIMARY_NAVIGATION_ITEMS,
  PUBLIC_ROUTES,
} from "@/lib/public-navigation";

const workspace = process.cwd();

function source(path: string) {
  return readFileSync(join(workspace, path), "utf8");
}

test("separates primary home sections from public directory routes", () => {
  assert.deepEqual(HOME_SECTION_IDS, {
    calendar: "calendario",
    disciplines: "disciplinas",
    zones: "zonas",
  });
  assert.deepEqual(HOME_SECTION_LINKS, {
    calendar: "/#calendario",
    disciplines: "/#disciplinas",
    zones: "/#zonas",
  });
  assert.deepEqual(DIRECTORY_ROUTES, {
    disciplines: "/disciplinas",
    zones: "/zonas",
  });
  assert.equal(PUBLIC_ROUTES.home, "/");
  assert.equal(PUBLIC_ROUTES.contact, "/contacto");
  assert.equal(PUBLIC_ROUTES.savedEvents, "/mis-eventos");
  assert.equal(PUBLIC_ROUTES.publish, "/publicar-evento");
});

test("preserves query strings and hashes when canonicalizing old calendar links", () => {
  assert.equal(canonicalPublicHref("/calendario"), "/#calendario");
  assert.equal(canonicalPublicHref("/calendario?zona=norte&vista=mapa"), "/?zona=norte&vista=mapa#calendario");
  assert.equal(canonicalPublicHref("/calendario#calendario"), "/#calendario");
  assert.equal(canonicalPublicHref("/contacto"), "/contacto");
});

test("marks public sections active without matching labels", () => {
  assert.equal(getPublicNavigationSection("/"), null);
  assert.equal(getPublicNavigationSection("/evento/boiromotos-2026"), "calendar");
  assert.equal(getPublicNavigationSection("/evento/rpm-fest-2026"), "calendar");
  assert.equal(getPublicNavigationSection("/disciplinas/rallyes"), "disciplines");
  assert.equal(getPublicNavigationSection("/rallyes-espana-2026"), "disciplines");
  assert.equal(getPublicNavigationSection("/zonas/norte"), "zones");
  assert.equal(getPublicNavigationSection("/eventos-motor-galicia"), "zones");
  assert.equal(getPublicNavigationSection("/contacto"), "contact");
  assert.equal(getPublicNavigationSection("/mis-eventos"), "savedEvents");
  assert.equal(getPublicNavigationSection("/publicar-evento"), "publish");
});

test("desktop and mobile menus consume the same destinations and expose aria-current", () => {
  const menu = source("components/public/concept/PublicNavigationMenu.tsx");
  const staticHeader = source("components/public/concept/ConceptStaticHeader.tsx");
  const homeHeader = source("components/public/concept/ConceptHeader.tsx");

  assert.match(menu, /PRIMARY_NAVIGATION_ITEMS\.map/);
  assert.match(menu, /aria-current=/);
  assert.match(menu, /aria-expanded=/);
  assert.match(menu, /setMobileOpen\(false\)/);
  assert.match(menu, /onNavigate=\{\(\) => setMobileOpen\(false\)\}/);
  assert.match(menu, /Navegación móvil/);
  assert.match(staticHeader, /<PublicNavigationMenu \/>/);
  assert.match(homeHeader, /<PublicNavigationMenu \/>/);
  const primaryHrefs: readonly string[] = PRIMARY_NAVIGATION_ITEMS.map(({ href }) => href);
  assert.deepEqual(
    primaryHrefs,
    ["/#calendario", "/#disciplinas", "/#zonas", "/contacto", "/mis-eventos"],
  );
  assert.ok(!primaryHrefs.includes(DIRECTORY_ROUTES.disciplines));
  assert.ok(!primaryHrefs.includes(DIRECTORY_ROUTES.zones));
});

test("event details for Boiromotos and RPM FEST inherit the canonical static header", () => {
  const eventPage = source("app/evento/[slug]/page.tsx");
  const eventView = source("components/events/detail/EventDetailView.tsx");
  const staticHeader = source("components/public/concept/ConceptStaticHeader.tsx");

  assert.match(eventPage, /<EventDetailView/);
  assert.match(eventView, /<ConceptStaticHeader \/>/);
  assert.match(eventView, /PUBLIC_NAVIGATION\.calendar/);
  assert.doesNotMatch(eventView, /href="\/calendario"/);
  assert.match(staticHeader, /href=\{PUBLIC_NAVIGATION\.calendar\}/);
});

test("logo, agenda, disciplines, zones, contact, saved events and publish stay canonical", () => {
  const staticHeader = source("components/public/concept/ConceptStaticHeader.tsx");
  const homeHeader = source("components/public/concept/ConceptHeader.tsx");
  const footer = source("components/public/concept/ConceptFooter.tsx");

  assert.match(staticHeader, /href=\{PUBLIC_NAVIGATION\.home\}/);
  assert.match(staticHeader, /href=\{PUBLIC_NAVIGATION\.calendar\}>\s*Ver agenda/);
  assert.match(staticHeader, /href=\{PUBLIC_NAVIGATION\.publish\}/);
  assert.match(homeHeader, /href=\{PUBLIC_NAVIGATION\.home\}/);
  assert.match(homeHeader, /href=\{PUBLIC_NAVIGATION\.publish\}/);
  assert.match(footer, /href: PUBLIC_NAVIGATION\.calendar/);
});

test("home anchors exist and reserve space below the fixed header", () => {
  const calendar = source("components/public/concept/ConceptEventExplorer.tsx");
  const disciplines = source("components/public/concept/ConceptDisciplineExplorer.tsx");
  const zones = source("components/public/concept/ConceptZoneExplorer.tsx");
  const styles = source("components/public/concept/ConceptStyles.tsx");

  assert.match(calendar, /id="calendario"/);
  assert.match(disciplines, /id="disciplinas"/);
  assert.match(zones, /id="zonas"/);
  assert.match(styles, /#calendario, #disciplinas, #zonas \{ scroll-margin-top: 118px; \}/);
  assert.match(styles, /#calendario, #disciplinas, #zonas \{ scroll-margin-top: 92px; \}/);
});

test("contact returns to the home calendar section", () => {
  const contactPage = source("app/contacto/page.tsx");
  assert.match(contactPage, /href=\{HOME_SECTION_LINKS\.calendar\}/);
});

test("active public components do not hardcode obsolete calendar hrefs or preview destinations", () => {
  const activeNavigationFiles = [
    "components/public/concept/ConceptHeader.tsx",
    "components/public/concept/ConceptStaticHeader.tsx",
    "components/public/concept/ConceptFooter.tsx",
    "components/events/detail/EventDetailView.tsx",
    "components/events/MyEventsClient.tsx",
    "components/public/seo/OpportunityPage.tsx",
    "components/disciplines/DisciplinePreviewPage.tsx",
    "components/zones/ZonePreviewPage.tsx",
    "components/preview/weekend/WeekendPreviewPage.tsx",
    "app/publicar-evento/page.tsx",
  ];

  for (const file of activeNavigationFiles) {
    const contents = source(file);
    assert.doesNotMatch(contents, /href=(?:\{)?["']\/calendario/, file);
    assert.doesNotMatch(contents, /href=(?:\{)?["']\/preview\//, file);
  }
});

test("all exported opportunity-page links resolve away from the legacy calendar", () => {
  for (const page of OPPORTUNITY_PAGES) {
    for (const link of page.relatedLinks) {
      assert.notEqual(link.href, "/calendario", `${page.slug}: ${link.label}`);
      assert.ok(!link.href.startsWith("/preview/"), `${page.slug}: ${link.label}`);
    }
    for (const highlight of page.regionalHub?.highlights || []) {
      assert.notEqual(highlight.href, "/calendario", `${page.slug}: ${highlight.label}`);
      assert.ok(!highlight.href.startsWith("/preview/"), `${page.slug}: ${highlight.label}`);
    }
  }
});

test("calendar is a permanent redirect to the final canonical route with no chain", () => {
  const calendarPage = source("app/calendario/page.tsx");
  const nextConfig = source("next.config.ts");
  const legacyRedirects = source("lib/legacy-redirects.ts");

  assert.match(calendarPage, /permanentRedirect\(PUBLIC_NAVIGATION\.calendar\)/);
  assert.match(nextConfig, /legacyRedirect\("\/calendario", PUBLIC_NAVIGATION\.calendar\)/);
  assert.doesNotMatch(nextConfig, /legacyRedirect\([^,\n]+,\s*"\/calendario"\)/);
  assert.doesNotMatch(legacyRedirects, /\|\| "\/calendario"/);
});

test("canonical destinations exist and sitemap only indexes the canonical calendar experience", () => {
  for (const path of [
    "app/page.tsx",
    "app/disciplinas/page.tsx",
    "app/zonas/page.tsx",
    "app/contacto/page.tsx",
    "app/mis-eventos/page.tsx",
    "app/publicar-evento/page.tsx",
  ]) {
    assert.ok(statSync(join(workspace, path)).isFile(), path);
  }

  const homePage = source("app/page.tsx");
  const sitemap = source("app/sitemap.ts");
  const robots = source("app/robots.ts");

  assert.match(homePage, /canonical: SITE_URL/);
  assert.doesNotMatch(sitemap, /sitemapEntry\("\/calendario"/);
  assert.match(sitemap, /sitemapEntry\("\/"/);
  assert.match(robots, /sitemap: `\$\{SITE_URL\}\/sitemap\.xml`/);
});
