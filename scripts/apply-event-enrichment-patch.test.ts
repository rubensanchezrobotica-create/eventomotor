import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import {
  PATCH_BATCH_ID,
  PATCH_EVENT_COUNT,
  MASTER_BACKUP_SHA256,
  MASTER_ROLLBACK_SHA256,
  assertPatchOperations,
  executePatch,
  parsePatchOptions,
  preflightPatch,
  selectManifestEvents,
  timestampsRepresentSameInstant,
  validateApplyConfirmations,
  validatePatchInputs,
  type PatchOptions,
  type PatchRepository,
  type PatchStorage,
} from "./apply-event-enrichment-patch";
import { EVENT_COLUMNS, type ManifestEvent } from "./consolidate-event-enrichment-proposals";
import type { ResearchEventRow } from "./export-future-events-for-enrichment";

const MANIFEST_SHA = "a".repeat(64);
const CONSOLIDATED_SHA = "b".repeat(64);
const HEAD = "674dc40";

function row(id: string, overrides: Partial<ResearchEventRow> = {}): ResearchEventRow {
  return {
    id, slug: `${id}-2026-07-21`, title: `Evento ${id}`, championship: "Prueba", discipline: "Rally", start_date: "2026-07-21", end_date: "2026-07-21",
    venue: "Recinto", city: "Madrid", province: "Madrid", region: "Comunidad de Madrid", country: "ES", level: "Publicado", source: "Organizador",
    source_url: "https://example.com/evento", source_id: null, ticket_url: null, official_url: "https://example.com/evento", registration_url: null,
    image_url: null, image_source_url: null, event_status: "confirmed", short_description: null, long_description: null, schedule_text: null, address: null,
    latitude: null, longitude: null, organizer_name: "Organizador", organizer_url: "https://example.com", verified_at: null, source_type: "organizer",
    confidence_score: 80, needs_review: true, tags: ["rally"], vehicle_type: "coche", featured: false, visible: true, import_method: "batch_import",
    data_quality: "needs_review", notes: null, created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-07-20T00:00:00.000Z", ...overrides,
  };
}

function fields(value: ResearchEventRow) {
  return Object.fromEntries(EVENT_COLUMNS.map((field) => [field, value[field]]));
}

function manifestEvent(current: ResearchEventRow, proposed: Record<string, unknown>, clears: string[] = []): ManifestEvent {
  return {
    id: current.id, slug: current.slug, readiness: "ready_with_warnings", expected_current: fields(current), current_database_values: fields(current),
    proposed_updates: proposed as Record<string, string | number | boolean | string[] | null>, explicit_clears: clears,
    unchanged_fields: EVENT_COLUMNS.filter((field) => !(field in proposed) && !clears.includes(field)), unresolved_fields: ["image_url"], drift: [], conflicts: [], warnings: [],
    sources: ["https://example.com/source"], proposed_confidence_score: 90,
    impact_summary: { changed_fields: [...Object.keys(proposed), ...clears], risk: "low", title_changed: "title" in proposed, dates_changed: "start_date" in proposed || "end_date" in proposed,
      discipline_changed: "discipline" in proposed, source_replaced: false, organizer_changed: clears.includes("organizer_name"), schedule_added: false, address_added: false,
      needs_review_cleared: false, becomes_historical: false, slug_semantically_stale: false, slug_warnings: [] },
  };
}

function fixture() {
  const criticalIds = [
    "pujada-alp-2500-2026-07-25", "batch-rallysprint-betancuria-2026-07-25",
    "batch-xiii-concentracion-vehiculos-clasicos-ciudad-sagunto-2026-07-26", "batch-enduro-comunidad-madrid-ibio-2026-07-26",
    "batch-enduro-indoor-andalucia-olvera-2026-07-26",
  ];
  const ids = [...criticalIds, ...Array.from({ length: 15 }, (_, index) => `event-${index + 6}`)];
  const rows = ids.map((id) => row(id));
  const events = rows.map((current) => {
    if (current.id === criticalIds[0]) return manifestEvent(current, { title: "XV Pujada Alp 2500 2026", start_date: "2026-07-11", end_date: "2026-07-12" });
    if (current.id === criticalIds[1]) return manifestEvent(current, { title: "XIII Subida a Betancuria 2026", discipline: "Subida" });
    if (current.id === criticalIds[2]) return manifestEvent(current, { title: "XII Concentración de Coches y Motos Clásicos Ciudad de Sagunto 2026", schedule_text: "09:00 concentración; 11:30 ruta." });
    if (current.id === criticalIds[3]) return manifestEvent(current, { title: "XI Enduro Cueva del Oso – Sierra de Ibio 2026" }, ["organizer_name"]);
    if (current.id === criticalIds[4]) return manifestEvent(current, { title: "I Enduro Indoor Ciudad de Olvera 2026", start_date: "2026-07-25", end_date: "2026-07-25" });
    return manifestEvent(current, { short_description: `Descripción verificada ${current.id}.` });
  });
  const manifest = { metadata: {}, summary: {}, events };
  const consolidated = { events: events.map((event) => ({ id: event.id, proposed_updates: event.proposed_updates, explicit_clears: Object.fromEntries(event.explicit_clears.map((field) => [field, event.expected_current[field]])) })) };
  return { rows, manifest, consolidated };
}

function options(overrides: Partial<PatchOptions> = {}): PatchOptions {
  return { apply: false, manifestPath: "manifest.json", confirmBatch: null, confirmCount: null, confirmManifestSha256: null, confirmCurrentHead: null, eventId: null, fromIndex: null, toIndex: null, ...overrides };
}

class MemoryStorage implements PatchStorage {
  values = new Map<string, unknown>();
  hashes = new Map<string, string>();
  log: string[];
  constructor(log: string[] = []) { this.log = log; }
  async hasSha256(filePath: string, expectedSha256: string) { return this.hashes.get(filePath) === expectedSha256; }
  async writeJson(filePath: string, value: unknown) { if (this.values.has(filePath)) throw new Error(`Ya existe: ${filePath}`); this.log.push(`write:${filePath}`); this.values.set(filePath, value); }
  async writeText(filePath: string, value: string) { if (this.values.has(filePath)) throw new Error(`Ya existe: ${filePath}`); this.log.push(`write:${filePath}`); this.values.set(filePath, value); }
}

class MemoryRepository implements PatchRepository {
  rows: Map<string, ResearchEventRow>;
  updates: string[] = [];
  requests: Array<{ id: string; expectedUpdatedAt: string }> = [];
  log: string[];
  omitId: string | null = null;
  extraRow: ResearchEventRow | null = null;
  returnNullId: string | null = null;
  verifyMismatchId: string | null = null;
  constructor(rows: ResearchEventRow[], log: string[] = []) { this.rows = new Map(rows.map((item) => [item.id, structuredClone(item)])); this.log = log; }
  async findEventsByIds(ids: string[]) {
    const result = ids.filter((id) => id !== this.omitId).map((id) => structuredClone(this.rows.get(id) as ResearchEventRow));
    if (ids.length === PATCH_EVENT_COUNT && this.extraRow) result.push(structuredClone(this.extraRow));
    if (ids.length === 1 && this.verifyMismatchId === ids[0]) result[0].short_description = "Valor inesperado";
    return result;
  }
  async updateEvent(request: { id: string; expectedUpdatedAt: string; criticalPreconditions: Record<string, string | number | boolean | string[] | null>; changes: Record<string, string | number | boolean | string[] | null>; updatedAt: string }) {
    this.log.push(`update:${request.id}`);
    this.requests.push({ id: request.id, expectedUpdatedAt: request.expectedUpdatedAt });
    if (this.returnNullId === request.id) return null;
    const current = this.rows.get(request.id) as ResearchEventRow;
    if (current.updated_at !== request.expectedUpdatedAt) return null;
    for (const [field, value] of Object.entries(request.criticalPreconditions)) if (!valuesEqualForTest(current[field as keyof ResearchEventRow], value)) return null;
    const updated = { ...current, ...request.changes, updated_at: request.updatedAt } as ResearchEventRow;
    this.rows.set(request.id, updated);
    this.updates.push(request.id);
    return structuredClone(updated);
  }
}

function valuesEqualForTest(left: unknown, right: unknown) { return JSON.stringify(left) === JSON.stringify(right); }

function markApplied(data: ReturnType<typeof fixture>, index = 5) {
  const manifest = data.manifest.events[index];
  const current = data.rows[index];
  Object.assign(current, manifest.proposed_updates);
  for (const field of manifest.explicit_clears) (current as unknown as Record<string, unknown>)[field] = null;
  current.updated_at = "2026-07-20T13:00:00.000Z";
  return { manifest, current };
}

async function execute(overrides: { options?: PatchOptions; repo?: MemoryRepository; storage?: MemoryStorage } = {}) {
  const data = fixture();
  const repo = overrides.repo || new MemoryRepository(data.rows);
  const storage = overrides.storage || new MemoryStorage();
  const report = await executePatch({ manifest: data.manifest, consolidated: data.consolidated, options: overrides.options || options(), manifestSha256: MANIFEST_SHA, consolidatedSha256: CONSOLIDATED_SHA, currentHead: HEAD, repository: repo, storage, now: new Date("2026-07-20T12:00:00.000Z"), outputDir: "out" });
  return { ...data, repo, storage, report };
}

function applyOptions(overrides: Partial<PatchOptions> = {}) {
  return options({ apply: true, confirmBatch: PATCH_BATCH_ID, confirmCount: String(PATCH_EVENT_COUNT), confirmManifestSha256: MANIFEST_SHA, confirmCurrentHead: HEAD, eventId: "event-6", ...overrides });
}

test("dry-run es el modo predeterminado y realiza cero escrituras", async () => {
  const result = await execute();
  assert.equal(result.report.metadata.mode, "dry-run");
  assert.equal(result.report.preflight.found_events, 20);
  assert.equal(result.repo.updates.length, 0);
  assert.equal(result.storage.values.size, 0);
});

test("--apply exige todas las confirmaciones exactas", () => {
  assert.throws(() => validateApplyConfirmations(options({ apply: true }), MANIFEST_SHA, HEAD), /confirm-batch/);
  assert.throws(() => validateApplyConfirmations(applyOptions({ confirmManifestSha256: "bad" }), MANIFEST_SHA, HEAD), /sha256/);
  assert.throws(() => validateApplyConfirmations(applyOptions({ confirmBatch: "otro" }), MANIFEST_SHA, HEAD), /confirm-batch/);
  assert.throws(() => validateApplyConfirmations(applyOptions({ confirmCount: "19" }), MANIFEST_SHA, HEAD), /confirm-count/);
  assert.throws(() => validateApplyConfirmations(applyOptions({ confirmCurrentHead: "bad" }), MANIFEST_SHA, HEAD), /current-head/);
});

test("preflight detecta un evento ausente y uno adicional", () => {
  const data = fixture();
  const missing = preflightPatch(data.manifest, data.rows.slice(1));
  assert.equal(missing.missing.length, 1);
  const additional = preflightPatch(data.manifest, [...data.rows, row("extra")]);
  assert.deepEqual(additional.additional, ["extra"]);
});

test("drift y updated_at distinto bloquean antes de escribir", async () => {
  const data = fixture();
  data.rows[0].title = "Título cambiado";
  assert.equal(preflightPatch(data.manifest, data.rows).events[0].drift.some((item) => item.field === "title"), true);
  const fresh = fixture();
  fresh.rows[0].updated_at = "2026-07-20T01:00:00.000Z";
  assert.equal(preflightPatch(fresh.manifest, fresh.rows).events[0].drift.some((item) => item.field === "updated_at"), true);
  const repo = new MemoryRepository(data.rows);
  const storage = new MemoryStorage();
  await assert.rejects(() => executePatch({ manifest: data.manifest, consolidated: data.consolidated, options: options(), manifestSha256: MANIFEST_SHA, consolidatedSha256: CONSOLIDATED_SHA, currentHead: HEAD, repository: repo, storage }), /Preflight global bloqueado/);
  assert.equal(repo.updates.length, 0);
});

test("rechaza campo inválido, slug y SQL", () => {
  const data = fixture();
  data.manifest.events[0].proposed_updates.invalid_field = "x";
  assert.throws(() => validatePatchInputs(data.manifest, data.consolidated), /campo no autorizado/);
  const slugData = fixture();
  slugData.manifest.events[0].proposed_updates.slug = "nuevo";
  assert.throws(() => validatePatchInputs(slugData.manifest, slugData.consolidated), /slug/);
  const sqlData = fixture();
  (sqlData.manifest as unknown as Record<string, unknown>).sql = "UPDATE events SET title='x'";
  assert.throws(() => validatePatchInputs(sqlData.manifest, sqlData.consolidated), /SQL/);
});

test("un unresolved no borra y el clear explícito de Ibio sí se prepara", () => {
  const data = fixture();
  data.manifest.events[0].unresolved_fields.push("organizer_name");
  const preflight = preflightPatch(data.manifest, data.rows);
  assert.equal("organizer_name" in preflight.events[0].changes, false);
  const ibio = preflight.events.find((item) => item.id === "batch-enduro-comunidad-madrid-ibio-2026-07-26");
  assert.equal(ibio?.changes.organizer_name, null);
  assert.deepEqual(ibio?.manifest.explicit_clears, ["organizer_name"]);
});

test("Enduro Ibio no puede limpiar ningún otro campo", () => {
  const data = fixture();
  const ibio = data.manifest.events.find((item) => item.id === "batch-enduro-comunidad-madrid-ibio-2026-07-26") as ManifestEvent;
  ibio.explicit_clears.push("organizer_url");
  assert.throws(() => validatePatchInputs(data.manifest, data.consolidated), /solo puede limpiar organizer_name/);
});

test("genera backup antes del primer update y rollback con valores anteriores", async () => {
  const log: string[] = [];
  const data = fixture();
  const repo = new MemoryRepository(data.rows, log);
  const storage = new MemoryStorage(log);
  const result = await execute({ options: applyOptions(), repo, storage });
  assert.equal(result.report.summary.applied, 1);
  assert.match(log[0], /before-apply/);
  assert.match(log[1], /rollback-manifest/);
  assert.match(log[2], /^update:/);
  const rollbackEntry = [...storage.values.entries()].find(([name]) => name.includes("rollback-manifest"));
  const rollback = rollbackEntry?.[1] as { events: Array<{ restore_values: Record<string, unknown> }> };
  assert.equal(rollback.events[0].restore_values.short_description, null);
});

test("verificación posterior correcta", async () => {
  const result = await execute({ options: applyOptions() });
  assert.equal(result.report.events[0].verification?.ok, true);
  assert.equal(result.report.events[0].verification?.updated_at_changed, true);
});

test("detecta drift entre preflight y update", async () => {
  const data = fixture();
  const repo = new MemoryRepository(data.rows);
  repo.returnNullId = "event-6";
  const result = await execute({ options: applyOptions(), repo });
  assert.equal(result.report.summary.failed, 1);
  assert.match(result.report.events[0].error || "", /cambió entre preflight/);
  assert.equal(result.report.summary.partial_application, false);
});

test("detecta fallo posterior y lo marca como posible aplicación parcial", async () => {
  const data = fixture();
  const repo = new MemoryRepository(data.rows);
  repo.verifyMismatchId = "event-6";
  const result = await execute({ options: applyOptions(), repo });
  assert.equal(result.report.summary.failed, 1);
  assert.equal(result.report.summary.partial_application, true);
});

test("informa de aplicación parcial y omite eventos posteriores", async () => {
  const data = fixture();
  const repo = new MemoryRepository(data.rows);
  repo.returnNullId = "event-7";
  const result = await execute({ options: applyOptions({ eventId: null, fromIndex: 6, toIndex: 8 }), repo });
  assert.equal(result.report.summary.applied, 1);
  assert.equal(result.report.summary.failed, 1);
  assert.equal(result.report.summary.skipped, 1);
  assert.equal(result.report.summary.partial_application, true);
});

test("filtro por event-id y validación de rangos", () => {
  const data = fixture();
  assert.deepEqual(selectManifestEvents(data.manifest.events, { eventId: "event-6", fromIndex: null, toIndex: null }).map((item) => item.id), ["event-6"]);
  assert.throws(() => selectManifestEvents(data.manifest.events, { eventId: "outside", fromIndex: null, toIndex: null }), /no pertenece/);
  assert.throws(() => parsePatchOptions(["--manifest", "x", "--from-index", "4", "--to-index", "2"]), /rango es inválido/);
});

test("rechaza insert delete upsert RPC y escrituras en dry-run", () => {
  for (const operation of ["insert", "delete", "upsert", "rpc"]) assert.throws(() => assertPatchOperations([operation], true), /no autorizada/);
  assert.throws(() => assertPatchOperations(["update"], false), /no autorizada/);
  assert.doesNotThrow(() => assertPatchOperations(["select", "in"], false));
});

test("timestamps: +02:00 y UTC representan el mismo instante", () => {
  assert.equal(timestampsRepresentSameInstant("2026-07-20T00:00:00+02:00", "2026-07-19T22:00:00+00:00"), true);
});

test("timestamps: Z y +00:00 son equivalentes", () => {
  assert.equal(timestampsRepresentSameInstant("2026-07-20T00:00:00Z", "2026-07-20T00:00:00+00:00"), true);
});

test("timestamps: milisegundos omitidos y .000 son equivalentes", () => {
  assert.equal(timestampsRepresentSameInstant("2026-07-20T00:00:00Z", "2026-07-20T00:00:00.000Z"), true);
});

test("timestamps: instantes diferentes no coinciden", () => {
  assert.equal(timestampsRepresentSameInstant("2026-07-20T00:00:00Z", "2026-07-20T00:00:01Z"), false);
});

test("timestamps: un valor ambiguo o inválido se rechaza", () => {
  assert.throws(() => timestampsRepresentSameInstant("20/07/2026 00:00", "2026-07-20T00:00:00Z"), /inválido/);
  assert.throws(() => timestampsRepresentSameInstant("2026-02-30T00:00:00Z", "2026-03-02T00:00:00Z"), /inválido/);
});

test("timestamps: null solo coincide con null", () => {
  assert.equal(timestampsRepresentSameInstant(null, null), true);
  assert.equal(timestampsRepresentSameInstant(null, "2026-07-20T00:00:00Z"), false);
});

test("evento completamente aplicado queda already_applied_verified", () => {
  const data = fixture();
  const applied = markApplied(data);
  const event = preflightPatch(data.manifest, data.rows).events.find((item) => item.id === applied.current.id);
  assert.equal(event?.classification, "already_applied_verified");
  assert.equal(event?.errors.length, 0);
});

test("evento parcialmente aplicado queda partial_state_conflict", () => {
  const data = fixture();
  data.rows[0].title = String(data.manifest.events[0].proposed_updates.title);
  data.rows[0].updated_at = "2026-07-20T13:00:00.000Z";
  const event = preflightPatch(data.manifest, data.rows).events[0];
  assert.equal(event.classification, "partial_state_conflict");
  assert.match(event.errors.join(" "), /Estado parcial/);
});

test("cambio ajeno al parche queda unrelated_drift", () => {
  const data = fixture();
  const applied = markApplied(data);
  applied.current.city = "Toledo";
  const event = preflightPatch(data.manifest, data.rows).events.find((item) => item.id === applied.current.id);
  assert.equal(event?.classification, "unrelated_drift");
  assert.match(event?.errors.join(" ") || "", /city/);
});

test("already_applied_verified no ejecuta UPDATE", async () => {
  const data = fixture();
  const applied = markApplied(data);
  const repo = new MemoryRepository(data.rows);
  const storage = new MemoryStorage();
  const report = await executePatch({
    manifest: data.manifest, consolidated: data.consolidated, options: applyOptions({ eventId: applied.current.id }),
    manifestSha256: MANIFEST_SHA, consolidatedSha256: CONSOLIDATED_SHA, currentHead: HEAD, repository: repo, storage,
    now: new Date("2026-07-20T12:00:00.000Z"), outputDir: "out",
  });
  assert.equal(report.events[0].status, "already_applied_verified");
  assert.equal(repo.updates.length, 0);
  assert.equal(storage.values.size, 0);
});

test("lote reanudable clasifica uno aplicado y diecinueve pendientes", async () => {
  const data = fixture();
  markApplied(data);
  const repo = new MemoryRepository(data.rows);
  const storage = new MemoryStorage();
  const report = await executePatch({
    manifest: data.manifest, consolidated: data.consolidated, options: options(), manifestSha256: MANIFEST_SHA,
    consolidatedSha256: CONSOLIDATED_SHA, currentHead: HEAD, repository: repo, storage,
    now: new Date("2026-07-20T12:00:00.000Z"), outputDir: "out",
  });
  assert.equal(report.preflight.already_applied_events, 1);
  assert.equal(report.preflight.pending_events, 19);
  assert.equal(report.summary.pending, 19);
  assert.equal(repo.updates.length, 0);
  assert.equal(storage.values.size, 0);
});

test("una futura reanudación preserva el backup maestro y crea backup solo en apply", async () => {
  const data = fixture();
  markApplied(data);
  const dryStorage = new MemoryStorage();
  await executePatch({
    manifest: data.manifest, consolidated: data.consolidated, options: options(), manifestSha256: MANIFEST_SHA,
    consolidatedSha256: CONSOLIDATED_SHA, currentHead: HEAD, repository: new MemoryRepository(data.rows), storage: dryStorage,
    now: new Date("2026-07-20T12:00:00.000Z"), outputDir: "out",
  });
  assert.equal(dryStorage.values.size, 0);

  const storage = new MemoryStorage();
  const masterPath = path.join("out", "backups", `${PATCH_BATCH_ID}-before-apply-20260720T191307Z.json`);
  const masterRollbackPath = path.join("out", "backups", `${PATCH_BATCH_ID}-rollback-manifest-20260720T191307Z.json`);
  const master = { protected: true };
  storage.values.set(masterPath, master);
  storage.values.set(masterRollbackPath, { protected: true });
  storage.hashes.set(masterPath, MASTER_BACKUP_SHA256);
  storage.hashes.set(masterRollbackPath, MASTER_ROLLBACK_SHA256);
  const report = await executePatch({
    manifest: data.manifest, consolidated: data.consolidated, options: applyOptions({ eventId: null }), manifestSha256: MANIFEST_SHA,
    consolidatedSha256: CONSOLIDATED_SHA, currentHead: HEAD, repository: new MemoryRepository(data.rows), storage,
    now: new Date("2026-07-20T12:00:00.000Z"), outputDir: "out",
  });
  assert.equal(storage.values.get(masterPath), master);
  assert.match(report.backup_path || "", /before-resume/);
  const rollbackEntry = [...storage.values.entries()].find(([name]) => name.includes("resume-rollback-manifest"));
  const rollback = rollbackEntry?.[1] as { events: unknown[] };
  assert.equal(rollback.events.length, 19);
});

test("updated_at de concurrencia conserva exactamente el valor del preflight", async () => {
  const data = fixture();
  const expected = data.rows[5].updated_at;
  const repo = new MemoryRepository(data.rows);
  await executePatch({
    manifest: data.manifest, consolidated: data.consolidated, options: applyOptions(), manifestSha256: MANIFEST_SHA,
    consolidatedSha256: CONSOLIDATED_SHA, currentHead: HEAD, repository: repo, storage: new MemoryStorage(),
    now: new Date("2026-07-20T12:00:00.000Z"), outputDir: "out",
  });
  assert.equal(repo.requests[0].expectedUpdatedAt, expected);
});

test("la creación exclusiva impide sobrescribir un backup", async () => {
  const storage = new MemoryStorage();
  storage.values.set("backup.json", { original: true });
  await assert.rejects(() => storage.writeJson("backup.json", { replacement: true }), /Ya existe/);
  assert.deepEqual(storage.values.get("backup.json"), { original: true });
});

test("una reanudación se bloquea si faltan los artefactos maestros", async () => {
  const data = fixture();
  markApplied(data);
  const repo = new MemoryRepository(data.rows);
  const storage = new MemoryStorage();
  await assert.rejects(() => executePatch({
    manifest: data.manifest, consolidated: data.consolidated, options: applyOptions({ eventId: null }), manifestSha256: MANIFEST_SHA,
    consolidatedSha256: CONSOLIDATED_SHA, currentHead: HEAD, repository: repo, storage,
    now: new Date("2026-07-20T12:00:00.000Z"), outputDir: "out",
  }), /backup o rollback maestro/);
  assert.equal(repo.updates.length, 0);
  assert.equal(storage.values.size, 0);
});
