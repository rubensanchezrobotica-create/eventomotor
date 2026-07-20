import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadEnvConfig } from "@next/env";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  EVENT_COLUMNS,
  validateProposal,
  type EventColumn,
  type ManifestEvent,
} from "./consolidate-event-enrichment-proposals";
import { ENRICHMENT_TIME_ZONE, type ResearchEventRow } from "./export-future-events-for-enrichment";

const execFileAsync = promisify(execFile);
export const PATCH_BATCH_ID = "lote-investigacion-001";
export const PATCH_EVENT_COUNT = 20;
export const MASTER_BACKUP_SHA256 = "406a9de51013102667eee3e25359f78137ebce1ac1bc3148c2d8f496f8ce6fdc";
export const MASTER_ROLLBACK_SHA256 = "d53afe240730735d210f1529fe3b28dd033596b478d61cc06a0b42e02e0e998a";
export const DRY_RUN_OPERATIONS = ["select", "in"] as const;
export const APPLY_OPERATIONS = ["select", "in", "update", "eq", "is"] as const;

type FieldValue = string | number | boolean | string[] | null;
type FieldRecord = Record<string, FieldValue>;
export type PreflightClassification = "pending_ready" | "already_applied_verified" | "partial_state_conflict" | "unrelated_drift";
type PatchManifest = {
  metadata: Record<string, unknown> & { safety?: { selected_ids?: string[]; slug_updates_allowed?: boolean } };
  summary: Record<string, unknown>;
  events: ManifestEvent[];
};
type ConsolidatedInput = { metadata?: Record<string, unknown>; events: Array<{ id: string; proposed_updates: FieldRecord; explicit_clears: Record<string, FieldValue> }> };

export type PatchOptions = {
  apply: boolean;
  manifestPath: string;
  confirmBatch: string | null;
  confirmCount: string | null;
  confirmManifestSha256: string | null;
  confirmCurrentHead: string | null;
  eventId: string | null;
  fromIndex: number | null;
  toIndex: number | null;
};

export type PreflightEvent = {
  id: string;
  manifest: ManifestEvent;
  current: ResearchEventRow;
  changes: FieldRecord;
  critical_preconditions: FieldRecord;
  classification: PreflightClassification;
  already_applied_fields: string[];
  pending_fields: string[];
  drift: Array<{ field: string; expected: FieldValue; current: FieldValue }>;
  errors: string[];
};

export type PatchExecutionReport = {
  metadata: {
    batch: string;
    mode: "dry-run" | "apply";
    generated_at: string;
    timezone: string;
    manifest_path: string;
    manifest_sha256: string;
    consolidated_sha256: string;
    git_head: string;
    selected_ids: string[];
    operations: readonly string[];
    supabase_writes: boolean;
  };
  preflight: {
    expected_events: number;
    found_events: number;
    valid_preconditions: number;
    drifted_events: number;
    blocked_events: number;
    predicted_changes: number;
    total_manifest_changes: number;
    already_applied_events: number;
    pending_events: number;
    partial_state_conflicts: number;
    unrelated_drift: number;
    already_applied_changes: number;
    pending_changes: number;
    errors: string[];
  };
  planned_backup: string;
  planned_rollback: string;
  master_backup_path: string | null;
  master_rollback_path: string | null;
  backup_path: string | null;
  rollback_path: string | null;
  backup_sha256: string | null;
  events: Array<{
    id: string;
    status: "dry_run_ready" | "already_applied_verified" | "applied" | "skipped" | "failed";
    fields: string[];
    preconditions: FieldRecord;
    verification: { ok: boolean; updated_at_changed: boolean; differences: string[] } | null;
    error: string | null;
  }>;
  summary: {
    attempted: number;
    applied: number;
    skipped: number;
    failed: number;
    fields_changed: number;
    partial_application: boolean;
    slug_changes: number;
    already_applied: number;
    pending: number;
    updates_returned: number;
  };
};

export interface PatchRepository {
  findEventsByIds(ids: string[]): Promise<ResearchEventRow[]>;
  updateEvent(request: {
    id: string;
    expectedUpdatedAt: string;
    criticalPreconditions: FieldRecord;
    changes: FieldRecord;
    updatedAt: string;
  }): Promise<ResearchEventRow | null>;
}

export interface PatchStorage {
  writeJson(filePath: string, value: unknown): Promise<void>;
  writeText(filePath: string, value: string): Promise<void>;
  hasSha256(filePath: string, expectedSha256: string): Promise<boolean>;
}

type ApplyDatabase = {
  public: {
    Tables: {
      events: {
        Row: ResearchEventRow;
        Insert: never;
        Update: Partial<ResearchEventRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

const MUTABLE_COLUMNS = new Set<EventColumn>(EVENT_COLUMNS.filter((field) => !["id", "slug", "created_at", "updated_at"].includes(field)));
const CRITICAL_COLUMNS = new Set<EventColumn>(["title", "start_date", "end_date", "discipline", "organizer_name", "official_url"]);
const TIMESTAMPTZ_COLUMNS = new Set<EventColumn>(["created_at", "updated_at", "verified_at"]);
const REQUIRED_CONFIRMATIONS = ["--confirm-batch", "--confirm-count", "--confirm-manifest-sha256", "--confirm-current-head"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cloneValue(value: unknown): FieldValue {
  return Array.isArray(value) ? value.map(String) : value as FieldValue;
}

function valuesEqual(left: unknown, right: unknown) {
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((value, index) => value === right[index]);
  }
  return left === right;
}

const ISO_INSTANT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|([+-])(\d{2}):(\d{2}))$/;

function timestampEpoch(value: string) {
  const match = ISO_INSTANT_PATTERN.exec(value);
  if (!match) throw new Error(`Timestamp ISO inválido: ${value}.`);
  const [, yearRaw, monthRaw, dayRaw, hourRaw, minuteRaw, secondRaw, , zone, , offsetHourRaw, offsetMinuteRaw] = match;
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  const second = Number(secondRaw);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth || hour > 23 || minute > 59 || second > 59) {
    throw new Error(`Timestamp ISO inválido: ${value}.`);
  }
  if (zone !== "Z") {
    const offsetHour = Number(offsetHourRaw);
    const offsetMinute = Number(offsetMinuteRaw);
    if (offsetHour > 14 || offsetMinute > 59 || (offsetHour === 14 && offsetMinute !== 0)) throw new Error(`Timestamp ISO inválido: ${value}.`);
  }
  const epoch = Date.parse(value);
  if (!Number.isFinite(epoch)) throw new Error(`Timestamp ISO inválido: ${value}.`);
  return epoch;
}

export function timestampsRepresentSameInstant(left: string | null, right: string | null) {
  if (left === null || right === null) return left === right;
  if (typeof left !== "string" || typeof right !== "string") throw new Error("Los timestamps deben ser strings ISO o null.");
  return timestampEpoch(left) === timestampEpoch(right);
}

function valuesEqualForField(field: string, left: unknown, right: unknown) {
  if (TIMESTAMPTZ_COLUMNS.has(field as EventColumn)) return timestampsRepresentSameInstant(left as string | null, right as string | null);
  return valuesEqual(left, right);
}

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function timestampForFile(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function getArg(args: string[], name: string) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] ?? null : null;
}

export function parsePatchOptions(args: string[]): PatchOptions {
  const valueFlags = new Set(["--manifest", ...REQUIRED_CONFIRMATIONS, "--event-id", "--from-index", "--to-index"]);
  const booleanFlags = new Set(["--apply"]);
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (booleanFlags.has(arg)) continue;
    if (!valueFlags.has(arg)) throw new Error(`Argumento no reconocido: ${arg}.`);
    if (!args[index + 1] || args[index + 1].startsWith("--")) throw new Error(`Falta el valor de ${arg}.`);
    index += 1;
  }
  const parseIndex = (name: string) => {
    const raw = getArg(args, name);
    if (raw === null) return null;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 1) throw new Error(`${name} debe ser un entero desde 1.`);
    return value;
  };
  const manifestPath = getArg(args, "--manifest");
  if (!manifestPath) throw new Error("--manifest es obligatorio.");
  const eventId = getArg(args, "--event-id");
  const fromIndex = parseIndex("--from-index");
  const toIndex = parseIndex("--to-index");
  if (eventId && (fromIndex !== null || toIndex !== null)) throw new Error("--event-id no puede combinarse con un rango.");
  if ((fromIndex === null) !== (toIndex === null)) throw new Error("--from-index y --to-index deben usarse juntos.");
  if (fromIndex !== null && toIndex !== null && fromIndex > toIndex) throw new Error("El rango es inválido: from-index es mayor que to-index.");
  return {
    apply: args.includes("--apply"), manifestPath,
    confirmBatch: getArg(args, "--confirm-batch"), confirmCount: getArg(args, "--confirm-count"),
    confirmManifestSha256: getArg(args, "--confirm-manifest-sha256"), confirmCurrentHead: getArg(args, "--confirm-current-head"),
    eventId, fromIndex, toIndex,
  };
}

export function validateApplyConfirmations(options: PatchOptions, manifestSha256: string, currentHead: string) {
  if (!options.apply) return;
  const errors: string[] = [];
  if (options.confirmBatch !== PATCH_BATCH_ID) errors.push(`--confirm-batch debe ser exactamente ${PATCH_BATCH_ID}.`);
  if (options.confirmCount !== String(PATCH_EVENT_COUNT)) errors.push(`--confirm-count debe ser exactamente ${PATCH_EVENT_COUNT}.`);
  if (options.confirmManifestSha256 !== manifestSha256) errors.push("--confirm-manifest-sha256 no coincide exactamente con el manifiesto.");
  if (options.confirmCurrentHead !== currentHead) errors.push("--confirm-current-head no coincide exactamente con HEAD.");
  if (errors.length) throw new Error(`Aplicación rechazada antes del preflight:\n- ${errors.join("\n- ")}`);
}

export function assertPatchOperations(operations: readonly string[], apply: boolean) {
  const allowed = new Set<string>(apply ? APPLY_OPERATIONS : DRY_RUN_OPERATIONS);
  const forbidden = operations.filter((operation) => !allowed.has(operation));
  if (forbidden.length) throw new Error(`Operación no autorizada: ${forbidden.join(", ")}.`);
}

function containsExecutableSql(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsExecutableSql);
  if (isRecord(value)) return Object.entries(value).some(([key, item]) => /^(sql|query|statement)$/i.test(key) || containsExecutableSql(item));
  return typeof value === "string" && /^\s*(?:insert\s+into|update\s+events|delete\s+from|upsert|alter\s+table|drop\s+table|create\s+table)\b/i.test(value);
}

export function validatePatchInputs(manifest: PatchManifest, consolidated: ConsolidatedInput) {
  const errors: string[] = [];
  if (!Array.isArray(manifest.events) || manifest.events.length !== PATCH_EVENT_COUNT) errors.push(`El manifiesto debe contener exactamente ${PATCH_EVENT_COUNT} eventos.`);
  if (!Array.isArray(consolidated.events) || consolidated.events.length !== PATCH_EVENT_COUNT) errors.push(`El consolidado debe contener exactamente ${PATCH_EVENT_COUNT} eventos.`);
  const manifestIds = Array.isArray(manifest.events) ? manifest.events.map((event) => event.id) : [];
  const consolidatedIds = Array.isArray(consolidated.events) ? consolidated.events.map((event) => event.id) : [];
  if (new Set(manifestIds).size !== manifestIds.length) errors.push("El manifiesto contiene IDs duplicados.");
  if (new Set(consolidatedIds).size !== consolidatedIds.length) errors.push("El consolidado contiene IDs duplicados.");
  if (manifestIds.join("|") !== consolidatedIds.join("|")) errors.push("El orden o los IDs del manifiesto y del consolidado no coinciden.");
  if (containsExecutableSql(manifest) || containsExecutableSql(consolidated)) errors.push("Los archivos de entrada no pueden contener SQL ejecutable.");

  for (const [index, event] of (manifest.events || []).entries()) {
    if (!isRecord(event.expected_current) || !isRecord(event.current_database_values) || !isRecord(event.proposed_updates)) {
      errors.push(`${event.id}: expected_current, current_database_values y proposed_updates deben ser objetos.`);
      continue;
    }
    if ("slug" in event.proposed_updates) errors.push(`${event.id}: el slug no puede estar en proposed_updates.`);
    if (event.explicit_clears.some((field) => field === "slug" || !MUTABLE_COLUMNS.has(field as EventColumn))) errors.push(`${event.id}: explicit_clears contiene un campo no autorizado.`);
    for (const [field, value] of Object.entries(event.proposed_updates)) {
      if (!MUTABLE_COLUMNS.has(field as EventColumn)) errors.push(`${event.id}: campo no autorizado ${field}.`);
      if (value === null) errors.push(`${event.id}: ${field}=null debe expresarse mediante explicit_clears.`);
    }
    const consolidatedEvent = consolidated.events[index];
    if (consolidatedEvent && JSON.stringify(event.proposed_updates) !== JSON.stringify(consolidatedEvent.proposed_updates)) errors.push(`${event.id}: proposed_updates difiere del consolidado.`);
    if (consolidatedEvent && [...event.explicit_clears].sort().join("|") !== Object.keys(consolidatedEvent.explicit_clears).sort().join("|")) errors.push(`${event.id}: explicit_clears difiere del consolidado.`);
    const validation = validateProposal({
      id: event.id,
      proposed_updates: event.proposed_updates,
      clear_or_replace_current_values: event.explicit_clears.length
        ? { ...Object.fromEntries(event.explicit_clears.map((field) => [field, event.expected_current[field]])), reason: "Validación del manifiesto consolidado." }
        : undefined,
      unresolved: event.unresolved_fields,
      sources: event.sources,
    });
    errors.push(...validation.validation_errors.map((error) => `${event.id}: ${error}`));
  }

  const ibio = manifest.events?.find((event) => event.id === "batch-enduro-comunidad-madrid-ibio-2026-07-26");
  if (!ibio || ibio.explicit_clears.join("|") !== "organizer_name") errors.push("Enduro Ibio solo puede limpiar organizer_name.");
  for (const event of manifest.events || []) {
    if (event.id !== ibio?.id && event.explicit_clears.length) errors.push(`${event.id}: no tiene limpiezas explícitas autorizadas para este lote.`);
  }

  const criticalChecks: Array<[string, string, FieldValue]> = [
    ["pujada-alp-2500-2026-07-25", "start_date", "2026-07-11"],
    ["pujada-alp-2500-2026-07-25", "end_date", "2026-07-12"],
    ["batch-rallysprint-betancuria-2026-07-25", "discipline", "Subida"],
    ["batch-enduro-indoor-andalucia-olvera-2026-07-26", "start_date", "2026-07-25"],
    ["batch-enduro-indoor-andalucia-olvera-2026-07-26", "end_date", "2026-07-25"],
  ];
  for (const [id, field, expected] of criticalChecks) {
    if (!valuesEqual(manifest.events?.find((event) => event.id === id)?.proposed_updates[field], expected)) errors.push(`${id}: corrección crítica inválida en ${field}.`);
  }
  const alp = manifest.events?.find((event) => event.id === "pujada-alp-2500-2026-07-25");
  if (alp && "event_status" in alp.proposed_updates) errors.push("Pujada Alp no puede inventar event_status=completed.");
  const sagunto = manifest.events?.find((event) => event.id === "batch-xiii-concentracion-vehiculos-clasicos-ciudad-sagunto-2026-07-26");
  if (!String(sagunto?.proposed_updates.title || "").startsWith("XII ") || String(sagunto?.proposed_updates.schedule_text || "").includes("10:00")) errors.push("Sagunto no conserva la corrección editorial validada.");

  if (errors.length) throw new Error(`Manifiesto no aplicable:\n- ${[...new Set(errors)].join("\n- ")}`);
}

export function selectManifestEvents(events: ManifestEvent[], options: Pick<PatchOptions, "eventId" | "fromIndex" | "toIndex">) {
  if (options.eventId) {
    const selected = events.find((event) => event.id === options.eventId);
    if (!selected) throw new Error(`--event-id no pertenece al manifiesto: ${options.eventId}.`);
    return [selected];
  }
  if (options.fromIndex !== null && options.toIndex !== null) {
    if (options.toIndex > events.length) throw new Error(`El rango supera los ${events.length} eventos del manifiesto.`);
    return events.slice(options.fromIndex - 1, options.toIndex);
  }
  return [...events];
}

function buildChanges(event: ManifestEvent) {
  const changes: FieldRecord = { ...event.proposed_updates };
  for (const field of event.explicit_clears) changes[field] = null;
  return changes;
}

export function preflightPatch(manifest: PatchManifest, currentRows: ResearchEventRow[]) {
  const errors: string[] = [];
  const expectedIds = manifest.events.map((event) => event.id);
  const expectedSet = new Set(expectedIds);
  const currentIds = currentRows.map((event) => event.id);
  const missing = expectedIds.filter((id) => !currentIds.includes(id));
  const additional = currentIds.filter((id) => !expectedSet.has(id));
  const duplicates = currentIds.filter((id, index) => currentIds.indexOf(id) !== index);
  if (currentRows.length !== PATCH_EVENT_COUNT) errors.push(`Supabase devolvió ${currentRows.length} filas; se esperaban ${PATCH_EVENT_COUNT}.`);
  if (missing.length) errors.push(`Faltan eventos: ${missing.join(", ")}.`);
  if (additional.length) errors.push(`Aparecieron IDs adicionales: ${additional.join(", ")}.`);
  if (duplicates.length) errors.push(`Supabase devolvió IDs duplicados: ${[...new Set(duplicates)].join(", ")}.`);
  const currentById = new Map(currentRows.map((event) => [event.id, event]));
  const events: PreflightEvent[] = [];

  for (const manifestEvent of manifest.events) {
    const current = currentById.get(manifestEvent.id);
    if (!current) continue;
    const drift: PreflightEvent["drift"] = [];
    const eventErrors: string[] = [];
    const changes = buildChanges(manifestEvent);
    const effectiveFields = Object.keys(changes).filter((field) => !valuesEqualForField(field, manifestEvent.expected_current[field], changes[field]));
    const alreadyAppliedFields: string[] = [];
    const pendingFields: string[] = [];
    const conflictingPatchFields: string[] = [];
    const unrelatedFields: string[] = [];
    let classification: PreflightClassification = "pending_ready";

    try {
      for (const field of effectiveFields) {
        const actual = cloneValue(current[field as EventColumn]);
        const expected = manifestEvent.expected_current[field];
        if (valuesEqualForField(field, actual, changes[field])) alreadyAppliedFields.push(field);
        else if (valuesEqualForField(field, actual, expected)) pendingFields.push(field);
        else conflictingPatchFields.push(field);
      }
      for (const field of EVENT_COLUMNS) {
        if (effectiveFields.includes(field) || field === "updated_at") continue;
        const expected = manifestEvent.expected_current[field];
        const actual = cloneValue(current[field]);
        if (!valuesEqualForField(field, expected, actual)) unrelatedFields.push(field);
      }
      if (conflictingPatchFields.length || (alreadyAppliedFields.length > 0 && pendingFields.length > 0)) {
        classification = "partial_state_conflict";
      } else if (unrelatedFields.length) {
        classification = "unrelated_drift";
      } else if (effectiveFields.length > 0 && alreadyAppliedFields.length === effectiveFields.length) {
        classification = "already_applied_verified";
      } else {
        const expectedUpdatedAt = manifestEvent.expected_current.updated_at;
        if (!valuesEqualForField("updated_at", current.updated_at, expectedUpdatedAt)) unrelatedFields.push("updated_at");
        classification = unrelatedFields.length ? "unrelated_drift" : "pending_ready";
      }
      for (const field of EVENT_COLUMNS) {
        const expected = manifestEvent.expected_current[field];
        const actual = cloneValue(current[field]);
        if (!valuesEqualForField(field, expected, actual)) drift.push({ field, expected, current: actual });
      }
    } catch (error: unknown) {
      classification = "partial_state_conflict";
      eventErrors.push(error instanceof Error ? error.message : String(error));
    }

    if (classification === "partial_state_conflict") {
      const fields = [...new Set([...alreadyAppliedFields, ...pendingFields, ...conflictingPatchFields])];
      eventErrors.push(`Estado parcial conflictivo en ${fields.join(", ") || "campos temporales"}.`);
    }
    if (classification === "unrelated_drift") eventErrors.push(`Drift ajeno al parche en ${unrelatedFields.join(", ")}.`);
    if (manifestEvent.readiness.startsWith("blocked")) eventErrors.push(`El manifiesto clasifica el evento como ${manifestEvent.readiness}.`);
    if ("slug" in changes || "id" in changes || "created_at" in changes) eventErrors.push("La actualización contiene un campo protegido.");
    for (const field of manifestEvent.explicit_clears) {
      const clearSatisfied = current[field as EventColumn] === null;
      const clearPending = valuesEqualForField(field, current[field as EventColumn], manifestEvent.expected_current[field]);
      if (!clearSatisfied && !clearPending) eventErrors.push(`La precondición del clear ${field} no coincide.`);
    }
    const criticalPreconditions = Object.fromEntries(
      Object.keys(changes).filter((field) => CRITICAL_COLUMNS.has(field as EventColumn)).map((field) => [field, cloneValue(current[field as EventColumn])]),
    ) as FieldRecord;
    events.push({
      id: manifestEvent.id, manifest: manifestEvent, current, changes, critical_preconditions: criticalPreconditions,
      classification, already_applied_fields: alreadyAppliedFields.sort(), pending_fields: pendingFields.sort(), drift, errors: eventErrors,
    });
    errors.push(...eventErrors.map((error) => `${manifestEvent.id}: ${error}`));
  }
  return { events, errors, missing, additional };
}

export class SupabasePatchRepository implements PatchRepository {
  constructor(private readonly supabase: SupabaseClient<ApplyDatabase>) {}

  async findEventsByIds(ids: string[]) {
    assertPatchOperations(DRY_RUN_OPERATIONS, false);
    const { data, error } = await this.supabase.from("events").select(EVENT_COLUMNS.join(",")).in("id", ids);
    if (error) throw new Error(`SELECT de preflight falló: ${error.message}`);
    return (data || []) as unknown as ResearchEventRow[];
  }

  async updateEvent(request: { id: string; expectedUpdatedAt: string; criticalPreconditions: FieldRecord; changes: FieldRecord; updatedAt: string }) {
    assertPatchOperations(["update", "eq", "is", "select"], true);
    let query = this.supabase
      .from("events")
      .update({ ...request.changes, updated_at: request.updatedAt } as Partial<ResearchEventRow>)
      .eq("id", request.id)
      .eq("updated_at", request.expectedUpdatedAt);
    for (const [field, value] of Object.entries(request.criticalPreconditions)) {
      query = value === null ? query.is(field, null) : query.eq(field, value as string | number | boolean);
    }
    const { data, error } = await query.select(EVENT_COLUMNS.join(","));
    if (error) throw new Error(`UPDATE rechazado para ${request.id}: ${error.message}`);
    if (!data?.length) return null;
    if (data.length !== 1) throw new Error(`UPDATE de ${request.id} afectó ${data.length} filas.`);
    return data[0] as unknown as ResearchEventRow;
  }
}

export class FilePatchStorage implements PatchStorage {
  async hasSha256(filePath: string, expectedSha256: string) {
    try {
      return sha256(await readFile(filePath)) === expectedSha256;
    } catch (error: unknown) {
      if (isRecord(error) && error.code === "ENOENT") return false;
      throw error;
    }
  }

  async writeJson(filePath: string, value: unknown) {
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  }

  async writeText(filePath: string, value: string) {
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, value, { encoding: "utf8", flag: "wx" });
  }
}

function createBackup(preflight: PreflightEvent[], manifestSha256: string, currentHead: string, generatedAt: string) {
  return {
    metadata: { batch: PATCH_BATCH_ID, manifest_sha256: manifestSha256, git_head: currentHead, generated_at: generatedAt, timezone: ENRICHMENT_TIME_ZONE },
    events: preflight.map((event) => ({ id: event.id, fields_to_modify: Object.keys(event.changes).sort(), current_database_values: event.current })),
  };
}

function createRollback(preflight: PreflightEvent[], manifestSha256: string, currentHead: string, generatedAt: string) {
  return {
    metadata: { batch: PATCH_BATCH_ID, manifest_sha256: manifestSha256, git_head: currentHead, generated_at: generatedAt, timezone: ENRICHMENT_TIME_ZONE, executable: false },
    events: preflight.map((event) => ({
      id: event.id,
      slug: event.current.slug,
      restore_values: Object.fromEntries(Object.keys(event.changes).map((field) => [field, cloneValue(event.current[field as EventColumn])])),
      expected_updated_at_before_apply: event.current.updated_at,
    })),
  };
}

function verifyAppliedEvent(before: ResearchEventRow, after: ResearchEventRow, changes: FieldRecord) {
  const differences = Object.entries(changes).filter(([field, value]) => !valuesEqualForField(field, after[field as EventColumn], value)).map(([field]) => field);
  const updatedAtChanged = !valuesEqualForField("updated_at", after.updated_at, before.updated_at);
  if (!updatedAtChanged) differences.push("updated_at_no_cambió");
  return { ok: differences.length === 0, updated_at_changed: updatedAtChanged, differences };
}

function applyReportMarkdown(report: PatchExecutionReport) {
  const rows = report.events.map((event) => `| ${event.id} | ${event.status} | ${event.fields.length} | ${event.verification?.ok ?? "-"} | ${event.error || "-"} |`).join("\n");
  return `# Informe de aplicación del enriquecimiento\n\n` +
    `- Lote: ${PATCH_BATCH_ID}\n- Manifiesto: ${report.metadata.manifest_sha256}\n- Backup: ${report.backup_path || "no generado"}\n- Hash backup: ${report.backup_sha256 || "no generado"}\n` +
    `- Aplicación parcial: ${report.summary.partial_application ? "sí" : "no"}\n- Cambios de slug: ${report.summary.slug_changes}\n\n` +
    `| Evento | Estado | Campos | Verificación | Error |\n|---|---|---:|---|---|\n${rows}\n\n` +
    `## Resumen\n\n- Ya aplicados y verificados: ${report.summary.already_applied}\n- Pendientes al inicio: ${report.summary.pending}\n` +
    `- Intentados: ${report.summary.attempted}\n- Updates devueltos: ${report.summary.updates_returned}\n- Aplicados: ${report.summary.applied}\n` +
    `- Omitidos: ${report.summary.skipped}\n- Fallidos: ${report.summary.failed}\n- Campos modificados: ${report.summary.fields_changed}\n`;
}

export async function executePatch(args: {
  manifest: PatchManifest;
  consolidated: ConsolidatedInput;
  options: PatchOptions;
  manifestSha256: string;
  consolidatedSha256: string;
  currentHead: string;
  repository: PatchRepository;
  storage: PatchStorage;
  now?: Date;
  outputDir?: string;
}) {
  const { manifest, consolidated, options, manifestSha256, consolidatedSha256, currentHead, repository, storage } = args;
  validatePatchInputs(manifest, consolidated);
  validateApplyConfirmations(options, manifestSha256, currentHead);
  const selected = selectManifestEvents(manifest.events, options);
  const allIds = manifest.events.map((event) => event.id);
  const currentRows = await repository.findEventsByIds(allIds);
  const preflight = preflightPatch(manifest, currentRows);
  if (preflight.errors.length) throw new Error(`Preflight global bloqueado; cero escrituras:\n- ${preflight.errors.join("\n- ")}`);
  if (preflight.events.length !== PATCH_EVENT_COUNT) throw new Error("Preflight global incompleto; cero escrituras.");

  const selectedSet = new Set(selected.map((event) => event.id));
  const selectedPreflight = preflight.events.filter((event) => selectedSet.has(event.id));
  const selectedPending = selectedPreflight.filter((event) => event.classification === "pending_ready");
  const selectedAlreadyApplied = selectedPreflight.filter((event) => event.classification === "already_applied_verified");
  const allAlreadyApplied = preflight.events.filter((event) => event.classification === "already_applied_verified");
  const allPending = preflight.events.filter((event) => event.classification === "pending_ready");
  const now = args.now || new Date();
  const generatedAt = now.toISOString();
  const suffix = timestampForFile(now);
  const outputDir = args.outputDir || path.join(process.cwd(), "data", "research", "enrichment");
  const isResume = allAlreadyApplied.length > 0;
  const backupPath = path.join(outputDir, "backups", `${PATCH_BATCH_ID}-${isResume ? "before-resume" : "before-apply"}-${suffix}.json`);
  const rollbackPath = path.join(outputDir, "backups", `${PATCH_BATCH_ID}-${isResume ? "resume-rollback-manifest" : "rollback-manifest"}-${suffix}.json`);
  const masterBackupPath = isResume ? path.join(outputDir, "backups", `${PATCH_BATCH_ID}-before-apply-20260720T191307Z.json`) : null;
  const masterRollbackPath = isResume ? path.join(outputDir, "backups", `${PATCH_BATCH_ID}-rollback-manifest-20260720T191307Z.json`) : null;
  const reportJsonPath = path.join(outputDir, `${PATCH_BATCH_ID}-apply-report-${suffix}.json`);
  const reportMarkdownPath = path.join(outputDir, `${PATCH_BATCH_ID}-apply-report-${suffix}.md`);
  const totalManifestChanges = preflight.events.reduce((sum, event) => sum + Object.keys(event.changes).filter((field) => !valuesEqualForField(field, event.manifest.expected_current[field], event.changes[field])).length, 0);
  const alreadyAppliedChanges = allAlreadyApplied.reduce((sum, event) => sum + event.already_applied_fields.length, 0);
  const pendingChanges = allPending.reduce((sum, event) => sum + event.pending_fields.length, 0);
  const predictedChanges = selectedPending.reduce((sum, event) => sum + event.pending_fields.length, 0);

  const report: PatchExecutionReport = {
    metadata: {
      batch: PATCH_BATCH_ID, mode: options.apply ? "apply" : "dry-run", generated_at: generatedAt, timezone: ENRICHMENT_TIME_ZONE,
      manifest_path: options.manifestPath, manifest_sha256: manifestSha256, consolidated_sha256: consolidatedSha256, git_head: currentHead,
      selected_ids: selectedPreflight.map((event) => event.id), operations: options.apply ? APPLY_OPERATIONS : DRY_RUN_OPERATIONS, supabase_writes: options.apply,
    },
    preflight: {
      expected_events: PATCH_EVENT_COUNT, found_events: currentRows.length, valid_preconditions: preflight.events.filter((event) => !event.errors.length).length,
      drifted_events: preflight.events.filter((event) => event.classification === "unrelated_drift").length,
      blocked_events: preflight.events.filter((event) => event.errors.length).length, predicted_changes: predictedChanges,
      total_manifest_changes: totalManifestChanges, already_applied_events: allAlreadyApplied.length, pending_events: allPending.length,
      partial_state_conflicts: preflight.events.filter((event) => event.classification === "partial_state_conflict").length,
      unrelated_drift: preflight.events.filter((event) => event.classification === "unrelated_drift").length,
      already_applied_changes: alreadyAppliedChanges, pending_changes: pendingChanges, errors: preflight.errors,
    },
    planned_backup: backupPath, planned_rollback: rollbackPath, master_backup_path: masterBackupPath, master_rollback_path: masterRollbackPath,
    backup_path: null, rollback_path: null, backup_sha256: null,
    events: selectedPreflight.map((event) => ({
      id: event.id, status: event.classification === "already_applied_verified" ? "already_applied_verified" : "dry_run_ready",
      fields: event.classification === "already_applied_verified" ? event.already_applied_fields : event.pending_fields,
      preconditions: { updated_at: event.current.updated_at, ...event.critical_preconditions }, verification: null, error: null,
    })),
    summary: {
      attempted: 0, applied: 0, skipped: selectedAlreadyApplied.length, failed: 0, fields_changed: 0, partial_application: false,
      slug_changes: 0, already_applied: selectedAlreadyApplied.length, pending: selectedPending.length, updates_returned: 0,
    },
  };
  if (!options.apply) return report;
  if (!selectedPending.length) return report;
  if (isResume) {
    const masterBackupValid = masterBackupPath ? await storage.hasSha256(masterBackupPath, MASTER_BACKUP_SHA256) : false;
    const masterRollbackValid = masterRollbackPath ? await storage.hasSha256(masterRollbackPath, MASTER_ROLLBACK_SHA256) : false;
    if (!masterBackupValid || !masterRollbackValid) {
      throw new Error("Reanudación bloqueada: el backup o rollback maestro falta o no conserva su SHA-256 original; cero escrituras.");
    }
  }

  const backup = createBackup(preflight.events, manifestSha256, currentHead, generatedAt);
  const rollback = createRollback(selectedPending, manifestSha256, currentHead, generatedAt);
  await storage.writeJson(backupPath, backup);
  const backupRaw = `${JSON.stringify(backup, null, 2)}\n`;
  report.backup_path = backupPath;
  report.backup_sha256 = sha256(backupRaw);
  await storage.writeJson(rollbackPath, rollback);
  report.rollback_path = rollbackPath;
  let unverifiedWrite = false;

  for (let index = 0; index < selectedPending.length; index += 1) {
    const event = selectedPending[index];
    const eventReport = report.events.find((item) => item.id === event.id);
    if (!eventReport) throw new Error(`No existe fila de informe para ${event.id}.`);
    eventReport.status = "failed";
    report.summary.attempted += 1;
    let updateReturned = false;
    try {
      const updatedAt = new Date(now.getTime() + index + 1).toISOString();
      const updated = await repository.updateEvent({ id: event.id, expectedUpdatedAt: event.current.updated_at, criticalPreconditions: event.critical_preconditions, changes: event.changes, updatedAt });
      if (!updated) throw new Error("La fila cambió entre preflight y UPDATE; no fue modificada.");
      updateReturned = true;
      report.summary.updates_returned += 1;
      const verificationRows = await repository.findEventsByIds([event.id]);
      if (verificationRows.length !== 1) throw new Error("La verificación posterior no devolvió exactamente una fila.");
      const verification = verifyAppliedEvent(event.current, verificationRows[0], event.changes);
      eventReport.verification = verification;
      if (!verification.ok) throw new Error(`Verificación posterior fallida: ${verification.differences.join(", ")}.`);
      eventReport.status = "applied";
      report.summary.applied += 1;
      report.summary.fields_changed += eventReport.fields.length;
    } catch (error: unknown) {
      if (updateReturned) unverifiedWrite = true;
      eventReport.error = error instanceof Error ? error.message : String(error);
      report.summary.failed += 1;
      for (let pending = index + 1; pending < selectedPending.length; pending += 1) {
        const pendingReport = report.events.find((item) => item.id === selectedPending[pending].id);
        if (!pendingReport) continue;
        pendingReport.status = "skipped";
        pendingReport.error = "Omitido tras un fallo anterior.";
        report.summary.skipped += 1;
      }
      break;
    }
  }
  report.summary.partial_application = unverifiedWrite || (report.summary.applied > 0 && report.summary.applied < selectedPending.length);
  await storage.writeJson(reportJsonPath, report);
  await storage.writeText(reportMarkdownPath, `${applyReportMarkdown(report)}\n`);
  return report;
}

async function gitHead() {
  const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: process.cwd(), windowsHide: true });
  return stdout.trim();
}

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function main() {
  const options = parsePatchOptions(process.argv.slice(2));
  const manifestPath = path.resolve(process.cwd(), options.manifestPath);
  const consolidatedPath = path.join(path.dirname(manifestPath), `${PATCH_BATCH_ID}-consolidated.json`);
  const [manifestRaw, consolidatedRaw, currentHead] = await Promise.all([readFile(manifestPath, "utf8"), readFile(consolidatedPath, "utf8"), gitHead()]);
  const manifest = JSON.parse(manifestRaw) as PatchManifest;
  const consolidated = JSON.parse(consolidatedRaw) as ConsolidatedInput;
  const manifestSha256 = sha256(manifestRaw);
  const consolidatedSha256 = sha256(consolidatedRaw);
  validateApplyConfirmations(options, manifestSha256, currentHead);

  loadEnvConfig(process.cwd());
  const supabase = createClient<ApplyDatabase>(getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"), getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const report = await executePatch({
    manifest, consolidated, options, manifestSha256, consolidatedSha256, currentHead,
    repository: new SupabasePatchRepository(supabase), storage: new FilePatchStorage(),
  });
  console.log(`Preflight ${report.metadata.mode} completado.`);
  console.log(`- manifiesto SHA-256: ${manifestSha256}`);
  console.log(`- HEAD requerido: ${currentHead}`);
  console.log(`- eventos encontrados: ${report.preflight.found_events}/${report.preflight.expected_events}`);
  console.log(`- precondiciones correctas: ${report.preflight.valid_preconditions}`);
  console.log(`- ya aplicados y verificados: ${report.preflight.already_applied_events}`);
  console.log(`- pendientes preparados: ${report.preflight.pending_events}`);
  console.log(`- drift ajeno: ${report.preflight.unrelated_drift}`);
  console.log(`- estados parciales conflictivos: ${report.preflight.partial_state_conflicts}`);
  console.log(`- bloqueados: ${report.preflight.blocked_events}`);
  console.log(`- cambios ya aplicados: ${report.preflight.already_applied_changes}`);
  console.log(`- cambios pendientes: ${report.preflight.pending_changes}`);
  console.log(`- cambios totales del manifiesto: ${report.preflight.total_manifest_changes}`);
  console.log(`- backup previsto: ${report.planned_backup}`);
  console.log(`- rollback previsto: ${report.planned_rollback}`);
  console.log(`- escrituras Supabase devueltas: ${report.metadata.supabase_writes ? report.summary.updates_returned : 0}`);
  if (!options.apply) {
    console.log("- modo dry-run: no se generaron backup, rollback ni informes de aplicación.");
    console.log("Comando futuro de aplicación (NO ejecutado):");
    console.log(`npm run research:apply-enrichment -- --manifest ${options.manifestPath} --apply --confirm-batch ${PATCH_BATCH_ID} --confirm-count ${PATCH_EVENT_COUNT} --confirm-manifest-sha256 ${manifestSha256} --confirm-current-head ${currentHead}`);
  }
  if (report.summary.failed || report.summary.partial_application) process.exitCode = 1;
}

const entryPoint = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (entryPoint === import.meta.url) {
  main().catch((error: unknown) => {
    console.error(`\nAplicador de enriquecimiento abortado: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
