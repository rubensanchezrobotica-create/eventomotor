import { normalizeSeoText } from "@/lib/seo-taxonomy";

const REGION_ALIASES = new Map<string, string>([
  ["cataluna", "Cataluña"],
  ["catalunya", "Cataluña"],
  ["comunitat valenciana", "Comunidad Valenciana"],
  ["comunidad valenciana", "Comunidad Valenciana"],
  ["madrid", "Comunidad de Madrid"],
  ["comunidad de madrid", "Comunidad de Madrid"],
  ["andalucia", "Andalucía"],
  ["aragon", "Aragón"],
  ["castilla y leon", "Castilla y León"],
  ["region de murcia", "Región de Murcia"],
  ["islas canarias", "Canarias"],
  ["illes balears", "Baleares"],
  ["euskadi", "País Vasco"],
  ["pais vasco", "País Vasco"],
]);

export function normalizeRegion(value: string | null | undefined) {
  const normalized = normalizeSeoText(value || "").trim();

  if (!normalized || normalized === "por confirmar") return null;

  return REGION_ALIASES.get(normalized) || value?.trim() || null;
}
