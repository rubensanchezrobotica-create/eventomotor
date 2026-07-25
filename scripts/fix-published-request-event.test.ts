import assert from "node:assert/strict";
import test from "node:test";
import type { EventRow } from "@/lib/supabase";
import {
  EXPECTED_CURRENT_UPDATED_AT,
  PROPOSED_PATCH,
  TARGET_REQUEST_ID,
  TARGET_SLUG,
  executePatch,
  parseOptions,
  patchSha256,
  type PatchRepository,
  type PatchStorage,
} from "./fix-published-request-event";

function eventRow(overrides: Partial<EventRow> = {}): EventRow {
  return {
    id: `admin-${TARGET_SLUG}`,
    slug: TARGET_SLUG,
    title: "Concentración de Coches",
    championship: "Naiara",
    discipline: "Concentraciones",
    start_date: "2026-09-12",
    end_date: "2026-09-12",
    venue: "Lago de Barañain (Parque de la construcción)",
    city: "Barañáin",
    province: "Navarra",
    region: "Navarra",
    country: null,
    level: "Publicado",
    source: "Naiara",
    source_url: "https://www.instagram.com/clasicosbara?igsh=MWFubXdiZTNia2ExaA==",
    ticket_url: "https://611636103",
    official_url: null,
    registration_url: null,
    image_url: null,
    image_source_url: null,
    event_status: null,
    short_description: null,
    long_description: null,
    schedule_text: null,
    address: null,
    latitude: null,
    longitude: null,
    organizer_name: null,
    organizer_url: null,
    verified_at: null,
    source_type: null,
    confidence_score: null,
    needs_review: null,
    tags: ["Concentraciones", "Feria del motor", "Barañáin", "Navarra"],
    vehicle_type: "coche",
    featured: false,
    visible: false,
    import_method: "admin-event-submission",
    data_quality: "published",
    notes: "Descripción editorial\nEmail contacto: privado@example.com\nSolicitud origen: b008383e-d4d0-4bfe-a613-894057664286",
    created_at: "2026-07-25T17:43:17.653542+00:00",
    updated_at: EXPECTED_CURRENT_UPDATED_AT,
    ...overrides,
  };
}

class MemoryStorage implements PatchStorage {
  entries: Array<{ path: string; value: unknown }> = [];
  log: string[];
  constructor(log: string[] = []) {
    this.log = log;
  }
  async writeJson(filePath: string, value: unknown) {
    this.log.push(`write:${filePath}`);
    this.entries.push({ path: filePath, value: structuredClone(value) });
  }
}

class MemoryRepository implements PatchRepository {
  row: EventRow;
  updates = 0;
  log: string[];
  returnNoRows = false;
  keepOldTimestamp = false;
  expectedUpdatedAtFilter: string | null = null;
  payload: Record<string, unknown> | null = null;
  constructor(row = eventRow(), log: string[] = []) {
    this.row = row;
    this.log = log;
  }
  async findBySlug() {
    return [structuredClone(this.row)];
  }
  async updateBySlugAndUpdatedAt(slug: string, updatedAt: string, patch: Record<string, unknown>) {
    this.log.push("update");
    this.expectedUpdatedAtFilter = updatedAt;
    this.payload = structuredClone(patch);
    if (this.returnNoRows || slug !== this.row.slug || updatedAt !== this.row.updated_at) return [];
    this.updates += 1;
    const previousUpdatedAt = this.row.updated_at;
    this.row = {
      ...this.row,
      ...patch,
      updated_at: this.keepOldTimestamp ? previousUpdatedAt : String(patch.updated_at),
    } as EventRow;
    return [structuredClone(this.row)];
  }
}

function applyOptions() {
  return parseOptions([
    "--apply",
    "--confirm-slug", TARGET_SLUG,
    "--confirm-request-id", TARGET_REQUEST_ID,
    "--confirm-current-updated-at", EXPECTED_CURRENT_UPDATED_AT,
    "--confirm-patch-sha256", patchSha256(),
  ]);
}

test("dry-run es predeterminado, preserva slug y realiza cero escrituras", async () => {
  const repository = new MemoryRepository();
  const storage = new MemoryStorage();
  const result = await executePatch({ options: parseOptions([]), repository, storage });

  assert.equal(result.mode, "dry-run");
  assert.equal(result.writes, 0);
  assert.equal(repository.updates, 0);
  assert.equal(storage.entries.length, 0);
  assert.equal(result.current.slug, TARGET_SLUG);
  assert.equal(result.current.updated_at, EXPECTED_CURRENT_UPDATED_AT);
  assert.equal(repository.row.updated_at, EXPECTED_CURRENT_UPDATED_AT);
  assert.equal(result.plan.changes.some(({ field }) => field === "slug"), false);
});

test("drift bloquea incluso el dry-run antes de cualquier escritura", async () => {
  const repository = new MemoryRepository(eventRow({ title: "Título cambiado por otra persona" }));
  const storage = new MemoryStorage();
  await assert.rejects(executePatch({ options: parseOptions([]), repository, storage }), /Drift detectado/);
  assert.equal(repository.updates, 0);
  assert.equal(storage.entries.length, 0);
});

test("apply exige todas las confirmaciones exactas", async () => {
  await assert.rejects(
    executePatch({
      options: parseOptions(["--apply"]),
      repository: new MemoryRepository(),
      storage: new MemoryStorage(),
    }),
    /confirm-slug/,
  );
});

test("backup y rollback se generan antes del update y restauran valores actuales", async () => {
  const log: string[] = [];
  const repository = new MemoryRepository(eventRow(), log);
  const storage = new MemoryStorage(log);
  const result = await executePatch({
    options: applyOptions(),
    repository,
    storage,
    backupDirectory: "backups",
    now: new Date("2026-07-25T18:30:00.000Z"),
  });

  assert.equal(result.mode, "apply");
  assert.equal(repository.updates, 1);
  assert.match(log[0], /backup\.json$/);
  assert.match(log[1], /rollback\.json$/);
  assert.equal(log[2], "update");
  const rollback = storage.entries[1].value as { restore_values: Record<string, unknown> };
  assert.equal(rollback.restore_values.title, "Concentración de Coches");
  assert.equal(rollback.restore_values.notes, eventRow().notes);
  assert.equal(repository.row.slug, TARGET_SLUG);
  assert.equal(repository.expectedUpdatedAtFilter, EXPECTED_CURRENT_UPDATED_AT);
  assert.equal(repository.payload?.updated_at, "2026-07-25T18:30:00.000Z");
  assert.notEqual(repository.row.updated_at, EXPECTED_CURRENT_UPDATED_AT);
  for (const [field, value] of Object.entries(PROPOSED_PATCH)) {
    assert.deepEqual(repository.row[field as keyof EventRow], value);
  }
});

test("drift concurrente de updated_at bloquea el update", async () => {
  const repository = new MemoryRepository();
  repository.returnNoRows = true;
  await assert.rejects(
    executePatch({ options: applyOptions(), repository, storage: new MemoryStorage() }),
    /bloqueado por drift de updated_at/,
  );
});

test("la verificación posterior rechaza una fila cuyo updated_at no cambió", async () => {
  const repository = new MemoryRepository();
  repository.keepOldTimestamp = true;
  await assert.rejects(
    executePatch({
      options: applyOptions(),
      repository,
      storage: new MemoryStorage(),
      now: new Date("2026-07-25T18:30:00.000Z"),
    }),
    /updated_at no cambió/,
  );
});
