export const PUBLIC_NAVIGATION = {
  home: "/",
  calendar: "/",
  disciplines: "/disciplinas",
  zones: "/zonas",
  contact: "/contacto",
  savedEvents: "/mis-eventos",
  publish: "/publicar-evento",
} as const;

export type PublicNavigationSection =
  | "calendar"
  | "disciplines"
  | "zones"
  | "contact"
  | "savedEvents"
  | "publish";

export const PUBLIC_NAVIGATION_ITEMS = [
  { id: "calendar", label: "Calendario", href: PUBLIC_NAVIGATION.calendar },
  { id: "disciplines", label: "Disciplinas", href: PUBLIC_NAVIGATION.disciplines },
  { id: "zones", label: "Zonas", href: PUBLIC_NAVIGATION.zones },
  { id: "contact", label: "Contacto", href: PUBLIC_NAVIGATION.contact },
  { id: "savedEvents", label: "Mis eventos", href: PUBLIC_NAVIGATION.savedEvents },
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

  if (pathname === PUBLIC_NAVIGATION.contact) return "contact";
  if (pathname === PUBLIC_NAVIGATION.savedEvents) return "savedEvents";
  if (pathname === PUBLIC_NAVIGATION.publish) return "publish";
  if (pathname === PUBLIC_NAVIGATION.disciplines || pathname.startsWith(`${PUBLIC_NAVIGATION.disciplines}/`)) {
    return "disciplines";
  }
  if (
    pathname === PUBLIC_NAVIGATION.zones
    || pathname.startsWith(`${PUBLIC_NAVIGATION.zones}/`)
    || (pathname.startsWith("/eventos-motor-") && pathname !== "/eventos-motor-este-fin-de-semana")
  ) {
    return "zones";
  }
  if (
    pathname === PUBLIC_NAVIGATION.home
    || pathname === "/calendario"
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
  if (href === "/calendario") return PUBLIC_NAVIGATION.calendar;
  if (href.startsWith("/calendario?")) return `${PUBLIC_NAVIGATION.calendar}${href.slice("/calendario".length)}`;
  if (href.startsWith("/calendario#")) return `${PUBLIC_NAVIGATION.calendar}${href.slice("/calendario".length)}`;
  return href;
}
