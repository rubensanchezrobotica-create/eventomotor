import { legacyRedirect } from "@/lib/legacy-redirects";

// Redirección legacy de privacidad de la web anterior.
export function GET(request: Request) {
  return legacyRedirect(request, "/privacidad");
}

export const HEAD = GET;
