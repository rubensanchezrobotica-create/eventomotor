import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import test from "node:test";
import sharp from "sharp";
import { createSupabaseServerClient } from "@/lib/supabase";
import { createEditorialPerson, createStoryDraft, getStoryForAdmin, replaceStoryCredits, replaceStoryEvents, updateStoryDraft, updateStoryMediaMetadata } from "@/lib/stories/story-admin.server";
import { createSupabaseStoryMediaService } from "@/lib/stories/story-media.server";
import { prepareStoryForPublication } from "@/lib/stories/story-launch.server";
import { publishStory } from "@/lib/stories/story-publication.server";
import { getPublicStory, listPublicStories, getPublicStoriesForEvent } from "@/lib/stories/story-public.server";
import { buildStoriesSitemap } from "@/lib/stories/story-public-seo";

test("real ephemeral DRAFT/private -> promotion/READY -> atomic publication -> narrow public loaders", { skip: process.env.STORIES_PUBLICATION_INTEGRATION !== "1" }, async (t) => {
  assert.ok(["127.0.0.1", "localhost"].includes(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname));
  const client = createSupabaseServerClient()!;
  const media = createSupabaseStoryMediaService(client);
  const suffix = randomUUID(), eventId = `stories-public-${suffix}`;
  const event = await client.from("events").insert({ id: eventId, slug: eventId, title: "Synthetic public event", start_date: "2030-01-02", visible: true });
  assert.equal(event.error, null);
  const draft = await createStoryDraft({ title: "Synthetic public launch", type: "CRONICA", collection: "DESDE_DENTRO" });
  const image = await sharp({ create: { width: 96, height: 64, channels: 3, background: "orange" } }).png().toBuffer();
  const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
  const intent = await media.createUploadIntent({ storyId: draft.id, mimeType: "image/png", byteSize: image.length, operationId: randomUUID() });
  assert.ok(intent.signedToken);
  const upload = await client.storage.from(intent.bucketId).uploadToSignedUrl(intent.objectPath, intent.signedToken, image, { contentType: "image/png" });
  assert.equal(upload.error, null);
  const finalized = await media.finalizeUpload({ storyId: draft.id, mediaId: intent.mediaId, mimeType: "image/png", byteSize: image.length });
  await updateStoryMediaMetadata({ storyId: draft.id, mediaId: intent.mediaId, expectedUpdatedAt: finalized.media.updated_at,
    altText: "Synthetic public alt", caption: "Synthetic approved caption", credit: "Synthetic author", rightsType: "OWN", rightsNotes: "INTERNAL_RIGHTS_SENTINEL" });
  const person = await createEditorialPerson(`Synthetic public author ${suffix}`);
  const current = (await getStoryForAdmin(draft.id))!;
  const credited = await replaceStoryCredits({ storyId: draft.id, expectedUpdatedAt: current.story.updated_at,
    credits: [{ personId: person.person.id, role: "TEXT", sortOrder: 0 }, { personId: person.person.id, role: "PHOTO", sortOrder: 1 }] });
  const related = await replaceStoryEvents({ storyId: draft.id, expectedUpdatedAt: credited.story.updated_at,
    relations: [{ eventId, relationType: "PRIMARY", sortOrder: 0 }] });
  const story = await updateStoryDraft({ id: draft.id, expectedUpdatedAt: related.story.updated_at, values: {
    status: "DRAFT", type: "CRONICA", collection: "DESDE_DENTRO", title: "Synthetic public launch", dek: "Synthetic reviewed dek", contextLocation: "Synthetic circuit",
    slug: `synthetic-public-${suffix}`, disciplineSlugs: ["circuito"], territoryIds: ["madrid"], heroMediaId: intent.mediaId,
    seoTitle: "Synthetic CMS title", seoDescription: "Synthetic CMS description",
    contentBlocks: [{ id: "p", type: "PARAGRAPH", content: [{ type: "TEXT", text: "Synthetic body" }] }, { id: "photo", type: "IMAGE", mediaId: intent.mediaId }, { id: "event", type: "EVENT_REFERENCE", eventId }],
  } });
  assert.equal(await getPublicStory(story.slug), null);
  assert.deepEqual(await getPublicStoriesForEvent(eventId), []);
  const before = (await getStoryForAdmin(draft.id))!;
  const ready = await prepareStoryForPublication({ storyId: draft.id, expectedUpdatedAt: story.updated_at });
  assert.equal(ready.status, "READY");
  assert.equal(await getPublicStory(story.slug), null);
  assert.deepEqual(await getPublicStoriesForEvent(eventId), []);
  const after = (await getStoryForAdmin(draft.id))!;
  assert.deepEqual(after.story.content_blocks, before.story.content_blocks);
  assert.deepEqual(after.credits, before.credits); assert.deepEqual(after.eventRelations, before.eventRelations);
  assert.equal(after.media[0].rights_notes, "INTERNAL_RIGHTS_SENTINEL");
  const original = await client.storage.from("story-media-drafts").download(intent.objectPath);
  assert.equal(original.error, null); assert.ok(original.data);
  assert.equal(hash(new Uint8Array(await original.data.arrayBuffer())), hash(image));
  const retryPrepare = await prepareStoryForPublication({ storyId: draft.id, expectedUpdatedAt: ready.updated_at });
  assert.equal(retryPrepare.updated_at, ready.updated_at, "promotion retries do not duplicate or modify exact public state");
  const request = { storyId: draft.id, expectedUpdatedAt: ready.updated_at, requestId: randomUUID() };
  const published = await publishStory(request);
  assert.equal(published.status, "PUBLISHED"); assert.ok(published.published_at);
  assert.deepEqual(await publishStory(request), published);
  const publicStory = await getPublicStory(story.slug);
  assert.ok(publicStory); assert.equal(publicStory.blocks.length, 3); assert.equal(Object.keys(publicStory.media).length, 1);
  assert.equal(publicStory.credits.length, 2); assert.equal(publicStory.events[eventId].href, `/evento/${eventId}`);
  assert.ok(!JSON.stringify(publicStory).includes("INTERNAL_RIGHTS_SENTINEL"));
  assert.ok(!JSON.stringify(publicStory).includes("story-media-drafts"));
  assert.equal((await getPublicStoriesForEvent(eventId)).length, 1);
  assert.ok((await listPublicStories()).some((s) => s.slug === story.slug));
  assert.ok(buildStoriesSitemap(await listPublicStories()).some((entry) => entry.url.endsWith(`/historias/${story.slug}`)));
  // Exact published state is immutable; fixtures disappear with stop --no-backup.
  t.diagnostic("REAL_A16EF_PROMOTION_READY_PUBLICATION_PUBLIC_LOADERS=PASS");
  t.diagnostic("REAL_PRIVATE_ORIGINAL_PRESERVED_AND_PUBLIC_RETRY_IDEMPOTENT=PASS");
});
