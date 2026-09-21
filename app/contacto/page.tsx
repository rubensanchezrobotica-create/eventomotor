import type { Metadata } from "next";
import ContactV2 from "@/components/redesign-v2/contact/ContactV2";
import { redesignV2DisplayPilot } from "@/components/redesign-v2/redesign-v2-fonts";
import V2InteriorShell from "@/components/redesign-v2/site/V2InteriorShell";
import styles from "@/components/redesign-v2/contact/ContactV2.module.css";
import { SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Contacto y publicación de eventos",
  description:
    "Contacta con EventoMotor para corregir o publicar eventos de motor, proponer colaboraciones o enviarnos información.",
  alternates: {
    canonical: `${SITE_URL}/contacto`,
  },
};

export default function ContactoPage() {
  return (
    <div className={`${styles.pageScope} ${redesignV2DisplayPilot.variable}`}>
      <V2InteriorShell
        breadcrumbs={[{ label: "Inicio", navigationId: "home" }, { label: "Contacto" }]}
        currentNavigationId="contact"
        description="Para correcciones, publicación de eventos, colaboraciones o propuestas, escríbenos directamente."
        eyebrow="Contacto"
        heroTitleFontClassName={redesignV2DisplayPilot.variable}
        navigationMode="public"
        title="Hablemos de motor."
      >
        <ContactV2 />
      </V2InteriorShell>
    </div>
  );
}
