import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadEnvConfig } from "@next/env";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type CorrectionInput = Record<string, unknown>;

export type EventCorrection = {
  id: string;
  title: string;
  old_start_date: string;
  old_end_date: string;
  new_start_date: string;
  new_end_date: string;
  keep_id: true;
  keep_slug: true;
  old_source_url: string;
  new_source_url: string;
  reason: string;
  status: "pending_update";
};

export type EventSnapshot = {
  id: string;
  slug: string | null;
  title: string;
  start_date: string;
  end_date: string | null;
  city: string | null;
  source_url: string | null;
};

export type EventUpdateRequest = {
  id: string;
  expected: {
    title: string;
    start_date: string;
    end_date: string;
    source_url: string;
  };
  changes: {
    start_date: string;
    end_date: string;
    source_url: string;
    official_url: string;
  };
};

export interface CorrectionRepository {
  findEventById(id: string): Promise<EventSnapshot | null>;
  findEventsByStartDate(startDate: string): Promise<EventSnapshot[]>;
  updateEvent(request: EventUpdateRequest): Promise<{ updatedCount: number }>;
}

export type CorrectionClassification = "ready" | "blocked" | "not_found" | "conflict";

export type CorrectionResult = {
  index: number;
  input: CorrectionInput;
  correction: EventCorrection | null;
  event: EventSnapshot | null;
  conflict: EventSnapshot | null;
  classification: CorrectionClassification;
  errors: string[];
  checks: {
    title: boolean | null;
    oldDates: boolean | null;
    oldSource: boolean | null;
    duplicate: "clear" | "conflict" | "not_checked";
  };
  updated: boolean;
  updateError: string | null;
};

type ExecutionResult = {
  results: CorrectionResult[];
  summary: ReturnType<typeof summarize>;
};

const REQUIRED_FIELDS = [
  "id",
  "title",
  "old_start_date",
  "old_end_date",
  "new_start_date",
  "new_end_date",
  "keep_id",
  "keep_slug",
  "old_source_url",
  "new_source_url",
  "reason",
  "status",
] as const;

const EVENT_SELECT = "id,slug,title,start_date,end_date,city,source_url";

function isRecord(value: unknown): value is CorrectionInput {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const date = new Date(`${value}T00:00:00.000Z`);

  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function normalizeComparable(value: string | null) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function requiredString(input: CorrectionInput, field: (typeof REQUIRED_FIELDS)[number], errors: string[]) {
  const value = input[field];

  if (typeof value !== "string" || !value.trim()) {
    errors.push(`${field} es obligatorio y debe ser texto no vacio.`);
    return "";
  }

  return value.trim();
}

export function validateCorrection(input: CorrectionInput, index = 0) {
  const errors: string[] = [];

  for (const field of REQUIRED_FIELDS) {
    if (!(field in input)) errors.push(`${field} es obligatorio.`);
  }

  const id = requiredString(input, "id", errors);
  const title = requiredString(input, "title", errors);
  const oldStartDate = requiredString(input, "old_start_date", errors);
  const oldEndDate = requiredString(input, "old_end_date", errors);
  const newStartDate = requiredString(input, "new_start_date", errors);
  const newEndDate = requiredString(input, "new_end_date", errors);
  const oldSourceUrl = requiredString(input, "old_source_url", errors);
  const newSourceUrl = requiredString(input, "new_source_url", errors);
  const reason = requiredString(input, "reason", errors);
  const status = requiredString(input, "status", errors);

  if (input.keep_id !== true) errors.push("keep_id debe ser true.");
  if (input.keep_slug !== true) errors.push("keep_slug debe ser true.");
  if (status && status !== "pending_update") errors.push('status debe ser "pending_update".');

  for (const [field, value] of [
    ["old_start_date", oldStartDate],
    ["old_end_date", oldEndDate],
    ["new_start_date", newStartDate],
    ["new_end_date", newEndDate],
  ] as const) {
    if (value && !isIsoDate(value)) errors.push(`${field} debe usar una fecha ISO valida YYYY-MM-DD.`);
  }

  if (isIsoDate(newStartDate) && isIsoDate(newEndDate) && newEndDate < newStartDate) {
    errors.push("new_end_date no puede ser anterior a new_start_date.");
  }

  const hasTypedFields =
    Boolean(id && title && oldStartDate && oldEndDate && newStartDate && newEndDate && oldSourceUrl && newSourceUrl && reason) &&
    input.keep_id === true &&
    input.keep_slug === true &&
    status === "pending_update";

  const correction: EventCorrection | null = hasTypedFields
    ? {
        id,
        title,
        old_start_date: oldStartDate,
        old_end_date: oldEndDate,
        new_start_date: newStartDate,
        new_end_date: newEndDate,
        keep_id: true,
        keep_slug: true,
        old_source_url: oldSourceUrl,
        new_source_url: newSourceUrl,
        reason,
        status: "pending_update",
      }
    : null;

  return { index, correction, errors };
}

function emptyResult(input: CorrectionInput, index: number): CorrectionResult {
  return {
    index,
    input,
    correction: null,
    event: null,
    conflict: null,
    classification: "blocked",
    errors: [],
    checks: {
      title: null,
      oldDates: null,
      oldSource: null,
      duplicate: "not_checked",
    },
    updated: false,
    updateError: null,
  };
}

function duplicateMatches(event: EventSnapshot, candidate: EventSnapshot, correction: EventCorrection) {
  return (
    candidate.id !== event.id &&
    candidate.start_date === correction.new_start_date &&
    normalizeComparable(candidate.title) === normalizeComparable(correction.title) &&
    normalizeComparable(candidate.city) === normalizeComparable(event.city)
  );
}

export async function auditCorrections(repository: CorrectionRepository, inputs: CorrectionInput[]) {
  const results: CorrectionResult[] = [];

  for (const [index, input] of inputs.entries()) {
    const result = emptyResult(input, index);
    const validation = validateCorrection(input, index);

    result.correction = validation.correction;
    result.errors.push(...validation.errors);

    if (validation.errors.length || !validation.correction) {
      results.push(result);
      continue;
    }

    const correction = validation.correction;
    const event = await repository.findEventById(correction.id);

    if (!event) {
      result.classification = "not_found";
      result.errors.push(`No existe un evento con id ${correction.id}.`);
      results.push(result);
      continue;
    }

    result.event = event;
    result.checks.title = event.title === correction.title;
    result.checks.oldDates = event.start_date === correction.old_start_date && event.end_date === correction.old_end_date;
    result.checks.oldSource = event.source_url === correction.old_source_url;

    if (!result.checks.title) result.errors.push("El titulo real no coincide con el informe.");
    if (!result.checks.oldDates) result.errors.push("Las fechas reales no coinciden con las fechas antiguas del informe.");
    if (!result.checks.oldSource) result.errors.push("La source_url real no coincide con la fuente antigua del informe.");
    if (!event.city?.trim()) result.errors.push("El evento real no tiene ciudad y no se puede comprobar la clave de duplicado.");

    if (result.errors.length) {
      result.classification = "blocked";
      results.push(result);
      continue;
    }

    const sameDateEvents = await repository.findEventsByStartDate(correction.new_start_date);
    const conflict = sameDateEvents.find((candidate) => duplicateMatches(event, candidate, correction)) || null;

    if (conflict) {
      result.conflict = conflict;
      result.checks.duplicate = "conflict";
      result.classification = "conflict";
      result.errors.push(`Conflicto con ${conflict.title} (${conflict.id}, slug: ${conflict.slug || "sin slug"}).`);
    } else {
      result.checks.duplicate = "clear";
      result.classification = "ready";
    }

    results.push(result);
  }

  return results;
}

function buildUpdateRequest(result: CorrectionResult): EventUpdateRequest {
  if (!result.correction) throw new Error("No se puede crear una actualizacion sin correccion validada.");

  return {
    id: result.correction.id,
    expected: {
      title: result.correction.title,
      start_date: result.correction.old_start_date,
      end_date: result.correction.old_end_date,
      source_url: result.correction.old_source_url,
    },
    changes: {
      start_date: result.correction.new_start_date,
      end_date: result.correction.new_end_date,
      source_url: result.correction.new_source_url,
      official_url: result.correction.new_source_url,
    },
  };
}

export async function executeCorrections(repository: CorrectionRepository, inputs: CorrectionInput[], apply = false): Promise<ExecutionResult> {
  const results = await auditCorrections(repository, inputs);

  if (apply) {
    for (const result of results.filter((item) => item.classification === "ready")) {
      try {
        const update = await repository.updateEvent(buildUpdateRequest(result));

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

export class SupabaseCorrectionRepository implements CorrectionRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async findEventById(id: string) {
    const { data, error } = await this.supabase.from("events").select(EVENT_SELECT).eq("id", id).maybeSingle();

    if (error) throw new Error(`No se pudo consultar el evento ${id}: ${error.message}`);

    return (data as EventSnapshot | null) || null;
  }

  async findEventsByStartDate(startDate: string) {
    const { data, error } = await this.supabase.from("events").select(EVENT_SELECT).eq("start_date", startDate);

    if (error) throw new Error(`No se pudieron comprobar duplicados para ${startDate}: ${error.message}`);

    return (data ?? []) as EventSnapshot[];
  }

  async updateEvent(request: EventUpdateRequest) {
    const { data, error } = await this.supabase
      .from("events")
      .update(request.changes)
      .eq("id", request.id)
      .eq("title", request.expected.title)
      .eq("start_date", request.expected.start_date)
      .eq("end_date", request.expected.end_date)
      .eq("source_url", request.expected.source_url)
      .select("id");

    if (error) throw new Error(`Error actualizando ${request.id}: ${error.message}`);

    return { updatedCount: data?.length ?? 0 };
  }
}

function summarize(results: CorrectionResult[]) {
  return {
    total: results.length,
    validas: results.filter((result) => result.correction && !validateCorrection(result.input, result.index).errors.length).length,
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

function checkLabel(value: boolean | null) {
  if (value === null) return "NO COMPROBADO";

  return value ? "OK" : "ERROR";
}

function printReport(execution: ExecutionResult, apply: boolean) {
  const { results, summary } = execution;

  console.log(`Modo: ${apply ? "APPLY" : "DRY-RUN"}`);
  console.log("Resumen:");
  console.log(`- correcciones leidas: ${summary.total}`);
  console.log(`- correcciones validas: ${summary.validas}`);
  console.log(`- listas para aplicar: ${summary.ready}`);
  console.log(`- bloqueadas: ${summary.blocked}`);
  console.log(`- conflictos: ${summary.conflicts}`);
  console.log(`- no encontradas: ${summary.notFound}`);
  console.log(`- actualizadas: ${summary.updated}`);
  console.log(`- errores de actualizacion: ${summary.updateErrors}`);

  for (const result of results) {
    const correction = result.correction;
    const inputTitle = typeof result.input.title === "string" ? result.input.title : `(correccion ${result.index + 1})`;

    console.log(`\n[${result.classification}] ${inputTitle}`);
    console.log(`- id: ${correction?.id || String(result.input.id || "(sin id)")}`);
    console.log(`- fecha actual: ${result.event ? `${result.event.start_date} a ${result.event.end_date || result.event.start_date}` : "no disponible"}`);
    console.log(`- fecha propuesta: ${correction ? `${correction.new_start_date} a ${correction.new_end_date}` : "no disponible"}`);
    console.log(`- fuente actual: ${result.event?.source_url || "no disponible"}`);
    console.log(`- fuente propuesta: ${correction?.new_source_url || "no disponible"}`);
    console.log(`- validacion titulo: ${checkLabel(result.checks.title)}`);
    console.log(`- validacion fechas antiguas: ${checkLabel(result.checks.oldDates)}`);
    console.log(`- validacion fuente antigua: ${checkLabel(result.checks.oldSource)}`);
    console.log(`- comprobacion duplicados: ${result.checks.duplicate}`);
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
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return new SupabaseCorrectionRepository(supabase);
}

async function main() {
  const file = getArg("--file");
  const apply = hasFlag("--apply");

  if (!file) {
    throw new Error("Uso: npm run correct:events -- --file data/research/corrections.json [--apply]");
  }

  const inputs = await readCorrections(file);
  const repository = await createRepository();
  const execution = await executeCorrections(repository, inputs, apply);

  printReport(execution, apply);
}

const entryPoint = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;

if (entryPoint === import.meta.url) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);

    console.error(`\nCorrecciones de eventos fallidas: ${message}`);
    process.exitCode = 1;
  });
}
