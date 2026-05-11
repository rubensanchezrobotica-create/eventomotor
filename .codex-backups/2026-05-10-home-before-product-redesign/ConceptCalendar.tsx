import Link from "next/link";
import { MONTHS, TODAY, WEEK_DAYS, formatRange, getDisciplineColor, isOnDay } from "@/lib/date-utils";
import type { EventItem } from "@/types/event";
import type { ConceptZone } from "./concept-model";
import { dayLabel, eventHref } from "./concept-model";

type VehicleMainFilter = "todos" | "moto" | "coche";

const VEHICLE_FILTERS: Array<{ id: VehicleMainFilter; label: string }> = [
  { id: "todos", label: "Todos" },
  { id: "moto", label: "Motos" },
  { id: "coche", label: "Coches" },
];

type ConceptCalendarProps = {
  year: number;
  month: number;
  setMonth: (updater: (current: number) => number) => void;
  days: Date[];
  agendaDay: Date;
  selectedDayEvents: EventItem[];
  fallbackEvents: EventItem[];
  monthEventCount: number;
  monthDisciplineCount: number;
  filtered: EventItem[];
  activeLabel: string;
  hasActiveFilters: boolean;
  query: string;
  discipline: string;
  zone: string;
  vehicleFilter: VehicleMainFilter;
  disciplines: string[];
  zones: ConceptZone[];
  setQuery: (value: string) => void;
  setDiscipline: (value: string) => void;
  onVehicle: (filter: VehicleMainFilter) => void;
  onZoneSelect: (value: string) => void;
  onThisMonth: () => void;
  onDay: (day: Date) => void;
  onClearFilters: () => void;
};

export default function ConceptCalendar({
  year,
  month,
  setMonth,
  days,
  agendaDay,
  selectedDayEvents,
  fallbackEvents,
  monthEventCount,
  monthDisciplineCount,
  filtered,
  activeLabel,
  hasActiveFilters,
  query,
  discipline,
  zone,
  vehicleFilter,
  disciplines,
  zones,
  setQuery,
  setDiscipline,
  onVehicle,
  onZoneSelect,
  onThisMonth,
  onDay,
  onClearFilters,
}: ConceptCalendarProps) {
  const fallbackAgenda = fallbackEvents.slice(0, 3);
  const dateLabel = new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "long",
  }).format(agendaDay);

  return (
    <section className="emc-section" id="calendario">
      <div className="emc-container">
        <div className="emc-calendar-wrap" id="calendario-vista">
          <div className="emc-panel emc-calendar-panel">
            <div className="emc-filter-status">
              <div className="emc-filter-status-head">
                <div>
                  <span className="emc-kicker">Calendario</span>
                  <strong>{activeLabel}</strong>
                  <p>{filtered.length} próximos eventos.</p>
                </div>
                <div className="emc-calendar-filter-actions">
                  <button className="emc-btn emc-btn-dark" onClick={onThisMonth} type="button">
                    Este mes
                  </button>
                  {hasActiveFilters ? (
                    <button className="emc-btn emc-btn-light" onClick={onClearFilters} type="button">
                      Ver todos
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="emc-calendar-vehicle-row">
                <span>Tipo</span>
                <div className="emc-vehicle-tabs emc-vehicle-tabs-calendar" aria-label="Tipo de vehículo">
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

              <div className="emc-calendar-fields">
                <div className="emc-field">
                  <label>Buscar</label>
                  <input
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Evento, circuito, ciudad..."
                    value={query}
                  />
                </div>
                <div className="emc-field">
                  <label>Disciplina</label>
                  <select onChange={(event) => setDiscipline(event.target.value)} value={discipline}>
                    <option>Todas</option>
                    {disciplines.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </div>
                <div className="emc-field">
                  <label>Zona</label>
                  <select onChange={(event) => onZoneSelect(event.target.value)} value={zone}>
                    <option>Toda España</option>
                    {zones.map((item) => (
                      <option key={item.name}>{item.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="emc-calendar-toolbar">
              <div className="emc-month-title">
                <h3>
                  {MONTHS[month]} {year}
                </h3>
                <p>
                  {monthEventCount} eventos / {monthDisciplineCount} disciplinas
                </p>
              </div>
              <div className="emc-month-actions">
                <button className="emc-icon" onClick={() => setMonth((current) => (current + 11) % 12)} type="button">
                  ‹
                </button>
                <button className="emc-icon" onClick={() => setMonth((current) => (current + 1) % 12)} type="button">
                  ›
                </button>
                <button className="emc-btn emc-btn-dark" onClick={() => setMonth(() => TODAY.getMonth())} type="button">
                  Hoy
                </button>
              </div>
            </div>

            <div className="emc-weekdays">
              {WEEK_DAYS.map((day) => (
                <div key={day}>{day}</div>
              ))}
            </div>
            <div className="emc-month">
              {days.map((day) => {
                const dayEvents = filtered.filter((event) => isOnDay(event, day));
                const isFocused = agendaDay.toDateString() === day.toDateString();
                const isToday = TODAY.toDateString() === day.toDateString();
                return (
                  <button
                    className={`emc-day ${dayEvents.length ? "emc-has" : ""} ${isFocused ? "emc-focus" : ""} ${isToday ? "emc-today" : ""}`}
                    key={day.toISOString()}
                    onClick={() => onDay(day)}
                    type="button"
                  >
                    {day.getDate()}
                    {dayEvents.length ? <small>{dayEvents.length}</small> : null}
                    <span className="emc-dots">
                      {dayEvents.slice(0, 5).map((event) => (
                        <span
                          className="emc-edot"
                          key={event.id}
                          style={{ background: getDisciplineColor(event.discipline).accent }}
                        />
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <aside className="emc-panel">
            <div className="emc-agenda-head">
              <div>
                <div className="emc-kicker">Agenda del día</div>
                <h3>Eventos del {dateLabel}</h3>
              </div>
              <span className="emc-badge">{selectedDayEvents.length} eventos</span>
            </div>
            <div className="emc-agenda">
              {selectedDayEvents.length ? (
                selectedDayEvents.map((event) => {
                  const label = dayLabel(event);
                  return (
                    <article className="emc-event-row" key={event.id}>
                      <div className="emc-datebox">
                        {label.day}
                        <small>{label.month}</small>
                      </div>
                      <div>
                        <span className="emc-badge">{event.discipline}</span>
                        <h4>{event.title}</h4>
                        <p>
                          {formatRange(event)} / {event.city}, {event.province}
                        </p>
                      </div>
                      <div className="emc-event-actions">
                        <Link className="emc-card-action" href={eventHref(event)}>
                          Ver evento
                        </Link>
                        {event.ticketUrl ? (
                          <a className="emc-ticket-action" href={event.ticketUrl} rel="noreferrer" target="_blank">
                            Entradas
                          </a>
                        ) : null}
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="emc-agenda-empty">
                  <h4>No hay eventos este día</h4>
                  <p>Estos son los próximos eventos disponibles con la búsqueda actual.</p>
                  <div className="emc-agenda">
                    {fallbackAgenda.map((event) => {
                      const label = dayLabel(event);
                      return (
                        <Link className="emc-event-row emc-event-row-compact" href={eventHref(event)} key={event.id}>
                          <div className="emc-datebox">
                            {label.day}
                            <small>{label.month}</small>
                          </div>
                          <div>
                            <h4>{event.title}</h4>
                            <p>
                              {event.city} / {event.province}
                            </p>
                          </div>
                          <span className="emc-badge">{event.discipline}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
