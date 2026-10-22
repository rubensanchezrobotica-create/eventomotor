import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase";
import { createStoryDraft, createEditorialPerson, replaceStoryCredits, getStoryForAdmin, updateStoryDraft, updateStoryMediaMetadata } from "@/lib/stories/story-admin.server";
import { createSupabaseStoryMediaService } from "@/lib/stories/story-media.server";
import { prepareStoryForPublication } from "@/lib/stories/story-launch.server";
import { publishStory } from "@/lib/stories/story-publication.server";
import { commercialContentHash } from "@/lib/stories/story-commercial.server";
import { emptyCommercialMetadata } from "@/lib/stories/story-commercial";
import { getPublicCollaboration, getPublicStory, listPublicCollaborations, listPublicStories } from "@/lib/stories/story-public.server";
import { commercialFixture } from "./commercial-fixture";

test("real commercial services -> private promotion -> READY -> receipt -> actual public loader", {
  skip: process.env.STORIES_PUBLICATION_INTEGRATION !== "1",
}, async () => {
  assert.ok(["127.0.0.1", "localhost"].includes(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname));
  const client = createSupabaseServerClient()!;
  const service = createSupabaseStoryMediaService(client);
  const suffix = randomUUID();
  const draft = await createStoryDraft({ title: "Synthetic commercial launch", type: "ARTICULO", collection: "COLABORACIONES" });
  const bytes = await sharp({ create: { width: 96, height: 64, channels: 3, background: "navy" } }).webp().toBuffer();
  const intent = await service.createUploadIntent({ storyId: draft.id, mimeType: "image/webp", byteSize: bytes.length });
  assert.ok(intent.signedToken);
  assert.equal((await client.storage.from(intent.bucketId).uploadToSignedUrl(intent.objectPath, intent.signedToken, bytes, { contentType: "image/webp" })).error, null);
  const finalized = await service.finalizeUpload({ storyId: draft.id, mediaId: intent.mediaId, mimeType: "image/webp", byteSize: bytes.length });
  await updateStoryMediaMetadata({ storyId: draft.id, mediaId: intent.mediaId, expectedUpdatedAt: finalized.media.updated_at,
    altText: "Synthetic licensed image", caption: "Synthetic approved caption", credit: "Synthetic agency", rightsType: "LICENSED", rightsNotes: "PRIVATE_SYNTHETIC_RIGHTS" });
  const person = await createEditorialPerson(`Synthetic commercial author ${suffix}`);
  await replaceStoryCredits({ storyId: draft.id, expectedUpdatedAt: (await getStoryForAdmin(draft.id))!.story.updated_at,
    credits: [{ personId: person.person.id, role: "TEXT", sortOrder: 0 }] });
  const current = (await getStoryForAdmin(draft.id))!.story;
  const saved = await updateStoryDraft({ id: draft.id, expectedUpdatedAt: current.updated_at, values: {
    status: "DRAFT", type: "ARTICULO", collection: "COLABORACIONES", title: "Synthetic commercial launch", dek: "Synthetic approved summary",
    slug: `synthetic-commercial-${suffix}`, contextLocation: "", disciplineSlugs: ["rutas"], territoryIds: [], heroMediaId: intent.mediaId,
    contentBlocks: commercialFixture().story.content_blocks, seoTitle: "Synthetic commercial SEO", seoDescription: "Synthetic commercial description",
    commercialMetadata: { ...emptyCommercialMetadata(), advertiserName: "Synthetic advertiser", advertiserConfirmed: true, factsVerified: true,
      editorialApprovalRef: "PRIVATE_SYNTHETIC_APPROVAL", imageAuthorizationRef: "PRIVATE_SYNTHETIC_LICENSE", commercialLinksChecked: true }, approveCommercialVersion: true,
  } });
  const catalog = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const parity = await catalog.rpc("story_commercial_content_hash", { s: saved });
  assert.equal(parity.error, null); assert.equal(parity.data, commercialContentHash(saved));
  assert.equal(await getPublicCollaboration(saved.slug), null);
  const ready = await prepareStoryForPublication({ storyId: draft.id, expectedUpdatedAt: saved.updated_at });
  assert.equal(ready.status, "READY");
  assert.equal(ready.commercial_metadata!.approvedContentHash, saved.commercial_metadata!.approvedContentHash, "technical promotion preserves approval");
  const request = { storyId: draft.id, expectedUpdatedAt: ready.updated_at, requestId: randomUUID() };
  const published = await publishStory(request);
  assert.equal(published.status, "PUBLISHED"); assert.deepEqual(await publishStory(request), published);
  const receipt = await client.from("story_publication_receipts").select("request_id").eq("story_id", draft.id);
  assert.equal(receipt.error, null); assert.deepEqual(receipt.data, [{ request_id: request.requestId }]);
  const article = await getPublicCollaboration(saved.slug);
  assert.ok(article); assert.equal(article.sponsor!.name, "Synthetic advertiser");
  assert.deepEqual(article.blocks, saved.content_blocks);
  assert.equal((await getPublicStory(saved.slug))?.slug, saved.slug);
  assert.equal((await listPublicStories()).filter((item) => item.slug === saved.slug).length, 1);
  assert.ok((await listPublicCollaborations()).some((item) => item.slug === saved.slug));
  assert.ok(!/PRIVATE_SYNTHETIC|commercial_metadata|approvedContentHash|story-media-drafts/.test(JSON.stringify(article)));
  // Synthetic records/objects disappear when CI destroys its isolated stack.
});
