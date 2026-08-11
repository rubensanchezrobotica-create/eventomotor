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

function classifyDiscipline(text: string): { discipline: FallbackDiscipline; reason: string } | null {
  if (includesAny(text, ["kart", "karting", "kartodromo"])) {
    return { discipline: "karting", reason: "karting" };
  }
  if (includesAny(text, ["clasico", "clasicos", "clasica", "clasicas", "historico", "historica", "youngtimer", "youngtimers", "regularidad", "vintage", "retro"])) {
    return { discipline: "clasicos", reason: "clasicos o regularidad historica" };
  }
  if (includesAny(text, ["motocross", "supercross", "enduro", "hard enduro", "trial", "offroad", "off road", "todoterreno", "4x4", "overland", "buggy"])) {
    return { discipline: "offroad", reason: "offroad" };
  }
  if (includesAny(text, ["motogp", "superbike", "circuito", "circuit", "trackday", "track day", "tandas", "velocidad", "minivelocidad", "esbk", "gt", "racing weekend"])) {
    return { discipline: "circuito", reason: "circuito o tandas" };
  }
  if (includesAny(text, ["concentracion", "encuentro", "quedada", "motoalmuerzo", "festival motero", "bikers"])) {
    return { discipline: "concentraciones", reason: "concentracion o encuentro" };
  }
  if (includesAny(text, ["mototurismo", "ruta motera", "ruta", "rutas", "touring", "road trip", "paseo motero"])) {
    return { discipline: "rutas", reason: "ruta o touring" };
  }
  if (includesAny(text, ["feria", "ferias", "salon", "expo", "exposicion", "motor show", "motorshow", "muestra"])) {
    return { discipline: "ferias", reason: "feria o salon" };
  }
  if (includesAny(text, ["rally", "rallye", "rallyes", "rallysprint", "subida", "rally tt", "baja"])) {
    return { discipline: "rallyes", reason: "rally" };
  }
  if (includesPhrase(text, "raid")) {
    return { discipline: "offroad", reason: "raid offroad" };
  }
  return null;
}

function classifyVehicle(text: string, discipline: FallbackDiscipline): FallbackVehicle {
  if (discipline === "karting") return "karting";

  const hasMoto = includesAny(text, [
    "moto", "motos", "motocicleta", "motocicletas", "motociclismo", "motogp",
    "superbike", "motocross", "supercross", "enduro", "hard enduro", "trial",
    "motoalmuerzo", "mototurismo", "bikers",
  ]);
  const hasCar = includesAny(text, [
    "coche", "coches", "automovil", "automoviles", "automovilismo", "turismo",
    "turismos", "4x4", "buggy", "gt", "rally", "rallye", "rallyes", "rallysprint",
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
  const discipline = classifyDiscipline(text);
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
    };
    assignedByEvent.set(stableKey, assigned);
    return assigned;
  });
}
