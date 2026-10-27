import "server-only";

import { createClient } from "@supabase/supabase-js";
import { type Database, type StoryRow } from "@/lib/supabase";
import { createSupabaseStoryMediaService } from "./story-media.server";
import { assertStoryMediaUuid } from "./story-media-validation";

const PUBLICATION_HTTP_TIMEOUT_MS = 15_000;
const PUBLICATION_READ_DEADLINE_MS = 90_000;
const PUBLICATION_RPC_DEADLINE_MS = 30_000;

type PublicationPhase = "story_read" | "readiness" | "rpc";

async function publicationPhase<T>(phase: PublicationPhase, operation: () => Promise<T>): Promise<T> {
  const startedAt = Date.now();
  console.info("story_publication_phase_start", { phase });
  try {
    const result = await operation();
    console.info("story_publication_phase_complete", { phase, durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    console.error("story_publication_phase_failed", {
      phase,
      durationMs: Date.now() - startedAt,
      code: error instanceof StoryPublicationError ? error.code : "UNEXPECTED",
    });
    throw error;
  }
}

/** A publication must not inherit the function's 300-second network wait. */
export function createPublicationFetch(
  transport: typeof fetch = fetch,
  timeoutMs = PUBLICATION_HTTP_TIMEOUT_MS,
  deadline?: AbortSignal,
): typeof fetch {
  return (input, init) => {
    const priorSignal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    const timeout = AbortSignal.timeout(timeoutMs);
    const signal = AbortSignal.any([timeout, ...(deadline ? [deadline] : []), ...(priorSignal ? [priorSignal] : [])]);
    return transport(input, { ...init, signal }).catch((error: unknown) => {
      if (signal.aborted) {
        const pathname = new URL(input instanceof Request ? input.url : String(input)).pathname;
        const endpoint = pathname.endsWith("/rpc/publish_story") ? "publication_rpc"
          : pathname.includes("/storage/v1/") ? "storage" : "story_database";
        console.error("story_publication_transport_abort", { endpoint, reason: signal.reason?.name ?? "ABORTED" });
      }
      throw error;
    });
  };
}

export class StoryPublicationError extends Error {
  constructor(readonly code: "INPUT_INVALID" | "NOT_FOUND" | "NOT_READY" | "VERSION_CONFLICT" | "GATE_FAILED" | "DATABASE_FAILED", message: string) {
    super(message);
    this.name = "StoryPublicationError";
  }
}

export type StoryPublicationRequest = {
  storyId: string;
  expectedUpdatedAt: string;
  requestId: string;
};

export function createStoryPublicationService(dependencies: {
  getStory(id: string): Promise<StoryRow | null>;
  readiness(id: string): Promise<{ ready: boolean }>;
  commit(input: StoryPublicationRequest): Promise<StoryRow>;
}) {
  return {
    async publish(input: StoryPublicationRequest) {
      assertStoryMediaUuid(input.storyId, "storyId");
      assertStoryMediaUuid(input.requestId, "requestId");
      if (!input.expectedUpdatedAt || input.expectedUpdatedAt.length > 64 || Number.isNaN(Date.parse(input.expectedUpdatedAt))) {
        throw new StoryPublicationError("INPUT_INVALID", "Publication requires an expected version.");
      }
      const story = await dependencies.getStory(input.storyId);
      if (!story) throw new StoryPublicationError("NOT_FOUND", "Story does not exist.");
      // Only the DB receipt can authorize an exact idempotent retry. It does
      // not re-run readiness (READY-only) or change published_at on a retry.
      if (story.status === "PUBLISHED") return dependencies.commit(input);
      if (story.status !== "READY") throw new StoryPublicationError("NOT_READY", "Story is not READY.");
      if (story.updated_at !== input.expectedUpdatedAt) {
        throw new StoryPublicationError("VERSION_CONFLICT", "Story changed since review.");
      }
      // Existing pure editorial validator + real byte inspection and public
      // delivery gate. The SQL RPC rechecks version under the common lock.
      const readiness = await dependencies.readiness(input.storyId);
      if (!readiness.ready) throw new StoryPublicationError("GATE_FAILED", "Publication readiness failed.");
      return dependencies.commit(input);
    },
  };
}

/** Server-only primitive; NOT a public API or an unauthenticated Server Action. */
export async function publishStory(input: StoryPublicationRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new StoryPublicationError("DATABASE_FAILED", "Supabase is not configured.");
  const deadline = AbortSignal.timeout(PUBLICATION_READ_DEADLINE_MS);
  const client = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: createPublicationFetch(fetch, PUBLICATION_HTTP_TIMEOUT_MS, deadline) },
  });
  return createStoryPublicationService({
    getStory: (id) => publicationPhase("story_read", async () => {
      const { data, error } = await client.from("stories").select("*").eq("id", id).maybeSingle();
      if (error) throw new StoryPublicationError("DATABASE_FAILED", "Could not read Story.");
      return data;
    }),
    readiness: (id) => publicationPhase("readiness", async () => {
      const result = await createSupabaseStoryMediaService(client).publicationReadiness(id, deadline);
      if (!result.ready) console.error("story_publication_readiness_rejected", {
        editorialCodes: result.publicationErrors.map((issue) => issue.code),
        storageCodes: result.storageIssues.map((issue) => issue.code),
      });
      return result;
    }),
    commit: (request) => publicationPhase("rpc", async () => {
      const rpcClient = createClient<Database>(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { fetch: createPublicationFetch(fetch, PUBLICATION_HTTP_TIMEOUT_MS, AbortSignal.timeout(PUBLICATION_RPC_DEADLINE_MS)) },
      });
      const { data, error } = await rpcClient.rpc("publish_story", {
        p_story_id: request.storyId,
        p_expected_updated_at: request.expectedUpdatedAt,
        p_request_id: request.requestId,
      }).single();
      if (error || !data) {
        const conflict = error?.code === "40001" || error?.code === "55P03";
        throw new StoryPublicationError(conflict ? "VERSION_CONFLICT" : "DATABASE_FAILED", "Atomic publication was not confirmed. Check the receipt before retrying.");
      }
      return data;
    }),
  }).publish(input);
}
