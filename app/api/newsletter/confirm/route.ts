import { createNewsletterHttpHandler } from "@/lib/newsletter/http.server";

export const runtime = "nodejs";

export const POST = createNewsletterHttpHandler("confirm");
