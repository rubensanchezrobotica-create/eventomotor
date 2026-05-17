import { legacyRedirect } from "@/lib/legacy-redirects";

// Redirección legacy de organizadores de la web anterior.
export function GET(request: Request) {
  return legacyRedirect(request, "/publicar-evento");
}

export const HEAD = GET;
