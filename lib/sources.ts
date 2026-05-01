import type { SourceFeed } from "@/types/event";

export const SOURCES = {
  RFME: "https://rfme.com/calendario-campeonatos/",
  MotoGP: "https://www.motogp.com/es/calendar/2026",
  CircuitCat: "https://www.circuitcat.com/",
  MotorLand: "https://www.motorlandaragon.com/",
  RicardoTormo: "https://entradas.circuitvalencia.com/circuitvalencia/events",
};

export const SOURCE_FEEDS: SourceFeed[] = [
  { id: "rfme", name: "RFME", url: SOURCES.RFME, type: "Calendario oficial" },
  { id: "motogp", name: "MotoGP", url: SOURCES.MotoGP, type: "Calendario oficial" },
  { id: "circuitcat", name: "Circuit de Barcelona-Catalunya", url: SOURCES.CircuitCat, type: "Circuito" },
  { id: "motorland", name: "MotorLand Aragón", url: SOURCES.MotorLand, type: "Circuito" },
  { id: "ricardotormo", name: "Circuit Ricardo Tormo", url: SOURCES.RicardoTormo, type: "Entradas" },
];
