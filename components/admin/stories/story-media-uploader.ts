import {
  STORY_MEDIA_ALLOWED_MIME_TYPES,
  STORY_MEDIA_MAX_UPLOAD_BYTES,
  type StoryMediaMimeType,
} from "@/lib/stories/story-media-validation";

export const STORY_MEDIA_UPLOAD_BATCH_LIMIT = 20;
export const STORY_MEDIA_UPLOAD_CONCURRENCY = 3;

export type StoryMediaQueueStatus =
  | "PENDING"
  | "SIGNING"
  | "UPLOADING"
  | "FINALIZING"
  | "COMPLETE"
  | "ERROR";

export type StoryMediaReadiness = {
  ready: boolean;
  publicationErrors: readonly unknown[];
  storageIssues: readonly unknown[];
};

export function storyMediaQueueStatusLabel(status: StoryMediaQueueStatus) {
  return {
    PENDING: "PENDIENTE",
    SIGNING: "OBTENIENDO PERMISO",
    UPLOADING: "SUBIENDO",
    FINALIZING: "VALIDANDO",
    COMPLETE: "LISTA",
    ERROR: "ERROR",
  }[status];
}

export function validateStoryMediaFile(file: Pick<File, "name" | "type" | "size">) {
  if (!STORY_MEDIA_ALLOWED_MIME_TYPES.includes(file.type as StoryMediaMimeType)) {
    return "Solo se admiten JPEG, PNG y WebP.";
  }
  if (!Number.isSafeInteger(file.size) || file.size <= 0 || file.size > STORY_MEDIA_MAX_UPLOAD_BYTES) {
    return "Cada imagen debe pesar entre 1 byte y 25 MiB.";
  }
  const extension = file.name.split(".").pop()?.toLowerCase();
  const allowed = file.type === "image/jpeg" ? ["jpg", "jpeg"] : [file.type.split("/")[1]];
  if (!extension || !allowed.includes(extension)) {
    return "La extensión no coincide con el tipo de imagen.";
  }
  return null;
}

export function validateStoryMediaBatch(files: readonly Pick<File, "name" | "type" | "size">[]) {
  if (!files.length) return "Selecciona al menos una imagen.";
  if (files.length > STORY_MEDIA_UPLOAD_BATCH_LIMIT) {
    return `Cada lote admite como máximo ${STORY_MEDIA_UPLOAD_BATCH_LIMIT} imágenes.`;
  }
  return files.map(validateStoryMediaFile).find(Boolean) ?? null;
}

export function retryableStoryMediaQueueItems<
  T extends { status: StoryMediaQueueStatus },
>(items: readonly T[]) {
  return items.filter(({ status }) => status === "PENDING" || status === "ERROR");
}

export function storyMediaReadinessMessage(
  readiness: StoryMediaReadiness | null | undefined,
) {
  if (readiness === undefined) return "";
  if (readiness === null) {
    return "El estado de publicación no se pudo confirmar; actualiza antes de publicar.";
  }
  return readiness.ready
    ? "La historia supera el gate de media para publicación."
    : `La historia sigue bloqueada: ${readiness.publicationErrors.length} errores editoriales y ${readiness.storageIssues.length} incidencias de Storage.`;
}

export function storyMediaBadge(
  bucketId: string,
  readiness: StoryMediaReadiness | null | undefined,
) {
  if (bucketId !== "story-media") return "DRAFT";
  return readiness?.ready ? "PUBLIC ASSET READY" : "PUBLIC";
}

export async function runStoryMediaQueue<T>(
  items: readonly T[],
  worker: (item: T) => Promise<void>,
  concurrency = STORY_MEDIA_UPLOAD_CONCURRENCY,
) {
  let nextIndex = 0;
  async function run() {
    while (nextIndex < items.length) {
      const item = items[nextIndex];
      nextIndex += 1;
      try {
        await worker(item);
      } catch {
        // The item owns its error state; one failure must not cancel the batch.
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
}
