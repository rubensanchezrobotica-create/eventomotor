import { legacyRedirect } from "@/lib/legacy-redirects";

// Redireccion legacy de la raiz antigua de ubicaciones de la web anterior.
export function GET(request: Request) {
  return legacyRedirect(request, "/calendario");
}

export const HEAD = GET;
