import assert from "node:assert/strict";
import test from "node:test";
import { classifyDuplicates, validateEvent } from "./import-events-batch";

const UPDATED_AT = "2026-07-12T12:00:00.000Z";

function candidate(overrides: Record<string, unknown> = {}, index = 0) {
  return validateEvent(
    {
      title: "Evento nuevo 2026",
      slug: `evento-nuevo-${index}`,
      start_date: "2026-09-05",
      end_date: "2026-09-05",
      city: "Cervera",
      province: "Lleida",
      venue: "Cervera",
      discipline: "Rally Tierra",
      vehicle_type: "Coches",
      source_url: "https://federacion.example/calendario-2026.pdf",
      official_url: "https://federacion.example/calendario-2026.pdf",
      event_status: "confirmed",
      source_type: "official",
      confidence_score: 90,
      needs_review: false,
      ...overrides,
    },
    index,
    UPDATED_AT,
  );
}

function existing(overrides: Record<string, unknown> = {}) {
  return {
    id: "existing-1",
    slug: "evento-existente",
    title: "Evento existente 2026",
    start_date: "2026-10-20",
    end_date: "2026-10-20",
    venue: "Manresa",
    city: "Manresa",
    province: "Barcelona",
    discipline: "Rally",
    vehicle_type: "Coches",
    source_url: "https://federacion.example/calendario-2026.pdf",
    official_url: "https://federacion.example/calendario-2026.pdf",
    ...overrides,
  };
}

test("una URL general compartida no crea un duplicado exacto por si sola", () => {
  const event = candidate();

  classifyDuplicates([event], [existing()]);

  assert.equal(event.classification, "insertable");
  assert.deepEqual(event.duplicateReasons, []);
});

test("dos pruebas distintas de una circular federativa siguen siendo insertables", () => {
  const first = candidate({ title: "7è Memorial Abel Puig 2026", slug: "memorial-abel-puig", city: "Cervera" }, 0);
  const second = candidate(
    { title: "32è Ral·li Ciutat de Tàrrega 2026", slug: "ralli-ciutat-tarrega", start_date: "2026-11-07", end_date: "2026-11-08", city: "Tàrrega", venue: "Tàrrega" },
    1,
  );

  classifyDuplicates([first, second], []);

  assert.equal(first.classification, "insertable");
  assert.equal(second.classification, "insertable");
});

test("mismo titulo, fecha y ciudad sigue siendo duplicate", () => {
  const event = candidate({ title: "Rallye Gibralfaro 2026", slug: "rallye-gibralfaro-candidato", start_date: "2026-09-25", end_date: "2026-09-26", city: "Rincón de la Victoria", province: "Málaga", venue: "Rincón de la Victoria" });

  classifyDuplicates(
    [event],
    [existing({ title: "Rallye Gibralfaro 2026", slug: "rallye-gibralfaro-existente", start_date: "2026-09-25", end_date: "2026-09-26", city: "Rincón de la Victoria", province: "Málaga", venue: "Rincón de la Victoria" })],
  );

  assert.equal(event.classification, "duplicate");
  assert.match(event.duplicateReasons.join(" "), /title \+ start_date \+ city/);
});

function chesteCandidate(reviewed = false) {
  return candidate({
    title: "Enduro Cheste 2026",
    slug: "enduro-cheste-2026-09-27",
    start_date: "2026-09-27",
    end_date: "2026-09-27",
    city: "Cheste",
    province: "Valencia",
    venue: "Cheste",
    discipline: "Enduro",
    vehicle_type: "Motos",
    tags: ["enduro", "cheste"],
    ...(reviewed
      ? {
          duplicate_review_status: "approved_distinct",
          duplicate_review_note: "Prueba de Enduro distinta del evento de circuito.",
        }
      : {}),
  });
}

const supercarsCheste = existing({
  title: "Supercars + ROOW Cheste 2026",
  slug: "supercars-roow-cheste-2026-09-26",
  start_date: "2026-09-26",
  end_date: "2026-09-27",
  city: "Cheste",
  province: "Valencia",
  venue: "Circuit Ricardo Tormo",
  discipline: "Circuito",
  vehicle_type: "Coches",
  source_url: "https://circuit.example/supercars-roow",
  official_url: "https://circuit.example/supercars-roow",
});

test("Enduro Cheste frente a Supercars Cheste es possible_duplicate", () => {
  const event = chesteCandidate();

  classifyDuplicates([event], [supercarsCheste]);

  assert.equal(event.classification, "possible_duplicate");
});

test("la revision manual de Enduro Cheste produce reviewed_insertable", () => {
  const event = chesteCandidate(true);

  classifyDuplicates([event], [supercarsCheste]);

  assert.equal(event.classification, "reviewed_insertable");
});

test("approved_distinct nunca desbloquea un duplicado exacto", () => {
  const event = candidate({
    title: "Evento repetido 2026",
    slug: "evento-repetido-candidato",
    city: "Cervera",
    duplicate_review_status: "approved_distinct",
    duplicate_review_note: "Revisado manualmente.",
  });

  classifyDuplicates([event], [existing({ title: "Evento repetido 2026", slug: "evento-repetido-existente", start_date: "2026-09-05", city: "Cervera", province: "Lleida", venue: "Cervera" })]);

  assert.equal(event.classification, "duplicate");
});
