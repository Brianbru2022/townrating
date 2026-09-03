import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { HeritageFeature, ProjectPackage } from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';

const projectPath = resolve('data/projects/crail.json');
const reviewedAt = '2026-08-25T18:00:00.000Z';

function decodeHtml(value: string): string {
  return value
    .replaceAll(/<[^>]+>/g, ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&nbsp;', ' ')
    .replaceAll(/\s+/g, ' ')
    .trim();
}

function descriptionFromHtml(html: string): string | undefined {
  const section = /<section id="description"[\s\S]*?<h1>Description<\/h1>([\s\S]*?)<\/section>/i.exec(html)?.[1];
  const description = section ? decodeHtml(section) : undefined;
  return description || undefined;
}

function centuryRange(century: number, qualifier?: string): [number, number] {
  const start = (century - 1) * 100;
  if (/early/i.test(qualifier ?? '')) return [start, start + 33];
  if (/mid/i.test(qualifier ?? '')) return [start + 34, start + 66];
  if (/late/i.test(qualifier ?? '')) return [start + 67, start + 99];
  return [start, start + 99];
}

function extractDate(description: string): Pick<HeritageFeature, 'documentedDateText' | 'earliestPossibleYear' | 'latestPossibleYear' | 'dateBasis' | 'dateConfidence'> | undefined {
  const opening = description.slice(0, 260);
  const candidates: Array<{ index: number; result: ReturnType<typeof extractDate> }> = [];
  const medieval = /\b(mediaeval|medieval)(?:\s+(?:in\s+)?origin)?\b/i.exec(opening);
  if (medieval) candidates.push({ index: medieval.index, result: { documentedDateText: 'Medieval origin', earliestPossibleYear: 1100, latestPossibleYear: 1500, dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'medium' } });
  const century = /\b(?:(early|mid(?:dle)?|late)\s+)?(1[1-9]|20)(?:st|nd|rd|th)\s+century\b/i.exec(opening);
  if (century) {
    const [earliestPossibleYear, latestPossibleYear] = centuryRange(Number(century[2]), century[1]);
    candidates.push({ index: century.index, result: { documentedDateText: century[0], earliestPossibleYear, latestPossibleYear, dateBasis: 'estimated_from_authoritative_source', dateConfidence: century[1] ? 'medium' : 'low' } });
  }
  const year = /\b(circa\s+|c\.\s*|dated\s+)?(1[0-9]{3}|20[0-2][0-9])(?:\s*[-–]\s*(\d{2,4}))?/i.exec(opening);
  if (year) {
    const start = Number(year[2]);
    const abbreviatedEnd = year[3];
    const end = abbreviatedEnd
      ? abbreviatedEnd.length === 2 ? Math.floor(start / 100) * 100 + Number(abbreviatedEnd) : Number(abbreviatedEnd)
      : start;
    const approximate = /circa|c\./i.test(year[1] ?? '');
    candidates.push({ index: year.index, result: { documentedDateText: year[0], earliestPossibleYear: start, latestPossibleYear: end, dateBasis: approximate ? 'estimated_from_authoritative_source' : 'documented_construction', dateConfidence: approximate ? 'medium' : 'high' } });
  }
  return candidates.sort((left, right) => left.index - right.index)[0]?.result;
}

async function enrich(feature: HeritageFeature): Promise<'dated' | 'undated' | 'failed'> {
  const reference = feature.sourceRecords.find((source) => /^LB\d+$/i.test(source.sourceRecordId ?? ''))?.sourceRecordId;
  if (!reference) return 'undated';
  const url = `https://portal.historicenvironment.scot/designation/${reference}`;
  try {
    const response = await fetch(url, { headers: { 'User-Agent': 'Townscape Guides Crail research/1.0' } });
    if (!response.ok) return 'failed';
    const description = descriptionFromHtml(await response.text());
    if (!description) return 'undated';
    feature.fullDescription = description;
    const source = feature.sourceRecords.find((item) => item.sourceRecordId === reference);
    if (source) {
      source.sourceUrl = url;
      source.accessedAt = reviewedAt;
      source.notes = 'Official HES designation description reviewed for construction-date evidence.';
    }
    const date = extractDate(description);
    if (!date) return 'undated';
    Object.assign(feature, date, { updatedAt: reviewedAt, reviewed: true, reviewNotes: 'Construction date or period extracted from the opening description of the official HES designation record; later alterations are not used as the primary date.' });
    if (source) source.quotedDateText = date.documentedDateText;
    return 'dated';
  } catch {
    return 'failed';
  }
}

const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
const heritage = pkg.features.filter((feature) => feature.tags.includes('hes-listed-building'));
const counts = { dated: 0, undated: 0, failed: 0 };
for (let index = 0; index < heritage.length; index += 12) {
  const results = await Promise.all(heritage.slice(index, index + 12).map(enrich));
  for (const result of results) counts[result] += 1;
}
pkg.validation = validateFeatures(pkg.project, pkg.features);
if (pkg.validation.some((item) => item.severity === 'error')) throw new Error('Crail date enrichment introduced validation errors.');
await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
await writeFile(resolve('data/review/crail-hes-date-enrichment-2026-08-25.json'), `${JSON.stringify({ reviewedAt, total: heritage.length, ...counts, method: 'Official HES designation description; first construction date/period only.', sourceUrlPattern: 'https://portal.historicenvironment.scot/designation/LB…' }, null, 2)}\n`, 'utf8');
console.log(`Crail HES dates: ${counts.dated} dated, ${counts.undated} without extractable construction date, ${counts.failed} fetch failures.`);
