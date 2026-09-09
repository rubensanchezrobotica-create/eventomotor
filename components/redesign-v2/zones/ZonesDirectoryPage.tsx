import Link from "next/link";
import { redesignV2DisplayPilot } from "../redesign-v2-fonts";
import {
  territoryProvinceActivityLabel,
  territoryUpcomingCountLabel,
  type TerritoryDirectoryModel,
} from "./territory-directory-model";
import styles from "./ZonesDirectoryPage.module.css";

type ZonesDirectoryPageProps = {
  model: TerritoryDirectoryModel;
};

function provinceActivityLabel(count: number) {
  if (count === 0) return "Sin provincias con eventos próximos";
  return territoryProvinceActivityLabel(count);
}

export default function ZonesDirectoryPage({ model }: ZonesDirectoryPageProps) {
  return (
    <section
      className={`${styles.section} ${redesignV2DisplayPilot.variable}`}
      aria-labelledby="zonas-v2-directory-title"
      data-v2-display-font-pilot="archivo"
      data-v2-zones-directory
    >
      <style>{`:root:has([data-v2-zones-directory]) { --font-v2-display-pilot: ${redesignV2DisplayPilot.style.fontFamily}; }`}</style>
      <div className={styles.shell}>
        <header className={styles.intro}>
          <div>
            <span className={styles.eyebrow}>Comunidades autónomas</span>
            <h2 id="zonas-v2-directory-title">Eventos por comunidad autónoma</h2>
            <p className={styles.activitySummary}>
              {model.activeCommunityCount} comunidades con actividad próxima
            </p>
          </div>
        </header>

        <ul className={styles.grid} aria-label="Comunidades autónomas de España">
          {model.communities.map((territory) => (
            <li key={territory.id}>
              <article className={styles.card}>
                <div className={styles.cardHeading}>
                  <h3>{territory.displayName}</h3>
                  <strong aria-label={territoryUpcomingCountLabel(territory.upcomingEventCount)}>
                    {territory.upcomingEventCount}
                  </strong>
                </div>
                <p className={styles.eventCount}>
                  {territoryUpcomingCountLabel(territory.upcomingEventCount)}
                </p>
                <p className={styles.provinceCount}>
                  {provinceActivityLabel(territory.activeProvinceCount)}
                </p>
                {territory.href ? (
                  <Link
                    aria-label={`Ver eventos en ${territory.displayName}`}
                    className={styles.cardLink}
                    href={territory.href}
                  >
                    Ver eventos <span aria-hidden="true">→</span>
                  </Link>
                ) : (
                  <span className={styles.preparingStatus}>Detalle en preparación</span>
                )}
              </article>
            </li>
          ))}
        </ul>

        <section className={styles.cities} aria-labelledby="zonas-v2-cities-title">
          <header>
            <span className={styles.eyebrow}>Ciudades autónomas</span>
            <h2 id="zonas-v2-cities-title">Ceuta y Melilla</h2>
            <p>Consulta la actividad de motor disponible en las ciudades autónomas.</p>
          </header>
          <ul>
            {model.autonomousCities.map((territory) => (
              <li key={territory.id}>
                <strong>{territory.displayName}</strong>
                <span>{territoryUpcomingCountLabel(territory.upcomingEventCount)}</span>
                <span className={styles.cityStatus}>Más información próximamente</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </section>
  );
}
