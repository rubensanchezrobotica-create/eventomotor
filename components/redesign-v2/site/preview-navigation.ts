import { canonicalPublicHref } from "@/lib/public-navigation";

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
  variant?: "primary";
};

export type ResolvedPreviewNavigationItem = {
  id: PreviewNavigationId;
  label: string;
  href: string;
  previewFallback?: "production";
  variant: "default" | "primary";
};

export type InteriorNavigationMode = "preview" | "public";
export type InteriorNavigationSurface = "desktop" | "mobile";

export type NewsletterSurface = {
  visible: boolean;
  canSubmitLive: boolean;
  linkMode: InteriorNavigationMode;
};

export function resolveNewsletterSurface({
  navigationMode,
  publicLaunchAllowed,
  nodeEnv,
  vercelEnv,
}: {
  navigationMode: InteriorNavigationMode;
  publicLaunchAllowed: boolean;
  nodeEnv?: string;
  vercelEnv?: string;
}): NewsletterSurface {
  const canSubmitLive = navigationMode === "public" && publicLaunchAllowed &&
    nodeEnv === "production" && vercelEnv === "production";
  if (canSubmitLive) return { visible: true, canSubmitLive: true, linkMode: "public" };

  const qaVisible = vercelEnv === "preview" ||
    (nodeEnv === "development" && (vercelEnv === undefined || vercelEnv === "development"));
  if (qaVisible || (navigationMode === "preview" && vercelEnv !== "production")) {
    return { visible: true, canSubmitLive: false, linkMode: "preview" };
  }
  return { visible: false, canSubmitLive: false, linkMode: "public" };
}

const GLOBAL_DESKTOP_NAVIGATION_IDS = ["calendar", "weekend", "disciplines", "territories", "favorites"] as const;
const GLOBAL_MOBILE_NAVIGATION_IDS = [...GLOBAL_DESKTOP_NAVIGATION_IDS, "publish", "contact"] as const;

const INTERIOR_NAVIGATION_IDS = {
  preview: {
    desktop: GLOBAL_DESKTOP_NAVIGATION_IDS,
    mobile: GLOBAL_MOBILE_NAVIGATION_IDS,
  },
  public: {
    desktop: GLOBAL_DESKTOP_NAVIGATION_IDS,
    mobile: GLOBAL_MOBILE_NAVIGATION_IDS,
  },
} as const satisfies Record<
  InteriorNavigationMode,
  Record<InteriorNavigationSurface, readonly PreviewNavigationId[]>
>;

export const PREVIEW_NAVIGATION: Readonly<Record<PreviewNavigationId, PreviewNavigationDefinition>> = {
  home: { id: "home", label: "Inicio", productionHref: "/", previewHref: "/preview/redesign-v2" },
  weekend: { id: "weekend", label: "Fin de semana", productionHref: "/eventos-motor-este-fin-de-semana" },
  calendar: { id: "calendar", label: "Calendario", productionHref: "/calendario", previewHref: "/preview/redesign-v2/calendario" },
  disciplines: { id: "disciplines", label: "Disciplinas", productionHref: "/disciplinas" },
  territories: { id: "territories", label: "Zonas", productionHref: "/zonas", previewHref: "/preview/redesign-v2/zonas" },
  newsletter: { id: "newsletter", label: "La Agenda Motor", productionHref: "/newsletter", previewHref: "/preview/redesign-v2/newsletter" },
  favorites: { id: "favorites", label: "Mis eventos", productionHref: "/mis-eventos" },
  publish: { id: "publish", label: "Publicar evento", productionHref: "/publicar-evento", variant: "primary" },
  contact: { id: "contact", label: "Contacto", productionHref: "/contacto" },
  privacy: { id: "privacy", label: "Privacidad", productionHref: "/privacidad" },
  legal: { id: "legal", label: "Aviso legal", productionHref: "/aviso-legal" },
  cookies: { id: "cookies", label: "Cookies", productionHref: "/cookies" },
};

export function resolvePreviewNavigationItem(id: PreviewNavigationId): ResolvedPreviewNavigationItem {
  const item = PREVIEW_NAVIGATION[id];
  return item.previewHref
    ? { id, label: item.label, href: item.previewHref, variant: item.variant ?? "default" }
    : { id, label: item.label, href: item.productionHref, previewFallback: "production", variant: item.variant ?? "default" };
}

export function resolveInteriorNavigationItem(
  id: PreviewNavigationId,
  mode: InteriorNavigationMode,
): ResolvedPreviewNavigationItem {
  if (mode === "preview") return resolvePreviewNavigationItem(id);
  const item = PREVIEW_NAVIGATION[id];
  return {
    id,
    label: item.label,
    href: canonicalPublicHref(item.productionHref),
    variant: item.variant ?? "default",
  };
}

export function resolveInteriorNavigationItems(
  ids: readonly PreviewNavigationId[],
  mode: InteriorNavigationMode,
  newsletterMode: InteriorNavigationMode = mode,
): ResolvedPreviewNavigationItem[] {
  return ids.map((id) => resolveInteriorNavigationItem(id, id === "newsletter" ? newsletterMode : mode));
}

export function getInteriorNavigationIds(
  mode: InteriorNavigationMode,
  surface: InteriorNavigationSurface,
): readonly PreviewNavigationId[] {
  return INTERIOR_NAVIGATION_IDS[mode][surface];
}

export function getV2MobileNavigationIds(
  mode: InteriorNavigationMode,
  newsletterVisible: boolean,
): readonly PreviewNavigationId[] {
  const base = getInteriorNavigationIds(mode, "mobile");
  return newsletterVisible
    ? base.flatMap((id) => id === "contact" ? ["newsletter", id] as const : [id])
    : base;
}

export function resolvePreviewNavigationItems(
  ids: readonly PreviewNavigationId[],
): ResolvedPreviewNavigationItem[] {
  return ids.map(resolvePreviewNavigationItem);
}
