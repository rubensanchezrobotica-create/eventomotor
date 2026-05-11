"use client";

import { useEffect, useMemo, useState } from "react";
import ConceptCalendar from "@/components/public/concept/ConceptCalendar";
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

const ALL_ZONES = "Toda España";

export default function ConceptHomePage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [query, setQuery] = useState("");
  const [discipline, setDiscipline] = useState("Todas");
  const [zone, setZone] = useState(ALL_ZONES);
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
        const okZone = zone === ALL_ZONES || matchesTerms(event, zoneTerms);
        return okQuery && okDiscipline && okZone && statusOf(event) !== "finalizado";
      })
      .sort((a, b) => parseDate(a.start).getTime() - parseDate(b.start).getTime());

    return userLocation ? sortEventsByDistance(dateSortedEvents, userLocation) : dateSortedEvents;
  }, [discipline, query, userLocation, vehicleEvents, zone, zones]);

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
    zone !== ALL_ZONES;
  const activeLabel = useMemo(() => {
    const parts = [];

    if (vehicleFilter !== "todos") parts.push(vehicleFilter === "moto" ? "Motos" : "Coches");
    if (zone !== ALL_ZONES) parts.push(zone);
    if (discipline !== "Todas") parts.push(discipline);
    if (query.trim()) parts.push(`"${query.trim()}"`);

    return parts.length ? parts.join(" / ") : "Todos los próximos eventos";
  }, [discipline, query, vehicleFilter, zone]);

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

  function selectHeroDiscipline(nextDiscipline: string) {
    setDiscipline(nextDiscipline);
  }

  function showThisMonth() {
    setMonth(TODAY.getMonth());
    setYear(TODAY.getFullYear());
    scrollToCalendar();
  }

  function clearFilters() {
    setVehicleFilter("todos");
    setZone(ALL_ZONES);
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
        disciplines={disciplines}
        query={query}
        discipline={discipline}
        zone={zone}
        vehicleFilter={vehicleFilter}
        locationLabel={userLocation ? "Eventos cercanos primero" : zone}
        locationMessage={locationMessage}
        userLocationActive={Boolean(userLocation)}
        onSearch={scrollToCalendar}
        onQuery={setQuery}
        onDiscipline={selectHeroDiscipline}
        onZone={selectHeroZone}
        onVehicle={selectVehicle}
        onUseLocation={requestLocation}
        onClearLocation={clearLocation}
      />
      <main>
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
        <ConceptResults />
      </main>
      <ConceptFooter />
    </div>
  );
}
