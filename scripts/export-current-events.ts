import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

type EventExportRow = {
  id: string;
  title: string;
  slug: string | null;
  start_date: string;
  end_date: string | null;
  venue: string | null;
  city: string | null;
  province: string | null;
  country: string;
  discipline: string | null;
  category: string | null;
  source_name: string | null;
  source_url: string | null;
  official_url: string | null;
  ticket_url: string | null;
  image_url?: string | null;
  tags: string[] | null;
  description: string | null;
  status: string;
};

type SupabaseEventRow = {
  id: string;
  slug: string | null;
  title: string;
  championship: string | null;
  discipline: string | null;
  start_date: string;
  end_date: string | null;
  venue: string | null;
  city: string | null;
  province: string | null;
  source: string | null;
  source_url: string | null;
  ticket_url: string | null;
  tags: string[] | null;
  notes: string | null;
  visible: boolean | null;
  data_quality: string | null;
  level: string | null;
};

type Database = {
  public: {
    Tables: {
      events: {
        Row: SupabaseEventRow;
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

type CountSummary = Record<string, number>;

type DuplicateGroup = {
  key: string;
  title: string;
  start_date: string;
  city: string;
  count: number;
  event_ids: string[];
};

type GeoIssue = {
  id: string;
  title: string;
  city: string | null;
  province: string | null;
  reason: string;
  expected_province?: string;
};

const EXPORT_DIR = path.join(process.cwd(), "data", "exports");
const PAGE_SIZE = 1000;

const EVENT_SELECT = [
  "id",
  "slug",
  "title",
  "championship",
  "discipline",
  "start_date",
  "end_date",
  "venue",
  "city",
  "province",
  "source",
  "source_url",
  "ticket_url",
  "tags",
  "notes",
  "visible",
  "data_quality",
  "level",
].join(",");

const PROVINCES = new Map(
  [
    "A Coruna",
    "Alava",
    "Albacete",
    "Alicante",
    "Almeria",
    "Asturias",
    "Avila",
    "Badajoz",
    "Barcelona",
    "Burgos",
    "Caceres",
    "Cadiz",
    "Cantabria",
    "Castellon",
    "Ceuta",
    "Ciudad Real",
    "Cordoba",
    "Cuenca",
    "Girona",
    "Granada",
    "Guadalajara",
    "Gipuzkoa",
    "Huelva",
    "Huesca",
    "Illes Balears",
    "Jaen",
    "La Rioja",
    "Las Palmas",
    "Leon",
    "Lleida",
    "Lugo",
    "Madrid",
    "Malaga",
    "Melilla",
    "Murcia",
    "Navarra",
    "Ourense",
    "Palencia",
    "Pontevedra",
    "Salamanca",
    "Santa Cruz de Tenerife",
    "Segovia",
    "Sevilla",
    "Soria",
    "Tarragona",
    "Teruel",
    "Toledo",
    "Valencia",
    "Valladolid",
    "Vizcaya",
    "Zamora",
    "Zaragoza",
  ].map((province) => [normalizeComparable(province), province]),
);

const PROVINCE_ALIASES: Record<string, string> = {
  "a-coruna": "A Coruna",
  "la-coruna": "A Coruna",
  araba: "Alava",
  "araba-alava": "Alava",
  "alava-araba": "Alava",
  "castello": "Castellon",
  "castellon-castello": "Castellon",
  "ciudad-real": "Ciudad Real",
  gerona: "Girona",
  "girona-gerona": "Girona",
  guipuzcoa: "Gipuzkoa",
  "illes-balears": "Illes Balears",
  baleares: "Illes Balears",
  "la-rioja": "La Rioja",
  "las-palmas": "Las Palmas",
  lerida: "Lleida",
  "lleida-lerida": "Lleida",
  orense: "Ourense",
  "santa-cruz-de-tenerife": "Santa Cruz de Tenerife",
  "valencia-valencia": "Valencia",
  bizkaia: "Vizcaya",
};

const MUNICIPALITY_PROVINCES: Record<string, string> = {
  "a-coruna": "A Coruna",
  albacete: "Albacete",
  alcala: "Madrid",
  alcañiz: "Teruel",
  alcaniz: "Teruel",
  alcoy: "Alicante",
  alicante: "Alicante",
  almeria: "Almeria",
  avila: "Avila",
  badajoz: "Badajoz",
  barcelona: "Barcelona",
  bilbao: "Vizcaya",
  burgos: "Burgos",
  caceres: "Caceres",
  cadiz: "Cadiz",
  cartagena: "Murcia",
  castellon: "Castellon",
  ceuta: "Ceuta",
  cheste: "Valencia",
  "ciudad-real": "Ciudad Real",
  cordoba: "Cordoba",
  cuenca: "Cuenca",
  girona: "Girona",
  granada: "Granada",
  guadalajara: "Guadalajara",
  huelva: "Huelva",
  huesca: "Huesca",
  jaen: "Jaen",
  jerez: "Cadiz",
  "jerez-de-la-frontera": "Cadiz",
  leon: "Leon",
  lleida: "Lleida",
  logroño: "La Rioja",
  logrono: "La Rioja",
  lugo: "Lugo",
  madrid: "Madrid",
  malaga: "Malaga",
  melilla: "Melilla",
  montmelo: "Barcelona",
  murcia: "Murcia",
  ourense: "Ourense",
  oviedo: "Asturias",
  palencia: "Palencia",
  "palma": "Illes Balears",
  pamplona: "Navarra",
  pontevedra: "Pontevedra",
  salamanca: "Salamanca",
  santander: "Cantabria",
  "san-sebastian": "Gipuzkoa",
  "santa-cruz-de-tenerife": "Santa Cruz de Tenerife",
  segovia: "Segovia",
  sevilla: "Sevilla",
  soria: "Soria",
  tarragona: "Tarragona",
  teruel: "Teruel",
  toledo: "Toledo",
  valencia: "Valencia",
  valladolid: "Valladolid",
  vitoria: "Alava",
  "vitoria-gasteiz": "Alava",
  zamora: "Zamora",
  zaragoza: "Zaragoza",
};

loadEnvConfig(process.cwd());

function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function formatDate(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");

  return [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join("-");
}

function normalizeComparable(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeProvinceName(province: string | null | undefined) {
  const key = normalizeComparable(province);

  if (!key) return null;

  return PROVINCE_ALIASES[key] || PROVINCES.get(key) || null;
}

function normalizeStatus(row: SupabaseEventRow) {
  if (row.visible === false) return "hidden";

  return row.data_quality || row.level || "unknown";
}

function toExportRow(row: SupabaseEventRow): EventExportRow {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    start_date: row.start_date,
    end_date: row.end_date,
    venue: row.venue,
    city: row.city,
    province: row.province,
    country: "ES",
    discipline: row.discipline,
    category: row.championship,
    source_name: row.source,
    source_url: row.source_url,
    official_url: row.source_url || row.ticket_url,
    ticket_url: row.ticket_url,
    tags: row.tags,
    description: row.notes,
    status: normalizeStatus(row),
  };
}

function countBy(events: EventExportRow[], field: "province" | "discipline"): CountSummary {
  return events.reduce<CountSummary>((counts, event) => {
    const key = event[field]?.trim() || "(sin dato)";
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function sortCounts(counts: CountSummary): CountSummary {
  return Object.fromEntries(
    Object.entries(counts).sort(([leftKey, leftValue], [rightKey, rightValue]) => {
      return rightValue - leftValue || leftKey.localeCompare(rightKey, "es");
    }),
  );
}

function findDuplicateGroups(events: EventExportRow[]) {
  const groups = new Map<string, EventExportRow[]>();

  for (const event of events) {
    const key = [
      normalizeComparable(event.title),
      event.start_date,
      normalizeComparable(event.city),
    ].join("|");

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)?.push(event);
  }

  return [...groups.entries()]
    .filter(([, groupedEvents]) => groupedEvents.length > 1)
    .map<DuplicateGroup>(([key, groupedEvents]) => ({
      key,
      title: groupedEvents[0]?.title || "",
      start_date: groupedEvents[0]?.start_date || "",
      city: groupedEvents[0]?.city || "",
      count: groupedEvents.length,
      event_ids: groupedEvents.map((event) => event.id),
    }))
    .sort((left, right) => right.count - left.count || left.title.localeCompare(right.title, "es"));
}

function findGeoIssues(events: EventExportRow[]) {
  const issues: GeoIssue[] = [];

  for (const event of events) {
    const cityKey = normalizeComparable(event.city);
    const provinceKey = normalizeComparable(event.province);
    const normalizedProvince = normalizeProvinceName(event.province);

    if (!cityKey || cityKey === "por-confirmar") {
      issues.push({
        id: event.id,
        title: event.title,
        city: event.city,
        province: event.province,
        reason: "municipio ausente o placeholder",
      });
    }

    if (!provinceKey || provinceKey === "por-confirmar") {
      issues.push({
        id: event.id,
        title: event.title,
        city: event.city,
        province: event.province,
        reason: "provincia ausente o placeholder",
      });
      continue;
    }

    if (!normalizedProvince) {
      issues.push({
        id: event.id,
        title: event.title,
        city: event.city,
        province: event.province,
        reason: "provincia no reconocida en listado de provincias espanolas",
      });
      continue;
    }

    const expectedProvince = MUNICIPALITY_PROVINCES[cityKey];

    if (expectedProvince && expectedProvince !== normalizedProvince) {
      issues.push({
        id: event.id,
        title: event.title,
        city: event.city,
        province: event.province,
        reason: "municipio conocido no coincide con provincia",
        expected_province: expectedProvince,
      });
    }
  }

  return issues;
}

async function fetchAllEvents() {
  const supabaseUrl = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const events: SupabaseEventRow[] = [];
  let from = 0;

  while (true) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("events")
      .select(EVENT_SELECT)
      .order("start_date", { ascending: true })
      .range(from, to);

    if (error) {
      throw new Error(`No se pudieron leer eventos actuales: ${error.message}`);
    }

    const page = (data ?? []) as unknown as SupabaseEventRow[];
    events.push(...page);

    if (page.length < PAGE_SIZE) break;

    from += PAGE_SIZE;
  }

  return events;
}

async function main() {
  console.log("Export seguro de public.events");
  console.log("Modo: solo lectura de Supabase y escritura local en data/exports.\n");

  const now = new Date();
  const today = formatDate(now);
  const rows = await fetchAllEvents();
  const events = rows.map(toExportRow);
  const duplicateGroups = findDuplicateGroups(events);
  const geoIssues = findGeoIssues(events);
  const outputPath = path.join(EXPORT_DIR, `events-current-${today}.json`);
  const summary = {
    total_eventos: events.length,
    eventos_por_provincia: sortCounts(countBy(events, "province")),
    eventos_por_disciplina: sortCounts(countBy(events, "discipline")),
    eventos_futuros: events.filter((event) => event.start_date >= today).length,
    posibles_duplicados_por_titulo_fecha_ciudad: duplicateGroups,
    posibles_errores_provincia_municipio: geoIssues,
  };

  await mkdir(EXPORT_DIR, { recursive: true });
  await writeFile(
    outputPath,
    `${JSON.stringify(
      {
        generated_at: now.toISOString(),
        source: "public.events",
        export_type: "current-events-read-only",
        summary,
        events,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  console.log("Resumen:");
  console.log(`- total eventos: ${summary.total_eventos}`);
  console.log(`- eventos futuros: ${summary.eventos_futuros}`);
  console.log(`- provincias distintas: ${Object.keys(summary.eventos_por_provincia).length}`);
  console.log(`- disciplinas distintas: ${Object.keys(summary.eventos_por_disciplina).length}`);
  console.log(`- posibles duplicados titulo + fecha + ciudad: ${duplicateGroups.length}`);
  console.log(`- posibles errores provincia/municipio: ${geoIssues.length}`);
  console.log(`- archivo generado: ${outputPath}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);

  console.error(`\nExport de eventos fallido: ${message}`);
  process.exitCode = 1;
});
