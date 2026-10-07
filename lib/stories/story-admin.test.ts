import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import StoryCreditRoles, {
  hasUnlistedStoryCredits,
  parseStoryCreditRoles,
} from "@/components/admin/stories/StoryCreditRoles";
import type { StoryContentBlock } from "./story-types";
import {
  appendStoryBlock,
  moveStoryBlock,
  parseStoryBlocksJson,
  removeStoryBlock,
  replaceStoryBlock,
  validateStoryAdminInput,
  type StoryAdminInput,
} from "./story-admin";

function validInput(overrides: Partial<StoryAdminInput> = {}): StoryAdminInput {
  return {
    status: "DRAFT",
    type: "REPORTAJE",
    collection: "DESDE_DENTRO",
    title: "Historia sintética",
    dek: "Entradilla sintética",
    contextLocation: "Circuito de pruebas",
    slug: "historia-sintetica",
    disciplineSlugs: ["rallyes"],
    territoryIds: ["madrid"],
    contentBlocks: [{
      id: "paragraph-1",
      type: "PARAGRAPH",
      content: [{ type: "TEXT", text: "Contenido sintético." }],
    }],
    heroMediaId: "",
    seoTitle: "Historia sintética",
    seoDescription: "Descripción sintética para pruebas.",
    ...overrides,
  };
}

test("an incomplete DRAFT remains editable", () => {
  const result = validateStoryAdminInput(validInput({
    title: "",
    dek: "",
    slug: "",
    seoTitle: "",
    seoDescription: "",
    contentBlocks: [],
  }));
  assert.equal(result.ok, true);
});

test("PUBLISHED and ARCHIVED mutations are rejected by the A16C editor", () => {
  assert.equal(validateStoryAdminInput(validInput({ status: "PUBLISHED" })).ok, false);
  assert.equal(validateStoryAdminInput(validInput({ status: "ARCHIVED" })).ok, false);
});

test("an invalid slug is rejected", () => {
  const result = validateStoryAdminInput(validInput({ slug: "Slug con espacios" }));
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.issues.some((item) => item.field === "slug"));
});

for (const [field, overrides] of [
  ["title", { title: "" }],
  ["dek", { dek: "" }],
  ["seoTitle", { seoTitle: "" }],
  ["seoDescription", { seoDescription: "" }],
] as const) {
  test(`READY without ${field} is rejected`, () => {
    const result = validateStoryAdminInput(validInput({ status: "READY", ...overrides }));
    assert.equal(result.ok, false);
    if (!result.ok) assert.ok(result.issues.some((item) => item.field === field));
  });
}

test("READY without a hero is explicitly allowed by the editorial gate", () => {
  const result = validateStoryAdminInput(validInput({ status: "READY", heroMediaId: "" }));
  assert.equal(result.ok, true);
});

test("invalid structured body and arbitrary HTML fail closed", () => {
  const result = validateStoryAdminInput(validInput({
    status: "READY",
    contentBlocks: [{
      id: "unsafe",
      type: "PARAGRAPH",
      html: "<script>alert(1)</script>",
      content: [{ type: "TEXT", text: "Safe text" }],
    }],
  }));
  assert.equal(result.ok, false);
});

test("all seven block types serialize through the A16A1 document contract", () => {
  const blocks: StoryContentBlock[] = [
    { id: "p", type: "PARAGRAPH", content: [{ type: "TEXT", text: "P" }] },
    { id: "h", type: "HEADING", level: 2, text: "H" },
    { id: "q", type: "PULL_QUOTE", text: "Q" },
    { id: "i", type: "IMAGE", mediaId: "media-1" },
    { id: "pair", type: "IMAGE_PAIR", mediaIds: ["media-1", "media-2"] },
    { id: "gallery", type: "GALLERY", mediaIds: ["media-1", "media-2"] },
    { id: "event", type: "EVENT_REFERENCE", eventId: "event-1" },
  ];
  const parsed = parseStoryBlocksJson(JSON.stringify(blocks));
  assert.deepEqual(parsed?.contentBlocks, blocks);
});

test("block add, remove, replace and move preserve deterministic order", () => {
  const first: StoryContentBlock = {
    id: "first",
    type: "PARAGRAPH",
    content: [{ type: "TEXT", text: "First" }],
  };
  const second: StoryContentBlock = { id: "second", type: "HEADING", level: 2, text: "Second" };
  const third: StoryContentBlock = { id: "third", type: "PULL_QUOTE", text: "Third" };
  const added = appendStoryBlock([first, second], third);
  assert.deepEqual(added.map(({ id }) => id), ["first", "second", "third"]);
  assert.deepEqual(moveStoryBlock(added, 2, -1).map(({ id }) => id), ["first", "third", "second"]);
  assert.deepEqual(removeStoryBlock(added, "second").map(({ id }) => id), ["first", "third"]);
  const replacement = { ...second, text: "Updated" };
  assert.equal((replaceStoryBlock(added, replacement)[1] as typeof second).text, "Updated");
});

const PERSON_A = "00000000-0000-4000-8000-000000000001";
const PERSON_B = "00000000-0000-4000-8000-000000000002";
type CreditRole = "TEXT" | "PHOTO" | "VIDEO" | "CONTRIBUTOR";

function creditFormData(
  people: readonly { id: string; display_name: string }[],
  credits: readonly { person_id: string; role: CreditRole }[],
) {
  const html = renderToStaticMarkup(React.createElement(
    React.Fragment,
    null,
    ...people.map((person) => React.createElement(StoryCreditRoles, {
      checkRowClassName: "check-row",
      credits,
      key: person.id,
      person,
      roleGridClassName: "role-grid",
    })),
  ));
  const formData = new FormData();
  for (const [input] of html.matchAll(/<input\b[^>]*>/g)) {
    if (!/\bchecked(?:="")?(?:\s|>)/.test(input)) continue;
    const name = input.match(/\bname="([^"]+)"/)?.[1];
    const value = input.match(/\bvalue="([^"]+)"/)?.[1];
    assert.ok(name && value, "selected credit checkbox has a name and role");
    formData.append(name, value);
  }
  return { html, formData };
}

test("real credit fields serialize TEXT and PHOTO for one person and re-read both", () => {
  const people = [{ id: PERSON_A, display_name: "Synthetic editor" }];
  const persisted = [
    { person_id: PERSON_A, role: "TEXT" as const },
    { person_id: PERSON_A, role: "PHOTO" as const },
  ];
  const { html, formData } = creditFormData(people, persisted);
  assert.match(html, /<legend>Synthetic editor<\/legend>/);
  assert.equal((html.match(/type="checkbox"/g) ?? []).length, 4);
  assert.deepEqual(parseStoryCreditRoles(formData), [
    { personId: PERSON_A, role: "TEXT", sortOrder: 0 },
    { personId: PERSON_A, role: "PHOTO", sortOrder: 1 },
  ]);
  assert.deepEqual(parseStoryCreditRoles(creditFormData(people, persisted).formData),
    parseStoryCreditRoles(formData));
});

test("removing PHOTO preserves TEXT, one-role behavior and other people", () => {
  const people = [
    { id: PERSON_A, display_name: "Synthetic editor A" },
    { id: PERSON_B, display_name: "Synthetic editor B" },
  ];
  const credits = [
    { person_id: PERSON_A, role: "TEXT" as const },
    { person_id: PERSON_A, role: "PHOTO" as const },
    { person_id: PERSON_B, role: "CONTRIBUTOR" as const },
  ];
  const { formData } = creditFormData(people, credits);
  assert.deepEqual(parseStoryCreditRoles(formData), [
    { personId: PERSON_A, role: "TEXT", sortOrder: 0 },
    { personId: PERSON_A, role: "PHOTO", sortOrder: 1 },
    { personId: PERSON_B, role: "CONTRIBUTOR", sortOrder: 2 },
  ]);
  formData.set(`creditRole:${PERSON_A}`, "TEXT");
  assert.deepEqual(parseStoryCreditRoles(formData), [
    { personId: PERSON_A, role: "TEXT", sortOrder: 0 },
    { personId: PERSON_B, role: "CONTRIBUTOR", sortOrder: 1 },
  ]);
  assert.deepEqual(parseStoryCreditRoles(creditFormData(people, [
    { person_id: PERSON_B, role: "PHOTO" },
  ]).formData), [{ personId: PERSON_B, role: "PHOTO", sortOrder: 0 }]);
});

test("an existing credit for an unlisted or inactive person blocks replacement", () => {
  const people = [{ id: PERSON_A, display_name: "Synthetic editor A" }];
  assert.equal(hasUnlistedStoryCredits(people, [
    { person_id: PERSON_A, role: "TEXT" },
    { person_id: PERSON_B, role: "PHOTO" },
  ]), true);
  assert.equal(hasUnlistedStoryCredits(people, [
    { person_id: PERSON_A, role: "TEXT" },
  ]), false);
});
