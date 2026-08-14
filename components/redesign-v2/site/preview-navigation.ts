export type PreviewNavigationId =
  | "home"
  | "weekend"
  | "calendar"
  | "disciplines"
  | "territories"
  | "newsletter"
  | "favorites"
  | "publish"
  | "contact"
  | "privacy"
  | "legal"
  | "cookies";

type PreviewNavigationDefinition = {
  id: PreviewNavigationId;
  label: string;
  productionHref: string;
  previewHref?: string;
};

export type ResolvedPreviewNavigationItem = {
  id: PreviewNavigationId;
  label: string;
  href: string;
  previewFallback?: "production";
};

export const PREVIEW_NAVIGATION: Readonly<Record<PreviewNavigationId, PreviewNavigationDefinition>> = {
  home: { id: "home", label: "Inicio", productionHref: "/", previewHref: "/preview/redesign-v2" },
  weekend: { id: "weekend", label: "Este fin de semana", productionHref: "/eventos-motor-este-fin-de-semana" },
  calendar: { id: "calendar", label: "Calendario", productionHref: "/calendario", previewHref: "/preview/redesign-v2/calendario" },
  disciplines: { id: "disciplines", label: "Disciplinas", productionHref: "/disciplinas" },
  territories: { id: "territories", label: "Territorios", productionHref: "/zonas" },
  newsletter: { id: "newsletter", label: "Newsletter", productionHref: "/newsletter" },
  favorites: { id: "favorites", label: "Mis eventos", productionHref: "/mis-eventos" },
  publish: { id: "publish", label: "Publicar evento", productionHref: "/publicar-evento" },
  contact: { id: "contact", label: "Contacto", productionHref: "/contacto" },
  privacy: { id: "privacy", label: "Privacidad", productionHref: "/privacidad" },
  legal: { id: "legal", label: "Aviso legal", productionHref: "/aviso-legal" },
  cookies: { id: "cookies", label: "Cookies", productionHref: "/cookies" },
};

export function resolvePreviewNavigationItem(id: PreviewNavigationId): ResolvedPreviewNavigationItem {
  const item = PREVIEW_NAVIGATION[id];
  return item.previewHref
    ? { id, label: item.label, href: item.previewHref }
    : { id, label: item.label, href: item.productionHref, previewFallback: "production" };
}

export function resolvePreviewNavigationItems(
  ids: readonly PreviewNavigationId[],
): ResolvedPreviewNavigationItem[] {
  return ids.map(resolvePreviewNavigationItem);
}
