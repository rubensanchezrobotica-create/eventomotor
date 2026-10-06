export type ScheduleAgendaItem = {
  activity: string;
  endTime: string | null;
  sourceText: string;
  startTime: string | null;
  timeLabel: string | null;
};

export type ScheduleAgendaDay = {
  items: ScheduleAgendaItem[];
  label: string;
};

export type ScheduleAgenda = {
  days: ScheduleAgendaDay[];
  footerNote: string;
  preamble: string;
};

const WEEKDAY = "(?:lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)";
const DAY_NUMBER = "(?:\\s+\\d{1,2}(?:/\\d{1,2})?)?";
const MONTH_AND_YEAR = "(?:\\s+de\\s+[\\p{L}]+(?:\\s+de\\s+\\d{4})?)?";
const DAY_REFERENCE = `${WEEKDAY}${DAY_NUMBER}${MONTH_AND_YEAR}`;
const DAY_LABEL = `${DAY_REFERENCE}(?:\\s+y\\s+${DAY_REFERENCE})?`;
const DAY_HEADER = new RegExp(
  `(^|\\n+|(?<=\\.)\\s+)(?<label>${DAY_LABEL})(?::[ \\t]*|[ \\t]*(?=\\n))`,
  "gimu",
);
const CLOCK = "(?:[01]?\\d|2[0-3]):[0-5]\\d";
const CLOCK_GLOBAL = new RegExp(`\\b${CLOCK}\\b`, "g");
const CLOCK_LIKE_GLOBAL = /\b\d{1,2}:\d{2}\b/g;
const RANGE = new RegExp(
  `\\b(?:de\\s+)?(?<start>${CLOCK})\\s*(?:a|[-–—])\\s*(?<end>${CLOCK})\\b`,
  "iu",
);
const SINGLE_WITH_PREFIX = new RegExp(`\\ba\\s+las\\s+(?<time>${CLOCK})\\b`, "iu");
const SINGLE = new RegExp(`\\b(?<time>${CLOCK})\\b`, "u");
const FOOTER_NOTE = /^(?:programa\s+sujeto|horario\s+oficial|horarios\s+(?:sujetos|provisionales)|estos\s+son\s+horarios|horas\s+(?:locales|previstas)|confirmar\b|consultar\b|el\s+reglamento\b|la\s+fuente\b|no\s+se\s+ha\b)/iu;

function cleanStructuralPunctuation(value: string) {
  return value
    .replace(/^\s*[-–—·,.:]+\s*/u, "")
    .replace(/\s*[-–—·,.:]+\s*$/u, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function validClockCount(value: string) {
  return [...value.matchAll(CLOCK_GLOBAL)].length;
}

function hasMalformedClock(value: string) {
  const clockLike = [...value.matchAll(CLOCK_LIKE_GLOBAL)].map(([match]) => match);
  const valid = [...value.matchAll(CLOCK_GLOBAL)].map(([match]) => match);
  return clockLike.length !== valid.length;
}

function splitAtTimedBoundaries(value: string, boundary: RegExp): string[] {
  const match = boundary.exec(value);
  if (!match || match.index === undefined) return [value.trim()];
  const left = value.slice(0, match.index).trim();
  const right = value.slice(match.index + match[0].length).trim();
  if (!left || !right || validClockCount(left) === 0 || validClockCount(right) === 0) {
    return [value.trim()];
  }
  return [
    ...splitAtTimedBoundaries(left, new RegExp(boundary.source, boundary.flags)),
    ...splitAtTimedBoundaries(right, new RegExp(boundary.source, boundary.flags)),
  ];
}

function splitActivityParagraph(paragraph: string) {
  const semicolonParts = paragraph.split(/;\s*/u).map((part) => part.trim()).filter(Boolean);
  return semicolonParts.flatMap((part) => {
    const sentenceParts = splitAtTimedBoundaries(part, /(?<=\.)\s+/u);
    return sentenceParts.flatMap((sentence) => (
      splitAtTimedBoundaries(sentence, /\s+y\s+/iu)
        .flatMap((joined) => splitAtTimedBoundaries(
          joined,
          new RegExp(`,\\s+(?=[^,;]{1,80}\\b(?:a\\s+las\\s+)?${CLOCK}\\b)`, "iu"),
        ))
    ));
  });
}

function parseAgendaItem(value: string): ScheduleAgendaItem | null {
  const sourceText = value.trim();
  if (!sourceText || hasMalformedClock(sourceText)) return null;

  const clockCount = validClockCount(sourceText);
  if (clockCount > 2) return null;

  if (clockCount === 2) {
    const range = RANGE.exec(sourceText);
    if (!range?.groups?.start || !range.groups.end) return null;
    const activity = cleanStructuralPunctuation(
      `${sourceText.slice(0, range.index)} ${sourceText.slice(range.index + range[0].length)}`,
    );
    if (!activity) return null;
    return {
      activity,
      endTime: range.groups.end,
      sourceText,
      startTime: range.groups.start,
      timeLabel: `${range.groups.start}–${range.groups.end}`,
    };
  }

  if (clockCount === 1) {
    const match = SINGLE_WITH_PREFIX.exec(sourceText) ?? SINGLE.exec(sourceText);
    const time = match?.groups?.time;
    if (!match || !time) return null;
    const activity = cleanStructuralPunctuation(
      `${sourceText.slice(0, match.index)} ${sourceText.slice(match.index + match[0].length)}`,
    );
    if (!activity) return null;
    return {
      activity,
      endTime: null,
      sourceText,
      startTime: time,
      timeLabel: time,
    };
  }

  const activity = cleanStructuralPunctuation(sourceText);
  if (!activity) return null;
  return {
    activity,
    endTime: null,
    sourceText,
    startTime: null,
    timeLabel: null,
  };
}

function parseDayItems(value: string) {
  const paragraphs = value.split(/\n\s*\n/u).map((part) => part.trim()).filter(Boolean);
  const sourceItems = paragraphs.flatMap((paragraph) => {
    if (paragraph.includes("\n")) {
      return paragraph.split(/\n+/u).map((line) => line.trim()).filter(Boolean);
    }
    return splitActivityParagraph(paragraph);
  });
  if (!sourceItems.length) return null;
  const items = sourceItems.map(parseAgendaItem);
  return items.every((item): item is ScheduleAgendaItem => item !== null) ? items : null;
}

function extractFooter(value: string) {
  const paragraphs = value.split(/\n\s*\n/u).map((part) => part.trim()).filter(Boolean);
  const footer: string[] = [];
  while (paragraphs.length > 1 && FOOTER_NOTE.test(paragraphs.at(-1) || "")) {
    footer.unshift(paragraphs.pop() || "");
  }
  return {
    body: paragraphs.join("\n\n"),
    footerNote: footer.join("\n\n"),
  };
}

export function parseScheduleAgenda(value: string | null | undefined): ScheduleAgenda | null {
  const source = value?.replace(/\r\n?/g, "\n").trim() || "";
  if (!source) return null;

  const matches = [...source.matchAll(DAY_HEADER)];
  if (!matches.length) return null;

  const preamble = source.slice(0, matches[0].index).trim();
  const days: ScheduleAgendaDay[] = [];
  let footerNote = "";

  for (const [index, match] of matches.entries()) {
    const label = match.groups?.label?.trim() || "";
    const contentStart = (match.index || 0) + match[0].length;
    const contentEnd = index + 1 < matches.length ? matches[index + 1].index : source.length;
    let body = source.slice(contentStart, contentEnd).trim();
    if (!label || !body) return null;

    if (index === matches.length - 1) {
      const extracted = extractFooter(body);
      body = extracted.body;
      footerNote = extracted.footerNote;
    }

    const items = parseDayItems(body);
    if (!items) return null;
    days.push({ items, label });
  }

  return days.length ? { days, footerNote, preamble } : null;
}
