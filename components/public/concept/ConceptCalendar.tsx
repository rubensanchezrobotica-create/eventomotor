"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { currentPagePath, eventAnalyticsParams, trackEvent, urlDomain } from "@/lib/analytics";
import { MONTHS, TODAY, WEEK_DAYS, formatRange, isOnDay, parseDate } from "@/lib/date-utils";
import type { EventItem } from "@/types/event";
import type { ConceptZone } from "./concept-model";
import { eventHref } from "./concept-model";

type VehicleMainFilter = "todos" | "moto" | "coche";

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
  useCountGrammar?: boolean;
};

export function grammaticalMonthSummary(eventCount: number, disciplineCount: number) {
  const eventLabel = eventCount === 1 ? "evento" : "eventos";
  const disciplineLabel = disciplineCount === 1 ? "disciplina" : "disciplinas";
  return `${eventCount} ${eventLabel} / ${disciplineCount} ${disciplineLabel}`;
}

function vehicleLabel(event: EventItem) {
  const value = event.vehicleType || event.vehicle_type;
  if (value === "moto") return "Moto";
  if (value === "coche") return "Coche";
  if (value === "mixto") return "Mixto";
  if (value === "karting") return "Karting";
  return value || "Otros";
}

function vehicleKind(event: EventItem) {
  return event.vehicleType || event.vehicle_type || "otros";
}

function eventZone(event: EventItem) {
  return event.region || event.province || "";
}

function vehicleDotColor(event: EventItem) {
  const value = vehicleKind(event);
  if (value === "moto") return "#ff3b00";
  if (value === "coche") return "#4ba3ff";
  if (value === "mixto") return "#18d889";
  if (value === "karting") return "#ffd15c";
  return "#a78bfa";
}

function modalDateBadge(event: EventItem) {
  const start = parseDate(event.start);
  const end = parseDate(event.end);
  const startMonth = new Intl.DateTimeFormat("es-ES", { month: "short" }).format(start).replace(".", "").toUpperCase();
  const endMonth = new Intl.DateTimeFormat("es-ES", { month: "short" }).format(end).replace(".", "").toUpperCase();

  if (start.toDateString() === end.toDateString()) {
    return { day: String(start.getDate()), month: startMonth };
  }

  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return { day: `${start.getDate()}-${end.getDate()}`, month: startMonth };
  }

  return { day: `${start.getDate()} ${startMonth}`, month: `${end.getDate()} ${endMonth}` };
}

export default function ConceptCalendar({
  year,
  month,
  setMonth,
  days,
  agendaDay,
  monthEventCount,
  monthDisciplineCount,
  filtered,
  onThisMonth,
  onDay,
  useCountGrammar = false,
}: ConceptCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [modalVehicleFilter, setModalVehicleFilter] = useState<"todos" | "moto" | "coche">("todos");
  const [isMounted, setIsMounted] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  const selectedDateEvents = useMemo(() => {
    if (!selectedDate) return [];
    return filtered.filter((event) => isOnDay(event, selectedDate));
  }, [filtered, selectedDate]);

  const isDayModalOpen = Boolean(selectedDate && selectedDateEvents.length);

  const modalDateLabel = selectedDate
    ? new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long" }).format(selectedDate)
    : "";

  const vehicleSummary = useMemo(() => {
    return selectedDateEvents.reduce<Record<string, number>>((summary, event) => {
      const label = vehicleLabel(event);
      summary[label] = (summary[label] || 0) + 1;
      return summary;
    }, {});
  }, [selectedDateEvents]);

  const hasModalVehicleFilters =
    Object.keys(vehicleSummary).length > 1 &&
    selectedDateEvents.some((event) => vehicleKind(event) === "moto" || vehicleKind(event) === "coche");

  const visibleModalEvents = useMemo(() => {
    if (modalVehicleFilter === "todos") return selectedDateEvents;
    return selectedDateEvents.filter((event) => vehicleKind(event) === modalVehicleFilter);
  }, [modalVehicleFilter, selectedDateEvents]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isDayModalOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.setTimeout(() => closeButtonRef.current?.focus(), 0);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setSelectedDate(null);
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDayModalOpen]);

  useEffect(() => {
    if (selectedDate && !selectedDateEvents.length) {
      setSelectedDate(null);
    }
  }, [selectedDate, selectedDateEvents.length]);

  useEffect(() => {
    setModalVehicleFilter("todos");
  }, [selectedDate]);

  function openDay(day: Date, dayEvents: EventItem[]) {
    if (!dayEvents.length) return;
    trackEvent("open_calendar_day", {
      date: day.toISOString().slice(0, 10),
      events_count: dayEvents.length,
      page_path: currentPagePath(),
    });
    onDay(day);
    setSelectedDate(day);
  }

  const dayModal = isDayModalOpen && selectedDateEvents.length ? (
    <div
      className="emc-day-modal"
      onClick={(event) => {
        if (event.target === event.currentTarget) setSelectedDate(null);
      }}
      role="presentation"
    >
      <section aria-labelledby="emc-day-modal-title" aria-modal="true" className="emc-day-modal-panel" role="dialog">
        <div className="emc-day-modal-head">
          <div>
            <span className="emc-kicker">Agenda del día</span>
            <h3 id="emc-day-modal-title">Eventos del {modalDateLabel}</h3>
            <p>{selectedDateEvents.length} eventos encontrados con los filtros actuales.</p>
            {hasModalVehicleFilters ? (
              <div className="emc-day-modal-filters" aria-label="Filtrar eventos del día por tipo">
                {[
                  { id: "todos", label: "Todos" },
                  { id: "moto", label: "Motos" },
                  { id: "coche", label: "Coches" },
                ].map((item) => (
                  <button
                    className={modalVehicleFilter === item.id ? "emc-active" : ""}
                    key={item.id}
                    onClick={() => {
                      trackEvent("filter_vehicle_type", {
                        vehicle_type: item.id,
                        page_path: currentPagePath(),
                      });
                      setModalVehicleFilter(item.id as "todos" | "moto" | "coche");
                    }}
                    type="button"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="emc-day-modal-head-side">
            <span className="emc-badge">{visibleModalEvents.length} eventos</span>
            <button
              ref={closeButtonRef}
              aria-label="Cerrar eventos del día"
              className="emc-day-modal-close"
              onClick={() => setSelectedDate(null)}
              type="button"
            >
              ×
            </button>
          </div>
        </div>
        <div className="emc-day-modal-list">
          {visibleModalEvents.map((event) => {
            const label = modalDateBadge(event);
            const type = vehicleLabel(event);

            return (
              <article className="emc-event-row emc-modal-event-row" key={event.id}>
                <div className="emc-datebox">
                  {label.day}
                  <small>{label.month}</small>
                </div>
                <div>
                  <div className="emc-event-chipline">
                    <span className="emc-badge">{event.discipline}</span>
                    {type ? <span className="emc-vehicle-mini">{type}</span> : null}
                  </div>
                  <h4>{event.title}</h4>
                  <p>
                    {formatRange(event)} / {event.city}, {event.province}
                  </p>
                  {event.source || event.sourceUrl ? (
                    <p className="emc-event-source">
                      {event.source ? `Fuente: ${event.source}` : null}
                      {event.sourceUrl ? (
                        <a
                          href={event.sourceUrl}
                          onClick={() => trackEvent("click_official_source", {
                            ...eventAnalyticsParams(event),
                            source: event.source,
                            page_path: currentPagePath(),
                          })}
                          rel="noreferrer"
                          target="_blank"
                        >Fuente oficial</a>
                      ) : null}
                    </p>
                  ) : null}
                </div>
                <div className="emc-event-actions">
                  <Link
                    className="emc-card-action"
                    href={eventHref(event)}
                    onClick={() => trackEvent("click_event_detail", {
                      ...eventAnalyticsParams(event),
                      discipline: event.discipline,
                      zone: eventZone(event),
                      vehicle_type: vehicleKind(event),
                      page_path: currentPagePath(),
                    })}
                  >
                    Ver evento
                  </Link>
                  {event.ticketUrl ? (
                    <a
                      className="emc-ticket-action"
                      href={event.ticketUrl}
                      onClick={() => trackEvent("click_tickets", {
                        ...eventAnalyticsParams(event),
                        source: event.source,
                        ticket_url_domain: urlDomain(event.ticketUrl),
                        page_path: currentPagePath(),
                      })}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Entradas
                    </a>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  ) : null;

  return (
    <div className="emc-calendar-embed" id="calendario-vista">
      <div className="emc-calendar-wrap">
        <div className="emc-panel emc-calendar-panel">
          <div className="emc-calendar-toolbar">
            <div className="emc-month-title">
              <h3>
                {MONTHS[month]} {year}
              </h3>
              <p>
                {useCountGrammar
                  ? grammaticalMonthSummary(monthEventCount, monthDisciplineCount)
                  : `${monthEventCount} eventos / ${monthDisciplineCount} disciplinas`}
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
                Este mes
              </button>
            </div>
          </div>

          <div className="emc-calendar-legend" aria-label="Leyenda de tipos de evento">
            <span><i style={{ background: "#ff3b00" }} />Moto</span>
            <span><i style={{ background: "#4ba3ff" }} />Coche</span>
            <span><i style={{ background: "#18d889" }} />Mixto</span>
            <span><i style={{ background: "#ffd15c" }} />Karting/Otros</span>
          </div>

          <div className="emc-weekdays">
            {WEEK_DAYS.map((day) => (
              <div key={day}>{day}</div>
            ))}
          </div>
          <div className="emc-month">
            {days.map((day) => {
              const dayEvents = filtered.filter((event) => isOnDay(event, day));
              const isFocused = agendaDay.toDateString() === day.toDateString() && dayEvents.length > 0;
              const isModalSelected = selectedDate?.toDateString() === day.toDateString();
              const isToday = TODAY.toDateString() === day.toDateString();

              return (
                <button
                  aria-label={
                    dayEvents.length
                      ? `${day.getDate()} de ${MONTHS[day.getMonth()]}, ${dayEvents.length} eventos`
                      : `${day.getDate()} de ${MONTHS[day.getMonth()]}, sin eventos`
                  }
                  className={`emc-day ${dayEvents.length ? "emc-has" : ""} ${isFocused ? "emc-focus" : ""} ${isModalSelected ? "emc-modal-selected" : ""} ${isToday ? "emc-today" : ""}`}
                  key={day.toISOString()}
                  onClick={() => openDay(day, dayEvents)}
                  type="button"
                >
                  <span className="emc-day-number">{day.getDate()}</span>
                  {dayEvents.length ? <small>{dayEvents.length}</small> : null}
                  <span className="emc-dots">
                    {dayEvents.slice(0, 5).map((event) => (
                      <span
                        className="emc-edot"
                        key={event.id}
                        style={{ background: vehicleDotColor(event) }}
                      />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {isMounted && dayModal ? createPortal(dayModal, document.body) : null}
    </div>
  );
}
