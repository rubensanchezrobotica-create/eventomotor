import { legacyRedirect } from "@/lib/legacy-redirects";
import { PUBLIC_NAVIGATION } from "@/lib/public-navigation";

// Redirección legacy de la web anterior: /events/* ahora vive en el calendario nuevo.
export function GET(request: Request) {
  return legacyRedirect(request, PUBLIC_NAVIGATION.calendar);
}

export const HEAD = GET;
