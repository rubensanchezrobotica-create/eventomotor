import { dedupeEventCandidate } from "@/lib/event-candidates/dedupe";
import { buildCandidateSlug, normalizeCandidateCore } from "@/lib/event-candidates/normalizer";
import {
  addEventCandidateCheck,
  getEventCandidateById,
  listEventsForCandidateDedupe,
  updateEventCandidateAnalysis,
} from "@/lib/event-candidates/repository";
import type { EventCandidate, EventCandidateCheckInput } from "@/lib/event-candidates/types";
import {
  validateEventCandidate,
  validationChecksFromResult,
  type CandidateValidationIssue,
} from "@/lib/event-candidates/validator";

export type EventCandidateAnalysisSummary = {
  slug_suggested: string | null;
  quality_score: number;
  validation_errors: CandidateValidationIssue[];
  duplicate_score: number;
  possible_duplicate_event_id: string | null;
  duplicate_reason: string | null;
  checks_created: number;
};

export type AnalyzeEventCandidateResult = {
  candidate: EventCandidate;
  summary: EventCandidateAnalysisSummary;
};

export async function analyzeEventCandidate(id: string): Promise<AnalyzeEventCandidateResult> {
  const candidate = await getEventCandidateById(id);

  if (!candidate) {
    throw new Error("Candidate not found.");
  }

  const normalized = normalizeCandidateCore(candidate);
  const normalizedCandidate: EventCandidate = {
    ...candidate,
    ...normalized,
  };
  const slugSuggested = buildCandidateSlug(normalizedCandidate) || null;
  const candidateForChecks: EventCandidate = {
    ...normalizedCandidate,
    slug_suggested: slugSuggested,
  };
  const validation = validateEventCandidate(candidateForChecks);
  const events = await listEventsForCandidateDedupe();
  const dedupe = dedupeEventCandidate(candidateForChecks, events);
  const checks: EventCandidateCheckInput[] = [
    ...validationChecksFromResult(validation),
    {
      check_type: "duplicate_check",
      status: dedupe.duplicate_score >= 0.85 ? "warning" : "passed",
      message: dedupe.duplicate_reason || "No se detectaron duplicados probables",
      score: dedupe.duplicate_score,
      metadata: {
        duplicate_score: dedupe.duplicate_score,
        possible_duplicate_event_id: dedupe.possible_duplicate_event_id,
      },
    },
  ];

  const updated = await updateEventCandidateAnalysis(id, {
    ...normalized,
    slug_suggested: slugSuggested,
    quality_score: validation.quality_score,
    duplicate_score: dedupe.duplicate_score,
    possible_duplicate_event_id: dedupe.possible_duplicate_event_id,
    duplicate_reason: dedupe.duplicate_reason,
    validation_errors: validation.validation_errors,
  });

  for (const check of checks) {
    await addEventCandidateCheck(id, check);
  }

  return {
    candidate: updated,
    summary: {
      slug_suggested: slugSuggested,
      quality_score: validation.quality_score,
      validation_errors: validation.validation_errors,
      duplicate_score: dedupe.duplicate_score,
      possible_duplicate_event_id: dedupe.possible_duplicate_event_id,
      duplicate_reason: dedupe.duplicate_reason,
      checks_created: checks.length,
    },
  };
}
