"use client";

import { useEffect, useMemo, useState } from "react";
import ConceptCalendar from "@/components/public/concept/ConceptCalendar";
import ConceptFooter from "@/components/public/concept/ConceptFooter";
import ConceptHeader from "@/components/public/concept/ConceptHeader";
import ConceptHero from "@/components/public/concept/ConceptHero";
import ConceptLocationPanel, { readStoredLocation } from "@/components/public/concept/ConceptLocationPanel";
import ConceptResults from "@/components/public/concept/ConceptResults";
import ConceptZones from "@/components/public/concept/ConceptZones";
import ConceptStyles from "@/components/public/concept/ConceptStyles";
import {
  API_EVENTS_URL,
  AUTO_REFRESH_MS,
  TODAY,
  daysForMonth,
  isOnDay,
  parseDate,
  statusOf,
} from "@/lib/date-utils";
import { matchesVehicleFilter } from "@/lib/event-classification";
import { getEventDistanceKm, sortEventsByDistance, type UserLocation } from "@/lib/geo";
import { normalizeRemoteEvents } from "@/lib/normalizers";
import type { EventItem } from "@/types/event";
import {
  INTENT_DEFINITIONS,
  buildIntents,
  buildZones,
  eventText,
  matchesTerms,
  unique,
} from "./concept-model";

type VehicleMainFilter = "todos" | "moto" | "coche";

const VEHICLE_FILTERS: Array<{ id: VehicleMainFilter; label: string }> = [
  { id: "todos", label: "Todos" },
  { id: "moto", label: "Motos" },
  { id: "coche", label: "Coches" },
];

export default function ConceptHomePage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [discipline, setDiscipline] = useState("Todas");
  const [zone, setZone] = useState("Toda España");
  const [selectedZone, setSelectedZone] = useState("España");
  const [selectedIntent, setSelectedIntent] = useState<string | null>(null);
  const [vehicleFilter, setVehicleFilter] = useState<VehicleMainFilter>("todos");
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
    } finally {
      setIsLoading(false);
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
  const provinces = useMemo(() => unique(vehicleEvents.map((event) => event.province)), [vehicleEvents]);
  const zones = useMemo(() => buildZones(vehicleEvents), [vehicleEvents]);
  const intents = useMemo(() => buildIntents(vehicleEvents), [vehicleEvents]);

  const selectedIntentTerms = useMemo(() => {
    return INTENT_DEFINITIONS.find((item) => item.label === selectedIntent)?.terms || [];
  }, [selectedIntent]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const zoneTerms = zones.find((item) => item.name === zone)?.terms || [];

    const dateSortedEvents = vehicleEvents
      .filter((event) => {
        const okQuery = q === "" || eventText(event).includes(q);
        const okDiscipline = discipline === "Todas" || event.discipline === discipline;
        const okZone = zone === "Toda España" || matchesTerms(event, zoneTerms);
        const okIntent = selectedIntentTerms.length === 0 || matchesTerms(event, selectedIntentTerms);
        return okQuery && okDiscipline && okZone && okIntent && statusOf(event) !== "finalizado";
      })
      .sort((a, b) => parseDate(a.start).getTime() - parseDate(b.start).getTime());

    return userLocation ? sortEventsByDistance(dateSortedEvents, userLocation) : dateSortedEvents;
  }, [discipline, query, selectedIntentTerms, userLocation, vehicleEvents, zone, zones]);

  const nearbyEvents = useMemo(() => {
    if (!userLocation) {
      return [];
    }

    return sortEventsByDistance(upcoming, userLocation)
      .filter((event) => getEventDistanceKm(event, userLocation) !== null)
      .slice(0, 6);
  }, [upcoming, userLocation]);

  const activeZone = useMemo(() => {
    return {
      name: selectedZone,
      events: filtered,
      upcoming: filtered,
      provinces: unique(filtered.map((event) => event.province)),
      description:
        selectedZone === "España"
          ? "Vista nacional con los filtros actuales. Puedes combinar territorio e intención o volver a todos los eventos."
          : "Zona seleccionada combinada con el resto de filtros activos.",
    };
  }, [filtered, selectedZone]);

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
    query.trim() !== "" ||
    discipline !== "Todas" ||
    zone !== "Toda España" ||
    selectedIntent !== null;
  const activeLabel = useMemo(() => {
    const parts = [];

    if (vehicleFilter !== "todos") parts.push(vehicleFilter === "moto" ? "Motos" : "Coches");
    if (zone !== "Toda España") parts.push(zone);
    if (selectedIntent) parts.push(selectedIntent);
    if (discipline !== "Todas") parts.push(discipline);
    if (query.trim()) parts.push(`"${query.trim()}"`);

    return parts.length ? parts.join(" / ") : "Todos los próximos eventos";
  }, [discipline, query, selectedIntent, vehicleFilter, zone]);

  const metrics = [
    { label: "eventos visibles", value: vehicleEvents.length },
    { label: "provincias", value: provinces.length },
    { label: "disciplinas", value: disciplines.length },
    { label: "próximos", value: upcoming.length },
  ].filter((item) => item.value > 0);

  function scrollToCalendar() {
    document.getElementById("calendario")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function applyZone(name: string) {
    setSelectedZone(name);
    setZone(name === "España" ? "Toda España" : name);
    scrollToCalendar();
  }

  function selectHeroZone(nextZone: string) {
    setSelectedZone(nextZone === "Toda España" ? "España" : nextZone);
    setZone(nextZone);
  }

  function selectHeroDiscipline(nextDiscipline: string) {
    setDiscipline(nextDiscipline);
    setSelectedIntent(null);
  }

  function showThisMonth() {
    setMonth(TODAY.getMonth());
    setYear(TODAY.getFullYear());
    scrollToCalendar();
  }

  function clearZone() {
    setSelectedZone("España");
    setZone("Toda España");
    scrollToCalendar();
  }

  function clearFilters() {
    setVehicleFilter("todos");
    setSelectedZone("España");
    setZone("Toda España");
    setQuery("");
    setDiscipline("Todas");
    setSelectedIntent(null);
    scrollToCalendar();
  }

  function applyIntent(label: string, terms: string[]) {
    if (selectedIntent === label) {
      setSelectedIntent(null);
      scrollToCalendar();
      return;
    }

    setSelectedIntent(label);
    setQuery("");
    setDiscipline("Todas");
    scrollToCalendar();
  }

  return (
    <div className="emc-page">
      <ConceptStyles />
      <ConceptHeader onCalendar={scrollToCalendar} />
      <ConceptHero
        zones={zones}
        metrics={metrics}
        highlightedEvents={highlightedEvents}
        isLoading={isLoading}
        onSearch={scrollToCalendar}
        onZone={applyZone}
      />
      <main>
        <section className="emc-vehicle-strip" aria-label="Explora por tipo">
          <div className="emc-container emc-vehicle-inner">
            <span>Explora por tipo</span>
            <div className="emc-vehicle-tabs">
              {VEHICLE_FILTERS.map((item) => (
                <button
                  className={vehicleFilter === item.id ? "emc-active" : ""}
                  key={item.id}
                  onClick={() => {
                    setVehicleFilter(item.id);
                    setSelectedIntent(null);
                    setDiscipline("Todas");
                  }}
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </section>
        <ConceptLocationPanel
          userLocation={userLocation}
          nearbyEvents={nearbyEvents}
          locationMessage={locationMessage}
          onLocationChange={setUserLocation}
          onLocationMessage={setLocationMessage}
        />
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
          disciplines={disciplines}
          zones={zones}
          intents={intents}
          selectedIntent={selectedIntent}
          setQuery={setQuery}
          setDiscipline={selectHeroDiscipline}
          onZoneSelect={selectHeroZone}
          onIntent={applyIntent}
          onThisMonth={showThisMonth}
          onDay={setSelectedDay}
          onClearFilters={clearFilters}
        />
        <ConceptZones
          zones={zones}
          selectedZone={selectedZone}
          activeZone={activeZone}
          activeLabel={userLocation ? `${activeLabel} / más cercanos primero` : activeLabel}
          hasActiveFilters={hasActiveFilters}
          filteredCount={filtered.length}
          highlightedCount={highlightedEvents.length}
          monthCount={monthEvents.length}
          disciplineCount={disciplines.length}
          onZone={applyZone}
          onClearZone={clearZone}
          onClearFilters={clearFilters}
          onCalendar={scrollToCalendar}
        />
        <ConceptResults
          intents={intents}
          filtered={filtered}
          activeLabel={userLocation ? `${activeLabel} / más cercanos primero` : activeLabel}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={clearFilters}
          onIntent={applyIntent}
          userLocation={userLocation}
        />
      </main>
      <ConceptFooter />
    </div>
  );
}
