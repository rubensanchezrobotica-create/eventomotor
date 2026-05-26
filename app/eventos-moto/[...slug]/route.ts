import { legacyMotoDestination, legacyRedirect, legacySlug } from "@/lib/legacy-redirects";

// Redireccion legacy de listados antiguos /eventos-moto/* hacia URLs actuales.
function redirectEventosMotoLegacy(request: Request) {
  return legacyRedirect(request, legacyMotoDestination(legacySlug(request)));
}

export const GET = redirectEventosMotoLegacy;
export const HEAD = redirectEventosMotoLegacy;
