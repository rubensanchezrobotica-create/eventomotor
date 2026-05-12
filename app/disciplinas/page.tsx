import type { Metadata } from "next";
import Link from "next/link";
import ConceptFooter from "@/components/public/concept/ConceptFooter";
import ConceptStaticHeader from "@/components/public/concept/ConceptStaticHeader";
import ConceptStyles from "@/components/public/concept/ConceptStyles";
import { SEO_DISCIPLINES } from "@/lib/seo-taxonomy";
import { SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Disciplinas",
  description:
    "Explora eventos de motor por disciplina: rallyes, circuito, concentraciones, offroad, clásicos, karting, rutas y ferias.",
  alternates: {
    canonical: `${SITE_URL}/disciplinas`,
  },
};

export default function DisciplinasPage() {
  return (
    <div className="emc-page">
      <ConceptStyles />
      <ConceptStaticHeader />
      <main className="emc-contact-page">
        <section className="emc-contact-hero">
          <div className="emc-container">
            <div className="emc-kicker">Disciplinas</div>
            <h1>Eventos de motor por disciplina</h1>
            <p className="emc-contact-lead">
              Encuentra eventos por tipo de experiencia: rallyes, circuito, concentraciones, rutas, offroad, clásicos, karting y ferias.
            </p>
          </div>
        </section>
        <section className="emc-section emc-publish-section">
          <div className="emc-container">
            <div className="emc-publish-grid">
              {SEO_DISCIPLINES.map((discipline) => (
                <Link className="emc-publish-card" href={`/disciplinas/${discipline.slug}`} key={discipline.slug}>
                  <span />
                  <strong>{discipline.title}</strong>
                  <small>{discipline.description}</small>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
      <ConceptFooter />
    </div>
  );
}
