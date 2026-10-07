import "server-only";

import { AdminSessionError } from "@/lib/admin-session";
import {
  assertTrustedAdminMutation,
  verifyAdminMediaSession,
} from "@/lib/admin-session.server";
import {
  StoryMediaServiceError,
  createSupabaseStoryMediaService,
} from "./story-media.server";
import {
  StoryMediaValidationError,
  assertStoryMediaByteSize,
  assertStoryMediaFilename,
  assertStoryMediaMimeType,
  assertStoryMediaUuid,
  type StoryMediaMimeType,
} from "./story-media-validation";

type StoryMediaService = ReturnType<typeof createSupabaseStoryMediaService>;
type MutationAuthorization = "AUTHORIZED" | "UNAUTHENTICATED" | "UNTRUSTED_ORIGIN";

export type StoryMediaApiDependencies = {
  authorizeMutation(): Promise<MutationAuthorization>;
  authenticateRead(): Promise<boolean>;
  service(): StoryMediaService;
};

type StoryMediaRouteContext = { params: Promise<{ mediaId: string }> };

export const defaultStoryMediaApiDependencies: StoryMediaApiDependencies = {
  async authorizeMutation() {
    if (!(await verifyAdminMediaSession())) return "UNAUTHENTICATED";
    try {
      await assertTrustedAdminMutation();
      return "AUTHORIZED";
    } catch {
      return "UNTRUSTED_ORIGIN";
    }
  },
  authenticateRead: verifyAdminMediaSession,
  service: createSupabaseStoryMediaService,
};

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function safeError(error: unknown) {
  if (
    error instanceof StoryMediaValidationError
    || error instanceof StoryMediaServiceError
    || error instanceof AdminSessionError
  ) {
    const code = error instanceof AdminSessionError ? "ADMIN_SESSION" : error.code;
    const messages: Record<string, string> = {
      INVALID_UUID: "El identificador de la operación no es válido.",
      INVALID_FILENAME: "El nombre del archivo no es válido.",
      INVALID_EXTENSION: "La extensión no coincide con el formato declarado.",
      INVALID_REQUEST: "La solicitud no es válida.",
      UNSUPPORTED_MIME_TYPE: "Solo se admiten imágenes JPEG, PNG y WebP.",
      INVALID_BYTE_SIZE: "El tamaño declarado no es válido.",
      FILE_TOO_LARGE: "La imagen supera el límite de 25 MiB.",
      SIGNATURE_MISMATCH: "El contenido no coincide con el formato declarado.",
      INVALID_IMAGE_BYTES: "La imagen está dañada o no puede validarse.",
      INVALID_DIMENSIONS: "Las dimensiones de la imagen no son válidas.",
      DIMENSIONS_TOO_LARGE: "Las dimensiones de la imagen superan el límite.",
      PIXEL_COUNT_TOO_LARGE: "La imagen contiene demasiados píxeles.",
      INVALID_OBJECT_PATH: "La ruta de la imagen no es válida.",
      STORY_NOT_FOUND: "La historia no existe.",
      STORY_NOT_EDITABLE: "La historia ya no admite cambios de media.",
      MEDIA_NOT_FOUND: "La imagen no existe.",
      MEDIA_OWNERSHIP_MISMATCH: "La imagen no pertenece a esta historia.",
      MEDIA_STATE_CONFLICT: "La imagen ha cambiado o no está en el estado esperado.",
      BUCKET_MISCONFIGURED: "El almacenamiento editorial no está disponible.",
      PUBLIC_ASSET_CONFLICT: "Existe una copia pública diferente; se requiere revisión.",
      PROMOTION_UPDATE_FAILED: "No se pudo completar la preparación pública.",
      ADMIN_SESSION: "La sesión administrativa no es válida.",
    };
    const message = error instanceof StoryMediaServiceError
      && error.code === "PROMOTION_UPDATE_FAILED"
      && error.cleanupStatus === "PENDING"
      ? "La copia pública requiere revisión antes de reintentar."
      : messages[code] ?? "La operación de media no pudo completarse.";
    return json({
      ok: false,
      error: code,
      message,
      ...(error instanceof StoryMediaServiceError && error.cleanupStatus
        ? { cleanupStatus: error.cleanupStatus }
        : {}),
    }, 400);
  }
  return json({ ok: false, error: "UNEXPECTED", message: "La operación de media no pudo completarse." }, 500);
}

async function parseBody(request: Request) {
  const length = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(length) && length > 16_384) {
    throw new StoryMediaValidationError("INVALID_REQUEST", "Request body is too large.");
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new StoryMediaValidationError("INVALID_REQUEST", "Request body is invalid JSON.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new StoryMediaValidationError("INVALID_REQUEST", "Request body is invalid.");
  }
  return body as Record<string, unknown>;
}

async function requireMutation(dependencies: StoryMediaApiDependencies) {
  const result = await dependencies.authorizeMutation();
  if (result === "UNAUTHENTICATED") return json({ ok: false, error: result }, 401);
  if (result === "UNTRUSTED_ORIGIN") return json({ ok: false, error: result }, 403);
  return null;
}

function uploadContract(body: Record<string, unknown>) {
  assertStoryMediaUuid(body.storyId, "storyId");
  assertStoryMediaUuid(body.operationId, "operationId");
  assertStoryMediaMimeType(body.declaredMime);
  assertStoryMediaByteSize(body.byteSize);
  assertStoryMediaFilename(body.filename, body.declaredMime);
  return {
    storyId: body.storyId,
    operationId: body.operationId,
    mimeType: body.declaredMime as StoryMediaMimeType,
    byteSize: body.byteSize,
  };
}

export function createUploadIntentHandler(
  dependencies: StoryMediaApiDependencies = defaultStoryMediaApiDependencies,
) {
  return async function POST(request: Request) {
    const denied = await requireMutation(dependencies);
    if (denied) return denied;
    try {
      const input = uploadContract(await parseBody(request));
      const intent = await dependencies.service().createUploadIntent(input);
      return json({ ok: true, intent: { operationId: input.operationId, ...intent } });
    } catch (error) {
      return safeError(error);
    }
  };
}

export function createUploadFinalizeHandler(
  dependencies: StoryMediaApiDependencies = defaultStoryMediaApiDependencies,
) {
  return async function POST(request: Request) {
    const denied = await requireMutation(dependencies);
    if (denied) return denied;
    try {
      const input = uploadContract(await parseBody(request));
      const finalized = await dependencies.service().finalizeUpload({
        storyId: input.storyId,
        mediaId: input.operationId,
        mimeType: input.mimeType,
        byteSize: input.byteSize,
      });
      return json({ ok: true, finalized });
    } catch (error) {
      return safeError(error);
    }
  };
}

export function createPreviewUrlHandler(
  dependencies: StoryMediaApiDependencies = defaultStoryMediaApiDependencies,
) {
  return async function GET(request: Request, context: StoryMediaRouteContext) {
    if (!(await dependencies.authenticateRead())) {
      return json({ ok: false, error: "UNAUTHENTICATED" }, 401);
    }
    try {
      const url = new URL(request.url);
      const storyId = url.searchParams.get("storyId");
      const { mediaId } = await context.params;
      assertStoryMediaUuid(storyId, "storyId");
      assertStoryMediaUuid(mediaId, "mediaId");
      const preview = await dependencies.service().createAdminMediaUrl({ storyId, mediaId });
      return json({ ok: true, preview });
    } catch (error) {
      return safeError(error);
    }
  };
}

export function createPromoteHandler(
  dependencies: StoryMediaApiDependencies = defaultStoryMediaApiDependencies,
) {
  return async function POST(request: Request, context: StoryMediaRouteContext) {
    const denied = await requireMutation(dependencies);
    if (denied) return denied;
    try {
      const body = await parseBody(request);
      const { mediaId } = await context.params;
      assertStoryMediaUuid(body.storyId, "storyId");
      assertStoryMediaUuid(mediaId, "mediaId");
      if (typeof body.expectedUpdatedAt !== "string" || Number.isNaN(Date.parse(body.expectedUpdatedAt))) {
        throw new StoryMediaValidationError("INVALID_REQUEST", "Media version is invalid.");
      }
      const service = dependencies.service();
      const promotion = await service.promote({
        storyId: body.storyId,
        mediaId,
        expectedUpdatedAt: body.expectedUpdatedAt,
        requirePublicationMetadata: true,
      });
      const readiness = await service.publicationReadiness(body.storyId);
      return json({ ok: true, promotion, readiness });
    } catch (error) {
      return safeError(error);
    }
  };
}
