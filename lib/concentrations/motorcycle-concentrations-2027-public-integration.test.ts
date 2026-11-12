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
  assert.match(route, /eventFilter=\{page\.filter\}/);
  assert.match(route, /year=\{2027\}/);
  assert.match(route, /robots: \{ index: false, follow: false \}/);
  const sitemap = source("app/sitemap.ts");
  assert.match(sitemap, /page\.slug !== "concentraciones-moteras-2027"/);
  const publicLanding = source("components/concentrations/PublicMotorcycleConcentrationsLanding.tsx");
  assert.match(publicLanding, /eventFilter \? visibleEvents\.filter/);
  assert.match(publicLanding, /eventFilter\s*\? filterMotorcycleConcentrations\(model, query\)\s*: model\.upcomingEvents/);
  assert.match(publicLanding, /itemListElement: jsonLdEvents\.slice/);
  assert.doesNotMatch(source("app/concentraciones-moteras-2026/page.tsx"), /eventFilter=/);
});

test("Pilas queda fuera solo de la selección editorial 2027", () => {
  const page = getOpportunityPage("concentraciones-moteras-2027");
  assert.ok(page);
  const now = new Date("2026-11-04T12:00:00.000Z");
  const pilasId = "batch-l14-5-concentracion-vehiculos-clasicos-pilas-2027-02-21";
  const inventory = [
    event("leyenda", { title: "La Leyenda Continúa 2027", start: "2027-01-07", end: "2027-01-10", province: "Segovia" }),
    event("pinguinos", { title: "Pingüinos 2027" }),
    event("motauros", { title: "Motauros 2027", start: "2027-01-14", end: "2027-01-17" }),
    event("cuervo", { title: "IV Concentración Invernal El Cuervo de Sevilla 2027", sourceType: "secondary", start: "2027-01-15", end: "2027-01-17", province: "Sevilla" }),
    event("jabalinera", { title: "XIX Jabalinera 2027", start: "2027-01-22", end: "2027-01-24", province: "Cantabria" }),
    event("rota", { title: "Villa de Rota 2027", start: "2027-02-05", end: "2027-02-07", province: "Cádiz" }),
    event(pilasId, { title: "5ª Concentración de Vehículos Clásicos de Pilas", vehicleType: "mixto", shortDescription: "Automóviles, camiones y motocicletas clásicas.", start: "2027-02-21", end: "2027-02-21", province: "Sevilla" }),
    event("valadouro", { title: "Concentración de Motos Valadouro 2027", sourceType: "media", start: "2027-04-30", end: "2027-05-02", province: "Lugo" }),
    event("hot-rally", { title: "Hot Rally San Javier 2027", start: "2027-05-27", end: "2027-05-30", province: "Murcia" }),
    event("old-year", { start: "2026-12-31", end: "2027-01-02" }),
    event("trackday", { discipline: "Tandas", title: "Trackday de motos" }),
    event("hidden", { visible: false }),
    event("cancelled", { eventStatus: "cancelled" }),
  ];
  const sharedModel = buildMotorcycleConcentrationsModel(inventory, now, 2027);
  assert.ok(sharedModel.allEvents.some((item) => item.id === pilasId));
  const model = buildMotorcycleConcentrationsModel(inventory.filter((item) => page.filter(item, now)), now, 2027);
  assert.deepEqual(inventory.filter((item) => page.filter(item, now)).map((item) => item.id), model.allEvents.map((item) => item.id));
  assert.deepEqual(model.allEvents.map((item) => item.id), ["leyenda", "pinguinos", "motauros", "cuervo", "jabalinera", "rota", "valadouro", "hot-rally"]);
  assert.equal(model.upcomingTotal, 8);
  assert.deepEqual(model.monthCounts.map(({ key, count }) => [key, count]), [["2027-01", 5], ["2027-02", 1], ["2027-04", 1], ["2027-05", 1]]);
  assert.deepEqual(filterMotorcycleConcentrations(model, parseMotorcycleLandingQuery({ month: "2027-01" }, 2027)).map((item) => item.id), ["leyenda", "pinguinos", "motauros", "cuervo", "jabalinera"]);
  assert.deepEqual(filterMotorcycleConcentrations(model, parseMotorcycleLandingQuery({ month: "2027-02" }, 2027)).map((item) => item.id), ["rota"]);
  assert.deepEqual(filterMotorcycleConcentrations(model, parseMotorcycleLandingQuery({ province: "sevilla" }, 2027)).map((item) => item.id), ["cuervo"]);
  assert.equal(model.provinceCounts.find(({ key }) => key === "sevilla")?.count, 1);
  assert.equal(parseMotorcycleLandingQuery({ month: "2026-01" }, 2027).month, "");
  assert.deepEqual(buildMotorcycleConcentrationsModel(inventory, now, 2026).allEvents.map((item) => item.id), ["old-year"]);
});
