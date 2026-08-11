import {
  V2_DISCIPLINE_FALLBACKS,
  type FallbackDiscipline,
  type FallbackVehicle,
  type V2FallbackImage,
} from "./discipline-fallback-manifest";

export type V2FallbackEvent = {
  id?: string | null;
  slug?: string | null;
  title?: string | null;
  championship?: string | null;
  discipline?: string | null;
  start?: string | null;
  start_date?: string | null;
  venue?: string | null;
  city?: string | null;
  province?: string | null;
  region?: string | null;
  tags?: readonly string[] | null;
  vehicleType?: string | null;
  imageUrl?: string | null;
};

export type V2FallbackClassification = {
  discipline: FallbackDiscipline;
  vehicle: FallbackVehicle;
  subtype?: string;
  reason: string;
};

export type V2EventImageCandidate = V2FallbackImage & {
  tier: 1 | 2 | 3 | 4;
  reason: string;
};

export type V2AssignedEventImage = {
  src: string | null;
  kind: "event" | "representative" | "neutral";
  alt: string;
  label?: "Imagen representativa";
  fallbackId?: string;
  fallbackTier?: 1 | 2 | 3 | 4;
  fallbackReason?: string;
  interpretedDiscipline?: FallbackDiscipline;
  interpretedVehicle?: FallbackVehicle;
  interpretedSubtype?: string;
};

function normalize(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function eventText(event: V2FallbackEvent): string {
  return normalize([
    event.title,
    event.championship,
    event.discipline,
    event.venue,
    event.city,
    event.province,
    event.region,
    ...(event.tags ?? []),
    event.vehicleType,
  ].join(" "));
}

function classificationText(event: V2FallbackEvent): string {
  return normalize([
    event.title,
    event.championship,
    event.discipline,
    ...(event.tags ?? []),
    event.vehicleType,
  ].join(" "));
}

function includesPhrase(text: string, phrase: string): boolean {
  const normalizedPhrase = normalize(phrase);
  return Boolean(normalizedPhrase && ` ${text} `.includes(` ${normalizedPhrase} `));
}

function includesAny(text: string, phrases: readonly string[]): boolean {
  return phrases.some((phrase) => includesPhrase(text, phrase));
}

type DisciplineClassification = Omit<V2FallbackClassification, "vehicle">;

function classification(
  discipline: FallbackDiscipline,
  subtype: string,
  reason: string,
): DisciplineClassification {
  return { discipline, subtype, reason };
}

function classifyDiscipline(text: string): DisciplineClassification | null {
  if (includesAny(text, ["kart", "karting", "kartodromo"])) {
    return classification("karting", "karting", "karting");
  }
  if (includesAny(text, ["clasico", "clasicos", "clasica", "clasicas", "historico", "historica", "youngtimer", "youngtimers", "regularidad", "vintage", "retro"])) {
    const subtype = includesAny(text, ["moto", "motos", "motocicleta", "motocicletas"])
      ? "motos-clasicas"
      : includesAny(text, ["rally", "rallye"])
        ? "rally-historico"
        : includesAny(text, ["regularidad"])
          ? "regularidad-historica"
          : "clasicos";
    return classification("clasicos", subtype, "clasicos o regularidad historica");
  }

  // Modalidades de rally de alta confianza: deben ganar a palabras secundarias
  // como circuito, cross country u offroad.
  if (includesAny(text, ["rallysprint"])) {
    return classification("rallyes", "rallysprint", "rallysprint");
  }
  if (includesAny(text, ["rallycrono"])) {
    return classification("rallyes", "rallycrono", "rallycrono");
  }
  if (includesAny(text, ["rallymix"])) {
    return classification("rallyes", "rallymix", "rallymix");
  }
  if (includesAny(text, ["rally tt", "baja"])) {
    return classification("rallyes", "rally-tt", "rally tt");
  }
  if (includesAny(text, ["rally tierra", "rallye tierra"])) {
    return classification("rallyes", "rally-tierra", "rally de tierra");
  }

  if (includesAny(text, ["resistencia tierra", "resistencia de tierra"])) {
    return classification("offroad", "resistencia-tierra", "resistencia de tierra");
  }
  if (includesAny(text, ["tramo de tierra", "tramo tierra"])) {
    return classification("offroad", "tramo-tierra", "tramo de tierra");
  }
  if (includesAny(text, ["cross country", "cross-country"])) {
    return classification("offroad", "cross-country", "cross country");
  }
  if (includesAny(text, ["autocross"])) {
    return classification("offroad", "autocross", "autocross");
  }
  if (includesAny(text, ["enduret"])) {
    return classification("offroad", "enduro", "enduret");
  }
  if (includesAny(text, ["freestyle"])) {
    return classification("offroad", "freestyle", "freestyle");
  }
  if (includesAny(text, ["motocross"])) {
    return classification("offroad", "motocross", "motocross");
  }
  if (includesAny(text, ["supercross"])) {
    return classification("offroad", "supercross", "supercross");
  }
  if (includesAny(text, ["hard enduro"])) {
    return classification("offroad", "hard-enduro", "hard enduro");
  }
  if (includesAny(text, ["enduro indoor", "indoors enduro"])) {
    return classification("offroad", "enduro-indoor", "enduro indoor");
  }
  if (includesAny(text, ["enduro"])) {
    return classification("offroad", "enduro", "enduro");
  }
  if (includesAny(text, ["trial"])) {
    return classification("offroad", "trial", "trial");
  }
  if (includesAny(text, ["offroad", "off road", "todoterreno", "4x4", "overland", "buggy"])) {
    return classification("offroad", "offroad", "offroad");
  }

  if (includesAny(text, ["resistencia ciclomotores", "resistencia de ciclomotores", "resistencia ciclomotors"])) {
    return classification("circuito", "resistencia-ciclomotores", "resistencia de ciclomotores");
  }
  if (includesAny(text, ["pitbike", "pit bike", "drpit"])) {
    return classification("circuito", "pitbike", "pitbike");
  }
  if (includesAny(text, ["minivelocidad", "mini velocidad"])) {
    return classification("circuito", "minivelocidad", "minivelocidad");
  }
  if (includesAny(text, ["minimotard", "mini motard"])) {
    return classification("circuito", "minimotard", "minimotard");
  }
  if (includesAny(text, ["supermotard", "supermoto"])) {
    return classification("circuito", "supermotard", "supermotard o supermoto");
  }
  if (includesAny(text, ["slalom"])) {
    return classification("circuito", "slalom", "slalom");
  }
  if (includesAny(text, ["drift"])) {
    return classification("circuito", "drift", "drift");
  }
  if (includesAny(text, ["motogp"])) {
    return classification("circuito", "motogp", "motogp");
  }
  if (includesAny(text, ["juniorgp", "junior gp"])) {
    return classification("circuito", "juniorgp", "juniorgp");
  }
  if (includesAny(text, ["superbike", "worldsbk", "esbk"])) {
    return classification("circuito", "superbike", "superbike");
  }
  if (includesAny(text, ["trackday", "track day"])) {
    return classification("circuito", "trackday", "trackday");
  }
  if (includesAny(text, ["tandas"])) {
    return classification("circuito", "tandas", "tandas");
  }
  if (includesAny(text, ["velocidad"])) {
    return classification("circuito", "velocidad", "velocidad");
  }
  if (includesAny(text, ["circuito", "circuit", "gt", "racing weekend"])) {
    return classification("circuito", "circuito", "circuito");
  }
  if (includesAny(text, ["concentracion", "encuentro", "quedada", "motoalmuerzo", "festival motero", "bikers"])) {
    const subtype = includesAny(text, ["motoalmuerzo"])
      ? "motoalmuerzo"
      : includesAny(text, ["bikers", "custom"])
        ? "custom-biker"
        : "concentracion";
    return classification("concentraciones", subtype, "concentracion o encuentro");
  }
  if (includesAny(text, ["mototurismo", "ruta motera", "ruta", "rutas", "touring", "road trip", "paseo motero"])) {
    const subtype = includesAny(text, ["mototurismo", "touring"]) ? "mototurismo" : "ruta";
    return classification("rutas", subtype, "ruta o touring");
  }
  if (includesAny(text, ["feria", "ferias", "salon", "expo", "exposicion", "motor show", "motorshow", "muestra"])) {
    return classification("ferias", "feria", "feria o salon");
  }
  if (includesAny(text, ["rally", "rallye", "rallyes"])) {
    return classification("rallyes", "rally", "rally");
  }
  if (includesAny(text, ["subida", "montana"])) {
    return classification("rallyes", "subida", "subida o montana");
  }
  if (includesAny(text, ["cronometrada"])) {
    return classification("rallyes", "cronometrada", "cronometrada");
  }
  if (includesPhrase(text, "raid")) {
    return classification("offroad", "raid", "raid offroad");
  }
  if (includesAny(text, ["automovilismo"])) {
    return classification("circuito", "automovilismo", "automovilismo generico");
  }
  if (includesAny(text, ["resistencia"])) {
    return classification("circuito", "resistencia", "resistencia generica");
  }
  return null;
}

const PRIMARY_P0_SUBTYPES = new Set([
  "slalom",
  "drift",
  "pitbike",
  "minivelocidad",
  "minimotard",
  "supermotard",
  "resistencia-ciclomotores",
  "autocross",
  "cross-country",
  "tramo-tierra",
  "freestyle",
  "resistencia-tierra",
  "cronometrada",
  "subida",
  "rallycrono",
  "rallymix",
]);

function classifyVehicle(text: string, discipline: FallbackDiscipline): FallbackVehicle {
  if (discipline === "karting") return "karting";

  const hasMoto = includesAny(text, [
    "moto", "motos", "motocicleta", "motocicletas", "motociclismo", "motogp",
    "superbike", "motocross", "supercross", "enduro", "hard enduro", "trial",
    "motoalmuerzo", "mototurismo", "bikers", "pitbike", "pit bike", "drpit",
    "minivelocidad", "mini velocidad", "minimotard", "mini motard", "supermotard",
    "supermoto", "ciclomotor", "ciclomotores", "ciclomotors",
  ]);
  const hasCar = includesAny(text, [
    "coche", "coches", "automovil", "automoviles", "automovilismo", "turismo",
    "turismos", "4x4", "buggy", "gt", "rally", "rallye", "rallyes", "rallysprint",
    "slalom", "drift", "autocross", "tramo de tierra", "tramo tierra",
  ]);

  if (includesAny(text, ["mixto", "mixta", "coches y motos", "motos y coches"]) || (hasMoto && hasCar)) return "mixto";
  if (hasMoto) return "moto";
  if (hasCar || discipline === "rallyes") return "coche";
  if (discipline === "clasicos") return "coche";
  if (discipline === "circuito" && includesAny(text, ["trackday", "track day"])) return "coche";
  return "mixto";
}

export function classifyV2FallbackEvent(event: V2FallbackEvent): V2FallbackClassification | null {
  const text = classificationText(event);
  const inferredDiscipline = classifyDiscipline(text);
  const primaryText = normalize(event.discipline);
  const primaryDiscipline = classifyDiscipline(primaryText);
  const primaryIsP0 = PRIMARY_P0_SUBTYPES.has(primaryDiscipline?.subtype ?? "")
    || (primaryText === "enduret" && primaryDiscipline?.subtype === "enduro");
  const discipline = primaryDiscipline
    && inferredDiscipline?.discipline === primaryDiscipline.discipline
    && primaryIsP0
    ? primaryDiscipline
    : inferredDiscipline ?? primaryDiscipline;
  if (!discipline) return null;
  return {
    ...discipline,
    vehicle: classifyVehicle(text, discipline.discipline),
  };
}

const GENERIC_TAGS = new Set([
  "rally",
  "circuito",
  "concentracion",
  "offroad",
  "clasicos",
  "karting",
  "rutas",
  "ferias",
  "moto",
  "coche",
  "mixto",
]);

function matchesExactSubtype(event: V2FallbackEvent, candidate: V2FallbackImage): boolean {
  const text = eventText(event);
  return candidate.tags.some((tag) => !GENERIC_TAGS.has(normalize(tag)) && includesPhrase(text, tag));
}

function candidateTier(
  event: V2FallbackEvent,
  classification: V2FallbackClassification,
  candidate: V2FallbackImage,
): 1 | 2 | 3 | 4 | null {
  if (candidate.discipline !== classification.discipline) return null;
  if (classification.vehicle === "karting") return candidate.vehicle === "karting" ? (matchesExactSubtype(event, candidate) ? 1 : 2) : null;
  if (candidate.vehicle === classification.vehicle) return matchesExactSubtype(event, candidate) ? 1 : 2;
  if ((classification.vehicle === "moto" || classification.vehicle === "coche") && candidate.vehicle === "mixto") return 3;
  if (classification.vehicle === "mixto" && candidate.vehicle !== "karting") return 4;
  return null;
}

export function stableV2EventKey(event: V2FallbackEvent): string {
  const slug = String(event.slug ?? "").trim();
  if (slug) return `slug:${slug}`;
  const id = String(event.id ?? "").trim();
  if (id) return `id:${id}`;
  return `event:${normalize(event.title)}|${normalize(event.start ?? event.start_date)}|${normalize(event.city)}`;
}

export function stableV2Hash(value: string): number {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function resolveV2EventImageCandidates(
  event: V2FallbackEvent,
  manifest: readonly V2FallbackImage[] = V2_DISCIPLINE_FALLBACKS,
): V2EventImageCandidate[] {
  const classification = classifyV2FallbackEvent(event);
  if (!classification) return [];
  const stableKey = stableV2EventKey(event);

  return manifest
    .map((candidate) => {
      const tier = candidateTier(event, classification, candidate);
      if (!tier) return null;
      const reason = tier === 1
        ? "disciplina, vehiculo y subtipo exactos"
        : tier === 2
          ? "disciplina y vehiculo exactos"
          : tier === 3
            ? "disciplina exacta y variante mixta compatible"
            : "alternativa general de la misma disciplina";
      return { ...candidate, tier, reason } satisfies V2EventImageCandidate;
    })
    .filter((candidate): candidate is V2EventImageCandidate => candidate !== null)
    .sort((left, right) => {
      if (left.tier !== right.tier) return left.tier - right.tier;
      const leftRank = stableV2Hash(`${stableKey}:${left.id}`);
      const rightRank = stableV2Hash(`${stableKey}:${right.id}`);
      return leftRank - rightRank || left.id.localeCompare(right.id);
    });
}

export function isValidV2EventImageSource(value: string | null | undefined): boolean {
  const source = String(value ?? "").trim();
  if (!source || /[\u0000-\u001f\u007f]/.test(source) || /\s/.test(source)) return false;
  if (/^\/(?!\/)/.test(source)) return !source.includes("\\");
  try {
    const url = new URL(source);
    return (url.protocol === "http:" || url.protocol === "https:") && !url.username && !url.password;
  } catch {
    return false;
  }
}

function realEventImage(event: V2FallbackEvent): V2AssignedEventImage | null {
  const source = String(event.imageUrl ?? "").trim();
  if (!isValidV2EventImageSource(source)) return null;
  return {
    src: source,
    kind: "event",
    alt: `Imagen del evento ${String(event.title ?? "").trim()}`,
  };
}

export function assignV2HomeEventImages(events: readonly V2FallbackEvent[]): V2AssignedEventImage[] {
  const usedFallbackIds = new Set<string>();
  const assignedByEvent = new Map<string, V2AssignedEventImage>();

  return events.map((event) => {
    const stableKey = stableV2EventKey(event);
    const existing = assignedByEvent.get(stableKey);
    if (existing) return existing;

    const ownImage = realEventImage(event);
    if (ownImage) {
      assignedByEvent.set(stableKey, ownImage);
      return ownImage;
    }

    const classification = classifyV2FallbackEvent(event);
    const candidates = resolveV2EventImageCandidates(event);
    const selected = candidates.find(({ id }) => !usedFallbackIds.has(id)) ?? candidates[0];
    if (!selected || !classification) {
      const neutral = { src: null, kind: "neutral", alt: "" } as const;
      assignedByEvent.set(stableKey, neutral);
      return neutral;
    }

    usedFallbackIds.add(selected.id);
    const assigned: V2AssignedEventImage = {
      src: selected.src,
      kind: "representative",
      alt: "",
      label: "Imagen representativa",
      fallbackId: selected.id,
      fallbackTier: selected.tier,
      fallbackReason: selected.reason,
      interpretedDiscipline: classification.discipline,
      interpretedVehicle: classification.vehicle,
      interpretedSubtype: classification.subtype,
    };
    assignedByEvent.set(stableKey, assigned);
    return assigned;
  });
}
