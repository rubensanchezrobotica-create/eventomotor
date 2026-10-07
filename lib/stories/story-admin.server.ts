import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createSupabaseServerClient,
  type Database,
  type EditorialPersonRow,
  type EventRow,
  type StoryCreditInsert,
  type StoryCreditRow,
  type StoryEventInsert,
  type StoryEventRow,
  type StoryMediaRow,
  type StoryMediaUpdate,
  type StoryRow,
} from "@/lib/supabase";
import {
  buildCanonicalStoryMediaPublicUrl,
  createSupabaseStoryMediaService,
} from "./story-media.server";
import {
  STORY_MEDIA_DRAFT_BUCKET,
  STORY_MEDIA_PUBLIC_BUCKET,
} from "./story-media-validation";
import {
  validateStoryAdminInput,
  type StoryAdminInput,
  type StoryAdminValidatedInput,
} from "./story-admin";
import {
  STORY_CREDIT_ROLES,
  STORY_EVENT_RELATION_TYPES,
  STORY_LIMITS,
  STORY_RIGHTS_TYPES,
  type StoryContentBlock,
  type StoryCreditRole,
  type StoryEventRelationType,
  type StoryRightsType,
} from "./story-types";

export type StoryAdminErrorCode =
  | "SUPABASE_NOT_CONFIGURED"
  | "STORY_NOT_FOUND"
  | "STORY_NOT_EDITABLE"
  | "STORY_INPUT_INVALID"
  | "STORY_SLUG_CONFLICT"
  | "STORY_VERSION_CONFLICT"
  | "STORY_MEDIA_OWNERSHIP"
  | "STORY_RELATION_INVALID"
  | "STORY_PERSON_NOT_FOUND"
  | "STORY_EVENT_REFERENCE_ORPHAN"
  | "DATABASE_CONSTRAINT_CONFLICT"
  | "DATABASE_OPERATION_FAILED";

export class StoryAdminError extends Error {
  readonly code: StoryAdminErrorCode;
  readonly issues?: readonly { field: string; message: string }[];

  constructor(
    code: StoryAdminErrorCode,
    message: string,
    issues?: readonly { field: string; message: string }[],
  ) {
    super(message);
    this.name = "StoryAdminError";
    this.code = code;
    this.issues = issues;
  }
}

export type StoryListStatus = "ALL" | StoryRow["status"];

export type StoryAdminEventSummary = Pick<
  EventRow,
  "id" | "slug" | "title" | "start_date" | "venue" | "city" | "province"
>;

export type StoryAdminBundle = {
  story: StoryRow;
  media: StoryMediaRow[];
  people: EditorialPersonRow[];
  credits: StoryCreditRow[];
  eventRelations: StoryEventRow[];
  relatedEvents: StoryAdminEventSummary[];
};

type StoryUpdate = {
  status: "DRAFT" | "READY";
  type: StoryRow["type"];
  collection: StoryRow["collection"];
  title: string;
  dek: string;
  context_location: string | null;
  slug: string;
  discipline_slugs: string[];
  territory_ids: string[];
  content_blocks: StoryRow["content_blocks"];
  schema_version: number;
  hero_media_id: string | null;
  seo_title: string;
  seo_description: string;
};

export type StoryAdminMutationRepository = {
  createDraft(input: {
    type: StoryRow["type"];
    collection: StoryRow["collection"];
    title: string;
  }): Promise<StoryRow>;
  getStory(id: string): Promise<StoryRow | null>;
  findSlugOwner(slug: string, excludingId: string): Promise<string | null>;
  getMediaByIds(mediaIds: readonly string[]): Promise<StoryMediaRow[]>;
  getRelatedEventIds(storyId: string, eventIds: readonly string[]): Promise<string[]>;
  updateExpected(input: {
    id: string;
    expectedUpdatedAt: string;
    update: StoryUpdate;
  }): Promise<StoryRow | null>;
};

export type StoryAdminRelationRepository = {
  getStory(id: string): Promise<StoryRow | null>;
  getPeopleByIds(personIds: readonly string[]): Promise<EditorialPersonRow[]>;
  getEventsByIds(eventIds: readonly string[]): Promise<StoryAdminEventSummary[]>;
  claimEditableStoryVersion(input: {
    id: string;
    expectedUpdatedAt: string;
    status: "DRAFT" | "READY";
  }): Promise<StoryRow | null>;
  replaceCredits(storyId: string, credits: readonly StoryCreditInsert[]): Promise<void>;
  replaceEvents(storyId: string, relations: readonly StoryEventInsert[]): Promise<void>;
};

export type StoryMediaMetadataRepository = {
  getStory(id: string): Promise<StoryRow | null>;
  getMedia(id: string): Promise<StoryMediaRow | null>;
  updateExpected(input: {
    mediaId: string;
    storyId: string;
    expectedUpdatedAt: string;
    update: StoryMediaUpdate;
  }): Promise<StoryMediaRow | null>;
};

export type StoryMediaMetadataInput = {
  storyId: string;
  mediaId: string;
  expectedUpdatedAt: string;
  altText: string;
  caption: string;
  credit: string;
  rightsType: string;
  rightsNotes: string;
};

export type StoryMediaPublicationReadiness = Awaited<
  ReturnType<ReturnType<typeof createSupabaseStoryMediaService>["publicationReadiness"]>
>;

const STORY_MEDIA_METADATA_LIMITS = {
  altText: 500,
  caption: 2_000,
  credit: 500,
  rightsNotes: 2_000,
} as const;

function normalizedOptionalText(value: unknown, limit: number, field: string) {
  if (typeof value !== "string" || value.length > limit) {
    throw new StoryAdminError("STORY_INPUT_INVALID", `${field} no es válido.`);
  }
  return value.trim() || null;
}

export function createStoryMediaMetadataService(repository: StoryMediaMetadataRepository) {
  return {
    async update(input: StoryMediaMetadataInput) {
      assertExpectedUpdatedAt(input.expectedUpdatedAt);
      const altText = normalizedOptionalText(
        input.altText,
        STORY_MEDIA_METADATA_LIMITS.altText,
        "El texto alternativo",
      ) ?? "";
      const caption = normalizedOptionalText(
        input.caption,
        STORY_MEDIA_METADATA_LIMITS.caption,
        "El pie de foto",
      );
      const credit = normalizedOptionalText(
        input.credit,
        STORY_MEDIA_METADATA_LIMITS.credit,
        "El crédito",
      );
      const rightsNotes = normalizedOptionalText(
        input.rightsNotes,
        STORY_MEDIA_METADATA_LIMITS.rightsNotes,
        "Las notas de derechos",
      );
      if (!STORY_RIGHTS_TYPES.includes(input.rightsType as StoryRightsType)) {
        throw new StoryAdminError("STORY_INPUT_INVALID", "El tipo de derechos no es válido.");
      }
      const story = await repository.getStory(input.storyId);
      if (!story) throw new StoryAdminError("STORY_NOT_FOUND", "La historia no existe.");
      if (story.status !== "DRAFT" && story.status !== "READY") {
        throw new StoryAdminError("STORY_NOT_EDITABLE", "La historia ya no es editable.");
      }
      const media = await repository.getMedia(input.mediaId);
      if (!media || media.story_id !== input.storyId) {
        throw new StoryAdminError(
          "STORY_MEDIA_OWNERSHIP",
          "La media no pertenece a la historia solicitada.",
        );
      }
      if (media.updated_at !== input.expectedUpdatedAt) {
        throw new StoryAdminError(
          "STORY_VERSION_CONFLICT",
          "La media ha cambiado desde que abriste esta versión.",
        );
      }
      const updated = await repository.updateExpected({
        mediaId: input.mediaId,
        storyId: input.storyId,
        expectedUpdatedAt: input.expectedUpdatedAt,
        update: {
          alt_text: altText,
          caption,
          credit,
          rights_type: input.rightsType as StoryRightsType,
          rights_notes: rightsNotes,
        },
      });
      if (!updated) {
        throw new StoryAdminError(
          "STORY_VERSION_CONFLICT",
          "La media ha cambiado desde que abriste esta versión.",
        );
      }
      return updated;
    },
  };
}

export function createStoryMediaMetadataReadinessService(dependencies: {
  updateMetadata(input: StoryMediaMetadataInput): Promise<StoryMediaRow>;
  publicationReadiness(storyId: string): Promise<StoryMediaPublicationReadiness>;
}) {
  return {
    async update(input: StoryMediaMetadataInput) {
      const media = await dependencies.updateMetadata(input);
      try {
        const readiness = await dependencies.publicationReadiness(input.storyId);
        return { media, readiness };
      } catch {
        // The metadata save is already durable. Readiness must fail unknown rather
        // than turn a successful save into a misleading retryable mutation error.
        return { media, readiness: null };
      }
    },
  };
}

function toUpdate(input: StoryAdminValidatedInput): StoryUpdate {
  return {
    status: input.status,
    type: input.type,
    collection: input.collection,
    title: input.title.trim(),
    dek: input.dek.trim(),
    context_location: input.contextLocation.trim() || null,
    slug: input.slug.trim(),
    discipline_slugs: [...input.disciplineSlugs],
    territory_ids: [...input.territoryIds],
    content_blocks: [...input.contentBlocks],
    schema_version: 1,
    hero_media_id: input.heroMediaId.trim() || null,
    seo_title: input.seoTitle.trim(),
    seo_description: input.seoDescription.trim(),
  };
}

function referencedMediaIds(blocks: readonly StoryContentBlock[]) {
  const ids: string[] = [];
  for (const block of blocks) {
    if (block.type === "IMAGE") ids.push(block.mediaId);
    if (block.type === "IMAGE_PAIR" || block.type === "GALLERY") {
      ids.push(...block.mediaIds);
    }
  }
  return ids;
}

function referencedEventIds(blocks: readonly StoryContentBlock[]) {
  return blocks.flatMap((block) => block.type === "EVENT_REFERENCE" ? [block.eventId] : []);
}

export function createStoryAdminMutationService(repository: StoryAdminMutationRepository) {
  return {
    async createDraft(input: { type: string; collection: string; title: string }) {
      const validation = validateStoryAdminInput({
        status: "DRAFT",
        type: input.type,
        collection: input.collection,
        title: input.title,
        dek: "",
        contextLocation: "",
        slug: "",
        disciplineSlugs: [],
        territoryIds: [],
        contentBlocks: [],
        heroMediaId: "",
        seoTitle: "",
        seoDescription: "",
      });
      if (!validation.ok || !input.title.trim()) {
        throw new StoryAdminError(
          "STORY_INPUT_INVALID",
          "El borrador necesita tipo, colección y título.",
          validation.ok ? [{ field: "title", message: "El título es obligatorio." }] : validation.issues,
        );
      }
      return repository.createDraft({
        type: validation.value.type,
        collection: validation.value.collection,
        title: validation.value.title.trim(),
      });
    },

    async updateDraft(input: {
      id: string;
      expectedUpdatedAt: string;
      values: StoryAdminInput;
    }) {
      const current = await repository.getStory(input.id);
      if (!current) throw new StoryAdminError("STORY_NOT_FOUND", "La historia no existe.");
      if (current.status !== "DRAFT" && current.status !== "READY") {
        throw new StoryAdminError(
          "STORY_NOT_EDITABLE",
          "A16C no modifica historias publicadas o archivadas.",
        );
      }
      if (current.updated_at !== input.expectedUpdatedAt) {
        throw new StoryAdminError(
          "STORY_VERSION_CONFLICT",
          "La historia ha cambiado desde que abriste esta versión.",
        );
      }

      const validation = validateStoryAdminInput(input.values);
      if (!validation.ok) {
        throw new StoryAdminError(
          "STORY_INPUT_INVALID",
          "La historia no supera el contrato editorial.",
          validation.issues,
        );
      }
      if (validation.value.slug) {
        const owner = await repository.findSlugOwner(validation.value.slug, input.id);
        if (owner) {
          throw new StoryAdminError("STORY_SLUG_CONFLICT", "El slug ya pertenece a otra historia.");
        }
      }
      const mediaIds = new Set(referencedMediaIds(validation.value.contentBlocks));
      if (validation.value.heroMediaId) mediaIds.add(validation.value.heroMediaId);
      if (mediaIds.size) {
        const ownedMedia = await repository.getMediaByIds([...mediaIds]);
        if (
          ownedMedia.length !== mediaIds.size
          || ownedMedia.some((item) => item.story_id !== input.id)
        ) {
          throw new StoryAdminError(
            "STORY_MEDIA_OWNERSHIP",
            "Toda la media seleccionada debe pertenecer a esta historia.",
          );
        }
      }
      const eventIds = new Set(referencedEventIds(validation.value.contentBlocks));
      if (eventIds.size) {
        const relatedIds = new Set(
          await repository.getRelatedEventIds(input.id, [...eventIds]),
        );
        if ([...eventIds].some((eventId) => !relatedIds.has(eventId))) {
          throw new StoryAdminError(
            "STORY_RELATION_INVALID",
            "Cada referencia del cuerpo debe apuntar a un evento relacionado.",
          );
        }
      }

      const updated = await repository.updateExpected({
        id: input.id,
        expectedUpdatedAt: input.expectedUpdatedAt,
        update: toUpdate(validation.value),
      });
      if (!updated) {
        throw new StoryAdminError(
          "STORY_VERSION_CONFLICT",
          "La historia ha cambiado desde que abriste esta versión.",
        );
      }
      return updated;
    },
  };
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertExpectedUpdatedAt(value: string) {
  if (!value || value.length > 64 || Number.isNaN(Date.parse(value))) {
    throw new StoryAdminError(
      "STORY_INPUT_INVALID",
      "La versión esperada de la historia no es válida.",
    );
  }
}

function assertCurrentEditableVersion(
  story: StoryRow | null,
  expectedUpdatedAt: string,
): StoryRow & { status: "DRAFT" | "READY" } {
  if (!story) throw new StoryAdminError("STORY_NOT_FOUND", "La historia no existe.");
  if (story.status !== "DRAFT" && story.status !== "READY") {
    throw new StoryAdminError("STORY_NOT_EDITABLE", "La historia ya no es editable en A16C.");
  }
  if (story.updated_at !== expectedUpdatedAt) {
    throw new StoryAdminError(
      "STORY_VERSION_CONFLICT",
      "La historia ha cambiado desde que abriste esta versión.",
    );
  }
  return story as StoryRow & { status: "DRAFT" | "READY" };
}

function normalizeStoryCredits(
  storyId: string,
  credits: readonly { personId: string; role: string; sortOrder: number }[],
) {
  if (credits.length > STORY_LIMITS.credits) {
    throw new StoryAdminError("STORY_RELATION_INVALID", "Hay demasiados créditos.");
  }
  const seen = new Set<string>();
  return credits.map((credit) => {
    const duplicateKey = `${credit.personId}\u0000${credit.role}`;
    if (
      !UUID_PATTERN.test(credit.personId)
      || !STORY_CREDIT_ROLES.includes(credit.role as StoryCreditRole)
      || !Number.isInteger(credit.sortOrder)
      || credit.sortOrder < 0
      || seen.has(duplicateKey)
    ) {
      throw new StoryAdminError("STORY_RELATION_INVALID", "Los créditos no son válidos.");
    }
    seen.add(duplicateKey);
    return {
      story_id: storyId,
      person_id: credit.personId,
      role: credit.role as StoryCreditRole,
      sort_order: credit.sortOrder,
    } satisfies StoryCreditInsert;
  });
}

function normalizeStoryEvents(
  storyId: string,
  relations: readonly { eventId: string; relationType: string; sortOrder: number }[],
) {
  if (relations.length > STORY_LIMITS.eventRelations) {
    throw new StoryAdminError("STORY_RELATION_INVALID", "Hay demasiados eventos relacionados.");
  }
  const ids = new Set<string>();
  let primaryCount = 0;
  const normalized = relations.map((relation) => {
    if (
      !relation.eventId
      || relation.eventId.length > 512
      || ids.has(relation.eventId)
      || !STORY_EVENT_RELATION_TYPES.includes(relation.relationType as StoryEventRelationType)
      || !Number.isInteger(relation.sortOrder)
      || relation.sortOrder < 0
    ) {
      throw new StoryAdminError("STORY_RELATION_INVALID", "Las relaciones de evento no son válidas.");
    }
    ids.add(relation.eventId);
    if (relation.relationType === "PRIMARY") primaryCount += 1;
    return {
      story_id: storyId,
      event_id: relation.eventId,
      relation_type: relation.relationType as StoryEventRelationType,
      sort_order: relation.sortOrder,
    } satisfies StoryEventInsert;
  });
  if (primaryCount > 1) {
    throw new StoryAdminError("STORY_RELATION_INVALID", "Sólo puede existir un evento PRIMARY.");
  }
  return { ids, normalized };
}

export function createStoryAdminRelationService(repository: StoryAdminRelationRepository) {
  async function claimVersion(
    storyId: string,
    expectedUpdatedAt: string,
    status: "DRAFT" | "READY",
  ) {
    const claimed = await repository.claimEditableStoryVersion({
      id: storyId,
      expectedUpdatedAt,
      status,
    });
    if (!claimed) {
      throw new StoryAdminError(
        "STORY_VERSION_CONFLICT",
        "La historia ha cambiado desde que abriste esta versión.",
      );
    }
    return claimed;
  }

  return {
    async replaceCredits(input: {
      storyId: string;
      expectedUpdatedAt: string;
      credits: readonly { personId: string; role: string; sortOrder: number }[];
    }) {
      assertExpectedUpdatedAt(input.expectedUpdatedAt);
      const normalized = normalizeStoryCredits(input.storyId, input.credits);
      const personIds = [...new Set(normalized.map(({ person_id }) => person_id))];
      const people = await repository.getPeopleByIds(personIds);
      const activePeople = new Set(
        people.filter(({ active }) => active).map(({ id }) => id),
      );
      if (personIds.some((personId) => !activePeople.has(personId))) {
        throw new StoryAdminError(
          "STORY_PERSON_NOT_FOUND",
          "Alguna persona editorial no existe o no está activa.",
        );
      }
      const current = assertCurrentEditableVersion(
        await repository.getStory(input.storyId),
        input.expectedUpdatedAt,
      );
      const story = await claimVersion(
        input.storyId,
        input.expectedUpdatedAt,
        current.status,
      );
      await repository.replaceCredits(input.storyId, normalized);
      return { story, credits: normalized };
    },

    async replaceEvents(input: {
      storyId: string;
      expectedUpdatedAt: string;
      relations: readonly { eventId: string; relationType: string; sortOrder: number }[];
    }) {
      assertExpectedUpdatedAt(input.expectedUpdatedAt);
      const { ids, normalized } = normalizeStoryEvents(input.storyId, input.relations);
      const existingEvents = await repository.getEventsByIds([...ids]);
      if (existingEvents.length !== ids.size) {
        throw new StoryAdminError("STORY_RELATION_INVALID", "Algún evento relacionado no existe.");
      }
      const story = assertCurrentEditableVersion(
        await repository.getStory(input.storyId),
        input.expectedUpdatedAt,
      );
      const bodyEventIds = new Set(referencedEventIds(story.content_blocks));
      if ([...bodyEventIds].some((eventId) => !ids.has(eventId))) {
        throw new StoryAdminError(
          "STORY_EVENT_REFERENCE_ORPHAN",
          "No se puede retirar un evento que sigue referenciado en el cuerpo.",
        );
      }
      const claimed = await claimVersion(
        input.storyId,
        input.expectedUpdatedAt,
        story.status,
      );
      await repository.replaceEvents(input.storyId, normalized);
      return { story: claimed, relations: normalized };
    },
  };
}

function requireClient(client: SupabaseClient<Database> | null = createSupabaseServerClient()) {
  if (!client) {
    throw new StoryAdminError(
      "SUPABASE_NOT_CONFIGURED",
      "Supabase server credentials are not configured.",
    );
  }
  return client;
}

export function classifyStoryAdminDatabaseError(
  error?: { code?: string } | null,
  uniqueConstraint?: "story-slug",
): StoryAdminErrorCode {
  if (error?.code === "23505" && uniqueConstraint === "story-slug") {
    return "STORY_SLUG_CONFLICT";
  }
  if (error?.code && ["23503", "23505", "23514"].includes(error.code)) {
    return "DATABASE_CONSTRAINT_CONFLICT";
  }
  return "DATABASE_OPERATION_FAILED";
}

function databaseFailure(
  message: string,
  error?: { code?: string } | null,
  uniqueConstraint?: "story-slug",
): never {
  const code = classifyStoryAdminDatabaseError(error, uniqueConstraint);
  if (code === "STORY_SLUG_CONFLICT") {
    throw new StoryAdminError(code, "El slug ya pertenece a otra historia.");
  }
  if (code === "DATABASE_CONSTRAINT_CONFLICT") {
    throw new StoryAdminError(code, "La operación no cumple las restricciones de datos.");
  }
  throw new StoryAdminError(code, message);
}

function createSupabaseMutationRepository(
  client: SupabaseClient<Database>,
): StoryAdminMutationRepository {
  return {
    async createDraft(input) {
      const { data, error } = await client
        .from("stories")
        .insert({ ...input, status: "DRAFT", content_blocks: [], schema_version: 1 })
        .select("*")
        .single();
      if (error || !data) databaseFailure("No se pudo crear el borrador.", error, "story-slug");
      return data;
    },
    async getStory(id) {
      const { data, error } = await client.from("stories").select("*").eq("id", id).maybeSingle();
      if (error) databaseFailure("No se pudo consultar la historia.", error);
      return data;
    },
    async findSlugOwner(slug, excludingId) {
      const { data, error } = await client
        .from("stories")
        .select("id")
        .eq("slug", slug)
        .neq("id", excludingId)
        .limit(1)
        .maybeSingle();
      if (error) databaseFailure("No se pudo comprobar el slug.", error);
      return data?.id ?? null;
    },
    async getMediaByIds(mediaIds) {
      if (!mediaIds.length) return [];
      const { data, error } = await client
        .from("story_media")
        .select("*")
        .in("id", [...mediaIds]);
      if (error) databaseFailure("No se pudo comprobar la media seleccionada.", error);
      return data ?? [];
    },
    async getRelatedEventIds(storyId, eventIds) {
      if (!eventIds.length) return [];
      const { data, error } = await client
        .from("story_events")
        .select("event_id")
        .eq("story_id", storyId)
        .in("event_id", [...eventIds]);
      if (error) databaseFailure("No se pudieron comprobar las referencias de evento.", error);
      return (data ?? []).map(({ event_id }) => event_id);
    },
    async updateExpected(input) {
      const { data, error } = await client
        .from("stories")
        .update(input.update)
        .eq("id", input.id)
        .eq("updated_at", input.expectedUpdatedAt)
        .in("status", ["DRAFT", "READY"])
        .select("*")
        .maybeSingle();
      if (error) databaseFailure("No se pudo guardar la historia.", error, "story-slug");
      return data;
    },
  };
}

export async function listStoriesForAdmin(status: StoryListStatus = "ALL") {
  const client = requireClient();
  let query = client.from("stories").select("*").order("updated_at", { ascending: false });
  if (status !== "ALL") query = query.eq("status", status);
  const { data, error } = await query;
  if (error) databaseFailure("No se pudo listar Historias.", error);
  return data ?? [];
}

export async function createStoryDraft(input: {
  type: string;
  collection: string;
  title: string;
}) {
  const client = requireClient();
  return createStoryAdminMutationService(createSupabaseMutationRepository(client)).createDraft(input);
}

export async function updateStoryDraft(input: {
  id: string;
  expectedUpdatedAt: string;
  values: StoryAdminInput;
}) {
  const client = requireClient();
  return createStoryAdminMutationService(createSupabaseMutationRepository(client)).updateDraft(input);
}

function createSupabaseStoryMediaMetadataRepository(
  client: SupabaseClient<Database>,
): StoryMediaMetadataRepository {
  return {
    async getStory(id) {
      const { data, error } = await client.from("stories").select("*").eq("id", id).maybeSingle();
      if (error) databaseFailure("No se pudo comprobar la historia.", error);
      return data;
    },
    async getMedia(id) {
      const { data, error } = await client.from("story_media").select("*").eq("id", id).maybeSingle();
      if (error) databaseFailure("No se pudo comprobar la media.", error);
      return data;
    },
    async updateExpected(input) {
      const { data, error } = await client
        .from("story_media")
        .update(input.update)
        .eq("id", input.mediaId)
        .eq("story_id", input.storyId)
        .eq("updated_at", input.expectedUpdatedAt)
        .select("*")
        .maybeSingle();
      if (error) databaseFailure("No se pudieron guardar los metadatos de la media.", error);
      return data;
    },
  };
}

export async function updateStoryMediaMetadata(input: StoryMediaMetadataInput) {
  const client = requireClient();
  return createStoryMediaMetadataService(
    createSupabaseStoryMediaMetadataRepository(client),
  ).update(input);
}

export async function updateStoryMediaMetadataWithReadiness(
  input: StoryMediaMetadataInput,
) {
  const mediaService = createSupabaseStoryMediaService();
  return createStoryMediaMetadataReadinessService({
    updateMetadata: updateStoryMediaMetadata,
    publicationReadiness: (storyId) => mediaService.publicationReadiness(storyId),
  }).update(input);
}

async function getEventsByIds(
  client: SupabaseClient<Database>,
  ids: readonly string[],
) {
  if (!ids.length) return [];
  const { data, error } = await client
    .from("events")
    .select("id,slug,title,start_date,venue,city,province")
    .in("id", [...ids]);
  if (error) databaseFailure("No se pudieron consultar los eventos relacionados.", error);
  return data ?? [];
}

export async function getStoryForAdmin(id: string): Promise<StoryAdminBundle | null> {
  const client = requireClient();
  const [storyResult, mediaResult, peopleResult, creditsResult, relationsResult] = await Promise.all([
    client.from("stories").select("*").eq("id", id).maybeSingle(),
    client.from("story_media").select("*").eq("story_id", id).order("created_at"),
    client.from("editorial_people").select("*").eq("active", true).order("display_name"),
    client.from("story_credits").select("*").eq("story_id", id).order("sort_order"),
    client.from("story_events").select("*").eq("story_id", id).order("sort_order"),
  ]);
  if (
    storyResult.error || mediaResult.error || peopleResult.error
    || creditsResult.error || relationsResult.error
  ) {
    databaseFailure("No se pudo cargar el editor de Historias.");
  }
  if (!storyResult.data) return null;
  const relations = relationsResult.data ?? [];
  return {
    story: storyResult.data,
    media: mediaResult.data ?? [],
    people: peopleResult.data ?? [],
    credits: creditsResult.data ?? [],
    eventRelations: relations,
    relatedEvents: await getEventsByIds(client, relations.map(({ event_id }) => event_id)),
  };
}

export async function createEditorialPerson(displayName: string) {
  const client = requireClient();
  const normalized = displayName.trim().replace(/\s+/g, " ");
  if (!normalized || normalized.length > 240) {
    throw new StoryAdminError("STORY_INPUT_INVALID", "El nombre editorial no es válido.");
  }
  const { data: existing, error: readError } = await client
    .from("editorial_people")
    .select("*")
    .eq("display_name", normalized)
    .limit(1)
    .maybeSingle();
  if (readError) databaseFailure("No se pudo comprobar la persona editorial.", readError);
  if (existing) return { person: existing, reused: true };
  const { data, error } = await client
    .from("editorial_people")
    .insert({ display_name: normalized, active: true })
    .select("*")
    .single();
  if (error || !data) databaseFailure("No se pudo crear la persona editorial.", error);
  return { person: data, reused: false };
}

export async function searchEventsForStoryAdmin(query: string, limit = 20) {
  const normalized = query.trim().slice(0, 120);
  if (normalized.length < 2) return [];
  const escaped = normalized.replace(/[\\%_]/g, (character) => `\\${character}`);
  const client = requireClient();
  const { data, error } = await client
    .from("events")
    .select("id,slug,title,start_date,venue,city,province")
    .ilike("title", `%${escaped}%`)
    .order("start_date", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 20));
  if (error) databaseFailure("No se pudieron buscar eventos.", error);
  return data ?? [];
}

function createSupabaseRelationRepository(
  client: SupabaseClient<Database>,
): StoryAdminRelationRepository {
  return {
    async getStory(id) {
      const { data, error } = await client.from("stories").select("*").eq("id", id).maybeSingle();
      if (error) databaseFailure("No se pudo comprobar la historia.", error);
      return data;
    },
    async getPeopleByIds(personIds) {
      if (!personIds.length) return [];
      const { data, error } = await client
        .from("editorial_people")
        .select("*")
        .in("id", [...personIds]);
      if (error) databaseFailure("No se pudieron comprobar las personas editoriales.", error);
      return data ?? [];
    },
    async getEventsByIds(eventIds) {
      return getEventsByIds(client, eventIds);
    },
    async claimEditableStoryVersion(input) {
      const { data, error } = await client
        .from("stories")
        .update({ status: input.status })
        .eq("id", input.id)
        .eq("updated_at", input.expectedUpdatedAt)
        .in("status", ["DRAFT", "READY"])
        .select("*")
        .maybeSingle();
      if (error) databaseFailure("No se pudo reclamar la versión de la historia.", error);
      return data;
    },
    async replaceCredits(storyId, credits) {
      const { error: deleteError } = await client
        .from("story_credits")
        .delete()
        .eq("story_id", storyId);
      if (deleteError) databaseFailure("No se pudieron reemplazar los créditos.", deleteError);
      if (credits.length) {
        const { error } = await client.from("story_credits").insert([...credits]);
        if (error) {
          databaseFailure(
            "Los créditos anteriores se retiraron, pero los nuevos no se pudieron guardar.",
            error,
          );
        }
      }
    },
    async replaceEvents(storyId, relations) {
      const { error: deleteError } = await client
        .from("story_events")
        .delete()
        .eq("story_id", storyId);
      if (deleteError) databaseFailure("No se pudieron reemplazar los eventos.", deleteError);
      if (relations.length) {
        const { error } = await client.from("story_events").insert([...relations]);
        if (error) {
          databaseFailure(
            "Las relaciones anteriores se retiraron, pero las nuevas no se pudieron guardar.",
            error,
          );
        }
      }
    },
  };
}

export async function replaceStoryCredits(input: {
  storyId: string;
  expectedUpdatedAt: string;
  credits: readonly { personId: string; role: string; sortOrder: number }[];
}) {
  const client = requireClient();
  return createStoryAdminRelationService(
    createSupabaseRelationRepository(client),
  ).replaceCredits(input);
}

export async function replaceStoryEvents(input: {
  storyId: string;
  expectedUpdatedAt: string;
  relations: readonly { eventId: string; relationType: string; sortOrder: number }[];
}) {
  const client = requireClient();
  return createStoryAdminRelationService(
    createSupabaseRelationRepository(client),
  ).replaceEvents(input);
}

export async function resolveStoryMediaForAdmin(storyId: string, media: readonly StoryMediaRow[]) {
  const service = createSupabaseStoryMediaService();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new StoryAdminError("SUPABASE_NOT_CONFIGURED", "Supabase public origin is not configured.");
  }
  return Promise.all(media.map(async (item) => {
    if (item.story_id !== storyId) {
      throw new StoryAdminError("STORY_MEDIA_OWNERSHIP", "Media ownership mismatch.");
    }
    if (item.bucket_id === STORY_MEDIA_DRAFT_BUCKET) {
      const preview = await service.createPreviewUrl({ storyId, mediaId: item.id });
      return { ...item, resolvedUrl: preview.signedUrl, private: true };
    }
    if (item.bucket_id === STORY_MEDIA_PUBLIC_BUCKET) {
      return {
        ...item,
        resolvedUrl: buildCanonicalStoryMediaPublicUrl(supabaseUrl, item.object_path),
        private: false,
      };
    }
    throw new StoryAdminError("STORY_MEDIA_OWNERSHIP", "Media bucket is not supported.");
  }));
}
