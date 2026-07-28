import assert from "node:assert/strict";
import test from "node:test";
import {
  ACCIDENTAL_SLUG,
  CANONICAL_SLUG,
  RPM_FEST_DATE,
  RPM_FEST_ID,
  RPM_FEST_TITLE,
  restoreRpmFestSlug,
  type SlugRestoreRepository,
  type SlugRestoreRow,
} from "./restore-rpm-fest-slug";

function target(): SlugRestoreRow {
  return {
    id: RPM_FEST_ID,
    title: RPM_FEST_TITLE,
    slug: ACCIDENTAL_SLUG,
    start_date: RPM_FEST_DATE,
    updated_at: "2026-07-28T08:24:16.608Z",
  };
}

class MemoryRepository implements SlugRestoreRepository {
  rows: SlugRestoreRow[] = [
    target(),
    {
      id: "other-event",
      title: "Otro evento",
      slug: "otro-evento",
      start_date: "2026-09-01",
      updated_at: "2026-07-20T10:00:00.000Z",
    },
  ];
  updates = 0;
  conflict = false;

  async findById(id: string) {
    return structuredClone(this.rows.filter((row) => row.id === id));
  }

  async findBySlug(slug: string) {
    return structuredClone(this.rows.filter((row) => row.slug === slug));
  }

  async updateSlug(input: {
    id: string;
    currentSlug: string;
    targetSlug: string;
    expectedUpdatedAt: string;
    nextUpdatedAt: string;
  }) {
    this.updates += 1;
    if (this.conflict) return [];
    const matches = this.rows.filter((row) => (
      row.id === input.id
      && row.slug === input.currentSlug
      && row.updated_at === input.expectedUpdatedAt
    ));
    for (const row of matches) {
      row.slug = input.targetSlug;
      row.updated_at = input.nextUpdatedAt;
    }
    return structuredClone(matches);
  }
}

const confirmations = {
  apply: true,
  confirmedEventId: RPM_FEST_ID,
  confirmedCurrentSlug: ACCIDENTAL_SLUG,
  confirmedTargetSlug: CANONICAL_SLUG,
  now: new Date("2026-07-28T12:00:00.000Z"),
};

test("es dry-run por defecto y no modifica ninguna fila", async () => {
  const repository = new MemoryRepository();
  const before = structuredClone(repository.rows);
  const result = await restoreRpmFestSlug(repository);
  assert.equal(result.applied, false);
  assert.equal(repository.updates, 0);
  assert.deepEqual(repository.rows, before);
});

test("aplicar exige las tres confirmaciones exactas", async () => {
  const repository = new MemoryRepository();
  await assert.rejects(
    restoreRpmFestSlug(repository, { apply: true }),
    /confirmar simultáneamente/,
  );
  assert.equal(repository.updates, 0);
});

test("bloquea un slug destino ocupado", async () => {
  const repository = new MemoryRepository();
  repository.rows.push({ ...target(), id: "occupied", slug: CANONICAL_SLUG });
  await assert.rejects(restoreRpmFestSlug(repository), /ya está ocupado/);
  assert.equal(repository.updates, 0);
});

test("un conflicto de concurrencia impide una actualización obsoleta", async () => {
  const repository = new MemoryRepository();
  repository.conflict = true;
  await assert.rejects(
    restoreRpmFestSlug(repository, confirmations),
    /conflicto de concurrencia/,
  );
});

test("restaura exactamente una fila y conserva todos los demás eventos", async () => {
  const repository = new MemoryRepository();
  const otherBefore = structuredClone(repository.rows[1]);
  const result = await restoreRpmFestSlug(repository, confirmations);
  assert.equal(result.applied, true);
  assert.equal(result.after?.slug, CANONICAL_SLUG);
  assert.equal(result.after?.title, RPM_FEST_TITLE);
  assert.equal(result.after?.start_date, RPM_FEST_DATE);
  assert.deepEqual(repository.rows[1], otherBefore);
  assert.equal(repository.updates, 1);
});

test("la restauración es reversible con el mismo control de identidad y concurrencia", async () => {
  const repository = new MemoryRepository();
  await restoreRpmFestSlug(repository, confirmations);
  const result = await restoreRpmFestSlug(repository, {
    apply: true,
    rollback: true,
    confirmedEventId: RPM_FEST_ID,
    confirmedCurrentSlug: CANONICAL_SLUG,
    confirmedTargetSlug: ACCIDENTAL_SLUG,
    now: new Date("2026-07-28T12:05:00.000Z"),
  });
  assert.equal(result.applied, true);
  assert.equal(result.after?.slug, ACCIDENTAL_SLUG);
});
