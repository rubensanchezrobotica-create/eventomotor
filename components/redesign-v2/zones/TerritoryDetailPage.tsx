import Link from "next/link";
import EventCard from "@/components/redesign-v2/EventCard";
import TerritorySearchAssist from "./TerritorySearchAssist.client";
import {
  TERRITORY_DETAIL_PAGE_SIZE,
  TERRITORY_DETAIL_RESULTS_ANCHOR_ID,
  territoryDetailPaginationItems,
  territoryDetailResultsHref,
  territoryDetailResultsSummary,
  type TerritoryDetailFilterOption,
  type TerritoryDetailPageModel,
} from "./territory-detail-model";
import styles from "./TerritoryDetailPage.module.css";

type TerritoryDetailPageProps = {
  model: TerritoryDetailPageModel;
  nowIso: string;
};

type FilterSelectProps = {
  defaultValue: string;
  id: string;
  label: string;
  name: "discipline" | "province";
  options: readonly TerritoryDetailFilterOption[];
};

function FilterSelect({ defaultValue, id, label, name, options }: FilterSelectProps) {
  return (
    <label className={styles.filterField} htmlFor={id}>
      <span>{label}</span>
      <select defaultValue={defaultValue} id={id} name={name}>
        <option value="">Todas</option>
        {options.map((option) => (
          <option key={option.key} value={option.key}>
            {option.label} · {option.count}
          </option>
        ))}
      </select>
    </label>
  );
}

function ClearFilters({ model }: { model: TerritoryDetailPageModel }) {
  const active = model.query.q || model.query.province || model.query.discipline;
  if (!active) return null;
  return (
    <Link className={styles.clearFilters} href={territoryDetailResultsHref(model.territory.slug)}>
      Restablecer
    </Link>
  );
}

function DesktopFilters({ model }: { model: TerritoryDetailPageModel }) {
  const showSecondaryFilters = model.showProvinceFilter || model.showDisciplineFilter;
  if (!showSecondaryFilters) return null;
  const singleConditionalFilter = model.showProvinceFilter !== model.showDisciplineFilter;

  return (
    <form
      action={territoryDetailResultsHref(model.territory.slug)}
      className={`${styles.desktopFilterForm} ${styles.compactFilterForm} ${singleConditionalFilter ? styles.singleFilterForm : ""}`}
      method="get"
    >
      {model.query.q ? <input name="q" type="hidden" value={model.query.q} /> : null}
      {model.showProvinceFilter ? (
        <FilterSelect
          defaultValue={model.query.province}
          id="territory-province-desktop"
          label="Provincia"
          name="province"
          options={model.provinceOptions}
        />
      ) : null}
      {model.showDisciplineFilter ? (
        <FilterSelect
          defaultValue={model.query.discipline}
          id="territory-discipline-desktop"
          label="Disciplina"
          name="discipline"
          options={model.disciplineOptions}
        />
      ) : null}
      <button className={styles.applyFilters} type="submit">Aplicar filtros</button>
      <ClearFilters model={model} />
    </form>
  );
}

function MobileFilters({ model }: { model: TerritoryDetailPageModel }) {
  const showAdvanced = model.showProvinceFilter || model.showDisciplineFilter;
  if (!showAdvanced) return null;
  return (
    <div className={styles.mobileFilters}>
      <details className={styles.moreFilters} open={Boolean(model.query.province || model.query.discipline)}>
        <summary>Más filtros</summary>
        <form action={territoryDetailResultsHref(model.territory.slug)} method="get">
          {model.query.q ? <input name="q" type="hidden" value={model.query.q} /> : null}
          {model.showProvinceFilter ? (
            <FilterSelect
              defaultValue={model.query.province}
              id="territory-province-mobile"
              label="Provincia"
              name="province"
              options={model.provinceOptions}
            />
          ) : null}
          {model.showDisciplineFilter ? (
            <FilterSelect
              defaultValue={model.query.discipline}
              id="territory-discipline-mobile"
              label="Disciplina"
              name="discipline"
              options={model.disciplineOptions}
            />
          ) : null}
          <div className={styles.mobileFilterActions}>
            <button className={styles.applyFilters} type="submit">Aplicar filtros</button>
            <ClearFilters model={model} />
          </div>
        </form>
      </details>
    </div>
  );
}

function TerritoryFilters({ model }: { model: TerritoryDetailPageModel }) {
  if (!model.showTextSearch && !model.showProvinceFilter && !model.showDisciplineFilter) return null;
  const hasSecondaryFilters = model.showProvinceFilter || model.showDisciplineFilter;
  return (
    <div className={styles.filters} aria-label={`Filtrar eventos en ${model.territory.displayName}`}>
      {model.showTextSearch ? (
        <TerritorySearchAssist
          action={territoryDetailResultsHref(model.territory.slug)}
          activeFilters={{ discipline: model.query.discipline, province: model.query.province }}
          clearHref={territoryDetailResultsHref(model.territory.slug, {
            discipline: model.query.discipline,
            province: model.query.province,
          })}
          hasSecondaryFilters={hasSecondaryFilters}
          initialQuery={model.query.q}
          key={model.query.q}
          source={model.suggestionIndex}
          territoryName={model.territory.displayName}
          territorySlug={model.territory.slug}
        />
      ) : null}
      <DesktopFilters model={model} />
      <MobileFilters model={model} />
    </div>
  );
}

function Pagination({ model }: { model: TerritoryDetailPageModel }) {
  const items = territoryDetailPaginationItems(model.page, model.pageCount);
  if (!items.length) return null;
  const href = (page: number) => territoryDetailResultsHref(model.territory.slug, { ...model.query, page });

  return (
    <nav aria-label={`Paginación de eventos en ${model.territory.displayName}`} className={styles.pagination}>
      {model.page > 1 ? <Link href={href(model.page - 1)}>Anterior</Link> : <span />}
      <span className={styles.pageNumbers}>
        {items.map((item, index) => item === "ellipsis" ? (
          <span aria-hidden="true" className={styles.ellipsis} key={`ellipsis-${index}`}>…</span>
        ) : (
          <Link aria-current={item === model.page ? "page" : undefined} href={href(item)} key={item}>
            {item}
          </Link>
        ))}
      </span>
      {model.page < model.pageCount ? <Link href={href(model.page + 1)}>Siguiente</Link> : <span />}
    </nav>
  );
}

function EmptyResults({ model }: { model: TerritoryDetailPageModel }) {
  const filtered = Boolean(model.query.q || model.query.province || model.query.discipline);
  return (
    <div className={styles.emptyState} role="status">
      <h3>{filtered ? "No hay coincidencias" : "Sin próximos eventos"}</h3>
      <p>
        {filtered
          ? "Prueba con otros filtros o vuelve a consultar toda la agenda del territorio."
          : "Consulta el calendario nacional o vuelve más adelante para descubrir nuevas fechas."}
      </p>
      <div>
        {filtered ? <Link href={territoryDetailResultsHref(model.territory.slug)}>Limpiar filtros</Link> : null}
        <Link href="/preview/redesign-v2/calendario">Ver calendario nacional</Link>
        <Link href="/publicar-evento">Publicar evento</Link>
      </div>
    </div>
  );
}

function RegionalGuide({ model }: { model: TerritoryDetailPageModel }) {
  if (!model.guideParagraphs.length && !model.faqs.length && !model.relatedLinks.length) return null;
  return (
    <section className={styles.guide} aria-labelledby="territory-detail-guide">
      <header>
        <span className={styles.kicker}>Guía territorial</span>
        <h2 id="territory-detail-guide">Guía de motor en {model.territory.displayName}</h2>
      </header>
      {model.guideParagraphs.length ? (
        <details className={styles.guideDisclosure}>
          <summary>Información para explorar la agenda</summary>
          <div className={styles.guideCopy}>
            {model.guideParagraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
          </div>
        </details>
      ) : null}
      {model.faqs.length ? (
        <div className={styles.faqs}>
          <h3>Preguntas frecuentes</h3>
          {model.faqs.map((faq) => (
            <details key={faq.question}>
              <summary>{faq.question}</summary>
              <p>{faq.answer}</p>
            </details>
          ))}
        </div>
      ) : null}
      {model.relatedLinks.length ? (
        <nav aria-label={`Más recursos de ${model.territory.displayName}`} className={styles.relatedLinks}>
          <strong>Seguir explorando</strong>
          <div>
            {model.relatedLinks.map((link) => <Link href={link.href} key={`${link.href}-${link.label}`}>{link.label}</Link>)}
          </div>
        </nav>
      ) : null}
    </section>
  );
}

export default function TerritoryDetailPage({ model, nowIso }: TerritoryDetailPageProps) {
  return (
    <div className={styles.page} data-a75-territory-detail data-inventory-state={model.state.toLowerCase()}>
      <section className={styles.results} aria-labelledby="territory-detail-results">
        <div className={styles.shell}>
          <header className={styles.resultsHeader}>
            <span className={styles.kicker}>Próximos eventos</span>
            <h2 id="territory-detail-results">Eventos de motor en {model.territory.displayName}</h2>
            <p aria-live="polite">{territoryDetailResultsSummary(model)}</p>
          </header>

          <TerritoryFilters model={model} />

          <div className={styles.resultsLanding} id={TERRITORY_DETAIL_RESULTS_ANCHOR_ID}>
            {model.items.length ? (
              <div aria-labelledby="territory-detail-results" className={styles.eventGrid}>
                {model.items.map((item) => (
                  <EventCard
                    event={item.event}
                    key={item.event.id}
                    nowIso={nowIso}
                    resolvedImage={item.image}
                  />
                ))}
              </div>
            ) : <EmptyResults model={model} />}
          </div>

          <Pagination model={model} />
          {model.pageCount > 1 ? (
            <p className={styles.pageSizeNote}>Hasta {TERRITORY_DETAIL_PAGE_SIZE} eventos por página.</p>
          ) : null}
        </div>
      </section>
      <RegionalGuide model={model} />
    </div>
  );
}
