"use client";

import type { ConceptZone } from "./concept-model";

const ZONE_CARDS = [
  { name: "Norte", fallback: "A Coruña / Asturias / Navarra" },
  { name: "Centro", fallback: "Madrid / Castilla y León / Castilla-La Mancha" },
  { name: "Cataluña / Aragón", fallback: "Barcelona / Girona / Zaragoza" },
  { name: "Levante", fallback: "Valencia / Alicante / Murcia" },
  { name: "Sur", fallback: "Andalucía / Extremadura" },
  { name: "Canarias", fallback: "Tenerife / Gran Canaria" },
];

type ConceptZoneExplorerProps = {
  activeZone: string;
  zones: ConceptZone[];
  onZone: (zone: string) => void;
};

export default function ConceptZoneExplorer({ activeZone, zones, onZone }: ConceptZoneExplorerProps) {
  return (
    <section className="emc-section emc-zone-explorer-section" id="zonas">
      <div className="emc-container">
        <div className="emc-section-head emc-zone-explorer-head">
          <div>
            <div className="emc-kicker">Zonas</div>
            <h2>Explora por zona</h2>
          </div>
          <p>Encuentra eventos de motor por zonas de España: norte, centro, levante, sur, islas y más.</p>
        </div>

        <div className="emc-zone-explorer-grid">
          {ZONE_CARDS.map((card) => {
            const zone = zones.find((item) => item.name === card.name);
            const count = zone?.upcoming.length || 0;
            const provinces = zone?.provinces.length ? zone.provinces.slice(0, 4).join(" / ") : card.fallback;
            const isActive = activeZone === card.name;

            return (
              <button
                aria-pressed={isActive}
                className={`emc-zone-explorer-card ${isActive ? "emc-active" : ""}`}
                key={card.name}
                onClick={() => onZone(card.name)}
                type="button"
              >
                <span className="emc-zone-explorer-count">{count}</span>
                <span className="emc-zone-explorer-copy">
                  <strong>{card.name}</strong>
                  <small>{provinces}</small>
                </span>
                <span className="emc-zone-explorer-action">Ver eventos en la zona</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
