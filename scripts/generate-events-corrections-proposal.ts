import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Confidence = "high" | "medium" | "low";
type IssueType = "location" | "slug" | "title" | "source" | "description";

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
    posibles_errores_provincia_municipio: GeoIssue[];
  };
  events: EventExportRow[];
};

type Proposal = {
  id: string;
  slug: string | null;
  title: string;
  issue_type: IssueType;
  current: Record<string, unknown>;
  proposed: Record<string, unknown>;
  confidence: Confidence;
  reason: string;
  apply_recommended: boolean;
};

const EXPORT_DATE = "2026-07-06";
const INPUT_PATH = path.join(process.cwd(), "data", "exports", `events-current-${EXPORT_DATE}.json`);
const JSON_OUTPUT_PATH = path.join(process.cwd(), "data", "exports", `events-corrections-proposal-${EXPORT_DATE}.json`);
const MD_OUTPUT_PATH = path.join(process.cwd(), "data", "exports", `events-corrections-proposal-${EXPORT_DATE}.md`);
const SHORT_DESCRIPTION_LENGTH = 80;
const DESCRIPTION_PRIORITY_LIMIT = 30;

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

const DOMAIN_SOURCE_NAMES: Record<string, string> = {
  "rfme.com": "Real Federacion Motociclista Espanola",
  "fedemoto.info": "Real Federacion Motociclista Espanola",
  "f1.com": "Formula 1",
  "motogp.com": "MotoGP",
  "worldsbk.com": "WorldSBK",
  "circuitricardotormo.com": "Circuit Ricardo Tormo",
  "circuitcat.com": "Circuit de Barcelona-Catalunya",
  "circuitodejerez.com": "Circuito de Jerez",
  "motorlandaragon.com": "MotorLand Aragon",
};

const KNOWN_LOCATION_HINTS: Array<{
  pattern: RegExp;
  city: string;
  province: string;
  country?: string;
  confidence: Confidence;
  reason: string;
}> = [
  {
    pattern: /\bestoril\b/i,
    city: "Estoril",
    province: "Lisboa",
    country: "PT",
    confidence: "medium",
    reason: "El texto contiene Estoril, que no encaja con una provincia espanola.",
  },
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

function uniqueByKey<T>(items: T[], getKey: (item: T) => string) {
  const seen = new Set<string>();
  const unique: T[] = [];

  for (const item of items) {
    const key = getKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }

  return unique;
}

function markdownTable(headers: string[], rows: Array<Array<string | number | boolean | null | undefined>>) {
  const escapeCell = (value: string | number | boolean | null | undefined) => {
    return String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
  };

  if (!rows.length) return "_Sin propuestas._";

  return [
    `| ${headers.map(escapeCell).join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map(escapeCell).join(" | ")} |`),
  ].join("\n");
}

function addProposal(proposals: Proposal[], proposal: Omit<Proposal, "apply_recommended">) {
  proposals.push({
    ...proposal,
    apply_recommended: proposal.confidence === "high",
  });
}

function findLocationHint(event: EventExportRow) {
  const text = [event.title, event.slug, event.venue, event.city, event.province, event.source_url]
    .filter(Boolean)
    .join(" ");

  return KNOWN_LOCATION_HINTS.find((hint) => hint.pattern.test(text));
}

function proposeMissingLocations(events: EventExportRow[], proposals: Proposal[]) {
  for (const event of events) {
    const missingCity = isMissingOrPlaceholder(event.city);
    const missingProvince = isMissingOrPlaceholder(event.province);

    if (!missingCity && !missingProvince) continue;

    const hint = findLocationHint(event);
    const proposed: Record<string, unknown> = {};

    if (hint && missingCity) proposed.city = hint.city;
    if (hint && missingProvince) proposed.province = hint.province;
    if (hint?.country && event.country !== hint.country) proposed.country = hint.country;

    addProposal(proposals, {
      id: event.id,
      slug: event.slug,
      title: event.title,
      issue_type: "location",
      current: {
        city: event.city,
        province: event.province,
        country: event.country,
        source_url: event.source_url,
      },
      proposed,
      confidence: hint ? hint.confidence : "low",
      reason: hint
        ? hint.reason
        : "Ciudad o provincia ausente/placeholder; no hay datos suficientes en el export para deducir una correccion segura.",
    });
  }
}

function proposeGeoIssues(exportFile: ExportFile, proposals: Proposal[]) {
  const eventsById = new Map(exportFile.events.map((event) => [event.id, event]));
  const uniqueIssues = uniqueByKey(
    exportFile.summary.posibles_errores_provincia_municipio,
    (issue) => `${issue.id}|${issue.reason}|${issue.expected_province || ""}`,
  );

  for (const issue of uniqueIssues) {
    const event = eventsById.get(issue.id);
    if (!event) continue;

    if (isMissingOrPlaceholder(issue.city) || isMissingOrPlaceholder(issue.province)) {
      continue;
    }

    const hint = findLocationHint(event);
    const proposed: Record<string, unknown> = {};
    let confidence: Confidence = "low";
    let reason = issue.reason;

    if (issue.expected_province) {
      proposed.province = issue.expected_province;
      confidence = "high";
      reason = `${issue.reason}. El export ya incluye expected_province.`;
    } else if (hint) {
      proposed.city = hint.city;
      proposed.province = hint.province;
      if (hint.country) proposed.country = hint.country;
      confidence = hint.confidence;
      reason = `${issue.reason}. ${hint.reason}`;
    }

    addProposal(proposals, {
      id: event.id,
      slug: event.slug,
      title: event.title,
      issue_type: "location",
      current: {
        city: issue.city,
        province: issue.province,
        country: event.country,
      },
      proposed,
      confidence,
      reason,
    });
  }
}

function parseDateSuffix(slug: string) {
  const match = slug.match(/-(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  return {
    year: match[1],
    suffix: `${match[1]}-${match[2]}-${match[3]}`,
    body: slug.slice(0, -match[0].length),
  };
}

function removeConsecutiveDuplicateTokens(slug: string) {
  const parts = slug.split("-").filter(Boolean);
  const cleaned: string[] = [];

  for (const part of parts) {
    if (cleaned[cleaned.length - 1] === part) continue;
    cleaned.push(part);
  }

  return cleaned.join("-");
}

function slugProposalFor(event: EventExportRow) {
  const slug = event.slug || "";
  if (!slug) return null;

  const dateSuffix = parseDateSuffix(slug);

  if (dateSuffix?.body.endsWith(`-${dateSuffix.year}`)) {
    return {
      slug: `${dateSuffix.body.slice(0, -(dateSuffix.year.length + 1))}-${dateSuffix.suffix}`,
      rule: "Se elimina el ano duplicado justo antes del sufijo YYYY-MM-DD.",
      confidence: "high" as Confidence,
    };
  }

  const bodyToClean = dateSuffix?.body || slug;
  const cleanBody = removeConsecutiveDuplicateTokens(bodyToClean);
  if (cleanBody !== bodyToClean) {
    return {
      slug: dateSuffix ? `${cleanBody}-${dateSuffix.suffix}` : cleanBody,
      rule: "Se eliminan tokens consecutivos repetidos en el cuerpo del slug, preservando el sufijo YYYY-MM-DD.",
      confidence: "high" as Confidence,
    };
  }

  return null;
}

function hasRepetitiveSlug(event: EventExportRow) {
  const parts = (event.slug || "").split("-").filter(Boolean);
  const repeatedParts = parts.filter((part, index) => parts.indexOf(part) !== index);

  return repeatedParts.length >= 2;
}

function proposeSlugs(events: EventExportRow[], proposals: Proposal[]) {
  for (const event of events) {
    if (!hasRepetitiveSlug(event)) continue;

    const proposal = slugProposalFor(event);

    addProposal(proposals, {
      id: event.id,
      slug: event.slug,
      title: event.title,
      issue_type: "slug",
      current: {
        slug: event.slug,
      },
      proposed: {
        slug: proposal?.slug || null,
        rules_used: proposal?.rule || "Slug repetitivo detectado, pero no hay transformacion mecanica segura.",
      },
      confidence: proposal?.confidence || "low",
      reason: proposal?.rule || "El slug contiene terminos repetidos no consecutivos; requiere revision manual.",
    });
  }
}

function removeTrailingYearFromTitle(title: string, year: string) {
  return title
    .replace(new RegExp(`\\s*[\\-–—:]?\\s*${year}\\s*$`), "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function titleHasDuplicatedYearSignal(event: EventExportRow) {
  const year = event.start_date.slice(0, 4);
  const normalizedTitle = normalizeComparable(event.title);

  return Boolean(year && normalizedTitle.includes(year) && (event.slug || "").includes(year));
}

function titleLooksGeneric(title: string) {
  return title.trim().length < 18 || GENERIC_TITLE_PATTERNS.some((pattern) => pattern.test(title.trim()));
}

function proposeTitles(events: EventExportRow[], proposals: Proposal[]) {
  for (const event of events) {
    const year = event.start_date.slice(0, 4);
    const titleProposal = removeTrailingYearFromTitle(event.title, year);
    const duplicatedYear = titleHasDuplicatedYearSignal(event);
    const genericTitle = titleLooksGeneric(event.title);

    if (!duplicatedYear && !genericTitle) continue;

    addProposal(proposals, {
      id: event.id,
      slug: event.slug,
      title: event.title,
      issue_type: "title",
      current: {
        title: event.title,
        slug: event.slug,
      },
      proposed: {
        title: duplicatedYear && titleProposal !== event.title ? titleProposal : null,
        slug: null,
      },
      confidence: duplicatedYear && titleProposal !== event.title && !genericTitle ? "medium" : "low",
      reason: duplicatedYear
        ? "El ano del evento aparece en el titulo y ya queda representado por la fecha del evento/slug; revisar si el ano forma parte del nombre oficial."
        : "Titulo demasiado corto o generico; no se puede deducir un titulo mejor sin fuente externa.",
    });
  }
}

function sourceIsGeneric(sourceName: string | null | undefined) {
  const source = normalizeComparable(sourceName);

  return !source || GENERIC_SOURCE_PATTERNS.some((pattern) => source.includes(normalizeComparable(pattern)));
}

function hostnameFromUrl(value: string | null | undefined) {
  if (!value) return null;

  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function titleCaseDomain(hostname: string) {
  const domain = hostname.split(".")[0] || hostname;

  return domain
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function sourceNameFromUrl(sourceUrl: string | null | undefined) {
  const hostname = hostnameFromUrl(sourceUrl);
  if (!hostname) return null;

  return DOMAIN_SOURCE_NAMES[hostname] || titleCaseDomain(hostname);
}

function proposeSources(events: EventExportRow[], proposals: Proposal[]) {
  for (const event of events) {
    if (!sourceIsGeneric(event.source_name)) continue;

    const proposedSourceName = sourceNameFromUrl(event.source_url);
    const hostname = hostnameFromUrl(event.source_url);
    const isKnownDomain = Boolean(hostname && DOMAIN_SOURCE_NAMES[hostname]);

    addProposal(proposals, {
      id: event.id,
      slug: event.slug,
      title: event.title,
      issue_type: "source",
      current: {
        source_name: event.source_name,
        source_url: event.source_url,
      },
      proposed: {
        source_name: proposedSourceName,
      },
      confidence: proposedSourceName ? (isKnownDomain ? "high" : "medium") : "low",
      reason: proposedSourceName
        ? "source_name es generico; se propone un nombre mas limpio derivado del dominio de source_url."
        : "source_name es generico, pero source_url no permite deducir un nombre fiable.",
    });
  }
}

function proposeDescriptionPriorities(events: EventExportRow[], proposals: Proposal[]) {
  const candidates = events
    .filter((event) => event.start_date >= EXPORT_DATE)
    .filter((event) => !event.description || event.description.trim().length < SHORT_DESCRIPTION_LENGTH)
    .sort((left, right) => left.start_date.localeCompare(right.start_date))
    .slice(0, DESCRIPTION_PRIORITY_LIMIT);

  for (const event of candidates) {
    addProposal(proposals, {
      id: event.id,
      slug: event.slug,
      title: event.title,
      issue_type: "description",
      current: {
        description_length: event.description?.trim().length || 0,
        start_date: event.start_date,
        source_url: event.source_url,
      },
      proposed: {
        action: "enrich_description_manually",
      },
      confidence: "low",
      reason: "Evento futuro prioritario sin descripcion suficiente; no se propone texto hasta revisar la fuente oficial.",
    });
  }
}

function buildSummary(proposals: Proposal[]) {
  const byType: Record<IssueType, number> = {
    location: 0,
    slug: 0,
    title: 0,
    source: 0,
    description: 0,
  };
  const byConfidence: Record<Confidence, number> = {
    high: 0,
    medium: 0,
    low: 0,
  };

  for (const proposal of proposals) {
    byType[proposal.issue_type] += 1;
    byConfidence[proposal.confidence] += 1;
  }

  return {
    generated_at: new Date().toISOString(),
    source_export: INPUT_PATH,
    total_proposals: proposals.length,
    apply_recommended_true: proposals.filter((proposal) => proposal.apply_recommended).length,
    by_type: byType,
    by_confidence: byConfidence,
  };
}

function proposalsTable(proposals: Proposal[], type: IssueType, limit = 80) {
  return markdownTable(
    ["id", "title", "current", "proposed", "confidence", "apply", "reason"],
    proposals
      .filter((proposal) => proposal.issue_type === type)
      .slice(0, limit)
      .map((proposal) => [
        proposal.id,
        proposal.title,
        JSON.stringify(proposal.current),
        JSON.stringify(proposal.proposed),
        proposal.confidence,
        proposal.apply_recommended,
        proposal.reason,
      ]),
  );
}

function buildMarkdown(summary: ReturnType<typeof buildSummary>, proposals: Proposal[]) {
  return [
    `# Propuesta de correcciones de calidad (${EXPORT_DATE})`,
    "",
    "Este archivo es una propuesta local de revision. No aplica cambios en Supabase ni modifica eventos reales.",
    "",
    "## Resumen",
    "",
    markdownTable(
      ["Metrica", "Valor"],
      [
        ["Total propuestas", summary.total_proposals],
        ["apply_recommended=true", summary.apply_recommended_true],
        ["Location", summary.by_type.location],
        ["Slug", summary.by_type.slug],
        ["Title", summary.by_type.title],
        ["Source", summary.by_type.source],
        ["Description", summary.by_type.description],
        ["High confidence", summary.by_confidence.high],
        ["Medium confidence", summary.by_confidence.medium],
        ["Low confidence", summary.by_confidence.low],
      ],
    ),
    "",
    "## 1. Eventos sin ciudad/provincia y errores de ubicacion",
    "",
    proposalsTable(proposals, "location"),
    "",
    "## 2. Slugs repetitivos o feos",
    "",
    proposalsTable(proposals, "slug"),
    "",
    "## 3. Titulos con ano repetido o genericos",
    "",
    proposalsTable(proposals, "title"),
    "",
    "## 4. Fuentes genericas",
    "",
    proposalsTable(proposals, "source"),
    "",
    "## 5. Eventos futuros prioritarios para enriquecer descripcion",
    "",
    "No se propone texto de descripcion todavia; solo se listan candidatos para investigacion manual.",
    "",
    proposalsTable(proposals, "description"),
    "",
  ].join("\n");
}

async function main() {
  const exportFile = JSON.parse(await readFile(INPUT_PATH, "utf8")) as ExportFile;
  const proposals: Proposal[] = [];

  proposeMissingLocations(exportFile.events, proposals);
  proposeGeoIssues(exportFile, proposals);
  proposeSlugs(exportFile.events, proposals);
  proposeTitles(exportFile.events, proposals);
  proposeSources(exportFile.events, proposals);
  proposeDescriptionPriorities(exportFile.events, proposals);

  const summary = buildSummary(proposals);
  const output = {
    summary,
    proposals,
  };

  await writeFile(JSON_OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  await writeFile(MD_OUTPUT_PATH, buildMarkdown(summary, proposals), "utf8");

  console.log(`Propuesta JSON: ${JSON_OUTPUT_PATH}`);
  console.log(`Propuesta Markdown: ${MD_OUTPUT_PATH}`);
  console.log(`- total propuestas: ${summary.total_proposals}`);
  console.log(`- location: ${summary.by_type.location}`);
  console.log(`- slug: ${summary.by_type.slug}`);
  console.log(`- title: ${summary.by_type.title}`);
  console.log(`- source: ${summary.by_type.source}`);
  console.log(`- description: ${summary.by_type.description}`);
  console.log(`- high/medium/low: ${summary.by_confidence.high}/${summary.by_confidence.medium}/${summary.by_confidence.low}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);

  console.error(`Generacion de propuesta fallida: ${message}`);
  process.exitCode = 1;
});
