import { NextResponse } from "next/server";

const LEGACY_LOCATION_REDIRECTS: Record<string, string> = {
  osuna: "/zonas/sur",
  "pais-vasco": "/zonas/norte",
  valencia: "/eventos-motor-valencia",
};

const LEGACY_TYPE_REDIRECTS: Record<string, string> = {
  circuito: "/disciplinas/circuito",
  clasicos: "/disciplinas/clasicos",
  "clasicos-coches": "/disciplinas/clasicos",
  enduro: "/disciplinas/offroad",
  ferias: "/disciplinas/ferias",
  "hard-enduro": "/disciplinas/offroad",
  karting: "/disciplinas/karting",
  motocross: "/disciplinas/offroad",
  motogp: "/disciplinas/circuito",
  mototurismo: "/disciplinas/rutas",
  "pais-vasco": "/zonas/norte",
  rally: "/disciplinas/rallyes",
  rallyes: "/disciplinas/rallyes",
  superbike: "/disciplinas/circuito",
  trial: "/disciplinas/offroad",
  "vehiculos-historicos": "/disciplinas/clasicos",
  velocidad: "/disciplinas/circuito",
};

const LEGACY_MOTO_REDIRECTS: Record<string, string> = {
  catalunya: "/eventos-motor-cataluna",
  concentracion: "/disciplinas/concentraciones",
  concentraciones: "/concentraciones-moteras-2026",
  cordoba: "/eventos-motor-andalucia",
  "ciudad-real": "/zonas/centro",
  "eco-rally": "/rallyes-espana-2026",
  guadalajara: "/zonas/centro",
  huelva: "/eventos-motor-andalucia",
  huesca: "/calendario",
  malaga: "/eventos-motor-andalucia",
  ourense: "/calendario",
  pontevedra: "/calendario",
  "rally-historico": "/rallyes-espana-2026",
  "rally-tierra": "/rallyes-espana-2026",
  rallycross: "/rallyes-espana-2026",
  rallysprint: "/rallysprint-espana-2026",
  sevilla: "/eventos-motor-andalucia",
  soria: "/zonas/centro",
  tarragona: "/eventos-motor-cataluna",
  zaragoza: "/calendario",
};

export function legacySlug(request: Request) {
  const pathname = new URL(request.url).pathname.replace(/\/+$/g, "");
  return decodeURIComponent(pathname.split("/").filter(Boolean)[1] || "").toLowerCase();
}

export function legacyRedirect(request: Request, destination: string) {
  return NextResponse.redirect(new URL(destination, request.url), 301);
}

export function legacyLocationDestination(slug: string) {
  return LEGACY_LOCATION_REDIRECTS[slug] || "/calendario";
}

export function legacyTypeDestination(slug: string) {
  return LEGACY_TYPE_REDIRECTS[slug] || "/calendario";
}

export function legacyMotoDestination(slug: string) {
  return LEGACY_MOTO_REDIRECTS[slug] || "/calendario";
}
