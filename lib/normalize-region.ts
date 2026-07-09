import { normalizeSeoText } from "@/lib/seo-taxonomy";

const REGION_ALIASES = new Map<string, string>([
  ["cataluna", "Cataluña"],
  ["catalunya", "Cataluña"],
  ["comunitat valenciana", "Comunidad Valenciana"],
  ["comunidad valenciana", "Comunidad Valenciana"],
  ["madrid", "Comunidad de Madrid"],
  ["comunidad de madrid", "Comunidad de Madrid"],
  ["andalucia", "Andalucía"],
]);

export function normalizeRegion(value: string | null | undefined) {
  const normalized = normalizeSeoText(value || "").trim();

  if (!normalized || normalized === "por confirmar") return null;

  return REGION_ALIASES.get(normalized) || value?.trim() || null;
}
