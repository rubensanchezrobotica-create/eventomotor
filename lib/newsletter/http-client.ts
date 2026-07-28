import type {
  ConfirmNewsletterResponse,
  PublicNewsletterErrorResponse,
  RequestNewsletterResponse,
  UnsubscribeNewsletterResponse,
} from "@/lib/newsletter/http-contracts";

export const NEWSLETTER_HTTP_TIMEOUT_MS = 8_000;

export type NewsletterFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type NewsletterRequestClientResult =
  | "accepted"
  | "invalid"
  | "unavailable"
  | "rate_limited"
  | "temporarily_unavailable";

export type NewsletterConfirmClientResult =
  | ConfirmNewsletterResponse["status"]
  | "unavailable"
  | "temporarily_unavailable";

export type NewsletterUnsubscribeClientResult =
  | UnsubscribeNewsletterResponse["status"]
  | "unavailable"
  | "temporarily_unavailable";

export type NewsletterRequestPayload = {
  email: string;
  province: string;
  consentVersion: string;
};

type NewsletterMutationOptions = {
  fetcher?: NewsletterFetch;
  signal?: AbortSignal;
  timeoutMs?: number;
};

type PublicJson =
  | RequestNewsletterResponse
  | ConfirmNewsletterResponse
  | UnsubscribeNewsletterResponse
  | PublicNewsletterErrorResponse;

type NewsletterHttpResult =
  | { ok: true; status: number; body: PublicJson }
  | { ok: false };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPublicJson(value: unknown): value is PublicJson {
  if (!isRecord(value) || typeof value.ok !== "boolean") return false;
  if (value.ok) return typeof value.status === "string";
  return typeof value.error === "string";
}

async function postNewsletterJson(
  path: string,
  payload: Record<string, string>,
  options: NewsletterMutationOptions,
): Promise<NewsletterHttpResult> {
  const fetcher = options.fetcher ?? fetch;
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? NEWSLETTER_HTTP_TIMEOUT_MS;
  const abortFromCaller = () => controller.abort();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  if (options.signal?.aborted) controller.abort();
  options.signal?.addEventListener("abort", abortFromCaller, { once: true });

  try {
    const response = await fetcher(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const text = await response.text();
    if (!text) return { ok: false };

    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return { ok: false };
    }
    if (!isPublicJson(body)) return { ok: false };
    return { ok: true, status: response.status, body };
  } catch {
    return { ok: false };
  } finally {
    globalThis.clearTimeout(timeoutId);
    options.signal?.removeEventListener("abort", abortFromCaller);
  }
}

function isPublicError(
  result: NewsletterHttpResult,
  status: number,
  error: PublicNewsletterErrorResponse["error"],
): boolean {
  return (
    result.ok &&
    result.status === status &&
    result.body.ok === false &&
    result.body.error === error
  );
}

export async function requestNewsletterSubscription(
  payload: NewsletterRequestPayload,
  options: NewsletterMutationOptions = {},
): Promise<NewsletterRequestClientResult> {
  const result = await postNewsletterJson("/api/newsletter/request", payload, options);
  if (
    result.ok &&
    result.status === 202 &&
    result.body.ok === true &&
    result.body.status === "accepted"
  ) {
    return "accepted";
  }
  if (
    isPublicError(result, 400, "invalid_request") ||
    isPublicError(result, 413, "payload_too_large") ||
    isPublicError(result, 415, "unsupported_media_type")
  ) {
    return "invalid";
  }
  if (isPublicError(result, 404, "not_found")) return "unavailable";
  if (isPublicError(result, 429, "rate_limited")) return "rate_limited";
  return "temporarily_unavailable";
}

export async function confirmNewsletterSubscription(
  token: string,
  options: NewsletterMutationOptions = {},
): Promise<NewsletterConfirmClientResult> {
  const result = await postNewsletterJson(
    "/api/newsletter/confirm",
    { token },
    options,
  );
  if (
    result.ok &&
    result.status === 200 &&
    result.body.ok === true &&
    ["confirmed", "already_confirmed", "invalid_or_expired"].includes(result.body.status)
  ) {
    return result.body.status as ConfirmNewsletterResponse["status"];
  }
  if (isPublicError(result, 404, "not_found")) return "unavailable";
  if (
    isPublicError(result, 400, "invalid_request") ||
    isPublicError(result, 413, "payload_too_large") ||
    isPublicError(result, 415, "unsupported_media_type")
  ) {
    return "invalid_or_expired";
  }
  return "temporarily_unavailable";
}

export async function unsubscribeNewsletterSubscription(
  token: string,
  options: NewsletterMutationOptions = {},
): Promise<NewsletterUnsubscribeClientResult> {
  const result = await postNewsletterJson(
    "/api/newsletter/unsubscribe",
    { token },
    options,
  );
  if (
    result.ok &&
    result.status === 200 &&
    result.body.ok === true &&
    ["unsubscribed", "already_unsubscribed", "invalid_or_expired"].includes(
      result.body.status,
    )
  ) {
    return result.body.status as UnsubscribeNewsletterResponse["status"];
  }
  if (isPublicError(result, 404, "not_found")) return "unavailable";
  if (
    isPublicError(result, 400, "invalid_request") ||
    isPublicError(result, 413, "payload_too_large") ||
    isPublicError(result, 415, "unsupported_media_type")
  ) {
    return "invalid_or_expired";
  }
  return "temporarily_unavailable";
}

export async function runNewsletterMutationOnce<Result>(
  lock: { current: boolean },
  mutation: () => Promise<Result>,
): Promise<Result | undefined> {
  if (lock.current) return undefined;
  lock.current = true;
  try {
    return await mutation();
  } finally {
    lock.current = false;
  }
}
