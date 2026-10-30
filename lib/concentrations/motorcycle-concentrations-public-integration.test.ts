import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { buildOpportunityMetadata, getOpportunityPage } from "@/lib/opportunity-pages";

const root = process.cwd();
const source = (path: string) => readFileSync(resolve(root, path), "utf8");

test("metadata y contenido SEO conservan exactamente el contrato público", () => {
  const page = getOpportunityPage("concentraciones-moteras-2026");
  assert.ok(page);
  assert.equal(page.h1, "Concentraciones moteras 2026");
  assert.equal(
    page.title,
    "Concentraciones moteras 2026 | Calendario, motoalmuerzos y matinales | EventoMotor",
  );
  assert.equal(
    page.description,
    "Consulta el calendario de concentraciones moteras 2026 en España: motoalmuerzos, matinales, quedadas y eventos de motos por fecha, provincia y fuente oficial.",
  );
  const metadata = buildOpportunityMetadata(page);
  assert.deepEqual(metadata.title, { absolute: page.title });
  assert.equal(metadata.description, page.description);
  assert.deepEqual(metadata.alternates, {
    canonical: "https://www.eventomotor.com/concentraciones-moteras-2026",
  });
  assert.equal(page.faqs.length, 5);
});

test("la ruta usa searchParams como API request-time y abandona OpportunityPage", () => {
  const route = source("app/concentraciones-moteras-2026/page.tsx");
  assert.match(route, /searchParams:\s*Promise<Record<string, string \| string\[\] \| undefined>>/);
  assert.match(route, /PublicMotorcycleConcentrationsLanding/);
  assert.match(route, /year=\{2026\}/);
  assert.doesNotMatch(route, /OpportunityPage from/);
  assert.doesNotMatch(route, /force-dynamic|revalidate\s*=|generateStaticParams/);
});

test("el HTML server se construye con datos visibles, fecha de servidor y schemas del mismo modelo", () => {
  const publicLanding = source("components/concentrations/PublicMotorcycleConcentrationsLanding.tsx");
  assert.match(publicLanding, /Promise\.all\(\[getVisibleEvents\(\), searchParams\]\)/);
  assert.match(publicLanding, /buildMotorcycleConcentrationsModel/);
  assert.match(publicLanding, /new Date\(\)/);
  for (const schema of ["BreadcrumbList", "CollectionPage", "FAQPage", "ItemList"]) {
    assert.match(publicLanding, new RegExp(schema));
  }
  assert.match(publicLanding, /model\.upcomingEvents\.slice\(0, 20\)/);
  assert.match(publicLanding, /model\.upcomingTotal > 0/);
  assert.match(publicLanding, /buildMotorcycleConcentrationsModel\([\s\S]*?year,/);
  assert.match(publicLanding, /parseMotorcycleLandingQuery\(queryParams, year\)/);
});

test("la landing comparte finder y tarjetas regionales sin filtro Tipo ni bifurcación cliente", () => {
  const landing = source("components/concentrations/MotorcycleConcentrationsLanding.tsx");
  const regional = source("components/regions/RegionalLanding.tsx");
  assert.match(landing, /PublicListingFinder/);
  assert.match(regional, /PublicListingFinder/);
  assert.match(landing, /RegionalEventCard/);
  assert.match(landing, /MOTORCYCLE_MOBILE_LIMIT/);
  assert.match(landing, /MOTORCYCLE_DESKTOP_LIMIT/);
  assert.match(landing, /data-listing=\{listingId\}/);
  assert.match(landing, /data-motorcycle-concentrations/);
  assert.match(landing, /Calendario \{model\.year\}/);
  assert.match(landing, /Archivo \{model\.year\}/);
  assert.match(landing, /Guía motera \{model\.year\}/);
  assert.match(landing, /concentraciones_moteras_\$\{model\.year\}/);
  assert.doesNotMatch(landing, /name="type"|name="vehicle"|Más filtros/);
  assert.doesNotMatch(landing, /useSearchParams|useState|window\./);
});

test("filtros, archivo, CTA, acceso de fin de semana y zonas son enlaces SSR configurables", () => {
  const landing = source("components/concentrations/MotorcycleConcentrationsLanding.tsx");
  assert.match(landing, /method="get"|PublicListingFinder/);
  assert.match(landing, /\/concentraciones-moteras-este-fin-de-semana/);
  assert.match(landing, /model\.monthCounts\.map/);
  assert.match(landing, /model\.territories\.map/);
  assert.match(landing, /RegionalTrackedDetails/);
  assert.match(landing, /¿Organizas una concentración motera\? Publica tu evento en EventoMotor\./);
});

test("los breakpoints regionales siguen cubriendo finder, móvil y escritorio", () => {
  const css = source("components/regions/RegionalLanding.module.css");
  assert.match(css, /@media \(max-width: 1023px\)/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /@media \(min-width: 768px\)/);
  assert.match(css, /\.mobileInitialHidden/);
  assert.match(css, /\.eventGrid/);
  assert.match(css, /\.page\[data-motorcycle-concentrations\] \.hero h1/);
  assert.match(css, /\.page\[data-motorcycle-concentrations\] \.quickLinks/);
});

test("compatibilidad anual sin publicar la ruta 2027 ni cambiar rutas vecinas", () => {
  const analytics = source("components/concentrations/MotorcycleConcentrationsAnalytics.tsx");
  assert.match(analytics, /concentraciones_moteras_\$\{year\}/);
  assert.match(analytics, /\[year\]/);
  assert.match(source("app/motoalmuerzos-2026/page.tsx"), /motoalmuerzos-2026/);
  assert.match(source("app/concentraciones-moteras-este-fin-de-semana/page.tsx"), /concentraciones-moteras-este-fin-de-semana/);
  assert.equal(existsSync(resolve(root, "app/concentraciones-moteras-2027/page.tsx")), false);
});
