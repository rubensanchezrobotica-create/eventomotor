"use client";

import type { CSSProperties } from "react";
import type { EventItem } from "@/types/event";
import { eventText } from "./concept-model";

export type DisciplineCategoryId =
  | "rallyes"
  | "circuito"
  | "concentraciones"
  | "offroad"
  | "clasicos"
  | "karting"
  | "rutas"
  | "ferias";

type DisciplineCategory = {
  id: DisciplineCategoryId;
  title: string;
  description: string;
  image: string;
  terms: string[];
};

export const DISCIPLINE_CATEGORIES: DisciplineCategory[] = [
  {
    id: "rallyes",
    title: "Rallyes",
    description: "Rallyes, subidas, montaña, bajas y pruebas de regularidad.",
    image: "/images/disciplines/eventomotor-fallback-rally.webp",
    terms: ["rally", "rallye", "rallysprint", "subida", "montaña", "montana", "rally tt", "baja", "eco rallye"],
  },
  {
    id: "circuito",
    title: "Circuito",
    description: "MotoGP, superbike, velocidad, trackdays y tandas.",
    image: "/images/disciplines/eventomotor-fallback-circuito.webp",
    terms: ["motogp", "superbike", "velocidad", "trackday", "circuito", "tandas", "esbk", "gt", "racing weekend"],
  },
  {
    id: "concentraciones",
    title: "Concentraciones",
    description: "Quedadas moteras, motoalmuerzos, custom y ambiente biker.",
    image: "/images/disciplines/eventomotor-fallback-concentracion.webp",
    terms: ["concentración", "concentracion", "motoalmuerzo", "custom", "bikers", "festival motero"],
  },
  {
    id: "offroad",
    title: "Offroad",
    description: "Enduro, motocross, trial, 4x4, raids y aventura fuera de pista.",
    image: "/images/disciplines/eventomotor-fallback-offroad.webp",
    terms: ["motocross", "enduro", "trial", "offroad", "mx", "4x4", "overland", "raid"],
  },
  {
    id: "clasicos",
    title: "Clásicos",
    description: "Vehículos clásicos, históricos, retro y concentraciones vintage.",
    image: "/images/disciplines/eventomotor-fallback-clasicos.webp",
    terms: ["clásicos", "clasicos", "clásicas", "clasicas", "histórico", "historico", "classic", "retro", "americanos"],
  },
  {
    id: "karting",
    title: "Karting",
    description: "Carreras, campeonatos y encuentros de karting.",
    image: "/images/disciplines/eventomotor-fallback-karting.webp",
    terms: ["kart", "karting"],
  },
  {
    id: "rutas",
    title: "Rutas",
    description: "Rutas moteras, touring, mototurismo y planes para salir a rodar.",
    image: "/images/disciplines/eventomotor-fallback-ruta.webp",
    terms: ["ruta", "ruta motera", "mototurismo", "touring", "rider", "viaje", "trail touring", "road trip", "paseo motero"],
  },
  {
    id: "ferias",
    title: "Ferias",
    description: "Ferias, salones, exposiciones, muestras y motor shows.",
    image: "/images/disciplines/eventomotor-fallback-feria.webp",
    terms: ["feria", "salón", "salon", "expo", "exposición", "exposicion", "motor show", "motorshow", "festival", "muestra"],
  },
];

export function matchesDisciplineCategory(event: EventItem, categoryId: DisciplineCategoryId) {
  const category = DISCIPLINE_CATEGORIES.find((item) => item.id === categoryId);
  if (!category) return false;
  const text = eventText(event);
  return category.terms.some((term) => text.includes(term));
}

type ConceptDisciplineExplorerProps = {
  activeCategory: DisciplineCategoryId | "todas";
  events: EventItem[];
  onCategory: (categoryId: DisciplineCategoryId) => void;
};

export default function ConceptDisciplineExplorer({
  activeCategory,
  events,
  onCategory,
}: ConceptDisciplineExplorerProps) {
  return (
    <section className="emc-section emc-discipline-section" id="disciplinas">
      <div className="emc-container">
        <div className="emc-section-head emc-discipline-head">
          <div>
            <div className="emc-kicker">Disciplinas</div>
            <h2>Explora por disciplina</h2>
          </div>
          <p>
            Encuentra eventos por tipo de experiencia: rallyes, circuito, concentraciones, rutas, offroad, clásicos, karting y ferias.
          </p>
        </div>

        <div className="emc-discipline-grid">
          {DISCIPLINE_CATEGORIES.map((category) => {
            const count = events.filter((event) => matchesDisciplineCategory(event, category.id)).length;
            const isActive = activeCategory === category.id;

            return (
              <button
                aria-pressed={isActive}
                className={`emc-discipline-card ${isActive ? "emc-active" : ""}`}
                key={category.id}
                onClick={() => onCategory(category.id)}
                style={{ "--emc-discipline-image": `url("${category.image}")` } as CSSProperties}
                type="button"
              >
                <span className="emc-discipline-count">{count} eventos</span>
                <span className="emc-discipline-body">
                  <strong>{category.title}</strong>
                  <small>{category.description}</small>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
