import { legacyRedirect } from "@/lib/legacy-redirects";

// Redirección legacy de política de cookies de la web anterior.
export function GET(request: Request) {
  return legacyRedirect(request, "/cookies");
}

export const HEAD = GET;
