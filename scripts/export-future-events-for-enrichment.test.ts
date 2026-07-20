import assert from "node:assert/strict";
import test from "node:test";
import {
  assertReadOnlyOperations,
  calculateMissingFields,
  calculateResearchPriority,
  createResearchArtifacts,
  createResearchBatch,
  decideResearchBatchPersistence,
  evaluateExactAddress,
  evaluateOfficialSource,
  fetchAllFutureEventRows,
  findPossibleDuplicateIds,
  isFutureOrOngoing,
  normalizeDiscipline,
  normalizeProvince,
  sortEnrichmentEvents,
  type EnrichmentEvent,
  type FutureEventRepository,
  type ResearchEventRow,
} from "./export-future-events-for-enrichment";

const TODAY = "2026-07-20";

function event(overrides: Partial<ResearchEventRow> = {}): ResearchEventRow {
  return {
    id: "event-1",
    slug: "evento-prueba-2026-07-21",
    title: "Evento Prueba 2026",
    championship: "Prueba",
    discipline: "Rally",
    start_date: "2026-07-21",
    end_date: null,
    venue: "Recinto de Prueba",
    city: "Madrid",
    province: "Madrid",
    region: "Comunidad de Madrid",
    country: "ES",
    level: "Publicado",
    source: "Organizador",
    source_url: "https://example.com/evento",
    source_id: null,
    ticket_url: "https://example.com/entradas",
    official_url: "https://example.com/evento",
    registration_url: "https://example.com/inscripcion",
    image_url: "https://example.com/cartel.webp",
    image_source_url: "https://example.com/cartel",
    event_status: "confirmed",
    short_description: "Descripcion breve suficiente.",
    long_description: "Descripcion larga suficiente y verificada.",
    schedule_text: "09:00 Apertura.",
    address: "Calle Prueba 1, Madrid",
    latitude: 40.4,
    longitude: -3.7,
    organizer_name: "Organizador",
    organizer_url: "https://example.com",
    verified_at: "2026-07-10T10:00:00.000Z",
    source_type: "official",
    confidence_score: 95,
    needs_review: false,
    tags: ["rally"],
    vehicle_type: "coche",
    featured: false,
    visible: true,
    import_method: "batch_import",
    data_quality: "reviewed",
    notes: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-07-10T10:00:00.000Z",
    ...overrides,
  };
}

test("incluye un evento futuro sin end_date", () => {
  assert.equal(isFutureOrOngoing(event({ start_date: "2026-07-21", end_date: null }), TODAY), true);
});

test("incluye un evento de varios dias que sigue en curso", () => {
  assert.equal(isFutureOrOngoing(event({ start_date: "2026-07-18", end_date: "2026-07-20" }), TODAY), true);
});

test("excluye un evento ya terminado", () => {
  assert.equal(isFutureOrOngoing(event({ start_date: "2026-07-18", end_date: "2026-07-19" }), TODAY), false);
});

test("detecta campos ausentes sin inventar valores", () => {
  const incomplete = event({ official_url: null, source_type: "aggregator", registration_url: null, ticket_url: null, address: null, latitude: null, longitude: null, image_url: null });
  const missing = calculateMissingFields(incomplete, TODAY);
  assert.equal(missing.includes("official_source"), true);
  assert.equal(missing.includes("registration"), true);
  assert.equal(missing.includes("exact_address"), true);
  assert.equal(missing.includes("coordinates"), true);
  assert.equal(missing.includes("image"), true);
});

test("un agregador con URL no se considera fuente oficial", () => {
  assert.deepEqual(
    evaluateOfficialSource(event({ source_type: "aggregator", source: "TodoCircuito" })),
    { value: false, reason: "aggregator_source" },
  );
});

test("una federacion con URL se considera fuente oficial", () => {
  assert.deepEqual(
    evaluateOfficialSource(event({ source_type: "federation", source: "RFME" })),
    { value: true, reason: "primary_source_type:federation" },
  );
});

test("un organizador con URL se considera fuente oficial", () => {
  assert.deepEqual(
    evaluateOfficialSource(event({ source_type: "organizer", source: "Organizador" })),
    { value: true, reason: "primary_source_type:organizer" },
  );
});

test("una fuente desconocida con URL no se considera oficial", () => {
  assert.deepEqual(
    evaluateOfficialSource(event({ source_type: null, source: "Fuente sin clasificar" })),
    { value: false, reason: "unknown_source_type" },
  );
});

test("una direccion de ciudad provincia y pais no es exacta", () => {
  assert.deepEqual(
    evaluateExactAddress(event({ address: "Boiro, A Coruña, España", city: "Boiro", province: "A Coruña" })),
    { value: false, reason: "same_as_location_fields" },
  );
});

test("una direccion con calle y numero es exacta", () => {
  assert.deepEqual(evaluateExactAddress(event({ address: "Calle Mayor 12, Madrid" })), { value: true, reason: "street_level_address" });
});

test("una direccion con autovia y salida es exacta", () => {
  assert.deepEqual(evaluateExactAddress(event({ address: "Autovía A-2, salida 18" })), { value: true, reason: "road_or_exit_address" });
});

test("una direccion por confirmar no es exacta", () => {
  assert.deepEqual(evaluateExactAddress(event({ address: "Por confirmar" })), { value: false, reason: "unconfirmed_address" });
});

test("normaliza variantes provinciales con y sin tilde", () => {
  assert.equal(normalizeProvince("A Coruna"), "A Coruña");
  assert.equal(normalizeProvince("A Coruña"), "A Coruña");
  assert.equal(normalizeProvince("Cadiz"), "Cádiz");
  assert.equal(normalizeProvince("Cádiz"), "Cádiz");
});

test("normaliza variantes de disciplina sin unir rally y rallysprint", () => {
  assert.equal(normalizeDiscipline("Montana"), "Montaña");
  assert.equal(normalizeDiscipline("Montaña"), "Montaña");
  assert.equal(normalizeDiscipline("Concentración"), "Concentraciones");
  assert.equal(normalizeDiscipline("Concentraciones"), "Concentraciones");
  assert.equal(normalizeDiscipline("Rally"), "Rally");
  assert.equal(normalizeDiscipline("Rallysprint"), "Rallysprint");
});

test("preserva el lote existente salvo regeneracion explicita", () => {
  const existing = { events: [{ id: "existing-1" }, { id: "existing-2" }] };
  const active = new Set(["existing-1", "generated-1"]);
  const allRows = new Set(["existing-1", "existing-2", "generated-1"]);
  assert.deepEqual(decideResearchBatchPersistence(existing, ["generated-1"], active, allRows, false), {
    action: "preserve",
    preserved_ids: ["existing-1", "existing-2"],
    inactive_ids: ["existing-2"],
    disappeared_ids: [],
  });
  assert.deepEqual(decideResearchBatchPersistence(existing, ["generated-1"], active, allRows, true), {
    action: "regenerate",
    preserved_ids: ["generated-1"],
    inactive_ids: [],
    disappeared_ids: [],
  });
});

test("un evento proximo e incompleto recibe mas prioridad", () => {
  const near = event({ start_date: "2026-07-21", official_url: null, source_type: "aggregator", address: null, image_url: null, needs_review: true, confidence_score: 45 });
  const far = event({ id: "event-2", start_date: "2027-07-21" });
  const nearMissing = calculateMissingFields(near, TODAY);
  const farMissing = calculateMissingFields(far, TODAY);
  assert.ok(calculateResearchPriority(near, TODAY, nearMissing, []) > calculateResearchPriority(far, TODAY, farMissing, []));
});

test("ordena por fecha y despues por prioridad", () => {
  const base = createResearchArtifacts([event(), event({ id: "event-2", slug: "evento-2", title: "Evento Dos", start_date: "2026-07-21", needs_review: true })], new Date("2026-07-20T10:00:00.000Z")).events;
  assert.equal(base[0].id, "event-2");
});

test("crea un lote de exactamente 20 cuando hay suficientes eventos", () => {
  const audited = createResearchArtifacts(Array.from({ length: 25 }, (_, index) => event({ id: `event-${index}`, slug: `event-${index}`, title: `Evento ${index}`, start_date: `2026-08-${String(index + 1).padStart(2, "0")}` })), new Date("2026-07-20T10:00:00.000Z")).events;
  const batch = createResearchBatch(audited, 20);
  assert.equal(batch.length, 20);
  assert.equal(batch[0].start_date, "2026-08-01");
  assert.deepEqual(batch[0].research_sources, []);
});

test("detecta duplicados orientativos por titulo fecha y lugar", () => {
  const rows = [
    event({ id: "a", title: "Campeonato de España Superbike MotorLand 2026", city: "Alcaniz", province: "Teruel", start_date: "2026-09-10" }),
    event({ id: "b", title: "Superbikes MotorLand", city: "Alcaniz", province: "Teruel", start_date: "2026-09-11" }),
  ];
  const duplicates = findPossibleDuplicateIds(rows);
  assert.deepEqual(duplicates.get("a"), ["b"]);
  assert.deepEqual(duplicates.get("b"), ["a"]);
});

test("pagina mas de 1000 registros", async () => {
  const rows = Array.from({ length: 1205 }, (_, index) => event({ id: `event-${index}`, slug: `event-${index}` }));
  const calls: Array<[number, number]> = [];
  const repository: FutureEventRepository = {
    async fetchPage(from, to) {
      calls.push([from, to]);
      return rows.slice(from, to + 1);
    },
  };
  const fetched = await fetchAllFutureEventRows(repository, 1000);
  assert.equal(fetched.length, 1205);
  assert.deepEqual(calls, [[0, 999], [1000, 1999]]);
});

test("la guardia rechaza cualquier operacion de escritura", () => {
  assert.doesNotThrow(() => assertReadOnlyOperations(["select", "order", "range"]));
  assert.throws(() => assertReadOnlyOperations(["select", "update"]), /no autorizada/);
});

test("separa cancelados y excluye borradores y eventos pasados", () => {
  const artifacts = createResearchArtifacts([
    event(),
    event({ id: "cancelled", slug: "cancelled", event_status: "cancelled" }),
    event({ id: "draft", slug: "draft", data_quality: "draft" }),
    event({ id: "past", slug: "past", start_date: "2026-07-01", end_date: "2026-07-02" }),
  ], new Date("2026-07-20T10:00:00.000Z"));
  assert.equal(artifacts.events.length, 1);
  assert.equal(artifacts.cancelled_events.length, 1);
});

test("el helper de ordenacion no muta la entrada", () => {
  const events = [{ start_date: "2026-07-22", research_priority: 1, title: "B" }, { start_date: "2026-07-21", research_priority: 1, title: "A" }] as EnrichmentEvent[];
  const sorted = sortEnrichmentEvents(events);
  assert.equal(sorted[0].title, "A");
  assert.equal(events[0].title, "B");
});
