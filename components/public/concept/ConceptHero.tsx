"use client";

import type { ReactNode } from "react";
import { currentPagePath, trackEvent } from "@/lib/analytics";
import type { ConceptZone } from "./concept-model";

type VehicleMainFilter = "todos" | "moto" | "coche";
type DateQuickFilter = "todos" | "hoy" | "fin-semana" | "mes" | "30-dias";

type ConceptHeroProps = {
  zones: ConceptZone[];
  disciplines: string[];
  query: string;
  discipline: string;
  zone: string;
  vehicleFilter: VehicleMainFilter;
  dateFilter: DateQuickFilter;
  locationLabel: string;
  locationMessage: string;
  userLocationActive: boolean;
  hasHeroImage?: boolean;
  searchPanel?: ReactNode;
  onSearch: () => void;
  onQuery: (value: string) => void;
  onDiscipline: (value: string) => void;
  onZone: (name: string) => void;
  onVehicle: (filter: VehicleMainFilter) => void;
  onDateFilter: (filter: DateQuickFilter) => void;
  onUseLocation: () => void;
  onClearLocation: () => void;
};

const VEHICLE_FILTERS: Array<{ id: VehicleMainFilter; label: string }> = [
  { id: "todos", label: "Todos" },
  { id: "moto", label: "Motos" },
  { id: "coche", label: "Coches" },
];

const DATE_FILTERS: Array<{ id: DateQuickFilter; label: string }> = [
  { id: "hoy", label: "Hoy" },
  { id: "fin-semana", label: "Este fin de semana" },
  { id: "mes", label: "Este mes" },
  { id: "30-dias", label: "Próximos 30 días" },
];

export default function ConceptHero({
  zones,
  disciplines,
  query,
  discipline,
  zone,
  vehicleFilter,
  dateFilter,
  locationLabel,
  locationMessage,
  userLocationActive,
  hasHeroImage = false,
  searchPanel,
  onSearch,
  onQuery,
  onDiscipline,
  onZone,
  onVehicle,
  onDateFilter,
  onUseLocation,
  onClearLocation,
}: ConceptHeroProps) {
  return (
    <header className="emc-hero">
      <div className={`emc-hero-visual ${hasHeroImage ? "emc-has-image" : ""}`} aria-hidden="true" />
      <div className="emc-hero-veil" aria-hidden="true" />
      <div className="emc-container emc-hero-grid">
        <div className="emc-hero-main">
          <div className="emc-eyebrow">Eventos de motor en España</div>
          <h1>
            Encuentra eventos de motor <span>por fecha, zona y tipo.</span>
          </h1>
          <p className="emc-hero-copy">
            Rallyes, concentraciones, circuitos, rutas, ferias y competiciones en un solo calendario.
          </p>

          {searchPanel ?? <form
            className="emc-hero-search"
            onSubmit={(event) => {
              event.preventDefault();
              trackEvent("search_events", {
                search_term: query.trim(),
                page_path: currentPagePath(),
              });
              onSearch();
            }}
          >
            <div className="emc-hero-decision-row">
              <div>
                <span className="emc-control-label">Tipo de evento</span>
                <div className="emc-vehicle-tabs emc-vehicle-tabs-hero" aria-label="Tipo de vehículo">
                  {VEHICLE_FILTERS.map((item) => (
                    <button
                      className={vehicleFilter === item.id ? "emc-active" : ""}
                      key={item.id}
                      onClick={() => {
                        trackEvent("filter_vehicle_type", {
                          vehicle_type: item.id,
                          page_path: currentPagePath(),
                        });
                        onVehicle(item.id);
                      }}
                      type="button"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="emc-hero-location-card">
                <span className="emc-control-label">{userLocationActive ? "Ubicación activa" : "Ubicación"}</span>
                <div className="emc-hero-location-actions">
                  <button className="emc-location-trigger" onClick={onUseLocation} type="button">
                    <span aria-hidden="true">⌖</span>
                    <strong>{userLocationActive ? "Cerca de ti" : "Usar mi ubicación"}</strong>
                    <small>{locationLabel}</small>
                  </button>
                  {userLocationActive ? (
                    <button className="emc-location-clear" onClick={onClearLocation} type="button">
                      Quitar
                    </button>
                  ) : null}
                </div>
                {locationMessage ? <p className="emc-location-inline-message">{locationMessage}</p> : null}
              </div>
            </div>

            <div className="emc-date-quick-row" aria-label="Filtros rápidos de fecha">
              {DATE_FILTERS.map((item) => (
                <button
                  className={dateFilter === item.id ? "emc-active" : ""}
                  key={item.id}
                  onClick={() => onDateFilter(dateFilter === item.id ? "todos" : item.id)}
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="emc-hero-fields">
              <div className="emc-field">
                <label htmlFor="emc-hero-query">Buscar</label>
                <input
                  id="emc-hero-query"
                  onChange={(event) => onQuery(event.target.value)}
                  placeholder="Ciudad, circuito, rally..."
                  value={query}
                />
              </div>
              <div className="emc-field">
                <label htmlFor="emc-hero-zone">Zona</label>
                <select
                  id="emc-hero-zone"
                  onChange={(event) => {
                    trackEvent("filter_zone", {
                      zone: event.target.value,
                      page_path: currentPagePath(),
                    });
                    onZone(event.target.value);
                  }}
                  value={zone}
                >
                  <option value="Toda España">Toda España</option>
                  {zones.map((item) => (
                    <option key={item.name}>{item.name}</option>
                  ))}
                </select>
              </div>
              <div className="emc-field">
                <label htmlFor="emc-hero-discipline">Disciplina</label>
                <select
                  id="emc-hero-discipline"
                  onChange={(event) => {
                    trackEvent("filter_discipline", {
                      discipline: event.target.value,
                      page_path: currentPagePath(),
                    });
                    onDiscipline(event.target.value);
                  }}
                  value={discipline}
                >
                  <option>Todas</option>
                  {disciplines.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </div>
              <button className="emc-btn emc-btn-primary" type="submit">
                Buscar eventos
              </button>
            </div>
          </form>}
        </div>
      </div>
    </header>
  );
}
