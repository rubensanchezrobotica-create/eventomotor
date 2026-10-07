import { createUploadIntentHandler } from "@/lib/stories/story-media-api.server";

export const runtime = "nodejs";
export const POST = createUploadIntentHandler();
