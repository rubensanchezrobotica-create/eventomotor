"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { StoryMediaRow } from "@/lib/supabase";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { updateStoryMediaMetadataAction } from "@/app/admin/historias/actions";
import {
  retryableStoryMediaQueueItems,
  runStoryMediaQueue,
  storyMediaBadge,
  storyMediaQueueStatusLabel,
  storyMediaReadinessMessage,
  validateStoryMediaBatch,
  type StoryMediaReadiness,
  type StoryMediaQueueStatus,
} from "./story-media-uploader";
import styles from "./StoryMediaUploader.module.css";

type QueueItem = {
  operationId: string;
  file: File;
  status: StoryMediaQueueStatus;
  error?: string;
};

type MetadataDraft = {
  altText: string;
  caption: string;
  credit: string;
  rightsType: string;
  rightsNotes: string;
  updatedAt: string;
  saving?: boolean;
  message?: string;
};

type PreviewState = { url: string; private: boolean };

function metadataFromRow(item: StoryMediaRow): MetadataDraft {
  return {
    altText: item.alt_text,
    caption: item.caption ?? "",
    credit: item.credit ?? "",
    rightsType: item.rights_type,
    rightsNotes: item.rights_notes ?? "",
    updatedAt: item.updated_at,
  };
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", credentials: "same-origin", ...init });
  const result = await response.json() as T & { ok?: boolean; message?: string };
  if (!response.ok || result.ok === false) throw new Error(result.message || "Operación rechazada.");
  return result;
}

function body(value: unknown) {
  return { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) };
}

export default function StoryMediaUploader({
  storyId,
  media,
  editable,
}: {
  storyId: string;
  media: StoryMediaRow[];
  editable: boolean;
}) {
  const router = useRouter();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [batchError, setBatchError] = useState("");
  const [running, setRunning] = useState(false);
  const [previews, setPreviews] = useState<Record<string, PreviewState>>({});
  const [readiness, setReadiness] = useState<StoryMediaReadiness | null>();
  const [metadata, setMetadata] = useState<Record<string, MetadataDraft>>(() => Object.fromEntries(
    media.map((item) => [item.id, metadataFromRow(item)]),
  ));

  useEffect(() => {
    let cancelled = false;
    void Promise.all(media.map(async (item) => {
      try {
        const result = await requestJson<{ ok: true; preview: { url: string; private: boolean } }>(
          `/api/admin/stories/media/${encodeURIComponent(item.id)}/preview-url?storyId=${encodeURIComponent(storyId)}`,
        );
        if (!cancelled) setPreviews((current) => ({ ...current, [item.id]: result.preview }));
      } catch {
        // A missing thumbnail remains an explicit unavailable preview in the editor.
      }
    }));
    return () => { cancelled = true; };
  }, [media, storyId]);

  const completeCount = useMemo(
    () => queue.filter(({ status }) => status === "COMPLETE").length,
    [queue],
  );

  function updateQueue(operationId: string, update: Partial<QueueItem>) {
    setQueue((current) => current.map((item) => item.operationId === operationId ? { ...item, ...update } : item));
  }

  function chooseFiles(files: FileList | null) {
    const selected = files ? Array.from(files) : [];
    const error = validateStoryMediaBatch(selected);
    setBatchError(error ?? "");
    if (error) return;
    setQueue(selected.map((file) => ({
      operationId: crypto.randomUUID(),
      file,
      status: "PENDING",
    })));
  }

  async function processItem(item: QueueItem) {
    const contract = {
      storyId,
      operationId: item.operationId,
      filename: item.file.name,
      declaredMime: item.file.type,
      byteSize: item.file.size,
    };
    try {
      updateQueue(item.operationId, { status: "SIGNING", error: undefined });
      const signed = await requestJson<{
        ok: true;
        intent: {
          bucketId: string;
          objectPath: string;
          signedToken: string | null;
          alreadyFinalized: boolean;
        };
      }>("/api/admin/stories/media/upload-intent", body(contract));
      if (!signed.intent.alreadyFinalized) {
        if (!signed.intent.signedToken) throw new Error("Firma de subida ausente.");
        updateQueue(item.operationId, { status: "UPLOADING" });
        const supabase = createSupabaseBrowserClient();
        const { error } = await supabase.storage
          .from(signed.intent.bucketId)
          .uploadToSignedUrl(signed.intent.objectPath, signed.intent.signedToken, item.file, {
            contentType: item.file.type,
            upsert: false,
          });
        if (error) throw new Error("Storage rechazó la subida privada.");
        updateQueue(item.operationId, { status: "FINALIZING" });
        await requestJson("/api/admin/stories/media/upload-finalize", body(contract));
      }
      updateQueue(item.operationId, { status: "COMPLETE" });
      router.refresh();
    } catch (error) {
      updateQueue(item.operationId, {
        status: "ERROR",
        error: error instanceof Error ? error.message : "La imagen no pudo subirse.",
      });
      throw error;
    }
  }

  async function runQueue(items = retryableStoryMediaQueueItems(queue)) {
    if (!items.length || running) return;
    setRunning(true);
    await runStoryMediaQueue(items, processItem);
    setRunning(false);
  }

  function patchMetadata(mediaId: string, update: Partial<MetadataDraft>) {
    const fallback = media.find(({ id }) => id === mediaId);
    setMetadata((current) => ({
      ...current,
      [mediaId]: { ...(current[mediaId] ?? (fallback ? metadataFromRow(fallback) : null)), ...update } as MetadataDraft,
    }));
  }

  async function saveMetadata(mediaId: string) {
    const item = media.find(({ id }) => id === mediaId);
    const draft = metadata[mediaId] ?? (item ? metadataFromRow(item) : null);
    if (!draft) return;
    patchMetadata(mediaId, { saving: true, message: "" });
    const result = await updateStoryMediaMetadataAction({
      storyId,
      mediaId,
      expectedUpdatedAt: draft.updatedAt,
      altText: draft.altText,
      caption: draft.caption,
      credit: draft.credit,
      rightsType: draft.rightsType,
      rightsNotes: draft.rightsNotes,
    });
    if (!result.ok) {
      patchMetadata(mediaId, { saving: false, message: result.message });
      if (result.code === "story_version_conflict") {
        setReadiness(null);
        router.refresh();
      }
      return;
    }
    patchMetadata(mediaId, {
      saving: false,
      message: "Metadatos guardados.",
      updatedAt: result.media.updated_at,
    });
    setReadiness(result.readiness);
    router.refresh();
  }

  async function promote(mediaId: string) {
    const item = media.find(({ id }) => id === mediaId);
    const draft = metadata[mediaId] ?? (item ? metadataFromRow(item) : null);
    if (!draft) return;
    patchMetadata(mediaId, { saving: true, message: "" });
    try {
      const result = await requestJson<{
        ok: true;
        promotion: { media: StoryMediaRow };
        readiness: { ready: boolean; publicationErrors: unknown[]; storageIssues: unknown[] };
      }>(`/api/admin/stories/media/${encodeURIComponent(mediaId)}/promote`, body({
        storyId,
        expectedUpdatedAt: draft.updatedAt,
      }));
      patchMetadata(mediaId, {
        saving: false,
        message: "Derivado público generado.",
        updatedAt: result.promotion.media.updated_at,
      });
      setReadiness(result.readiness);
      router.refresh();
    } catch (error) {
      patchMetadata(mediaId, {
        saving: false,
        message: error instanceof Error ? error.message : "No se pudo promocionar.",
      });
    }
  }

  return (
    <div className={styles.stack}>
      {editable ? (
        <div className={styles.uploadPanel}>
          <label>
            Seleccionar imágenes (máximo 20)
            <input
              accept="image/jpeg,image/png,image/webp"
              multiple
              type="file"
              onChange={(event) => chooseFiles(event.target.files)}
            />
          </label>
          {batchError ? <p className={styles.error}>{batchError}</p> : null}
          {queue.length ? (
            <>
              <ul className={styles.queue}>
                {queue.map((item) => (
                  <li key={item.operationId}>
                    <span>{item.file.name}</span>
                    <strong>{storyMediaQueueStatusLabel(item.status)}</strong>
                    {item.error ? <span className={styles.error}>{item.error}</span> : null}
                  </li>
                ))}
              </ul>
              <button disabled={running} type="button" onClick={() => void runQueue()}>
                {running ? "Subiendo…" : `Subir cola (${completeCount}/${queue.length})`}
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      <div className={styles.mediaGrid}>
        {media.map((item) => {
          const draft = metadata[item.id] ?? metadataFromRow(item);
          const preview = previews[item.id];
          const promotable = Boolean(draft?.altText.trim() && draft.rightsType !== "UNKNOWN");
          return (
            <article className={styles.mediaCard} key={item.id}>
              <div className={styles.imageFrame}>
                {preview ? (
                  /* Signed draft URLs are intentionally short-lived and must not be persisted or proxied. */
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt={draft?.altText || "Preview privada pendiente de texto alternativo"}
                    height={item.height}
                    loading="lazy"
                    src={preview.url}
                    width={item.width}
                  />
                ) : <span>Preview no disponible</span>}
                <span className={styles.badge}>{storyMediaBadge(item.bucket_id, readiness)}</span>
              </div>
              {draft ? (
                <div className={styles.fields}>
                  <label>Texto alternativo
                    <input disabled={!editable} maxLength={500} value={draft.altText} onChange={(event) => patchMetadata(item.id, { altText: event.target.value })} />
                  </label>
                  <label>Pie de foto
                    <textarea disabled={!editable} maxLength={2000} rows={2} value={draft.caption} onChange={(event) => patchMetadata(item.id, { caption: event.target.value })} />
                  </label>
                  <label>Crédito
                    <input disabled={!editable} maxLength={500} value={draft.credit} onChange={(event) => patchMetadata(item.id, { credit: event.target.value })} />
                  </label>
                  <p className={styles.details}>El crédito específico es opcional; la vista pública podrá usar el crédito PHOTO de la historia.</p>
                  <label>Derechos
                    <select disabled={!editable} value={draft.rightsType} onChange={(event) => patchMetadata(item.id, { rightsType: event.target.value })}>
                      <option value="UNKNOWN">UNKNOWN</option><option value="OWN">OWN</option>
                      <option value="EVENTOMOTOR_COLLABORATOR">EVENTOMOTOR_COLLABORATOR</option>
                      <option value="PRESS_PROVIDED">PRESS_PROVIDED</option>
                      <option value="LICENSED">LICENSED</option><option value="PUBLIC_DOMAIN">PUBLIC_DOMAIN</option>
                    </select>
                  </label>
                  <label>Notas de derechos
                    <textarea disabled={!editable} maxLength={2000} rows={2} value={draft.rightsNotes} onChange={(event) => patchMetadata(item.id, { rightsNotes: event.target.value })} />
                  </label>
                  {!draft.altText.trim() ? <p className={styles.warning}>Falta alt.</p> : null}
                  {draft.rightsType === "UNKNOWN" ? <p className={styles.warning}>Derechos sin definir.</p> : null}
                  {item.bucket_id === "story-media-drafts" ? <p className={styles.warning}>Asset público no preparado.</p> : null}
                  <p className={styles.details}>{item.width} × {item.height} · {item.mime_type} · {item.byte_size.toLocaleString("es-ES")} bytes</p>
                  {draft.message ? <p className={styles.message}>{draft.message}</p> : null}
                  {editable ? (
                    <div className={styles.actions}>
                      <button disabled={draft.saving} type="button" onClick={() => void saveMetadata(item.id)}>Guardar metadatos</button>
                      {item.bucket_id === "story-media-drafts" ? (
                        <button disabled={draft.saving || !promotable} type="button" onClick={() => void promote(item.id)}>Preparar para publicar</button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
      {storyMediaReadinessMessage(readiness) ? (
        <p className={styles.readiness}>{storyMediaReadinessMessage(readiness)}</p>
      ) : null}
      {!media.length ? <p className={styles.muted}>Aún no hay imágenes finalizadas.</p> : null}
    </div>
  );
}
