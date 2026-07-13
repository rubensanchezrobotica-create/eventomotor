import assert from "node:assert/strict";
import test from "node:test";
import {
  executeCorrections,
  type CorrectionRepository,
  type EventSnapshot,
  type EventUpdateRequest,
} from "./apply-event-corrections";

const BASE_EVENT: EventSnapshot = {
  id: "event-1",
  slug: "evento-prueba-2026-11-15",
  title: "Evento Prueba 2026",
  start_date: "2026-11-15",
  end_date: "2026-11-15",
  city: "Villarta",
  source_url: "https://federacion.example/calendario-v1.pdf",
};

function correction(overrides: Record<string, unknown> = {}) {
  return {
    id: BASE_EVENT.id,
    title: BASE_EVENT.title,
    old_start_date: BASE_EVENT.start_date,
    old_end_date: BASE_EVENT.end_date,
    new_start_date: "2026-11-08",
    new_end_date: "2026-11-08",
    keep_id: true,
    keep_slug: true,
    old_source_url: BASE_EVENT.source_url,
    new_source_url: "https://federacion.example/calendario-v2.pdf",
    reason: "Calendario federativo actualizado.",
    status: "pending_update",
    ...overrides,
  };
}

class FakeRepository implements CorrectionRepository {
  readonly updates: EventUpdateRequest[] = [];

  constructor(
    private readonly events: EventSnapshot[] = [BASE_EVENT],
    private readonly updatedCount = 1,
  ) {}

  async findEventById(id: string) {
    return this.events.find((event) => event.id === id) || null;
  }

  async findEventsByStartDate(startDate: string) {
    return this.events.filter((event) => event.start_date === startDate);
  }

  async updateEvent(request: EventUpdateRequest) {
    this.updates.push(request);
    return { updatedCount: this.updatedCount };
  }
}

test("una correccion valida queda ready", async () => {
  const repository = new FakeRepository();
  const execution = await executeCorrections(repository, [correction()]);

  assert.equal(execution.results[0].classification, "ready");
  assert.equal(execution.summary.ready, 1);
});

test("un ID inexistente queda not_found", async () => {
  const repository = new FakeRepository([]);
  const execution = await executeCorrections(repository, [correction()]);

  assert.equal(execution.results[0].classification, "not_found");
});

test("un titulo distinto bloquea la correccion", async () => {
  const repository = new FakeRepository([{ ...BASE_EVENT, title: "Otro titulo" }]);
  const execution = await executeCorrections(repository, [correction()]);

  assert.equal(execution.results[0].classification, "blocked");
  assert.equal(execution.results[0].checks.title, false);
});

test("una fecha antigua distinta bloquea la correccion", async () => {
  const repository = new FakeRepository([{ ...BASE_EVENT, start_date: "2026-11-14", end_date: "2026-11-14" }]);
  const execution = await executeCorrections(repository, [correction()]);

  assert.equal(execution.results[0].classification, "blocked");
  assert.equal(execution.results[0].checks.oldDates, false);
});

test("una fuente antigua distinta bloquea la correccion", async () => {
  const repository = new FakeRepository([{ ...BASE_EVENT, source_url: "https://example.com/otra-fuente" }]);
  const execution = await executeCorrections(repository, [correction()]);

  assert.equal(execution.results[0].classification, "blocked");
  assert.equal(execution.results[0].checks.oldSource, false);
});

test("una fecha nueva incoherente se bloquea antes de consultar", async () => {
  const repository = new FakeRepository();
  const execution = await executeCorrections(repository, [correction({ new_start_date: "2026-11-08", new_end_date: "2026-11-07" })]);

  assert.equal(execution.results[0].classification, "blocked");
  assert.match(execution.results[0].errors.join(" "), /new_end_date/);
});

test("un duplicado con otro evento queda conflict", async () => {
  const duplicate: EventSnapshot = {
    ...BASE_EVENT,
    id: "event-2",
    slug: "evento-prueba-duplicado-2026-11-08",
    start_date: "2026-11-08",
    end_date: "2026-11-08",
  };
  const repository = new FakeRepository([BASE_EVENT, duplicate]);
  const execution = await executeCorrections(repository, [correction()]);

  assert.equal(execution.results[0].classification, "conflict");
  assert.equal(execution.results[0].checks.duplicate, "conflict");
});

test("apply conserva id y slug y solo envia los cuatro campos permitidos", async () => {
  const repository = new FakeRepository();
  const execution = await executeCorrections(repository, [correction()], true);
  const request = repository.updates[0];

  assert.equal(execution.summary.updated, 1);
  assert.equal(request.id, BASE_EVENT.id);
  assert.deepEqual(Object.keys(request.changes).sort(), ["end_date", "official_url", "source_url", "start_date"]);
  assert.equal("id" in request.changes, false);
  assert.equal("slug" in request.changes, false);
});

test("dry-run no invoca ninguna escritura", async () => {
  const repository = new FakeRepository();
  const execution = await executeCorrections(repository, [correction()], false);

  assert.equal(execution.results[0].classification, "ready");
  assert.equal(execution.summary.updated, 0);
  assert.equal(repository.updates.length, 0);
});
