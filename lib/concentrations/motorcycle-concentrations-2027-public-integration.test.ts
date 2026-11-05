import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import type { EventItem } from "@/types/event";
import { buildOpportunityMetadata, getOpportunityPage } from "@/lib/opportunity-pages";
import {
  buildMotorcycleConcentrationsModel,
  filterMotorcycleConcentrations,
  parseMotorcycleLandingQuery,
} from "./motorcycle-concentrations-model";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

function event(id: string, overrides: Partial<EventItem> = {}): EventItem {
  return {
    championship: "",
    city: "Valladolid",
    discipline: "Concentración",
    end: "2027-01-13",
    featured: false,
    id,
    level: "",
    province: "Valladolid",
    region: "Castilla y León",
    source: "test",
    sourceUrl: "https://example.com/source",
    start: "2027-01-13",
    tags: [],
    ticketUrl: "",
    title: "Concentración motera 2027",
    vehicleType: "moto",
    venue: "Recinto",
    visible: true,
    ...overrides,
  };
}

test("la ruta 2027 tiene editorial y canonical propios, con indexación retenida", () => {
  const page = getOpportunityPage("concentraciones-moteras-2027");
  assert.ok(page);
  assert.equal(page.h1, "Concentraciones moteras 2027");
  assert.match(page.title, /2027/);
  assert.match(page.description, /2027/);
  assert.ok(page.faqs.some((faq) => /confirmación directa/.test(faq.question) && /No\./.test(faq.answer)));
  assert.ok(page.relatedLinks.every((link) => !/concentraciones-moteras-2026|concentraciones-moteras-2027/.test(link.href)));
  assert.deepEqual(buildOpportunityMetadata(page).alternates, {
    canonical: "https://www.eventomotor.com/concentraciones-moteras-2027",
  });

  const route = source("app/concentraciones-moteras-2027/page.tsx");
  assert.match(route, /PublicMotorcycleConcentrationsLanding/);
  assert.match(route, /year=\{2027\}/);
  assert.match(route, /robots: \{ index: false, follow: false \}/);
  const sitemap = source("app/sitemap.ts");
  assert.match(sitemap, /page\.slug !== "concentraciones-moteras-2027"/);
});

test("OpportunityPage.filter selecciona exactamente los eventos del modelo anual", () => {
  const page = getOpportunityPage("concentraciones-moteras-2027");
  assert.ok(page);
  const now = new Date("2026-11-04T12:00:00.000Z");
  const inventory = [
    event("leyenda", { title: "La Leyenda Continúa 2027", start: "2027-01-07", end: "2027-01-10" }),
    event("pinguinos", { title: "Pingüinos 2027" }),
    event("cuervo", { title: "IV Concentración Invernal El Cuervo de Sevilla 2027", sourceType: "secondary", start: "2027-01-15", end: "2027-01-17" }),
    event("pilas", { title: "5ª Concentración de Vehículos Clásicos de Pilas", vehicleType: "mixto", shortDescription: "Automóviles, camiones y motocicletas clásicas.", start: "2027-02-21", end: "2027-02-21" }),
    event("hot-rally", { title: "Hot Rally San Javier 2027", start: "2027-05-27", end: "2027-05-30" }),
    event("old-year", { start: "2026-12-31", end: "2027-01-02" }),
    event("trackday", { discipline: "Tandas", title: "Trackday de motos" }),
    event("hidden", { visible: false }),
    event("cancelled", { eventStatus: "cancelled" }),
  ];
  const model = buildMotorcycleConcentrationsModel(inventory, now, 2027);
  assert.deepEqual(inventory.filter((item) => page.filter(item, now)).map((item) => item.id), model.allEvents.map((item) => item.id));
  assert.deepEqual(model.allEvents.map((item) => item.id), ["leyenda", "pinguinos", "cuervo", "pilas", "hot-rally"]);
  assert.deepEqual(filterMotorcycleConcentrations(model, parseMotorcycleLandingQuery({ month: "2027-01" }, 2027)).map((item) => item.id), ["leyenda", "pinguinos", "cuervo"]);
  assert.equal(parseMotorcycleLandingQuery({ month: "2026-01" }, 2027).month, "");
  // EDITORIAL_INTENT_REVIEW_REQUIRED: Pilas is mixed classics, yet the shared model includes it.
  assert.ok(model.allEvents.some((item) => item.id === "pilas"));
});
