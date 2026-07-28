import { validateAdminRequest } from "@/lib/admin-api-auth";
import {
  EVENT_IMAGE_BUCKET,
  EVENT_IMAGE_MAX_BYTES,
  assertMatchingImageSignature,
  requireEventId,
  requireUpdatedAt,
  validateEventImageBucketConfig,
  validateImageSourceUrl,
  validateOwnedObjectPath,
  validatePublicEventImageUrl,
  validateUploadIntent,
} from "@/lib/admin-event-image-upload";
import {
  EventUpdateConflictError,
  updateExistingEvent,
} from "@/lib/event-updates";
import { createSupabaseServerClient, type EventRow, type EventUpsert } from "@/lib/supabase";

function jsonError(error: string, status: number, extra?: Record<string, unknown>) {
  return Response.json({ ok: false, error, ...(extra || {}) }, { status });
}

function extensionForMime(value: unknown) {
  if (value === "image/jpeg") return "jpg";
  if (value === "image/png") return "png";
  return "webp";
}

export async function POST(request: Request) {
  const auth = validateAdminRequest(request);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  let uploadedObjectPath: string | null = null;
  let databaseUpdated = false;
  const supabase = createSupabaseServerClient();
  if (!supabase) return jsonError("Supabase no está configurado.", 500);

  async function cleanupNewObject() {
    if (!uploadedObjectPath || databaseUpdated) return null;
    const { error } = await supabase!.storage.from(EVENT_IMAGE_BUCKET).remove([uploadedObjectPath]);
    if (error) {
      console.warn("No se pudo limpiar un objeto nuevo de imagen de evento.");
      return uploadedObjectPath;
    }
    return null;
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const eventId = requireEventId(body.eventId);
    const currentUpdatedAt = requireUpdatedAt(body.currentUpdatedAt);
    const file = validateUploadIntent({
      originalFileName: `upload.${extensionForMime(body.declaredMimeType)}`,
      declaredMimeType: typeof body.declaredMimeType === "string" ? body.declaredMimeType : "",
      fileSize: typeof body.fileSize === "number" ? body.fileSize : Number.NaN,
    });
    const imageSourceUrl = validateImageSourceUrl(body.imageSourceUrl);
    uploadedObjectPath = validateOwnedObjectPath(body.objectPath, eventId, file.declaredMimeType);

    const { data: bucket, error: bucketError } = await supabase.storage.getBucket(EVENT_IMAGE_BUCKET);
    if (bucketError || !bucket) throw new Error("El almacenamiento de imágenes no está preparado.");
    validateEventImageBucketConfig(bucket);

    const slash = uploadedObjectPath.lastIndexOf("/");
    const folder = uploadedObjectPath.slice(0, slash);
    const objectName = uploadedObjectPath.slice(slash + 1);
    const { data: objects, error: listError } = await supabase.storage
      .from(EVENT_IMAGE_BUCKET)
      .list(folder, { search: objectName, limit: 2 });
    if (listError) throw new Error("No se pudo verificar el archivo subido.");
    const object = objects?.find((candidate) => candidate.name === objectName);
    if (!object) throw new Error("No se encontró el archivo recién subido.");

    const metadata = (object.metadata || {}) as Record<string, unknown>;
    const metadataSize = Number(metadata.size);
    const metadataMime = typeof metadata.mimetype === "string"
      ? metadata.mimetype
      : typeof metadata.contentType === "string"
        ? metadata.contentType
        : "";
    if (!Number.isFinite(metadataSize) || metadataSize !== file.fileSize || metadataSize > EVENT_IMAGE_MAX_BYTES) {
      throw new Error("El tamaño real del archivo no coincide con el declarado.");
    }
    if (metadataMime && metadataMime !== file.declaredMimeType) {
      throw new Error("El tipo real del archivo no coincide con el declarado.");
    }

    const { data: blob, error: downloadError } = await supabase.storage
      .from(EVENT_IMAGE_BUCKET)
      .download(uploadedObjectPath);
    if (downloadError || !blob) throw new Error("No se pudo validar el contenido del archivo.");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (bytes.byteLength !== file.fileSize) {
      throw new Error("El tamaño descargado no coincide con el declarado.");
    }
    assertMatchingImageSignature(bytes, file.declaredMimeType);

    const { data: publicData } = supabase.storage
      .from(EVENT_IMAGE_BUCKET)
      .getPublicUrl(uploadedObjectPath);
    const imageUrl = validatePublicEventImageUrl(publicData.publicUrl, uploadedObjectPath);
    const publicResponse = await fetch(imageUrl, {
      method: "HEAD",
      cache: "no-store",
    });
    if (!publicResponse.ok) {
      throw new Error("La imagen no está disponible mediante su URL pública.");
    }

    const { updated } = await updateExistingEvent<EventRow>({
      id: eventId,
      expectedUpdatedAt: currentUpdatedAt,
      changes: {
        image_url: imageUrl,
        image_source_url: imageSourceUrl,
      },
      repository: {
        async readUpdatedAt(id) {
          const { data, error } = await supabase
            .from("events")
            .select("updated_at")
            .eq("id", id)
            .maybeSingle();
          if (error) throw new Error("No se pudo comprobar el evento.");
          return data?.updated_at || null;
        },
        async updateByIdAndUpdatedAt(id, expectedUpdatedAt, changes) {
          const { data, error } = await supabase
            .from("events")
            .update(changes as Partial<EventUpsert>)
            .eq("id", id)
            .eq("updated_at", expectedUpdatedAt)
            .select("id,image_url,image_source_url,updated_at")
            .maybeSingle();
          if (error) throw new Error("No se pudo actualizar el evento.");
          return data as EventRow | null;
        },
      },
    });
    databaseUpdated = true;

    if (
      updated.image_url !== imageUrl ||
      (updated.image_source_url || null) !== imageSourceUrl
    ) {
      throw new Error("No se pudo verificar la actualización del evento.");
    }

    return Response.json({
      ok: true,
      event: {
        id: updated.id,
        image_url: updated.image_url,
        image_source_url: updated.image_source_url,
        updated_at: updated.updated_at,
      },
    });
  } catch (error) {
    const orphanObjectPath = await cleanupNewObject();
    const status = error instanceof EventUpdateConflictError ? 409 : 400;
    return jsonError(
      error instanceof Error ? error.message : "No se pudo finalizar la subida.",
      status,
      orphanObjectPath ? { cleanupWarning: true, orphanObjectPath } : undefined,
    );
  }
}
