import type { EventItem } from "@/types/event";

export type PreviewSuggestionKind = "evento" | "ubicacion" | "disciplina";

export type PreviewSuggestion = {
  id: string;
  kind: PreviewSuggestionKind;
  label: string;
};

export type PreviewSuggestionEvent = Pick<
  EventItem,
  "title" | "venue" | "city" | "province" | "region" | "discipline"
>;

export function normalizePreviewText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function addSuggestion(
  suggestions: Map<string, PreviewSuggestion>,
  kind: PreviewSuggestionKind,
  rawLabel: string,
) {
  const label = rawLabel.trim();
  const normalized = normalizePreviewText(label);

  if (!normalized || normalized === "por confirmar" || normalized === "espana") return;

  const key = `${kind}:${normalized}`;
  if (!suggestions.has(key)) suggestions.set(key, { id: key, kind, label });
}

export function buildPreviewSuggestions(events: readonly PreviewSuggestionEvent[], query: string, limit = 8) {
  const normalizedQuery = normalizePreviewText(query);
  if (normalizedQuery.length < 2 || limit <= 0) return [];

  const suggestions = new Map<string, PreviewSuggestion>();

  for (const event of events) {
    addSuggestion(suggestions, "evento", event.title);
    addSuggestion(suggestions, "evento", event.venue);
    addSuggestion(suggestions, "ubicacion", event.city);
    addSuggestion(suggestions, "ubicacion", event.province);
    addSuggestion(suggestions, "ubicacion", event.region);
    addSuggestion(suggestions, "disciplina", event.discipline);
  }

  return Array.from(suggestions.values())
    .filter((suggestion) => normalizePreviewText(suggestion.label).includes(normalizedQuery))
    .sort((left, right) => {
      const leftText = normalizePreviewText(left.label);
      const rightText = normalizePreviewText(right.label);
      const leftStarts = leftText.startsWith(normalizedQuery) ? 0 : 1;
      const rightStarts = rightText.startsWith(normalizedQuery) ? 0 : 1;
      return leftStarts - rightStarts || left.label.localeCompare(right.label, "es");
    })
    .slice(0, limit);
}

export function previewResultLabel(count: number) {
  return count === 1 ? "1 evento visible" : `${count} eventos visibles`;
}

export function previewSearchButtonLabel(count: number) {
  return count === 1 ? "Ver 1 evento" : `Ver ${count} eventos`;
}
