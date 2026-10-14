import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test, { mock } from "node:test";
import React from "react";
import { createAdminSessionToken, ADMIN_SESSION_COOKIE } from "@/lib/admin-session";

test("real launch actions enforce session/origin, explicit confirmations, exact version/request and cache invalidation", async () => {
  const require = createRequire(import.meta.url);
  const clientReact = require("../../node_modules/react/cjs/react.development.js");
  const react = React as unknown as Record<string, unknown>;
  react.createContext = clientReact.createContext;
  react.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = clientReact.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  const moduleMock = (mock as unknown as { module: (path: string, options: { exports: Record<string, unknown> }) => Promise<unknown> }).module.bind(mock);
  let token: string | undefined, trusted = true, failPublication = false;
  const writes: Array<{ operation: string; input: unknown }> = [], invalidations: string[] = [];
  await moduleMock("next/headers", { exports: {
    cookies: async () => ({ get: (name: string) => name === ADMIN_SESSION_COOKIE && token ? { value: token } : undefined }),
    headers: async () => ({ get: (name: string) => name === "origin" ? (trusted ? "https://admin.example.test" : "https://untrusted.example.test") : name === "x-forwarded-host" ? "admin.example.test" : null }),
  } });
  await moduleMock("next/cache", { exports: { revalidatePath: (path: string) => invalidations.push(path) } });
  await moduleMock("@/lib/stories/story-launch.server", { exports: { prepareStoryForPublication: async (input: unknown) => { writes.push({ operation: "prepare", input }); } } });
  await moduleMock("@/lib/stories/story-publication.server", { exports: { publishStory: async (input: unknown) => {
    if (failPublication) throw new Error("synthetic gate/version failure");
    writes.push({ operation: "publish", input }); return { slug: "synthetic-story" };
  } } });
  await moduleMock("@/lib/stories/story-admin.server", { exports: { getStoryForAdmin: async () => ({ relatedEvents: [{ slug: "synthetic-event" }] }) } });
  assert.equal(process.env.ADMIN_SECRET, undefined);
  const secret = "synthetic-publication-session-only";
  process.env.ADMIN_SECRET = secret;
  try {
    const actions = await import("../../app/admin/historias/publication-actions");
    const id = "c1000000-0000-4000-8000-000000000001", version = "2030-01-01T12:00:00Z", requestId = "c2000000-0000-4000-8000-000000000001";
    const path = `/admin/historias/${id}/publicacion`;
    const form = new FormData(); form.set("storyId", id); form.set("expectedUpdatedAt", version); form.set("requestId", requestId);
    const redirectTo = (destination: string) => (error: unknown) => !!error && typeof error === "object" && "digest" in error
      && String(error.digest).includes(destination);
    for (const action of [actions.prepareStoryPublicationAction, actions.publishStoryAction]) {
      await assert.rejects(action(form), redirectTo("/admin/login"));
    }
    assert.deepEqual(writes, []);
    token = createAdminSessionToken(secret); trusted = false;
    await assert.rejects(actions.publishStoryAction(form)); assert.deepEqual(writes, []);
    trusted = true;
    await assert.rejects(actions.prepareStoryPublicationAction(form), redirectTo("confirmation_required"));
    await assert.rejects(actions.publishStoryAction(form), redirectTo("confirmation_required"));
    assert.deepEqual(writes, []);
    form.set("confirmPublicDerivatives", "yes");
    await assert.rejects(actions.prepareStoryPublicationAction(form), redirectTo(`${path}?prepared=1`));
    assert.deepEqual(writes, [{ operation: "prepare", input: { storyId: id, expectedUpdatedAt: version } }]);
    form.set("confirmPublication", "yes");
    const invalidationsBefore = invalidations.length;
    failPublication = true;
    await assert.rejects(actions.publishStoryAction(form), redirectTo(`${path}?error=publication_failed`));
    assert.equal(writes.length, 1); assert.equal(invalidations.length, invalidationsBefore);
    failPublication = false;
    await assert.rejects(actions.publishStoryAction(form), redirectTo(`${path}?published=1`));
    assert.deepEqual(writes[1], { operation: "publish", input: { storyId: id, expectedUpdatedAt: version, requestId } });
    for (const required of ["/historias", "/historias/synthetic-story", "/sitemap.xml", "/evento/synthetic-event"]) assert.ok(invalidations.includes(required));
  } finally { delete process.env.ADMIN_SECRET; }
});
