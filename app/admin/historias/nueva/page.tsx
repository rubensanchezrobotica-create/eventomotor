import Link from "next/link";
import styles from "@/components/admin/stories/StoryAdmin.module.css";
import { createStoryAction } from "../actions";
import { requireAdminSession } from "@/lib/admin-session.server";

export default async function NewStoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminSession("/admin/historias/nueva");
  const query = await searchParams;
  const commercial = query.collection === "COLABORACIONES";
  return (
    <div className={styles.stack}>
      <p className={styles.eyebrow}>Nuevo borrador</p>
      <h1>{commercial ? "Nuevo artículo patrocinado" : "Nueva Historia"}</h1>
      <p className={styles.lede}>La fila se crea sólo al enviar este formulario y siempre comienza en DRAFT.</p>
      {query.error ? <p className={styles.error}>No se pudo crear el borrador. Revisa los campos.</p> : null}
      <form action={createStoryAction} className={styles.panel}>
        <label>Tipo
          <select defaultValue={commercial ? "ARTICULO" : "REPORTAJE"} name="type">
            <option value="CRONICA">CRÓNICA</option><option value="REPORTAJE">REPORTAJE</option>
            <option value="HISTORIA">HISTORIA</option><option value="ENTREVISTA">ENTREVISTA</option>
            <option value="ARTICULO">ARTÍCULO COMERCIAL</option>
          </select>
        </label>
        <label>Colección
          <select defaultValue={commercial ? "COLABORACIONES" : "DESDE_DENTRO"} name="collection">
            <option value="DESDE_DENTRO">DESDE DENTRO</option>
            <option value="HISTORIAS_DE_MOTOR">HISTORIAS DE MOTOR</option>
            <option value="CONVERSACIONES">CONVERSACIONES</option>
            <option value="COLABORACIONES">COLABORACIONES · CONTENIDO PATROCINADO</option>
          </select>
        </label>
        <label>Título <input maxLength={240} name="title" required /></label>
        <div className={styles.actions}>
          <Link className={styles.secondary} href="/admin/historias">Cancelar</Link>
          <button className={styles.primary} type="submit">Crear borrador</button>
        </div>
      </form>
    </div>
  );
}
