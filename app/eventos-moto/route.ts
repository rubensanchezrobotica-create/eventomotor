import { legacyRedirect } from "@/lib/legacy-redirects";
import { PUBLIC_NAVIGATION } from "@/lib/public-navigation";

// Redireccion legacy de la raiz antigua de eventos de moto.
function redirectEventosMotoRoot(request: Request) {
  return legacyRedirect(request, PUBLIC_NAVIGATION.calendar);
}

export const GET = redirectEventosMotoRoot;
export const HEAD = redirectEventosMotoRoot;
