import assert from "node:assert/strict";
import test from "node:test";
import {
  executeCleanup,
  type CleanupBackupWriter,
  type CleanupReport,
  type CleanupRepository,
  type DeleteRequest,
  type EventRecord,
} from "./remove-obsolete-events";

const OBSOLETE: EventRecord = {
  id: "obsolete-1",
  title: "Evento obsoleto 2026",
  slug: "evento-obsoleto-2026-10-09",
  start_date: "2026-10-09",
  end_date: "2026-10-10",
  source_url: "https://secondary.example/old",
  city: "Granada",
  province: "Granada",
};

const CANONICAL: EventRecord = {
  id: "canonical-1",
  title: "Evento canonico 2026",
  slug: "evento-canonico-2026-10-30",
  start_date: "2026-10-30",
  end_date: "2026-10-31",
  source_url: "https://official.example/current",
  city: "Granada",
  province: "Granada",
};

function report(overrides: Record<string, unknown> = {}) {
  return {
    issue_type: "semantic_duplicate_obsolete_record",
    obsolete_id: OBSOLETE.id,
    obsolete_title: OBSOLETE.title,
    obsolete_slug: OBSOLETE.slug,
    obsolete_start_date: OBSOLETE.start_date,
    obsolete_end_date: OBSOLETE.end_date,
    obsolete_source_url: OBSOLETE.source_url,
    canonical_id: CANONICAL.id,
    canonical_title: CANONICAL.title,
    canonical_slug: CANONICAL.slug,
    canonical_start_date: CANONICAL.start_date,
    canonical_end_date: CANONICAL.end_date,
    canonical_source_url: CANONICAL.source_url,
    official_verification_url: "https://official.example/verification",
    reason: "La fuente oficial confirma el registro canonico.",
    recommended_action: "review_and_remove_obsolete_record",
    status: "pending_manual_review",
    ...overrides,
  };
}

class FakeRepository implements CleanupRepository {
  readonly deletes: DeleteRequest[] = [];
  readonly log: string[];
  private readonly records = new Map<string, EventRecord[]>();

  constructor(
    events: EventRecord[] = [OBSOLETE, CANONICAL],
    private readonly deletedCount = 1,
    log: string[] = [],
  ) {
    this.log = log;
    for (const event of events) this.records.set(event.id, [...(this.records.get(event.id) || []), structuredClone(event)]);
  }

  async findEventsById(id: string) {
    return structuredClone(this.records.get(id) || []);
  }

  async deleteObsolete(request: DeleteRequest) {
    this.log.push("delete");
    this.deletes.push(request);
    if (this.deletedCount === 1) this.records.delete(request.id);
    return { deletedCount: this.deletedCount };
  }
}

class FakeBackupWriter implements CleanupBackupWriter {
  readonly calls: Array<{ report: CleanupReport; obsolete: EventRecord; canonical: EventRecord }> = [];

  constructor(
    private readonly log: string[] = [],
    private readonly shouldFail = false,
  ) {}

  async writeBackup(cleanupReport: CleanupReport, obsoleteEvent: EventRecord, canonicalEvent: EventRecord) {
    this.log.push("backup");
    if (this.shouldFail) throw new Error("fallo de disco");
    this.calls.push({ report: cleanupReport, obsolete: structuredClone(obsoleteEvent), canonical: structuredClone(canonicalEvent) });
    return "data/backups/event-cleanup/test.json";
  }
}

const applyOptions = { apply: true, confirmId: OBSOLETE.id, generatedAt: "2026-07-13T10:00:00.000Z" };

test("incidencia valida queda ready en dry-run", async () => {
  const execution = await executeCleanup(new FakeRepository(), new FakeBackupWriter(), [report()]);
  assert.equal(execution.results[0].classification, "ready");
});

test("registro obsoleto inexistente", async () => {
  const execution = await executeCleanup(new FakeRepository([CANONICAL]), new FakeBackupWriter(), [report()]);
  assert.equal(execution.results[0].classification, "obsolete_not_found");
});

test("registro canonico inexistente", async () => {
  const execution = await executeCleanup(new FakeRepository([OBSOLETE]), new FakeBackupWriter(), [report()]);
  assert.equal(execution.results[0].classification, "canonical_not_found");
});

test("titulo obsoleto distinto produce mismatch", async () => {
  const execution = await executeCleanup(new FakeRepository([{ ...OBSOLETE, title: "Otro titulo" }, CANONICAL]), new FakeBackupWriter(), [report()]);
  assert.equal(execution.results[0].classification, "mismatch");
  assert.equal(execution.results[0].obsoleteChecks.title, false);
});

test("slug obsoleto distinto produce mismatch", async () => {
  const execution = await executeCleanup(new FakeRepository([{ ...OBSOLETE, slug: "otro-slug" }, CANONICAL]), new FakeBackupWriter(), [report()]);
  assert.equal(execution.results[0].classification, "mismatch");
  assert.equal(execution.results[0].obsoleteChecks.slug, false);
});

test("fechas obsoletas distintas producen mismatch", async () => {
  const execution = await executeCleanup(new FakeRepository([{ ...OBSOLETE, start_date: "2026-10-08" }, CANONICAL]), new FakeBackupWriter(), [report()]);
  assert.equal(execution.results[0].classification, "mismatch");
  assert.equal(execution.results[0].obsoleteChecks.start_date, false);
});

test("fuente obsoleta distinta produce mismatch", async () => {
  const execution = await executeCleanup(new FakeRepository([{ ...OBSOLETE, source_url: "https://example.com/other" }, CANONICAL]), new FakeBackupWriter(), [report()]);
  assert.equal(execution.results[0].classification, "mismatch");
  assert.equal(execution.results[0].obsoleteChecks.source_url, false);
});

test("datos canonicos distintos producen mismatch", async () => {
  const execution = await executeCleanup(new FakeRepository([OBSOLETE, { ...CANONICAL, end_date: "2026-11-01" }]), new FakeBackupWriter(), [report()]);
  assert.equal(execution.results[0].classification, "mismatch");
  assert.equal(execution.results[0].canonicalChecks.end_date, false);
});

test("obsolete_id igual a canonical_id queda blocked", async () => {
  const execution = await executeCleanup(new FakeRepository(), new FakeBackupWriter(), [report({ canonical_id: OBSOLETE.id })]);
  assert.equal(execution.results[0].classification, "blocked");
});

test("dry-run no ejecuta delete", async () => {
  const repository = new FakeRepository();
  const backup = new FakeBackupWriter();
  await executeCleanup(repository, backup, [report()]);
  assert.equal(repository.deletes.length, 0);
  assert.equal(backup.calls.length, 0);
});

test("apply sin confirm-id no elimina", async () => {
  const repository = new FakeRepository();
  const execution = await executeCleanup(repository, new FakeBackupWriter(), [report()], { apply: true });
  assert.equal(execution.results[0].classification, "confirmation_required");
  assert.equal(repository.deletes.length, 0);
});

test("confirm-id incorrecto no elimina", async () => {
  const repository = new FakeRepository();
  const execution = await executeCleanup(repository, new FakeBackupWriter(), [report()], { apply: true, confirmId: "otro-id" });
  assert.equal(execution.results[0].classification, "confirmation_required");
  assert.equal(repository.deletes.length, 0);
});

test("la eliminacion apunta exclusivamente al registro obsoleto", async () => {
  const repository = new FakeRepository();
  await executeCleanup(repository, new FakeBackupWriter(), [report()], applyOptions);
  assert.deepEqual(repository.deletes, [
    {
      id: OBSOLETE.id,
      title: OBSOLETE.title,
      slug: OBSOLETE.slug,
      start_date: OBSOLETE.start_date,
      end_date: OBSOLETE.end_date,
      source_url: OBSOLETE.source_url,
    },
  ]);
});

test("el registro canonico nunca se modifica", async () => {
  const repository = new FakeRepository();
  await executeCleanup(repository, new FakeBackupWriter(), [report()], applyOptions);
  assert.deepEqual(await repository.findEventsById(CANONICAL.id), [CANONICAL]);
});

test("el backup se crea antes de eliminar", async () => {
  const log: string[] = [];
  await executeCleanup(new FakeRepository([OBSOLETE, CANONICAL], 1, log), new FakeBackupWriter(log), [report()], applyOptions);
  assert.deepEqual(log, ["backup", "delete"]);
});

test("un fallo de backup bloquea la eliminacion", async () => {
  const repository = new FakeRepository();
  const execution = await executeCleanup(repository, new FakeBackupWriter([], true), [report()], applyOptions);
  assert.equal(execution.results[0].classification, "deletion_error");
  assert.equal(repository.deletes.length, 0);
});

test("se exige exactamente una fila eliminada", async () => {
  const execution = await executeCleanup(new FakeRepository([OBSOLETE, CANONICAL], 0), new FakeBackupWriter(), [report()], applyOptions);
  assert.equal(execution.results[0].classification, "deletion_error");
  assert.match(execution.results[0].errors.join(" "), /exactamente 1/);
});

test("la verificacion posterior confirma que el canonico permanece", async () => {
  const repository = new FakeRepository();
  const execution = await executeCleanup(repository, new FakeBackupWriter(), [report()], applyOptions);
  assert.equal(execution.results[0].classification, "deleted");
  assert.equal((await repository.findEventsById(OBSOLETE.id)).length, 0);
  assert.deepEqual(await repository.findEventsById(CANONICAL.id), [CANONICAL]);
});
