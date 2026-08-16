import {
  classifyV2FallbackEvent,
  resolveV2EventImageCandidates,
  stableV2EventKey,
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

function candidateMatchesSubtype(subtype: string | undefined, tags: readonly string[]): boolean {
  if (!subtype) return true;
  const accepted = SUBTYPE_TAG_ALIASES[subtype] ?? [subtype];
  const candidateTags = new Set(tags.map((tag) => tag.toLocaleLowerCase("es-ES")));
  return accepted.some((tag) => candidateTags.has(tag));
}

/**
 * Weekend-only post-processing for the final paginated sequence. Real imagery
 * is immutable and representative imagery never crosses tier, discipline,
 * vehicle or subtype-compatible pools merely to obtain variety.
 */
export function diversifyWeekendVisibleImages(
  events: readonly PreviewEvent[],
  assignedImages: readonly ResolvedEventImage[],
): ResolvedEventImage[] {
  const assignedByEvent = new Map<string, ResolvedEventImage>();
  const lastUsedAt = new Map<string, number>();

  return events.map((event, index) => {
    const stableKey = stableV2EventKey(event);
    const existing = assignedByEvent.get(stableKey);
    if (existing) return existing;

    const base = assignedImages[index] ?? { src: null, kind: "neutral", alt: "" } as const;
    if (base.kind !== "representative" || !base.fallbackId || !base.fallbackTier) {
      assignedByEvent.set(stableKey, base);
      return base;
    }

    const classification = classifyV2FallbackEvent(event);
    if (!classification) {
      assignedByEvent.set(stableKey, base);
      return base;
    }

    const compatible = resolveV2EventImageCandidates(event).filter((candidate) => (
      candidate.tier === base.fallbackTier
      && candidate.discipline === classification.discipline
      && candidate.vehicle === classification.vehicle
      && candidateMatchesSubtype(classification.subtype, candidate.tags)
    ));
    if (!compatible.length) {
      assignedByEvent.set(stableKey, base);
      return base;
    }

    const poolKey = [
      classification.discipline,
      classification.vehicle,
      classification.subtype ?? "generic",
      base.fallbackTier,
    ].join(":");
    const baseCandidate = compatible.find((candidate) => candidate.id === base.fallbackId);
    const unused = compatible.filter((candidate) => !lastUsedAt.has(candidate.id));
    let choices = unused;

    if (!choices.length) {
      const oldestUse = Math.min(...compatible.map((candidate) => lastUsedAt.get(candidate.id) ?? -1));
      choices = compatible.filter((candidate) => (lastUsedAt.get(candidate.id) ?? -1) === oldestUse);
    }

    const selected = baseCandidate && !lastUsedAt.has(baseCandidate.id)
      ? baseCandidate
      : choices[stableV2Hash(`${stableKey}:${poolKey}`) % choices.length];
    const resolved: ResolvedEventImage = {
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
    assignedByEvent.set(stableKey, resolved);
    lastUsedAt.set(selected.id, index);
    return resolved;
  });
}
