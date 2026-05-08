import Link from "next/link";
import { formatRange, getDisciplineColor } from "@/lib/date-utils";
import { getEventDistanceKm, type UserLocation } from "@/lib/geo";
import type { EventItem } from "@/types/event";
import { dayLabel, eventHref } from "./concept-model";

const LOCATION_STORAGE_KEY = "eventomotor:user-location";

type ConceptLocationPanelProps = {
  userLocation: UserLocation | null;
  nearbyEvents: EventItem[];
  locationMessage: string;
  onLocationChange: (location: UserLocation | null) => void;
  onLocationMessage: (message: string) => void;
};

export function readStoredLocation() {
  try {
    const stored = window.localStorage.getItem(LOCATION_STORAGE_KEY);

    if (!stored) {
      return null;
    }

    const parsed = JSON.parse(stored) as Partial<UserLocation>;

    if (typeof parsed.lat === "number" && typeof parsed.lng === "number") {
      return { lat: parsed.lat, lng: parsed.lng };
    }
  } catch {
    window.localStorage.removeItem(LOCATION_STORAGE_KEY);
  }

  return null;
}

function saveLocation(location: UserLocation) {
  window.localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(location));
}

function removeStoredLocation() {
  window.localStorage.removeItem(LOCATION_STORAGE_KEY);
}

export default function ConceptLocationPanel({
  userLocation,
  nearbyEvents,
  locationMessage,
  onLocationChange,
  onLocationMessage,
}: ConceptLocationPanelProps) {
  function requestLocation() {
    onLocationMessage("");

    if (!("geolocation" in navigator)) {
      onLocationMessage("No se ha podido activar la ubicación. Puedes seguir explorando eventos.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        saveLocation(location);
        onLocationChange(location);
        onLocationMessage("");
      },
      () => {
        onLocationMessage("No se ha podido activar la ubicación. Puedes seguir explorando eventos.");
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
    onLocationChange(null);
    onLocationMessage("");
  }

  return (
    <section className="emc-section emc-location-section" aria-label="Eventos cerca de ti">
      <div className="emc-container">
        <div className="emc-location-panel">
          <div className="emc-location-copy">
            <div className="emc-location-icon" aria-hidden="true">⌖</div>
            <div>
              <div className="emc-kicker">Cerca de ti</div>
              <h2>Encuentra eventos cerca de ti</h2>
              <p>Usa tu ubicación para priorizar eventos por zona.</p>
              <small>Tu ubicación se usa solo en este navegador para ordenar eventos cercanos.</small>
              {locationMessage ? <span className="emc-location-message">{locationMessage}</span> : null}
            </div>
          </div>

          <div className="emc-location-actions">
            {userLocation ? (
              <>
                <span className="emc-location-chip">Ubicación activada</span>
                <button className="emc-btn emc-btn-light" onClick={requestLocation} type="button">
                  Cambiar
                </button>
                <button className="emc-btn emc-btn-dark" onClick={clearLocation} type="button">
                  Quitar ubicación
                </button>
              </>
            ) : (
              <>
                <button className="emc-btn emc-btn-primary" onClick={requestLocation} type="button">
                  Usar mi ubicación
                </button>
                <button className="emc-btn emc-btn-dark" onClick={() => onLocationMessage("")} type="button">
                  Ahora no
                </button>
              </>
            )}
          </div>

          {userLocation ? (
            <div className="emc-nearby">
              <div className="emc-nearby-head">
                <strong>Eventos cerca de ti</strong>
                <span>{nearbyEvents.length ? "Ordenados por distancia aproximada" : "Sin coordenadas suficientes"}</span>
              </div>
              <div className="emc-nearby-grid">
                {nearbyEvents.map((event) => {
                  const label = dayLabel(event);
                  const color = getDisciplineColor(event.discipline);
                  const distance = getEventDistanceKm(event, userLocation);

                  return (
                    <Link
                      className="emc-nearby-card"
                      href={eventHref(event)}
                      key={event.id}
                      style={{ "--emc-card-accent": color.accent } as React.CSSProperties}
                    >
                      <div className="emc-result-date">{label.day}<small>{label.month}</small></div>
                      <div>
                        <div className="emc-nearby-meta">
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
          ) : null}
        </div>
      </div>
    </section>
  );
}
