import { createSupabaseServerClient } from "@/lib/supabase";
import type { EventSubmissionRow } from "@/lib/supabase";

const ADMIN_SUBMISSIONS_SELECT =
  "id,event_name,start_date,end_date,city,province,venue,discipline,vehicle_type,source_url,ticket_url,description,organizer_name,contact_email,contact_phone,poster_url,status,created_at,updated_at";

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
      .from("event_submissions")
      .select(ADMIN_SUBMISSIONS_SELECT)
      .order("created_at", { ascending: false });

    if (error) {
      return jsonError(error.message, 500);
    }

    return Response.json({
      ok: true,
      submissions: (data ?? []) as EventSubmissionRow[],
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : String(error), 500);
  }
}
