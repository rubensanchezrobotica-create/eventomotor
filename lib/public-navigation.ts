export const PUBLIC_ROUTES = {
  home: "/",
  contact: "/contacto",
  savedEvents: "/mis-eventos",
  publish: "/publicar-evento",
} as const;

export const HOME_SECTION_IDS = {
  calendar: "calendario",
  disciplines: "disciplinas",
  zones: "zonas",
} as const;

export const HOME_SECTION_LINKS = {
  calendar: `/#${HOME_SECTION_IDS.calendar}`,
  disciplines: `/#${HOME_SECTION_IDS.disciplines}`,
  zones: `/#${HOME_SECTION_IDS.zones}`,
} as const;

export const DIRECTORY_ROUTES = {
  disciplines: "/disciplinas",
  zones: "/zonas",
} as const;

export const PUBLIC_NAVIGATION = {
  ...PUBLIC_ROUTES,
  calendar: HOME_SECTION_LINKS.calendar,
  disciplines: DIRECTORY_ROUTES.disciplines,
  zones: DIRECTORY_ROUTES.zones,
} as const;

export type PublicNavigationSection =
  | "calendar"
  | "disciplines"
  | "zones"
  | "contact"
  | "savedEvents"
  | "publish";

export const PRIMARY_NAVIGATION_ITEMS = [
  { id: "calendar", label: "Calendario", href: HOME_SECTION_LINKS.calendar },
  { id: "disciplines", label: "Disciplinas", href: HOME_SECTION_LINKS.disciplines },
  { id: "zones", label: "Zonas", href: HOME_SECTION_LINKS.zones },
  { id: "contact", label: "Contacto", href: PUBLIC_ROUTES.contact },
  { id: "savedEvents", label: "Mis eventos", href: PUBLIC_ROUTES.savedEvents },
] as const satisfies ReadonlyArray<{
  id: PublicNavigationSection;
  label: string;
  href: string;
}>;

const DISCIPLINE_OPPORTUNITY_PREFIXES = [
  "/concentraciones-moteras",
  "/motoalmuerzos",
  "/rallyes-",
  "/rallysprint-",
  "/rodadas-",
  "/trackdays-",
  "/karting-",
  "/ferias-",
] as const;

export function getPublicNavigationSection(pathname: string | null | undefined): PublicNavigationSection | null {
  if (!pathname) return null;

  if (pathname === PUBLIC_ROUTES.contact) return "contact";
  if (pathname === PUBLIC_ROUTES.savedEvents) return "savedEvents";
  if (pathname === PUBLIC_ROUTES.publish) return "publish";
  if (pathname === DIRECTORY_ROUTES.disciplines || pathname.startsWith(`${DIRECTORY_ROUTES.disciplines}/`)) {
    return "disciplines";
  }
  if (
    pathname === DIRECTORY_ROUTES.zones
    || pathname.startsWith(`${DIRECTORY_ROUTES.zones}/`)
    || (pathname.startsWith("/eventos-motor-") && pathname !== "/eventos-motor-este-fin-de-semana")
  ) {
    return "zones";
  }
  if (
    pathname === "/calendario"
    || pathname.startsWith("/evento/")
    || pathname === "/eventos-motor-este-fin-de-semana"
  ) {
    return "calendar";
  }
  if (DISCIPLINE_OPPORTUNITY_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return "disciplines";
  }
  return null;
}

export function canonicalPublicHref(href: string) {
  if (href === "/calendario" || href.startsWith("/calendario#")) return HOME_SECTION_LINKS.calendar;
  if (href.startsWith("/calendario?")) {
    return `/${href.slice("/calendario".length)}#${HOME_SECTION_IDS.calendar}`;
  }
  return href;
}
