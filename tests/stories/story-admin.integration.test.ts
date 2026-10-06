import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createSupabaseServerClient } from "@/lib/supabase";
import type { StoryContentBlock } from "@/lib/stories/story-types";
import {
  StoryAdminError,
  createEditorialPerson,
  createStoryDraft,
  getStoryForAdmin,
  replaceStoryCredits,
  replaceStoryEvents,
  updateStoryDraft,
} from "@/lib/stories/story-admin.server";

const enabled = process.env.STORIES_ADMIN_INTEGRATION === "1";
const integration = enabled ? test : test.skip;

integration("ephemeral admin CRUD, relations and optimistic conflict remain fail-closed", async (t) => {
  const client = createSupabaseServerClient();
  assert.ok(client, "ephemeral Supabase service client is required");
  const suffix = randomUUID();
  const eventIds = [
    `stories-admin-a-${suffix}`,
    `stories-admin-b-${suffix}`,
    `stories-admin-c-${suffix}`,
  ];
  let storyId = "";
  let personId = "";

  t.after(async () => {
    if (storyId) {
      await client.from("story_credits").delete().eq("story_id", storyId);
      await client.from("story_events").delete().eq("story_id", storyId);
      await client.from("stories").delete().eq("id", storyId);
    }
    if (personId) await client.from("editorial_people").delete().eq("id", personId);
    await client.from("events").delete().in("id", eventIds);
  });

  const eventInsert = await client.from("events").insert(eventIds.map((eventId, index) => ({
    id: eventId,
    slug: eventId,
    title: `Synthetic Stories integration event ${index + 1}`,
    start_date: `2030-01-${20 + index}`,
  })));
  assert.equal(eventInsert.error, null);

  const draft = await createStoryDraft({
    type: "REPORTAJE",
    collection: "DESDE_DENTRO",
    title: "Synthetic integration draft",
  });
  storyId = draft.id;
  assert.equal(draft.status, "DRAFT");

  const initial = await getStoryForAdmin(storyId);
  assert.equal(initial?.story.id, storyId);

  const values = (
    title: string,
    status: "DRAFT" | "READY" = "DRAFT",
    contentBlocks: StoryContentBlock[] = [{
      id: "paragraph-1",
      type: "PARAGRAPH",
      content: [{ type: "TEXT", text: "Synthetic integration body." }],
    }],
  ) => ({
    status,
    type: "REPORTAJE",
    collection: "DESDE_DENTRO",
    title,
    dek: "Synthetic integration dek",
    contextLocation: "Synthetic circuit",
    slug: `synthetic-${suffix}`,
    disciplineSlugs: ["circuito"],
    territoryIds: ["madrid"],
    contentBlocks,
    heroMediaId: "",
    seoTitle: "Synthetic integration SEO",
    seoDescription: "Synthetic integration description.",
  });

  const race = await Promise.allSettled([
    updateStoryDraft({ id: storyId, expectedUpdatedAt: draft.updated_at, values: values("Writer A") }),
    updateStoryDraft({ id: storyId, expectedUpdatedAt: draft.updated_at, values: values("Writer B") }),
  ]);
  assert.equal(race.filter(({ status }) => status === "fulfilled").length, 1);
  const rejected = race.find(({ status }) => status === "rejected");
  assert.ok(rejected && rejected.status === "rejected");
  assert.ok(rejected.reason instanceof StoryAdminError);
  assert.equal(rejected.reason.code, "STORY_VERSION_CONFLICT");

  const afterRace = await getStoryForAdmin(storyId);
  assert.ok(afterRace);
  const ready = await updateStoryDraft({
    id: storyId,
    expectedUpdatedAt: afterRace.story.updated_at,
    values: values("Synthetic ready story", "READY"),
  });
  assert.equal(ready.status, "READY");

  const person = await createEditorialPerson(`Synthetic editor ${suffix}`);
  personId = person.person.id;
  const creditsSaved = await replaceStoryCredits({
    storyId,
    expectedUpdatedAt: ready.updated_at,
    credits: [{ personId, role: "TEXT", sortOrder: 0 }],
  });
  assert.notEqual(creditsSaved.story.updated_at, ready.updated_at);
  const eventsSaved = await replaceStoryEvents({
    storyId,
    expectedUpdatedAt: creditsSaved.story.updated_at,
    relations: [
      { eventId: eventIds[0], relationType: "PRIMARY", sortOrder: 0 },
      { eventId: eventIds[1], relationType: "RELATED", sortOrder: 1 },
      { eventId: eventIds[2], relationType: "RELATED", sortOrder: 2 },
    ],
  });
  assert.notEqual(eventsSaved.story.updated_at, creditsSaved.story.updated_at);
  const related = await getStoryForAdmin(storyId);
  assert.equal(related?.credits.length, 1);
  assert.deepEqual(
    related?.eventRelations.map(({ event_id, relation_type, sort_order }) => [
      event_id,
      relation_type,
      sort_order,
    ]),
    [
      [eventIds[0], "PRIMARY", 0],
      [eventIds[1], "RELATED", 1],
      [eventIds[2], "RELATED", 2],
    ],
  );
  assert.equal(related?.eventRelations.filter(({ relation_type }) => relation_type === "PRIMARY").length, 1);
  assert.equal(related?.eventRelations.filter(({ relation_type }) => relation_type === "RELATED").length, 2);

  const persistedRelations = await client
    .from("story_events")
    .select("event_id, relation_type, sort_order")
    .eq("story_id", storyId)
    .order("sort_order", { ascending: true });
  assert.equal(persistedRelations.error, null);
  assert.deepEqual(
    persistedRelations.data?.map(({ event_id, relation_type, sort_order }) => [
      event_id,
      relation_type,
      sort_order,
    ]),
    [
      [eventIds[0], "PRIMARY", 0],
      [eventIds[1], "RELATED", 1],
      [eventIds[2], "RELATED", 2],
    ],
  );

  const bodySaved = await updateStoryDraft({
    id: storyId,
    expectedUpdatedAt: eventsSaved.story.updated_at,
    values: values("Synthetic ready story", "READY", [{
      id: "event-reference-1",
      type: "EVENT_REFERENCE",
      eventId: eventIds[1],
    }]),
  });

  await assert.rejects(
    replaceStoryEvents({
      storyId,
      expectedUpdatedAt: bodySaved.updated_at,
      relations: [
        { eventId: eventIds[0], relationType: "PRIMARY", sortOrder: 0 },
        { eventId: eventIds[2], relationType: "RELATED", sortOrder: 1 },
      ],
    }),
    (error: unknown) => error instanceof StoryAdminError
      && error.code === "STORY_EVENT_REFERENCE_ORPHAN",
  );
  const afterOrphanReject = await getStoryForAdmin(storyId);
  assert.equal(afterOrphanReject?.story.updated_at, bodySaved.updated_at);
  assert.equal(afterOrphanReject?.eventRelations.length, 3);

  const eventsReduced = await replaceStoryEvents({
    storyId,
    expectedUpdatedAt: bodySaved.updated_at,
    relations: [
      { eventId: eventIds[0], relationType: "PRIMARY", sortOrder: 0 },
      { eventId: eventIds[1], relationType: "RELATED", sortOrder: 1 },
    ],
  });
  assert.notEqual(eventsReduced.story.updated_at, bodySaved.updated_at);
  const afterSafeRemoval = await getStoryForAdmin(storyId);
  assert.deepEqual(
    afterSafeRemoval?.eventRelations.map(({ event_id, relation_type, sort_order }) => [
      event_id,
      relation_type,
      sort_order,
    ]),
    [[eventIds[0], "PRIMARY", 0], [eventIds[1], "RELATED", 1]],
  );

  await assert.rejects(
    replaceStoryCredits({
      storyId,
      expectedUpdatedAt: eventsReduced.story.updated_at,
      credits: [
        { personId, role: "TEXT", sortOrder: 0 },
        { personId: randomUUID(), role: "PHOTO", sortOrder: 1 },
      ],
    }),
    (error: unknown) => error instanceof StoryAdminError
      && error.code === "STORY_PERSON_NOT_FOUND",
  );
  const afterInvalidPerson = await getStoryForAdmin(storyId);
  assert.equal(afterInvalidPerson?.story.updated_at, eventsReduced.story.updated_at);
  assert.deepEqual(afterInvalidPerson?.credits.map(({ person_id }) => person_id), [personId]);

  const versionBeforeRelationRace = eventsReduced.story.updated_at;
  const creditsWon = await replaceStoryCredits({
    storyId,
    expectedUpdatedAt: versionBeforeRelationRace,
    credits: [{ personId, role: "TEXT", sortOrder: 0 }],
  });
  await assert.rejects(
    replaceStoryEvents({
      storyId,
      expectedUpdatedAt: versionBeforeRelationRace,
      relations: [
        { eventId: eventIds[0], relationType: "PRIMARY", sortOrder: 0 },
        { eventId: eventIds[1], relationType: "RELATED", sortOrder: 1 },
      ],
    }),
    (error: unknown) => error instanceof StoryAdminError
      && error.code === "STORY_VERSION_CONFLICT",
  );

  const backToDraft = await updateStoryDraft({
    id: storyId,
    expectedUpdatedAt: creditsWon.story.updated_at,
    values: values("Synthetic ready story", "DRAFT", [{
      id: "event-reference-1",
      type: "EVENT_REFERENCE",
      eventId: eventIds[1],
    }]),
  });
  assert.equal(backToDraft.status, "DRAFT");
});
