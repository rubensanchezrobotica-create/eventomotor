import Link from "next/link";
import styles from "@/components/admin/stories/StoryAdmin.module.css";
import { createStoryAction } from "../actions";

export default async function NewStoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  return (
    <div className={styles.stack}>
      <p className={styles.eyebrow}>Nuevo borrador</p>
      <h1>Nueva Historia</h1>
      <p className={styles.lede}>La fila se crea sólo al enviar este formulario y siempre comienza en DRAFT.</p>
      {query.error ? <p className={styles.error}>No se pudo crear el borrador. Revisa los campos.</p> : null}
      <form action={createStoryAction} className={styles.panel}>
        <label>Tipo
          <select defaultValue="REPORTAJE" name="type">
            <option value="CRONICA">CRÓNICA</option><option value="REPORTAJE">REPORTAJE</option>
            <option value="HISTORIA">HISTORIA</option><option value="ENTREVISTA">ENTREVISTA</option>
          </select>
        </label>
        <label>Colección
          <select defaultValue="DESDE_DENTRO" name="collection">
            <option value="DESDE_DENTRO">DESDE DENTRO</option>
            <option value="HISTORIAS_DE_MOTOR">HISTORIAS DE MOTOR</option>
            <option value="CONVERSACIONES">CONVERSACIONES</option>
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
