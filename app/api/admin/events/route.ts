import { createSupabaseServerClient } from "@/lib/supabase";
import type { EventRow } from "@/lib/supabase";

type AdminEvent = Pick<
  EventRow,
  | "id"
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
  | "tags"
  | "featured"
  | "visible"
  | "import_method"
  | "data_quality"
  | "notes"
>;

const ADMIN_EVENT_SELECT =
  "id,title,championship,discipline,start_date,end_date,venue,city,province,region,level,source,source_url,ticket_url,tags,featured,visible,import_method,data_quality,notes";

const DATA_QUALITY_OPTIONS = ["draft", "reviewed", "published", "cancelled", "pending_date"];

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

function parseAdminEventBody(value: unknown) {
  if (!isRecord(value)) {
    throw new Error("Request body must be an object.");
  }

  const id = requireString(value, "id");
  const title = requireString(value, "title");
  const discipline = requireString(value, "discipline");
  const startDate = requireIsoDate(value, "start");
  const endDate = requireIsoDate(value, "end");
  const venue = requireString(value, "venue");
  const city = requireString(value, "city");
  const province = requireString(value, "province");
  const sourceUrl = requireString(value, "sourceUrl");

  return {
    id,
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
    tags: parseTags(value.tags),
    featured: typeof value.featured === "boolean" ? value.featured : false,
    visible: typeof value.visible === "boolean" ? value.visible : true,
    import_method: optionalString(value, "importMethod"),
    data_quality: parseDataQuality(value.dataQuality),
    notes: optionalString(value, "notes"),
    updated_at: new Date().toISOString(),
  };
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
    const payload = parseAdminEventBody(await request.json());
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("events")
      .insert(payload)
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
    const payload = parseAdminEventBody(await request.json());
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("events")
      .update(payload)
      .eq("id", payload.id)
      .select(ADMIN_EVENT_SELECT)
      .single();

    if (error) {
      return jsonError(error.message, 500);
    }

    return Response.json({ ok: true, event: data as AdminEvent });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return jsonError(message, 400);
  }
}

export async function PATCH(request: Request) {
  const auth = validateAdminSecret(request);

  if (!auth.ok) {
    return jsonError(auth.error, auth.status);
  }

  try {
    const body = (await request.json()) as { id?: unknown; featured?: unknown };

    if (typeof body.id !== "string" || !body.id.trim()) {
      return jsonError("Missing event id.", 400);
    }

    if (typeof body.featured !== "boolean") {
      return jsonError("Missing featured boolean.", 400);
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("events")
      .update({ featured: body.featured, updated_at: new Date().toISOString() })
      .eq("id", body.id)
      .select(ADMIN_EVENT_SELECT)
      .single();

    if (error) {
      return jsonError(error.message, 500);
    }

    return Response.json({ ok: true, event: data as AdminEvent });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return jsonError(message, 500);
  }
}
