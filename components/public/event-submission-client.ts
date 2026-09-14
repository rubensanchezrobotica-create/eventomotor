export const EVENT_SUBMISSION_FIELD_NAMES = [
  "event_name",
  "start_date",
  "end_date",
  "city",
  "province",
  "venue",
  "discipline",
  "vehicle_type",
  "source_url",
  "ticket_url",
  "poster_url",
  "description",
  "organizer_name",
  "contact_email",
  "contact_phone",
  "website",
] as const;

export type EventSubmissionFieldName = (typeof EVENT_SUBMISSION_FIELD_NAMES)[number];
export type EventSubmissionPayload = Record<EventSubmissionFieldName, string>;

export type EventSubmissionOutcome = {
  status: "success" | "error";
  message: string;
  fields?: Record<string, string>;
};

type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Pick<Response, "json" | "ok">>;

type SubmissionLock = { current: boolean };

function fieldValue(formData: FormData, name: EventSubmissionFieldName) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export function buildEventSubmissionPayload(formData: FormData): EventSubmissionPayload {
  return Object.fromEntries(
    EVENT_SUBMISSION_FIELD_NAMES.map((name) => [name, fieldValue(formData, name)]),
  ) as EventSubmissionPayload;
}

export function claimSubmissionLock(lock: SubmissionLock): boolean {
  if (lock.current) return false;
  lock.current = true;
  return true;
}

export function releaseSubmissionLock(lock: SubmissionLock) {
  lock.current = false;
}

export async function postEventSubmission(
  payload: EventSubmissionPayload,
  fetchImplementation: FetchLike = fetch,
): Promise<EventSubmissionOutcome> {
  try {
    const response = await fetchImplementation("/api/event-submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    let result: {
      ok?: boolean;
      message?: string;
      error?: string;
      fields?: Record<string, string>;
    } = {};

    try {
      result = await response.json();
    } catch {
      result = {};
    }

    if (!response.ok || !result.ok) {
      return {
        status: "error",
        message: result.error || "No se ha podido enviar el evento.",
        fields: result.fields,
      };
    }

    return {
      status: "success",
      message: result.message || "Evento enviado correctamente. Lo revisaremos antes de publicarlo.",
    };
  } catch {
    return {
      status: "error",
      message: "No se ha podido enviar el evento. Revisa tu conexión e inténtalo de nuevo.",
    };
  }
}
