"use client";

import { useEffect, useState } from "react";
import {
  COOKIE_SETTINGS_EVENT,
  defaultCookieConsentPreferences,
  readCookieConsentPreferences,
  saveCookieConsentPreferences,
  type CookieConsentPreferences,
} from "@/lib/cookie-consent";

type ConsentView = "banner" | "settings" | "hidden";

export default function CookieConsent() {
  const [view, setView] = useState<ConsentView>("hidden");
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    const initialization = window.setTimeout(() => {
      const stored = readCookieConsentPreferences();
      if (stored) {
        setAnalytics(stored.analytics);
        setMarketing(stored.marketing);
        return;
      }

      setView("banner");
    }, 0);
    return () => window.clearTimeout(initialization);
  }, []);

  useEffect(() => {
    const openSettings = () => {
      const stored = readCookieConsentPreferences() || defaultCookieConsentPreferences();
      setAnalytics(stored.analytics);
      setMarketing(stored.marketing);
      setView("settings");
    };

    window.addEventListener(COOKIE_SETTINGS_EVENT, openSettings);
    return () => window.removeEventListener(COOKIE_SETTINGS_EVENT, openSettings);
  }, []);

  function saveConsent(preferences: Pick<CookieConsentPreferences, "analytics" | "marketing">) {
    setAnalytics(preferences.analytics);
    setMarketing(preferences.marketing);
    saveCookieConsentPreferences(preferences);
    setView("hidden");
  }

  if (view === "hidden") return null;

  return (
    <div className="em-cookie-layer" role="presentation">
      <section
        aria-label={view === "settings" ? "Configuración de cookies" : "Aviso de cookies"}
        className={view === "settings" ? "em-cookie-panel em-cookie-panel-settings" : "em-cookie-panel"}
      >
        {view === "settings" ? (
          <>
            <div className="em-cookie-head">
              <span>Privacidad</span>
              <h2>Configurar cookies</h2>
              <p>
                Puedes activar o rechazar las cookies analíticas. Las necesarias mantienen la web operativa y no se pueden desactivar.
              </p>
            </div>

            <div className="em-cookie-options">
              <div className="em-cookie-option">
                <div>
                  <strong>Necesarias</strong>
                  <small>Siempre activas. Permiten guardar tu preferencia y mantener funciones básicas.</small>
                </div>
                <span className="em-cookie-status">Activas</span>
              </div>

              <label className="em-cookie-option">
                <div>
                  <strong>Analíticas</strong>
                  <small>Google Analytics 4 para entender uso agregado de la web si das permiso.</small>
                </div>
                <input
                  checked={analytics}
                  onChange={(event) => setAnalytics(event.target.checked)}
                  type="checkbox"
                />
              </label>

              <label className="em-cookie-option">
                <div>
                  <strong>Marketing</strong>
                  <small>Preparada para futuras herramientas. Ahora no se usa para cargar scripts.</small>
                </div>
                <input
                  checked={marketing}
                  onChange={(event) => setMarketing(event.target.checked)}
                  type="checkbox"
                />
              </label>
            </div>

            <div className="em-cookie-actions">
              <button type="button" onClick={() => saveConsent({ analytics: false, marketing: false })}>
                Rechazar
              </button>
              <button type="button" onClick={() => saveConsent({ analytics, marketing })}>
                Guardar configuración
              </button>
              <button type="button" onClick={() => saveConsent({ analytics: true, marketing: false })}>
                Aceptar
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="em-cookie-head">
              <span>Cookies</span>
              <h2>Tu privacidad en EventoMotor</h2>
              <p>
                Utilizamos cookies necesarias para que la web funcione y, solo con
                tu permiso, cookies analíticas para conocer de forma agregada cómo
                se utiliza EventoMotor. Puedes aceptar, rechazar o configurar su
                uso. Rechazar las cookies analíticas no limita las funciones
                esenciales de la web.
              </p>
            </div>
            <div className="em-cookie-actions">
              <button type="button" onClick={() => saveConsent({ analytics: false, marketing: false })}>
                Rechazar
              </button>
              <button type="button" onClick={() => setView("settings")}>
                Configurar
              </button>
              <button type="button" onClick={() => saveConsent({ analytics: true, marketing: false })}>
                Aceptar
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
