import { handleNewsletterResendWebhook } from "@/lib/newsletter/resend-webhook.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handleNewsletterResendWebhook;
