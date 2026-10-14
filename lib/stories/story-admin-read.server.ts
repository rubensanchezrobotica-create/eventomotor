import "server-only";

import { requireAdminSession } from "@/lib/admin-session.server";
import {
  getStoryForAdmin, listStoriesForAdmin, resolveStoryMediaForAdmin, searchEventsForStoryAdmin,
  type StoryListStatus,
} from "./story-admin.server";

/** HTTP render boundary. The underlying services also serve trusted actions and
 * ephemeral/offline workers; no page may call them without this session gate.
 * Do not cache this boundary or rely on the parent layout: RSC renders in parallel.
 */
export function createStoryAdminReadService(dependencies: {
  authorize(nextPath: string): Promise<unknown>;
  getBundle: typeof getStoryForAdmin;
  list: typeof listStoriesForAdmin;
  search: typeof searchEventsForStoryAdmin;
  resolveMedia: typeof resolveStoryMediaForAdmin;
}) {
  return {
    async bundle(id: string) {
      await dependencies.authorize(`/admin/historias/${encodeURIComponent(id)}`);
      return dependencies.getBundle(id);
    },
    async preview(id: string) {
      await dependencies.authorize(`/admin/historias/${encodeURIComponent(id)}/preview`);
      const bundle = await dependencies.getBundle(id);
      if (!bundle) return null;
      const media = await dependencies.resolveMedia(id, bundle.media);
      return { bundle, media };
    },
    async list(status: StoryListStatus = "ALL") {
      await dependencies.authorize("/admin/historias");
      return dependencies.list(status);
    },
    async search(query: string) {
      await dependencies.authorize("/admin/historias");
      return dependencies.search(query);
    },
  };
}

const reads = createStoryAdminReadService({ authorize: requireAdminSession, getBundle: getStoryForAdmin,
  list: listStoriesForAdmin, search: searchEventsForStoryAdmin, resolveMedia: resolveStoryMediaForAdmin });

export const getAuthenticatedStoryBundle = reads.bundle;
export const getAuthenticatedStoryPreview = reads.preview;
export const listAuthenticatedStories = reads.list;
export const searchAuthenticatedStoryEvents = reads.search;
