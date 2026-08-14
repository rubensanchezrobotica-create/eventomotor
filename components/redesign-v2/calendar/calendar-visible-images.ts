import {
  classifyV2FallbackEvent,
  resolveV2EventImageCandidates,
  stableV2Hash,
} from "../discipline-fallback-resolver";
import type { PreviewEvent, ResolvedEventImage } from "../redesign-v2-model";

const SUBTYPE_TAG_ALIASES: Readonly<Record<string, readonly string[]>> = {
  concentracion: ["concentracion", "concentracion-motera"],
  motoalmuerzo: ["motoalmuerzo", "almuerzo-motero", "matinal", "matinal-motera"],
  "custom-biker": ["custom", "biker", "concentracion-motera"],
  supercross: ["motocross"],
  motocross: ["motocross"],
  "hard-enduro": ["enduro"],
  enduro: ["enduro"],
  "enduro-indoor": ["enduro-indoor", "superenduro"],
  trial: ["trial"],
  "trial-indoor": ["trial-indoor"],
  "cross-country": ["cross-country", "crosscountry"],
  autocross: ["autocross"],
  "tramo-tierra": ["autocross"],
};

function normalizedTags(tags: readonly string[]): Set<string> {
  return new Set(tags.map((tag) => tag.toLocaleLowerCase("es-ES")));
}

function candidateMatchesSubtype(subtype: string | undefined, tags: readonly string[]): boolean {
  if (!subtype) return true;
  const accepted = SUBTYPE_TAG_ALIASES[subtype] ?? [subtype];
  const candidateTags = normalizedTags(tags);
  return accepted.some((tag) => candidateTags.has(tag));
}

/**
 * Calendar-only post-processing for an already sliced and R3F-balanced sequence.
 * It never alters real imagery or crosses discipline, vehicle, subtype-compatible
 * pool or fallback tier boundaries.
 */
export function diversifyCalendarVisibleImages(
  events: readonly PreviewEvent[],
  assignedImages: readonly ResolvedEventImage[],
): ResolvedEventImage[] {
  const usedByPool = new Map<string, Set<string>>();
  const previousByPool = new Map<string, string>();

  return events.map((event, index) => {
    const base = assignedImages[index] ?? { src: null, kind: "neutral", alt: "" } as const;
    if (base.kind !== "representative" || !base.fallbackId || !base.fallbackTier) return base;

    const classification = classifyV2FallbackEvent(event);
    if (!classification) return base;

    const compatible = resolveV2EventImageCandidates(event).filter((candidate) => (
      candidate.tier === base.fallbackTier
      && candidate.discipline === classification.discipline
      && candidate.vehicle === classification.vehicle
      && candidateMatchesSubtype(classification.subtype, candidate.tags)
    ));
    if (!compatible.length) return base;

    const poolKey = [classification.discipline, classification.vehicle, classification.subtype ?? "generic", base.fallbackTier].join(":");
    const used = usedByPool.get(poolKey) ?? new Set<string>();
    const unused = compatible.filter((candidate) => !used.has(candidate.id));
    const cycleChoices = unused.length ? unused : compatible;
    const previous = previousByPool.get(poolKey);
    const nonRepeatingChoices = cycleChoices.length > 1 ? cycleChoices.filter((candidate) => candidate.id !== previous) : cycleChoices;
    const choices = nonRepeatingChoices.length ? nonRepeatingChoices : cycleChoices;
    const selected = choices[stableV2Hash(`${event.id}:${event.slug}:${poolKey}`) % choices.length];
    used.add(selected.id);
    usedByPool.set(poolKey, used);
    previousByPool.set(poolKey, selected.id);

    return {
      src: selected.src,
      kind: "representative",
      alt: "",
      label: "Imagen representativa",
      fallbackId: selected.id,
      fallbackTier: selected.tier,
      fallbackReason: selected.reason,
      interpretedDiscipline: classification.discipline,
      interpretedVehicle: classification.vehicle,
      interpretedSubtype: classification.subtype,
    };
  });
}
