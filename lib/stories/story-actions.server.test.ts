import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test, { mock } from "node:test";
import ReactServer from "react";

type MockModule = (
  specifier: string,
  options: { exports: Record<string, unknown> },
) => Promise<unknown>;

type StoryActionsModule = {
  createStoryAction?: (formData: FormData) => Promise<void>;
  default?: {
    createStoryAction?: (formData: FormData) => Promise<void>;
  };
};

test("a real exported Story Server Action rejects a missing session before downstream data access", async () => {
  // Next's direct Node test runtime resolves the react-server entry, while
  // next/navigation still initializes a client context during module loading.
  // Supplying that framework primitive does not replace the real auth guard.
  const require = createRequire(import.meta.url);
  const clientReact = require("../../node_modules/react/cjs/react.development.js") as {
    createContext: unknown;
  };
  const reactRuntime = ReactServer as unknown as Record<string, unknown>;
  if (typeof reactRuntime.createContext !== "function") {
    reactRuntime.createContext = clientReact.createContext;
  }

  let cookieReadCount = 0;
  let originHeaderReadCount = 0;
  let downstreamDbCallCount = 0;
  const mockModule = (mock as unknown as { module: MockModule }).module.bind(mock);

  await mockModule("next/headers", {
    exports: {
      async cookies() {
        cookieReadCount += 1;
        return { get: () => undefined };
      },
      async headers() {
        originHeaderReadCount += 1;
        return { get: () => null };
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
      replaceStoryCredits: unexpectedDownstreamCall,
      replaceStoryEvents: unexpectedDownstreamCall,
      updateStoryDraft: unexpectedDownstreamCall,
    },
  });

  const previousSecret = process.env.ADMIN_SECRET;
  process.env.ADMIN_SECRET = "synthetic-server-boundary-secret";
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
  } finally {
    if (previousSecret === undefined) delete process.env.ADMIN_SECRET;
    else process.env.ADMIN_SECRET = previousSecret;
  }
});
