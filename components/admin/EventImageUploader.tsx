"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

const ACCEPTED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 5 * 1024 * 1024;

type ImageInfo = {
  width: number;
  height: number;
};

type UploadStatus = "ready" | "uploading" | "verifying" | "saving" | "completed" | "error";

type UploadIntentResponse =
  | {
      ok: true;
      bucket: string;
      objectPath: string;
      signedToken: string;
      expectedMimeType: string;
    }
  | { ok: false; error: string };

type FinalizeResponse =
  | {
      ok: true;
      event: {
        id: string;
        image_url: string;
        image_source_url: string | null;
        updated_at: string;
      };
    }
  | { ok: false; error: string; cleanupWarning?: boolean };

export function imageDimensionWarnings(info: ImageInfo | null) {
  if (!info) return [];
  const warnings: string[] = [];
  const ratio = info.width / info.height;
  if (Math.abs(ratio - 16 / 9) > 0.18) {
    warnings.push("La proporción se aleja del formato recomendado 16:9.");
  }
  if (info.width < 1200 || info.height < 675) {
    warnings.push("La resolución es inferior a 1200 × 675 px.");
  }
  return warnings;
}

export function formatImageBytes(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.round(bytes / 1024)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function EventImageUploader({
  adminSecret,
  currentImageUrl,
  currentSourceUrl,
  currentUpdatedAt,
  eventId,
  onBusyChange,
  onSuccess,
}: {
  adminSecret: string;
  currentImageUrl: string;
  currentSourceUrl: string;
  currentUpdatedAt: string;
  eventId: string;
  onBusyChange?: (busy: boolean) => void;
  onSuccess: (event: {
    id: string;
    image_url: string;
    image_source_url: string | null;
    updated_at: string;
  }) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [imageInfo, setImageInfo] = useState<ImageInfo | null>(null);
  const [sourceUrl, setSourceUrl] = useState(currentSourceUrl);
  const [authorized, setAuthorized] = useState(false);
  const [status, setStatus] = useState<UploadStatus>("ready");
  const [message, setMessage] = useState("");
  const busy = status === "uploading" || status === "verifying" || status === "saving";
  const warnings = useMemo(() => imageDimensionWarnings(imageInfo), [imageInfo]);

  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    onBusyChange?.(busy);
    if (!busy) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [busy, onBusyChange]);

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] || null;
    setMessage("");
    setImageInfo(null);
    setStatus("ready");

    if (!nextFile) {
      setFile(null);
      setPreviewUrl("");
      return;
    }
    if (!ACCEPTED_MIME_TYPES.has(nextFile.type)) {
      setFile(null);
      setPreviewUrl("");
      setStatus("error");
      setMessage("Solo se permiten archivos JPG, PNG o WebP.");
      event.target.value = "";
      return;
    }
    if (!nextFile.size || nextFile.size > MAX_BYTES) {
      setFile(null);
      setPreviewUrl("");
      setStatus("error");
      setMessage(nextFile.size ? "La imagen supera el máximo de 5 MB." : "El archivo está vacío.");
      event.target.value = "";
      return;
    }
    setFile(nextFile);
    setPreviewUrl(URL.createObjectURL(nextFile));
  }

  async function uploadImage() {
    if (!file || !authorized || busy) return;
    if (
      currentImageUrl &&
      !window.confirm(
        "La ficha empezará a utilizar la nueva imagen. La anterior no se eliminará automáticamente.",
      )
    ) {
      return;
    }

    setMessage("");
    try {
      setStatus("uploading");
      const intentResponse = await fetch("/api/admin/events/image-upload-intent", {
        method: "POST",
        headers: {
          authorization: `Bearer ${adminSecret}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          eventId,
          originalFileName: file.name,
          declaredMimeType: file.type,
          fileSize: file.size,
          currentUpdatedAt,
        }),
      });
      const intent = (await intentResponse.json()) as UploadIntentResponse;
      if (!intentResponse.ok || !intent.ok) {
        throw new Error(intent.ok ? "No se pudo preparar la subida." : intent.error);
      }

      const supabase = createSupabaseBrowserClient();
      const { error: uploadError } = await supabase.storage
        .from(intent.bucket)
        .uploadToSignedUrl(intent.objectPath, intent.signedToken, file, {
          cacheControl: "31536000",
          contentType: file.type,
          upsert: false,
        });
      if (uploadError) throw new Error("No se pudo subir la imagen. Puedes volver a intentarlo.");

      setStatus("verifying");
      const finalizeResponse = await fetch("/api/admin/events/image-upload-finalize", {
        method: "POST",
        headers: {
          authorization: `Bearer ${adminSecret}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          eventId,
          objectPath: intent.objectPath,
          declaredMimeType: file.type,
          fileSize: file.size,
          imageSourceUrl: sourceUrl,
          currentUpdatedAt,
        }),
      });
      setStatus("saving");
      const finalized = (await finalizeResponse.json()) as FinalizeResponse;
      if (!finalizeResponse.ok || !finalized.ok) {
        throw new Error(finalized.ok ? "No se pudo actualizar el evento." : finalized.error);
      }

      onSuccess(finalized.event);
      setFile(null);
      setPreviewUrl("");
      setImageInfo(null);
      setSourceUrl(finalized.event.image_source_url || "");
      setAuthorized(false);
      setStatus("completed");
      setMessage("Imagen actualizada correctamente");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "No se pudo actualizar la imagen.");
    }
  }

  const statusText = status === "uploading"
    ? "Subiendo imagen…"
    : status === "verifying"
      ? "Verificando archivo…"
      : status === "saving"
        ? "Actualizando evento…"
        : message;

  return (
    <section className="mt-3 w-full min-w-0 overflow-hidden rounded-lg border border-white/[0.10] bg-white/[0.025] p-3" aria-labelledby={`event-image-${eventId}`}>
      <h5 className="text-xs font-bold uppercase tracking-wide text-zinc-200" id={`event-image-${eventId}`}>
        Imagen del evento
      </h5>

      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-zinc-400">Imagen actual</p>
          {currentImageUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="Imagen actual del evento" className="mt-2 aspect-video w-full rounded-md bg-black object-contain" src={currentImageUrl} />
              <p className="mt-1 break-all text-[10px] text-zinc-600">{currentImageUrl}</p>
            </>
          ) : (
            <div className="mt-2 flex aspect-video items-center justify-center rounded-md border border-dashed border-white/10 text-sm text-zinc-500">
              Sin imagen
            </div>
          )}
        </div>

        <div className="min-w-0 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs font-semibold text-zinc-400">
            Seleccionar archivo
            <input
              accept=".jpg,.jpeg,.png,.webp"
              className="admin-input w-full min-w-0 max-w-full overflow-hidden file:mr-3 file:rounded file:border-0 file:bg-red-600 file:px-3 file:py-1 file:text-xs file:font-bold file:text-white"
              disabled={busy}
              onChange={chooseFile}
              type="file"
            />
            <span className="text-[11px] font-medium text-zinc-500">JPG, PNG o WebP · Máximo 5 MB</span>
            <span className="text-[11px] font-medium text-zinc-500">Formato recomendado: 1600 × 900 px</span>
          </label>

          {previewUrl && file ? (
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt="Previsualización de la nueva imagen"
                className="aspect-video w-full rounded-md bg-black object-contain"
                onLoad={(event) => setImageInfo({
                  width: event.currentTarget.naturalWidth,
                  height: event.currentTarget.naturalHeight,
                })}
                src={previewUrl}
              />
              <p className="mt-1 text-xs text-zinc-400">
                {imageInfo ? `${imageInfo.width} × ${imageInfo.height} px · ` : ""}
                {formatImageBytes(file.size)} · {file.type}
              </p>
              {warnings.map((warning) => (
                <p className="mt-1 text-xs text-amber-300" key={warning}>{warning}</p>
              ))}
            </div>
          ) : null}

          <label className="flex flex-col gap-1 text-xs font-semibold text-zinc-400">
            Fuente o autor de la imagen
            <input
              className="admin-input"
              disabled={busy}
              onChange={(event) => setSourceUrl(event.target.value)}
              placeholder="https://www.instagram.com/..."
              type="url"
              value={sourceUrl}
            />
            <span className="text-[11px] font-medium text-zinc-500">
              Puedes dejarlo vacío si el organizador te la ha enviado directamente.
            </span>
          </label>

          <label className="flex items-start gap-2 text-xs leading-5 text-zinc-300">
            <input
              checked={authorized}
              className="mt-0.5 h-4 w-4"
              disabled={busy}
              onChange={(event) => setAuthorized(event.target.checked)}
              type="checkbox"
            />
            Confirmo que esta imagen ha sido facilitada o autorizada por el organizador.
          </label>

          <button
            className="min-h-10 rounded-md bg-red-600 px-4 text-sm font-bold text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-zinc-700"
            disabled={!file || !authorized || busy}
            onClick={uploadImage}
            type="button"
          >
            {busy ? statusText : currentImageUrl ? "Reemplazar imagen" : "Subir imagen"}
          </button>
          {statusText && !busy ? (
            <p className={`text-xs ${status === "error" ? "text-red-300" : "text-emerald-300"}`} role="status">
              {statusText}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
