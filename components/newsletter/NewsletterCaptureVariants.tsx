import styles from "./NewsletterPreview.module.css";

type CaptureVariantProps = {
  eyebrow: string;
  title: string;
  copy: string;
  cta: string;
  kind: "territory" | "event" | "results" | "compact";
};

export type NewsletterTerritorialCaptureProps = {
  provinceSlug: string;
  provinceName: string;
  contextualCopy: string;
};

function CaptureVariant({ eyebrow, title, copy, cta, kind }: CaptureVariantProps) {
  return (
    <article className={`${styles.captureVariant} ${styles[`captureVariant${kind}`]}`}>
      <span>{eyebrow}</span>
      <h3>{title}</h3>
      <p>{copy}</p>
      <div className={styles.captureMock} aria-label="Formulario visual sin conexión">
        <span>tu@email.com</span>
        <button type="button">{cta}</button>
      </div>
    </article>
  );
}

type NewsletterCaptureVariantsProps = {
  territorial?: NewsletterTerritorialCaptureProps;
};

export default function NewsletterCaptureVariants({
  territorial = {
    provinceSlug: "barcelona",
    provinceName: "Barcelona",
    contextualCopy: "Selección contextual con provincia y planes próximos.",
  },
}: NewsletterCaptureVariantsProps) {
  return (
    <div className={styles.captureGrid} data-territory={territorial.provinceSlug}>
      <CaptureVariant
        copy={territorial.contextualCopy}
        cta={`Recibir eventos de ${territorial.provinceName}`}
        eyebrow="Variante territorial"
        kind="territory"
        title={`¿Quieres recibir los mejores eventos de ${territorial.provinceName} cada semana?`}
      />
      <CaptureVariant
        copy="Continuidad natural después de consultar una ficha."
        cta="Recibir planes como este"
        eyebrow="Ficha de evento"
        kind="event"
        title="¿Te interesan planes como este?"
      />
      <CaptureVariant
        copy="Tarjeta editorial preparada para convivir entre resultados."
        cta="Recibir la agenda semanal"
        eyebrow="Entre resultados"
        kind="results"
        title="Que no se te escape el próximo evento"
      />
      <CaptureVariant
        copy="Una versión contenida para el futuro footer."
        cta="Recibir la agenda"
        eyebrow="Compacta"
        kind="compact"
        title="Tu semana del motor, en un correo"
      />
    </div>
  );
}
