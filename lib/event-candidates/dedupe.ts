import { buildCandidateSlug, slugifyCandidatePart } from "@/lib/event-candidates/normalizer";
import type { EventCandidate } from "@/lib/event-candidates/types";

export type CandidateDedupeEvent = {
  id: string;
  slug: string | null;
  title: string;
  start_date: string;
  end_date: string | null;
  city: string | null;
  province: string | null;
  region: string | null;
  discipline: string | null;
  source_url: string | null;
  visible: boolean | null;
};

export type CandidateDedupeResult = {
  duplicate_score: number;
  possible_duplicate_event_id: string | null;
  duplicate_reason: string | null;
};

function normalizeComparable(value: string | null | undefined) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokens(value: string | null | undefined) {
  return new Set(normalizeComparable(value).split(/\s+/).filter((token) => token.length > 2));
}

export function tokenSimilarity(left: string | null | undefined, right: string | null | undefined) {
  const leftTokens = tokens(left);
  const rightTokens = tokens(right);

  if (!leftTokens.size || !rightTokens.size) return 0;

  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  const base = intersection / union;
  const leftText = normalizeComparable(left);
  const rightText = normalizeComparable(right);
  const containsBonus = leftText.includes(rightText) || rightText.includes(leftText) ? 0.15 : 0;

  return Math.min(1, base + containsBonus);
}

function sameText(left: string | null | undefined, right: string | null | undefined) {
  const normalizedLeft = normalizeComparable(left);
  const normalizedRight = normalizeComparable(right);
  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight);
}

function exactSourceUrl(left: string | null | undefined, right: string | null | undefined) {
  const normalizedLeft = String(left || "").trim().replace(/\/+$/, "").toLowerCase();
  const normalizedRight = String(right || "").trim().replace(/\/+$/, "").toLowerCase();
  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(value);
}

function result(score: number, event: CandidateDedupeEvent, reason: string): CandidateDedupeResult {
  const idForUuidColumn = isUuid(event.id) ? event.id : null;
  const extra = idForUuidColumn ? "" : ` Evento existente: ${event.id}.`;

  return {
    duplicate_score: score,
    possible_duplicate_event_id: idForUuidColumn,
    duplicate_reason: `${reason}${extra}`,
  };
}

function bestResult(current: CandidateDedupeResult, candidate: CandidateDedupeResult) {
  return candidate.duplicate_score > current.duplicate_score ? candidate : current;
}

export function dedupeEventCandidate(
  candidate: EventCandidate,
  events: CandidateDedupeEvent[],
): CandidateDedupeResult {
  let best: CandidateDedupeResult = {
    duplicate_score: 0,
    possible_duplicate_event_id: null,
    duplicate_reason: null,
  };
  const candidateSlug = candidate.slug_suggested || buildCandidateSlug(candidate);
  const candidateDiscipline = candidate.discipline || candidate.category;

  for (const event of events) {
    const titleSimilarity = tokenSimilarity(candidate.normalized_title, event.title);

    if (exactSourceUrl(candidate.source_url, event.source_url)) {
      best = bestResult(best, result(0.95, event, "Misma source_url que un evento existente."));
    }

    if (candidateSlug && event.slug && slugifyCandidatePart(event.slug) === candidateSlug) {
      best = bestResult(best, result(0.9, event, "Mismo slug sugerido que un evento existente."));
    }

    if (titleSimilarity >= 0.72 && candidate.start_date && candidate.start_date === event.start_date) {
      best = bestResult(best, result(0.85, event, "Titulo muy parecido y misma fecha de inicio."));
    }

    const sameCityOrProvince =
      sameText(candidate.city, event.city) || sameText(candidate.province, event.province);

    if (titleSimilarity >= 0.72 && sameCityOrProvince) {
      best = bestResult(best, result(0.75, event, "Titulo muy parecido y misma ciudad/provincia."));
    }

    const sameDate = Boolean(candidate.start_date && candidate.start_date === event.start_date);
    const sameCity = sameText(candidate.city, event.city);
    const sameDiscipline = sameText(candidateDiscipline, event.discipline);

    if (sameDate && sameCity && sameDiscipline) {
      best = bestResult(best, result(0.7, event, "Misma fecha, ciudad y disciplina/categoria."));
    }
  }

  return best;
}
