import assert from "node:assert/strict";
import test from "node:test";
import {
  executeTextCorrections,
  type EventTextCorrectionRepository,
  type EventTextSnapshot,
  type EventTextUpdateRequest,
} from "./apply-event-text-corrections";

const BASE_EVENT: EventTextSnapshot = {
  id: "event-1",
  slug: "evento-prueba-2026-08-07",
  fields: {
    title: "Gran Premio de La Ba?eza 2026",
    city: "La Ba?eza",
    tags: ["moto", "La Ba?eza"],
  },
};

function correction(overrides: Record<string, unknown> = {}) {
  return {
    id: BASE_EVENT.id,
    title: BASE_EVENT.fields.title,
    reason: "Restaura caracteres danados antes de la importacion.",
    status: "pending_update",
    expected: {
      title: BASE_EVENT.fields.title,
      city: BASE_EVENT.fields.city,
      tags: BASE_EVENT.fields.tags,
    },
    changes: {
      title: "Gran Premio de La Baneza 2026",
      city: "La Baneza",
      tags: ["moto", "La Baneza"],
    },
    ...overrides,
  };
}

class FakeRepository implements EventTextCorrectionRepository {
  readonly updates: EventTextUpdateRequest[] = [];

  constructor(
    private readonly events: EventTextSnapshot[] = [BASE_EVENT],
    private readonly updatedCount = 1,
  ) {}

  async findEventsById(id: string) {
    return this.events.filter((event) => event.id === id);
  }

  async updateEvent(request: EventTextUpdateRequest) {
    this.updates.push(request);
    return { updatedCount: this.updatedCount };
  }
}

test("una correccion exacta queda lista", async () => {
  const execution = await executeTextCorrections(new FakeRepository(), [correction()]);
  assert.equal(execution.summary.ready, 1);
  assert.equal(execution.summary.blocked, 0);
});

test("el titulo sirve de precondicion aunque no sea un campo modificado", async () => {
  const input = correction({
    expected: { city: BASE_EVENT.fields.city },
    changes: { city: "La Baneza" },
  });
  const execution = await executeTextCorrections(new FakeRepository(), [input]);
  assert.equal(execution.summary.ready, 1);
});

test("un titulo identificador distinto bloquea toda la correccion", async () => {
  const execution = await executeTextCorrections(new FakeRepository(), [correction({ title: "Otro evento" })]);
  assert.equal(execution.summary.blocked, 1);
  assert.match(execution.results[0].errors.join(" "), /expected.title/);
});

test("dry-run no escribe", async () => {
  const repository = new FakeRepository();
  const execution = await executeTextCorrections(repository, [correction()], false);
  assert.equal(execution.summary.updated, 0);
  assert.equal(repository.updates.length, 0);
});

test("un ID ausente queda no encontrado", async () => {
  const execution = await executeTextCorrections(new FakeRepository([]), [correction()]);
  assert.equal(execution.summary.notFound, 1);
});

test("un error de lectura bloquea esa correccion sin ocultar el resumen", async () => {
  const repository: EventTextCorrectionRepository = {
    async findEventsById() {
      throw new Error("lectura no disponible");
    },
    async updateEvent() {
      return { updatedCount: 0 };
    },
  };
  const execution = await executeTextCorrections(repository, [correction()]);
  assert.equal(execution.summary.blocked, 1);
  assert.match(execution.results[0].errors.join(" "), /lectura no disponible/);
});

test("mas de una fila para el ID queda en conflicto", async () => {
  const execution = await executeTextCorrections(new FakeRepository([BASE_EVENT, { ...BASE_EVENT }]), [correction()]);
  assert.equal(execution.summary.conflicts, 1);
});

test("cualquier precondicion distinta bloquea toda la correccion", async () => {
  const event = { ...BASE_EVENT, fields: { ...BASE_EVENT.fields, city: "La Baneza" } };
  const execution = await executeTextCorrections(new FakeRepository([event]), [correction()]);
  assert.equal(execution.summary.blocked, 1);
  assert.match(execution.results[0].errors.join(" "), /city/);
});

test("expected y changes deben tener los mismos campos", async () => {
  const input = correction({ changes: { title: "Gran Premio de La Baneza 2026" } });
  const execution = await executeTextCorrections(new FakeRepository(), [input]);
  assert.equal(execution.summary.blocked, 1);
  assert.match(execution.results[0].errors.join(" "), /mismos campos/);
});

test("campos no autorizados como slug se rechazan", async () => {
  const input = correction({
    expected: { title: BASE_EVENT.fields.title, slug: BASE_EVENT.slug },
    changes: { title: "Gran Premio de La Baneza 2026", slug: "otro-slug" },
  });
  const execution = await executeTextCorrections(new FakeRepository(), [input]);
  assert.equal(execution.summary.blocked, 1);
  assert.match(execution.results[0].errors.join(" "), /slug/);
});

test("apply envia solo los campos declarados y conserva id y slug", async () => {
  const repository = new FakeRepository();
  const execution = await executeTextCorrections(repository, [correction()], true);
  assert.equal(execution.summary.updated, 1);
  assert.deepEqual(Object.keys(repository.updates[0].changes).sort(), ["city", "tags", "title"]);
  assert.equal("id" in repository.updates[0].changes, false);
  assert.equal("slug" in repository.updates[0].changes, false);
});

test("un recuento de actualizacion distinto de uno se informa como error", async () => {
  const execution = await executeTextCorrections(new FakeRepository([BASE_EVENT], 0), [correction()], true);
  assert.equal(execution.summary.updated, 0);
  assert.equal(execution.summary.updateErrors, 1);
});
