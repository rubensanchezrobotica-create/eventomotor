import { legacyRedirect } from "@/lib/legacy-redirects";

// Redirección legacy de about de la web anterior.
export function GET(request: Request) {
  return legacyRedirect(request, "/");
}

export const HEAD = GET;
