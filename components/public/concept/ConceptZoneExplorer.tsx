"use client";

import Link from "next/link";
import type { ConceptZone } from "./concept-model";

const ZONE_CARDS = [
  { name: "Norte", slug: "norte", fallback: "A Coruña / Asturias / Navarra" },
  { name: "Centro", slug: "centro", fallback: "Madrid / Castilla y León / Castilla-La Mancha" },
  { name: "Cataluña / Aragón", slug: "cataluna-aragon", fallback: "Barcelona / Girona / Zaragoza" },
  { name: "Levante", slug: "levante", fallback: "Valencia / Alicante / Murcia" },
  { name: "Sur", slug: "sur", fallback: "Andalucía / Extremadura" },
  { name: "Canarias", slug: "canarias", fallback: "Tenerife / Gran Canaria" },
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
              <Link
                aria-pressed={isActive}
                className={`emc-zone-explorer-card ${isActive ? "emc-active" : ""}`}
                href={`/zonas/${card.slug}`}
                key={card.name}
              >
                <span className="emc-zone-explorer-count">{count}</span>
                <span className="emc-zone-explorer-copy">
                  <strong>{card.name}</strong>
                  <small>{provinces}</small>
                </span>
                <span className="emc-zone-explorer-action">Ver eventos en la zona</span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
