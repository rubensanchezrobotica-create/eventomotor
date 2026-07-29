import "server-only";

const RESEND_API_BASE_URL = "https://api.resend.com";
const RESEND_EMAIL_PATH = "/emails";
const RESEND_EMAIL_ENDPOINT = `${RESEND_API_BASE_URL}${RESEND_EMAIL_PATH}`;
const RESEND_RESPONSE_MAX_BYTES = 8_192;
const DEFAULT_RESEND_TIMEOUT_MS = 10_000;

export type NewsletterResendEmailPayload = {
  from: string;
  to: readonly [string];
  replyTo: string;
  subject: string;
  html: string;
  text: string;
};

export type NewsletterResendClientResult =
  | { status: "accepted"; providerMessageId: string }
  | { status: "provider_error"; httpStatus: number | null }
  | { status: "timeout" }
  | { status: "invalid_response"; httpStatus: number };

export interface NewsletterResendClient {
  sendEmail(payload: NewsletterResendEmailPayload): Promise<NewsletterResendClientResult>;
}

type FetchNewsletterResendClientOptions = {
  apiKey: string;
  timeoutMs?: number;
};

function isProviderMessageId(value: unknown): value is string {
  return typeof value === "string" && value.length >= 1 && value.length <= 200;
}

function isSafeSingleRecipientPayload(payload: NewsletterResendEmailPayload): boolean {
  const candidate = payload as NewsletterResendEmailPayload & {
    cc?: unknown;
    bcc?: unknown;
  };
  return (
    Array.isArray(candidate.to) &&
    candidate.to.length === 1 &&
    typeof candidate.to[0] === "string" &&
    !Object.hasOwn(candidate, "cc") &&
    !Object.hasOwn(candidate, "bcc")
  );
}

async function readBoundedResponse(response: Response): Promise<string | null> {
  const contentLength = response.headers.get("content-length");
  if (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) > RESEND_RESPONSE_MAX_BYTES) {
    return null;
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let totalBytes = 0;
  let text = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      totalBytes += chunk.value.byteLength;
      if (totalBytes > RESEND_RESPONSE_MAX_BYTES) {
        await reader.cancel();
        return null;
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    return text;
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

export class FetchNewsletterResendClient implements NewsletterResendClient {
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(options: FetchNewsletterResendClientOptions) {
    if (
      options.apiKey.length < 20 ||
      options.apiKey.length > 500 ||
      options.apiKey !== options.apiKey.trim() ||
      /[\s\u0000-\u001f\u007f]/.test(options.apiKey)
    ) {
      throw new Error("Newsletter Resend client configuration is invalid.");
    }
    const timeoutMs = options.timeoutMs ?? DEFAULT_RESEND_TIMEOUT_MS;
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30_000) {
      throw new Error("Newsletter Resend client configuration is invalid.");
    }
    this.apiKey = options.apiKey;
    this.timeoutMs = timeoutMs;
  }

  async sendEmail(
    payload: NewsletterResendEmailPayload,
  ): Promise<NewsletterResendClientResult> {
    if (!isSafeSingleRecipientPayload(payload)) {
      return { status: "provider_error", httpStatus: null };
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await globalThis.fetch(RESEND_EMAIL_ENDPOINT, {
        method: "POST",
        redirect: "error",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "User-Agent": "eventomotor-newsletter-r4a/1.0",
        },
        body: JSON.stringify({
          from: payload.from,
          to: [...payload.to],
          reply_to: payload.replyTo,
          subject: payload.subject,
          html: payload.html,
          text: payload.text,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        return { status: "provider_error", httpStatus: response.status };
      }

      const rawBody = await readBoundedResponse(response);
      if (rawBody === null) {
        return controller.signal.aborted
          ? { status: "timeout" }
          : { status: "invalid_response", httpStatus: response.status };
      }
      let body: unknown;
      try {
        body = JSON.parse(rawBody);
      } catch {
        return { status: "invalid_response", httpStatus: response.status };
      }
      if (
        typeof body !== "object" ||
        body === null ||
        !isProviderMessageId((body as Record<string, unknown>).id)
      ) {
        return { status: "invalid_response", httpStatus: response.status };
      }
      return {
        status: "accepted",
        providerMessageId: (body as { id: string }).id,
      };
    } catch {
      return controller.signal.aborted
        ? { status: "timeout" }
        : { status: "provider_error", httpStatus: null };
    } finally {
      clearTimeout(timeout);
    }
  }
}
