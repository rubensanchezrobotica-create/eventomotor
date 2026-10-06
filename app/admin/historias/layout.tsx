import Link from "next/link";
import { requireAdminSession } from "@/lib/admin-session.server";
import styles from "@/components/admin/stories/StoryAdmin.module.css";
import { logoutAdminAction } from "../login/actions";

export const dynamic = "force-dynamic";

export default async function AdminStoriesLayout({ children }: { children: React.ReactNode }) {
  await requireAdminSession("/admin/historias");
  return (
    <div className={styles.shell}>
      <nav className={styles.nav} aria-label="Administración de Historias">
        <Link href="/admin/historias">EventoMotor · Historias</Link>
        <form action={logoutAdminAction}><button type="submit">Cerrar sesión</button></form>
      </nav>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
