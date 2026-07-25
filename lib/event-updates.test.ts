import assert from "node:assert/strict";
import test from "node:test";
import {
  EventUpdateConflictError,
  assertEventUpdatedAtChanged,
  sameTimestampInstant,
  updateExistingEvent,
  withNextEventUpdatedAt,
  type ExistingEventUpdateRepository,
} from "./event-updates";

type Row = { id: string; title: string; updated_at: string };

class MemoryRepository implements ExistingEventUpdateRepository<Row> {
  row: Row | null = {
    id: "event-1",
    title: "Anterior",
    updated_at: "2026-07-25T17:53:49.747+00:00",
  };
  reads = 0;
  updates = 0;
  expectedFilter: string | null = null;
  payload: Record<string, unknown> | null = null;
  conflict = false;
  keepOldTimestamp = false;

  async readUpdatedAt(id: string) {
    this.reads += 1;
    return this.row?.id === id ? this.row.updated_at : null;
  }

  async updateByIdAndUpdatedAt(
    id: string,
    expectedUpdatedAt: string,
    changes: Record<string, unknown> & { updated_at: string },
  ) {
    this.updates += 1;
    this.expectedFilter = expectedUpdatedAt;
    this.payload = structuredClone(changes);
    if (
      this.conflict
      || !this.row
      || this.row.id !== id
      || this.row.updated_at !== expectedUpdatedAt
    ) {
      return null;
    }
    this.row = {
      ...this.row,
      ...changes,
      updated_at: this.keepOldTimestamp ? this.row.updated_at : changes.updated_at,
    } as Row;
    return structuredClone(this.row);
  }
}

test("una actualización existente filtra por el timestamp anterior exacto y envía uno nuevo", async () => {
  const repository = new MemoryRepository();
  const previous = repository.row!.updated_at;
  const result = await updateExistingEvent({
    id: "event-1",
    changes: { title: "Nuevo" },
    repository,
    now: new Date("2026-07-25T18:30:00.000Z"),
  });

  assert.equal(repository.reads, 1);
  assert.equal(repository.updates, 1);
  assert.equal(repository.expectedFilter, previous);
  assert.equal(repository.payload?.updated_at, "2026-07-25T18:30:00.000Z");
  assert.notEqual(result.updated.updated_at, previous);
  assert.equal(result.updated.title, "Nuevo");
});

test("un conflicto de concurrencia bloquea la actualización", async () => {
  const repository = new MemoryRepository();
  repository.conflict = true;
  await assert.rejects(
    updateExistingEvent({
      id: "event-1",
      changes: { title: "Nuevo" },
      repository,
      now: new Date("2026-07-25T18:30:00.000Z"),
    }),
    EventUpdateConflictError,
  );
});

test("la verificación posterior exige que updated_at haya cambiado", async () => {
  const repository = new MemoryRepository();
  repository.keepOldTimestamp = true;
  await assert.rejects(
    updateExistingEvent({
      id: "event-1",
      changes: { title: "Nuevo" },
      repository,
      now: new Date("2026-07-25T18:30:00.000Z"),
    }),
    /updated_at no cambió/,
  );
});

test("compara timestamps por instante y rechaza reutilizar el anterior", () => {
  assert.equal(
    sameTimestampInstant("2026-07-25T17:53:49.747+00:00", "2026-07-25T17:53:49.747Z"),
    true,
  );
  assert.throws(
    () => withNextEventUpdatedAt(
      { title: "Nuevo" },
      "2026-07-25T17:53:49.747+00:00",
      new Date("2026-07-25T17:53:49.747Z"),
    ),
    /instante diferente/,
  );
  assert.throws(
    () => assertEventUpdatedAtChanged(
      "2026-07-25T17:53:49.747+00:00",
      { updated_at: "2026-07-25T17:53:49.747Z" },
    ),
    /no cambió/,
  );
});
