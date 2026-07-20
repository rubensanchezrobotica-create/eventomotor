import assert from "node:assert/strict";
import test from "node:test";
import {
  assertConsolidationReadOnly,
  classifyProposal,
  consolidateInputs,
  validateCriticalCorrections,
  validateProposal,
  type ProposalInput,
} from "./consolidate-event-enrichment-proposals";
import type { ResearchEventRow } from "./export-future-events-for-enrichment";

function event(overrides: Partial<ResearchEventRow> = {}): ResearchEventRow {
  return {
    id: "event-1", slug: "evento-prueba-2026-07-21", title: "Evento Prueba 2026", championship: "Prueba", discipline: "Rally",
    start_date: "2026-07-21", end_date: "2026-07-21", venue: "Recinto", city: "Madrid", province: "Madrid", region: "Comunidad de Madrid",
    country: "ES", level: "Publicado", source: "Organizador", source_url: "https://example.com/evento", source_id: null,
    ticket_url: null, official_url: "https://example.com/evento", registration_url: null, image_url: null, image_source_url: null,
    event_status: "confirmed", short_description: null, long_description: null, schedule_text: null, address: null, latitude: null, longitude: null,
    organizer_name: "Organizador", organizer_url: "https://example.com", verified_at: null, source_type: "organizer", confidence_score: 80,
    needs_review: true, tags: ["rally"], vehicle_type: "coche", featured: false, visible: true, import_method: "batch_import", data_quality: "needs_review",
    notes: null, created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-07-20T00:00:00.000Z", ...overrides,
  };
}

function proposal(id: string, updates: Record<string, unknown> = { title: `Evento ${id}` }): ProposalInput {
  return { id, decision: "update", proposed_updates: updates, unresolved: [], sources: ["https://example.com/source"] };
}

function inputSet() {
  const events = Array.from({ length: 20 }, (_, index) => event({ id: `event-${index}`, slug: `event-${index}`, title: `Evento ${index}` }));
  const proposals = events.map((item) => proposal(item.id, { short_description: `Descripción ${item.id}` }));
  const blocks = Array.from({ length: 4 }, (_, index) => ({ events: proposals.slice(index * 5, index * 5 + 5) }));
  return { batch: { events }, blocks };
}

test("exige exactamente cuatro bloques", () => {
  const { batch, blocks } = inputSet();
  assert.throws(() => consolidateInputs(batch, blocks.slice(0, 3)), /cuatro bloques/);
});

test("exige exactamente 20 eventos y preserva el orden del Lote 001", () => {
  const { batch, blocks } = inputSet();
  blocks.reverse();
  const consolidated = consolidateInputs(batch, blocks);
  assert.equal(consolidated.length, 20);
  assert.deepEqual(consolidated.map((item) => item.id), batch.events.map((item) => item.id));
});

test("detecta un ID ausente y adicional", () => {
  const { batch, blocks } = inputSet();
  blocks[0].events[0] = proposal("additional");
  assert.throws(() => consolidateInputs(batch, blocks), /Faltan IDs/);
});

test("detecta un ID duplicado", () => {
  const { batch, blocks } = inputSet();
  blocks[0].events[1] = blocks[0].events[0];
  assert.throws(() => consolidateInputs(batch, blocks), /IDs duplicados/);
});

test("bloquea campo inexistente, tipo incorrecto, URL inválida y fecha inválida", () => {
  const validated = validateProposal(proposal("invalid", {
    imaginary_field: "x", confidence_score: "alto", official_url: "no-es-url", start_date: "2026-02-30",
  }));
  assert.match(validated.validation_errors.join(" "), /Campo inexistente/);
  assert.match(validated.validation_errors.join(" "), /numérico/);
  assert.match(validated.validation_errors.join(" "), /URL HTTP/);
  assert.match(validated.validation_errors.join(" "), /YYYY-MM-DD/);
});

test("null no borra y solo explicit_clears autoriza una limpieza", () => {
  const ignored = validateProposal(proposal("null", { organizer_name: null }));
  assert.equal("organizer_name" in ignored.proposed_updates, false);
  assert.equal("organizer_name" in ignored.explicit_clears, false);
  assert.equal(ignored.validation_warnings.includes("null_no_borra:organizer_name"), true);
  const clear = validateProposal({
    ...proposal("clear", { organizer_name: null }),
    clear_or_replace_current_values: { organizer_name: "Organizador anterior", reason: "Fuente primaria revisada." },
  });
  assert.equal(clear.explicit_clears.organizer_name, "Organizador anterior");
});

test("el slug nunca se modifica", () => {
  const validated = validateProposal(proposal("slug", { slug: "slug-nuevo" }));
  assert.match(validated.validation_errors.join(" "), /slug nunca puede modificarse|Campo no modificable/);
});

test("detecta drift y bloquea conflictos con la propuesta", () => {
  const expected = event({ title: "Título exportado" });
  const current = event({ title: "Título cambiado en Supabase" });
  const validated = validateProposal(proposal(expected.id, { title: "Título propuesto" }));
  const result = classifyProposal(expected, current, validated, "2026-07-20");
  assert.equal(result.readiness, "blocked_by_drift");
  assert.equal(result.drift.some((item) => item.field === "title" && item.resolution === "conflicts_with_proposal"), true);
});

test("marca solo slugs semánticamente antiguos", () => {
  const karting = event({ title: "Karting Outeiro de Rei 2026", slug: "karting-outeiro-de-rei-2026-07-24" });
  const kartingResult = classifyProposal(karting, karting, validateProposal(proposal(karting.id, { title: "6.º Karting Outeiro de Rei 2026" })), "2026-07-20");
  assert.equal(kartingResult.impact_summary.slug_semantically_stale, false);
  const betancuria = event({ title: "Rallysprint Betancuria 2026", slug: "rallysprint-betancuria-2026-07-25", discipline: "Rallysprint" });
  const betancuriaResult = classifyProposal(betancuria, betancuria, validateProposal(proposal(betancuria.id, { title: "XIII Subida a Betancuria 2026", discipline: "Subida" })), "2026-07-20");
  assert.equal(betancuriaResult.impact_summary.slug_semantically_stale, true);
});

test("clasifica como bloqueado un campo inválido", () => {
  const validated = validateProposal(proposal("event-1", { field_that_does_not_exist: "x" }));
  assert.equal(classifyProposal(event(), event(), validated, "2026-07-20").readiness, "blocked_by_invalid_field");
});

function criticalProposals() {
  return [
    validateProposal(proposal("pujada-alp-2500-2026-07-25", { title: "XV Pujada Alp 2500 2026", start_date: "2026-07-11", end_date: "2026-07-12" })),
    validateProposal(proposal("batch-rallysprint-betancuria-2026-07-25", { title: "XIII Subida a Betancuria 2026", discipline: "Subida" })),
    validateProposal(proposal("batch-xiii-concentracion-vehiculos-clasicos-ciudad-sagunto-2026-07-26", { title: "XII Concentración de Coches y Motos Clásicos Ciudad de Sagunto 2026", schedule_text: "09:00 concentración; 11:30 ruta." })),
    validateProposal({ ...proposal("batch-enduro-comunidad-madrid-ibio-2026-07-26", { organizer_name: null }), clear_or_replace_current_values: { organizer_name: "Federacion Madrilena de Motociclismo", reason: "No es organizador." } }),
    validateProposal(proposal("batch-enduro-indoor-andalucia-olvera-2026-07-26", { title: "I Enduro Indoor Ciudad de Olvera 2026", start_date: "2026-07-25", end_date: "2026-07-25" })),
  ];
}

test("valida las correcciones críticas de Alp Betancuria Sagunto y Olvera", () => {
  assert.deepEqual(validateCriticalCorrections(criticalProposals()), []);
});

test("detecta una fecha incorrecta de Alp", () => {
  const proposals = criticalProposals();
  proposals[0].proposed_updates.start_date = "2026-07-25";
  assert.match(validateCriticalCorrections(proposals).join(" "), /start_date/);
});

test("detecta una disciplina incorrecta de Betancuria", () => {
  const proposals = criticalProposals();
  proposals[1].proposed_updates.discipline = "Rallysprint";
  assert.match(validateCriticalCorrections(proposals).join(" "), /discipline/);
});

test("detecta una edición o programa incorrectos de Sagunto", () => {
  const proposals = criticalProposals();
  proposals[2].proposed_updates.schedule_text = "10:00 almuerzo";
  assert.match(validateCriticalCorrections(proposals).join(" "), /10:00/);
});

test("detecta una fecha incorrecta de Olvera", () => {
  const proposals = criticalProposals();
  proposals[4].proposed_updates.start_date = "2026-07-26";
  assert.match(validateCriticalCorrections(proposals).join(" "), /start_date/);
});

test("la capa de acceso rechaza operaciones de escritura", () => {
  assert.doesNotThrow(() => assertConsolidationReadOnly(["select", "in"]));
  assert.throws(() => assertConsolidationReadOnly(["select", "update"]), /no autorizada/);
});
