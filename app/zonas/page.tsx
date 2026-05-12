import type { Metadata } from "next";
import Link from "next/link";
import ConceptFooter from "@/components/public/concept/ConceptFooter";
import ConceptStaticHeader from "@/components/public/concept/ConceptStaticHeader";
import ConceptStyles from "@/components/public/concept/ConceptStyles";
import { SITE_URL } from "@/lib/seo";
import { SEO_ZONES } from "@/lib/seo-taxonomy";

export const metadata: Metadata = {
  title: "Zonas",
  description:
    "Explora eventos de motor por zonas de España: norte, centro, Cataluña y Aragón, Levante, sur y Canarias.",
  alternates: {
    canonical: `${SITE_URL}/zonas`,
  },
};

export default function ZonasPage() {
  return (
    <div className="emc-page">
      <ConceptStyles />
      <ConceptStaticHeader />
      <main className="emc-contact-page">
        <section className="emc-contact-hero">
          <div className="emc-container">
            <div className="emc-kicker">Zonas</div>
            <h1>Eventos de motor por zona</h1>
            <p className="emc-contact-lead">
              Encuentra eventos de motor por zonas de España: norte, centro, Levante, sur, islas y más.
            </p>
          </div>
        </section>
        <section className="emc-section emc-publish-section">
          <div className="emc-container">
            <div className="emc-publish-grid">
              {SEO_ZONES.map((zone) => (
                <Link className="emc-publish-card" href={`/zonas/${zone.slug}`} key={zone.slug}>
                  <span />
                  <strong>{zone.title}</strong>
                  <small>{zone.provinces}</small>
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
