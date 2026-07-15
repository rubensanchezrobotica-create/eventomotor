import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadEnvConfig } from "@next/env";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type TextValue = string | string[] | null;
type TextFields = Record<string, TextValue>;
type CorrectionInput = Record<string, unknown>;

export type EventTextCorrection = {
  id: string;
  title: string;
  reason: string;
  status: "pending_update";
  expected: TextFields;
  changes: TextFields;
};

export type EventTextSnapshot = {
  id: string;
  slug: string | null;
  fields: TextFields;
};

export type EventTextUpdateRequest = {
  id: string;
  expected: TextFields;
  changes: TextFields;
};

export interface EventTextCorrectionRepository {
  findEventsById(id: string): Promise<EventTextSnapshot[]>;
  updateEvent(request: EventTextUpdateRequest): Promise<{ updatedCount: number }>;
}

export type TextCorrectionClassification = "ready" | "blocked" | "not_found" | "conflict";

export type TextCorrectionResult = {
  index: number;
  input: CorrectionInput;
  correction: EventTextCorrection | null;
  event: EventTextSnapshot | null;
  classification: TextCorrectionClassification;
  errors: string[];
  updated: boolean;
  updateError: string | null;
};

type ExecutionResult = {
  results: TextCorrectionResult[];
  summary: ReturnType<typeof summarize>;
};

const FIELD_TO_COLUMN = {
  title: "title",
  city: "city",
  province: "province",
  region: "region",
  venue: "venue",
  discipline: "discipline",
  category: "championship",
  organizer_name: "organizer_name",
  source_name: "source",
  short_description: "short_description",
  long_description: "long_description",
  schedule_text: "schedule_text",
  address: "address",
  tags: "tags",
  notes: "notes",
} as const;

type AllowedField = keyof typeof FIELD_TO_COLUMN;

const ALLOWED_FIELDS = Object.keys(FIELD_TO_COLUMN) as AllowedField[];
const EVENT_SELECT = ["id", "slug", ...new Set(Object.values(FIELD_TO_COLUMN))].join(",");

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isAllowedField(value: string): value is AllowedField {
  return value in FIELD_TO_COLUMN;
}

function getArg(name: string) {
  const index = process.argv.indexOf(name);

  return index >= 0 ? process.argv[index + 1] : null;
}

function hasFlag(name: string) {
  return process.argv.includes(name);
}

function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) throw new Error(`Missing required environment variable: ${name}`);

  return value;
}

function cloneTextValue(value: TextValue): TextValue {
  return Array.isArray(value) ? [...value] : value;
}

function valuesEqual(left: TextValue, right: TextValue) {
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((value, index) => value === right[index]);
  }

  return left === right;
}

function parseTextFields(value: unknown, label: string, errors: string[]) {
  const result: TextFields = {};

  if (!isRecord(value)) {
    errors.push(`${label} debe ser un objeto.`);
    return result;
  }

  const entries = Object.entries(value);
  if (!entries.length) errors.push(`${label} debe contener al menos un campo.`);

  for (const [field, fieldValue] of entries) {
    if (!isAllowedField(field)) {
      errors.push(`${label}.${field} no es un campo de texto permitido.`);
      continue;
    }

    const validArray = Array.isArray(fieldValue) && fieldValue.every((item) => typeof item === "string");
    if (typeof fieldValue !== "string" && fieldValue !== null && !validArray) {
      errors.push(`${label}.${field} debe ser texto, array de textos o null.`);
      continue;
    }

    result[field] = cloneTextValue(fieldValue as TextValue);
  }

  return result;
}

export function validateTextCorrection(input: CorrectionInput) {
  const errors: string[] = [];
  const id = typeof input.id === "string" ? input.id.trim() : "";
  const title = typeof input.title === "string" ? input.title : "";
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  const status = input.status;

  if (!id) errors.push("id es obligatorio y debe ser texto no vacio.");
  if (!title.trim()) errors.push("title es obligatorio y debe ser texto no vacio.");
  if (!reason) errors.push("reason es obligatorio y debe ser texto no vacio.");
  if (status !== "pending_update") errors.push('status debe ser "pending_update".');

  const expected = parseTextFields(input.expected, "expected", errors);
  const changes = parseTextFields(input.changes, "changes", errors);
  const expectedFields = Object.keys(expected).sort();
  const changedFields = Object.keys(changes).sort();

  if (expectedFields.join("|") !== changedFields.join("|")) {
    errors.push("expected y changes deben contener exactamente los mismos campos.");
  }

  for (const field of expectedFields) {
    if (field in changes && valuesEqual(expected[field], changes[field])) {
      errors.push(`${field} no cambia entre expected y changes.`);
    }
  }

  if ("title" in expected && expected.title !== title) {
    errors.push("expected.title debe coincidir exactamente con title.");
  }

  const correction: EventTextCorrection | null = errors.length
    ? null
    : {
        id,
        title,
        reason,
        status: "pending_update",
        expected,
        changes,
      };

  return { correction, errors };
}

function emptyResult(input: CorrectionInput, index: number): TextCorrectionResult {
  return {
    index,
    input,
    correction: null,
    event: null,
    classification: "blocked",
    errors: [],
    updated: false,
    updateError: null,
  };
}

export async function auditTextCorrections(repository: EventTextCorrectionRepository, inputs: CorrectionInput[]) {
  const results: TextCorrectionResult[] = [];

  for (const [index, input] of inputs.entries()) {
    const result = emptyResult(input, index);
    const validation = validateTextCorrection(input);
    result.correction = validation.correction;
    result.errors.push(...validation.errors);

    if (!validation.correction) {
      results.push(result);
      continue;
    }

    const correction = validation.correction;
    let events: EventTextSnapshot[];

    try {
      events = await repository.findEventsById(correction.id);
    } catch (error) {
      result.errors.push(`Error consultando ${correction.id}: ${error instanceof Error ? error.message : String(error)}`);
      results.push(result);
      continue;
    }

    if (!events.length) {
      result.classification = "not_found";
      result.errors.push(`No existe un evento con id ${correction.id}.`);
      results.push(result);
      continue;
    }

    if (events.length !== 1) {
      result.classification = "conflict";
      result.errors.push(`El id ${correction.id} devolvio ${events.length} filas; se esperaba exactamente una.`);
      results.push(result);
      continue;
    }

    result.event = events[0];
    if (events[0].fields.title !== correction.title) {
      result.errors.push("title: el titulo actual no coincide con el identificador verificable.");
    }

    for (const [field, expectedValue] of Object.entries(correction.expected)) {
      if (!valuesEqual(events[0].fields[field], expectedValue)) {
        result.errors.push(`${field}: el valor actual no coincide exactamente con expected.`);
      }
    }

    result.classification = result.errors.length ? "blocked" : "ready";
    results.push(result);
  }

  return results;
}

export async function executeTextCorrections(repository: EventTextCorrectionRepository, inputs: CorrectionInput[], apply = false): Promise<ExecutionResult> {
  const results = await auditTextCorrections(repository, inputs);

  if (apply) {
    for (const result of results.filter((item) => item.classification === "ready")) {
      try {
        if (!result.correction) throw new Error("Correccion no validada.");
        const update = await repository.updateEvent({
          id: result.correction.id,
          expected: result.correction.expected,
          changes: result.correction.changes,
        });

        if (update.updatedCount !== 1) {
          result.updateError = `La actualizacion afecto ${update.updatedCount} registros; se esperaba exactamente 1.`;
          continue;
        }

        result.updated = true;
      } catch (error) {
        result.updateError = error instanceof Error ? error.message : String(error);
      }
    }
  }

  return { results, summary: summarize(results) };
}

function rowToSnapshot(row: Record<string, unknown>): EventTextSnapshot {
  const fields: TextFields = {};

  for (const field of ALLOWED_FIELDS) {
    const column = FIELD_TO_COLUMN[field];
    fields[field] = cloneTextValue((row[column] ?? null) as TextValue);
  }

  return {
    id: String(row.id),
    slug: typeof row.slug === "string" ? row.slug : null,
    fields,
  };
}

function toDatabaseFields(fields: TextFields) {
  return Object.fromEntries(Object.entries(fields).map(([field, value]) => [FIELD_TO_COLUMN[field as AllowedField], value]));
}

export class SupabaseEventTextCorrectionRepository implements EventTextCorrectionRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async findEventsById(id: string) {
    const { data, error } = await this.supabase.from("events").select(EVENT_SELECT).eq("id", id).limit(2);

    if (error) throw new Error(`No se pudo consultar el evento ${id}: ${error.message}`);

    return (data ?? []).map((row) => rowToSnapshot(row as unknown as Record<string, unknown>));
  }

  async updateEvent(request: EventTextUpdateRequest) {
    let query = this.supabase.from("events").update(toDatabaseFields(request.changes)).eq("id", request.id);

    for (const [field, value] of Object.entries(request.expected)) {
      const column = FIELD_TO_COLUMN[field as AllowedField];
      if (value === null) query = query.is(column, null);
      else if (Array.isArray(value)) query = query.contains(column, value).containedBy(column, value);
      else query = query.eq(column, value);
    }

    const { data, error } = await query.select("id");
    if (error) throw new Error(`Error actualizando ${request.id}: ${error.message}`);

    return { updatedCount: data?.length ?? 0 };
  }
}

function summarize(results: TextCorrectionResult[]) {
  return {
    total: results.length,
    validas: results.filter((result) => result.correction !== null).length,
    ready: results.filter((result) => result.classification === "ready").length,
    blocked: results.filter((result) => result.classification === "blocked").length,
    conflicts: results.filter((result) => result.classification === "conflict").length,
    notFound: results.filter((result) => result.classification === "not_found").length,
    updated: results.filter((result) => result.updated).length,
    updateErrors: results.filter((result) => result.updateError).length,
  };
}

async function readCorrections(filePath: string) {
  const absolutePath = path.resolve(process.cwd(), filePath);
  const parsed = JSON.parse(await readFile(absolutePath, "utf8")) as unknown;
  if (!Array.isArray(parsed)) throw new Error("El archivo de correcciones debe contener un array.");

  return parsed.map((item, index) => {
    if (!isRecord(item)) throw new Error(`Correccion ${index + 1}: se esperaba un objeto.`);
    return item;
  });
}

function printReport(execution: ExecutionResult, apply: boolean) {
  console.log(`Modo: ${apply ? "APPLY" : "DRY-RUN"}`);
  console.log("Resumen:");
  console.log(`- correcciones leidas: ${execution.summary.total}`);
  console.log(`- correcciones validas: ${execution.summary.validas}`);
  console.log(`- listas para aplicar: ${execution.summary.ready}`);
  console.log(`- bloqueadas: ${execution.summary.blocked}`);
  console.log(`- no encontradas: ${execution.summary.notFound}`);
  console.log(`- conflictos: ${execution.summary.conflicts}`);
  console.log(`- actualizadas: ${execution.summary.updated}`);
  console.log(`- errores de actualizacion: ${execution.summary.updateErrors}`);

  for (const result of execution.results) {
    const title = result.correction?.title || String(result.input.title || `(correccion ${result.index + 1})`);
    const fields = result.correction ? Object.keys(result.correction.changes).join(", ") : "no disponibles";
    console.log(`\n[${result.classification}] ${title}`);
    console.log(`- id: ${result.correction?.id || String(result.input.id || "(sin id)")}`);
    console.log(`- campos: ${fields}`);
    if (result.errors.length) console.log(`- motivos: ${result.errors.join(" | ")}`);
    if (result.updateError) console.log(`- error de actualizacion: ${result.updateError}`);
    if (result.updated) console.log("- actualizacion: OK");
  }

  if (!apply) console.log("\nDry-run: no se ha actualizado, insertado ni borrado ningun evento.");
}

async function createRepository() {
  loadEnvConfig(process.cwd());
  const supabaseUrl = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return new SupabaseEventTextCorrectionRepository(supabase);
}

async function main() {
  const file = getArg("--file");
  const apply = hasFlag("--apply");
  if (!file) throw new Error("Uso: node --import tsx scripts/apply-event-text-corrections.ts --file data/research/corrections.json [--apply]");

  const inputs = await readCorrections(file);
  const repository = await createRepository();
  const execution = await executeTextCorrections(repository, inputs, apply);
  printReport(execution, apply);

  if (execution.summary.blocked || execution.summary.conflicts || execution.summary.notFound || execution.summary.updateErrors) {
    process.exitCode = 1;
  }
}

const entryPoint = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (entryPoint === import.meta.url) {
  main().catch((error: unknown) => {
    console.error(`\nCorrecciones de texto fallidas: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
