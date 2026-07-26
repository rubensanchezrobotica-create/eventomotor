import { createSupabaseServerClient } from "@/lib/supabase";
import { validateEditableEventDraft } from "@/lib/admin-event-draft";
import {
  publicationDraftToEvent,
  textValue,
  type PublicationDraft,
} from "@/lib/published-request-event";
import type { EventRow, EventUpsert } from "@/lib/supabase";

type DraftInput = PublicationDraft;

type PublishPayload = {
  draft?: DraftInput;
  confirmWarnings?: unknown;
  confirmPossibleDuplicates?: unknown;
};

type PossibleDuplicate = {
  id: string;
  slug: string | null;
  title: string;
  startDate: string;
  endDate: string | null;
  city: string | null;
  province: string | null;
  reason: string;
};

const EVENT_SELECT = "id,slug,title,start_date,end_date,city,province,visible";
const CREATED_EVENT_SELECT =
  "id,slug,title,championship,discipline,start_date,end_date,venue,city,province,region,country,level,source,source_url,ticket_url,official_url,registration_url,image_url,image_source_url,event_status,long_description,organizer_name,organizer_url,source_type,tags,vehicle_type,featured,visible,import_method,data_quality,notes";
const SUBMISSION_IMPORTED_STATUS = "imported";

function jsonError(message: string, status: number, extra?: Record<string, unknown>) {
  return Response.json({ ok: false, error: message, ...(extra || {}) }, { status });
}

function validateAdminSecret(request: Request) {
  const adminSecret = process.env.ADMIN_SECRET;

  if (!adminSecret) {
    return {
      ok: false as const,
      status: 500,
      error: "ADMIN_SECRET is not configured. Add ADMIN_SECRET to your environment.",
    };
  }

  if (request.headers.get("authorization") !== `Bearer ${adminSecret}`) {
    return {
      ok: false as const,
      status: 401,
      error: "Unauthorized. Send Authorization: Bearer ADMIN_SECRET.",
    };
  }

  return { ok: true as const };
}

function parseDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeText(value: string | null | undefined) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function titleSimilarity(left: string, right: string) {
  const leftWords = new Set(normalizeText(left).split(/\s+/).filter((word) => word.length > 2));
  const rightWords = new Set(normalizeText(right).split(/\s+/).filter((word) => word.length > 2));

  if (!leftWords.size || !rightWords.size) return 0;

  const common = [...leftWords].filter((word) => rightWords.has(word)).length;
  return common / Math.max(leftWords.size, rightWords.size);
}

function daysBetween(left: string, right: string) {
  const leftDate = parseDate(left);
  const rightDate = parseDate(right);

  if (!leftDate || !rightDate) return Number.POSITIVE_INFINITY;

  return Math.abs(leftDate.getTime() - rightDate.getTime()) / 86_400_000;
}

function findPossibleDuplicates(draft: DraftInput, rows: Pick<EventRow, "id" | "slug" | "title" | "start_date" | "end_date" | "city" | "province">[]) {
  const title = textValue(draft.title);
  const startDate = textValue(draft.startDate);
  const city = normalizeText(textValue(draft.city));
  const province = normalizeText(textValue(draft.province));
  const duplicates: PossibleDuplicate[] = [];

  for (const row of rows) {
    const reasons: string[] = [];
    const similarTitle = titleSimilarity(title, row.title) >= 0.72;
    const samePlace = city && province && normalizeText(row.city) === city && normalizeText(row.province) === province;
    const closeDate = startDate ? daysBetween(startDate, row.start_date) <= 3 : false;

    if (similarTitle && samePlace && closeDate) {
      reasons.push("título parecido, misma zona y fecha cercana");
    } else if (similarTitle && closeDate) {
      reasons.push("título parecido y fecha cercana");
    } else if (samePlace && closeDate) {
      reasons.push("misma ciudad/provincia y fecha cercana");
    }

    if (reasons.length) {
      duplicates.push({
        id: row.id,
        slug: row.slug,
        title: row.title,
        startDate: row.start_date,
        endDate: row.end_date,
        city: row.city,
        province: row.province,
        reason: reasons.join("; "),
      });
    }
  }

  return duplicates.slice(0, 8);
}

function draftToEventUpsert(draft: DraftInput): EventUpsert {
  return publicationDraftToEvent(draft);
}

export async function POST(request: Request) {
  const auth = validateAdminSecret(request);

  if (!auth.ok) {
    return jsonError(auth.error, auth.status);
  }

  try {
    const payload = (await request.json()) as PublishPayload;
    const inputDraft = payload.draft;

    if (!inputDraft || typeof inputDraft !== "object") {
      return jsonError("Falta el borrador de evento.", 400);
    }

    const validation = validateEditableEventDraft(inputDraft);
    const { draft, errors, warnings } = validation;

    if (errors.length) {
      return jsonError("El borrador tiene errores críticos y no se puede publicar.", 400, {
        errors,
        warnings,
        fieldErrors: validation.fieldErrors,
      });
    }

    const supabase = createSupabaseServerClient();

    if (!supabase) {
      return jsonError("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.", 500);
    }

    const slug = textValue(draft.slug);
    const { data: exactSlug, error: exactSlugError } = await supabase
      .from("events")
      .select(EVENT_SELECT)
      .eq("slug", slug)
      .maybeSingle();

    if (exactSlugError) {
      return jsonError(exactSlugError.message, 500);
    }

    if (exactSlug) {
      return jsonError("Ya existe un evento con este slug.", 409, {
        errors: ["Ya existe un evento con este slug."],
        warnings,
        exactDuplicate: exactSlug,
      });
    }

    const { data: existingRows, error: existingError } = await supabase.from("events").select(EVENT_SELECT).eq("visible", true);

    if (existingError) {
      return jsonError(existingError.message, 500);
    }

    const possibleDuplicates = findPossibleDuplicates(draft, (existingRows ?? []) as EventRow[]);

    if (possibleDuplicates.length && payload.confirmPossibleDuplicates !== true) {
      return jsonError("Se han detectado posibles duplicados. Revisa la lista antes de publicar.", 409, {
        warnings,
        possibleDuplicates,
      });
    }

    if (warnings.length && payload.confirmWarnings !== true) {
      return jsonError("Este borrador tiene avisos pendientes. Confirma manualmente si quieres publicarlo igualmente.", 409, {
        warnings,
        possibleDuplicates,
      });
    }

    const eventPayload = draftToEventUpsert(draft);
    const { data: createdEvent, error: insertError } = await supabase
      .from("events")
      .insert(eventPayload)
      .select(CREATED_EVENT_SELECT)
      .single();

    if (insertError) {
      return jsonError(insertError.message, 500);
    }

    const sourceSubmissionId = textValue(draft.sourceSubmissionId);
    let submissionStatusUpdate:
      | { ok: true; status: typeof SUBMISSION_IMPORTED_STATUS }
      | { ok: false; status: typeof SUBMISSION_IMPORTED_STATUS; error: string }
      | null = null;

    if (sourceSubmissionId) {
      const { error: statusUpdateError } = await supabase
        .from("event_submissions")
        .update({ status: SUBMISSION_IMPORTED_STATUS })
        .eq("id", sourceSubmissionId);

      if (statusUpdateError) {
        const message = `Evento creado, pero no se pudo marcar la solicitud como ${SUBMISSION_IMPORTED_STATUS}: ${statusUpdateError.message}`;
        warnings.push(message);
        submissionStatusUpdate = {
          ok: false,
          status: SUBMISSION_IMPORTED_STATUS,
          error: statusUpdateError.message,
        };
      } else {
        submissionStatusUpdate = {
          ok: true,
          status: SUBMISSION_IMPORTED_STATUS,
        };
      }
    }

    return Response.json(
      {
        ok: true,
        event: createdEvent,
        eventUrl: `/evento/${createdEvent.slug}`,
        warnings,
        possibleDuplicates,
        submissionStatusUpdate,
      },
      { status: 201 },
    );
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : String(error), 500);
  }
}
