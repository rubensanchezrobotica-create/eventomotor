import { createSupabaseServerClient } from "@/lib/supabase";
import { getVehicleType, VEHICLE_TYPE_OPTIONS, type VehicleType } from "@/lib/event-classification";
import {
  EventUpdateConflictError,
  updateExistingEvent,
} from "@/lib/event-updates";
import { createEventSlug } from "@/lib/slug";
import type { EventRow, EventUpsert } from "@/lib/supabase";

type AdminEvent = Pick<
  EventRow,
  | "id"
  | "slug"
  | "title"
  | "championship"
  | "discipline"
  | "start_date"
  | "end_date"
  | "venue"
  | "city"
  | "province"
  | "region"
  | "level"
  | "source"
  | "source_url"
  | "ticket_url"
  | "country"
  | "event_status"
  | "short_description"
  | "long_description"
  | "schedule_text"
  | "address"
  | "latitude"
  | "longitude"
  | "organizer_name"
  | "organizer_url"
  | "official_url"
  | "registration_url"
  | "image_url"
  | "image_source_url"
  | "verified_at"
  | "source_type"
  | "confidence_score"
  | "needs_review"
  | "tags"
  | "vehicle_type"
  | "featured"
  | "visible"
  | "import_method"
  | "data_quality"
  | "notes"
  | "updated_at"
>;

const ADMIN_EVENT_SELECT =
  "id,slug,title,championship,discipline,start_date,end_date,venue,city,province,region,level,source,source_url,ticket_url,country,event_status,short_description,long_description,schedule_text,address,latitude,longitude,organizer_name,organizer_url,official_url,registration_url,image_url,image_source_url,verified_at,source_type,confidence_score,needs_review,tags,vehicle_type,featured,visible,import_method,data_quality,notes,updated_at";

const DATA_QUALITY_OPTIONS = ["needs_review", "draft", "reviewed", "published", "cancelled", "pending_date"];
const EVENT_STATUS_OPTIONS = ["confirmed", "tentative", "postponed", "cancelled"];
const SOURCE_TYPE_OPTIONS = ["official", "organizer", "federation", "circuit", "municipality", "media", "aggregator", "unknown"];

function jsonError(message: string, status: number) {
  return Response.json({ ok: false, error: message }, { status });
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

function createAdminClient() {
  const supabase = createSupabaseServerClient();

  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return supabase;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(body: Record<string, unknown>, field: string) {
  const value = body[field];

  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} is required.`);
  }

  return value.trim();
}

function optionalString(body: Record<string, unknown>, field: string) {
  const value = body[field];

  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function optionalNumber(body: Record<string, unknown>, field: string, label: string, range?: { min: number; max: number }) {
  const value = body[field];

  if (value === null || value === undefined || (typeof value === "string" && !value.trim())) {
    return null;
  }

  const numericValue = typeof value === "number" ? value : typeof value === "string" ? Number(value.trim()) : Number.NaN;

  if (!Number.isFinite(numericValue)) {
    throw new Error(`${label} must be numeric if provided.`);
  }

  if (range && (numericValue < range.min || numericValue > range.max)) {
    throw new Error(`${label} must be between ${range.min} and ${range.max}.`);
  }

  return numericValue;
}

function optionalBoolean(body: Record<string, unknown>, field: string, label: string) {
  const value = body[field];

  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "boolean") {
    throw new Error(`${label} must be a boolean if provided.`);
  }

  return value;
}

function optionalEnum(body: Record<string, unknown>, field: string, label: string, options: string[]) {
  const value = optionalString(body, field);

  if (!value) {
    return null;
  }

  if (!options.includes(value)) {
    throw new Error(`${label} is invalid.`);
  }

  return value;
}

function optionalTimestamp(body: Record<string, unknown>, field: string, label: string) {
  const value = optionalString(body, field);

  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${label} must be a valid date/time if provided.`);
  }

  return date.toISOString();
}

function requireIsoDate(body: Record<string, unknown>, field: string) {
  const value = requireString(body, field);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${field} must use YYYY-MM-DD format.`);
  }

  return value;
}

function parseTags(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .filter((tag): tag is string => typeof tag === "string")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  return [];
}

function parseDataQuality(value: unknown) {
  if (typeof value === "string" && DATA_QUALITY_OPTIONS.includes(value)) {
    return value;
  }

  return "reviewed";
}

function parseVehicleType(value: unknown, fallbackEvent: Parameters<typeof getVehicleType>[0]) {
  if (typeof value === "string" && VEHICLE_TYPE_OPTIONS.includes(value as VehicleType)) {
    return value;
  }

  return getVehicleType(fallbackEvent);
}

function parseAdminEventBody(value: unknown, includeSlug: boolean) {
  if (!isRecord(value)) {
    throw new Error("Request body must be an object.");
  }

  const id = requireString(value, "id");
  const title = requireString(value, "title");
  const discipline = optionalString(value, "discipline") || "";
  const startDate = requireIsoDate(value, "start");
  const endDate = requireIsoDate(value, "end");
  const venue = optionalString(value, "venue") || "";
  const city = optionalString(value, "city") || "";
  const province = optionalString(value, "province") || "";
  const sourceUrl = optionalString(value, "sourceUrl") || "";

  const tags = parseTags(value.tags);
  const vehicle_type = parseVehicleType(value.vehicleType || value.vehicle_type, {
    title,
    championship: optionalString(value, "championship") || title,
    discipline,
    tags,
    source: optionalString(value, "source") || "Admin",
  });

  return {
    id,
    ...(includeSlug ? { slug: optionalString(value, "slug") || createEventSlug(title, startDate) } : {}),
    title,
    championship: optionalString(value, "championship") || title,
    discipline,
    start_date: startDate,
    end_date: endDate,
    venue,
    city,
    province,
    region: optionalString(value, "region") || province,
    level: optionalString(value, "level") || "Publicado",
    source: optionalString(value, "source") || "Admin",
    source_url: sourceUrl,
    ticket_url: optionalString(value, "ticketUrl") || "",
    // Event v2 fields are nullable so older events and imports remain compatible.
    country: optionalString(value, "country"),
    event_status:
      optionalEnum(value, "eventStatus", "event_status", EVENT_STATUS_OPTIONS) ||
      optionalEnum(value, "event_status", "event_status", EVENT_STATUS_OPTIONS),
    short_description: optionalString(value, "shortDescription") || optionalString(value, "short_description"),
    long_description: optionalString(value, "longDescription") || optionalString(value, "long_description"),
    schedule_text: optionalString(value, "scheduleText") || optionalString(value, "schedule_text"),
    address: optionalString(value, "address"),
    latitude: optionalNumber(value, "latitude", "latitude"),
    longitude: optionalNumber(value, "longitude", "longitude"),
    organizer_name: optionalString(value, "organizerName") || optionalString(value, "organizer_name"),
    organizer_url: optionalString(value, "organizerUrl") || optionalString(value, "organizer_url"),
    official_url: optionalString(value, "officialUrl") || optionalString(value, "official_url"),
    registration_url: optionalString(value, "registrationUrl") || optionalString(value, "registration_url"),
    image_url: optionalString(value, "imageUrl") || optionalString(value, "image_url"),
    image_source_url: optionalString(value, "imageSourceUrl") || optionalString(value, "image_source_url"),
    verified_at:
      optionalTimestamp(value, "verifiedAt", "verified_at") ||
      optionalTimestamp(value, "verified_at", "verified_at"),
    source_type:
      optionalEnum(value, "sourceType", "source_type", SOURCE_TYPE_OPTIONS) ||
      optionalEnum(value, "source_type", "source_type", SOURCE_TYPE_OPTIONS),
    confidence_score: optionalNumber(value, "confidenceScore", "confidence_score", { min: 0, max: 100 }),
    needs_review: optionalBoolean(value, "needsReview", "needs_review"),
    tags,
    vehicle_type,
    featured: typeof value.featured === "boolean" ? value.featured : false,
    visible: typeof value.visible === "boolean" ? value.visible : true,
    import_method: optionalString(value, "importMethod"),
    data_quality: parseDataQuality(value.dataQuality),
    notes: optionalString(value, "notes"),
  };
}

async function updateAdminEvent(
  supabase: ReturnType<typeof createAdminClient>,
  id: string,
  changes: Record<string, unknown>,
  expectedUpdatedAt?: string,
) {
  let preservedSlug: string | null | undefined;
  return updateExistingEvent<EventRow>({
    id,
    changes,
    expectedUpdatedAt,
    repository: {
      async readUpdatedAt(eventId) {
        const { data, error } = await supabase
          .from("events")
          .select("slug,updated_at")
          .eq("id", eventId)
          .maybeSingle();
        if (error) throw error;
        preservedSlug = data?.slug;
        return data?.updated_at || null;
      },
      async updateByIdAndUpdatedAt(eventId, expectedUpdatedAt, update) {
        const { data, error } = await supabase
          .from("events")
          .update(update as Partial<EventUpsert>)
          .eq("id", eventId)
          .eq("updated_at", expectedUpdatedAt)
          .select(ADMIN_EVENT_SELECT)
          .maybeSingle();
        if (error) throw error;
        if (data?.slug !== preservedSlug) {
          throw new Error("La verificación posterior detectó un cambio de slug no autorizado.");
        }
        return data as EventRow | null;
      },
    },
  });
}

export async function GET(request: Request) {
  const auth = validateAdminSecret(request);

  if (!auth.ok) {
    return jsonError(auth.error, auth.status);
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("events")
      .select(ADMIN_EVENT_SELECT)
      .order("start_date", { ascending: true });

    if (error) {
      return jsonError(error.message, 500);
    }

    return Response.json({ ok: true, events: (data || []) as AdminEvent[] });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return jsonError(message, 500);
  }
}

export async function POST(request: Request) {
  const auth = validateAdminSecret(request);

  if (!auth.ok) {
    return jsonError(auth.error, auth.status);
  }

  try {
    const payload = parseAdminEventBody(await request.json(), true);
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("events")
      .insert({ ...payload, updated_at: new Date().toISOString() })
      .select(ADMIN_EVENT_SELECT)
      .single();

    if (error) {
      return jsonError(error.message, 500);
    }

    return Response.json({ ok: true, event: data as AdminEvent }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return jsonError(message, 400);
  }
}

export async function PUT(request: Request) {
  const auth = validateAdminSecret(request);

  if (!auth.ok) {
    return jsonError(auth.error, auth.status);
  }

  try {
    const body = await request.json();
    const payload = parseAdminEventBody(body, false);
    const expectedUpdatedAt = optionalTimestamp(body, "expectedUpdatedAt", "expected_updated_at");
    if (!expectedUpdatedAt) {
      return jsonError("expectedUpdatedAt is required when updating an event.", 400);
    }
    const supabase = createAdminClient();
    const { updated } = await updateAdminEvent(supabase, payload.id, payload, expectedUpdatedAt);

    return Response.json({ ok: true, event: updated as AdminEvent });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = error instanceof EventUpdateConflictError ? 409 : 400;

    return jsonError(message, status);
  }
}

export async function PATCH(request: Request) {
  const auth = validateAdminSecret(request);

  if (!auth.ok) {
    return jsonError(auth.error, auth.status);
  }

  try {
    const body = (await request.json()) as {
      id?: unknown;
      featured?: unknown;
      visible?: unknown;
      dataQuality?: unknown;
      vehicleType?: unknown;
      vehicle_type?: unknown;
      notes?: unknown;
      expectedUpdatedAt?: unknown;
    };

    if (typeof body.id !== "string" || !body.id.trim()) {
      return jsonError("Missing event id.", 400);
    }
    if (
      typeof body.expectedUpdatedAt !== "string"
      || !Number.isFinite(Date.parse(body.expectedUpdatedAt))
    ) {
      return jsonError("expectedUpdatedAt is required when updating an event.", 400);
    }

    const update: Partial<Pick<EventRow, "featured" | "visible" | "data_quality" | "vehicle_type" | "notes">> = {};

    if ("featured" in body) {
      if (typeof body.featured !== "boolean") {
        return jsonError("featured must be a boolean.", 400);
      }

      update.featured = body.featured;
    }

    if ("visible" in body) {
      if (typeof body.visible !== "boolean") {
        return jsonError("visible must be a boolean.", 400);
      }

      update.visible = body.visible;
    }

    if ("dataQuality" in body) {
      if (typeof body.dataQuality !== "string" || !DATA_QUALITY_OPTIONS.includes(body.dataQuality)) {
        return jsonError("dataQuality is invalid.", 400);
      }

      update.data_quality = body.dataQuality;
    }

    if ("vehicleType" in body || "vehicle_type" in body) {
      const value = body.vehicleType ?? body.vehicle_type;

      if (typeof value !== "string" || !VEHICLE_TYPE_OPTIONS.includes(value as VehicleType)) {
        return jsonError("vehicleType is invalid.", 400);
      }

      update.vehicle_type = value;
    }

    if ("notes" in body) {
      if (typeof body.notes !== "string") {
        return jsonError("notes must be a string.", 400);
      }

      update.notes = body.notes.trim() || null;
    }

    if (
      !("featured" in update) &&
      !("visible" in update) &&
      !("data_quality" in update) &&
      !("vehicle_type" in update) &&
      !("notes" in update)
    ) {
      return jsonError("No supported fields to update.", 400);
    }

    const supabase = createAdminClient();
    const { updated } = await updateAdminEvent(
      supabase,
      body.id.trim(),
      update,
      body.expectedUpdatedAt,
    );

    return Response.json({ ok: true, event: updated as AdminEvent });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = error instanceof EventUpdateConflictError ? 409 : 500;

    return jsonError(message, status);
  }
}
