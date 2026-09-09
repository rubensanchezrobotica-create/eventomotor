import Link from "next/link";
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
    <section className={styles.section} aria-labelledby="zonas-v2-directory-title">
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
            <span className={styles.eyebrow}>Territorios conocidos</span>
            <h2 id="zonas-v2-cities-title">Ciudades autónomas</h2>
            <p>Ceuta y Melilla forman parte del catálogo territorial y permanecen sin landing pública.</p>
          </header>
          <ul>
            {model.autonomousCities.map((territory) => (
              <li key={territory.id}>
                <strong>{territory.displayName}</strong>
                <span>{territoryUpcomingCountLabel(territory.upcomingEventCount)}</span>
                <span className={styles.cityStatus}>Landing no publicada</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </section>
  );
}
