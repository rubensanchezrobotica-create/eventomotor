import { analyzeEventCandidate } from "@/lib/event-candidates/analyzer";

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

export async function POST(request: Request, context: RouteContext) {
  const auth = validateAdminSecret(request);

  if (!auth.ok) {
    return jsonError(auth.error, auth.status);
  }

  try {
    const { id } = await context.params;

    if (!id) {
      return jsonError("Missing candidate id.", 400);
    }

    const result = await analyzeEventCandidate(id);

    return Response.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return jsonError(message, message === "Candidate not found." ? 404 : 500);
  }
}
