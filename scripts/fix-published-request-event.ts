import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import {
  assertEventUpdatedAtChanged,
  withNextEventUpdatedAt,
} from "@/lib/event-updates";
import type { EventRow } from "@/lib/supabase";

export const TARGET_SLUG = "concentracion-de-coches-baranain-2026-09-12";
export const TARGET_REQUEST_ID = "b008383e-d4d0-4bfe-a613-894057664286";
export const EXPECTED_CURRENT_UPDATED_AT = "2026-07-25T17:53:49.747+00:00";

export const PROPOSED_PATCH = {
  title: "II Concentración de Coches Clásicos Baifest Barañáin 2026",
  venue: "Lago de Barañáin (Parque de la construcción)",
  discipline: "Clásicos",
  championship: null,
  country: "ES",
  source: "Clásicos Barañáin",
  source_url: "https://www.instagram.com/clasicosbara/",
  official_url: "https://www.instagram.com/clasicosbara/",
  organizer_name: "Clásicos Barañáin",
  organizer_url: "https://www.instagram.com/clasicosbara/",
  source_type: "organizer",
  event_status: "confirmed",
  data_quality: "reviewed",
  needs_review: false,
  confidence_score: 90,
  ticket_url: null,
  registration_url: "https://wa.me/34611636103",
  image_url: null,
  image_source_url: "https://www.instagram.com/clasicosbara/",
  short_description:
    "La II Concentración de Coches Clásicos de la Baifest reunirá en el Lago de Barañáin vehículos de más de 30 años el 12 de septiembre de 2026, con trofeos, sorteos, música, gastronomía y actividades para toda la familia.",
  long_description:
    "La II Concentración de Coches Clásicos de la Baifest se celebrará el 12 de septiembre de 2026 en el Lago de Barañáin.\n\nLa jornada estará dedicada a vehículos clásicos de más de 30 años y contará con trofeos para el coche más votado, el vehículo más antiguo y el participante llegado desde mayor distancia.\n\nDurante el evento también habrá sorteos, música en directo, comida, bebida y una pequeña feria, dentro de la programación de Baifest 2026.\n\nLas inscripciones están abiertas a través de WhatsApp en el 611 636 103. Antes de desplazarte, consulta las publicaciones de la organización para confirmar horarios y posibles novedades.",
  tags: ["coches clásicos", "clásicos", "Baifest", "Barañáin", "Navarra", "concentración"],
  notes: null,
} as const;

const EXPECTED_CURRENT: Partial<EventRow> = {
  title: "Concentración de Coches",
  venue: "Lago de Barañain (Parque de la construcción)",
  championship: "Naiara",
  discipline: "Concentraciones",
  country: null,
  source: "Naiara",
  source_url: "https://www.instagram.com/clasicosbara?igsh=MWFubXdiZTNia2ExaA==",
  official_url: null,
  organizer_name: null,
  organizer_url: null,
  source_type: null,
  event_status: null,
  data_quality: "published",
  needs_review: null,
  confidence_score: null,
  ticket_url: "https://611636103",
  registration_url: null,
  image_url: null,
  image_source_url: null,
  short_description: null,
  long_description: null,
  tags: ["Concentraciones", "Feria del motor", "Barañáin", "Navarra"],
};

type PatchValue = string | number | boolean | string[] | null;
type PatchRecord = Record<string, PatchValue>;

export type ScriptOptions = {
  apply: boolean;
  confirmSlug: string | null;
  confirmRequestId: string | null;
  confirmCurrentUpdatedAt: string | null;
  confirmPatchSha256: string | null;
};

export interface PatchRepository {
  findBySlug(slug: string): Promise<EventRow[]>;
  updateBySlugAndUpdatedAt(slug: string, updatedAt: string, patch: PatchRecord): Promise<EventRow[]>;
}

export interface PatchStorage {
  writeJson(filePath: string, value: unknown): Promise<void>;
}

export type PatchPlan = {
  changes: Array<{ field: string; current: PatchValue; proposed: PatchValue }>;
  drift: Array<{ field: string; expected: PatchValue; current: PatchValue }>;
};

function comparable(value: unknown) {
  return JSON.stringify(value);
}

function equal(left: unknown, right: unknown) {
  return comparable(left) === comparable(right);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return value;
}

export function patchSha256() {
  const payload = {
    request_id: TARGET_REQUEST_ID,
    slug: TARGET_SLUG,
    patch: PROPOSED_PATCH,
  };
  return createHash("sha256").update(JSON.stringify(canonicalize(payload))).digest("hex");
}

function valueArg(args: string[], name: string) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] || null : null;
}

export function parseOptions(args: string[]): ScriptOptions {
  const valueFlags = new Set([
    "--confirm-slug",
    "--confirm-request-id",
    "--confirm-current-updated-at",
    "--confirm-patch-sha256",
  ]);

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--apply") continue;
    if (!valueFlags.has(arg)) throw new Error(`Argumento no reconocido: ${arg}`);
    if (!args[index + 1] || args[index + 1].startsWith("--")) throw new Error(`Falta el valor de ${arg}`);
    index += 1;
  }

  return {
    apply: args.includes("--apply"),
    confirmSlug: valueArg(args, "--confirm-slug"),
    confirmRequestId: valueArg(args, "--confirm-request-id"),
    confirmCurrentUpdatedAt: valueArg(args, "--confirm-current-updated-at"),
    confirmPatchSha256: valueArg(args, "--confirm-patch-sha256"),
  };
}

export function validateApplyConfirmations(options: ScriptOptions, current: EventRow) {
  if (!options.apply) return;
  const errors: string[] = [];
  if (options.confirmSlug !== TARGET_SLUG) errors.push(`--confirm-slug debe ser ${TARGET_SLUG}`);
  if (options.confirmRequestId !== TARGET_REQUEST_ID) errors.push(`--confirm-request-id debe ser ${TARGET_REQUEST_ID}`);
  if (options.confirmCurrentUpdatedAt !== current.updated_at) errors.push(`--confirm-current-updated-at debe ser ${current.updated_at}`);
  if (options.confirmPatchSha256 !== patchSha256()) errors.push(`--confirm-patch-sha256 debe ser ${patchSha256()}`);
  if (errors.length) throw new Error(errors.join("\n"));
}

export function buildPlan(current: EventRow): PatchPlan {
  const changes: PatchPlan["changes"] = [];
  const drift: PatchPlan["drift"] = [];

  for (const [field, proposed] of Object.entries(PROPOSED_PATCH) as Array<[keyof typeof PROPOSED_PATCH, PatchValue]>) {
    const currentValue = current[field as keyof EventRow] as PatchValue;
    if (equal(currentValue, proposed)) continue;

    if (field !== "notes" && field in EXPECTED_CURRENT) {
      const expected = EXPECTED_CURRENT[field as keyof EventRow] as PatchValue;
      if (!equal(currentValue, expected)) {
        drift.push({ field, expected, current: currentValue });
        continue;
      }
    }
    changes.push({ field, current: currentValue, proposed });
  }

  if (current.updated_at !== EXPECTED_CURRENT_UPDATED_AT) {
    drift.push({
      field: "updated_at",
      expected: EXPECTED_CURRENT_UPDATED_AT,
      current: current.updated_at,
    });
  }

  return { changes, drift };
}

export function buildRollback(current: EventRow, plan: PatchPlan) {
  return {
    slug: current.slug,
    request_id: TARGET_REQUEST_ID,
    patch_sha256: patchSha256(),
    restore_values: Object.fromEntries(plan.changes.map(({ field, current: value }) => [field, value])),
    original_updated_at: current.updated_at,
    instructions: "Restaurar solo tras validar el backup y exigir concurrencia por el updated_at posterior al parche.",
  };
}

function verifyPatchedRow(before: EventRow, after: EventRow) {
  const errors: string[] = [];
  if (after.slug !== before.slug) errors.push("El slug cambió.");
  if (after.created_at !== before.created_at) errors.push("created_at cambió.");
  try {
    assertEventUpdatedAtChanged(before.updated_at, after);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
  for (const [field, expected] of Object.entries(PROPOSED_PATCH)) {
    if (!equal(after[field as keyof EventRow], expected)) errors.push(`${field} no coincide con el parche.`);
  }
  return errors;
}

export async function executePatch(input: {
  options: ScriptOptions;
  repository: PatchRepository;
  storage: PatchStorage;
  backupDirectory?: string;
  now?: Date;
}) {
  const rows = await input.repository.findBySlug(TARGET_SLUG);
  if (rows.length !== 1) throw new Error(`Se esperaba exactamente 1 fila para ${TARGET_SLUG}; encontradas: ${rows.length}.`);

  const current = rows[0];
  if (current.slug !== TARGET_SLUG) throw new Error("La fila devuelta no conserva el slug objetivo.");
  const plan = buildPlan(current);
  if (plan.drift.length) throw new Error(`Drift detectado:\n${JSON.stringify(plan.drift, null, 2)}`);
  validateApplyConfirmations(input.options, current);

  if (!input.options.apply) {
    return {
      mode: "dry-run" as const,
      current,
      plan,
      patchSha256: patchSha256(),
      writes: 0,
      backupPath: null,
      rollbackPath: null,
      verificationErrors: [] as string[],
    };
  }

  const operationNow = input.now || new Date();
  const timestamp = operationNow.toISOString().replace(/[-:.]/g, "");
  const directory = input.backupDirectory || path.join(process.cwd(), ".codex-backups", "published-request-event");
  const backupPath = path.join(directory, `${TARGET_SLUG}-${timestamp}-backup.json`);
  const rollbackPath = path.join(directory, `${TARGET_SLUG}-${timestamp}-rollback.json`);
  await input.storage.writeJson(backupPath, current);
  await input.storage.writeJson(rollbackPath, buildRollback(current, plan));

  const patch = withNextEventUpdatedAt(
    Object.fromEntries(plan.changes.map(({ field, proposed }) => [field, proposed])) as PatchRecord,
    current.updated_at,
    operationNow,
  );
  const updatedRows = await input.repository.updateBySlugAndUpdatedAt(TARGET_SLUG, current.updated_at, patch);
  if (updatedRows.length !== 1) throw new Error("El update fue bloqueado por drift de updated_at o no devolvió exactamente una fila.");

  const verificationErrors = verifyPatchedRow(current, updatedRows[0]);
  if (verificationErrors.length) throw new Error(`Falló la verificación posterior: ${verificationErrors.join(" ")}`);

  return {
    mode: "apply" as const,
    current,
    plan,
    patchSha256: patchSha256(),
    writes: 1,
    backupPath,
    rollbackPath,
    verificationErrors,
  };
}

class FileStorage implements PatchStorage {
  async writeJson(filePath: string, value: unknown) {
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  }
}

function supabaseRepository(): PatchRepository {
  loadEnvConfig(process.cwd());
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  return {
    async findBySlug(slug) {
      const { data, error } = await client.from("events").select("*").eq("slug", slug);
      if (error) throw error;
      return (data || []) as EventRow[];
    },
    async updateBySlugAndUpdatedAt(slug, updatedAt, patch) {
      const { data, error } = await client
        .from("events")
        .update(patch)
        .eq("slug", slug)
        .eq("updated_at", updatedAt)
        .select("*");
      if (error) throw error;
      return (data || []) as EventRow[];
    },
  };
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const result = await executePatch({
    options,
    repository: supabaseRepository(),
    storage: new FileStorage(),
  });

  console.log(`Modo: ${result.mode}`);
  console.log(`Slug: ${TARGET_SLUG}`);
  console.log(`updated_at actual: ${result.current.updated_at}`);
  console.log(`SHA-256 del parche: ${result.patchSha256}`);
  console.log(`Campos que cambiarían: ${result.plan.changes.length}`);
  for (const change of result.plan.changes) {
    console.log(`- ${change.field}`);
    console.log(`  actual: ${JSON.stringify(change.current)}`);
    console.log(`  propuesto: ${JSON.stringify(change.proposed)}`);
  }
  console.log(`Escrituras en Supabase: ${result.writes}`);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : JSON.stringify(error));
    process.exitCode = 1;
  });
}
