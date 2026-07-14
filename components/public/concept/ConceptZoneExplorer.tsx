"use client";

import Image from "next/image";
import Link from "next/link";
import { currentPagePath, trackEvent } from "@/lib/analytics";
import { formatPreviewZoneProvinces } from "@/components/preview/preview-geography";
import type { ConceptZone } from "./concept-model";

const ZONE_CARDS = [
  {
    name: "Norte",
    slug: "norte",
    fallback: "A Coruña / Asturias / Navarra",
    image: "/images/zones/zone-norte.webp",
    imagePosition: "50% 50%",
  },
  {
    name: "Centro",
    slug: "centro",
    fallback: "Madrid / Castilla y León / Castilla-La Mancha",
    image: "/images/zones/zone-centro.webp",
    imagePosition: "50% 50%",
  },
  {
    name: "Cataluña / Aragón",
    slug: "cataluna-aragon",
    fallback: "Barcelona / Girona / Zaragoza",
    image: "/images/zones/zone-cataluna-aragon.webp",
    imagePosition: "50% 55%",
  },
  {
    name: "Levante",
    slug: "levante",
    fallback: "Valencia / Alicante / Murcia",
    image: "/images/zones/zone-levante.webp",
    imagePosition: "50% 50%",
  },
  {
    name: "Sur",
    slug: "sur",
    fallback: "Andalucía / Extremadura",
    image: "/images/zones/zone-sur.webp",
    imagePosition: "50% 55%",
  },
  {
    name: "Canarias",
    slug: "canarias",
    fallback: "Tenerife / Gran Canaria",
    image: "/images/zones/zone-canarias.webp",
    imagePosition: "50% 50%",
  },
];

export type ZoneExplorerVariant = "default" | "atmospheric";

type ConceptZoneExplorerProps = {
  activeZone: string;
  zones: ConceptZone[];
  onZone: (zone: string) => void;
  variant?: ZoneExplorerVariant;
};

export default function ConceptZoneExplorer({
  activeZone,
  zones,
  onZone,
  variant = "default",
}: ConceptZoneExplorerProps) {
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
            const provinces = variant === "atmospheric"
              ? formatPreviewZoneProvinces(zone, card.fallback)
              : zone?.provinces.length ? zone.provinces.slice(0, 4).join(" / ") : card.fallback;
            const isActive = activeZone === card.name;

            return (
              <Link
                aria-pressed={isActive}
                className={`emc-zone-explorer-card ${variant === "atmospheric" ? "emc-zone-explorer-card-atmospheric" : ""} ${isActive ? "emc-active" : ""}`}
                href={`/zonas/${card.slug}`}
                key={card.name}
                onClick={() => trackEvent("filter_zone", {
                  zone: card.name,
                  page_path: currentPagePath(),
                })}
              >
                {variant === "atmospheric" ? (
                  <Image
                    alt=""
                    aria-hidden="true"
                    className="emc-zone-explorer-image"
                    fill
                    sizes="(max-width: 760px) 92vw, (max-width: 1180px) 46vw, 30vw"
                    src={card.image}
                    style={{ objectPosition: card.imagePosition }}
                  />
                ) : null}
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
