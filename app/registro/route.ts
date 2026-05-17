import { legacyRedirect } from "@/lib/legacy-redirects";

// Redirección legacy de registro hacia publicación de eventos.
export function GET(request: Request) {
  return legacyRedirect(request, "/publicar-evento");
}

export const HEAD = GET;
