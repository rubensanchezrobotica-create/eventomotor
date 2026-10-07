import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test, { mock } from "node:test";
import ReactServer from "react";
import StoryCreditRoles from "@/components/admin/stories/StoryCreditRoles";
import { ADMIN_SESSION_COOKIE, createAdminSessionToken } from "@/lib/admin-session";

type MockModule = (
  specifier: string,
  options: { exports: Record<string, unknown> },
) => Promise<unknown>;

type StoryActionsModule = {
  createStoryAction?: (formData: FormData) => Promise<void>;
  replaceStoryCreditsAction?: (formData: FormData) => Promise<void>;
  default?: {
    createStoryAction?: (formData: FormData) => Promise<void>;
    replaceStoryCreditsAction?: (formData: FormData) => Promise<void>;
  };
};

test("a real Story Server Action rejects no session and saves two roles from rendered form controls", async () => {
  // Next's direct Node test runtime resolves the react-server entry, while
  // next/navigation still initializes a client context during module loading.
  // Supplying that framework primitive does not replace the real auth guard.
  const require = createRequire(import.meta.url);
  const clientReact = require("../../node_modules/react/cjs/react.development.js") as {
    createContext: unknown;
    __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: unknown;
  };
  const reactRuntime = ReactServer as unknown as Record<string, unknown>;
  if (typeof reactRuntime.createContext !== "function") {
    reactRuntime.createContext = clientReact.createContext;
  }
  reactRuntime.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE =
    clientReact.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  const { renderToStaticMarkup } = require("../../node_modules/react-dom/server.node.js") as {
    renderToStaticMarkup: (element: ReactServer.ReactElement) => string;
  };

  let cookieReadCount = 0;
  let originHeaderReadCount = 0;
  let downstreamDbCallCount = 0;
  let sessionToken: string | undefined;
  let trustedOrigin = false;
  const replaceCalls: unknown[] = [];
  const revalidatedPaths: string[] = [];
  const mockModule = (mock as unknown as { module: MockModule }).module.bind(mock);

  await mockModule("next/headers", {
    exports: {
      async cookies() {
        cookieReadCount += 1;
        return {
          get: (name: string) => name === ADMIN_SESSION_COOKIE && sessionToken
            ? { value: sessionToken }
            : undefined,
        };
      },
      async headers() {
        originHeaderReadCount += 1;
        return {
          get: (name: string) => {
            if (!trustedOrigin) return null;
            if (name === "origin") return "https://editor.example.test";
            if (name === "x-forwarded-host") return "editor.example.test";
            return null;
          },
        };
      },
    },
  });
  await mockModule("next/cache", {
    exports: {
      revalidatePath(path: string) {
        revalidatedPaths.push(path);
      },
    },
  });

  class TestStoryAdminError extends Error {
    constructor(public readonly code: string, message: string) {
      super(message);
    }
  }
  const unexpectedDownstreamCall = async () => {
    downstreamDbCallCount += 1;
    throw new Error("DOWNSTREAM_DB_CALLED");
  };
  await mockModule("@/lib/stories/story-admin.server", {
    exports: {
      StoryAdminError: TestStoryAdminError,
      createEditorialPerson: unexpectedDownstreamCall,
      createStoryDraft: unexpectedDownstreamCall,
      async replaceStoryCredits(input: unknown) {
        downstreamDbCallCount += 1;
        replaceCalls.push(input);
      },
      replaceStoryEvents: unexpectedDownstreamCall,
      updateStoryDraft: unexpectedDownstreamCall,
    },
  });

  assert.equal(Object.hasOwn(process.env, "ADMIN_SECRET"), false, "test requires no existing admin secret");
  const syntheticSecret = "synthetic-server-boundary-secret";
  process.env.ADMIN_SECRET = syntheticSecret;
  try {
    const imported = await import("../../app/admin/historias/actions") as StoryActionsModule;
    const createStoryAction = imported.createStoryAction ?? imported.default?.createStoryAction;
    assert.equal(typeof createStoryAction, "function");

    await assert.rejects(
      createStoryAction!(new FormData()),
      (error: unknown) => {
        const digest = error && typeof error === "object" && "digest" in error
          ? String(error.digest)
          : "";
        return digest === "NEXT_REDIRECT;replace;/admin/login?next=%2Fadmin%2Fhistorias%2Fnueva;307;";
      },
    );
    assert.equal(cookieReadCount, 1);
    assert.equal(originHeaderReadCount, 0);
    assert.equal(downstreamDbCallCount, 0);

    const replaceStoryCreditsAction = imported.replaceStoryCreditsAction
      ?? imported.default?.replaceStoryCreditsAction;
    assert.equal(typeof replaceStoryCreditsAction, "function");
    const creditForm = new FormData();
    creditForm.set("storyId", "00000000-0000-4000-8000-000000000001");
    creditForm.set("expectedUpdatedAt", "2026-10-07T10:00:00.000Z");
    creditForm.append("creditRole:00000000-0000-4000-8000-000000000002", "TEXT");
    creditForm.append("creditRole:00000000-0000-4000-8000-000000000002", "PHOTO");
    await assert.rejects(
      replaceStoryCreditsAction!(creditForm),
      (error: unknown) => {
        const digest = error && typeof error === "object" && "digest" in error
          ? String(error.digest)
          : "";
        return digest === "NEXT_REDIRECT;replace;/admin/login?next=%2Fadmin%2Fhistorias%2F00000000-0000-4000-8000-000000000001;307;";
      },
    );
    assert.equal(cookieReadCount, 2);
    assert.equal(originHeaderReadCount, 0);
    assert.equal(downstreamDbCallCount, 0);

    const storyId = "00000000-0000-4000-8000-000000000001";
    const personId = "00000000-0000-4000-8000-000000000002";
    const expectedUpdatedAt = "2026-10-07T10:00:00.000Z";
    const html = renderToStaticMarkup(
      ReactServer.createElement(
        "form",
        null,
        ReactServer.createElement("input", { name: "storyId", type: "hidden", value: storyId }),
        ReactServer.createElement("input", {
          name: "expectedUpdatedAt",
          type: "hidden",
          value: expectedUpdatedAt,
        }),
        ReactServer.createElement(StoryCreditRoles, {
          checkRowClassName: "check-row",
          credits: [
            { person_id: personId, role: "TEXT" },
            { person_id: personId, role: "PHOTO" },
          ],
          person: { id: personId, display_name: "Synthetic editor" },
          roleGridClassName: "role-grid",
        }),
      ),
    );
    const renderedFormData = new FormData();
    for (const [input] of html.matchAll(/<input\b[^>]*>/g)) {
      const name = input.match(/\bname="([^"]+)"/)?.[1];
      const value = input.match(/\bvalue="([^"]+)"/)?.[1];
      assert.ok(name && value, "rendered input has a name and value");
      if (input.includes('type="checkbox"') && !/\bchecked(?:="")?(?:\s|>)/.test(input)) {
        continue;
      }
      renderedFormData.append(name, value);
    }
    assert.equal((html.match(/type="checkbox"/g) ?? []).length, 4);
    assert.deepEqual(renderedFormData.getAll(`creditRole:${personId}`), ["TEXT", "PHOTO"]);

    sessionToken = createAdminSessionToken(syntheticSecret);
    trustedOrigin = true;
    await assert.rejects(
      replaceStoryCreditsAction!(renderedFormData),
      (error: unknown) => {
        const digest = error && typeof error === "object" && "digest" in error
          ? String(error.digest)
          : "";
        return digest === `NEXT_REDIRECT;replace;/admin/historias/${storyId}?saved=credits#credits;307;`;
      },
    );
    assert.equal(cookieReadCount, 3);
    assert.equal(originHeaderReadCount, 1);
    assert.equal(downstreamDbCallCount, 1);
    assert.equal(replaceCalls.length, 1);
    assert.deepEqual(replaceCalls[0], {
      storyId,
      expectedUpdatedAt,
      credits: [
        { personId, role: "TEXT", sortOrder: 0 },
        { personId, role: "PHOTO", sortOrder: 1 },
      ],
    });
    assert.deepEqual(revalidatedPaths, [`/admin/historias/${storyId}`]);
  } finally {
    delete process.env.ADMIN_SECRET;
  }
});
