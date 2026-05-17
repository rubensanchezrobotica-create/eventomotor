import { legacyRedirect } from "@/lib/legacy-redirects";

// Redirección legacy de etiquetas antiguas de WordPress.
export function GET(request: Request) {
  return legacyRedirect(request, "/calendario");
}

export const HEAD = GET;
