import { createPreviewUrlHandler } from "@/lib/stories/story-media-api.server";

export const runtime = "nodejs";
export const GET = createPreviewUrlHandler();
