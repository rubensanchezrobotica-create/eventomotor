import { legacyRedirect } from "@/lib/legacy-redirects";

// Redirección legacy de la web anterior: /events/* ahora vive en el calendario nuevo.
export function GET(request: Request) {
  return legacyRedirect(request, "/calendario");
}

export const HEAD = GET;
