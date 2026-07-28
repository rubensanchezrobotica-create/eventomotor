import { randomUUID } from "node:crypto";

export const EVENT_IMAGE_BUCKET = "event-images";
export const EVENT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const EVENT_IMAGE_CACHE_CONTROL = "31536000";

export const EVENT_IMAGE_MIME_EXTENSIONS = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
} as const;

export type EventImageMimeType = keyof typeof EVENT_IMAGE_MIME_EXTENSIONS;

export function validateEventImageBucketConfig(bucket: {
  public?: boolean;
  file_size_limit?: number | null;
  allowed_mime_types?: string[] | null;
}) {
  const expected = Object.keys(EVENT_IMAGE_MIME_EXTENSIONS);
  const allowed = new Set(bucket.allowed_mime_types || []);
  if (
    bucket.public !== true ||
    bucket.file_size_limit !== EVENT_IMAGE_MAX_BYTES ||
    expected.some((mime) => !allowed.has(mime)) ||
    allowed.size !== expected.length
  ) {
    throw new Error("El bucket de imágenes existe, pero su configuración no es segura.");
  }
}

type UploadIntentInput = {
  originalFileName: string;
  declaredMimeType: string;
  fileSize: number;
};

function requiredText(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} es obligatorio.`);
  }
  return value.trim();
}

export function requireEventId(value: unknown) {
  const eventId = requiredText(value, "eventId");
  if (eventId.length > 200 || !/^[a-zA-Z0-9_-]+$/.test(eventId)) {
    throw new Error("eventId no es válido.");
  }
  return eventId;
}

export function requireUpdatedAt(value: unknown) {
  const updatedAt = requiredText(value, "currentUpdatedAt");
  if (!Number.isFinite(Date.parse(updatedAt))) {
    throw new Error("currentUpdatedAt no es válido.");
  }
  return updatedAt;
}

export function validateUploadIntent(input: UploadIntentInput) {
  const originalFileName = requiredText(input.originalFileName, "originalFileName");
  const declaredMimeType = requiredText(input.declaredMimeType, "declaredMimeType");
  const extensions = EVENT_IMAGE_MIME_EXTENSIONS[declaredMimeType as EventImageMimeType];

  if (!extensions) {
    throw new Error("Solo se permiten archivos JPG, PNG o WebP.");
  }
  if (!Number.isInteger(input.fileSize) || input.fileSize <= 0) {
    throw new Error("El archivo está vacío o su tamaño no es válido.");
  }
  if (input.fileSize > EVENT_IMAGE_MAX_BYTES) {
    throw new Error("La imagen supera el máximo de 5 MB.");
  }

  const extension = originalFileName.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  if (!extension || !extensions.some((allowed) => allowed === extension)) {
    throw new Error("La extensión no coincide con el tipo de imagen.");
  }

  return {
    declaredMimeType: declaredMimeType as EventImageMimeType,
    fileSize: input.fileSize,
    extension: extensions[0],
  };
}

export function safeSlugSegment(value: string) {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "evento";
}

export function createEventImageObjectPath(input: {
  eventId: string;
  eventSlug: string | null;
  mimeType: EventImageMimeType;
  now?: Date;
  uuid?: string;
}) {
  const eventId = requireEventId(input.eventId);
  const extension = EVENT_IMAGE_MIME_EXTENSIONS[input.mimeType][0];
  const timestamp = (input.now ?? new Date()).getTime();
  const uuid = input.uuid ?? randomUUID();

  if (!/^[a-f0-9-]{36}$/i.test(uuid)) {
    throw new Error("No se pudo generar una ruta segura.");
  }

  return `events/${eventId}/${timestamp}-${uuid}-${safeSlugSegment(input.eventSlug || "evento")}.${extension}`;
}

export function validateOwnedObjectPath(
  objectPath: unknown,
  eventIdValue: unknown,
  mimeType: EventImageMimeType,
) {
  const path = requiredText(objectPath, "objectPath");
  const eventId = requireEventId(eventIdValue);
  const prefix = `events/${eventId}/`;
  const extension = EVENT_IMAGE_MIME_EXTENSIONS[mimeType][0];

  if (
    path.includes("..") ||
    path.includes("\\") ||
    path.includes("//") ||
    !path.startsWith(prefix) ||
    path.slice(prefix.length).includes("/") ||
    !new RegExp(`^[a-zA-Z0-9/_-]+\\.${extension}$`).test(path)
  ) {
    throw new Error("La ruta de Storage no es válida para este evento.");
  }

  return path;
}

export function validateImageSourceUrl(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") throw new Error("La fuente de la imagen no es válida.");

  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > 2_048) throw new Error("La URL de fuente es demasiado larga.");

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("La fuente debe ser una URL válida.");
  }

  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("La fuente debe usar HTTP o HTTPS y no incluir credenciales.");
  }
  return url.href;
}

export function detectImageMimeType(bytes: Uint8Array): EventImageMimeType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= png.length && png.every((byte, index) => bytes[index] === byte)) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export function assertMatchingImageSignature(bytes: Uint8Array, declaredMimeType: EventImageMimeType) {
  const actualMimeType = detectImageMimeType(bytes);
  if (actualMimeType !== declaredMimeType) {
    throw new Error("El contenido real del archivo no coincide con el tipo declarado.");
  }
  return actualMimeType;
}

export function validatePublicEventImageUrl(value: string, objectPath: string) {
  const url = new URL(value);
  const expectedPath = `/storage/v1/object/public/${EVENT_IMAGE_BUCKET}/${objectPath}`;
  if (url.protocol !== "https:" || !url.pathname.endsWith(expectedPath)) {
    throw new Error("Storage no devolvió una URL pública válida.");
  }
  return url.href;
}
