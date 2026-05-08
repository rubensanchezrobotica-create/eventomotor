import Link from "next/link";
import { formatRange, getDisciplineColor } from "@/lib/date-utils";
import { getEventDistanceKm, type UserLocation } from "@/lib/geo";
import type { EventItem } from "@/types/event";
import type { ConceptIntent } from "./concept-model";
import { dayLabel, eventHref } from "./concept-model";

type ConceptResultsProps = {
  intents: ConceptIntent[];
  filtered: EventItem[];
  activeLabel: string;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  onIntent: (label: string, terms: string[]) => void;
  userLocation: UserLocation | null;
};

export default function ConceptResults({
  intents,
  filtered,
  activeLabel,
  hasActiveFilters,
  onClearFilters,
  onIntent,
  userLocation,
}: ConceptResultsProps) {
  return (
    <>
      <section className="emc-section" id="formas">
        <div className="emc-container">
          <div className="emc-section-head">
            <div><div className="emc-kicker">Una experiencia genuina</div><h2>No solo disciplinas. Formas de vivir el motor.</h2></div>
            <p>La navegación se organiza por intención del usuario, usando coincidencias reales en títulos, disciplinas y etiquetas.</p>
          </div>
          <div className="emc-intent-grid">
            {intents.map((intent, index) => (
              <button className="emc-intent-card" key={intent.label} onClick={() => onIntent(intent.label, intent.terms)} type="button">
                <div className="emc-intent-icon" style={{ color: intent.color }}>{String(index + 1).padStart(2, "0")}</div>
                <h3>{intent.label}</h3>
                <p>{intent.events.length ? "Eventos encontrados con esta intención." : "Sin coincidencias directas en los eventos actuales."}</p>
                <div className="emc-intent-number">{intent.events.length}</div>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="emc-section emc-results-section">
        <div className="emc-container">
          <div className="emc-results-context">
            <div>
              <span className="emc-kicker">Resultados filtrados</span>
              <strong>{activeLabel}</strong>
              <p>{filtered.length} próximos eventos en esta vista.</p>
            </div>
            {hasActiveFilters ? (
              <button className="emc-btn emc-btn-light" onClick={onClearFilters} type="button">
                Ver todos
              </button>
            ) : null}
          </div>

          <div className="emc-section-head">
            <div><div className="emc-kicker">Resultados reales</div><h2>Eventos encontrados</h2></div>
            <p>Cards conectadas a la ficha real del evento, manteniendo el lenguaje visual de la propuesta.</p>
          </div>
          <div className="emc-results-grid">
            {filtered.slice(0, 9).map((event) => {
              const label = dayLabel(event);
              const color = getDisciplineColor(event.discipline);
              const distance = userLocation ? getEventDistanceKm(event, userLocation) : null;
              return (
                <Link className="emc-result-card" href={eventHref(event)} key={event.id} style={{ "--emc-card-accent": color.accent } as React.CSSProperties}>
                  <div className="emc-result-date">{label.day}<small>{label.month}</small></div>
                  <div>
                    <div className="emc-result-meta">
                      <span className="emc-badge">{event.discipline}</span>
                      {distance !== null ? <span className="emc-distance">Aprox. {Math.round(distance)} km</span> : null}
                    </div>
                    <h3>{event.title}</h3>
                    <p>{formatRange(event)} / {event.city}, {event.province}</p>
                    <span className="emc-card-action">Ver evento</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="emc-section" id="organizadores">
        <div className="emc-container">
          <div className="emc-panel emc-pro-panel">
            <div>
              <div className="emc-kicker">Para organizadores</div>
              <h2>Ser visible donde el usuario decide su próximo plan</h2>
              <p className="emc-pro-copy">Publica tu evento en EventoMotor y llega a usuarios que buscan planes de motor por fecha, zona y disciplina.</p>
              <div className="emc-pro-actions">
                <a className="emc-btn emc-btn-primary" href="mailto:hola@eventomotor.com?subject=Publicar%20evento%20en%20EventoMotor">Publicar evento</a>
              </div>
            </div>
            <div className="emc-checks">
              <div className="emc-check"><strong>Mapa</strong><span>visibilidad por zona</span></div>
              <div className="emc-check"><strong>Agenda</strong><span>fechas claras</span></div>
              <div className="emc-check"><strong>Filtro</strong><span>disciplina e intención</span></div>
              <div className="emc-check"><strong>Ficha</strong><span>detalle del evento</span></div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
