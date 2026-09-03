import type { Confidence, DateBasis } from './models';

export interface ExtractedHistoricDate {
  evidenceText: string;
  earliestPossibleYear: number;
  latestPossibleYear: number;
  datePrecision: string;
  dateBasis: DateBasis;
  dateConfidence: Confidence;
}

interface DateCandidate extends ExtractedHistoricDate {
  index: number;
}

function centuryRange(century: number, qualifier?: string): [number, number] {
  const first = (century - 1) * 100;
  if (qualifier === 'early') return [first, first + 39];
  if (qualifier === 'mid') return [first + 30, first + 69];
  if (qualifier === 'late') return [first + 60, first + 99];
  return [first, first + 99];
}

function normaliseHistoricEnglandText(value: string): string {
  return value
    .replaceAll('\u2013', '-')
    .replaceAll('\u2014', '-')
    .replace(/\bC[lI](\d)\b/g, 'C1$1')
    .replace(/\bC[lI](\d{2})\b/g, 'C$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function expandShortYear(start: number, value?: string): number {
  if (!value) return start;
  if (value.length >= 3) return Number(value);
  const power = 10 ** value.length;
  let expanded = Math.floor(start / power) * power + Number(value);
  if (expanded < start) expanded += power;
  return expanded;
}

function candidate(
  evidenceText: string,
  earliestPossibleYear: number,
  latestPossibleYear: number,
  datePrecision: string,
  dateBasis: DateBasis,
  dateConfidence: Confidence,
  index: number,
): DateCandidate {
  return {
    evidenceText,
    earliestPossibleYear,
    latestPossibleYear,
    datePrecision,
    dateBasis,
    dateConfidence,
    index,
  };
}

function publicResult(item: DateCandidate): ExtractedHistoricDate {
  return {
    evidenceText: item.evidenceText,
    earliestPossibleYear: item.earliestPossibleYear,
    latestPossibleYear: item.latestPossibleYear,
    datePrecision: item.datePrecision,
    dateBasis: item.dateBasis,
    dateConfidence: item.dateConfidence,
  };
}

function addCenturyCandidates(text: string, candidates: DateCandidate[]): void {
  const combined =
    /\b(?:(early|mid|late)\s+)?C(\d{1,2})\s*(?:\/|\band\b|\bto\b)\s*(?:(early|mid|late)\s+)?C?(\d{1,2})\b/gi;
  const occupied: Array<[number, number]> = [];
  for (const match of text.matchAll(combined)) {
    const firstCentury = Number(match[2]);
    const secondCentury = Number(match[4]);
    if (firstCentury < 5 || firstCentury > 21 || secondCentury < 5 || secondCentury > 21)
      continue;
    const [start] = centuryRange(firstCentury, match[1]?.toLowerCase());
    const [, end] = centuryRange(secondCentury, match[3]?.toLowerCase());
    candidates.push(
      candidate(
        match[0],
        Math.min(start, end),
        Math.max(start, end),
        'century range',
        'estimated_from_authoritative_source',
        'medium',
        match.index,
      ),
    );
    occupied.push([match.index, match.index + match[0].length]);
  }

  const simple = /\b(?:(early|mid|late)\s+)?C(\d{1,2})\b/gi;
  for (const match of text.matchAll(simple)) {
    if (occupied.some(([start, end]) => match.index >= start && match.index < end)) continue;
    const century = Number(match[2]);
    if (century < 5 || century > 21) continue;
    const [start, end] = centuryRange(century, match[1]?.toLowerCase());
    candidates.push(
      candidate(
        match[0],
        start,
        end,
        match[1] ? 'part century' : 'century',
        'estimated_from_authoritative_source',
        'medium',
        match.index,
      ),
    );
  }

  const written =
    /\b(?:(early|mid|late)\s+)?(\d{1,2})(?:st|nd|rd|th)(?:\s*\/\s*(\d{1,2})(?:st|nd|rd|th)?)?(?:\s+|-)centur(?:y|ies)\b/gi;
  for (const match of text.matchAll(written)) {
    const firstCentury = Number(match[2]);
    const secondCentury = Number(match[3] ?? match[2]);
    if (firstCentury < 5 || firstCentury > 21 || secondCentury < 5 || secondCentury > 21)
      continue;
    const [start] = centuryRange(firstCentury, match[1]?.toLowerCase());
    const [, end] = centuryRange(secondCentury, match[3] ? undefined : match[1]?.toLowerCase());
    candidates.push(
      candidate(
        match[0],
        start,
        end,
        match[3] ? 'century range' : match[1] ? 'part century' : 'century',
        'estimated_from_authoritative_source',
        'medium',
        match.index,
      ),
    );
  }
}

function addExplicitYearCandidates(text: string, candidates: DateCandidate[]): void {
  const contextual =
    /\b(dated|built|erected|constructed|completed|opened|designed|founded|rebuilt|remodelled|formed)(?:\s+(?:in|by|around|circa|c\.?))?[^.!?;]{0,38}?\b((?:1[0-9]|20)\d{2})(?:\s*(?:-|to|and)\s*(\d{1,4}))?/gi;
  for (const match of text.matchAll(contextual)) {
    const start = Number(match[2]);
    const end = expandShortYear(start, match[3]);
    candidates.push(
      candidate(
        match[0],
        start,
        end,
        end === start ? 'exact year' : 'year range',
        end === start ? 'documented_construction' : 'documented_date_range',
        /\b(?:around|circa|c\.)\b/i.test(match[0]) ? 'medium' : 'high',
        match.index,
      ),
    );
  }

  const circa = /\b(?:circa|about|around(?:\s+AD)?|c\.)\s*((?:1[0-9]|20)\d{2})(?:\s*(?:-|to)\s*(\d{1,4}))?/gi;
  for (const match of text.matchAll(circa)) {
    const start = Number(match[1]);
    const end = expandShortYear(start, match[2]);
    candidates.push(
      candidate(
        match[0],
        start,
        end,
        end === start ? 'approximate year' : 'year range',
        end === start ? 'estimated_from_authoritative_source' : 'documented_date_range',
        'medium',
        match.index,
      ),
    );
  }

  const descriptiveYear = /(?:^|[.!?]\s+)((?:1[0-9]|20)\d{2})(?:\s*(?:-|to)\s*(\d{1,4}))?\s+(?:for|by)\b/gi;
  for (const match of text.matchAll(descriptiveYear)) {
    const start = Number(match[1]);
    const end = expandShortYear(start, match[2]);
    candidates.push(
      candidate(
        match[0].trim(),
        start,
        end,
        end === start ? 'exact year' : 'year range',
        end === start ? 'documented_construction' : 'documented_date_range',
        'high',
        match.index,
      ),
    );
  }

  const labelledDate = /\bDate:\s*((?:1[0-9]|20)\d{2})(?:\s*(?:-|to)\s*(\d{1,4}))?/gi;
  for (const match of text.matchAll(labelledDate)) {
    const start = Number(match[1]);
    const end = expandShortYear(start, match[2]);
    candidates.push(
      candidate(
        match[0],
        start,
        end,
        end === start ? 'exact year' : 'year range',
        end === start ? 'documented_construction' : 'documented_date_range',
        'high',
        match.index,
      ),
    );
  }

  // Many legacy entries put the construction year immediately after the grade, for example
  // "II 2. 1842. W J Donthorne, architect". The listing date occurs before the grade and is
  // therefore deliberately not matched by this pattern.
  const legacyGradeDate =
    /\b(?:II\*?|I)\s*(?:GV\s*)?(?:\d+\.\s*)?((?:1[0-9]|20)\d{2})(?:\s*(?:-|to)\s*(\d{1,4}))?[.,]/gi;
  for (const match of text.matchAll(legacyGradeDate)) {
    const start = Number(match[1]);
    const end = expandShortYear(start, match[2]);
    candidates.push(
      candidate(
        match[0],
        start,
        end,
        end === start ? 'exact year' : 'year range',
        end === start ? 'documented_construction' : 'documented_date_range',
        'high',
        match.index,
      ),
    );
  }
}

function addBcAdRangeCandidates(text: string, candidates: DateCandidate[]): void {
  const range = /\b(?:between\s+)?(?:about|around|circa|c\.?)?\s*(\d{1,4})\s*BC\s*(?:-|to|and)\s*(?:about|around|circa|c\.?)?\s*(?:(BC|AD)\s*)?(\d{1,4})\s*(BC|AD)?\b/gi;
  for (const match of text.matchAll(range)) {
    const secondEra = (match[2] ?? match[4] ?? 'BC').toUpperCase();
    const start = -Number(match[1]);
    const end = secondEra === 'BC' ? -Number(match[3]) : Number(match[3]);
    candidates.push(
      candidate(
        match[0],
        Math.min(start, end),
        Math.max(start, end),
        'archaeological date range',
        'documented_date_range',
        'high',
        match.index,
      ),
    );
  }
}

function periodCandidate(text: string): DateCandidate | undefined {
  const periods: Array<{
    pattern: RegExp;
    start: number;
    end: number;
    precision: string;
    confidence: Confidence;
  }> = [
    { pattern: /\bprehistoric\b/i, start: -10000, end: 42, precision: 'broad historic period', confidence: 'low' },
    { pattern: /\bneolithic\b/i, start: -4000, end: -2501, precision: 'archaeological period', confidence: 'medium' },
    { pattern: /\bbronze age\b/i, start: -2500, end: -801, precision: 'archaeological period', confidence: 'medium' },
    { pattern: /\biron age\b/i, start: -800, end: 42, precision: 'archaeological period', confidence: 'medium' },
    { pattern: /\b(?:romano-british|roman(?!\s+catholic))\b/i, start: 43, end: 410, precision: 'archaeological period', confidence: 'medium' },
    { pattern: /\bpre-conquest\b/i, start: 410, end: 1066, precision: 'broad historic period', confidence: 'medium' },
    { pattern: /\bearly medieval\b/i, start: 410, end: 1065, precision: 'broad historic period', confidence: 'medium' },
    { pattern: /\b(?:anglo-)?saxon\b/i, start: 410, end: 1066, precision: 'broad historic period', confidence: 'medium' },
    { pattern: /\bnorman\b/i, start: 1066, end: 1154, precision: 'broad historic period', confidence: 'medium' },
    { pattern: /\bmedieval\b/i, start: 1066, end: 1539, precision: 'broad historic period', confidence: 'medium' },
    { pattern: /\bpost-medieval\b/i, start: 1540, end: 1899, precision: 'broad historic period', confidence: 'low' },
  ];
  for (const period of periods) {
    const match = text.match(period.pattern);
    if (!match || match.index === undefined) continue;
    return candidate(
      match[0],
      period.start,
      period.end,
      period.precision,
      'estimated_from_authoritative_source',
      period.confidence,
      match.index,
    );
  }
  return undefined;
}

/**
 * Extracts the earliest dated fabric or historic component stated in an official list entry.
 * Administrative listing/amendment dates and restoration-only dates are deliberately ignored.
 */
export function extractHistoricEnglandDate(value: string): ExtractedHistoricDate | undefined {
  const text = normaliseHistoricEnglandText(value);
  if (!text) return undefined;

  // Origins and construction dates appear near the start of legacy list descriptions. Limiting
  // prose avoids treating later references, bibliographies and modern condition notes as dates.
  const context = text.slice(0, 1_200);
  const candidates: DateCandidate[] = [];
  addBcAdRangeCandidates(context, candidates);
  addCenturyCandidates(context, candidates);
  addExplicitYearCandidates(context, candidates);
  let usable = candidates.filter((item) => {
    const before = context.slice(Math.max(0, item.index - 54), item.index);
    const after = context.slice(item.index + item.evidenceText.length, item.index + item.evidenceText.length + 30);
    const nonConstructionEvent = /\b(?:excavat(?:ed|ion|ions)?|discovered|quarr(?:y|ied)|restored|repaired|altered|amended|surveyed|inspected|listed|scheduled|relocated|moved|reset|re-set|reused|removed|incorporated|new (?:stone )?base)\b/i;
    return (
      item.earliestPossibleYear <= 2026 &&
      item.latestPossibleYear >= item.earliestPossibleYear &&
      !/\b(?:restored|repair(?:ed)?|altered|extended|amended|surveyed|inspected)\b/i.test(
        item.evidenceText,
      ) &&
      !/\b(?:reset|reused|re-set|removed|incorporated)\b/i.test(
        before,
      ) &&
      !nonConstructionEvent.test(before) &&
      !new RegExp(`^[^.!?;]{0,24}${nonConstructionEvent.source}`, 'i').test(after)
    );
  });
  const firstPrimaryConstruction = usable.find((item) =>
    /\b(?:dated|built|erected|constructed|designed|founded|date:|II?\*?\s)/i.test(
      item.evidenceText,
    ),
  );
  if (firstPrimaryConstruction) {
    usable = usable.filter(
      (item) =>
        item.index <= firstPrimaryConstruction.index ||
        !/\b(?:completed|opened|formed|rebuilt|remodelled)\b/i.test(item.evidenceText),
    );
  }
  const firstIndex = Math.min(...usable.map((item) => item.index));
  const originContext = usable.filter((item) => item.index <= firstIndex + 260);
  const earliest = originContext.sort(
    (left, right) =>
      left.earliestPossibleYear - right.earliestPossibleYear || left.index - right.index,
  )[0];
  const morePreciseOverlap = earliest
    ? originContext
        .filter(
          (item) =>
            item.earliestPossibleYear === item.latestPossibleYear &&
            item.earliestPossibleYear >= earliest.earliestPossibleYear &&
            item.latestPossibleYear <= earliest.latestPossibleYear,
        )
        .sort((left, right) => left.index - right.index)[0]
    : undefined;
  const selected = morePreciseOverlap ?? earliest;
  if (selected) return publicResult(selected);

  const broadPeriod = periodCandidate(context);
  if (!broadPeriod) return undefined;
  return publicResult(broadPeriod);
}
