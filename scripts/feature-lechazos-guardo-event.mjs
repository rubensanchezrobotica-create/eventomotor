import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

loadEnvConfig(process.cwd());

const SLUG = "xxxvi-concentracion-lechazos-guardo-2026-06-26";

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function main() {
  const shouldApply = process.argv.includes("--apply");
  const supabase = createClient(requiredEnv("NEXT_PUBLIC_SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: event, error } = await supabase
    .from("events")
    .select("id,slug,title,start_date,end_date,featured,visible")
    .eq("slug", SLUG)
    .maybeSingle();

  if (error) throw error;
  if (!event) throw new Error(`Event not found for slug: ${SLUG}`);

  console.log(JSON.stringify({ action: shouldApply ? "apply" : "dry-run", event, featured_until: "2026-06-28" }, null, 2));
  if (!shouldApply) return;

  const { data: updated, error: updateError } = await supabase
    .from("events")
    .update({ featured: true })
    .eq("id", event.id)
    .select("id,slug,title,start_date,end_date,featured,visible")
    .single();

  if (updateError) throw updateError;
  console.log(JSON.stringify({ updated, featured_until: "2026-06-28" }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
