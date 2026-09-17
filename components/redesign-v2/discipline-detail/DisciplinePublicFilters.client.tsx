"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { currentPagePath, trackEvent } from "@/lib/analytics";
import {
  DEFAULT_DISCIPLINE_FILTERS,
  DISCIPLINE_PERIODS,
  parseDisciplineFilters,
  type DisciplineFilters,
  type DisciplinePreviewData,
  type DisciplineSlug,
} from "@/components/disciplines/discipline-preview-model";
import { publicDisciplineDetailHref } from "./discipline-detail-model";
import styles from "./DisciplineDetailPage.module.css";

type Option = { count: number; key: string; label: string };

function FilterSelect({
  label,
  name,
  onChange,
  options,
  value,
}: {
  label: string;
  name: string;
  onChange: (value: string) => void;
  options: readonly Option[];
  value: string;
}) {
  const available = options.some((option) => option.key === value);
  return (
    <label className={styles.publicFilterField}>
      <span>{label}</span>
      <select name={name} onChange={(event) => onChange(event.target.value)} value={value}>
        <option value="">Todas</option>
        {value && !available ? <option value={value}>{value}</option> : null}
        {options.map((option) => (
          <option key={option.key} value={option.key}>{option.label} · {option.count}</option>
        ))}
      </select>
    </label>
  );
}

export default function DisciplinePublicFilters({
  data,
  initialFilters,
  slug,
}: {
  data: DisciplinePreviewData;
  initialFilters: DisciplineFilters;
  slug: DisciplineSlug;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const appliedFilters = useMemo(() => {
    const current = new URLSearchParams(searchKey);
    return parseDisciplineFilters({
      localidad: current.get("localidad") ?? undefined,
      modalidad: current.get("modalidad") ?? undefined,
      periodo: current.get("periodo") ?? undefined,
      provincia: current.get("provincia") ?? undefined,
      q: current.get("q") ?? undefined,
      vehiculo: current.get("vehiculo") ?? undefined,
    });
  }, [searchKey]);
  const [draft, setDraft] = useState({
    expanded: Boolean(initialFilters.modality || initialFilters.vehicle || initialFilters.locality
      || initialFilters.period !== "upcoming"),
    filters: initialFilters,
    urlKey: searchKey,
  });
  const filters = draft.urlKey === searchKey ? draft.filters : appliedFilters;
  const expanded = draft.urlKey === searchKey ? draft.expanded : Boolean(
    appliedFilters.modality || appliedFilters.vehicle || appliedFilters.locality
    || appliedFilters.period !== "upcoming",
  );

  function update(key: keyof DisciplineFilters, value: string) {
    setDraft({ expanded, filters: { ...filters, [key]: value }, urlKey: searchKey });
  }

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (filters.province !== appliedFilters.province) {
      trackEvent("select_discipline_province", {
        discipline: slug, filter_name: "province", filter_value: filters.province,
        page_path: currentPagePath(), source: "discipline_public",
      });
    }
    if (filters.modality !== appliedFilters.modality) {
      trackEvent("select_discipline_modality", {
        discipline: slug, filter_name: "modality", filter_value: filters.modality,
        page_path: currentPagePath(), source: "discipline_public",
      });
    }
    if (filters.period !== appliedFilters.period) {
      trackEvent("select_discipline_period", {
        discipline: slug, filter_name: "period", filter_value: filters.period,
        page_path: currentPagePath(), source: "discipline_public",
      });
    }
    if (filters.locality !== appliedFilters.locality) {
      trackEvent("select_discipline_locality", {
        discipline: slug, filter_name: "locality", filter_value: filters.locality,
        page_path: currentPagePath(), source: "discipline_public",
      });
    }
    router.push(publicDisciplineDetailHref(slug, 1, filters), { scroll: false });
  }

  const provinceOptions = data.provinceOptions;
  const modalityOptions = data.modalities.map((option) => ({ ...option, key: option.id }));
  const vehicleOptions = data.vehicleOptions;
  const localityOptions = data.localityOptions;

  return (
    <form
      action={`/disciplinas/${slug}`}
      aria-label={`Filtrar eventos de ${data.discipline.title}`}
      className={styles.publicFilters}
      method="get"
      onSubmit={apply}
      role="search"
    >
      <div className={styles.publicFilterPrimary}>
        <label className={styles.publicFilterField}>
          <span>Buscar evento o localidad</span>
          <input
            name="q"
            onChange={(event) => update("query", event.target.value)}
            placeholder="Busca por evento, localidad o provincia..."
            type="search"
            value={filters.query}
          />
        </label>
        <FilterSelect
          label="Provincia"
          name="provincia"
          onChange={(value) => update("province", value)}
          options={provinceOptions}
          value={filters.province}
        />
        <button className={styles.publicFilterSubmit} type="submit">Aplicar filtros</button>
      </div>
      <details
        className={styles.publicMoreFilters}
        onToggle={(event) => setDraft({
          expanded: event.currentTarget.open,
          filters,
          urlKey: searchKey,
        })}
        open={expanded}
      >
        <summary onClick={(event) => trackEvent("toggle_discipline_filters", {
          discipline: slug,
          page_path: currentPagePath(),
          will_open: !event.currentTarget.closest("details")?.open,
        })}>Más filtros</summary>
        <div className={styles.publicFilterAdvanced}>
          <FilterSelect
            label="Modalidad"
            name="modalidad"
            onChange={(value) => update("modality", value)}
            options={modalityOptions}
            value={filters.modality}
          />
          <FilterSelect
            label="Vehículo"
            name="vehiculo"
            onChange={(value) => update("vehicle", value)}
            options={vehicleOptions}
            value={filters.vehicle}
          />
          <FilterSelect
            label="Localidad"
            name="localidad"
            onChange={(value) => update("locality", value)}
            options={localityOptions}
            value={filters.locality}
          />
          <label className={styles.publicFilterField}>
            <span>Periodo</span>
            <select
              name="periodo"
              onChange={(event) => update("period", event.target.value)}
              value={filters.period}
            >
              {DISCIPLINE_PERIODS.map((period) => (
                <option key={period.id} value={period.id}>{period.label}</option>
              ))}
            </select>
          </label>
        </div>
      </details>
      <div className={styles.publicFilterActions}>
        <button
          className={styles.publicFilterClear}
          onClick={() => router.push(publicDisciplineDetailHref(slug, 1, DEFAULT_DISCIPLINE_FILTERS), { scroll: false })}
          type="button"
        >
          Limpiar filtros
        </button>
      </div>
    </form>
  );
}
