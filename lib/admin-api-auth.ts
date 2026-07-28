export type AdminAuthResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

export function validateAdminRequest(request: Request): AdminAuthResult {
  const adminSecret = process.env.ADMIN_SECRET;

  if (!adminSecret) {
    return {
      ok: false,
      status: 500,
      error: "La administración no está configurada.",
    };
  }

  if (request.headers.get("authorization") !== `Bearer ${adminSecret}`) {
    return {
      ok: false,
      status: 401,
      error: "No autorizado.",
    };
  }

  const origin = request.headers.get("origin");
  if (origin && new URL(origin).origin !== new URL(request.url).origin) {
    return {
      ok: false,
      status: 403,
      error: "Origen de solicitud no permitido.",
    };
  }

  return { ok: true };
}
