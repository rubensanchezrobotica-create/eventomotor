"use client";

import type { ConceptZone } from "./concept-model";

type VehicleMainFilter = "todos" | "moto" | "coche";

type ConceptHeroProps = {
  zones: ConceptZone[];
  disciplines: string[];
  query: string;
  discipline: string;
  zone: string;
  vehicleFilter: VehicleMainFilter;
  locationLabel: string;
  locationMessage: string;
  userLocationActive: boolean;
  onSearch: () => void;
  onQuery: (value: string) => void;
  onDiscipline: (value: string) => void;
  onZone: (name: string) => void;
  onVehicle: (filter: VehicleMainFilter) => void;
  onUseLocation: () => void;
  onClearLocation: () => void;
};

const VEHICLE_FILTERS: Array<{ id: VehicleMainFilter; label: string }> = [
  { id: "todos", label: "Todos" },
  { id: "moto", label: "Motos" },
  { id: "coche", label: "Coches" },
];

export default function ConceptHero({
  zones,
  disciplines,
  query,
  discipline,
  zone,
  vehicleFilter,
  locationLabel,
  locationMessage,
  userLocationActive,
  onSearch,
  onQuery,
  onDiscipline,
  onZone,
  onVehicle,
  onUseLocation,
  onClearLocation,
}: ConceptHeroProps) {
  function zoneClassName(name: string) {
    const normalized = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

    if (normalized.includes("norte")) return "emc-zone-norte";
    if (normalized.includes("centro")) return "emc-zone-centro";
    if (normalized.includes("cataluna") || normalized.includes("catalunya") || normalized.includes("aragon")) return "emc-zone-cataluna";
    if (normalized.includes("levante")) return "emc-zone-levante";
    if (normalized.includes("sur")) return "emc-zone-sur";
    if (normalized.includes("canarias")) return "emc-zone-canarias";

    return "emc-zone-centro";
  }

  return (
    <header className="emc-hero">
      <div className="emc-container emc-hero-grid">
        <div className="emc-hero-main">
          <div className="emc-eyebrow">Eventos de motor en España</div>
          <h1>
            Eventos de motor cerca de ti. <span>Sin perderte.</span>
          </h1>
          <p className="emc-hero-copy">
            Elige motos, coches o todo. Ajusta zona, disciplina o búsqueda y el calendario se actualiza con eventos reales.
          </p>

          <form
            className="emc-hero-search"
            onSubmit={(event) => {
              event.preventDefault();
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
                      onClick={() => onVehicle(item.id)}
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
                <select id="emc-hero-zone" onChange={(event) => onZone(event.target.value)} value={zone}>
                  <option value="Toda España">Toda España</option>
                  {zones.map((item) => (
                    <option key={item.name}>{item.name}</option>
                  ))}
                </select>
              </div>
              <div className="emc-field">
                <label htmlFor="emc-hero-discipline">Disciplina</label>
                <select id="emc-hero-discipline" onChange={(event) => onDiscipline(event.target.value)} value={discipline}>
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
          </form>
        </div>

        <aside className="emc-zone-finder" aria-label="Selección rápida por zona">
          <div className="emc-zone-finder-head">
            <div>
              <div className="emc-kicker">Mapa vivo</div>
              <h2>Explora por zona</h2>
            </div>
            <span>{zone}</span>
          </div>
          <div className="emc-micro-map">
            <img className="emc-micro-spain" src="/maps/spain-map.svg" alt="" aria-hidden="true" />
            {zones.map((item) => (
              <button
                className={`emc-micro-dot ${zoneClassName(item.name)} ${zone === item.name ? "emc-active" : ""}`}
                key={item.name}
                onClick={() => onZone(item.name)}
                style={{ background: item.color }}
                type="button"
              >
                {item.events.length}
              </button>
            ))}
          </div>
        </aside>
      </div>
    </header>
  );
}
