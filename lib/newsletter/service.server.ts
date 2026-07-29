import "server-only";

import { isNewsletterProvinceSlug } from "@/lib/newsletter/audience";
import {
  createOpaqueNewsletterToken,
  hashNewsletterToken,
} from "@/lib/newsletter/crypto.server";
import {
  NullNewsletterMailTransport,
  type NewsletterMailTransport,
} from "@/lib/newsletter/mail-transport.server";
import { createConfiguredNewsletterMailRuntime } from "@/lib/newsletter/mail-transport-config.server";
import { createConfiguredNewsletterRepository } from "@/lib/newsletter/repository.server";
import {
  isValidEmail,
  isValidNewsletterOpaqueToken,
  isNewsletterProviderEventType,
  normalizeEmail,
} from "@/lib/newsletter/schemas";
import {
  NEWSLETTER_PUBLIC_MUTATION_RESPONSE,
  NewsletterOperationError,
  type NewsletterConfirmInput,
  type NewsletterConfirmServiceResult,
  type NewsletterMailCommand,
  type NewsletterMailStatus,
  type NewsletterProviderEventInput,
  type NewsletterProviderEventServiceResult,
  type NewsletterRepository,
  type NewsletterRequestInput,
  type NewsletterRequestServiceResult,
  type NewsletterService,
  type NewsletterTokenUnsubscribeInput,
  type NewsletterUnsubscribeInput,
  type NewsletterUnsubscribeServiceResult,
} from "@/lib/newsletter/service-types";
import type { NewsletterMode } from "@/lib/newsletter/types";

const TOKEN_LIFETIME_MS = 24 * 60 * 60 * 1000;
const HASH_PATTERN = /^[0-9a-f]{64}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LANGUAGE_PATTERN = /^[a-z]{2}(-[A-Z]{2})?$/;
const COUNTRY_PATTERN = /^[A-Z]{2}$/;
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

type NewsletterServiceDependencies = {
  mode: NewsletterMode;
  repository?: NewsletterRepository | null;
  mailTransport?: NewsletterMailTransport;
  now?: () => Date;
  tokenFactory?: () => string;
  tokenHasher?: (token: string) => string;
};

function invalidInput(): never {
  throw new NewsletterOperationError("validation_error", "invalid_input");
}

function assertLength(value: string, minimum: number, maximum: number): void {
  if (value.length < minimum || value.length > maximum) invalidInput();
}

function optionalLength(value: string | null | undefined, maximum: number): string | null {
  if (value === undefined || value === null) return null;
  if (value.length > maximum) invalidInput();
  return value;
}

function validateSourcePath(value: string | null | undefined): string | null {
  const normalized = optionalLength(value, 240);
  if (normalized !== null && !normalized.startsWith("/")) invalidInput();
  return normalized;
}

function validateSlug(value: string | null | undefined): string | null {
  const normalized = optionalLength(value, 100);
  if (normalized !== null && !SLUG_PATTERN.test(normalized)) invalidInput();
  return normalized;
}

function validateHash(value: string | null | undefined): string | null {
  const normalized = optionalLength(value, 64);
  if (normalized !== null && !HASH_PATTERN.test(normalized)) invalidInput();
  return normalized;
}

function validateUuid(value: string): string {
  if (!UUID_PATTERN.test(value)) invalidInput();
  return value;
}

function validateDate(value: string): string {
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) invalidInput();
  return new Date(milliseconds).toISOString();
}

async function dispatchMail(
  transport: NewsletterMailTransport,
  command: NewsletterMailCommand,
): Promise<{
  status: NewsletterMailStatus;
  failed: boolean;
  providerMessageId: string | null;
}> {
  let result: Awaited<ReturnType<NewsletterMailTransport["send"]>>;
  try {
    result = await transport.send(command);
  } catch {
    return { status: "failed", failed: true, providerMessageId: null };
  }
  if (result.status === "skipped") {
    throw new NewsletterOperationError("configuration_error", "mail_transport_unavailable");
  }
  return {
    status: "accepted",
    failed: false,
    providerMessageId:
      "providerMessageId" in result ? result.providerMessageId ?? null : null,
  };
}

export function createNewsletterService(dependencies: NewsletterServiceDependencies): NewsletterService {
  const repository = dependencies.repository ?? null;
  const mailTransport = dependencies.mailTransport ?? new NullNewsletterMailTransport();
  const now = dependencies.now ?? (() => new Date());
  const tokenFactory = dependencies.tokenFactory ?? createOpaqueNewsletterToken;
  const tokenHasher = dependencies.tokenHasher ?? hashNewsletterToken;

  function requirePersistence(): NewsletterRepository {
    if (dependencies.mode !== "test" && dependencies.mode !== "live") {
      throw new NewsletterOperationError("configuration_error", "mutations_disabled");
    }
    if (!repository) {
      throw new NewsletterOperationError("configuration_error", "persistence_unavailable");
    }
    return repository;
  }

  function requireMailTransport(): NewsletterMailTransport {
    if (mailTransport.availability !== "ready") {
      throw new NewsletterOperationError("configuration_error", "mail_transport_unavailable");
    }
    return mailTransport;
  }

  return {
    async requestSubscription(input: NewsletterRequestInput): Promise<NewsletterRequestServiceResult> {
      const persistence = requirePersistence();
      const readyMailTransport = requireMailTransport();
      if (!isValidEmail(input.email)) invalidInput();
      const emailNormalized = normalizeEmail(input.email);
      assertLength(input.source, 1, 100);
      assertLength(input.consentVersion, 1, 100);

      const languageCode = input.languageCode ?? "es";
      const countryCode = input.countryCode ?? "ES";
      if (!LANGUAGE_PATTERN.test(languageCode) || !COUNTRY_PATTERN.test(countryCode)) invalidInput();

      const sourcePath = validateSourcePath(input.sourcePath);
      const sourceDetail = optionalLength(input.sourceDetail, 100);
      const provinceSlug = validateSlug(input.provinceSlug);
      const regionSlug = validateSlug(input.regionSlug);
      const ipHash = validateHash(input.ipHash);

      const rawToken = tokenFactory();
      if (!isValidNewsletterOpaqueToken(rawToken)) {
        throw new NewsletterOperationError("token_error", "invalid_token");
      }
      const tokenHash = tokenHasher(rawToken);
      if (!HASH_PATTERN.test(tokenHash)) {
        throw new NewsletterOperationError("token_error", "invalid_token");
      }

      const expiresAt = new Date(now().getTime() + TOKEN_LIFETIME_MS).toISOString();
      const result = await persistence.requestSubscription({
        email: input.email.trim(),
        emailNormalized,
        tokenHash,
        tokenExpiresAt: expiresAt,
        source: input.source,
        consentVersion: input.consentVersion,
        sourcePath,
        sourceDetail,
        languageCode,
        countryCode,
        provinceSlug,
        regionSlug,
        ipHash,
      });

      if (result.outcome !== "confirmation_required") {
        return {
          publicResponse: NEWSLETTER_PUBLIC_MUTATION_RESPONSE,
          decision: result.outcome,
          mailStatus: "not_required",
          ...(result.outcome === "blocked" ? { internalErrorCategory: "blocked_state" as const } : {}),
          ...(result.outcome === "cooldown" || result.outcome === "daily_limit"
            ? { internalErrorCategory: "cooldown" as const }
            : {}),
        };
      }

      if (!result.subscriberId || !result.tokenPurpose) {
        throw new NewsletterOperationError("persistence_error", "rpc_contract_violation");
      }
      if (
        dependencies.mode === "live" &&
        (
          !persistence.checkDeliveryEligibility ||
          await persistence.checkDeliveryEligibility(
            result.subscriberId,
            "confirmation",
          ) !== "allowed"
        )
      ) {
        return {
          publicResponse: NEWSLETTER_PUBLIC_MUTATION_RESPONSE,
          decision: result.outcome,
          mailStatus: "failed",
          internalErrorCategory: "blocked_state",
        };
      }
      const mail = await dispatchMail(readyMailTransport, {
        kind: "confirmation",
        recipientEmail: emailNormalized,
        rawConfirmationToken: rawToken,
        purpose: result.tokenPurpose,
        expiresAt,
      });
      if (
        !mail.failed &&
        mail.providerMessageId &&
        dependencies.mode === "live"
      ) {
        if (!persistence.registerOutboundDelivery) {
          return {
            publicResponse: NEWSLETTER_PUBLIC_MUTATION_RESPONSE,
            decision: result.outcome,
            mailStatus: "failed",
            internalErrorCategory: "provider_error",
          };
        }
        try {
          await persistence.registerOutboundDelivery({
            subscriberId: result.subscriberId,
            providerMessageId: mail.providerMessageId,
            deliveryKind: "confirmation",
            occurredAt: now().toISOString(),
          });
        } catch {
          return {
            publicResponse: NEWSLETTER_PUBLIC_MUTATION_RESPONSE,
            decision: result.outcome,
            mailStatus: "failed",
            internalErrorCategory: "provider_error",
          };
        }
      }
      return {
        publicResponse: NEWSLETTER_PUBLIC_MUTATION_RESPONSE,
        decision: result.outcome,
        mailStatus: mail.status,
        ...(mail.failed ? { internalErrorCategory: "provider_error" as const } : {}),
      };
    },

    async confirmSubscription(input: NewsletterConfirmInput): Promise<NewsletterConfirmServiceResult> {
      const persistence = requirePersistence();
      const readyMailTransport = requireMailTransport();
      if (!isValidNewsletterOpaqueToken(input.token)) {
        throw new NewsletterOperationError("token_error", "invalid_token");
      }
      const tokenHash = tokenHasher(input.token);
      if (!HASH_PATTERN.test(tokenHash)) {
        throw new NewsletterOperationError("token_error", "invalid_token");
      }
      const result = await persistence.confirmSubscription(tokenHash);
      if (result.outcome !== "confirmed") {
        return {
          publicResponse: NEWSLETTER_PUBLIC_MUTATION_RESPONSE,
          decision: result.outcome,
          mailStatus: "not_required",
          ...(result.outcome === "blocked" ? { internalErrorCategory: "blocked_state" as const } : {}),
        };
      }
      if (!result.subscriberId) {
        throw new NewsletterOperationError("persistence_error", "rpc_contract_violation");
      }

      let rawUnsubscribeToken: string;
      let welcomeContext: Awaited<ReturnType<NewsletterRepository["prepareWelcomeDelivery"]>>;
      try {
        rawUnsubscribeToken = tokenFactory();
        if (!isValidNewsletterOpaqueToken(rawUnsubscribeToken)) {
          throw new NewsletterOperationError("token_error", "invalid_token");
        }
        const unsubscribeTokenHash = tokenHasher(rawUnsubscribeToken);
        if (!HASH_PATTERN.test(unsubscribeTokenHash)) {
          throw new NewsletterOperationError("token_error", "invalid_token");
        }
        welcomeContext = await persistence.prepareWelcomeDelivery({
          subscriberId: result.subscriberId,
          tokenHash: unsubscribeTokenHash,
          expiresAt: null,
        });
        if (
          welcomeContext.subscriberId !== result.subscriberId ||
          !isValidEmail(welcomeContext.recipientEmail) ||
          (
            welcomeContext.provinceSlug !== null &&
            !isNewsletterProvinceSlug(welcomeContext.provinceSlug)
          )
        ) {
          throw new NewsletterOperationError("persistence_error", "rpc_contract_violation");
        }
      } catch {
        return {
          publicResponse: NEWSLETTER_PUBLIC_MUTATION_RESPONSE,
          decision: result.outcome,
          mailStatus: "failed",
          internalErrorCategory: "persistence_error",
        };
      }

      if (
        dependencies.mode === "live" &&
        (
          !persistence.checkDeliveryEligibility ||
          await persistence.checkDeliveryEligibility(
            result.subscriberId,
            "welcome",
          ) !== "allowed"
        )
      ) {
        return {
          publicResponse: NEWSLETTER_PUBLIC_MUTATION_RESPONSE,
          decision: result.outcome,
          mailStatus: "failed",
          internalErrorCategory: "blocked_state",
        };
      }

      const mail = await dispatchMail(readyMailTransport, {
        kind: "welcome",
        recipientEmail: welcomeContext.recipientEmail,
        rawUnsubscribeToken,
        provinceSlug: welcomeContext.provinceSlug,
        regionSlug: welcomeContext.regionSlug,
        locale: welcomeContext.locale,
      });
      if (
        !mail.failed &&
        mail.providerMessageId &&
        dependencies.mode === "live"
      ) {
        if (!persistence.registerOutboundDelivery) {
          return {
            publicResponse: NEWSLETTER_PUBLIC_MUTATION_RESPONSE,
            decision: result.outcome,
            mailStatus: "failed",
            internalErrorCategory: "provider_error",
          };
        }
        try {
          await persistence.registerOutboundDelivery({
            subscriberId: result.subscriberId,
            providerMessageId: mail.providerMessageId,
            deliveryKind: "welcome",
            occurredAt: now().toISOString(),
          });
        } catch {
          return {
            publicResponse: NEWSLETTER_PUBLIC_MUTATION_RESPONSE,
            decision: result.outcome,
            mailStatus: "failed",
            internalErrorCategory: "provider_error",
          };
        }
      }
      return {
        publicResponse: NEWSLETTER_PUBLIC_MUTATION_RESPONSE,
        decision: result.outcome,
        mailStatus: mail.status,
        ...(mail.failed ? { internalErrorCategory: "provider_error" as const } : {}),
      };
    },

    async unsubscribeSubscriber(
      input: NewsletterUnsubscribeInput,
    ): Promise<NewsletterUnsubscribeServiceResult> {
      const persistence = requirePersistence();
      assertLength(input.source, 1, 100);
      assertLength(input.consentVersion, 1, 100);
      const decision = await persistence.unsubscribeSubscriber({
        subscriberId: validateUuid(input.subscriberId),
        source: input.source,
        consentVersion: input.consentVersion,
        sourcePath: validateSourcePath(input.sourcePath),
        ipHash: validateHash(input.ipHash),
      });
      return { publicResponse: NEWSLETTER_PUBLIC_MUTATION_RESPONSE, decision };
    },

    async unsubscribeByToken(
      input: NewsletterTokenUnsubscribeInput,
    ): Promise<NewsletterUnsubscribeServiceResult> {
      const persistence = requirePersistence();
      if (!isValidNewsletterOpaqueToken(input.token)) {
        throw new NewsletterOperationError("token_error", "invalid_token");
      }
      const tokenHash = tokenHasher(input.token);
      if (!HASH_PATTERN.test(tokenHash)) {
        throw new NewsletterOperationError("token_error", "invalid_token");
      }
      assertLength(input.source, 1, 100);
      assertLength(input.consentVersion, 1, 100);
      const decision = await persistence.unsubscribeByToken({
        tokenHash,
        source: input.source,
        consentVersion: input.consentVersion,
        sourcePath: validateSourcePath(input.sourcePath),
        ipHash: validateHash(input.ipHash),
      });
      return { publicResponse: NEWSLETTER_PUBLIC_MUTATION_RESPONSE, decision };
    },

    async recordProviderEvent(
      input: NewsletterProviderEventInput,
    ): Promise<NewsletterProviderEventServiceResult> {
      const persistence = requirePersistence();
      assertLength(input.provider, 1, 60);
      assertLength(input.providerEventId, 1, 200);
      if (input.providerMessageId !== undefined && input.providerMessageId !== null) {
        assertLength(input.providerMessageId, 1, 200);
      }
      if (!isNewsletterProviderEventType(input.eventType)) invalidInput();
      if (input.isPermanent && input.eventType !== "bounced") invalidInput();
      const decision = await persistence.recordProviderEvent({
        provider: input.provider,
        providerEventId: input.providerEventId,
        providerMessageId: input.providerMessageId ?? null,
        subscriberId: input.subscriberId ? validateUuid(input.subscriberId) : null,
        eventType: input.eventType,
        isPermanent: input.isPermanent,
        occurredAt: validateDate(input.occurredAt),
      });
      return { decision };
    },
  };
}

export function createConfiguredNewsletterService(): NewsletterService {
  const mailRuntime = createConfiguredNewsletterMailRuntime();
  return createNewsletterService({
    mode: mailRuntime.serviceMode,
    repository: createConfiguredNewsletterRepository(),
    mailTransport: mailRuntime.transport,
  });
}
