import { legacyRedirect } from "@/lib/legacy-redirects";

// Redireccion legacy de la raiz antigua de organizadores de la web anterior.
export function GET(request: Request) {
  return legacyRedirect(request, "/publicar-evento");
}

export const HEAD = GET;
