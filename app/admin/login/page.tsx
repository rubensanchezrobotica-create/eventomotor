import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { safeAdminNext, verifyAdminSession } from "@/lib/admin-session.server";
import styles from "@/components/admin/stories/StoryAdmin.module.css";
import { loginAdminAction } from "./actions";

export const metadata: Metadata = {
  title: "Acceso editorial | EventoMotor",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const next = safeAdminNext(typeof query.next === "string" ? query.next : null);
  if (await verifyAdminSession()) redirect(next);

  return (
    <main className={styles.shell}>
      <section className={styles.login}>
        <p className={styles.eyebrow}>EventoMotor · Editorial</p>
        <h1>Acceso administrativo</h1>
        <p className={styles.lede}>La credencial se verifica en el servidor y no se conserva en el navegador.</p>
        {query.error ? <p className={styles.error}>No se pudo iniciar sesión.</p> : null}
        {query.loggedOut ? <p className={styles.notice}>Sesión cerrada.</p> : null}
        <form action={loginAdminAction}>
          <input name="next" type="hidden" value={next} />
          <label>Credencial administrativa
            <input autoComplete="current-password" name="credential" required type="password" />
          </label>
          <button className={styles.primary} type="submit">Entrar</button>
        </form>
      </section>
    </main>
  );
}
