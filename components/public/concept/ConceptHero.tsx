import Link from "next/link";
import { formatRange, getDisciplineColor } from "@/lib/date-utils";
import type { EventItem } from "@/types/event";
import type { ConceptZone } from "./concept-model";
import { dayLabel, eventHref } from "./concept-model";

type ConceptHeroProps = {
  zones: ConceptZone[];
  metrics: Array<{ label: string; value: number }>;
  highlightedEvents: EventItem[];
  isLoading: boolean;
  onSearch: () => void;
  onZone: (name: string) => void;
};

export default function ConceptHero({
  zones,
  metrics,
  highlightedEvents,
  isLoading,
  onSearch,
  onZone,
}: ConceptHeroProps) {
  return (
    <header className="emc-hero">
      <div className="emc-container emc-hero-grid">
        <div>
          <div className="emc-eyebrow">La brújula del motor en España</div>
          <h1>
            Descubre dónde late el motor. <span>Sin ruido. Sin perderte.</span>
          </h1>
          <p className="emc-hero-copy">
            Empieza por el calendario: busca por circuito, provincia, disciplina o tipo de plan y encuentra el evento real que encaja contigo.
          </p>
          <div className="emc-hero-actions">
            <button className="emc-btn emc-btn-primary" onClick={onSearch} type="button">
              Buscar eventos
            </button>
            <a className="emc-btn emc-btn-light" href="#explorar">
              Explorar zonas
            </a>
          </div>
          <div className="emc-trust">
            <span>Eventos reales</span>
            <span>Calendario como punto de partida</span>
            <span>Zonas e intenciones como apoyo</span>
          </div>
          <div className="emc-metrics-strip">
            {metrics.map((item) => (
              <div className="emc-metric" key={item.label}>
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="emc-north-star">
          <div className="emc-product">
            <div className="emc-product-top">
              <div className="emc-traffic">
                <i />
                <i />
                <i />
              </div>
              <div className="emc-url">eventomotor.es/brujula</div>
            </div>
            <div className="emc-product-body">
              <div className="emc-mini-panel">
                <div className="emc-mini-head">
                  <h3>Zonas activas</h3>
                  <span>España</span>
                </div>
                <div className="emc-micro-map">
                  <div className="emc-micro-spain" />
                  {zones.slice(0, 5).map((item, index) => (
                    <button
                      className={`emc-micro-dot emc-md${index + 1}`}
                      key={item.name}
                      onClick={() => onZone(item.name)}
                      style={{ background: item.color }}
                      type="button"
                    >
                      {item.events.length}
                    </button>
                  ))}
                </div>
              </div>
              <div className="emc-mini-panel">
                <div className="emc-mini-head">
                  <h3>Próximos planes</h3>
                  <span>Relevancia</span>
                </div>
                <div className="emc-timeline">
                  {highlightedEvents.map((event) => {
                    const label = dayLabel(event);
                    return (
                      <Link className="emc-timeline-row" href={eventHref(event)} key={event.id}>
                        <div className="emc-date-pill">{label.day}</div>
                        <div>
                          <h4>{event.title}</h4>
                          <p>
                            {event.city} / {event.province} / {formatRange(event)}
                          </p>
                        </div>
                        <span className="emc-status" style={{ color: getDisciplineColor(event.discipline).accent }}>
                          {event.discipline}
                        </span>
                      </Link>
                    );
                  })}
                  {!highlightedEvents.length ? (
                    <p className="emc-empty">{isLoading ? "Cargando eventos..." : "No hay próximos eventos visibles."}</p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
