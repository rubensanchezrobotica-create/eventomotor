"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTrustedAdminMutation } from "@/lib/admin-session.server";
import { prepareStoryForPublication } from "@/lib/stories/story-launch.server";
import { publishStory } from "@/lib/stories/story-publication.server";
import { getStoryForAdmin } from "@/lib/stories/story-admin.server";

function field(data: FormData, key: string) { return String(data.get(key) ?? ""); }

export async function prepareStoryPublicationAction(data: FormData) {
  const storyId = field(data, "storyId");
  const path = `/admin/historias/${encodeURIComponent(storyId)}/publicacion`;
  await requireTrustedAdminMutation(path);
  if (field(data, "confirmPublicDerivatives") !== "yes") redirect(`${path}?error=confirmation_required`);
  try {
    await prepareStoryForPublication({ storyId, expectedUpdatedAt: field(data, "expectedUpdatedAt") });
  } catch { redirect(`${path}?error=preparation_failed`); }
  revalidatePath(path);
  revalidatePath(`/admin/historias/${encodeURIComponent(storyId)}`);
  redirect(`${path}?prepared=1`);
}

export async function publishStoryAction(data: FormData) {
  const storyId = field(data, "storyId");
  const path = `/admin/historias/${encodeURIComponent(storyId)}/publicacion`;
  await requireTrustedAdminMutation(path);
  if (field(data, "confirmPublication") !== "yes") redirect(`${path}?error=confirmation_required`);
  let slug = "";
  let section = "historias";
  try {
    const published = await publishStory({ storyId, expectedUpdatedAt: field(data, "expectedUpdatedAt"), requestId: field(data, "requestId") });
    slug = published.slug;
    section = published.collection === "COLABORACIONES" ? "colaboraciones" : "historias";
  } catch { redirect(`${path}?error=publication_failed`); }
  revalidatePath(`/${section}`);
  revalidatePath(`/${section}/${slug}`);
  revalidatePath("/sitemap.xml");
  revalidatePath(path);
  const bundle = await getStoryForAdmin(storyId);
  for (const event of bundle?.relatedEvents ?? []) {
    if (event.slug) revalidatePath(`/evento/${event.slug}`);
  }
  redirect(`${path}?published=1`);
}
