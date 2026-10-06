import assert from "node:assert/strict";
import test from "node:test";
import type {
  EditorialPersonRow,
  StoryCreditInsert,
  StoryEventInsert,
  StoryMediaRow,
  StoryRow,
} from "@/lib/supabase";
import {
  requireAdminSession,
  requireTrustedAdminMutation,
  type AdminMutationRuntime,
  type AdminSessionRuntime,
} from "@/lib/admin-session.server";
import {
  StoryAdminError,
  classifyStoryAdminDatabaseError,
  createStoryAdminMutationService,
  createStoryAdminRelationService,
  type StoryAdminMutationRepository,
  type StoryAdminRelationRepository,
} from "./story-admin.server";
import type { StoryAdminInput } from "./story-admin";

const UPDATED_AT = "2026-10-05T10:00:00.000Z";
const UPDATED_AT_2 = "2026-10-05T10:01:00.000Z";
const PERSON_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PERSON_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PERSON_X = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const EVENT_A = "event-a";
const EVENT_B = "event-b";
const EVENT_C = "event-c";

function row(overrides: Partial<StoryRow> = {}): StoryRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    slug: "synthetic-story",
    status: "DRAFT",
    type: "REPORTAJE",
    collection: "DESDE_DENTRO",
    title: "Synthetic story",
    dek: "Synthetic dek",
    context_location: null,
    content_blocks: [],
    schema_version: 1,
    hero_media_id: null,
    seo_title: "Synthetic story",
    seo_description: "Synthetic description",
    discipline_slugs: [],
    territory_ids: [],
    published_at: null,
    home_rank: null,
    created_at: UPDATED_AT,
    updated_at: UPDATED_AT,
    ...overrides,
  };
}

function values(overrides: Partial<StoryAdminInput> = {}): StoryAdminInput {
  return {
    status: "DRAFT",
    type: "REPORTAJE",
    collection: "DESDE_DENTRO",
    title: "Synthetic story",
    dek: "Synthetic dek",
    contextLocation: "",
    slug: "synthetic-story",
    disciplineSlugs: [],
    territoryIds: [],
    contentBlocks: [],
    heroMediaId: "",
    seoTitle: "Synthetic story",
    seoDescription: "Synthetic description",
    ...overrides,
  };
}

function repository(overrides: Partial<StoryAdminMutationRepository> = {}) {
  const current = row();
  const base: StoryAdminMutationRepository = {
    async createDraft(input) {
      return row({ ...input, slug: "", dek: "", seo_title: "", seo_description: "" });
    },
    async getStory() {
      return current;
    },
    async findSlugOwner() {
      return null;
    },
    async getMediaByIds() {
      return [];
    },
    async getRelatedEventIds(_storyId, eventIds) {
      return [...eventIds];
    },
    async updateExpected(input) {
      return row({ ...input.update, updated_at: "2026-10-05T10:01:00.000Z" });
    },
  };
  return { ...base, ...overrides };
}

async function expectCode(promise: Promise<unknown>, code: StoryAdminError["code"]) {
  await assert.rejects(promise, (error: unknown) => (
    error instanceof StoryAdminError && error.code === code
  ));
}

function person(id: string, active = true): EditorialPersonRow {
  return {
    id,
    display_name: `Person ${id.slice(0, 4)}`,
    active,
    created_at: UPDATED_AT,
    updated_at: UPDATED_AT,
  };
}

function relationHarness({
  story = row(),
  people = [person(PERSON_A), person(PERSON_B)],
  credits = [] as StoryCreditInsert[],
  relations = [] as StoryEventInsert[],
} = {}) {
  let currentStory = story;
  let currentCredits = [...credits];
  let currentRelations = [...relations];
  let claimCount = 0;
  let creditReplaceCount = 0;
  let eventReplaceCount = 0;
  const repository: StoryAdminRelationRepository = {
    async getStory() {
      return currentStory;
    },
    async getPeopleByIds(personIds) {
      return people.filter(({ id }) => personIds.includes(id));
    },
    async getEventsByIds(eventIds) {
      return eventIds.map((id) => ({
        id,
        slug: id,
        title: id,
        start_date: "2030-01-01",
        venue: null,
        city: null,
        province: null,
      }));
    },
    async claimEditableStoryVersion(input) {
      claimCount += 1;
      if (currentStory.updated_at !== input.expectedUpdatedAt) return null;
      currentStory = row({ ...currentStory, updated_at: UPDATED_AT_2 });
      return currentStory;
    },
    async replaceCredits(_storyId, nextCredits) {
      creditReplaceCount += 1;
      currentCredits = [...nextCredits];
    },
    async replaceEvents(_storyId, nextRelations) {
      eventReplaceCount += 1;
      currentRelations = [...nextRelations];
    },
  };
  return {
    repository,
    state: () => ({
      story: currentStory,
      credits: currentCredits,
      relations: currentRelations,
      claimCount,
      creditReplaceCount,
      eventReplaceCount,
    }),
  };
}

test("create DRAFT accepts the minimal type, collection and title", async () => {
  const created = await createStoryAdminMutationService(repository()).createDraft({
    type: "CRONICA",
    collection: "HISTORIAS_DE_MOTOR",
    title: "Synthetic draft",
  });
  assert.equal(created.status, "DRAFT");
  assert.equal(created.title, "Synthetic draft");
});

test("matching expectedUpdatedAt saves with an optimistic predicate", async () => {
  let observedExpected = "";
  const service = createStoryAdminMutationService(repository({
    async updateExpected(input) {
      observedExpected = input.expectedUpdatedAt;
      return row({ ...input.update, updated_at: "2026-10-05T10:01:00.000Z" });
    },
  }));
  const updated = await service.updateDraft({
    id: row().id,
    expectedUpdatedAt: UPDATED_AT,
    values: values({ title: "Updated" }),
  });
  assert.equal(observedExpected, UPDATED_AT);
  assert.equal(updated.title, "Updated");
});

test("stale expectedUpdatedAt rejects before writing", async () => {
  let writes = 0;
  const service = createStoryAdminMutationService(repository({
    async updateExpected() {
      writes += 1;
      return row();
    },
  }));
  await expectCode(service.updateDraft({
    id: row().id,
    expectedUpdatedAt: "2026-10-05T09:59:00.000Z",
    values: values(),
  }), "STORY_VERSION_CONFLICT");
  assert.equal(writes, 0);
});

test("a lost conditional update rejects rather than overwriting", async () => {
  const service = createStoryAdminMutationService(repository({
    async updateExpected() {
      return null;
    },
  }));
  await expectCode(service.updateDraft({
    id: row().id,
    expectedUpdatedAt: UPDATED_AT,
    values: values(),
  }), "STORY_VERSION_CONFLICT");
});

test("duplicate slug is rejected server-side", async () => {
  const service = createStoryAdminMutationService(repository({
    async findSlugOwner() {
      return "22222222-2222-4222-8222-222222222222";
    },
  }));
  await expectCode(service.updateDraft({
    id: row().id,
    expectedUpdatedAt: UPDATED_AT,
    values: values(),
  }), "STORY_SLUG_CONFLICT");
});

test("hero selection cannot cross Story ownership", async () => {
  const media: StoryMediaRow = {
    id: "33333333-3333-4333-8333-333333333333",
    story_id: "22222222-2222-4222-8222-222222222222",
    bucket_id: "story-media-drafts",
    object_path: "x/y/asset.jpg",
    width: 1200,
    height: 800,
    mime_type: "image/jpeg",
    byte_size: 10,
    alt_text: "",
    caption: null,
    credit: null,
    rights_type: "UNKNOWN",
    rights_notes: null,
    created_at: UPDATED_AT,
    updated_at: UPDATED_AT,
  };
  const service = createStoryAdminMutationService(repository({
    async getMediaByIds() {
      return [media];
    },
  }));
  await expectCode(service.updateDraft({
    id: row().id,
    expectedUpdatedAt: UPDATED_AT,
    values: values({ heroMediaId: media.id }),
  }), "STORY_MEDIA_OWNERSHIP");
});

test("body media cannot cross Story ownership", async () => {
  const foreignMediaId = "33333333-3333-4333-8333-333333333333";
  const service = createStoryAdminMutationService(repository({
    async getMediaByIds() {
      return [];
    },
  }));
  await expectCode(service.updateDraft({
    id: row().id,
    expectedUpdatedAt: UPDATED_AT,
    values: values({
      contentBlocks: [{ id: "image-1", type: "IMAGE", mediaId: foreignMediaId }],
    }),
  }), "STORY_MEDIA_OWNERSHIP");
});

test("event reference blocks require an existing Story relation", async () => {
  const eventId = "synthetic-event";
  const service = createStoryAdminMutationService(repository({
    async getRelatedEventIds() {
      return [];
    },
  }));
  await expectCode(service.updateDraft({
    id: row().id,
    expectedUpdatedAt: UPDATED_AT,
    values: values({
      contentBlocks: [{ id: "event-1", type: "EVENT_REFERENCE", eventId }],
    }),
  }), "STORY_RELATION_INVALID");
});

test("published and archived stories remain read-only", async () => {
  for (const status of ["PUBLISHED", "ARCHIVED"] as const) {
    const service = createStoryAdminMutationService(repository({
      async getStory() {
        return row({ status, published_at: UPDATED_AT });
      },
    }));
    await expectCode(service.updateDraft({
      id: row().id,
      expectedUpdatedAt: UPDATED_AT,
      values: values(),
    }), "STORY_NOT_EDITABLE");
  }
});

test("invalid credit person fails before claiming or replacing existing credits", async () => {
  const existing = [
    { story_id: row().id, person_id: PERSON_A, role: "TEXT" as const, sort_order: 0 },
    { story_id: row().id, person_id: PERSON_B, role: "PHOTO" as const, sort_order: 1 },
  ];
  const harness = relationHarness({ people: [person(PERSON_A)], credits: existing });
  const service = createStoryAdminRelationService(harness.repository);
  await expectCode(service.replaceCredits({
    storyId: row().id,
    expectedUpdatedAt: UPDATED_AT,
    credits: [
      { personId: PERSON_A, role: "TEXT", sortOrder: 0 },
      { personId: PERSON_X, role: "PHOTO", sortOrder: 1 },
    ],
  }), "STORY_PERSON_NOT_FOUND");
  assert.deepEqual(harness.state().credits, existing);
  assert.equal(harness.state().claimCount, 0);
  assert.equal(harness.state().creditReplaceCount, 0);
});

test("duplicate credits reject before repository access", async () => {
  let reads = 0;
  const harness = relationHarness();
  const service = createStoryAdminRelationService({
    ...harness.repository,
    async getPeopleByIds(ids) {
      reads += 1;
      return harness.repository.getPeopleByIds(ids);
    },
  });
  await expectCode(service.replaceCredits({
    storyId: row().id,
    expectedUpdatedAt: UPDATED_AT,
    credits: [
      { personId: PERSON_A, role: "TEXT", sortOrder: 0 },
      { personId: PERSON_A, role: "TEXT", sortOrder: 1 },
    ],
  }), "STORY_RELATION_INVALID");
  assert.equal(reads, 0);
  assert.equal(harness.state().claimCount, 0);
});

test("event relation removal cannot orphan a body EVENT_REFERENCE", async () => {
  const existing = [
    { story_id: row().id, event_id: EVENT_A, relation_type: "PRIMARY" as const, sort_order: 0 },
    { story_id: row().id, event_id: EVENT_B, relation_type: "RELATED" as const, sort_order: 1 },
  ];
  const harness = relationHarness({
    story: row({
      content_blocks: [{ id: "event-a", type: "EVENT_REFERENCE", eventId: EVENT_A }],
    }),
    relations: existing,
  });
  const service = createStoryAdminRelationService(harness.repository);
  await expectCode(service.replaceEvents({
    storyId: row().id,
    expectedUpdatedAt: UPDATED_AT,
    relations: [{ eventId: EVENT_B, relationType: "RELATED", sortOrder: 0 }],
  }), "STORY_EVENT_REFERENCE_ORPHAN");
  assert.deepEqual(harness.state().relations, existing);
  assert.equal(harness.state().claimCount, 0);
  assert.equal(harness.state().eventReplaceCount, 0);
});

test("unreferenced RELATED event can be removed while the referenced PRIMARY remains", async () => {
  const harness = relationHarness({
    story: row({
      content_blocks: [{ id: "event-a", type: "EVENT_REFERENCE", eventId: EVENT_A }],
    }),
    relations: [
      { story_id: row().id, event_id: EVENT_A, relation_type: "PRIMARY", sort_order: 0 },
      { story_id: row().id, event_id: EVENT_B, relation_type: "RELATED", sort_order: 1 },
    ],
  });
  const result = await createStoryAdminRelationService(harness.repository).replaceEvents({
    storyId: row().id,
    expectedUpdatedAt: UPDATED_AT,
    relations: [{ eventId: EVENT_A, relationType: "PRIMARY", sortOrder: 0 }],
  });
  assert.equal(result.story.updated_at, UPDATED_AT_2);
  assert.deepEqual(harness.state().relations.map(({ event_id }) => event_id), [EVENT_A]);
});

test("one PRIMARY plus multiple RELATED events preserve the proposed order", async () => {
  const harness = relationHarness();
  await createStoryAdminRelationService(harness.repository).replaceEvents({
    storyId: row().id,
    expectedUpdatedAt: UPDATED_AT,
    relations: [
      { eventId: EVENT_A, relationType: "PRIMARY", sortOrder: 0 },
      { eventId: EVENT_B, relationType: "RELATED", sortOrder: 1 },
      { eventId: EVENT_C, relationType: "RELATED", sortOrder: 2 },
    ],
  });
  assert.deepEqual(
    harness.state().relations.map(({ event_id, relation_type, sort_order }) => (
      [event_id, relation_type, sort_order]
    )),
    [
      [EVENT_A, "PRIMARY", 0],
      [EVENT_B, "RELATED", 1],
      [EVENT_C, "RELATED", 2],
    ],
  );
});

test("stale credit save rejects without replacing credits", async () => {
  const existing = [
    { story_id: row().id, person_id: PERSON_A, role: "TEXT" as const, sort_order: 0 },
  ];
  const harness = relationHarness({ story: row({ updated_at: UPDATED_AT_2 }), credits: existing });
  await expectCode(createStoryAdminRelationService(harness.repository).replaceCredits({
    storyId: row().id,
    expectedUpdatedAt: UPDATED_AT,
    credits: [{ personId: PERSON_B, role: "PHOTO", sortOrder: 0 }],
  }), "STORY_VERSION_CONFLICT");
  assert.deepEqual(harness.state().credits, existing);
  assert.equal(harness.state().claimCount, 0);
});

test("stale event save rejects without replacing relations", async () => {
  const existing = [
    { story_id: row().id, event_id: EVENT_A, relation_type: "PRIMARY" as const, sort_order: 0 },
  ];
  const harness = relationHarness({ story: row({ updated_at: UPDATED_AT_2 }), relations: existing });
  await expectCode(createStoryAdminRelationService(harness.repository).replaceEvents({
    storyId: row().id,
    expectedUpdatedAt: UPDATED_AT,
    relations: [{ eventId: EVENT_B, relationType: "RELATED", sortOrder: 0 }],
  }), "STORY_VERSION_CONFLICT");
  assert.deepEqual(harness.state().relations, existing);
  assert.equal(harness.state().claimCount, 0);
});

test("credit save advances the Story version and makes a stale event tab fail closed", async () => {
  const harness = relationHarness();
  const service = createStoryAdminRelationService(harness.repository);
  const credits = await service.replaceCredits({
    storyId: row().id,
    expectedUpdatedAt: UPDATED_AT,
    credits: [{ personId: PERSON_A, role: "TEXT", sortOrder: 0 }],
  });
  assert.equal(credits.story.updated_at, UPDATED_AT_2);
  await expectCode(service.replaceEvents({
    storyId: row().id,
    expectedUpdatedAt: UPDATED_AT,
    relations: [{ eventId: EVENT_A, relationType: "PRIMARY", sortOrder: 0 }],
  }), "STORY_VERSION_CONFLICT");
  assert.equal(harness.state().eventReplaceCount, 0);
});

test("event save advances the Story version and makes a stale credit tab fail closed", async () => {
  const harness = relationHarness();
  const service = createStoryAdminRelationService(harness.repository);
  const events = await service.replaceEvents({
    storyId: row().id,
    expectedUpdatedAt: UPDATED_AT,
    relations: [{ eventId: EVENT_A, relationType: "PRIMARY", sortOrder: 0 }],
  });
  assert.equal(events.story.updated_at, UPDATED_AT_2);
  await expectCode(service.replaceCredits({
    storyId: row().id,
    expectedUpdatedAt: UPDATED_AT,
    credits: [{ personId: PERSON_A, role: "TEXT", sortOrder: 0 }],
  }), "STORY_VERSION_CONFLICT");
  assert.equal(harness.state().creditReplaceCount, 0);
});

test("relation saves validate expectedUpdatedAt on the server before repository access", async () => {
  const harness = relationHarness();
  const service = createStoryAdminRelationService(harness.repository);
  await expectCode(service.replaceCredits({
    storyId: row().id,
    expectedUpdatedAt: "not-a-timestamp",
    credits: [],
  }), "STORY_INPUT_INVALID");
  await expectCode(service.replaceEvents({
    storyId: row().id,
    expectedUpdatedAt: "",
    relations: [],
  }), "STORY_INPUT_INVALID");
  assert.equal(harness.state().claimCount, 0);
});

test("relation inputs validate person IDs, event IDs and relation types server-side", async () => {
  const harness = relationHarness();
  const service = createStoryAdminRelationService(harness.repository);
  await expectCode(service.replaceCredits({
    storyId: row().id,
    expectedUpdatedAt: UPDATED_AT,
    credits: [{ personId: "not-a-uuid", role: "TEXT", sortOrder: 0 }],
  }), "STORY_RELATION_INVALID");
  await expectCode(service.replaceEvents({
    storyId: row().id,
    expectedUpdatedAt: UPDATED_AT,
    relations: [{ eventId: "", relationType: "PRIMARY", sortOrder: 0 }],
  }), "STORY_RELATION_INVALID");
  await expectCode(service.replaceEvents({
    storyId: row().id,
    expectedUpdatedAt: UPDATED_AT,
    relations: [{ eventId: EVENT_A, relationType: "OWNER", sortOrder: 0 }],
  }), "STORY_RELATION_INVALID");
  assert.equal(harness.state().claimCount, 0);
});

test("database errors distinguish slug, constraints and unknown failures", () => {
  assert.equal(
    classifyStoryAdminDatabaseError({ code: "23505" }, "story-slug"),
    "STORY_SLUG_CONFLICT",
  );
  assert.equal(
    classifyStoryAdminDatabaseError({ code: "23505" }),
    "DATABASE_CONSTRAINT_CONFLICT",
  );
  assert.equal(
    classifyStoryAdminDatabaseError({ code: "23503" }),
    "DATABASE_CONSTRAINT_CONFLICT",
  );
  assert.equal(
    classifyStoryAdminDatabaseError({ code: "XX000" }),
    "DATABASE_OPERATION_FAILED",
  );
});

test("real requireAdminSession redirects missing and invalid cookies", async () => {
  const previousSecret = process.env.ADMIN_SECRET;
  process.env.ADMIN_SECRET = "synthetic-server-boundary-secret";
  try {
    for (const token of [undefined, "invalid-cookie"]) {
      let location = "";
      const runtime: AdminSessionRuntime = {
        async readSessionToken() {
          return token;
        },
        async redirectToLogin(nextLocation): Promise<never> {
          location = nextLocation;
          throw new Error("TEST_REDIRECT");
        },
      };
      await assert.rejects(
        requireAdminSession("/admin/historias", runtime),
        /TEST_REDIRECT/,
      );
      assert.equal(location, "/admin/login?next=%2Fadmin%2Fhistorias");
    }
  } finally {
    if (previousSecret === undefined) delete process.env.ADMIN_SECRET;
    else process.env.ADMIN_SECRET = previousSecret;
  }
});

test("protected mutation boundary rejects missing session before origin or data access", async () => {
  let originReads = 0;
  const runtime: AdminMutationRuntime = {
    async readSessionToken() {
      return undefined;
    },
    async redirectToLogin(): Promise<never> {
      throw new Error("TEST_REDIRECT");
    },
    async readMutationOrigin() {
      originReads += 1;
      return { origin: "https://eventomotor.com", host: "eventomotor.com" };
    },
  };
  await assert.rejects(
    requireTrustedAdminMutation("/admin/historias", runtime),
    /TEST_REDIRECT/,
  );
  assert.equal(originReads, 0);
});
