import type { StoryCollection, StoryCredit, StoryCreditRole, StoryType } from "@/lib/stories/story-types";

export const storyTypeLabels: Record<StoryType, string> = {
  CRONICA: "Crónica", REPORTAJE: "Reportaje", HISTORIA: "Historia", ENTREVISTA: "Entrevista",
};
export const storyCollectionLabels: Record<StoryCollection, string> = {
  DESDE_DENTRO: "Desde dentro", HISTORIAS_DE_MOTOR: "Historias de motor", CONVERSACIONES: "Conversaciones",
};
const creditRoleLabels: Record<StoryCreditRole, string> = {
  TEXT: "texto", PHOTO: "fotografía", VIDEO: "vídeo", CONTRIBUTOR: "colaboración",
};

export function groupStoryByline(credits: readonly StoryCredit[], people: Readonly<Record<string, string>>) {
  const groups = new Map<string, StoryCreditRole[]>();
  for (const credit of [...credits].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const roles = groups.get(credit.personId) ?? [];
    if (!roles.includes(credit.role)) roles.push(credit.role);
    groups.set(credit.personId, roles);
  }
  return [...groups].map(([personId, roles]) => {
    const words = (["TEXT", "PHOTO", "VIDEO", "CONTRIBUTOR"] as const)
      .filter((role) => roles.includes(role)).map((role) => creditRoleLabels[role]);
    const phrase = words.length > 1 ? `${words.slice(0, -1).join(", ")} y ${words.at(-1)}` : words[0];
    return { personId, name: people[personId] ?? "Persona no disponible", label: `${phrase[0].toLocaleUpperCase("es-ES")}${phrase.slice(1)}` };
  });
}

export function storyImageRatio(item: { width: number; height: number } | undefined): number | null {
  if (!item || !Number.isFinite(item.width) || !Number.isFinite(item.height) || item.width <= 0 || item.height <= 0) return null;
  return item.width / item.height;
}

// Distribute widths by intrinsic ratios for a common height, never by cropping.
// Unknown or extreme metadata stacks rather than inventing an aspect ratio.
export function storyPairGeometry(items: readonly ({ width: number; height: number } | undefined)[]) {
  const ratios = items.map(storyImageRatio);
  if (ratios.length !== 2 || ratios.some((r) => r === null)) return null;
  const [left, right] = ratios as [number, number];
  if (Math.min(left, right) < .4 || Math.max(left, right) > 2.6 || Math.max(left, right) / Math.min(left, right) > 3) return null;
  return { left, right, sum: left + right, columns: `${left}fr ${right}fr` };
}
