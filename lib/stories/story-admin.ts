import {
  STORY_COLLECTIONS,
  STORY_LIMITS,
  STORY_SCHEMA_VERSION,
  STORY_TYPES,
  type StoryCollection,
  type StoryContentBlock,
  type StoryDocument,
  type StoryType,
} from "./story-types";
import {
  isStoryCollection,
  isStoryType,
  isValidStorySlug,
  validateStoryDocument,
} from "./story-validation";

export const STORY_EDITOR_STATUSES = ["DRAFT", "READY"] as const;
export type StoryEditorStatus = (typeof STORY_EDITOR_STATUSES)[number];

export type StoryAdminInput = {
  status: string;
  type: string;
  collection: string;
  title: string;
  dek: string;
  contextLocation: string;
  slug: string;
  disciplineSlugs: readonly string[];
  territoryIds: readonly string[];
  contentBlocks: unknown;
  heroMediaId: string;
  seoTitle: string;
  seoDescription: string;
};

export type StoryAdminValidatedInput = Omit<
  StoryAdminInput,
  "status" | "type" | "collection" | "contentBlocks"
> & {
  status: StoryEditorStatus;
  type: StoryType;
  collection: StoryCollection;
  contentBlocks: readonly StoryContentBlock[];
};

export type StoryAdminValidationIssue = {
  field: string;
  message: string;
};

export type StoryAdminValidationResult =
  | { ok: true; value: StoryAdminValidatedInput; issues: readonly [] }
  | { ok: false; issues: readonly StoryAdminValidationIssue[] };

function issue(
  issues: StoryAdminValidationIssue[],
  field: string,
  message: string,
) {
  issues.push({ field, message });
}

export function uniqueStringValues(values: readonly string[], max: number) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].slice(0, max);
}

export function parseStoryBlocksJson(value: string): StoryDocument | null {
  try {
    const contentBlocks = JSON.parse(value) as unknown;
    const result = validateStoryDocument({
      schemaVersion: STORY_SCHEMA_VERSION,
      contentBlocks,
    });
    return result.ok ? result.value : null;
  } catch {
    return null;
  }
}

export function validateStoryAdminInput(input: StoryAdminInput): StoryAdminValidationResult {
  const issues: StoryAdminValidationIssue[] = [];
  const status = STORY_EDITOR_STATUSES.includes(input.status as StoryEditorStatus)
    ? input.status as StoryEditorStatus
    : null;
  const type = isStoryType(input.type) ? input.type : null;
  const collection = isStoryCollection(input.collection) ? input.collection : null;

  if (!status) issue(issues, "status", "A16C sólo permite DRAFT o READY.");
  if (!type) issue(issues, "type", "El tipo editorial no es válido.");
  if (!collection) issue(issues, "collection", "La colección editorial no es válida.");
  if (input.title.length > STORY_LIMITS.title) issue(issues, "title", "El título es demasiado largo.");
  if (input.dek.length > STORY_LIMITS.dek) issue(issues, "dek", "La entradilla es demasiado larga.");
  if (input.contextLocation.length > STORY_LIMITS.contextLocation) {
    issue(issues, "contextLocation", "El contexto es demasiado largo.");
  }
  if (input.seoTitle.length > STORY_LIMITS.seoTitle) {
    issue(issues, "seoTitle", "El título SEO es demasiado largo.");
  }
  if (input.seoDescription.length > STORY_LIMITS.seoDescription) {
    issue(issues, "seoDescription", "La descripción SEO es demasiado larga.");
  }
  if (input.slug && !isValidStorySlug(input.slug)) {
    issue(issues, "slug", "El slug debe usar minúsculas ASCII y guiones.");
  }

  const disciplines = uniqueStringValues(input.disciplineSlugs, STORY_LIMITS.taxonomyValues);
  const territories = uniqueStringValues(input.territoryIds, STORY_LIMITS.taxonomyValues);
  if (disciplines.some((value) => value.length > STORY_LIMITS.taxonomyValue)) {
    issue(issues, "disciplineSlugs", "Una disciplina supera el límite permitido.");
  }
  if (territories.some((value) => value.length > STORY_LIMITS.taxonomyValue)) {
    issue(issues, "territoryIds", "Un territorio supera el límite permitido.");
  }

  const document = validateStoryDocument({
    schemaVersion: STORY_SCHEMA_VERSION,
    contentBlocks: input.contentBlocks,
  });
  if (!document.ok) {
    for (const validationIssue of document.errors) {
      issue(issues, validationIssue.field, validationIssue.message);
    }
  }

  if (status === "READY") {
    if (!input.title.trim()) issue(issues, "title", "READY exige título.");
    if (!input.dek.trim()) issue(issues, "dek", "READY exige entradilla.");
    if (!input.slug || !isValidStorySlug(input.slug)) issue(issues, "slug", "READY exige un slug válido.");
    if (!input.seoTitle.trim()) issue(issues, "seoTitle", "READY exige título SEO.");
    if (!input.seoDescription.trim()) {
      issue(issues, "seoDescription", "READY exige descripción SEO.");
    }
  }

  if (issues.length || !status || !type || !collection || !document.ok) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    issues: [],
    value: {
      ...input,
      status,
      type,
      collection,
      disciplineSlugs: disciplines,
      territoryIds: territories,
      contentBlocks: document.value.contentBlocks,
    },
  };
}

export function moveStoryBlock(
  blocks: readonly StoryContentBlock[],
  index: number,
  direction: -1 | 1,
) {
  const target = index + direction;
  if (index < 0 || index >= blocks.length || target < 0 || target >= blocks.length) {
    return [...blocks];
  }
  const next = [...blocks];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function removeStoryBlock(
  blocks: readonly StoryContentBlock[],
  blockId: string,
) {
  return blocks.filter((block) => block.id !== blockId);
}

export function appendStoryBlock(
  blocks: readonly StoryContentBlock[],
  block: StoryContentBlock,
) {
  return [...blocks, block];
}

export function replaceStoryBlock(
  blocks: readonly StoryContentBlock[],
  block: StoryContentBlock,
) {
  return blocks.map((current) => current.id === block.id ? block : current);
}

export function storyEditorCatalogs() {
  return {
    statuses: STORY_EDITOR_STATUSES,
    types: STORY_TYPES,
    collections: STORY_COLLECTIONS,
  };
}
