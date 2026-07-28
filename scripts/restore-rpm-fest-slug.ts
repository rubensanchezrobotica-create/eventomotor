import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";

export const RPM_FEST_ID = "admin-rpm-fest-night-demons-2026";
export const RPM_FEST_TITLE = "RPM FEST – Night Demons 2026";
export const RPM_FEST_DATE = "2026-08-15";
export const ACCIDENTAL_SLUG = "rpm-fest-night-demons-2026-2026-08-15";
export const CANONICAL_SLUG = "rpm-fest-night-demons-2026";

export type SlugRestoreRow = {
  id: string;
  title: string;
  slug: string | null;
  start_date: string;
  updated_at: string;
};

export interface SlugRestoreRepository {
  findById(id: string): Promise<SlugRestoreRow[]>;
  findBySlug(slug: string): Promise<SlugRestoreRow[]>;
  updateSlug(input: {
    id: string;
    currentSlug: string;
    targetSlug: string;
    expectedUpdatedAt: string;
    nextUpdatedAt: string;
  }): Promise<SlugRestoreRow[]>;
}

export type SlugRestoreInput = {
  apply?: boolean;
  rollback?: boolean;
  confirmedEventId?: string;
  confirmedCurrentSlug?: string;
  confirmedTargetSlug?: string;
  now?: Date;
};

export async function restoreRpmFestSlug(
  repository: SlugRestoreRepository,
  input: SlugRestoreInput = {},
) {
  const currentSlug = input.rollback ? CANONICAL_SLUG : ACCIDENTAL_SLUG;
  const targetSlug = input.rollback ? ACCIDENTAL_SLUG : CANONICAL_SLUG;
  const rows = await repository.findById(RPM_FEST_ID);
  if (rows.length !== 1) {
    throw new Error(`Se esperaba una fila para ${RPM_FEST_ID}, pero se encontraron ${rows.length}.`);
  }

  const before = rows[0];
  if (
    before.title !== RPM_FEST_TITLE
    || before.slug !== currentSlug
    || before.start_date !== RPM_FEST_DATE
    || !before.updated_at
  ) {
    throw new Error("La identidad actual del evento no coincide con la corrección preparada.");
  }

  const occupied = await repository.findBySlug(targetSlug);
  if (occupied.length !== 0) {
    throw new Error(`El slug destino ${targetSlug} ya está ocupado.`);
  }

  const rollback = `--rollback --apply --event-id=${RPM_FEST_ID} --current-slug=${targetSlug} --target-slug=${currentSlug}`;
  if (!input.apply) {
    return { applied: false as const, before, after: null, rollback };
  }

  if (
    input.confirmedEventId !== RPM_FEST_ID
    || input.confirmedCurrentSlug !== currentSlug
    || input.confirmedTargetSlug !== targetSlug
  ) {
    throw new Error("La aplicación exige confirmar simultáneamente event id, slug actual y slug destino.");
  }

  const nextUpdatedAt = (input.now || new Date()).toISOString();
  if (Date.parse(nextUpdatedAt) === Date.parse(before.updated_at)) {
    throw new Error("El nuevo updated_at debe ser distinto del valor observado.");
  }

  const updated = await repository.updateSlug({
    id: RPM_FEST_ID,
    currentSlug,
    targetSlug,
    expectedUpdatedAt: before.updated_at,
    nextUpdatedAt,
  });
  if (updated.length !== 1) {
    throw new Error("La actualización no coincidió con exactamente una fila; posible conflicto de concurrencia.");
  }

  const afterRows = await repository.findById(RPM_FEST_ID);
  if (
    afterRows.length !== 1
    || afterRows[0].slug !== targetSlug
    || afterRows[0].title !== before.title
    || afterRows[0].start_date !== before.start_date
    || afterRows[0].updated_at !== nextUpdatedAt
  ) {
    throw new Error("La verificación posterior de la restauración falló.");
  }

  return { applied: true as const, before, after: afterRows[0], rollback };
}

function argumentValue(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

function requiredEnvironment(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Falta ${name}.`);
  return value;
}

export async function main() {
  loadEnvConfig(process.cwd());
  const apply = process.argv.includes("--apply");
  const rollback = process.argv.includes("--rollback");
  const supabase = createClient(
    requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const select = "id,title,slug,start_date,updated_at";
  const repository: SlugRestoreRepository = {
    async findById(id) {
      const { data, error } = await supabase.from("events").select(select).eq("id", id);
      if (error) throw error;
      return (data || []) as SlugRestoreRow[];
    },
    async findBySlug(slug) {
      const { data, error } = await supabase.from("events").select(select).eq("slug", slug);
      if (error) throw error;
      return (data || []) as SlugRestoreRow[];
    },
    async updateSlug(input) {
      const { data, error } = await supabase
        .from("events")
        .update({ slug: input.targetSlug, updated_at: input.nextUpdatedAt })
        .eq("id", input.id)
        .eq("slug", input.currentSlug)
        .eq("updated_at", input.expectedUpdatedAt)
        .select(select);
      if (error) throw error;
      return (data || []) as SlugRestoreRow[];
    },
  };

  const result = await restoreRpmFestSlug(repository, {
    apply,
    rollback,
    confirmedEventId: argumentValue("event-id"),
    confirmedCurrentSlug: argumentValue("current-slug"),
    confirmedTargetSlug: argumentValue("target-slug"),
  });
  console.log(JSON.stringify(result, null, 2));
  if (!result.applied) {
    console.log("DRY-RUN: no se ha modificado ninguna fila.");
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : JSON.stringify(error));
    process.exitCode = 1;
  });
}
