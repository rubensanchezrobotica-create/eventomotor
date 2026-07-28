import { validateAdminRequest } from "@/lib/admin-api-auth";
import {
  EVENT_IMAGE_BUCKET,
  EVENT_IMAGE_MAX_BYTES,
  createEventImageObjectPath,
  requireEventId,
  requireUpdatedAt,
  validateEventImageBucketConfig,
  validateUploadIntent,
} from "@/lib/admin-event-image-upload";
import { sameTimestampInstant } from "@/lib/event-updates";
import { createSupabaseServerClient } from "@/lib/supabase";

function jsonError(error: string, status: number) {
  return Response.json({ ok: false, error }, { status });
}

export async function POST(request: Request) {
  const auth = validateAdminRequest(request);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const eventId = requireEventId(body.eventId);
    const currentUpdatedAt = requireUpdatedAt(body.currentUpdatedAt);
    const file = validateUploadIntent({
      originalFileName: typeof body.originalFileName === "string" ? body.originalFileName : "",
      declaredMimeType: typeof body.declaredMimeType === "string" ? body.declaredMimeType : "",
      fileSize: typeof body.fileSize === "number" ? body.fileSize : Number.NaN,
    });
    const supabase = createSupabaseServerClient();
    if (!supabase) return jsonError("Supabase no está configurado.", 500);

    const { data: bucket, error: bucketError } = await supabase.storage.getBucket(EVENT_IMAGE_BUCKET);
    if (bucketError || !bucket) {
      return jsonError("El almacenamiento de imágenes todavía no está preparado.", 503);
    }
    validateEventImageBucketConfig(bucket);

    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id,slug,updated_at")
      .eq("id", eventId)
      .maybeSingle();
    if (eventError) return jsonError("No se pudo comprobar el evento.", 500);
    if (!event) return jsonError("El evento no existe.", 404);
    if (!sameTimestampInstant(event.updated_at, currentUpdatedAt)) {
      return jsonError("El evento cambió desde que se abrió. Recarga antes de continuar.", 409);
    }

    const objectPath = createEventImageObjectPath({
      eventId,
      eventSlug: event.slug,
      mimeType: file.declaredMimeType,
    });
    const { data: signed, error: signedError } = await supabase.storage
      .from(EVENT_IMAGE_BUCKET)
      .createSignedUploadUrl(objectPath, { upsert: false });
    if (signedError || !signed?.token) {
      return jsonError("No se pudo preparar la subida. Inténtalo de nuevo.", 500);
    }

    return Response.json({
      ok: true,
      bucket: EVENT_IMAGE_BUCKET,
      objectPath,
      signedToken: signed.token,
      expectedMimeType: file.declaredMimeType,
      maxFileSize: EVENT_IMAGE_MAX_BYTES,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Solicitud no válida.", 400);
  }
}
