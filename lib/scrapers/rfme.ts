import type { RawEvent } from "@/lib/scrapers/types";

type RfmeChampionshipPage = {
  url: string;
  championship: string;
  discipline: string;
};

const RFME_SOURCE = "RFME";
const RFME_SOURCE_ID = "rfme";

const RFME_CHAMPIONSHIP_PAGES: RfmeChampionshipPage[] = [
  {
    url: "https://rfme.com/campeonatos/campeonato-de-espana-de-superbike/",
    championship: "Campeonato de España de Superbike",
    discipline: "Superbike",
  },
  {
    url: "https://rfme.com/campeonatos/campeonato-de-espana-de-motocross/",
    championship: "Campeonato de España de Motocross",
    discipline: "Motocross",
  },
  {
    url: "https://rfme.com/campeonatos/copa-de-espana-de-velocidad/",
    championship: "Copa de España de Velocidad",
    discipline: "Velocidad",
  },
  {
    url: "https://rfme.com/campeonatos/campeonato-de-espana-de-trial/",
    championship: "Campeonato de España de Trial",
    discipline: "Trial",
  },
  {
    url: "https://rfme.com/campeonatos/campeonato-de-espana-de-enduro/",
    championship: "Campeonato de España de Enduro",
    discipline: "Enduro",
  },
  {
    url: "https://rfme.com/campeonatos/copa-de-espana-de-minivelocidad/",
    championship: "Copa de España de MiniVelocidad",
    discipline: "MiniVelocidad",
  },
  {
    url: "https://rfme.com/campeonatos/copa-de-espana-de-mototurismo/",
    championship: "Copa de España de Mototurismo",
    discipline: "Mototurismo",
  },
];

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
  ["hard enduro", "Hard Enduro"],
  ["cross country", "Cross Country"],
  ["mini velocidad", "MiniVelocidad"],
  ["minivelocidad", "MiniVelocidad"],
  ["mototurismo", "Mototurismo"],
  ["motocross", "Motocross"],
  ["superbike", "Superbike"],
  ["supermoto", "Supermoto"],
  ["velocidad", "Velocidad"],
  ["enduro", "Enduro"],
  ["trial", "Trial"],
  ["rally", "Rally"],
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
    .replace(/&ndash;|&mdash;/gi, "-")
    .replace(/&[a-z]+;/gi, " ");
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

function normalizeForSearch(value: string) {
  return cleanText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
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
      rest: text.slice(numericRange.index! + numericRange[0].length).trim(),
    };
  }

  const sameMonthRange = text.match(
    /\b(\d{1,2})\s*(?:-|al|a|y)\s*(\d{1,2})\s*(?:de)?\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\s*(?:de)?\s+(20\d{2})\b/,
  );

  if (sameMonthRange) {
    return {
      start: toIsoDate(sameMonthRange[4], MONTHS[sameMonthRange[3]], sameMonthRange[1]),
      end: toIsoDate(sameMonthRange[4], MONTHS[sameMonthRange[3]], sameMonthRange[2]),
      rest: text.slice(sameMonthRange.index! + sameMonthRange[0].length).trim(),
    };
  }

  const numericDate = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2})\b/);

  if (numericDate) {
    const date = toIsoDate(numericDate[3], numericDate[2], numericDate[1]);

    return {
      start: date,
      end: date,
      rest: text.slice(numericDate.index! + numericDate[0].length).trim(),
    };
  }

  const start = parseSpanishDate(text);

  return start ? { start, end: start, rest: "" } : null;
}

export function normalizeDisciplineFromText(value: string) {
  const text = normalizeForSearch(value);
  const match = DISCIPLINES.find(([needle]) => text.includes(needle));

  return match?.[1] || "Motociclismo";
}

function getCalendarLines(html: string) {
  const lines = cleanText(html)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const calendarStart = lines.findIndex((line) => normalizeForSearch(line) === "calendario");

  if (calendarStart === -1) {
    return [];
  }

  const stopIndex = lines.findIndex((line, index) => {
    if (index <= calendarStart) {
      return false;
    }

    const normalized = normalizeForSearch(line);

    return /^(archivos|documentos|resultados|clasificaciones|reglas|informacion)/.test(normalized);
  });

  return lines.slice(calendarStart + 1, stopIndex === -1 ? undefined : stopIndex);
}

function removeLeadingDiscipline(value: string, discipline: string) {
  const normalizedDiscipline = discipline.replace(/([.*+?^${}()|\[\]\\])/g, "\\$1");

  return value
    .replace(new RegExp(`^${normalizedDiscipline}\\b`, "i"), "")
    .replace(/^\s*\([A-Z]{2,3}\)\s*/i, "")
    .replace(/^\s*-\s*/, "")
    .trim();
}

function normalizeTitle(value: string) {
  return value
    .replace(/\s+/g, " ")
    .replace(/\s+-\s+/g, " - ")
    .trim();
}

function extractVenue(value: string) {
  const text = normalizeTitle(value);
  const parts = text.split(" - ").map((part) => part.trim()).filter(Boolean);

  if (parts.length > 1) {
    return parts.at(-1);
  }

  return text || undefined;
}

function parseCalendarLine(line: string, page: RfmeChampionshipPage): RawEvent | null {
  const dates = parseSpanishDateRange(line);

  if (!dates || !dates.rest) {
    return null;
  }

  const inferredDiscipline = normalizeDisciplineFromText(`${page.discipline} ${dates.rest}`);
  const discipline = inferredDiscipline === "Motociclismo" ? page.discipline : inferredDiscipline;
  const eventText = normalizeTitle(removeLeadingDiscipline(dates.rest, discipline));

  if (!eventText || /^fecha\s+disciplina\s+prueba/i.test(eventText)) {
    return null;
  }

  const venue = extractVenue(eventText);
  const title = eventText.toLowerCase().includes(page.championship.toLowerCase())
    ? eventText
    : `${page.championship} - ${eventText}`;

  return {
    title,
    championship: page.championship,
    discipline,
    start: dates.start,
    end: dates.end,
    venue,
    province: undefined,
    level: "Nacional",
    source: RFME_SOURCE,
    sourceId: RFME_SOURCE_ID,
    sourceUrl: page.url,
    ticketUrl: "",
    tags: [discipline, RFME_SOURCE],
    featured: false,
  };
}

function dedupeRawEvents(events: RawEvent[]) {
  const seen = new Set<string>();
  const deduped: RawEvent[] = [];

  for (const event of events) {
    const key = [event.title, event.start, event.venue || ""]
      .map((value) => normalizeForSearch(value))
      .join("|");

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(event);
  }

  return deduped;
}

async function fetchChampionshipPage(page: RfmeChampionshipPage) {
  const response = await fetch(page.url, {
    headers: {
      accept: "text/html",
      "user-agent": "EventoMotor sync bot (+https://eventomotor.local)",
    },
    next: { revalidate: 60 * 60 },
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return response.text();
}

function parseChampionshipPage(html: string, page: RfmeChampionshipPage) {
  const lines = getCalendarLines(html);
  const events = lines
    .map((line) => parseCalendarLine(line, page))
    .filter((event): event is RawEvent => Boolean(event));

  if (!events.length) {
    console.warn(`RFME scraper warning: no parseable calendar events found at ${page.url}`);
  }

  return events;
}

export async function scrapeRfmeEvents(): Promise<RawEvent[]> {
  const events: RawEvent[] = [];

  for (const page of RFME_CHAMPIONSHIP_PAGES) {
    try {
      const html = await fetchChampionshipPage(page);
      events.push(...parseChampionshipPage(html, page));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`RFME scraper warning: ${page.url} skipped (${message})`);
    }
  }

  return dedupeRawEvents(events);
}
