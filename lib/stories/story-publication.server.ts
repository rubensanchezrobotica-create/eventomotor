import "server-only";

import { createSupabaseServerClient, type StoryRow } from "@/lib/supabase";
import { createSupabaseStoryMediaService } from "./story-media.server";
import { assertStoryMediaUuid } from "./story-media-validation";

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
  const client = createSupabaseServerClient();
  if (!client) throw new StoryPublicationError("DATABASE_FAILED", "Supabase is not configured.");
  return createStoryPublicationService({
    async getStory(id) {
      const { data, error } = await client.from("stories").select("*").eq("id", id).maybeSingle();
      if (error) throw new StoryPublicationError("DATABASE_FAILED", "Could not read Story.");
      return data;
    },
    readiness: (id) => createSupabaseStoryMediaService(client).publicationReadiness(id),
    async commit(request) {
      const { data, error } = await client.rpc("publish_story", {
        p_story_id: request.storyId,
        p_expected_updated_at: request.expectedUpdatedAt,
        p_request_id: request.requestId,
      }).single();
      if (error || !data) {
        const conflict = error?.code === "40001" || error?.code === "55P03";
        throw new StoryPublicationError(conflict ? "VERSION_CONFLICT" : "DATABASE_FAILED", "Atomic publication was not committed.");
      }
      return data;
    },
  }).publish(input);
}
