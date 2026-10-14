import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createAdminSessionToken, ADMIN_SESSION_TTL_SECONDS } from "@/lib/admin-session";
import { requireAdminSession } from "@/lib/admin-session.server";
import { createStoryAdminReadService } from "./story-admin-read.server";
import type { StoryAdminBundle } from "./story-admin.server";

test("shared read boundary rejects missing, invalid and correctly signed expired synthetic sessions BEFORE reads or signing", async () => {
  const previous = process.env.ADMIN_SECRET;
  const secret = "synthetic-read-security-fixture";
  process.env.ADMIN_SECRET = secret;
  try {
    for (const token of [undefined, "invalid", createAdminSessionToken(secret, Date.now() - (ADMIN_SESSION_TTL_SECONDS + 60) * 1000)]) {
      let reads = 0, signs = 0;
      const boundary = createStoryAdminReadService({
        authorize: (path) => requireAdminSession(path, {
          readSessionToken: async () => token,
          redirectToLogin: async () => { throw new Error("AUTH_REQUIRED"); },
        }),
        getBundle: async () => { reads++; return null; },
        list: async () => { reads++; return []; },
        search: async () => { reads++; return []; },
        resolveMedia: async () => { signs++; return []; },
      });
      for (const read of [() => boundary.bundle("known-id"), () => boundary.preview("known-id"), () => boundary.list("DRAFT"), () => boundary.search("known title")]) {
        await assert.rejects(read(), /AUTH_REQUIRED/);
      }
      assert.equal(reads, 0); assert.equal(signs, 0);
    }
  } finally { if (previous === undefined) delete process.env.ADMIN_SECRET; else process.env.ADMIN_SECRET = previous; }
});

test("authenticated Preview awaits authorization, then reads and signs without changing the bundle", async () => {
  const events: string[] = [], bundle = { media: [] } as unknown as StoryAdminBundle;
  const boundary = createStoryAdminReadService({
    authorize: async () => { await Promise.resolve(); events.push("authenticated"); },
    getBundle: async () => { events.push("read"); return bundle; },
    list: async () => [], search: async () => [],
    resolveMedia: async () => { events.push("sign"); return []; },
  });
  const result = await boundary.preview("known-id");
  assert.deepEqual(events, ["authenticated", "read", "sign"]);
  assert.equal(result?.bundle, bundle);
});

test("every Stories render entry uses the guarded DAL; private metadata/cache remain noindex/no-store", () => {
  const source = (path: string) => readFileSync(path, "utf8");
  const paths = ["app/admin/historias/page.tsx", "app/admin/historias/[id]/page.tsx", "app/admin/historias/[id]/preview/page.tsx", "app/admin/historias/[id]/publicacion/page.tsx"];
  for (const path of paths) {
    const text = source(path);
    assert.ok(text.includes("story-admin-read.server"), `${path}: guarded loader required`);
    assert.ok(!/\b(getStoryForAdmin|listStoriesForAdmin|resolveStoryMediaForAdmin|searchEventsForStoryAdmin)\(/.test(text), `${path}: no unguarded data call`);
    assert.ok(!/generateMetadata/.test(text), `${path}: no dynamic private metadata outside boundary`);
  }
  assert.ok(source("app/admin/historias/nueva/page.tsx").includes('await requireAdminSession("/admin/historias/nueva")'));
  assert.ok(source("app/admin/historias/layout.tsx").includes("index: false, follow: false, nocache: true"));
  assert.ok(source("app/admin/historias/layout.tsx").includes('dynamic = "force-dynamic"'));
  assert.ok(source("app/admin/historias/[id]/preview/page.tsx").includes("revalidate = 0"));
  const dal = source("lib/stories/story-admin-read.server.ts");
  assert.ok(dal.includes('import "server-only"'));
  assert.ok(!/unstable_cache|use cache|cache\(/.test(dal));
});
