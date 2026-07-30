import "server-only";

import { randomUUID } from "node:crypto";
import {
  NEWSLETTER_CONSENT_VERSION,
  isNewsletterProvinceSlug,
  newsletterRegionForProvince,
  type NewsletterProvinceSlug,
} from "@/lib/newsletter/audience";
import { resolveNewsletterMode, type NewsletterRuntimeEnvironment } from "@/lib/newsletter/config";
import {
  evaluateNewsletterR4BLocalConfiguration,
  isNewsletterR4BLocalRequestAllowed,
} from "@/lib/newsletter/r4b-guard";
import type {
  ConfirmNewsletterResponse,
  PublicNewsletterErrorResponse,
  RequestNewsletterResponse,
  UnsubscribeNewsletterResponse,
} from "@/lib/newsletter/http-contracts";
import {
  isValidEmail,
  isValidNewsletterOpaqueToken,
  normalizeEmail,
} from "@/lib/newsletter/schemas";
import {
  evaluateNewsletterProductionCanaryResendConfiguration,
  evaluateNewsletterPublicLaunchResendConfiguration,
  type NewsletterProductionCanaryResendEnvironment,
} from "@/lib/newsletter/resend-config.server";
import {
  isNewsletterProductionCanaryMutationRequestAllowed,
} from "@/lib/newsletter/r5a-guard";
import {
  isNewsletterPublicLaunchMutationRequestAllowed,
} from "@/lib/newsletter/r5b-guard";
import { createConfiguredNewsletterService } from "@/lib/newsletter/service.server";
import {
  NewsletterOperationError,
  type NewsletterConfirmServiceResult,
  type NewsletterRequestServiceResult,
  type NewsletterService,
  type NewsletterUnsubscribeServiceResult,
} from "@/lib/newsletter/service-types";
import type {
  NewsletterConfirmationOutcome,
  NewsletterMode,
  NewsletterTokenUnsubscribeOutcome,
  NewsletterUnsubscribeOutcome,
} from "@/lib/newsletter/types";

export const NEWSLETTER_HTTP_MAX_BODY_BYTES = 4_096;

export type NewsletterHttpOperation = "request" | "confirm" | "unsubscribe";

export type NewsletterHttpGuardReason =
  | "mode_disabled"
  | "production_blocked"
  | "preview_context_invalid"
  | "test_context_invalid"
  | "production_canary_invalid"
  | "production_public_invalid"
  | "production_configuration_ambiguous"
  | "origin_required"
  | "origin_mismatch"
  | "host_mismatch"
  | "invalid_request_url";

export type NewsletterHttpGuardInput = NewsletterRuntimeEnvironment & {
  requestUrl: string;
  origin: string | null;
  host: string | null;
  r4bArmed?: string;
  r4bLocalOrigin?: string;
  vercel?: string;
  publicLaunchEnabled?: string;
  publicLaunchOrigin?: string;
  webhookSecret?: string;
} & Omit<NewsletterProductionCanaryResendEnvironment, "newsletterMode">;

export type NewsletterHttpGuardResult =
  | { allowed: true; mode: "preview" | "test" }
  | {
      allowed: true;
      mode: "live";
      launch: "canary";
      allowedRecipients: readonly string[];
    }
  | {
      allowed: true;
      mode: "live";
      launch: "public";
    }
  | { allowed: false; mode: NewsletterMode; reason: NewsletterHttpGuardReason };

export type NewsletterSafeLogEvent = {
  operation: NewsletterHttpOperation;
  category: string;
  requestId: string;
  mode: NewsletterMode;
  timestamp: string;
};

export interface NewsletterSafeLogger {
  error(event: NewsletterSafeLogEvent): void;
}

export type NewsletterAbuseCheck = (context: {
  operation: NewsletterHttpOperation;
  request: Request;
  requestId: string;
}) => boolean | Promise<boolean>;

export type NewsletterUnsubscribeTokenResolution =
  | { status: "valid"; subscriberId: string }
  | { status: "invalid_or_expired" };

export type NewsletterUnsubscribeTokenResolver = (
  token: string,
) => NewsletterUnsubscribeTokenResolution | Promise<NewsletterUnsubscribeTokenResolution>;

export type NewsletterHttpRuntimeEnvironment = NewsletterRuntimeEnvironment & {
  r4bArmed?: string;
  r4bLocalOrigin?: string;
  vercel?: string;
  publicLaunchEnabled?: string;
  publicLaunchOrigin?: string;
  webhookSecret?: string;
} & Omit<NewsletterProductionCanaryResendEnvironment, "newsletterMode">;

export type NewsletterHttpHandlerDependencies = {
  createService?: () => NewsletterService;
  environment?: () => NewsletterHttpRuntimeEnvironment;
  resolveUnsubscribeToken?: NewsletterUnsubscribeTokenResolver;
  checkAbuse?: NewsletterAbuseCheck;
  logger?: NewsletterSafeLogger;
  requestIdFactory?: () => string;
  now?: () => Date;
};

type RequestNewsletterInput = {
  email: string;
  provinceSlug: NewsletterProvinceSlug | null;
  consentVersion: typeof NEWSLETTER_CONSENT_VERSION;
};

type TokenInput = {
  token: string;
};

type ParseResult<Value> =
  | { ok: true; value: Value }
  | {
      ok: false;
      error: PublicNewsletterErrorResponse["error"];
      status: 400 | 413 | 415;
    };

const DEFAULT_LOGGER: NewsletterSafeLogger = {
  error(event) {
    console.error("newsletter_http_error", event);
  },
};

function currentEnvironment(): NewsletterHttpRuntimeEnvironment {
  return {
    mode: process.env.NEWSLETTER_MODE,
    nodeEnv: process.env.NODE_ENV,
    r4bArmed: process.env.NEWSLETTER_R4B_ARMED,
    r4bLocalOrigin: process.env.NEWSLETTER_R4B_LOCAL_ORIGIN,
    mailTransport: process.env.NEWSLETTER_MAIL_TRANSPORT,
    apiKey: process.env.NEWSLETTER_RESEND_API_KEY,
    from: process.env.NEWSLETTER_RESEND_FROM,
    replyTo: process.env.NEWSLETTER_RESEND_REPLY_TO,
    recipientAllowlist: process.env.NEWSLETTER_PRODUCTION_CANARY_ALLOWLIST,
    armed: process.env.NEWSLETTER_PRODUCTION_CANARY_ARMED,
    canaryOrigin: process.env.NEWSLETTER_PRODUCTION_CANARY_ORIGIN,
    publicLaunchEnabled: process.env.NEWSLETTER_PUBLIC_LAUNCH_ENABLED,
    publicLaunchOrigin: process.env.NEWSLETTER_PUBLIC_LAUNCH_ORIGIN,
    webhookSecret: process.env.NEWSLETTER_RESEND_WEBHOOK_SECRET,
    vercel: process.env.VERCEL,
    vercelEnv: process.env.VERCEL_ENV,
  };
}

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function sameOrigin(expected: URL, origin: string): boolean {
  const parsedOrigin = parseUrl(origin);
  return parsedOrigin !== null && parsedOrigin.origin === expected.origin;
}

export function evaluateNewsletterHttpGuard(
  input: NewsletterHttpGuardInput,
): NewsletterHttpGuardResult {
  const mode = resolveNewsletterMode(input);
  const requestUrl = parseUrl(input.requestUrl);
  if (!requestUrl) return { allowed: false, mode, reason: "invalid_request_url" };

  if (input.host && input.host.toLowerCase() !== requestUrl.host.toLowerCase()) {
    return { allowed: false, mode, reason: "host_mismatch" };
  }

  if (mode === "live") {
    const canaryConfiguration =
      evaluateNewsletterProductionCanaryResendConfiguration({
        newsletterMode: input.mode,
        mailTransport: input.mailTransport,
        apiKey: input.apiKey,
        from: input.from,
        replyTo: input.replyTo,
        recipientAllowlist: input.recipientAllowlist,
        armed: input.armed,
        canaryOrigin: input.canaryOrigin,
        nodeEnv: input.nodeEnv,
        vercel: input.vercel,
        vercelEnv: input.vercelEnv,
      });
    const publicConfiguration =
      evaluateNewsletterPublicLaunchResendConfiguration({
        newsletterMode: input.mode,
        mailTransport: input.mailTransport,
        apiKey: input.apiKey,
        from: input.from,
        replyTo: input.replyTo,
        publicLaunchEnabled: input.publicLaunchEnabled,
        publicLaunchOrigin: input.publicLaunchOrigin,
        webhookSecret: input.webhookSecret,
        nodeEnv: input.nodeEnv,
        vercel: input.vercel,
        vercelEnv: input.vercelEnv,
      });

    if (canaryConfiguration.enabled && publicConfiguration.enabled) {
      return {
        allowed: false,
        mode,
        reason: "production_configuration_ambiguous",
      };
    }
    if (
      publicConfiguration.enabled &&
      isNewsletterPublicLaunchMutationRequestAllowed(
        publicConfiguration,
        input.requestUrl,
        input.origin,
        input.host,
      )
    ) {
      return {
        allowed: true,
        mode: "live",
        launch: "public",
      };
    }
    if (
      !canaryConfiguration.enabled ||
      !isNewsletterProductionCanaryMutationRequestAllowed(
        canaryConfiguration,
        input.requestUrl,
        input.origin,
        input.host,
      )
    ) {
      return {
        allowed: false,
        mode,
        reason: publicConfiguration.enabled
          ? "production_public_invalid"
          : "production_canary_invalid",
      };
    }
    return {
      allowed: true,
      mode: "live",
      launch: "canary",
      allowedRecipients: canaryConfiguration.allowedRecipients,
    };
  }

  const productionDeployment =
    input.vercel !== undefined ||
    input.vercelEnv === "production" ||
    (!input.vercelEnv && input.nodeEnv === "production");
  if (productionDeployment) {
    return { allowed: false, mode, reason: "production_blocked" };
  }

  if (mode === "off") {
    return { allowed: false, mode, reason: "mode_disabled" };
  }

  if (mode === "preview") {
    const previewEnvironmentAllowed =
      input.vercelEnv === undefined ||
      input.vercelEnv === "development" ||
      input.vercelEnv === "preview";
    if (!previewEnvironmentAllowed) {
      return { allowed: false, mode, reason: "preview_context_invalid" };
    }
    if (!input.origin) return { allowed: false, mode, reason: "origin_required" };
    if (!sameOrigin(requestUrl, input.origin)) {
      return { allowed: false, mode, reason: "origin_mismatch" };
    }
    return { allowed: true, mode };
  }

  if (input.nodeEnv === "development") {
    const r4bConfiguration = evaluateNewsletterR4BLocalConfiguration({
      newsletterMode: input.mode,
      armed: input.r4bArmed,
      localOrigin: input.r4bLocalOrigin,
      nodeEnv: input.nodeEnv,
      vercel: input.vercel,
      vercelEnv: input.vercelEnv,
    });
    if (
      isNewsletterR4BLocalRequestAllowed(
        r4bConfiguration,
        input.requestUrl,
        input.origin,
        input.host,
      )
    ) {
      return { allowed: true, mode: "test" };
    }
    return { allowed: false, mode, reason: "test_context_invalid" };
  }

  if (
    input.nodeEnv !== "test" ||
    input.vercel !== undefined ||
    input.vercelEnv !== undefined
  ) {
    return { allowed: false, mode, reason: "test_context_invalid" };
  }
  if (input.origin && !sameOrigin(requestUrl, input.origin)) {
    return { allowed: false, mode, reason: "origin_mismatch" };
  }
  return { allowed: true, mode };
}

function jsonResponse<Body extends object>(body: Body, status: number): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function publicError(
  error: PublicNewsletterErrorResponse["error"],
  status: 400 | 404 | 413 | 415 | 429 | 503,
): Response {
  return jsonResponse<PublicNewsletterErrorResponse>({ ok: false, error }, status);
}

function hasOnlyKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === expected.length && actual.every((key) => expected.includes(key));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readBoundedJson(request: Request): Promise<ParseResult<Record<string, unknown>>> {
  const mediaType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (mediaType !== "application/json") {
    return { ok: false, error: "unsupported_media_type", status: 415 };
  }

  const rawContentLength = request.headers.get("content-length");
  if (rawContentLength && /^\d+$/.test(rawContentLength)) {
    const contentLength = Number(rawContentLength);
    if (!Number.isSafeInteger(contentLength) || contentLength > NEWSLETTER_HTTP_MAX_BODY_BYTES) {
      return { ok: false, error: "payload_too_large", status: 413 };
    }
  }

  if (!request.body) return { ok: false, error: "invalid_request", status: 400 };

  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let totalBytes = 0;
  let text = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      totalBytes += chunk.value.byteLength;
      if (totalBytes > NEWSLETTER_HTTP_MAX_BODY_BYTES) {
        await reader.cancel();
        return { ok: false, error: "payload_too_large", status: 413 };
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
  } catch {
    return { ok: false, error: "invalid_request", status: 400 };
  } finally {
    reader.releaseLock();
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return { ok: false, error: "invalid_request", status: 400 };
  }
  if (!isRecord(body)) return { ok: false, error: "invalid_request", status: 400 };
  return { ok: true, value: body };
}

export function parseRequestNewsletterInput(
  body: Record<string, unknown>,
): ParseResult<RequestNewsletterInput> {
  const allowedKeys = ["email", "province", "consentVersion"] as const;
  if (
    !Object.keys(body).every((key) =>
      allowedKeys.includes(key as (typeof allowedKeys)[number])
    ) ||
    !Object.hasOwn(body, "email") ||
    !Object.hasOwn(body, "consentVersion")
  ) {
    return { ok: false, error: "invalid_request", status: 400 };
  }
  const { email, province, consentVersion } = body;
  if (
    typeof email !== "string" ||
    email.length === 0 ||
    email.length > 320 ||
    !isValidEmail(email) ||
    !(
      province === undefined ||
      province === null ||
      province === "" ||
      (typeof province === "string" && isNewsletterProvinceSlug(province))
    ) ||
    consentVersion !== NEWSLETTER_CONSENT_VERSION
  ) {
    return { ok: false, error: "invalid_request", status: 400 };
  }
  return {
    ok: true,
    value: {
      email,
      provinceSlug:
        typeof province === "string" && province !== "" ? province : null,
      consentVersion,
    },
  };
}

export function parseConfirmationTokenInput(body: Record<string, unknown>): ParseResult<TokenInput> {
  if (
    !hasOnlyKeys(body, ["token"]) ||
    typeof body.token !== "string" ||
    !isValidNewsletterOpaqueToken(body.token)
  ) {
    return { ok: false, error: "invalid_request", status: 400 };
  }
  return { ok: true, value: { token: body.token } };
}

export function parseUnsubscribeTokenInput(body: Record<string, unknown>): ParseResult<TokenInput> {
  if (
    !hasOnlyKeys(body, ["token"]) ||
    typeof body.token !== "string" ||
    !isValidNewsletterOpaqueToken(body.token)
  ) {
    return { ok: false, error: "invalid_request", status: 400 };
  }
  return { ok: true, value: { token: body.token } };
}

export function mapNewsletterRequestResult(
  result: NewsletterRequestServiceResult,
): RequestNewsletterResponse {
  void result;
  return { ok: true, status: "accepted" };
}

export function mapNewsletterConfirmationOutcome(
  outcome: NewsletterConfirmationOutcome,
): ConfirmNewsletterResponse {
  if (outcome === "confirmed") return { ok: true, status: "confirmed" };
  if (outcome === "used_token") return { ok: true, status: "already_confirmed" };
  return { ok: true, status: "invalid_or_expired" };
}

export function mapNewsletterUnsubscribeOutcome(
  outcome: NewsletterUnsubscribeOutcome | NewsletterTokenUnsubscribeOutcome,
): UnsubscribeNewsletterResponse {
  if (outcome === "unsubscribed") return { ok: true, status: "unsubscribed" };
  if (outcome === "already_unsubscribed" || outcome === "already_not_sendable") {
    return { ok: true, status: "already_unsubscribed" };
  }
  return { ok: true, status: "invalid_or_expired" };
}

function logInternalFailure(
  dependencies: Required<Pick<NewsletterHttpHandlerDependencies, "logger" | "now">>,
  context: {
    operation: NewsletterHttpOperation;
    category: string;
    requestId: string;
    mode: NewsletterMode;
  },
): void {
  try {
    dependencies.logger.error({
      ...context,
      timestamp: dependencies.now().toISOString(),
    });
  } catch {
    // Logging must never change the public response or expose the original error.
  }
}

function mapThrownError(
  error: unknown,
  dependencies: Required<Pick<NewsletterHttpHandlerDependencies, "logger" | "now">>,
  context: {
    operation: NewsletterHttpOperation;
    requestId: string;
    mode: NewsletterMode;
  },
): Response {
  if (
    error instanceof NewsletterOperationError &&
    (error.category === "validation_error" || error.category === "token_error")
  ) {
    return publicError("invalid_request", 400);
  }
  const category =
    error instanceof NewsletterOperationError ? error.category : "unexpected_error";
  logInternalFailure(dependencies, { ...context, category });
  return publicError("temporarily_unavailable", 503);
}

function requestGuardInput(
  request: Request,
  environment: NewsletterHttpRuntimeEnvironment,
): NewsletterHttpGuardInput {
  return {
    ...environment,
    requestUrl: request.url,
    origin: request.headers.get("origin"),
    host: request.headers.get("host"),
  };
}

async function parseOperationInput(
  operation: NewsletterHttpOperation,
  request: Request,
): Promise<ParseResult<RequestNewsletterInput | TokenInput>> {
  const body = await readBoundedJson(request);
  if (!body.ok) return body;
  if (operation === "request") return parseRequestNewsletterInput(body.value);
  if (operation === "confirm") return parseConfirmationTokenInput(body.value);
  return parseUnsubscribeTokenInput(body.value);
}

async function executeRequest(
  service: NewsletterService,
  input: RequestNewsletterInput,
  sourcePath: string,
): Promise<NewsletterRequestServiceResult> {
  return service.requestSubscription({
    email: input.email,
    provinceSlug: input.provinceSlug,
    regionSlug: newsletterRegionForProvince(input.provinceSlug),
    consentVersion: input.consentVersion,
    source: "internal_http",
    sourcePath,
    languageCode: "es",
    countryCode: "ES",
  });
}

async function executeConfirm(
  service: NewsletterService,
  input: TokenInput,
): Promise<NewsletterConfirmServiceResult> {
  return service.confirmSubscription(input);
}

async function executeUnsubscribe(
  service: NewsletterService,
  subscriberId: string,
  sourcePath: string,
): Promise<NewsletterUnsubscribeServiceResult> {
  return service.unsubscribeSubscriber({
    subscriberId,
    source: "internal_http",
    consentVersion: NEWSLETTER_CONSENT_VERSION,
    sourcePath,
  });
}

async function executeUnsubscribeByToken(
  service: NewsletterService,
  input: TokenInput,
  sourcePath: string,
): Promise<NewsletterUnsubscribeServiceResult> {
  return service.unsubscribeByToken({
    token: input.token,
    source: "internal_http",
    consentVersion: NEWSLETTER_CONSENT_VERSION,
    sourcePath,
  });
}

export function createNewsletterHttpHandler(
  operation: NewsletterHttpOperation,
  dependencies: NewsletterHttpHandlerDependencies = {},
): (request: Request) => Promise<Response> {
  const createService = dependencies.createService ?? createConfiguredNewsletterService;
  const environment = dependencies.environment ?? currentEnvironment;
  const logger = dependencies.logger ?? DEFAULT_LOGGER;
  const requestIdFactory = dependencies.requestIdFactory ?? randomUUID;
  const now = dependencies.now ?? (() => new Date());

  return async function newsletterHttpHandler(request: Request): Promise<Response> {
    const requestId = requestIdFactory();
    const guard = evaluateNewsletterHttpGuard(requestGuardInput(request, environment()));
    if (!guard.allowed) return publicError("not_found", 404);

    if (dependencies.checkAbuse) {
      try {
        const allowed = await dependencies.checkAbuse({
          operation,
          request: request.clone(),
          requestId,
        });
        if (!allowed) return publicError("rate_limited", 429);
      } catch {
        logInternalFailure(
          { logger, now },
          { operation, category: "abuse_guard_error", requestId, mode: guard.mode },
        );
        return publicError("temporarily_unavailable", 503);
      }
    }

    const parsedInput = await parseOperationInput(operation, request);
    if (!parsedInput.ok) return publicError(parsedInput.error, parsedInput.status);

    const sourcePath = parseUrl(request.url)?.pathname ?? `/api/newsletter/${operation}`;
    try {
      if (operation === "request") {
        const requestInput = parsedInput.value as RequestNewsletterInput;
        if (
          guard.mode === "live" &&
          guard.launch === "canary" &&
          !guard.allowedRecipients.includes(normalizeEmail(requestInput.email))
        ) {
          return jsonResponse<RequestNewsletterResponse>(
            { ok: true, status: "accepted" },
            202,
          );
        }
        const service = createService();
        const result = await executeRequest(
          service,
          requestInput,
          sourcePath,
        );
        if (result.internalErrorCategory) {
          logInternalFailure(
            { logger, now },
            { operation, category: result.internalErrorCategory, requestId, mode: guard.mode },
          );
        }
        return jsonResponse(mapNewsletterRequestResult(result), 202);
      }

      if (operation === "confirm") {
        const service = createService();
        const result = await executeConfirm(service, parsedInput.value as TokenInput);
        if (result.internalErrorCategory) {
          logInternalFailure(
            { logger, now },
            { operation, category: result.internalErrorCategory, requestId, mode: guard.mode },
          );
        }
        return jsonResponse(mapNewsletterConfirmationOutcome(result.decision), 200);
      }

      let result: NewsletterUnsubscribeServiceResult;
      if (dependencies.resolveUnsubscribeToken) {
        const resolution = await dependencies.resolveUnsubscribeToken(
          (parsedInput.value as TokenInput).token,
        );
        if (resolution.status === "invalid_or_expired") {
          return jsonResponse<UnsubscribeNewsletterResponse>(
            { ok: true, status: "invalid_or_expired" },
            200,
          );
        }
        result = await executeUnsubscribe(
          createService(),
          resolution.subscriberId,
          sourcePath,
        );
      } else {
        result = await executeUnsubscribeByToken(
          createService(),
          parsedInput.value as TokenInput,
          sourcePath,
        );
      }
      return jsonResponse(mapNewsletterUnsubscribeOutcome(result.decision), 200);
    } catch (error) {
      return mapThrownError(
        error,
        { logger, now },
        { operation, requestId, mode: guard.mode },
      );
    }
  };
}
