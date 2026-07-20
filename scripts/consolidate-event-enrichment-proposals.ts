import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadEnvConfig } from "@next/env";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { dateInTimeZone, ENRICHMENT_TIME_ZONE, type ResearchEventRow } from "./export-future-events-for-enrichment";

export const CONSOLIDATION_VERSION = "1.0.0";
export const READ_ONLY_CONSOLIDATION_OPERATIONS = ["select", "in"] as const;
export const EVENT_COLUMNS = [
  "id", "slug", "title", "championship", "discipline", "start_date", "end_date", "venue", "city", "province", "region", "country",
  "level", "source", "source_url", "source_id", "ticket_url", "official_url", "registration_url", "image_url", "image_source_url",
  "event_status", "short_description", "long_description", "schedule_text", "address", "latitude", "longitude", "organizer_name",
  "organizer_url", "verified_at", "source_type", "confidence_score", "needs_review", "tags", "vehicle_type", "featured", "visible",
  "import_method", "data_quality", "notes", "created_at", "updated_at",
] as const;

export type EventColumn = (typeof EVENT_COLUMNS)[number];
export type Readiness = "ready_to_apply" | "ready_with_warnings" | "blocked_by_drift" | "blocked_by_invalid_field" | "blocked_by_conflict";
export type ProposalInput = {
  id: string;
  decision?: string;
  proposed_updates?: Record<string, unknown>;
  clear_or_replace_current_values?: Record<string, unknown>;
  unresolved?: unknown;
  sources?: unknown;
  observations?: unknown;
};

type ResearchBatch = { metadata?: Record<string, unknown>; events: Array<ResearchEventRow & Record<string, unknown>> };
type ProposalBlock = { metadata?: Record<string, unknown>; events: ProposalInput[] };
type FieldValue = string | number | boolean | string[] | null;
type FieldRecord = Record<string, FieldValue>;

export type ValidatedProposal = {
  id: string;
  decision: string;
  proposed_updates: FieldRecord;
  explicit_clears: Record<string, FieldValue>;
  unresolved_fields: string[];
  sources: string[];
  observations: string[];
  validation_errors: string[];
  validation_warnings: string[];
};

export type ManifestEvent = {
  id: string;
  slug: string | null;
  readiness: Readiness;
  expected_current: FieldRecord;
  current_database_values: FieldRecord;
  proposed_updates: FieldRecord;
  explicit_clears: string[];
  unchanged_fields: string[];
  unresolved_fields: string[];
  drift: Array<{ field: string; expected: FieldValue; current: FieldValue; proposed: FieldValue | undefined; resolution: string }>;
  conflicts: string[];
  warnings: string[];
  sources: string[];
  proposed_confidence_score: number | null;
  impact_summary: {
    changed_fields: string[];
    risk: "low" | "medium" | "high";
    title_changed: boolean;
    dates_changed: boolean;
    discipline_changed: boolean;
    source_replaced: boolean;
    organizer_changed: boolean;
    schedule_added: boolean;
    address_added: boolean;
    needs_review_cleared: boolean;
    becomes_historical: boolean;
    slug_semantically_stale: boolean;
    slug_warnings: string[];
  };
};

export interface EnrichmentStateRepository {
  findEventsByIds(ids: string[]): Promise<ResearchEventRow[]>;
}

type ReadOnlyDatabase = {
  public: {
    Tables: { events: { Row: ResearchEventRow; Insert: never; Update: never; Relationships: [] } };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

const OUTPUT_DIR = path.join(process.cwd(), "data", "research", "enrichment");
const BATCH_FILE = path.join(OUTPUT_DIR, "lote-investigacion-001.json");
const BLOCK_FILES = [1, 2, 3, 4].map((block) => path.join(OUTPUT_DIR, `lote-investigacion-001-bloque-0${block}-propuestas.json`));
const MUTABLE_COLUMNS = new Set<EventColumn>(EVENT_COLUMNS.filter((field) => !["id", "slug", "created_at", "updated_at"].includes(field)));
const NON_NULLABLE_COLUMNS = new Set<EventColumn>(["id", "title", "start_date", "tags", "featured", "visible", "data_quality", "created_at", "updated_at"]);
const URL_COLUMNS = new Set<EventColumn>(["source_url", "ticket_url", "official_url", "registration_url", "image_url", "image_source_url", "organizer_url"]);
const DATE_COLUMNS = new Set<EventColumn>(["start_date", "end_date"]);
const NUMBER_COLUMNS = new Set<EventColumn>(["latitude", "longitude", "confidence_score"]);
const BOOLEAN_COLUMNS = new Set<EventColumn>(["needs_review", "featured", "visible"]);
const ARRAY_COLUMNS = new Set<EventColumn>(["tags"]);
const ALLOWED_EVENT_STATUSES = new Set(["confirmed", "tentative", "postponed", "cancelled"]);
const ALLOWED_SOURCE_TYPES = new Set(["official", "organizer", "federation", "circuit", "municipality", "media", "aggregator", "secondary", "unknown"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function valuesEqual(left: unknown, right: unknown) {
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((value, index) => value === right[index]);
  }
  return left === right;
}

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isIsoTimestamp(value: string) {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && !Number.isNaN(new Date(value).getTime());
}

function isHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeComparable(value: string | null | undefined) {
  return (value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function cloneValue(value: unknown): FieldValue {
  if (Array.isArray(value)) return value.map(String);
  return value as FieldValue;
}

function rowFields(row: ResearchEventRow & Record<string, unknown>) {
  return Object.fromEntries(EVENT_COLUMNS.map((field) => [field, cloneValue(row[field])])) as FieldRecord;
}

export function assertConsolidationReadOnly(operations: readonly string[]) {
  const allowed = new Set<string>(READ_ONLY_CONSOLIDATION_OPERATIONS);
  const forbidden = operations.filter((operation) => !allowed.has(operation));
  if (forbidden.length) throw new Error(`Operación Supabase no autorizada: ${forbidden.join(", ")}`);
}

function validateField(field: string, value: unknown, errors: string[]) {
  if (!EVENT_COLUMNS.includes(field as EventColumn)) {
    errors.push(`Campo inexistente en events: ${field}.`);
    return;
  }
  const column = field as EventColumn;
  if (!MUTABLE_COLUMNS.has(column)) {
    errors.push(`Campo no modificable en este lote: ${field}.`);
    return;
  }
  if (value === null) return;
  if (ARRAY_COLUMNS.has(column)) {
    if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) errors.push(`${field} debe ser un array de textos.`);
  } else if (BOOLEAN_COLUMNS.has(column)) {
    if (typeof value !== "boolean") errors.push(`${field} debe ser boolean.`);
  } else if (NUMBER_COLUMNS.has(column)) {
    if (typeof value !== "number" || !Number.isFinite(value)) errors.push(`${field} debe ser numérico.`);
    if (field === "confidence_score" && typeof value === "number" && (value < 0 || value > 100)) errors.push("confidence_score debe estar entre 0 y 100.");
  } else if (typeof value !== "string") {
    errors.push(`${field} debe ser texto o null.`);
  }
  if (typeof value === "string" && DATE_COLUMNS.has(column) && !isIsoDate(value)) errors.push(`${field} debe usar YYYY-MM-DD válido.`);
  if (typeof value === "string" && field === "verified_at" && !isIsoTimestamp(value)) errors.push("verified_at debe usar un timestamp ISO 8601 con zona horaria.");
  if (typeof value === "string" && URL_COLUMNS.has(column) && !isHttpUrl(value)) errors.push(`${field} debe ser una URL HTTP(S) válida.`);
  if (field === "event_status" && typeof value === "string" && !ALLOWED_EVENT_STATUSES.has(value)) errors.push(`event_status no admitido: ${value}.`);
  if (field === "source_type" && typeof value === "string" && !ALLOWED_SOURCE_TYPES.has(value)) errors.push(`source_type no admitido: ${value}.`);
}

export function validateProposal(input: ProposalInput): ValidatedProposal {
  const errors: string[] = [];
  const warnings: string[] = [];
  const proposed: FieldRecord = {};
  const clears: Record<string, FieldValue> = {};
  const id = typeof input.id === "string" ? input.id.trim() : "";
  if (!id) errors.push("id es obligatorio.");
  if (!isRecord(input.proposed_updates)) errors.push("proposed_updates debe ser un objeto.");

  for (const [field, value] of Object.entries(isRecord(input.proposed_updates) ? input.proposed_updates : {})) {
    validateField(field, value, errors);
    if (field === "slug") errors.push("El slug nunca puede modificarse en este lote.");
    if (value === null) {
      warnings.push(`null_no_borra:${field}`);
      continue;
    }
    proposed[field] = cloneValue(value);
  }

  if (input.clear_or_replace_current_values !== undefined) {
    if (!isRecord(input.clear_or_replace_current_values)) {
      errors.push("clear_or_replace_current_values debe ser un objeto.");
    } else {
      for (const [field, expected] of Object.entries(input.clear_or_replace_current_values)) {
        if (field === "reason") continue;
        validateField(field, expected, errors);
        if (EVENT_COLUMNS.includes(field as EventColumn) && NON_NULLABLE_COLUMNS.has(field as EventColumn)) errors.push(`No se puede borrar el campo obligatorio ${field}.`);
        if (field in proposed) errors.push(`${field} no puede proponerse y borrarse a la vez.`);
        clears[field] = cloneValue(expected);
      }
      if (!Object.keys(clears).length) errors.push("clear_or_replace_current_values no contiene ningún campo a limpiar.");
      if (typeof input.clear_or_replace_current_values.reason !== "string" || !input.clear_or_replace_current_values.reason.trim()) {
        errors.push("clear_or_replace_current_values.reason es obligatorio.");
      }
    }
  }

  const unresolved = Array.isArray(input.unresolved) && input.unresolved.every((value) => typeof value === "string") ? [...input.unresolved] : [];
  if (input.unresolved !== undefined && !unresolved.length && (!Array.isArray(input.unresolved) || input.unresolved.length)) errors.push("unresolved debe ser un array de textos.");
  const sources = Array.isArray(input.sources) && input.sources.every((value) => typeof value === "string") ? [...input.sources] : [];
  if (!sources.length) errors.push("sources debe contener al menos una URL.");
  for (const source of sources) if (!isHttpUrl(source)) errors.push(`URL de fuente inválida: ${source}.`);
  const observations = Array.isArray(input.observations) && input.observations.every((value) => typeof value === "string") ? [...input.observations] : [];
  if (input.observations !== undefined && !observations.length && (!Array.isArray(input.observations) || input.observations.length)) errors.push("observations debe ser un array de textos.");

  const startDate = proposed.start_date;
  const endDate = proposed.end_date;
  if (typeof startDate === "string" && typeof endDate === "string" && endDate < startDate) errors.push("end_date no puede ser anterior a start_date.");

  return {
    id,
    decision: typeof input.decision === "string" ? input.decision : "update",
    proposed_updates: proposed,
    explicit_clears: clears,
    unresolved_fields: unresolved,
    sources,
    observations,
    validation_errors: [...new Set(errors)],
    validation_warnings: [...new Set(warnings)],
  };
}

export function consolidateInputs(batch: ResearchBatch, blocks: ProposalBlock[]) {
  if (blocks.length !== 4) throw new Error(`Se requieren exactamente cuatro bloques; recibidos: ${blocks.length}.`);
  if (!Array.isArray(batch.events) || batch.events.length !== 20) throw new Error("El Lote 001 debe contener exactamente 20 eventos.");
  const batchIds = batch.events.map((event) => event.id);
  if (new Set(batchIds).size !== 20) throw new Error("El Lote 001 debe contener 20 IDs únicos.");
  const inputs = blocks.flatMap((block, index) => {
    if (!Array.isArray(block.events)) throw new Error(`El bloque ${index + 1} no contiene events.`);
    return block.events;
  });
  if (inputs.length !== 20) throw new Error(`Los cuatro bloques deben contener exactamente 20 propuestas; recibidas: ${inputs.length}.`);
  const proposalIds = inputs.map((input) => input.id);
  if (new Set(proposalIds).size !== 20) throw new Error("Los bloques contienen IDs duplicados.");
  const missing = batchIds.filter((id) => !proposalIds.includes(id));
  const additional = proposalIds.filter((id) => !batchIds.includes(id));
  if (missing.length) throw new Error(`Faltan IDs del Lote 001: ${missing.join(", ")}.`);
  if (additional.length) throw new Error(`Hay IDs adicionales: ${additional.join(", ")}.`);
  const byId = new Map(inputs.map((input) => [input.id, input]));
  return batchIds.map((id) => validateProposal(byId.get(id) as ProposalInput));
}

export function validateCriticalCorrections(proposals: ValidatedProposal[]) {
  const errors: string[] = [];
  const byId = new Map(proposals.map((proposal) => [proposal.id, proposal]));
  const requireValue = (id: string, field: string, expected: FieldValue) => {
    const actual = byId.get(id)?.proposed_updates[field];
    if (!valuesEqual(actual, expected)) errors.push(`${id}: ${field} debe ser ${JSON.stringify(expected)}.`);
  };
  requireValue("pujada-alp-2500-2026-07-25", "title", "XV Pujada Alp 2500 2026");
  requireValue("pujada-alp-2500-2026-07-25", "start_date", "2026-07-11");
  requireValue("pujada-alp-2500-2026-07-25", "end_date", "2026-07-12");
  if ("event_status" in (byId.get("pujada-alp-2500-2026-07-25")?.proposed_updates || {})) errors.push("Pujada Alp no debe inventar un event_status para completado.");
  requireValue("batch-rallysprint-betancuria-2026-07-25", "title", "XIII Subida a Betancuria 2026");
  requireValue("batch-rallysprint-betancuria-2026-07-25", "discipline", "Subida");
  requireValue("batch-xiii-concentracion-vehiculos-clasicos-ciudad-sagunto-2026-07-26", "title", "XII Concentración de Coches y Motos Clásicos Ciudad de Sagunto 2026");
  const saguntoSchedule = byId.get("batch-xiii-concentracion-vehiculos-clasicos-ciudad-sagunto-2026-07-26")?.proposed_updates.schedule_text;
  if (typeof saguntoSchedule !== "string" || saguntoSchedule.includes("10:00")) errors.push("Sagunto debe retirar el almuerzo de las 10:00 del programa.");
  requireValue("batch-enduro-indoor-andalucia-olvera-2026-07-26", "title", "I Enduro Indoor Ciudad de Olvera 2026");
  requireValue("batch-enduro-indoor-andalucia-olvera-2026-07-26", "start_date", "2026-07-25");
  requireValue("batch-enduro-indoor-andalucia-olvera-2026-07-26", "end_date", "2026-07-25");
  const ibio = byId.get("batch-enduro-comunidad-madrid-ibio-2026-07-26");
  if (!ibio || !("organizer_name" in ibio.explicit_clears)) errors.push("Enduro Ibio debe limpiar organizer_name únicamente mediante acción explícita.");
  return errors;
}

function slugWarnings(expected: ResearchEventRow, proposed: FieldRecord) {
  const warnings: string[] = [];
  const slug = expected.slug || "";
  if (typeof proposed.start_date === "string" && proposed.start_date !== expected.start_date && slug.includes(expected.start_date) && !slug.includes(proposed.start_date)) {
    warnings.push(`El slug conserva la fecha anterior ${expected.start_date}.`);
  }
  if (typeof proposed.discipline === "string" && proposed.discipline !== expected.discipline) {
    const oldDiscipline = normalizeComparable(expected.discipline);
    const newDiscipline = normalizeComparable(proposed.discipline);
    const normalizedSlug = normalizeComparable(slug);
    if (oldDiscipline && normalizedSlug.includes(oldDiscipline) && !normalizedSlug.includes(newDiscipline)) warnings.push(`El slug conserva la disciplina anterior ${expected.discipline}.`);
  }
  if (typeof proposed.title === "string" && proposed.title !== expected.title) {
    const edition = (value: string) => normalizeComparable(value).split(" ").filter((token) => /^(?:[ivxlcdm]+|\d{1,3})$/.test(token));
    const oldEditions = edition(expected.title);
    const newEditions = edition(proposed.title);
    if (oldEditions.length && newEditions.length && oldEditions.join("|") !== newEditions.join("|") && oldEditions.some((token) => normalizeComparable(slug).includes(token))) {
      warnings.push("El slug conserva la edición anterior del título.");
    }
    const generic = new Set(["de", "del", "la", "el", "y", "2026"]);
    const tokens = (value: string) => new Set(normalizeComparable(value).split(" ").filter((token) => token.length > 1 && !generic.has(token)));
    const currentTokens = tokens(expected.title);
    const proposedTokens = tokens(proposed.title);
    const intersection = [...currentTokens].filter((token) => proposedTokens.has(token)).length;
    const union = new Set([...currentTokens, ...proposedTokens]).size;
    if (union && intersection / union < 0.35) warnings.push("El slug conserva una identidad anterior del evento.");
  }
  return warnings;
}

function finalValue(current: ResearchEventRow, proposal: ValidatedProposal, field: EventColumn) {
  if (field in proposal.explicit_clears) return null;
  if (field in proposal.proposed_updates) return proposal.proposed_updates[field];
  return current[field] as FieldValue;
}

export function classifyProposal(
  expected: ResearchEventRow,
  current: ResearchEventRow | null,
  proposal: ValidatedProposal,
  today: string,
): ManifestEvent {
  const expectedFields = rowFields(expected as ResearchEventRow & Record<string, unknown>);
  const currentFields = current ? rowFields(current as ResearchEventRow & Record<string, unknown>) : {};
  const conflicts: string[] = [];
  const warnings = [...proposal.validation_warnings];
  const drift: ManifestEvent["drift"] = [];
  const actionFields = new Set([...Object.keys(proposal.proposed_updates), ...Object.keys(proposal.explicit_clears)]);

  if (!current) conflicts.push("El evento no existe actualmente en Supabase.");
  if (current) {
    for (const field of EVENT_COLUMNS) {
      const expectedValue = expectedFields[field];
      const currentValue = currentFields[field];
      if (valuesEqual(expectedValue, currentValue)) continue;
      const proposedValue = field in proposal.explicit_clears ? null : proposal.proposed_updates[field];
      const resolution = actionFields.has(field)
        ? valuesEqual(currentValue, proposedValue) ? "already_matches_proposal" : "conflicts_with_proposal"
        : "unrelated_drift";
      drift.push({ field, expected: expectedValue, current: currentValue, proposed: proposedValue, resolution });
      if (resolution === "conflicts_with_proposal") conflicts.push(`Deriva en ${field}: el valor actual no coincide con la exportación ni con la propuesta.`);
      else warnings.push(`drift:${field}:${resolution}`);
    }
    for (const [field, expectedClearValue] of Object.entries(proposal.explicit_clears)) {
      if (!valuesEqual(currentFields[field], expectedClearValue) && currentFields[field] !== null) {
        conflicts.push(`La precondición de limpieza de ${field} no coincide con Supabase.`);
      }
    }
  }

  const changedFields = current
    ? [...actionFields].filter((field) => !valuesEqual(currentFields[field], field in proposal.explicit_clears ? null : proposal.proposed_updates[field])).sort()
    : [];
  const slugNotes = slugWarnings(expected, proposal.proposed_updates);
  warnings.push(...slugNotes);
  if (proposal.unresolved_fields.length) warnings.push(`${proposal.unresolved_fields.length} campos o decisiones siguen sin resolver.`);
  if (Object.keys(proposal.explicit_clears).length) warnings.push("Contiene una limpieza explícita sujeta a precondición.");

  const finalEnd = current ? String(finalValue(current, proposal, "end_date") || finalValue(current, proposal, "start_date")) : expected.end_date || expected.start_date;
  const becomesHistorical = finalEnd < today && (expected.end_date || expected.start_date) >= today;
  if (becomesHistorical) warnings.push("La corrección de fechas hará que el evento pase a histórico.");

  let readiness: Readiness;
  if (proposal.validation_errors.length) readiness = "blocked_by_invalid_field";
  else if (!current) readiness = "blocked_by_conflict";
  else if (conflicts.some((conflict) => conflict.startsWith("Deriva") || conflict.startsWith("La precondición"))) readiness = "blocked_by_drift";
  else if (conflicts.length) readiness = "blocked_by_conflict";
  else if (warnings.length) readiness = "ready_with_warnings";
  else readiness = "ready_to_apply";

  const proposedTitle = proposal.proposed_updates.title;
  const proposedStart = proposal.proposed_updates.start_date;
  const proposedEnd = proposal.proposed_updates.end_date;
  const titleChanged = typeof proposedTitle === "string" && proposedTitle !== current?.title;
  const datesChanged = (typeof proposedStart === "string" && proposedStart !== current?.start_date) || (typeof proposedEnd === "string" && proposedEnd !== current?.end_date);
  const disciplineChanged = typeof proposal.proposed_updates.discipline === "string" && proposal.proposed_updates.discipline !== current?.discipline;
  const sourceReplaced = ["source", "source_url", "official_url"].some((field) => field in proposal.proposed_updates && !valuesEqual(proposal.proposed_updates[field], currentFields[field]));
  const organizerChanged = ["organizer_name", "organizer_url"].some((field) => actionFields.has(field) && !valuesEqual(field in proposal.explicit_clears ? null : proposal.proposed_updates[field], currentFields[field]));

  return {
    id: proposal.id,
    slug: current?.slug ?? expected.slug,
    readiness,
    expected_current: expectedFields,
    current_database_values: currentFields,
    proposed_updates: proposal.proposed_updates,
    explicit_clears: Object.keys(proposal.explicit_clears).sort(),
    unchanged_fields: EVENT_COLUMNS.filter((field) => !actionFields.has(field)),
    unresolved_fields: proposal.unresolved_fields,
    drift,
    conflicts: [...proposal.validation_errors, ...conflicts],
    warnings: [...new Set(warnings)],
    sources: proposal.sources,
    proposed_confidence_score: typeof proposal.proposed_updates.confidence_score === "number" ? proposal.proposed_updates.confidence_score : current?.confidence_score ?? null,
    impact_summary: {
      changed_fields: changedFields,
      risk: readiness.startsWith("blocked") || becomesHistorical ? "high" : titleChanged || datesChanged || disciplineChanged || Object.keys(proposal.explicit_clears).length ? "medium" : "low",
      title_changed: titleChanged,
      dates_changed: datesChanged,
      discipline_changed: disciplineChanged,
      source_replaced: sourceReplaced,
      organizer_changed: organizerChanged,
      schedule_added: Boolean(proposal.proposed_updates.schedule_text && !current?.schedule_text),
      address_added: Boolean(proposal.proposed_updates.address && !current?.address),
      needs_review_cleared: current?.needs_review === true && proposal.proposed_updates.needs_review === false,
      becomes_historical: becomesHistorical,
      slug_semantically_stale: slugNotes.length > 0,
      slug_warnings: slugNotes,
    },
  };
}

export class SupabaseEnrichmentStateRepository implements EnrichmentStateRepository {
  constructor(private readonly supabase: SupabaseClient<ReadOnlyDatabase>) {}

  async findEventsByIds(ids: string[]) {
    assertConsolidationReadOnly(READ_ONLY_CONSOLIDATION_OPERATIONS);
    const { data, error } = await this.supabase.from("events").select(EVENT_COLUMNS.join(",")).in("id", ids);
    if (error) throw new Error(`No se pudieron consultar los 20 eventos: ${error.message}`);
    return (data || []) as unknown as ResearchEventRow[];
  }
}

export async function auditProposalState(
  repository: EnrichmentStateRepository,
  batch: ResearchBatch,
  proposals: ValidatedProposal[],
  today: string,
) {
  const ids = batch.events.map((event) => event.id);
  const currentRows = await repository.findEventsByIds(ids);
  const currentById = new Map(currentRows.map((event) => [event.id, event]));
  const expectedById = new Map(batch.events.map((event) => [event.id, event as ResearchEventRow]));
  return proposals.map((proposal) => classifyProposal(expectedById.get(proposal.id) as ResearchEventRow, currentById.get(proposal.id) || null, proposal, today));
}

function summarizeManifest(events: ManifestEvent[]) {
  const readiness: Record<Readiness, number> = {
    ready_to_apply: events.filter((event) => event.readiness === "ready_to_apply").length,
    ready_with_warnings: events.filter((event) => event.readiness === "ready_with_warnings").length,
    blocked_by_drift: events.filter((event) => event.readiness === "blocked_by_drift").length,
    blocked_by_invalid_field: events.filter((event) => event.readiness === "blocked_by_invalid_field").length,
    blocked_by_conflict: events.filter((event) => event.readiness === "blocked_by_conflict").length,
  };
  const applicable = events.filter((event) => !event.readiness.startsWith("blocked"));
  const disciplineImpact: Record<string, number> = {};
  for (const event of applicable) {
    if (event.impact_summary.discipline_changed) {
      const before = String(event.current_database_values.discipline || "(sin dato)");
      const after = String(event.proposed_updates.discipline || before);
      disciplineImpact[before] = (disciplineImpact[before] || 0) - 1;
      disciplineImpact[after] = (disciplineImpact[after] || 0) + 1;
    }
    if (event.impact_summary.becomes_historical) {
      const finalDiscipline = String(event.proposed_updates.discipline || event.current_database_values.discipline || "(sin dato)");
      disciplineImpact[finalDiscipline] = (disciplineImpact[finalDiscipline] || 0) - 1;
    }
  }
  return {
    total_events: events.length,
    ...readiness,
    blocked_total: events.filter((event) => event.readiness.startsWith("blocked")).length,
    total_changed_fields: applicable.reduce((sum, event) => sum + event.impact_summary.changed_fields.length, 0),
    titles_changed: applicable.filter((event) => event.impact_summary.title_changed).length,
    dates_changed: applicable.filter((event) => event.impact_summary.dates_changed).length,
    disciplines_changed: applicable.filter((event) => event.impact_summary.discipline_changed).length,
    sources_replaced: applicable.filter((event) => event.impact_summary.source_replaced).length,
    organizers_changed: applicable.filter((event) => event.impact_summary.organizer_changed).length,
    schedules_added: applicable.filter((event) => event.impact_summary.schedule_added).length,
    addresses_added: applicable.filter((event) => event.impact_summary.address_added).length,
    needs_review_true_to_false: applicable.filter((event) => event.impact_summary.needs_review_cleared).length,
    becomes_historical: applicable.filter((event) => event.impact_summary.becomes_historical).length,
    semantic_slugs: applicable.filter((event) => event.impact_summary.slug_semantically_stale).length,
    drifted_events: events.filter((event) => event.drift.length).length,
    discipline_impact: Object.fromEntries(Object.entries(disciplineImpact).filter(([, delta]) => delta !== 0).sort(([left], [right]) => left.localeCompare(right, "es"))),
  };
}

function csvValue(value: unknown) {
  const serialized = typeof value === "object" && value !== null ? JSON.stringify(value) : value === null || value === undefined ? "" : String(value);
  return `"${serialized.replace(/"/g, '""')}"`;
}

function toDryRunCsv(events: ManifestEvent[]) {
  const headers = ["order", "id", "slug", "title", "readiness", "changed_fields", "changed_field_count", "risk", "drift", "conflicts", "warnings", "unresolved_fields", "becomes_historical", "slug_semantically_stale"];
  const rows = events.map((event, index) => {
    const values: Record<string, unknown> = {
      order: index + 1,
      id: event.id,
      slug: event.slug,
      title: event.proposed_updates.title || event.current_database_values.title,
      readiness: event.readiness,
      changed_fields: event.impact_summary.changed_fields,
      changed_field_count: event.impact_summary.changed_fields.length,
      risk: event.impact_summary.risk,
      drift: event.drift,
      conflicts: event.conflicts,
      warnings: event.warnings,
      unresolved_fields: event.unresolved_fields,
      becomes_historical: event.impact_summary.becomes_historical,
      slug_semantically_stale: event.impact_summary.slug_semantically_stale,
    };
    return headers.map((header) => csvValue(values[header])).join(",");
  });
  return `\uFEFF${[headers.map(csvValue).join(","), ...rows].join("\n")}\n`;
}

function markdownList(values: string[]) {
  return values.length ? values.map((value) => `- ${value}`).join("\n") : "- Ninguno.";
}

function toDryRunMarkdown(events: ManifestEvent[], summary: ReturnType<typeof summarizeManifest>, generatedAt: string) {
  const tableRows = events.map((event) => {
    const title = String(event.proposed_updates.title || event.current_database_values.title || event.id).replace(/\|/g, "\\|");
    const observations = [...event.conflicts, ...event.warnings].join(" ").replace(/\|/g, "\\|");
    return `| ${title} | ${event.readiness} | ${event.impact_summary.changed_fields.length} | ${event.impact_summary.risk} | ${observations || "Sin observaciones"} |`;
  }).join("\n");
  const changedTitles = events.filter((event) => event.impact_summary.title_changed).map((event) => `${event.current_database_values.title} → ${event.proposed_updates.title}`);
  const changedDates = events.filter((event) => event.impact_summary.dates_changed).map((event) => `${event.current_database_values.title}: ${event.current_database_values.start_date}/${event.current_database_values.end_date} → ${event.proposed_updates.start_date || event.current_database_values.start_date}/${event.proposed_updates.end_date || event.current_database_values.end_date}`);
  const changedDisciplines = events.filter((event) => event.impact_summary.discipline_changed).map((event) => `${event.current_database_values.title}: ${event.current_database_values.discipline} → ${event.proposed_updates.discipline}`);
  const historical = events.filter((event) => event.impact_summary.becomes_historical).map((event) => String(event.proposed_updates.title || event.current_database_values.title));
  const semanticSlugs = events.filter((event) => event.impact_summary.slug_semantically_stale).map((event) => `${event.slug}: ${event.impact_summary.slug_warnings.join(" ")}`);
  const conflicts = events.filter((event) => event.conflicts.length).map((event) => `${event.id}: ${event.conflicts.join(" ")}`);
  const drift = events.filter((event) => event.drift.length).map((event) => `${event.id}: ${event.drift.map((item) => `${item.field} (${item.resolution})`).join(", ")}`);
  const disciplineImpact = Object.entries(summary.discipline_impact).map(([discipline, delta]) => `${discipline}: ${delta > 0 ? "+" : ""}${delta}`);

  return `# Dry-run de enriquecimiento del Lote 001\n\n` +
    `- Generado: ${generatedAt}\n- Modo: SELECT de 20 IDs y generación local; cero escrituras en Supabase.\n\n` +
    `## Resumen\n\n| Métrica | Total |\n|---|---:|\n` +
    `| Eventos | ${summary.total_events} |\n| Preparados | ${summary.ready_to_apply} |\n| Preparados con advertencias | ${summary.ready_with_warnings} |\n| Bloqueados | ${summary.blocked_total} |\n` +
    `| Campos que cambiarían | ${summary.total_changed_fields} |\n| Títulos modificados | ${summary.titles_changed} |\n| Fechas modificadas | ${summary.dates_changed} |\n| Disciplinas modificadas | ${summary.disciplines_changed} |\n` +
    `| Fuentes reemplazadas | ${summary.sources_replaced} |\n| Organizadores añadidos o corregidos | ${summary.organizers_changed} |\n| Programas añadidos | ${summary.schedules_added} |\n| Direcciones añadidas | ${summary.addresses_added} |\n` +
    `| needs_review true → false | ${summary.needs_review_true_to_false} |\n| Pasarán a históricos | ${summary.becomes_historical} |\n| Slugs semánticamente antiguos | ${summary.semantic_slugs} |\n| Eventos con deriva | ${summary.drifted_events} |\n\n` +
    `## Tabla completa\n\n| Evento | Estado | Campos | Riesgo | Observaciones |\n|---|---|---:|---|---|\n${tableRows}\n\n` +
    `## Títulos corregidos\n\n${markdownList(changedTitles)}\n\n## Fechas corregidas\n\n${markdownList(changedDates)}\n\n` +
    `## Disciplinas corregidas\n\n${markdownList(changedDisciplines)}\n\n## Impacto en disciplinas futuras\n\n${markdownList(disciplineImpact)}\n\n` +
    `## Eventos que pasarán a históricos\n\n${markdownList(historical)}\n\n## Slugs semánticamente antiguos\n\n${markdownList(semanticSlugs)}\n\n` +
    `## Drift detectado\n\n${markdownList(drift)}\n\n## Conflictos y decisiones pendientes\n\n${markdownList(conflicts)}\n`;
}

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function parseJsonFile<T>(filePath: string) {
  const raw = await readFile(filePath, "utf8");
  return { raw, data: JSON.parse(raw) as T, sha256: createHash("sha256").update(raw).digest("hex") };
}

async function main() {
  if (process.argv.slice(2).length) throw new Error("Este comando no admite --apply ni otros argumentos.");
  loadEnvConfig(process.cwd());
  const batchFile = await parseJsonFile<ResearchBatch>(BATCH_FILE);
  const blockFiles = await Promise.all(BLOCK_FILES.map((filePath) => parseJsonFile<ProposalBlock>(filePath)));
  const proposals = consolidateInputs(batchFile.data, blockFiles.map((file) => file.data));
  const criticalErrors = validateCriticalCorrections(proposals);
  if (criticalErrors.length) throw new Error(`Fallaron las correcciones críticas:\n- ${criticalErrors.join("\n- ")}`);

  const supabase = createClient<ReadOnlyDatabase>(getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"), getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const repository = new SupabaseEnrichmentStateRepository(supabase);
  const generatedAt = new Date();
  const today = dateInTimeZone(generatedAt, ENRICHMENT_TIME_ZONE);
  const events = await auditProposalState(repository, batchFile.data, proposals, today);
  const summary = summarizeManifest(events);
  const observedEventStatuses = [...new Set(events.map((event) => event.current_database_values.event_status).filter((value): value is string => typeof value === "string"))].sort();
  const observedSourceTypes = [...new Set(events.map((event) => event.current_database_values.source_type).filter((value): value is string => typeof value === "string"))].sort();
  const metadata = {
    generated_at: generatedAt.toISOString(), version: CONSOLIDATION_VERSION, mode: "dry-run-select-only", timezone: ENRICHMENT_TIME_ZONE, today,
    input_hashes: { [path.basename(BATCH_FILE)]: batchFile.sha256, ...Object.fromEntries(BLOCK_FILES.map((filePath, index) => [path.basename(filePath), blockFiles[index].sha256])) },
    schema: { columns: EVENT_COLUMNS, nullable_columns: EVENT_COLUMNS.filter((field) => !NON_NULLABLE_COLUMNS.has(field)), required_columns: [...NON_NULLABLE_COLUMNS], text_limits: "PostgreSQL text: sin límite explícito en las migraciones inspeccionadas", observed_event_status: observedEventStatuses, observed_source_type: observedSourceTypes },
    safety: { selected_ids: batchFile.data.events.map((event) => event.id), operations: READ_ONLY_CONSOLIDATION_OPERATIONS, supabase_writes: false, slug_updates_allowed: false },
  };
  const consolidated = { metadata, events: proposals };
  const manifest = { metadata, summary, events };
  await Promise.all([
    writeFile(path.join(OUTPUT_DIR, "lote-investigacion-001-consolidated.json"), `${JSON.stringify(consolidated, null, 2)}\n`, "utf8"),
    writeFile(path.join(OUTPUT_DIR, "lote-investigacion-001-patch-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8"),
    writeFile(path.join(OUTPUT_DIR, "lote-investigacion-001-dry-run.csv"), toDryRunCsv(events), "utf8"),
    writeFile(path.join(OUTPUT_DIR, "lote-investigacion-001-dry-run-report.md"), `${toDryRunMarkdown(events, summary, generatedAt.toISOString())}\n`, "utf8"),
  ]);

  console.log("Consolidación read-only del Lote 001 completada.");
  console.log(`- propuestas: ${events.length}`);
  console.log(`- ready_to_apply: ${summary.ready_to_apply}`);
  console.log(`- ready_with_warnings: ${summary.ready_with_warnings}`);
  console.log(`- bloqueados: ${summary.blocked_total}`);
  console.log(`- campos que cambiarían: ${summary.total_changed_fields}`);
  console.log(`- eventos con drift: ${summary.drifted_events}`);
  console.log(`- salida: ${OUTPUT_DIR}`);
  console.log("- Supabase: SELECT limitado a 20 IDs; cero escrituras.");
}

const entryPoint = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (entryPoint === import.meta.url) {
  main().catch((error: unknown) => {
    console.error(`\nConsolidación fallida: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
