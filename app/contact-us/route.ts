import { legacyRedirect } from "@/lib/legacy-redirects";

// Redirección legacy de contacto en inglés.
export function GET(request: Request) {
  return legacyRedirect(request, "/contacto");
}

export const HEAD = GET;
