export type EventUpdateRow = {
  updated_at: string;
};

export class EventUpdateConflictError extends Error {
  constructor(message = "La fila cambió antes de completar la actualización.") {
    super(message);
    this.name = "EventUpdateConflictError";
  }
}

function instant(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new Error(`updated_at no es un timestamp ISO válido: ${value}`);
  }
  return timestamp;
}

export function sameTimestampInstant(left: string, right: string) {
  return instant(left) === instant(right);
}

export function withNextEventUpdatedAt<T extends Record<string, unknown>>(
  changes: T,
  previousUpdatedAt: string,
  now = new Date(),
): T & { updated_at: string } {
  const updatedAt = now.toISOString();
  if (sameTimestampInstant(previousUpdatedAt, updatedAt)) {
    throw new Error("El nuevo updated_at debe representar un instante diferente del anterior.");
  }
  return { ...changes, updated_at: updatedAt };
}

export function assertEventUpdatedAtChanged(previousUpdatedAt: string, updatedRow: EventUpdateRow) {
  if (sameTimestampInstant(previousUpdatedAt, updatedRow.updated_at)) {
    throw new Error("La verificación posterior detectó que updated_at no cambió.");
  }
}

export interface ExistingEventUpdateRepository<Row extends EventUpdateRow> {
  readUpdatedAt(id: string): Promise<string | null>;
  updateByIdAndUpdatedAt(
    id: string,
    expectedUpdatedAt: string,
    changes: Record<string, unknown> & { updated_at: string },
  ): Promise<Row | null>;
}

export async function updateExistingEvent<Row extends EventUpdateRow>(input: {
  id: string;
  changes: Record<string, unknown>;
  repository: ExistingEventUpdateRepository<Row>;
  now?: Date;
}) {
  const previousUpdatedAt = await input.repository.readUpdatedAt(input.id);
  if (!previousUpdatedAt) {
    throw new EventUpdateConflictError("No se encontró la fila de events que se quería actualizar.");
  }

  const changes = withNextEventUpdatedAt(input.changes, previousUpdatedAt, input.now);
  const updated = await input.repository.updateByIdAndUpdatedAt(
    input.id,
    previousUpdatedAt,
    changes,
  );
  if (!updated) {
    throw new EventUpdateConflictError();
  }

  assertEventUpdatedAtChanged(previousUpdatedAt, updated);
  return { previousUpdatedAt, updated };
}
