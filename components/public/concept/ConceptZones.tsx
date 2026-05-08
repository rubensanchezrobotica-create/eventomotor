import Link from "next/link";
import type React from "react";
import type { EventItem } from "@/types/event";
import type { ConceptZone } from "./concept-model";
import { eventHref, eventLine } from "./concept-model";

type ConceptZonesProps = {
  zones: ConceptZone[];
  selectedZone: string;
  activeZone: {
    name: string;
    events: EventItem[];
    upcoming: EventItem[];
    provinces: string[];
    description: string;
  };
  activeLabel: string;
  hasActiveFilters: boolean;
  filteredCount: number;
  highlightedCount: number;
  monthCount: number;
  disciplineCount: number;
  onZone: (name: string) => void;
  onClearZone: () => void;
  onClearFilters: () => void;
  onCalendar: () => void;
};

export default function ConceptZones({
  zones,
  selectedZone,
  activeZone,
  activeLabel,
  hasActiveFilters,
  filteredCount,
  highlightedCount,
  monthCount,
  disciplineCount,
  onZone,
  onClearZone,
  onClearFilters,
  onCalendar,
}: ConceptZonesProps) {
  return (
    <section className="emc-section" id="explorar">
      <div className="emc-container">
        <div className="emc-section-head">
          <div>
            <div className="emc-kicker">Exploración principal</div>
            <h2>Elige zona y afina después en el calendario.</h2>
          </div>
          <p>Empieza por territorio si lo tienes claro. Después, el calendario reúne búsqueda, disciplina, zona e intención en un solo lugar.</p>
        </div>

        <div className="emc-discovery-bar">
          <div>
            <span className="emc-kicker">Búsqueda actual</span>
            <strong>{activeLabel}</strong>
            <p>{filteredCount} próximos eventos encontrados.</p>
          </div>
          <div className="emc-discovery-actions">
            {selectedZone !== "España" ? (
              <button className="emc-btn emc-btn-dark" onClick={onClearZone} type="button">
                Quitar zona
              </button>
            ) : null}
            {hasActiveFilters ? (
              <button className="emc-btn emc-btn-light" onClick={onClearFilters} type="button">
                Ver todos
              </button>
            ) : null}
            <button className="emc-btn emc-btn-primary" onClick={onCalendar} type="button">
              Ver calendario
            </button>
          </div>
        </div>

        <div className="emc-explorer">
          <div className="emc-panel emc-zone-board">
            <div className="emc-map-bg" />
            <div className="emc-zone-board-head">
              <div>
                <div className="emc-kicker">Explora por zonas</div>
                <h3>Actividad real por territorio</h3>
              </div>
              <p>Las zonas aparecen solo si tienen eventos reales asociados. Cada card aplica el filtro y lleva a resultados.</p>
            </div>

            <div className="emc-zone-card-grid">
              <button
                className={`emc-zone-card emc-zone-card-all ${selectedZone === "España" ? "emc-selected" : ""}`}
                onClick={onClearZone}
                type="button"
              >
                <span className="emc-zone-card-top">
                  <span>
                    <strong>Toda España</strong>
                    <small>{selectedZone === "España" ? "Vista nacional activa" : "Quitar solo el filtro de zona"}</small>
                  </span>
                  <span className="emc-zone-count">{filteredCount}</span>
                </span>
                <span className="emc-zone-card-action">{selectedZone === "España" ? "Ver calendario completo" : "Quitar zona"}</span>
              </button>

              {zones.map((item) => (
                <button
                  className={`emc-zone-card ${selectedZone === item.name ? "emc-selected" : ""}`}
                  key={item.name}
                  onClick={() => onZone(item.name)}
                  style={{ "--emc-zone-accent": item.color } as React.CSSProperties}
                  type="button"
                >
                  <span className="emc-zone-card-top">
                    <span>
                      <strong>{item.name}</strong>
                      <small>{item.provinces.slice(0, 3).join(" / ") || "Zona nacional"}</small>
                    </span>
                    <span className="emc-zone-count">{item.events.length}</span>
                  </span>
                  <span className="emc-zone-card-action">Ver eventos en la zona</span>
                </button>
              ))}
            </div>

            <div className="emc-map-note">Navegación territorial estable, sin clusters móviles ni efectos que cambien el área interactiva.</div>
          </div>

          <aside className="emc-side-stack">
            <div className="emc-panel emc-zone-detail">
              <div className="emc-kicker">{selectedZone === "España" ? "Selección actual" : "Zona seleccionada"}</div>
              <h3>{activeZone.name}</h3>
              <p>{activeZone.description}</p>
              <div className="emc-summary-grid">
                <div className="emc-summary"><strong>{activeZone.events.length}</strong><span>eventos visibles</span></div>
                <div className="emc-summary"><strong>{activeZone.provinces.length}</strong><span>provincias</span></div>
              </div>
              <div className="emc-zone-events">
                {activeZone.upcoming.slice(0, 2).map((event) => (
                  <Link className="emc-zone-event" href={eventHref(event)} key={event.id}>
                    <div><strong>{event.title}</strong><br /><span>{eventLine(event)}</span></div>
                    <span>{event.discipline}</span>
                  </Link>
                ))}
              </div>
            </div>

            <div className="emc-panel">
              <div className="emc-kicker">Datos de esta vista</div>
              <div className="emc-summary-grid">
                <div className="emc-summary"><strong>{filteredCount}</strong><span>resultados</span></div>
                <div className="emc-summary"><strong>{highlightedCount}</strong><span>destacados</span></div>
                <div className="emc-summary"><strong>{monthCount}</strong><span>este mes</span></div>
                <div className="emc-summary"><strong>{disciplineCount}</strong><span>disciplinas</span></div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
