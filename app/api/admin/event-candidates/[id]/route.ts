import {
  isEventCandidateStatus,
  updateEventCandidateStatus,
} from "@/lib/event-candidates/repository";
import type { EventCandidateStatus } from "@/lib/event-candidates/types";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = validateAdminSecret(request);

  if (!auth.ok) {
    return jsonError(auth.error, auth.status);
  }

  try {
    const { id } = await context.params;
    const body = await request.json();

    if (!id) {
      return jsonError("Missing candidate id.", 400);
    }

    if (!isRecord(body)) {
      return jsonError("Request body must be an object.", 400);
    }

    const statusValue = typeof body.status === "string" ? body.status.trim() : "";

    if (!statusValue || !isEventCandidateStatus(statusValue)) {
      return jsonError("Invalid status.", 400);
    }

    const reviewNotes = typeof body.review_notes === "string" ? body.review_notes : null;
    const candidate = await updateEventCandidateStatus(id, statusValue as EventCandidateStatus, reviewNotes);

    return Response.json({ ok: true, candidate });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : String(error), 500);
  }
}
