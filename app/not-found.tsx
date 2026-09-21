import { redesignV2DisplayPilot } from "@/components/redesign-v2/redesign-v2-fonts";
import PreviewAwareLink from "@/components/redesign-v2/site/PreviewAwareLink";
import V2InteriorShell from "@/components/redesign-v2/site/V2InteriorShell";
import styles from "./not-found.module.css";

export default function NotFound() {
  return (
    <div className={`${styles.page} ${redesignV2DisplayPilot.variable}`}>
      <V2InteriorShell
        breadcrumbs={[{ label: "Inicio", navigationId: "home" }, { label: "Página no encontrada" }]}
        description="No hemos encontrado la página que buscas. Puede que el enlace haya cambiado o ya no esté disponible."
        eyebrow="404 · Fuera de pista"
        heroTitleFontClassName={redesignV2DisplayPilot.variable}
        navigationMode="public"
        title="Esta página no está en la parrilla."
      >
        <section aria-label="Volver a explorar" className={styles.recovery}>
          <div className={styles.recoveryInner}>
            <PreviewAwareLink className={`${styles.action} ${styles.primary}`} mode="public" navigationId="calendar">
              Volver a la agenda <span aria-hidden="true">→</span>
            </PreviewAwareLink>
            <PreviewAwareLink className={`${styles.action} ${styles.secondary}`} mode="public" navigationId="home">
              Ir al inicio
            </PreviewAwareLink>
          </div>
        </section>
      </V2InteriorShell>
    </div>
  );
}
