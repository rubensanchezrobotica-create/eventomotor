import { legacyRedirect } from "@/lib/legacy-redirects";

// Redireccion legacy de la raiz antigua de eventos de moto.
function redirectEventosMotoRoot(request: Request) {
  return legacyRedirect(request, "/calendario");
}

export const GET = redirectEventosMotoRoot;
export const HEAD = redirectEventosMotoRoot;
