import { legacyLocationDestination, legacyRedirect, legacySlug } from "@/lib/legacy-redirects";

// Redirección legacy de ubicaciones de la web anterior.
export function GET(request: Request) {
  return legacyRedirect(request, legacyLocationDestination(legacySlug(request)));
}

export const HEAD = GET;
