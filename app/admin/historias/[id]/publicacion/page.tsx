import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getStoryForAdmin } from "@/lib/stories/story-admin.server";
import styles from "@/components/admin/stories/StoryAdmin.module.css";
import { prepareStoryPublicationAction, publishStoryAction } from "../../publication-actions";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export default async function PublicationPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const bundle = await getStoryForAdmin(id);
  if (!bundle) notFound();
  const s = bundle.story;
  return <div className={styles.stack}>
    <h1>Publicación de Historia</h1><h2>{s.title}</h2>
    <p>{s.status} · {s.content_blocks.length} bloques · {bundle.media.length} medios</p>
    <Link href={`/admin/historias/${id}/preview`}>Revisar la Preview privada</Link>
    {query.error ? <p role="alert">Operación no completada. Relee la versión y revisa el gate antes de reintentar. No se ha confirmado una publicación.</p> : null}
    {query.prepared ? <p>Gate editorial y técnico correcto. Derivados verificados. Historia READY.</p> : null}
    {s.status === "DRAFT" || s.status === "READY" ? <form action={prepareStoryPublicationAction} className={styles.stack} id="prepare-publication">
      <input type="hidden" name="storyId" value={id} /><input type="hidden" name="expectedUpdatedAt" value={s.updated_at} />
      <p>Se conservarán los originales privados. Los derivados quedarán accesibles públicamente, aun antes de publicar el artículo.</p>
      <label><input type="checkbox" name="confirmPublicDerivatives" value="yes" required /> Autorizar los derivados públicos y preparar READY</label>
      <button type="submit">Preparar derivados y validar</button>
    </form> : null}
    {s.status === "READY" ? <form action={publishStoryAction} className={styles.stack} id="publish-story">
      <input type="hidden" name="storyId" value={id} /><input type="hidden" name="expectedUpdatedAt" value={s.updated_at} />
      <input type="hidden" name="requestId" value={randomUUID()} />
      <label><input type="checkbox" name="confirmPublication" value="yes" required /> Publicar esta Historia en /historias con fecha real</label>
      <button type="submit">Publicar Historia</button>
    </form> : null}
    {s.status === "PUBLISHED" ? <p>Publicada el {s.published_at}. <Link href={`/historias/${s.slug}`}>Abrir la Historia pública</Link></p> : null}
    <Link href={`/admin/historias/${id}`}>Volver al editor</Link>
  </div>;
}
