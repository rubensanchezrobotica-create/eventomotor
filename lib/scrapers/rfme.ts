import type { RawEvent } from "@/lib/scrapers/types";

const RFME_CALENDAR_URL = "https://rfme.com/calendario-campeonatos/";
const RFME_SOURCE = "RFME";
const RFME_SOURCE_ID = "rfme";

const MONTHS: Record<string, string> = {
  enero: "01",
  febrero: "02",
  marzo: "03",
  abril: "04",
  mayo: "05",
  junio: "06",
  julio: "07",
  agosto: "08",
  septiembre: "09",
  setiembre: "09",
  octubre: "10",
  noviembre: "11",
  diciembre: "12",
};

const DISCIPLINES = [
  ["motocross", "Motocross"],
  ["superbike", "Superbike"],
  ["velocidad", "Velocidad"],
  ["minivelocidad", "MiniVelocidad"],
  ["trial", "Trial"],
  ["enduro", "Enduro"],
  ["hard enduro", "Hard Enduro"],
  ["rally", "Rally"],
  ["cross country", "Cross Country"],
  ["mototurismo", "Mototurismo"],
  ["supermoto", "Supermoto"],
  ["moto4", "Moto4"],
  ["moto5", "Moto5"],
  ["mx", "Motocross"],
] as const;

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#039;|&apos;/gi, "'")
    .replace(/&ntilde;/gi, "ñ")
    .replace(/&Ntilde;/g, "Ñ")
    .replace(/&aacute;/gi, "á")
    .replace(/&eacute;/gi, "é")
    .replace(/&iacute;/gi, "í")
    .replace(/&oacute;/gi, "ó")
    .replace(/&uacute;/gi, "ú")
    .replace(/&Aacute;/g, "Á")
    .replace(/&Eacute;/g, "É")
    .replace(/&Iacute;/g, "Í")
    .replace(/&Oacute;/g, "Ó")
    .replace(/&Uacute;/g, "Ú");
}

export function cleanText(value: string) {
  return decodeHtmlEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<(br|\/p|\/div|\/li|\/tr|\/h[1-6])\b[^>]*>/gi, "\n")
    .replace(/<\/t[dh]>/gi, " | ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s*\|\s*/g, " | ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function toIsoDate(year: string, month: string, day: string) {
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export function parseSpanishDate(value: string) {
  const text = cleanText(value).toLowerCase();
  const numericDate = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2})\b/);

  if (numericDate) {
    return toIsoDate(numericDate[3], numericDate[2], numericDate[1]);
  }

  const longDate = text.match(
    /\b(\d{1,2})(?:\s*(?:de)?\s+|\s*[-/]\s*)(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(?:\s*(?:de)?\s+|\s+)(20\d{2})\b/,
  );

  if (longDate) {
    return toIsoDate(longDate[3], MONTHS[longDate[2]], longDate[1]);
  }

  return null;
}

function parseSpanishDateRange(value: string) {
  const text = cleanText(value).toLowerCase();
  const numericRange = text.match(
    /\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2})\s*(?:-|al|a)\s*(\d{1,2})[/-](\d{1,2})[/-](20\d{2})\b/,
  );

  if (numericRange) {
    return {
      start: toIsoDate(numericRange[3], numericRange[2], numericRange[1]),
      end: toIsoDate(numericRange[6], numericRange[5], numericRange[4]),
    };
  }

  const sameMonthRange = text.match(
    /\b(\d{1,2})\s*(?:-|al|a|y)\s*(\d{1,2})\s*(?:de)?\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\s*(?:de)?\s+(20\d{2})\b/,
  );

  if (sameMonthRange) {
    return {
      start: toIsoDate(sameMonthRange[4], MONTHS[sameMonthRange[3]], sameMonthRange[1]),
      end: toIsoDate(sameMonthRange[4], MONTHS[sameMonthRange[3]], sameMonthRange[2]),
    };
  }

  const start = parseSpanishDate(text);

  return start ? { start, end: start } : null;
}

export function normalizeDisciplineFromText(value: string) {
  const text = cleanText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const match = DISCIPLINES.find(([needle]) => text.includes(needle));

  return match?.[1] || "Motociclismo";
}

function hasDateSignal(value: string) {
  return Boolean(parseSpanishDate(value));
}

function hasEventSignal(value: string) {
  const text = cleanText(value).toLowerCase();

  return /\b(campeonato|copa|trofeo|prueba|rfme|motocross|enduro|trial|superbike|velocidad|supermoto)\b/.test(
    text,
  );
}

function extractCandidateBlocks(html: string) {
  const candidates = new Set<string>();
  const blockPatterns = [
    /<tr\b[\s\S]*?<\/tr>/gi,
    /<li\b[\s\S]*?<\/li>/gi,
    /<article\b[\s\S]*?<\/article>/gi,
    /<div\b[^>]*(?:event|calendar|calendario|campeonato|prueba)[^>]*>[\s\S]*?<\/div>/gi,
  ];

  for (const pattern of blockPatterns) {
    for (const match of html.matchAll(pattern)) {
      const text = cleanText(match[0]);

      if (hasDateSignal(text) && hasEventSignal(text)) {
        candidates.add(text);
      }
    }
  }

  const lines = cleanText(html)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (hasDateSignal(line) && hasEventSignal(line)) {
      candidates.add(line);
    }
  }

  return [...candidates];
}

function stripDateText(value: string) {
  return value
    .replace(/\b\d{1,2}[/-]\d{1,2}[/-]20\d{2}\b/g, " ")
    .replace(
      /\b\d{1,2}\s*(?:-|al|a|y)?\s*\d{0,2}\s*(?:de)?\s*(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\s*(?:de)?\s*20\d{2}\b/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

function pickTitle(parts: string[], fallback: string) {
  return (
    parts.find((part) => hasEventSignal(part) && !hasDateSignal(part)) ||
    stripDateText(fallback).split(" | ").find(Boolean) ||
    "Evento RFME"
  );
}

function parseCandidateBlock(block: string): RawEvent | null {
  const dates = parseSpanishDateRange(block);

  if (!dates) {
    return null;
  }

  const parts = block
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
  const title = pickTitle(parts, block);
  const location = parts.find((part) => !hasDateSignal(part) && !hasEventSignal(part));
  const discipline = normalizeDisciplineFromText(block);

  return {
    title,
    championship: title,
    discipline,
    start: dates.start,
    end: dates.end,
    venue: location,
    province: location,
    level: "Nacional",
    source: RFME_SOURCE,
    sourceId: RFME_SOURCE_ID,
    sourceUrl: RFME_CALENDAR_URL,
    ticketUrl: "",
    tags: [discipline, RFME_SOURCE],
    featured: false,
  };
}

export async function scrapeRfmeEvents(): Promise<RawEvent[]> {
  try {
    const response = await fetch(RFME_CALENDAR_URL, {
      headers: {
        accept: "text/html",
        "user-agent": "EventoMotor sync bot (+https://eventomotor.local)",
      },
      next: { revalidate: 60 * 60 },
    });

    if (!response.ok) {
      console.error(`RFME scraper failed: ${response.status} ${response.statusText}`);
      return [];
    }

    const html = await response.text();
    const candidates = extractCandidateBlocks(html);
    const events = candidates
      .map(parseCandidateBlock)
      .filter((event): event is RawEvent => Boolean(event));

    if (!events.length) {
      console.warn(
        "RFME scraper did not find reliable event blocks in calendario-campeonatos HTML.",
      );
    }

    return events;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`RFME scraper error: ${message}`);
    return [];
  }
}
