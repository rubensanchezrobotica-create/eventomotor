import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { pathToFileURL } from "node:url";
import { loadEnvConfig } from "@next/env";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type CleanupInput = Record<string, unknown>;

export type CleanupReport = {
  issue_type: "semantic_duplicate_obsolete_record";
  obsolete_id: string;
  obsolete_title: string;
  obsolete_slug: string;
  obsolete_start_date: string;
  obsolete_end_date: string;
  obsolete_source_url: string;
  canonical_id: string;
  canonical_title: string;
  canonical_slug: string;
  canonical_start_date: string;
  canonical_end_date: string;
  canonical_source_url: string;
  official_verification_url: string;
  reason: string;
  recommended_action: "review_and_remove_obsolete_record";
  status: "pending_manual_review";
};

export type EventRecord = Record<string, unknown> & {
  id: string;
  title: string;
  slug: string | null;
  start_date: string;
  end_date: string | null;
  source_url: string | null;
};

export type DeleteRequest = {
  id: string;
  title: string;
  slug: string;
  start_date: string;
  end_date: string;
  source_url: string;
};

export interface CleanupRepository {
  findEventsById(id: string): Promise<EventRecord[]>;
  deleteObsolete(request: DeleteRequest): Promise<{ deletedCount: number }>;
}

export interface CleanupBackupWriter {
  writeBackup(report: CleanupReport, obsoleteEvent: EventRecord, canonicalEvent: EventRecord, generatedAt: string): Promise<string>;
}

export type CleanupClassification =
  | "ready"
  | "blocked"
  | "obsolete_not_found"
  | "canonical_not_found"
  | "mismatch"
  | "confirmation_required"
  | "deletion_error"
  | "deleted";

type IdentityChecks = {
  id: boolean | null;
  title: boolean | null;
  slug: boolean | null;
  start_date: boolean | null;
  end_date: boolean | null;
  source_url: boolean | null;
};

export type CleanupResult = {
  index: number;
  input: CleanupInput;
  report: CleanupReport | null;
  valid: boolean;
  obsoleteEvent: EventRecord | null;
  canonicalEvent: EventRecord | null;
  classification: CleanupClassification;
  errors: string[];
  obsoleteChecks: IdentityChecks;
  canonicalChecks: IdentityChecks;
  backupPath: string | null;
};

export type CleanupExecution = {
  results: CleanupResult[];
  summary: ReturnType<typeof summarize>;
};

type ExecuteOptions = {
  apply?: boolean;
  confirmId?: string | null;
  generatedAt?: string;
};

const REQUIRED_FIELDS = [
  "issue_type",
  "obsolete_id",
  "obsolete_title",
  "obsolete_slug",
  "obsolete_start_date",
  "obsolete_end_date",
  "obsolete_source_url",
  "canonical_id",
  "canonical_title",
  "canonical_slug",
  "canonical_start_date",
  "canonical_end_date",
  "canonical_source_url",
  "official_verification_url",
  "reason",
  "recommended_action",
  "status",
] as const;

const IDENTITY_FIELDS = ["id", "title", "slug", "start_date", "end_date", "source_url"] as const;

function isRecord(value: unknown): value is CleanupInput {
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

function requiredString(input: CleanupInput, field: (typeof REQUIRED_FIELDS)[number], errors: string[]) {
  const value = input[field];

  if (typeof value !== "string" || !value.trim()) {
    errors.push(`${field} es obligatorio y debe ser texto no vacio.`);
    return "";
  }

  return value.trim();
}

function emptyChecks(): IdentityChecks {
  return {
    id: null,
    title: null,
    slug: null,
    start_date: null,
    end_date: null,
    source_url: null,
  };
}

function emptyResult(input: CleanupInput, index: number): CleanupResult {
  return {
    index,
    input,
    report: null,
    valid: false,
    obsoleteEvent: null,
    canonicalEvent: null,
    classification: "blocked",
    errors: [],
    obsoleteChecks: emptyChecks(),
    canonicalChecks: emptyChecks(),
    backupPath: null,
  };
}

export function validateCleanupReport(input: CleanupInput, index = 0) {
  const errors: string[] = [];

  for (const field of REQUIRED_FIELDS) {
    if (!(field in input)) errors.push(`${field} es obligatorio.`);
  }

  const values = Object.fromEntries(REQUIRED_FIELDS.map((field) => [field, requiredString(input, field, errors)])) as Record<
    (typeof REQUIRED_FIELDS)[number],
    string
  >;

  if (values.issue_type && values.issue_type !== "semantic_duplicate_obsolete_record") {
    errors.push('issue_type debe ser "semantic_duplicate_obsolete_record".');
  }
  if (values.recommended_action && values.recommended_action !== "review_and_remove_obsolete_record") {
    errors.push('recommended_action debe ser "review_and_remove_obsolete_record".');
  }
  if (values.status && values.status !== "pending_manual_review") {
    errors.push('status debe ser "pending_manual_review".');
  }
  if (values.obsolete_id && values.obsolete_id === values.canonical_id) errors.push("obsolete_id debe ser distinto de canonical_id.");
  if (values.obsolete_slug && values.obsolete_slug === values.canonical_slug) errors.push("obsolete_slug debe ser distinto de canonical_slug.");

  for (const field of ["obsolete_start_date", "obsolete_end_date", "canonical_start_date", "canonical_end_date"] as const) {
    if (values[field] && !isIsoDate(values[field])) errors.push(`${field} debe usar una fecha ISO valida YYYY-MM-DD.`);
  }

  const report: CleanupReport | null = REQUIRED_FIELDS.every((field) => Boolean(values[field]))
    ? {
        issue_type: "semantic_duplicate_obsolete_record",
        obsolete_id: values.obsolete_id,
        obsolete_title: values.obsolete_title,
        obsolete_slug: values.obsolete_slug,
        obsolete_start_date: values.obsolete_start_date,
        obsolete_end_date: values.obsolete_end_date,
        obsolete_source_url: values.obsolete_source_url,
        canonical_id: values.canonical_id,
        canonical_title: values.canonical_title,
        canonical_slug: values.canonical_slug,
        canonical_start_date: values.canonical_start_date,
        canonical_end_date: values.canonical_end_date,
        canonical_source_url: values.canonical_source_url,
        official_verification_url: values.official_verification_url,
        reason: values.reason,
        recommended_action: "review_and_remove_obsolete_record",
        status: "pending_manual_review",
      }
    : null;

  return { index, report, errors };
}

function expectedObsolete(report: CleanupReport): DeleteRequest {
  return {
    id: report.obsolete_id,
    title: report.obsolete_title,
    slug: report.obsolete_slug,
    start_date: report.obsolete_start_date,
    end_date: report.obsolete_end_date,
    source_url: report.obsolete_source_url,
  };
}

function expectedCanonical(report: CleanupReport): DeleteRequest {
  return {
    id: report.canonical_id,
    title: report.canonical_title,
    slug: report.canonical_slug,
    start_date: report.canonical_start_date,
    end_date: report.canonical_end_date,
    source_url: report.canonical_source_url,
  };
}

function compareIdentity(event: EventRecord, expected: DeleteRequest): IdentityChecks {
  return {
    id: event.id === expected.id,
    title: event.title === expected.title,
    slug: event.slug === expected.slug,
    start_date: event.start_date === expected.start_date,
    end_date: event.end_date === expected.end_date,
    source_url: event.source_url === expected.source_url,
  };
}

function failedFields(checks: IdentityChecks) {
  return IDENTITY_FIELDS.filter((field) => checks[field] === false);
}

export async function auditCleanup(
  repository: CleanupRepository,
  inputs: CleanupInput[],
  options: Pick<ExecuteOptions, "apply" | "confirmId"> = {},
) {
  const results: CleanupResult[] = [];

  for (const [index, input] of inputs.entries()) {
    const result = emptyResult(input, index);
    const validation = validateCleanupReport(input, index);

    result.report = validation.report;
    result.errors.push(...validation.errors);
    result.valid = Boolean(validation.report) && validation.errors.length === 0;

    if (!result.valid || !validation.report) {
      results.push(result);
      continue;
    }

    const report = validation.report;
    const obsoleteRows = await repository.findEventsById(report.obsolete_id);

    if (obsoleteRows.length === 0) {
      result.classification = "obsolete_not_found";
      result.errors.push(`No existe el registro obsoleto ${report.obsolete_id}.`);
      results.push(result);
      continue;
    }
    if (obsoleteRows.length !== 1) {
      result.classification = "mismatch";
      result.errors.push(`La consulta del registro obsoleto devolvio ${obsoleteRows.length} filas; se esperaba 1.`);
      results.push(result);
      continue;
    }

    const canonicalRows = await repository.findEventsById(report.canonical_id);

    if (canonicalRows.length === 0) {
      result.classification = "canonical_not_found";
      result.errors.push(`No existe el registro canonico ${report.canonical_id}.`);
      results.push(result);
      continue;
    }
    if (canonicalRows.length !== 1) {
      result.classification = "mismatch";
      result.errors.push(`La consulta del registro canonico devolvio ${canonicalRows.length} filas; se esperaba 1.`);
      results.push(result);
      continue;
    }

    result.obsoleteEvent = obsoleteRows[0];
    result.canonicalEvent = canonicalRows[0];
    result.obsoleteChecks = compareIdentity(obsoleteRows[0], expectedObsolete(report));
    result.canonicalChecks = compareIdentity(canonicalRows[0], expectedCanonical(report));

    const obsoleteFailures = failedFields(result.obsoleteChecks);
    const canonicalFailures = failedFields(result.canonicalChecks);

    if (obsoleteFailures.length || canonicalFailures.length) {
      result.classification = "mismatch";
      if (obsoleteFailures.length) result.errors.push(`Discrepancias en registro obsoleto: ${obsoleteFailures.join(", ")}.`);
      if (canonicalFailures.length) result.errors.push(`Discrepancias en registro canonico: ${canonicalFailures.join(", ")}.`);
      results.push(result);
      continue;
    }

    if (options.apply && options.confirmId !== report.obsolete_id) {
      result.classification = "confirmation_required";
      result.errors.push("--confirm-id debe coincidir exactamente con obsolete_id para permitir la eliminacion.");
      results.push(result);
      continue;
    }

    result.classification = "ready";
    results.push(result);
  }

  return results;
}

export async function executeCleanup(
  repository: CleanupRepository,
  backupWriter: CleanupBackupWriter,
  inputs: CleanupInput[],
  options: ExecuteOptions = {},
): Promise<CleanupExecution> {
  const apply = options.apply === true;
  const generatedAt = options.generatedAt || new Date().toISOString();
  const results = await auditCleanup(repository, inputs, { apply, confirmId: options.confirmId });

  if (apply) {
    for (const result of results.filter((item) => item.classification === "ready")) {
      const report = result.report;
      const obsoleteEvent = result.obsoleteEvent;
      const canonicalEvent = result.canonicalEvent;

      if (!report || !obsoleteEvent || !canonicalEvent) {
        result.classification = "deletion_error";
        result.errors.push("Faltan datos auditados para ejecutar la eliminacion.");
        continue;
      }

      try {
        result.backupPath = await backupWriter.writeBackup(report, obsoleteEvent, canonicalEvent, generatedAt);
      } catch (error) {
        result.classification = "deletion_error";
        result.errors.push(`No se pudo crear el backup: ${error instanceof Error ? error.message : String(error)}`);
        continue;
      }

      try {
        const deletion = await repository.deleteObsolete(expectedObsolete(report));

        if (deletion.deletedCount !== 1) {
          result.classification = "deletion_error";
          result.errors.push(`La eliminacion afecto ${deletion.deletedCount} filas; se esperaba exactamente 1.`);
          continue;
        }

        const obsoleteAfter = await repository.findEventsById(report.obsolete_id);
        const canonicalAfter = await repository.findEventsById(report.canonical_id);

        if (obsoleteAfter.length !== 0) {
          result.classification = "deletion_error";
          result.errors.push("La verificacion posterior indica que el registro obsoleto sigue existiendo.");
          continue;
        }
        if (canonicalAfter.length !== 1) {
          result.classification = "deletion_error";
          result.errors.push(`La verificacion posterior del canonico devolvio ${canonicalAfter.length} filas; se esperaba 1.`);
          continue;
        }
        if (!isDeepStrictEqual(canonicalAfter[0], canonicalEvent)) {
          result.classification = "deletion_error";
          result.errors.push("El registro canonico cambio durante la operacion.");
          continue;
        }

        result.classification = "deleted";
      } catch (error) {
        result.classification = "deletion_error";
        result.errors.push(`Error durante la eliminacion o verificacion: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  return { results, summary: summarize(results) };
}

export class SupabaseCleanupRepository implements CleanupRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async findEventsById(id: string) {
    const { data, error } = await this.supabase.from("events").select("*").eq("id", id);

    if (error) throw new Error(`No se pudo consultar ${id}: ${error.message}`);

    return (data ?? []) as EventRecord[];
  }

  async deleteObsolete(request: DeleteRequest) {
    const { data, error } = await this.supabase
      .from("events")
      .delete()
      .eq("id", request.id)
      .eq("title", request.title)
      .eq("slug", request.slug)
      .eq("start_date", request.start_date)
      .eq("end_date", request.end_date)
      .eq("source_url", request.source_url)
      .select("id");

    if (error) throw new Error(`No se pudo eliminar ${request.id}: ${error.message}`);

    return { deletedCount: data?.length ?? 0 };
  }
}

export class FileCleanupBackupWriter implements CleanupBackupWriter {
  constructor(private readonly backupDirectory = path.join(process.cwd(), "data", "backups", "event-cleanup")) {}

  async writeBackup(report: CleanupReport, obsoleteEvent: EventRecord, canonicalEvent: EventRecord, generatedAt: string) {
    const safeId = report.obsolete_id.replace(/[^a-zA-Z0-9_-]+/g, "-");
    const fileName = `${generatedAt.slice(0, 10)}-${safeId}.json`;
    const backupPath = path.join(this.backupDirectory, fileName);
    const content = {
      generated_at: generatedAt,
      cleanup_report: report,
      obsolete_event_full: obsoleteEvent,
      canonical_event_full: canonicalEvent,
    };

    await mkdir(this.backupDirectory, { recursive: true });
    await writeFile(backupPath, `${JSON.stringify(content, null, 2)}\n`, "utf8");

    return backupPath;
  }
}

function summarize(results: CleanupResult[]) {
  return {
    total: results.length,
    validas: results.filter((result) => result.valid).length,
    ready: results.filter((result) => result.classification === "ready").length,
    blocked: results.filter((result) => result.classification === "blocked" || result.classification === "confirmation_required").length,
    obsoleteNotFound: results.filter((result) => result.classification === "obsolete_not_found").length,
    canonicalNotFound: results.filter((result) => result.classification === "canonical_not_found").length,
    mismatches: results.filter((result) => result.classification === "mismatch").length,
    deleted: results.filter((result) => result.classification === "deleted").length,
    deletionErrors: results.filter((result) => result.classification === "deletion_error").length,
  };
}

async function readCleanupFile(filePath: string) {
  const absolutePath = path.resolve(process.cwd(), filePath);
  const parsed = JSON.parse(await readFile(absolutePath, "utf8")) as unknown;

  if (!Array.isArray(parsed)) throw new Error("El informe de limpieza debe contener un array.");

  return parsed.map((item, index) => {
    if (!isRecord(item)) throw new Error(`Incidencia ${index + 1}: se esperaba un objeto.`);

    return item;
  });
}

function checkLabel(value: boolean | null) {
  if (value === null) return "NO COMPROBADO";

  return value ? "OK" : "ERROR";
}

function printChecks(label: string, checks: IdentityChecks) {
  console.log(`- validacion ${label}:`);
  for (const field of IDENTITY_FIELDS) console.log(`  - ${field}: ${checkLabel(checks[field])}`);
}

function printReport(execution: CleanupExecution, apply: boolean, confirmId: string | null) {
  const { results, summary } = execution;
  const applyEnabled = apply && Boolean(confirmId);

  console.log(`Modo: ${applyEnabled ? "APPLY" : apply ? "APPLY BLOQUEADO" : "DRY-RUN"}`);
  console.log("Resumen:");
  console.log(`- incidencias leidas: ${summary.total}`);
  console.log(`- incidencias validas: ${summary.validas}`);
  console.log(`- listas para retirar: ${summary.ready}`);
  console.log(`- bloqueadas: ${summary.blocked}`);
  console.log(`- obsoletas no encontradas: ${summary.obsoleteNotFound}`);
  console.log(`- canonicas no encontradas: ${summary.canonicalNotFound}`);
  console.log(`- discrepancias: ${summary.mismatches}`);
  console.log(`- eliminadas: ${summary.deleted}`);
  console.log(`- errores de eliminacion: ${summary.deletionErrors}`);

  for (const result of results) {
    const report = result.report;
    const obsoleteTitle = report?.obsolete_title || String(result.input.obsolete_title || `(incidencia ${result.index + 1})`);

    console.log(`\n[${result.classification}] ${obsoleteTitle}`);
    console.log(`- obsolete_id: ${report?.obsolete_id || String(result.input.obsolete_id || "no disponible")}`);
    console.log(`- obsolete_title: ${report?.obsolete_title || "no disponible"}`);
    console.log(`- obsolete_slug: ${report?.obsolete_slug || "no disponible"}`);
    console.log(`- fechas obsoleto: ${report ? `${report.obsolete_start_date} a ${report.obsolete_end_date}` : "no disponible"}`);
    console.log(`- fuente obsoleto: ${report?.obsolete_source_url || "no disponible"}`);
    console.log(`- canonical_id: ${report?.canonical_id || "no disponible"}`);
    console.log(`- canonical_title: ${report?.canonical_title || "no disponible"}`);
    console.log(`- canonical_slug: ${report?.canonical_slug || "no disponible"}`);
    console.log(`- fechas canonico: ${report ? `${report.canonical_start_date} a ${report.canonical_end_date}` : "no disponible"}`);
    console.log(`- fuente canonico: ${report?.canonical_source_url || "no disponible"}`);
    console.log(`- validacion informe: ${result.valid ? "OK" : "ERROR"}`);
    printChecks("registro obsoleto", result.obsoleteChecks);
    printChecks("registro canonico", result.canonicalChecks);
    if (result.backupPath) console.log(`- backup: ${result.backupPath}`);
    if (result.errors.length) console.log(`- motivos: ${result.errors.join(" | ")}`);
  }

  if (!applyEnabled) console.log("\nDry-run: no se ha insertado, actualizado ni eliminado ningun evento y no se ha creado ningun backup.");
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

  return new SupabaseCleanupRepository(supabase);
}

async function main() {
  const file = getArg("--file");
  const apply = hasFlag("--apply");
  const confirmId = getArg("--confirm-id");

  if (!file) {
    throw new Error("Uso: npm run cleanup:events -- --file data/research/cleanup.json [--apply --confirm-id obsolete_id]");
  }

  const inputs = await readCleanupFile(file);
  const repository = await createRepository();
  const backupWriter = new FileCleanupBackupWriter();
  const execution = await executeCleanup(repository, backupWriter, inputs, { apply, confirmId });

  printReport(execution, apply, confirmId);
}

const entryPoint = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;

if (entryPoint === import.meta.url) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);

    console.error(`\nLimpieza de eventos fallida: ${message}`);
    process.exitCode = 1;
  });
}
