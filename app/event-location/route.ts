import { legacyRedirect } from "@/lib/legacy-redirects";
import { PUBLIC_NAVIGATION } from "@/lib/public-navigation";

// Redireccion legacy de la raiz antigua de ubicaciones de la web anterior.
export function GET(request: Request) {
  return legacyRedirect(request, PUBLIC_NAVIGATION.calendar);
}

export const HEAD = GET;
