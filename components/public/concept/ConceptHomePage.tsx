"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ConceptCalendar from "@/components/public/concept/ConceptCalendar";
import ConceptDisciplineExplorer, {
  DISCIPLINE_CATEGORIES,
  matchesDisciplineCategory,
  type DisciplineCategoryId,
} from "@/components/public/concept/ConceptDisciplineExplorer";
import ConceptEventExplorer from "@/components/public/concept/ConceptEventExplorer";
import ConceptFooter from "@/components/public/concept/ConceptFooter";
import ConceptHeader from "@/components/public/concept/ConceptHeader";
import ConceptHero from "@/components/public/concept/ConceptHero";
import {
  readStoredLocation,
  removeStoredLocation,
  saveLocation,
} from "@/components/public/concept/ConceptLocationPanel";
import ConceptResults from "@/components/public/concept/ConceptResults";
import ConceptStyles from "@/components/public/concept/ConceptStyles";
import ConceptZoneExplorer from "@/components/public/concept/ConceptZoneExplorer";
import {
  API_EVENTS_URL,
  AUTO_REFRESH_MS,
  TODAY,
  addDays,
  daysForMonth,
  isOnDay,
  parseDate,
  statusOf,
} from "@/lib/date-utils";
import { matchesVehicleFilter } from "@/lib/event-classification";
import { sortEventsByDistance, type UserLocation } from "@/lib/geo";
import { normalizeRemoteEvents } from "@/lib/normalizers";
import type { EventItem } from "@/types/event";
import {
  buildZones,
  eventText,
  matchesTerms,
  unique,
} from "./concept-model";

type VehicleMainFilter = "todos" | "moto" | "coche";
type ExplorerView = "lista" | "calendario" | "mapa";
type DateQuickFilter = "todos" | "hoy" | "fin-semana" | "mes" | "30-dias";
const POPULAR_SEARCH_LINKS = [
  { eyebrow: "Fin de semana", label: "eventos de motor este fin de semana", href: "/eventos-motor-este-fin-de-semana" },
  { eyebrow: "Motos", label: "concentraciones moteras 2026", href: "/concentraciones-moteras-2026" },
  { eyebrow: "Rallyes", label: "rallyes en Espana 2026", href: "/rallyes-espana-2026" },
  { eyebrow: "Rallysprint", label: "rallysprint en Espana 2026", href: "/rallysprint-espana-2026" },
  { eyebrow: "Cataluna", label: "eventos de motor en Cataluna", href: "/eventos-motor-cataluna" },
  { eyebrow: "Comunidad Valenciana", label: "eventos de motor en Comunidad Valenciana", href: "/eventos-motor-comunidad-valenciana" },
  { eyebrow: "Madrid", label: "eventos de motor en Madrid", href: "/eventos-motor-madrid" },
  { eyebrow: "Andalucia", label: "eventos de motor en Andalucia", href: "/eventos-motor-andalucia" },
  { eyebrow: "Galicia", label: "eventos de motor en Galicia", href: "/eventos-motor-galicia" },
  { eyebrow: "Aragon", label: "eventos de motor en Aragon", href: "/eventos-motor-aragon" },
  { eyebrow: "Castilla-La Mancha", label: "eventos de motor en Castilla-La Mancha", href: "/eventos-motor-castilla-la-mancha" },
  { eyebrow: "Canarias", label: "eventos de motor en Canarias", href: "/eventos-motor-canarias" },
  { eyebrow: "Murcia", label: "eventos de motor en Murcia", href: "/eventos-motor-murcia" },
  { eyebrow: "Castilla y Leon", label: "eventos de motor en Castilla y Leon", href: "/eventos-motor-castilla-y-leon" },
  { eyebrow: "Valencia", label: "rallyes en Valencia 2026", href: "/rallyes-valencia-2026" },
  { eyebrow: "Circuito", label: "trackdays en Espana 2026", href: "/trackdays-espana-2026" },
  { eyebrow: "Barcelona", label: "eventos de motor en Barcelona", href: "/eventos-motor-barcelona" },
  { eyebrow: "Valencia", label: "eventos de motor en Valencia", href: "/eventos-motor-valencia" },
  { eyebrow: "Karting", label: "karting en Espana 2026", href: "/karting-espana-2026" },
  { eyebrow: "Ferias", label: "ferias del motor", href: "/disciplinas/ferias" },
];

const ALL_ZONES = "Toda España";

const DATE_FILTER_LABELS: Record<DateQuickFilter, string> = {
  todos: "Todas las fechas",
  hoy: "Hoy",
  "fin-semana": "Este fin de semana",
  mes: "Este mes",
  "30-dias": "Próximos 30 días",
};

function overlapsRange(event: EventItem, start: Date, end: Date) {
  const eventStart = parseDate(event.start);
  const eventEnd = parseDate(event.end);
  return eventStart.getTime() <= end.getTime() && eventEnd.getTime() >= start.getTime();
}

function matchesDateFilter(event: EventItem, filter: DateQuickFilter) {
  const today = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate());

  if (filter === "todos") return true;
  if (filter === "hoy") return isOnDay(event, today);

  if (filter === "mes") {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return overlapsRange(event, start, end);
  }

  if (filter === "30-dias") {
    return overlapsRange(event, today, addDays(today, 30));
  }

  const day = today.getDay();
  const saturday = day === 0 ? addDays(today, -1) : addDays(today, (6 - day + 7) % 7);
  const sunday = addDays(saturday, 1);
  return overlapsRange(event, saturday, sunday);
}

type ConceptHomePageProps = {
  hasHeroImage?: boolean;
};

export default function ConceptHomePage({ hasHeroImage = false }: ConceptHomePageProps) {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [query, setQuery] = useState("");
  const [discipline, setDiscipline] = useState("Todas");
  const [disciplineCategory, setDisciplineCategory] = useState<DisciplineCategoryId | "todas">("todas");
  const [zone, setZone] = useState(ALL_ZONES);
  const [vehicleFilter, setVehicleFilter] = useState<VehicleMainFilter>("todos");
  const [dateFilter, setDateFilter] = useState<DateQuickFilter>("todos");
  const [view, setView] = useState<ExplorerView>("calendario");
  const [month, setMonth] = useState(TODAY.getMonth());
  const [year, setYear] = useState(TODAY.getFullYear());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationMessage, setLocationMessage] = useState("");

  async function refreshEvents() {
    try {
      const response = await fetch(API_EVENTS_URL, { cache: "no-store" });

      if (!response.ok) {
        throw new Error("No se pudieron cargar eventos");
      }

      setEvents(normalizeRemoteEvents(await response.json()));
    } catch {
      setEvents([]);
    }
  }

  useEffect(() => {
    refreshEvents();
    const timer = window.setInterval(refreshEvents, AUTO_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setUserLocation(readStoredLocation());
  }, []);

  const vehicleEvents = useMemo(() => {
    return events.filter((event) => matchesVehicleFilter(event, vehicleFilter));
  }, [events, vehicleFilter]);

  const upcoming = useMemo(() => {
    return vehicleEvents
      .filter((event) => statusOf(event) !== "finalizado")
      .sort((a, b) => parseDate(a.start).getTime() - parseDate(b.start).getTime());
  }, [vehicleEvents]);

  useEffect(() => {
    if (upcoming[0]) {
      const date = parseDate(upcoming[0].start);
      setMonth(date.getMonth());
      setYear(date.getFullYear());
      setSelectedDay(date);
    }
  }, [upcoming]);

  const disciplines = useMemo(() => unique(vehicleEvents.map((event) => event.discipline)), [vehicleEvents]);
  const zones = useMemo(() => buildZones(vehicleEvents), [vehicleEvents]);

  useEffect(() => {
    if (discipline !== "Todas" && !disciplines.includes(discipline)) {
      setDiscipline("Todas");
    }
  }, [discipline, disciplines]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const zoneTerms = zones.find((item) => item.name === zone)?.terms || [];

    const dateSortedEvents = vehicleEvents
      .filter((event) => {
        const okQuery = q === "" || eventText(event).includes(q);
        const okDiscipline = discipline === "Todas" || event.discipline === discipline;
        const okCategory = disciplineCategory === "todas" || matchesDisciplineCategory(event, disciplineCategory);
        const okZone = zone === ALL_ZONES || matchesTerms(event, zoneTerms);
        const okDate = matchesDateFilter(event, dateFilter);
        return okQuery && okDiscipline && okCategory && okZone && okDate && statusOf(event) !== "finalizado";
      })
      .sort((a, b) => parseDate(a.start).getTime() - parseDate(b.start).getTime());

    return userLocation ? sortEventsByDistance(dateSortedEvents, userLocation) : dateSortedEvents;
  }, [dateFilter, discipline, disciplineCategory, query, userLocation, vehicleEvents, zone, zones]);

  useEffect(() => {
    const firstEvent = filtered[0];

    if (!firstEvent) {
      setSelectedDay(null);
      return;
    }

    if (!selectedDay || !filtered.some((event) => isOnDay(event, selectedDay))) {
      const date = parseDate(firstEvent.start);
      setSelectedDay(date);
      setMonth(date.getMonth());
      setYear(date.getFullYear());
    }
  }, [filtered, selectedDay]);

  const highlightedEvents = useMemo(() => {
    const featured = filtered.filter((event) => event.featured);
    return (featured.length ? featured : filtered).slice(0, 4);
  }, [filtered]);

  const days = useMemo(() => daysForMonth(year, month), [month, year]);
  const monthEvents = useMemo(() => {
    return filtered.filter((event) => parseDate(event.start).getMonth() === month || parseDate(event.end).getMonth() === month);
  }, [filtered, month]);
  const agendaDay = selectedDay || parseDate(filtered[0]?.start || new Date().toISOString().slice(0, 10));
  const selectedDayEvents = useMemo(() => filtered.filter((event) => isOnDay(event, agendaDay)), [agendaDay, filtered]);
  const hasActiveFilters =
    vehicleFilter !== "todos" ||
    dateFilter !== "todos" ||
    query.trim() !== "" ||
    discipline !== "Todas" ||
    disciplineCategory !== "todas" ||
    zone !== ALL_ZONES;
  const activeLabel = useMemo(() => {
    const parts = [];

    if (vehicleFilter !== "todos") parts.push(vehicleFilter === "moto" ? "Motos" : "Coches");
    if (dateFilter !== "todos") parts.push(DATE_FILTER_LABELS[dateFilter]);
    if (zone !== ALL_ZONES) parts.push(zone);
    if (discipline !== "Todas") parts.push(discipline);
    if (disciplineCategory !== "todas") {
      parts.push(DISCIPLINE_CATEGORIES.find((item) => item.id === disciplineCategory)?.title || "Disciplina");
    }
    if (query.trim()) parts.push(`"${query.trim()}"`);

    return parts.length ? parts.join(" / ") : "Todos los próximos eventos";
  }, [dateFilter, discipline, disciplineCategory, query, vehicleFilter, zone]);
  const activeFilterChips = useMemo(() => {
    const chips: string[] = [];

    if (disciplineCategory !== "todas") {
      chips.push(`Filtro activo: ${DISCIPLINE_CATEGORIES.find((item) => item.id === disciplineCategory)?.title || "Disciplina"}`);
    }

    if (discipline !== "Todas") chips.push(`Filtro activo: ${discipline}`);
    if (zone !== ALL_ZONES) chips.push(`Zona activa: ${zone}`);

    return chips;
  }, [discipline, disciplineCategory, zone]);

  function scrollToCalendar() {
    document.getElementById("calendario")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function selectVehicle(nextFilter: VehicleMainFilter) {
    setVehicleFilter(nextFilter);
    setDiscipline("Todas");
  }

  function requestLocation() {
    setLocationMessage("");

    if (!("geolocation" in navigator)) {
      setLocationMessage("Ubicación no disponible en este navegador.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        saveLocation(location);
        setUserLocation(location);
        setLocationMessage("");
      },
      () => {
        setLocationMessage("No se ha podido activar la ubicación.");
      },
      {
        enableHighAccuracy: false,
        maximumAge: 1000 * 60 * 30,
        timeout: 10000,
      },
    );
  }

  function clearLocation() {
    removeStoredLocation();
    setUserLocation(null);
    setLocationMessage("");
  }

  function selectHeroZone(nextZone: string) {
    setZone(nextZone);
  }

  function selectZoneCard(nextZone: string) {
    setZone(nextZone);
    setView("calendario");
    scrollToCalendar();
  }

  function selectHeroDiscipline(nextDiscipline: string) {
    setDisciplineCategory("todas");
    setDiscipline(nextDiscipline);
  }

  function selectDisciplineCategory(nextCategory: DisciplineCategoryId) {
    setDisciplineCategory(nextCategory);
    setDiscipline("Todas");
    setQuery("");
    setView("calendario");
    scrollToCalendar();
  }

  function showThisMonth() {
    setDateFilter("mes");
    setMonth(TODAY.getMonth());
    setYear(TODAY.getFullYear());
    setView("calendario");
    scrollToCalendar();
  }

  function clearFilters() {
    setVehicleFilter("todos");
    setDateFilter("todos");
    setZone(ALL_ZONES);
    setQuery("");
    setDiscipline("Todas");
    setDisciplineCategory("todas");
    scrollToCalendar();
  }

  return (
    <div className="emc-page">
      <ConceptStyles />
      <ConceptHeader onCalendar={scrollToCalendar} />
      <ConceptHero
        zones={zones}
        disciplines={disciplines}
        query={query}
        discipline={discipline}
        zone={zone}
        vehicleFilter={vehicleFilter}
        dateFilter={dateFilter}
        locationLabel={userLocation ? "Eventos cercanos primero" : zone}
        locationMessage={locationMessage}
        userLocationActive={Boolean(userLocation)}
        hasHeroImage={hasHeroImage}
        onSearch={scrollToCalendar}
        onQuery={setQuery}
        onDiscipline={selectHeroDiscipline}
        onZone={selectHeroZone}
        onVehicle={selectVehicle}
        onDateFilter={setDateFilter}
        onUseLocation={requestLocation}
        onClearLocation={clearLocation}
      />
      <main>
        <ConceptEventExplorer
          activeLabel={userLocation ? `${activeLabel} / más cercanos primero` : activeLabel}
          activeFilterChips={activeFilterChips}
          calendar={(
            <ConceptCalendar
              year={year}
              month={month}
              setMonth={setMonth}
              days={days}
              agendaDay={agendaDay}
              selectedDayEvents={selectedDayEvents}
              fallbackEvents={highlightedEvents}
              monthEventCount={monthEvents.length}
              monthDisciplineCount={unique(monthEvents.map((event) => event.discipline)).length}
              filtered={filtered}
              activeLabel={userLocation ? `${activeLabel} / más cercanos primero` : activeLabel}
              hasActiveFilters={hasActiveFilters}
              query={query}
              discipline={discipline}
              zone={zone}
              vehicleFilter={vehicleFilter}
              disciplines={disciplines}
              zones={zones}
              setQuery={setQuery}
              setDiscipline={selectHeroDiscipline}
              onVehicle={selectVehicle}
              onZoneSelect={selectHeroZone}
              onThisMonth={showThisMonth}
              onDay={setSelectedDay}
              onClearFilters={clearFilters}
            />
          )}
          filtered={filtered}
          hasActiveFilters={hasActiveFilters}
          userLocation={userLocation}
          view={view}
          zone={zone}
          zones={zones}
          onClearFilters={clearFilters}
          onView={setView}
          onZone={selectHeroZone}
        />
        <ConceptDisciplineExplorer
          activeCategory={disciplineCategory}
          events={upcoming}
          onCategory={selectDisciplineCategory}
        />
        <ConceptZoneExplorer
          activeZone={zone}
          zones={zones}
          onZone={selectZoneCard}
        />
        <section className="emc-section emc-internal-links-section emc-home-seo-section">
          <div className="emc-container">
            <div className="emc-section-head">
              <div>
                <div className="emc-kicker">Búsquedas populares</div>
                <h2>Explora eventos de motor</h2>
              </div>
              <p>Accesos directos a calendarios y búsquedas con actividad real dentro de EventoMotor.</p>
            </div>
            <div className="emc-internal-links emc-home-seo-links">
              {POPULAR_SEARCH_LINKS.map((link) => (
                <Link className="emc-internal-link-card" href={link.href} key={link.href}>
                  <span>{link.eyebrow}</span>
                  <strong>{link.label}</strong>
                </Link>
              ))}
            </div>
          </div>
        </section>
        <ConceptResults />
      </main>
      <ConceptFooter />
    </div>
  );
}
