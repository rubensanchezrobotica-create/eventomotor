import { createSupabaseServerClient } from "@/lib/supabase";
import type { EventRow } from "@/lib/supabase";

type DraftInput = {
  title?: unknown;
  slug?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  city?: unknown;
  province?: unknown;
  sourceUrl?: unknown;
  ticketUrl?: unknown;
  registrationUrl?: unknown;
};

type ValidationStatus = "ok" | "warning" | "error";

type ValidationCheck = {
  status: ValidationStatus;
  label: string;
  message: string;
};

type PossibleDuplicate = {
  id: string;
  slug: string | null;
  title: string;
  startDate: string;
  endDate: string | null;
  city: string | null;
  province: string | null;
  reason: string;
};

const EVENT_SELECT = "id,slug,title,start_date,end_date,city,province,visible";
const SOURCE_OK_STATUSES = new Set([200, 301, 302]);

function jsonError(message: string, status: number) {
  return Response.json({ ok: false, error: message }, { status });
}

function validateAdminSecret(request: Request) {
  const adminSecret = process.env.ADMIN_SECRET;

  if (!adminSecret) {
    return {
      ok: false as const,
      status: 500,
      error: "ADMIN_SECRET is not configured. Add ADMIN_SECRET to your environment.",
    };
  }

  if (request.headers.get("authorization") !== `Bearer ${adminSecret}`) {
    return {
      ok: false as const,
      status: 401,
      error: "Unauthorized. Send Authorization: Bearer ADMIN_SECRET.",
    };
  }

  return { ok: true as const };
}

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function parseDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeText(value: string | null | undefined) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function titleSimilarity(left: string, right: string) {
  const leftWords = new Set(normalizeText(left).split(/\s+/).filter((word) => word.length > 2));
  const rightWords = new Set(normalizeText(right).split(/\s+/).filter((word) => word.length > 2));

  if (!leftWords.size || !rightWords.size) return 0;

  const common = [...leftWords].filter((word) => rightWords.has(word)).length;
  return common / Math.max(leftWords.size, rightWords.size);
}

function daysBetween(left: string, right: string) {
  const leftDate = parseDate(left);
  const rightDate = parseDate(right);

  if (!leftDate || !rightDate) return Number.POSITIVE_INFINITY;

  return Math.abs(leftDate.getTime() - rightDate.getTime()) / 86_400_000;
}

async function checkUrlStatus(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);

  try {
    const headResponse = await fetch(url, {
      method: "HEAD",
      redirect: "manual",
      signal: controller.signal,
    });

    if (SOURCE_OK_STATUSES.has(headResponse.status)) return headResponse.status;

    const getResponse = await fetch(url, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
    });

    return getResponse.status;
  } finally {
    clearTimeout(timeout);
  }
}

function addCheck(checks: ValidationCheck[], status: ValidationStatus, label: string, message: string) {
  checks.push({ status, label, message });
}

function findPossibleDuplicates(draft: DraftInput, rows: Pick<EventRow, "id" | "slug" | "title" | "start_date" | "end_date" | "city" | "province">[]) {
  const title = textValue(draft.title);
  const slug = textValue(draft.slug);
  const startDate = textValue(draft.startDate);
  const city = normalizeText(textValue(draft.city));
  const province = normalizeText(textValue(draft.province));
  const duplicates: PossibleDuplicate[] = [];

  for (const row of rows) {
    const reasons: string[] = [];

    if (slug && row.slug === slug) {
      reasons.push("mismo slug");
    }

    const similarTitle = titleSimilarity(title, row.title) >= 0.72;
    const samePlace = city && province && normalizeText(row.city) === city && normalizeText(row.province) === province;
    const closeDate = startDate ? daysBetween(startDate, row.start_date) <= 3 : false;

    if (similarTitle && samePlace && closeDate) {
      reasons.push("título parecido, misma zona y fecha cercana");
    } else if (similarTitle && closeDate) {
      reasons.push("título parecido y fecha cercana");
    } else if (samePlace && closeDate) {
      reasons.push("misma ciudad/provincia y fecha cercana");
    }

    if (reasons.length) {
      duplicates.push({
        id: row.id,
        slug: row.slug,
        title: row.title,
        startDate: row.start_date,
        endDate: row.end_date,
        city: row.city,
        province: row.province,
        reason: reasons.join("; "),
      });
    }
  }

  return duplicates.slice(0, 8);
}

export async function POST(request: Request) {
  const auth = validateAdminSecret(request);

  if (!auth.ok) {
    return jsonError(auth.error, auth.status);
  }

  try {
    const draft = (await request.json()) as DraftInput;
    const checks: ValidationCheck[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    const title = textValue(draft.title);
    const slug = textValue(draft.slug);
    const startDate = textValue(draft.startDate);
    const endDate = textValue(draft.endDate);
    const city = textValue(draft.city);
    const province = textValue(draft.province);
    const sourceUrl = textValue(draft.sourceUrl);
    const ticketUrl = textValue(draft.ticketUrl) || textValue(draft.registrationUrl);

    if (title) addCheck(checks, "ok", "Título", "Título informado.");
    else {
      addCheck(checks, "error", "Título", "Falta el título del evento.");
      errors.push("Falta el título del evento.");
    }

    if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) addCheck(checks, "ok", "Slug", "Slug con formato correcto.");
    else {
      addCheck(checks, "error", "Slug", "El slug falta o tiene formato no válido.");
      errors.push("El slug falta o tiene formato no válido.");
    }

    const parsedStart = parseDate(startDate);
    const parsedEnd = endDate ? parseDate(endDate) : parsedStart;

    if (parsedStart) addCheck(checks, "ok", "Fecha inicio", "Fecha de inicio válida.");
    else {
      addCheck(checks, "error", "Fecha inicio", "Falta una fecha de inicio válida.");
      errors.push("Falta una fecha de inicio válida.");
    }

    if (parsedStart && parsedEnd && parsedEnd >= parsedStart) addCheck(checks, "ok", "Fecha fin", "Fecha fin coherente.");
    else if (endDate) {
      addCheck(checks, "error", "Fecha fin", "La fecha fin no puede ser anterior a la fecha inicio.");
      errors.push("La fecha fin no puede ser anterior a la fecha inicio.");
    }

    if (city) addCheck(checks, "ok", "Ciudad", "Ciudad informada.");
    else {
      addCheck(checks, "error", "Ciudad", "Falta ciudad.");
      errors.push("Falta ciudad.");
    }

    if (province) addCheck(checks, "ok", "Provincia", "Provincia informada.");
    else {
      addCheck(checks, "error", "Provincia", "Falta provincia.");
      errors.push("Falta provincia.");
    }

    if (!sourceUrl) {
      addCheck(checks, "error", "Fuente oficial", "Falta fuente oficial verificable.");
      errors.push("Falta fuente oficial verificable.");
    } else if (!isHttpUrl(sourceUrl)) {
      addCheck(checks, "error", "Fuente oficial", "La fuente oficial debe usar http:// o https://.");
      errors.push("La fuente oficial debe usar http:// o https://.");
    } else {
      try {
        const sourceStatus = await checkUrlStatus(sourceUrl);

        if (SOURCE_OK_STATUSES.has(sourceStatus)) {
          addCheck(checks, "ok", "Fuente oficial", `La fuente oficial responde con status ${sourceStatus}.`);
        } else {
        addCheck(checks, "warning", "Fuente oficial", `La fuente oficial responde con status ${sourceStatus}. Revísala manualmente.`);
          warnings.push(`La fuente oficial responde con status ${sourceStatus}.`);
        }
      } catch {
        addCheck(checks, "warning", "Fuente oficial", "No se ha podido verificar automáticamente la fuente oficial. Revísala manualmente.");
        warnings.push("No se ha podido verificar automáticamente la fuente oficial. Revísala manualmente.");
      }
    }

    if (ticketUrl && isHttpUrl(ticketUrl)) addCheck(checks, "ok", "Entradas / inscripción", "URL de entradas con formato correcto.");
    else if (ticketUrl) {
      addCheck(checks, "warning", "Entradas / inscripción", "La URL de entradas debe usar http:// o https://.");
      warnings.push("La URL de entradas debe usar http:// o https://.");
    }

    if (!textValue((draft as { priceText?: unknown }).priceText)) {
      addCheck(checks, "warning", "Precio", "No se ha informado precio.");
      warnings.push("No se ha informado precio.");
    }

    const supabase = createSupabaseServerClient();
    let possibleDuplicates: PossibleDuplicate[] = [];

    if (!supabase) {
      addCheck(checks, "warning", "Duplicados", "Supabase no está configurado para comprobar duplicados.");
      warnings.push("No se pudieron comprobar duplicados.");
    } else {
      const { data, error } = await supabase.from("events").select(EVENT_SELECT).eq("visible", true);

      if (error) {
        addCheck(checks, "warning", "Duplicados", "No se pudieron consultar eventos existentes.");
        warnings.push("No se pudieron consultar eventos existentes.");
      } else {
        possibleDuplicates = findPossibleDuplicates(draft, (data ?? []) as EventRow[]);

        if (possibleDuplicates.length) {
          addCheck(checks, "warning", "Posibles duplicados", `Se han encontrado ${possibleDuplicates.length} eventos similares. Revisa antes de publicar.`);
          warnings.push(`Se han encontrado ${possibleDuplicates.length} eventos similares. Revisa antes de publicar.`);
        } else {
          addCheck(checks, "ok", "Duplicados", "No se han detectado duplicados probables.");
        }
      }
    }

    const status: ValidationStatus = errors.length ? "error" : warnings.length || possibleDuplicates.length ? "warning" : "ok";

    return Response.json({
      ok: true,
      status,
      checks,
      warnings,
      errors,
      possibleDuplicates,
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : String(error), 500);
  }
}
