export const SITE_URL = "https://www.eventomotor.com";
export const SITE_NAME = "EventoMotor";
export const CONTACT_EMAIL = "info@eventomotor.com";
export const DEFAULT_DESCRIPTION =
  "Calendario nacional de eventos de motor en España: rallyes, motos, coches, concentraciones, circuitos, rutas, clásicos, karting y ferias.";
export const HOME_DESCRIPTION =
  "Encuentra eventos de motor en España por fecha, zona, disciplina y tipo: rallyes, motos, coches, concentraciones, circuitos, rutas, clásicos, karting y ferias.";
export const DEFAULT_OG_IMAGE = "/brand/eventomotor-app-icon-1024.png";
export const LOGO_URL = "/brand/eventomotor-logo-horizontal-dark-header.png";

export function absoluteUrl(path: string) {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
