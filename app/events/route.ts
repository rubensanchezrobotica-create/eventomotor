import { legacyRedirect } from "@/lib/legacy-redirects";

// Redirección legacy de la raíz antigua de eventos.
export function GET(request: Request) {
  return legacyRedirect(request, "/calendario");
}

export const HEAD = GET;
