import Link from "next/link";
import { listStoriesForAdmin, type StoryListStatus } from "@/lib/stories/story-admin.server";
import styles from "@/components/admin/stories/StoryAdmin.module.css";

const FILTERS: StoryListStatus[] = ["ALL", "DRAFT", "READY", "PUBLISHED", "ARCHIVED"];

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default async function AdminStoriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const requested = typeof query.status === "string" ? query.status.toUpperCase() : "ALL";
  const status = FILTERS.includes(requested as StoryListStatus) ? requested as StoryListStatus : "ALL";
  const stories = await listStoriesForAdmin(status);

  return (
    <div className={styles.stack}>
      <div className={styles.actions}>
        <div>
          <p className={styles.eyebrow}>Backoffice editorial</p>
          <h1>Historias</h1>
          <p className={styles.lede}>Borradores, piezas listas y archivo de publicación.</p>
        </div>
        <Link className={styles.primary} href="/admin/historias/nueva">Nueva Historia</Link>
      </div>
      <nav className={styles.filters} aria-label="Filtrar Historias">
        {FILTERS.map((filter) => (
          <Link
            data-active={filter === status}
            href={filter === "ALL" ? "/admin/historias" : `/admin/historias?status=${filter}`}
            key={filter}
          >{filter}</Link>
        ))}
      </nav>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th>Título</th><th>Tipo</th><th>Colección</th><th>Estado</th><th>Slug</th><th>Actualizada</th><th>Publicada</th><th>Acciones</th></tr></thead>
          <tbody>
            {stories.map((story) => (
              <tr key={story.id}>
                <td>{story.title || "Sin título"}</td><td>{story.type}</td><td>{story.collection}</td><td>{story.status}</td>
                <td>{story.slug || "—"}</td><td>{formatDate(story.updated_at)}</td><td>{formatDate(story.published_at)}</td>
                <td><Link href={`/admin/historias/${story.id}`}>Editar</Link> · <Link href={`/admin/historias/${story.id}/preview`}>Preview</Link></td>
              </tr>
            ))}
            {!stories.length ? <tr><td colSpan={8}>No hay Historias para este filtro.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
