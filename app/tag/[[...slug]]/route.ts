import { legacyRedirect } from "@/lib/legacy-redirects";
import { PUBLIC_NAVIGATION } from "@/lib/public-navigation";

// Redirección legacy de etiquetas antiguas de WordPress.
export function GET(request: Request) {
  return legacyRedirect(request, PUBLIC_NAVIGATION.calendar);
}

export const HEAD = GET;
