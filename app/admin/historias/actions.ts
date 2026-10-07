"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { SEO_DISCIPLINES } from "@/lib/seo-taxonomy";
import { SPANISH_TERRITORIES } from "@/lib/regions/territory-contract";
import {
  requireTrustedAdminMutation,
} from "@/lib/admin-session.server";
import { parseStoryBlocksJson } from "@/lib/stories/story-admin";
import {
  StoryAdminError,
  createEditorialPerson,
  createStoryDraft,
  replaceStoryCredits,
  replaceStoryEvents,
  updateStoryDraft,
  updateStoryMediaMetadataWithReadiness,
} from "@/lib/stories/story-admin.server";

function stringValue(formData: FormData, name: string) {
  return String(formData.get(name) ?? "");
}

function allowedValues(formData: FormData, name: string, allowed: ReadonlySet<string>) {
  const values = formData.getAll(name).map(String);
  if (values.some((value) => !allowed.has(value))) {
    throw new StoryAdminError("STORY_INPUT_INVALID", `Valor no permitido para ${name}.`);
  }
  return values;
}

function actionErrorCode(error: unknown) {
  return error instanceof StoryAdminError ? error.code.toLowerCase() : "unexpected";
}

async function protectMutation(nextPath: string) {
  await requireTrustedAdminMutation(nextPath);
}

export async function createStoryAction(formData: FormData) {
  await protectMutation("/admin/historias/nueva");
  let createdId = "";
  try {
    const story = await createStoryDraft({
      type: stringValue(formData, "type"),
      collection: stringValue(formData, "collection"),
      title: stringValue(formData, "title"),
    });
    createdId = story.id;
  } catch (error) {
    redirect(`/admin/historias/nueva?error=${actionErrorCode(error)}`);
  }
  redirect(`/admin/historias/${createdId}?created=1`);
}

export async function updateStoryAction(formData: FormData) {
  const id = stringValue(formData, "id");
  const editorPath = `/admin/historias/${encodeURIComponent(id)}`;
  await protectMutation(editorPath);
  try {
    const document = parseStoryBlocksJson(stringValue(formData, "contentBlocks"));
    if (!document) {
      throw new StoryAdminError("STORY_INPUT_INVALID", "El cuerpo estructurado no es válido.");
    }
    const disciplineSlugs = allowedValues(
      formData,
      "disciplineSlugs",
      new Set(SEO_DISCIPLINES.map(({ slug }) => slug)),
    );
    const territoryIds = allowedValues(
      formData,
      "territoryIds",
      new Set(SPANISH_TERRITORIES.map(({ id: territoryId }) => territoryId)),
    );
    await updateStoryDraft({
      id,
      expectedUpdatedAt: stringValue(formData, "expectedUpdatedAt"),
      values: {
        status: stringValue(formData, "status"),
        type: stringValue(formData, "type"),
        collection: stringValue(formData, "collection"),
        title: stringValue(formData, "title"),
        dek: stringValue(formData, "dek"),
        contextLocation: stringValue(formData, "contextLocation"),
        slug: stringValue(formData, "slug"),
        disciplineSlugs,
        territoryIds,
        contentBlocks: document.contentBlocks,
        heroMediaId: stringValue(formData, "heroMediaId"),
        seoTitle: stringValue(formData, "seoTitle"),
        seoDescription: stringValue(formData, "seoDescription"),
      },
    });
  } catch (error) {
    redirect(`${editorPath}?error=${actionErrorCode(error)}`);
  }
  revalidatePath(editorPath);
  redirect(`${editorPath}?saved=story`);
}

export async function createEditorialPersonAction(formData: FormData) {
  const storyId = stringValue(formData, "storyId");
  const editorPath = `/admin/historias/${encodeURIComponent(storyId)}`;
  await protectMutation(editorPath);
  let result = "created";
  try {
    const created = await createEditorialPerson(stringValue(formData, "displayName"));
    result = created.reused ? "reused" : "created";
  } catch (error) {
    redirect(`${editorPath}?error=${actionErrorCode(error)}#credits`);
  }
  revalidatePath(editorPath);
  redirect(`${editorPath}?person=${result}#credits`);
}

export async function replaceStoryCreditsAction(formData: FormData) {
  const storyId = stringValue(formData, "storyId");
  const editorPath = `/admin/historias/${encodeURIComponent(storyId)}`;
  await protectMutation(editorPath);
  try {
    const credits = formData.getAll("creditPersonId").map((value, index) => {
      const personId = String(value);
      return {
        personId,
        role: stringValue(formData, `creditRole:${personId}`),
        sortOrder: index,
      };
    });
    await replaceStoryCredits({
      storyId,
      expectedUpdatedAt: stringValue(formData, "expectedUpdatedAt"),
      credits,
    });
  } catch (error) {
    redirect(`${editorPath}?error=${actionErrorCode(error)}#credits`);
  }
  revalidatePath(editorPath);
  redirect(`${editorPath}?saved=credits#credits`);
}

export async function replaceStoryEventsAction(formData: FormData) {
  const storyId = stringValue(formData, "storyId");
  const editorPath = `/admin/historias/${encodeURIComponent(storyId)}`;
  await protectMutation(editorPath);
  try {
    const relations = formData.getAll("eventId").map((value, index) => {
      const eventId = String(value);
      return {
        eventId,
        relationType: stringValue(formData, `eventRelation:${eventId}`),
        sortOrder: index,
      };
    });
    await replaceStoryEvents({
      storyId,
      expectedUpdatedAt: stringValue(formData, "expectedUpdatedAt"),
      relations,
    });
  } catch (error) {
    redirect(`${editorPath}?error=${actionErrorCode(error)}#events`);
  }
  revalidatePath(editorPath);
  redirect(`${editorPath}?saved=events#events`);
}

export async function updateStoryMediaMetadataAction(input: {
  storyId: string;
  mediaId: string;
  expectedUpdatedAt: string;
  altText: string;
  caption: string;
  credit: string;
  rightsType: string;
  rightsNotes: string;
}) {
  const editorPath = `/admin/historias/${encodeURIComponent(input.storyId)}`;
  await protectMutation(editorPath);
  try {
    const result = await updateStoryMediaMetadataWithReadiness(input);
    revalidatePath(editorPath);
    return { ok: true as const, ...result };
  } catch (error) {
    return {
      ok: false as const,
      code: actionErrorCode(error),
      message: error instanceof StoryAdminError
        ? error.message
        : "No se pudieron guardar los metadatos.",
    };
  }
}
