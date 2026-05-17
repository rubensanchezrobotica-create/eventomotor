import { legacyRedirect, legacySlug, legacyTypeDestination } from "@/lib/legacy-redirects";

// Redirección legacy de tipos/zonas de la web anterior.
export function GET(request: Request) {
  return legacyRedirect(request, legacyTypeDestination(legacySlug(request)));
}

export const HEAD = GET;
