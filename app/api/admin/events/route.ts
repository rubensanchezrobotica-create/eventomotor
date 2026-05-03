import { createSupabaseServerClient } from "@/lib/supabase";
import type { EventRow } from "@/lib/supabase";

type AdminEvent = Pick<
  EventRow,
  "id" | "title" | "discipline" | "start_date" | "venue" | "city" | "province" | "source" | "featured"
>;

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

export async function GET(request: Request) {
  const auth = validateAdminSecret(request);

  if (!auth.ok) {
    return jsonError(auth.error, auth.status);
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("events")
      .select("id,title,discipline,start_date,venue,city,province,source,featured")
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
      .select("id,title,discipline,start_date,venue,city,province,source,featured")
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
