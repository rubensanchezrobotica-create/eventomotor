export type NewsletterEdition17ContentVariant = "national" | "madrid";

export const NEWSLETTER_EDITION_17_TERRITORIAL_MODULES = {
  "comunidad-de-madrid": {
    variant: "madrid",
    title: "X-Trial: equilibrio imposible en Madrid Arena",
    meta: "28 noviembre, 18:00 · Madrid Arena, Madrid",
    paragraphs: [
      "El Campeonato del Mundo FIM de X-Trial aterriza en Madrid Arena el sábado 28 a las 18:00. Los mejores especialistas del trial indoor se enfrentan a zonas técnicas con un formato pensado también como espectáculo para el público.",
    ],
    cta: "Ver X-Trial Madrid",
    url: "https://www.eventomotor.com/evento/x-trial-madrid-2026-11-28",
    image: "06-x-trial-madrid.webp",
    imageAlt: "Ilustración editorial de trial indoor; no es una fotografía documental de X-Trial Madrid",
    utmContent: "x_trial_madrid",
  },
} as const;

export function newsletterEdition17ContentVariantForRegion(
  regionSlug: string | null | undefined,
): NewsletterEdition17ContentVariant {
  return regionSlug === "comunidad-de-madrid" ? "madrid" : "national";
}

export function newsletterEdition17TerritorialModuleForRegion(
  regionSlug: string | null | undefined,
) {
  return regionSlug === "comunidad-de-madrid"
    ? NEWSLETTER_EDITION_17_TERRITORIAL_MODULES["comunidad-de-madrid"]
    : null;
}
