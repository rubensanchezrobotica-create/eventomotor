"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { currentPagePath, eventAnalyticsParams, trackEvent } from "@/lib/analytics";
import { formatRange, getDisciplineColor } from "@/lib/date-utils";
import { getEventDistanceKm, type UserLocation } from "@/lib/geo";
import type { EventItem } from "@/types/event";
import type { ConceptZone } from "./concept-model";
import { dayLabel, eventHref } from "./concept-model";

type ExplorerView = "lista" | "calendario" | "mapa";

export type ExplorerSummaryVariant = "default" | "concise";

export function conciseExplorerSummary(count: number) {
  const eventLabel = count === 1 ? "evento" : "eventos";
  const upcomingLabel = count === 1 ? "próximo" : "próximos";
  return `${count} ${eventLabel} ${upcomingLabel} con los filtros actuales.`;
}

type ConceptEventExplorerProps = {
  activeLabel: string;
  activeFilterChips: string[];
  calendar: ReactNode;
  filtered: EventItem[];
  hasActiveFilters: boolean;
  userLocation: UserLocation | null;
  view: ExplorerView;
  zone: string;
  zones: ConceptZone[];
  onClearFilters: () => void;
  onView: (view: ExplorerView) => void;
  onZone: (zone: string) => void;
  summaryVariant?: ExplorerSummaryVariant;
};

const VIEWS: Array<{ id: ExplorerView; label: string }> = [
  { id: "calendario", label: "Calendario" },
  { id: "lista", label: "Lista" },
  { id: "mapa", label: "Mapa" },
];

export default function ConceptEventExplorer({
  activeLabel,
  activeFilterChips,
  calendar,
  filtered,
  hasActiveFilters,
  userLocation,
  view,
  zone,
  zones,
  onClearFilters,
  onView,
  onZone,
  summaryVariant = "default",
}: ConceptEventExplorerProps) {
  const visibleEvents = filtered.slice(0, 12);

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
    <section className="emc-section emc-explorer-section" id="calendario">
      <div className="emc-container">
        <div className="emc-explorer-shell">
          <div className="emc-explorer-head">
            <div>
              <div className="emc-kicker">Explorador</div>
              <h2>Calendario de eventos</h2>
              <p>
                {summaryVariant === "concise"
                  ? conciseExplorerSummary(filtered.length)
                  : `${activeLabel}. ${filtered.length} eventos visibles con los filtros actuales.`}
              </p>
              <p className="emc-calendar-helper">Pulsa una fecha para ver los eventos de ese día.</p>
            </div>
            <div className="emc-view-tabs" aria-label="Cambiar vista">
              {VIEWS.map((item) => (
                <button
                  className={view === item.id ? "emc-active" : ""}
                  key={item.id}
                  onClick={() => onView(item.id)}
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {hasActiveFilters ? (
            <div className="emc-active-filter-bar">
              <span>Filtros activos</span>
              <div className="emc-active-filter-chips">
                {(activeFilterChips.length ? activeFilterChips : [activeLabel]).map((item) => (
                  <strong key={item}>{item}</strong>
                ))}
              </div>
              <button onClick={onClearFilters} type="button">Quitar filtro</button>
            </div>
          ) : null}

          {view === "lista" ? (
            <div className="emc-list-view">
              <div className="emc-event-list">
                {visibleEvents.map((event) => {
                  const label = dayLabel(event);
                  const color = getDisciplineColor(event.discipline);
                  const distance = userLocation ? getEventDistanceKm(event, userLocation) : null;

                  return (
                    <Link
                      className={`emc-list-card ${event.featured ? "emc-featured-list-card" : ""}`}
                      href={eventHref(event)}
                      key={event.id}
                      onClick={() => trackEvent("click_event_detail", {
                        ...eventAnalyticsParams(event),
                        discipline: event.discipline,
                        zone: event.region || event.province,
                        vehicle_type: event.vehicleType || event.vehicle_type || "otros",
                        page_path: currentPagePath(),
                      })}
                      style={{ "--emc-card-accent": color.accent } as CSSProperties}
                    >
                      <div className="emc-result-date">{label.day}<small>{label.month}</small></div>
                      <div>
                        <div className="emc-result-meta">
                          {event.featured ? <span className="emc-badge emc-featured-badge">Destacado</span> : null}
                          <span className="emc-badge">{event.discipline}</span>
                          {distance !== null ? <span className="emc-distance">Aprox. {Math.round(distance)} km</span> : null}
                        </div>
                        <h3>{event.title}</h3>
                        <p>{formatRange(event)} / {event.city}, {event.province}</p>
                      </div>
                      <span className="emc-card-action">Ver evento</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : null}

          {view === "calendario" ? calendar : null}

          {view === "mapa" ? (
            <div className="emc-map-view">
              <div className="emc-map-stage">
                <img className="emc-micro-spain" src="/maps/spain-map.svg" alt="" aria-hidden="true" />
                {zones.map((item) => (
                  <button
                    className={`emc-micro-dot ${zoneClassName(item.name)} ${zone === item.name ? "emc-active" : ""}`}
                    key={item.name}
                    onClick={() => {
                      trackEvent("filter_zone", {
                        zone: item.name,
                        page_path: currentPagePath(),
                      });
                      onZone(item.name);
                    }}
                    style={{ background: item.color }}
                    type="button"
                  >
                    {item.events.length}
                  </button>
                ))}
              </div>
              <div className="emc-zone-list">
                <button
                  className={zone === "Toda España" ? "emc-active" : ""}
                  onClick={() => {
                    trackEvent("filter_zone", {
                      zone: "Toda España",
                      page_path: currentPagePath(),
                    });
                    onZone("Toda España");
                  }}
                  type="button"
                >
                  <strong>Toda España</strong>
                  <span>{filtered.length} eventos visibles</span>
                </button>
                {zones.map((item) => (
                  <button
                    className={zone === item.name ? "emc-active" : ""}
                    key={item.name}
                    onClick={() => {
                      trackEvent("filter_zone", {
                        zone: item.name,
                        page_path: currentPagePath(),
                      });
                      onZone(item.name);
                    }}
                    type="button"
                  >
                    <strong>{item.name}</strong>
                    <span>{item.upcoming.length} próximos / {item.provinces.slice(0, 3).join(", ")}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
