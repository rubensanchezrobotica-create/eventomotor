import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type EventExportRow = {
  id: string;
  title: string;
  slug: string | null;
  start_date: string;
  end_date: string | null;
  venue?: string | null;
  city: string | null;
  province: string | null;
  country: string;
  discipline: string | null;
  category: string | null;
  source_name: string | null;
  source_url: string | null;
  official_url: string | null;
  ticket_url?: string | null;
  image_url?: string | null;
  tags?: string[] | null;
  description?: string | null;
  status: string;
};

type GeoIssue = {
  id: string;
  title: string;
  city: string | null;
  province: string | null;
  reason: string;
  expected_province?: string;
};

type ExportFile = {
  generated_at: string;
  source: string;
  summary: {
    total_eventos: number;
    eventos_futuros: number;
    eventos_por_provincia: Record<string, number>;
    eventos_por_disciplina: Record<string, number>;
    posibles_errores_provincia_municipio: GeoIssue[];
  };
  events: EventExportRow[];
};

type SeoIssue = {
  id: string;
  title: string;
  slug: string;
  start_date: string;
  detail: string;
};

const EXPORT_DATE = "2026-07-06";
const INPUT_PATH = path.join(process.cwd(), "data", "exports", `events-current-${EXPORT_DATE}.json`);
const OUTPUT_PATH = path.join(process.cwd(), "data", "exports", `events-quality-report-${EXPORT_DATE}.md`);
const SHORT_DESCRIPTION_LENGTH = 80;

const GENERIC_SOURCE_PATTERNS = [
  "fuente oficial",
  "organizador",
  "instagram",
  "facebook",
  "web oficial",
  "supabase",
  "cartel oficial",
];

const GENERIC_TITLE_PATTERNS = [
  /^concentracion(?: motera)?$/i,
  /^ruta(?: motera)?$/i,
  /^trackday$/i,
  /^feria(?: del motor)?$/i,
  /^karting$/i,
  /^evento(?: de motor)?$/i,
  /^rallye?$/i,
];

function normalizeComparable(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function hasValue(value: string | null | undefined) {
  return Boolean(value && value.trim());
}

function isMissingOrPlaceholder(value: string | null | undefined) {
  const normalized = normalizeComparable(value);

  return !normalized || normalized === "por-confirmar" || normalized === "sin-dato";
}

function countBy(events: EventExportRow[], getter: (event: EventExportRow) => string | null | undefined) {
  const counts: Record<string, number> = {};

  for (const event of events) {
    const key = getter(event)?.trim() || "(sin dato)";
    counts[key] = (counts[key] || 0) + 1;
  }

  return Object.fromEntries(
    Object.entries(counts).sort(([leftKey, leftCount], [rightKey, rightCount]) => {
      return rightCount - leftCount || leftKey.localeCompare(rightKey, "es");
    }),
  );
}

function markdownTable(headers: string[], rows: Array<Array<string | number>>) {
  const escapeCell = (value: string | number) => String(value).replace(/\|/g, "\\|").replace(/\n/g, " ");

  return [
    `| ${headers.map(escapeCell).join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map(escapeCell).join(" | ")} |`),
  ].join("\n");
}

function formatCountTable(counts: Record<string, number>) {
  return markdownTable(
    ["Valor", "Eventos"],
    Object.entries(counts).map(([key, count]) => [key, count]),
  );
}

function findLongSlugs(events: EventExportRow[]) {
  return events
    .filter((event) => (event.slug || "").length > 80)
    .map<SeoIssue>((event) => ({
      id: event.id,
      title: event.title,
      slug: event.slug || "",
      start_date: event.start_date,
      detail: `${(event.slug || "").length} caracteres`,
    }));
}

function findRepetitiveSlugs(events: EventExportRow[]) {
  return events
    .filter((event) => {
      const slug = event.slug || "";
      const parts = slug.split("-").filter(Boolean);
      const repeatedParts = parts.filter((part, index) => parts.indexOf(part) !== index);

      return repeatedParts.length >= 2;
    })
    .map<SeoIssue>((event) => ({
      id: event.id,
      title: event.title,
      slug: event.slug || "",
      start_date: event.start_date,
      detail: "contiene terminos repetidos",
    }));
}

function findTitlesWithDuplicatedDate(events: EventExportRow[]) {
  return events
    .filter((event) => {
      const title = normalizeComparable(event.title);
      const year = event.start_date.slice(0, 4);

      return Boolean(year && title.includes(year) && (event.slug || "").includes(year));
    })
    .map<SeoIssue>((event) => ({
      id: event.id,
      title: event.title,
      slug: event.slug || "",
      start_date: event.start_date,
      detail: "el ano aparece en titulo y slug",
    }));
}

function findGenericTitles(events: EventExportRow[]) {
  return events
    .filter((event) => {
      const title = event.title.trim();

      return title.length < 18 || GENERIC_TITLE_PATTERNS.some((pattern) => pattern.test(title));
    })
    .map<SeoIssue>((event) => ({
      id: event.id,
      title: event.title,
      slug: event.slug || "",
      start_date: event.start_date,
      detail: "titulo corto o demasiado generico",
    }));
}

function findGenericSources(events: EventExportRow[]) {
  return events
    .filter((event) => {
      const source = normalizeComparable(event.source_name);

      return !source || GENERIC_SOURCE_PATTERNS.some((pattern) => source.includes(normalizeComparable(pattern)));
    })
    .map<SeoIssue>((event) => ({
      id: event.id,
      title: event.title,
      slug: event.slug || "",
      start_date: event.start_date,
      detail: event.source_name || "(sin fuente)",
    }));
}

function findFutureEventsWithShortDescription(events: EventExportRow[]) {
  return events
    .filter((event) => event.start_date >= EXPORT_DATE)
    .filter((event) => !event.description || event.description.trim().length < SHORT_DESCRIPTION_LENGTH)
    .map<SeoIssue>((event) => ({
      id: event.id,
      title: event.title,
      slug: event.slug || "",
      start_date: event.start_date,
      detail: `${event.description?.trim().length || 0} caracteres`,
    }));
}

function confidenceForGeoIssue(issue: GeoIssue) {
  if (issue.expected_province) return "alto";
  if (issue.reason.includes("ausente") || issue.reason.includes("placeholder")) return "medio";
  return "bajo";
}

function suggestionForGeoIssue(issue: GeoIssue) {
  if (issue.expected_province) return `Revisar provincia; sugerencia: ${issue.expected_province}`;
  if (!hasValue(issue.city) || normalizeComparable(issue.city) === "por-confirmar") {
    return "Completar municipio desde fuente oficial";
  }
  if (!hasValue(issue.province) || normalizeComparable(issue.province) === "por-confirmar") {
    return "Completar provincia desde fuente oficial";
  }
  return "Verificar manualmente contra la fuente oficial";
}

function issueRows(issues: SeoIssue[], limit = 30) {
  return issues.slice(0, limit).map((issue) => [
    issue.id,
    issue.title,
    issue.slug,
    issue.start_date,
    issue.detail,
  ]);
}

async function main() {
  const parsed = JSON.parse(await readFile(INPUT_PATH, "utf8")) as ExportFile;
  const events = parsed.events;
  const futureEvents = events.filter((event) => event.start_date >= EXPORT_DATE);
  const pastEvents = events.filter((event) => event.start_date < EXPORT_DATE);
  const missingOfficialSource = events.filter((event) => !hasValue(event.official_url));
  const missingSourceUrl = events.filter((event) => !hasValue(event.source_url));
  const missingOrShortDescription = events.filter(
    (event) => !event.description || event.description.trim().length < SHORT_DESCRIPTION_LENGTH,
  );
  const missingCity = events.filter((event) => isMissingOrPlaceholder(event.city));
  const missingProvince = events.filter((event) => isMissingOrPlaceholder(event.province));
  const hasImageField = events.some((event) => Object.hasOwn(event, "image_url"));
  const missingImage = hasImageField ? events.filter((event) => !hasValue(event.image_url)) : [];
  const geoIssues = parsed.summary.posibles_errores_provincia_municipio;
  const geoIssueEventsById = new Map(events.map((event) => [event.id, event]));
  const longSlugs = findLongSlugs(events);
  const repetitiveSlugs = findRepetitiveSlugs(events);
  const titlesWithDuplicatedDate = findTitlesWithDuplicatedDate(events);
  const genericTitles = findGenericTitles(events);
  const genericSources = findGenericSources(events);
  const futureShortDescription = findFutureEventsWithShortDescription(events);
  const descriptionMissingRate = Math.round((missingOrShortDescription.length / events.length) * 100);
  const imageMissingRate = hasImageField ? Math.round((missingImage.length / events.length) * 100) : null;

  const markdown = [
    `# Informe de calidad de eventos actuales (${EXPORT_DATE})`,
    "",
    `Fuente analizada: \`${INPUT_PATH}\``,
    `Generado desde export: ${parsed.generated_at}`,
    "",
    "## A) Resumen general",
    "",
    markdownTable(
      ["Metrica", "Valor"],
      [
        ["Total eventos", events.length],
        ["Eventos futuros", futureEvents.length],
        ["Eventos pasados", pastEvents.length],
        ["Eventos sin fuente oficial", missingOfficialSource.length],
        ["Eventos sin source_url", missingSourceUrl.length],
        [`Eventos sin descripcion o descripcion < ${SHORT_DESCRIPTION_LENGTH} caracteres`, missingOrShortDescription.length],
        ["Eventos sin ciudad", missingCity.length],
        ["Eventos sin provincia", missingProvince.length],
        ["Eventos sin imagen", hasImageField ? missingImage.length : "Campo image_url no presente en export"],
      ],
    ),
    "",
    "### Eventos por provincia",
    "",
    formatCountTable(countBy(events, (event) => event.province)),
    "",
    "### Eventos por disciplina",
    "",
    formatCountTable(countBy(events, (event) => event.discipline)),
    "",
    "## B) Posibles errores provincia/municipio",
    "",
    markdownTable(
      ["id", "titulo", "slug", "fecha", "ciudad actual", "provincia actual", "pais", "motivo", "sugerencia", "confianza"],
      geoIssues.map((issue) => {
        const event = geoIssueEventsById.get(issue.id);

        return [
          issue.id,
          event?.title || issue.title,
          event?.slug || "",
          event?.start_date || "",
          issue.city || "",
          issue.province || "",
          event?.country || "ES",
          issue.reason,
          suggestionForGeoIssue(issue),
          confidenceForGeoIssue(issue),
        ];
      }),
    ),
    "",
    "## C) Posibles problemas SEO",
    "",
    markdownTable(
      ["Categoria", "Eventos detectados"],
      [
        ["Slugs demasiado largos (>80 caracteres)", longSlugs.length],
        ["Slugs repetitivos", repetitiveSlugs.length],
        ["Titulos con fechas duplicadas en titulo y slug", titlesWithDuplicatedDate.length],
        ["Titulos demasiado genericos", genericTitles.length],
        ["Eventos con fuente generica o ausente", genericSources.length],
        [`Eventos futuros sin descripcion suficiente (<${SHORT_DESCRIPTION_LENGTH} caracteres)`, futureShortDescription.length],
      ],
    ),
    "",
    "### Slugs demasiado largos",
    longSlugs.length ? markdownTable(["id", "titulo", "slug", "fecha", "detalle"], issueRows(longSlugs)) : "No se han detectado.",
    "",
    "### Slugs repetitivos",
    repetitiveSlugs.length
      ? markdownTable(["id", "titulo", "slug", "fecha", "detalle"], issueRows(repetitiveSlugs))
      : "No se han detectado.",
    "",
    "### Titulos con fechas duplicadas",
    titlesWithDuplicatedDate.length
      ? markdownTable(["id", "titulo", "slug", "fecha", "detalle"], issueRows(titlesWithDuplicatedDate))
      : "No se han detectado.",
    "",
    "### Titulos demasiado genericos",
    genericTitles.length
      ? markdownTable(["id", "titulo", "slug", "fecha", "detalle"], issueRows(genericTitles))
      : "No se han detectado.",
    "",
    "### Fuentes genericas o ausentes",
    genericSources.length
      ? markdownTable(["id", "titulo", "slug", "fecha", "fuente"], issueRows(genericSources))
      : "No se han detectado.",
    "",
    "### Eventos futuros sin descripcion suficiente",
    futureShortDescription.length
      ? markdownTable(["id", "titulo", "slug", "fecha", "detalle"], issueRows(futureShortDescription, 50))
      : "No se han detectado.",
    "",
    "## D) Recomendaciones",
    "",
    "### Corregir antes de importar nuevos eventos",
    "",
    "- Resolver primero los 23 avisos de provincia/municipio para no multiplicar errores geograficos en landings locales.",
    "- Priorizar eventos futuros sin descripcion suficiente, porque son los que tendran impacto publico y SEO inmediato.",
    "- Normalizar source_name/source_url: la fuente debe ser el organizador, recinto, federacion o pagina oficial cuando exista.",
    "- Revisar slugs largos o repetitivos antes de crear nuevos eventos similares para evitar URLs poco limpias.",
    "- Mantener bloqueada cualquier importacion que llegue sin ciudad, provincia, fecha, fuente verificable y URL.",
    "",
    "### Campos recomendados para Event v2",
    "",
    "- `official_url`: URL canonica oficial separada de `source_url`, `ticket_url` y redes sociales.",
    "- `description`: texto editorial corto y verificable, separado de `notes` internas.",
    "- `organizer_name` y `organizer_url`: ayudan a diferenciar fuente, promotor y canal de venta.",
    "- `address`, `latitude`, `longitude` y `municipality_id`: reducen errores provincia/municipio.",
    "- `source_confidence` y `last_verified_at`: utiles para investigacion masiva y revisiones periodicas.",
    "- `image_url` con `image_source_url` y licencia/origen de imagen.",
    "",
    "### Datos que faltan con mas frecuencia",
    "",
    `- Descripcion suficiente: ${missingOrShortDescription.length}/${events.length} eventos (${descriptionMissingRate}%).`,
    hasImageField
      ? `- Imagen: ${missingImage.length}/${events.length} eventos (${imageMissingRate}%).`
      : "- Imagen: el export anterior no incluia campo image_url; el export enriquecido ya lo incorpora.",
    `- Source URL: ${missingSourceUrl.length}/${events.length} eventos.`,
    `- Fuente oficial: ${missingOfficialSource.length}/${events.length} eventos.`,
    `- Ciudad: ${missingCity.length}/${events.length} eventos.`,
    `- Provincia: ${missingProvince.length}/${events.length} eventos.`,
    "",
  ].join("\n");

  await writeFile(OUTPUT_PATH, markdown, "utf8");
  console.log(`Informe generado: ${OUTPUT_PATH}`);
  console.log(`- total eventos: ${events.length}`);
  console.log(`- eventos futuros: ${futureEvents.length}`);
  console.log(`- eventos pasados: ${pastEvents.length}`);
  console.log(`- errores geo: ${geoIssues.length}`);
  console.log(`- futuros sin descripcion suficiente: ${futureShortDescription.length}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);

  console.error(`Generacion de informe fallida: ${message}`);
  process.exitCode = 1;
});
