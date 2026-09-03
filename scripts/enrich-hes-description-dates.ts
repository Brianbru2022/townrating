import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { HeritageFeature, ProjectPackage, SourceRecord } from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';

const projectPath = resolve(process.argv[2] ?? 'data/projects/culross.json');
const reviewPath = resolve(process.argv[3] ?? 'data/review/culross-hes-date-extraction.json');
const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
const accessedAt = new Date().toISOString();

interface ExtractedDate {
  text: string;
  earliest: number;
  latest: number;
}

function decodeHtml(value: string): string {
  return value
    .replaceAll(/<[^>]+>/g, ' ')
    .replaceAll('&ndash;', '–')
    .replaceAll('&mdash;', '—')
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll(/\s+/g, ' ')
    .trim();
}

function centuryRange(century: number, qualifier?: string): [number, number] {
  const first = (century - 1) * 100;
  if (qualifier === 'early') return [first, first + 39];
  if (qualifier === 'mid') return [first + 30, first + 69];
  if (qualifier === 'late') return [first + 60, first + 99];
  return [first, first + 99];
}

function extractDate(description: string): ExtractedDate | undefined {
  const opening = description.split(/[.;]/, 1)[0].trim();
  const century = opening.match(
    /\b(?:(early|mid|late|later)\s+)?(1[2-9]|20)(?:th|st|nd|rd)(?:\s*\/\s*(1[2-9]|20)(?:th|st|nd|rd)?)?[-\s]+century\b/i,
  );
  if (century) {
    const qualifier = century[1]?.toLowerCase() === 'later' ? 'late' : century[1]?.toLowerCase();
    const [firstStart, firstEnd] = centuryRange(Number(century[2]), qualifier);
    const [, secondEnd] = century[3] ? centuryRange(Number(century[3])) : [firstStart, firstEnd];
    return { text: opening, earliest: firstStart, latest: secondEnd };
  }
  const dateRange = opening.match(
    /\b(?:c\.?|circa|about|dated)?\s*((?:1[2-9]|20)\d{2})\s*(?:-|–|to)\s*((?:1[2-9]|20)\d{2})\b/i,
  );
  if (dateRange)
    return { text: opening, earliest: Number(dateRange[1]), latest: Number(dateRange[2]) };
  const singleYear = opening.match(/\b(?:c\.?|circa|about|dated)?\s*((?:1[2-9]|20)\d{2})\b/i);
  if (singleYear) {
    const year = Number(singleYear[1]);
    return { text: opening, earliest: year, latest: year };
  }
  return undefined;
}

function descriptionFromHtml(html: string): string | undefined {
  const match = html.match(/<section id="description"[\s\S]*?<p>([\s\S]*?)<\/p>/i);
  return match ? decodeHtml(match[1]) : undefined;
}

const candidates = pkg.features.filter(
  (feature) => {
    const hasAdministrativeDate = /^date:\s*\d{4}(?:-\d{2})?$/i.test(
      feature.documentedDateText?.trim() ?? '',
    );
    const isLocalCandidate =
      feature.evidenceScope !== 'out_of_scope' &&
      !feature.tags.includes('town-selection-heritage-buffer');
    return feature.id.startsWith('hes-listed-building:') &&
      (hasAdministrativeDate ||
        (isLocalCandidate && !feature.tags.includes('date-reviewed') && !feature.documentedDateText));
  },
);
const failures: Array<{ id: string; sourceUrl?: string; reason: string }> = [];
let enriched = 0;

async function enrich(feature: HeritageFeature): Promise<void> {
  const hasAdministrativeDate = /^date:\s*\d{4}(?:-\d{2})?$/i.test(
    feature.documentedDateText?.trim() ?? '',
  );
  const shouldRemainHidden = feature.evidenceScope === 'related_context' ||
    feature.evidenceScope === 'out_of_scope' ||
    feature.tags.includes('town-selection-heritage-buffer');
  const reference =
    feature.sourceRecords.find((record) => /^LB\d+$/i.test(record.sourceRecordId ?? ''))
      ?.sourceRecordId ?? feature.id.match(/lb\d+$/i)?.[0]?.toUpperCase();
  if (!reference) {
    failures.push({ id: feature.id, reason: 'No HES LB reference found.' });
    return;
  }
  const sourceUrl = `https://portal.historicenvironment.scot/designation/${reference}`;
  try {
    const response = await fetch(sourceUrl, {
      headers: { Accept: 'text/html' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const description = descriptionFromHtml(await response.text());
    if (!description) throw new Error('No listing description paragraph found.');
    const date = extractDate(description);
    if (!date)
      throw new Error(
        'No conservative construction-period expression found in the opening description.',
      );
    const source: SourceRecord = {
      sourceName: 'Historic Environment Scotland listing description date extraction',
      sourceOrganisation: 'Historic Environment Scotland',
      sourceRecordId: reference,
      sourceUrl,
      accessedAt,
      licence:
        'Open Government Licence v3.0; retain Historic Environment Scotland attribution and source link.',
      notes:
        'The opening HES listing-description date expression was normalised automatically and remains medium-confidence pending curator review. Later alteration dates are not substituted for the earliest parsed period.',
      reliability: 'official_statutory',
    };
    Object.assign(feature, {
      documentedDateText: date.text,
      earliestPossibleYear: date.earliest,
      latestPossibleYear: date.latest,
      dateBasis: 'estimated_from_authoritative_source',
      dateConfidence: 'medium',
      sourceRecords: [
        ...feature.sourceRecords.filter((record) => record.sourceName !== source.sourceName),
        source,
      ],
      tags: [
        ...new Set([
          ...feature.tags.filter((tag) => tag !== 'map-hidden'),
          ...(shouldRemainHidden ? ['map-hidden'] : []),
          'hes-date-extracted',
          'hes-date-reviewed',
          'date-reviewed',
        ]),
      ],
      updatedAt: accessedAt,
      reviewNotes: `${feature.reviewNotes ? `${feature.reviewNotes} ` : ''}Date normalised from the opening HES listing description; curator review remains required.`,
    });
    enriched += 1;
  } catch (error) {
    if (hasAdministrativeDate) {
      Object.assign(feature, {
        documentedDateText: undefined,
        earliestPossibleYear: undefined,
        latestPossibleYear: undefined,
        datePrecision: undefined,
        dateBasis: 'unknown',
        dateConfidence: 'unknown',
        tags: [...new Set([...feature.tags, 'map-hidden', 'heritage-record-retained'])],
        updatedAt: accessedAt,
        reviewNotes: `${feature.reviewNotes ? `${feature.reviewNotes} ` : ''}The imported HES listing administration date was removed; no defensible construction date was extracted, so the retained record remains hidden from the heat map.`,
      });
    }
    failures.push({
      id: feature.id,
      sourceUrl,
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}

// HES descriptions are independent public pages. A bounded batch keeps a
// town-wide review practical without allowing one unavailable page to stall it.
const concurrency = 12;
for (let index = 0; index < candidates.length; index += concurrency)
  await Promise.all(candidates.slice(index, index + concurrency).map(enrich));

pkg.validation = validateFeatures(pkg.project, pkg.features);
const errors = pkg.validation.filter((item) => item.severity === 'error');
if (errors.length) throw new Error(`Refusing to write ${errors.length} validation error(s).`);
await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
await mkdir(dirname(reviewPath), { recursive: true });
await writeFile(
  reviewPath,
  `${JSON.stringify(
    {
      projectId: pkg.project.id,
      generatedAt: accessedAt,
      method: 'Opening HES listing-description expression; medium confidence until curator review.',
      candidates: candidates.length,
      enriched,
      reviewRequired: failures,
    },
    null,
    2,
  )}\n`,
);
console.log(
  `Enriched ${enriched} HES listing record(s); ${failures.length} require individual date review.`,
);
