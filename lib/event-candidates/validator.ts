import type { EventCandidate, EventCandidateCheckInput } from "@/lib/event-candidates/types";

export type CandidateValidationIssue = {
  field: string;
  code: "missing_required" | "missing_recommended" | "invalid_format" | "invalid_range";
  message: string;
};

export type CandidateValidationResult = {
  validation_errors: CandidateValidationIssue[];
  quality_score: number;
};

function isHttpUrl(value: string | null | undefined) {
  if (!value) return false;

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function parseIsoDate(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function todayUtc() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12));
}

function clampScore(value: number) {
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}

export function validateEventCandidate(candidate: EventCandidate): CandidateValidationResult {
  const validationErrors: CandidateValidationIssue[] = [];
  let score = 1;
  const startDate = parseIsoDate(candidate.start_date);
  const endDate = parseIsoDate(candidate.end_date);

  if (!candidate.normalized_title?.trim()) {
    validationErrors.push({
      field: "normalized_title",
      code: "missing_required",
      message: "Falta titulo normalizado",
    });
    score -= 0.3;
  }

  if (!candidate.source_url?.trim()) {
    validationErrors.push({
      field: "source_url",
      code: "missing_required",
      message: "Falta URL de fuente",
    });
    score -= 0.3;
  } else if (!isHttpUrl(candidate.source_url)) {
    validationErrors.push({
      field: "source_url",
      code: "invalid_format",
      message: "La fuente debe ser una URL http/https valida",
    });
    score -= 0.25;
  }

  if (!candidate.country?.trim()) {
    validationErrors.push({
      field: "country",
      code: "missing_required",
      message: "Falta pais",
    });
    score -= 0.2;
  }

  if (!candidate.start_date) {
    validationErrors.push({
      field: "start_date",
      code: "missing_recommended",
      message: "Falta fecha de inicio",
    });
    score -= 0.15;
  } else if (!startDate) {
    validationErrors.push({
      field: "start_date",
      code: "invalid_format",
      message: "La fecha de inicio debe usar YYYY-MM-DD",
    });
    score -= 0.2;
  } else if (startDate < todayUtc()) {
    validationErrors.push({
      field: "start_date",
      code: "invalid_range",
      message: "La fecha de inicio parece pasada",
    });
    score -= 0.1;
  }

  if (candidate.end_date) {
    if (!endDate) {
      validationErrors.push({
        field: "end_date",
        code: "invalid_format",
        message: "La fecha de fin debe usar YYYY-MM-DD",
      });
      score -= 0.1;
    } else if (startDate && endDate < startDate) {
      validationErrors.push({
        field: "end_date",
        code: "invalid_range",
        message: "La fecha de fin no puede ser anterior al inicio",
      });
      score -= 0.2;
    }
  }

  if (!candidate.city?.trim() && !candidate.province?.trim()) {
    validationErrors.push({
      field: "location",
      code: "missing_recommended",
      message: "Falta ciudad o provincia",
    });
    score -= 0.12;
  }

  if (!candidate.category?.trim() && !candidate.discipline?.trim()) {
    validationErrors.push({
      field: "category",
      code: "missing_recommended",
      message: "Falta categoria o disciplina",
    });
    score -= 0.12;
  }

  return {
    validation_errors: validationErrors,
    quality_score: clampScore(score),
  };
}

export function validationChecksFromResult(result: CandidateValidationResult): EventCandidateCheckInput[] {
  const hasIssue = (field: string) => result.validation_errors.some((issue) => issue.field === field);
  const hasLocationIssue = result.validation_errors.some((issue) => issue.field === "location");
  const hasCategoryIssue = result.validation_errors.some((issue) => issue.field === "category");

  return [
    {
      check_type: "required_fields",
      status: hasIssue("normalized_title") || hasIssue("country") ? "failed" : "passed",
      message: hasIssue("normalized_title") || hasIssue("country")
        ? "Faltan campos obligatorios"
        : "Campos obligatorios informados",
      score: result.quality_score,
    },
    {
      check_type: "date_check",
      status: hasIssue("start_date") || hasIssue("end_date") ? "warning" : "passed",
      message: hasIssue("start_date") || hasIssue("end_date")
        ? "Fecha pendiente de revision"
        : "Fechas coherentes",
      score: result.quality_score,
    },
    {
      check_type: "source_url_check",
      status: hasIssue("source_url") ? "failed" : "passed",
      message: hasIssue("source_url") ? "Fuente invalida o ausente" : "Fuente con formato valido",
      score: result.quality_score,
    },
    {
      check_type: "location_check",
      status: hasLocationIssue ? "warning" : "passed",
      message: hasLocationIssue ? "Ubicacion incompleta" : "Ubicacion suficiente",
      score: result.quality_score,
    },
    {
      check_type: "category_check",
      status: hasCategoryIssue ? "warning" : "passed",
      message: hasCategoryIssue ? "Categoria o disciplina pendiente" : "Categoria o disciplina informada",
      score: result.quality_score,
    },
  ];
}
