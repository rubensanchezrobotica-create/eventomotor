import TrackLink from "@/components/analytics/TrackLink";
import RegionalFilterDisclosure from "@/components/regions/RegionalFilterDisclosure";
import type { RegionalCount } from "@/lib/regions/regional-landing-model";
import styles from "@/components/regions/RegionalLanding.module.css";

type ListingFilter = {
  label: string;
  name: string;
  options: RegionalCount[];
  value: string;
};

type PublicListingFinderProps = {
  activePeriodLabel?: string;
  analyticsEventName?: string;
  analyticsSource: string;
  extraFilters?: ListingFilter[];
  nextThirtyDaysAvailable: boolean;
  pathname: string;
  provinceCounts: RegionalCount[];
  query: {
    province: string;
    query: string;
    when: "upcoming" | "weekend" | "next30";
  };
  region: string;
  searchPlaceholder: string;
  showSearch: boolean;
  totalLabel: string;
  toggleEventName?: string;
  weekendAvailable: boolean;
};

function FilterSelect({
  label,
  name,
  options,
  value,
}: ListingFilter) {
  return (
    <label className={styles.finderField}>
      <span>{label}</span>
      <select defaultValue={value} name={name}>
        <option value="">Todas</option>
        {options.map((option) => (
          <option key={option.key} value={option.key}>
            {option.label} ({option.count})
          </option>
        ))}
      </select>
    </label>
  );
}

export default function PublicListingFinder({
  activePeriodLabel,
  analyticsEventName = "filter_region",
  analyticsSource,
  extraFilters = [],
  nextThirtyDaysAvailable,
  pathname,
  provinceCounts,
  query,
  region,
  searchPlaceholder,
  showSearch,
  totalLabel,
  toggleEventName = "toggle_region_filters",
  weekendAvailable,
}: PublicListingFinderProps) {
  return (
    <RegionalFilterDisclosure
      activePeriodLabel={activePeriodLabel}
      analyticsEventName={analyticsEventName}
      analyticsSource={analyticsSource}
      region={region}
      toggleEventName={toggleEventName}
      totalLabel={totalLabel}
    >
      <form
        action={`${pathname}#eventos`}
        aria-label="Filtrar eventos"
        className={styles.finderPanel}
        method="get"
      >
        <div className={styles.finderControls}>
          {showSearch ? (
            <label className={`${styles.finderField} ${styles.searchField}`}>
              <span>Buscar</span>
              <input
                defaultValue={query.query}
                name="q"
                placeholder={searchPlaceholder}
                type="search"
              />
            </label>
          ) : null}
          {provinceCounts.length > 1 ? (
            <FilterSelect
              label="Provincia"
              name="province"
              options={provinceCounts}
              value={query.province}
            />
          ) : null}
          <label className={styles.finderField}>
            <span>Cuándo</span>
            <select defaultValue={query.when} name="when">
              <option value="upcoming">Próximos</option>
              {weekendAvailable ? <option value="weekend">Fin de semana</option> : null}
              {nextThirtyDaysAvailable ? <option value="next30">Próximos 30 días</option> : null}
            </select>
          </label>
        </div>

        <div className={styles.filterFooter}>
          {extraFilters.length > 0 ? (
            <details className={styles.moreFilters}>
              <summary>Más filtros <span aria-hidden="true">+</span></summary>
              <div className={styles.moreFiltersGrid}>
                {extraFilters.map((filter) => <FilterSelect key={filter.name} {...filter} />)}
              </div>
            </details>
          ) : <span />}
        </div>

        <button className={`${styles.applyFilters} emc-btn emc-btn-primary`} type="submit">
          Aplicar filtros
        </button>

        <TrackLink
          className={styles.resetFilters}
          eventName={analyticsEventName}
          eventParams={{ action: "reset", region, source: analyticsSource }}
          href={`${pathname}#eventos`}
        >
          Restablecer
        </TrackLink>
      </form>
    </RegionalFilterDisclosure>
  );
}
