import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { HeritageFeature, ProjectPackage, SourceRecord } from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';

const reviewedAt = '2026-08-28T23:20:00.000Z';
const defaultFiles = [
  'rickarton', 'cowie-stonehaven', 'fiddes', 'carmont', 'tewel', 'mergie',
  'tannachie', 'newmill-carmont', 'mains-of-dellavaird', 'glenbervie',
  'drumlithie', 'glenfarquhar-lodge',
];
const files = process.argv.length > 2 ? process.argv.slice(2) : defaultFiles;
const reportFile = process.env.HEATMAP_HES_REPORT ?? 'stonehaven-mearns-local-hes-integrity-2026-08-28.json';

interface CachedDescription { url: string; description?: string; fetchedAt: string }
interface DateValue { text: string; earliest: number; latest: number; precision: HeritageFeature['datePrecision'] }
const cache = JSON.parse(await readFile(resolve('data/cache/hes-designation-descriptions.json'), 'utf8')) as Record<string, CachedDescription>;

function centuryRange(century: number, qualifier = ''): [number, number] {
  const start = (century - 1) * 100;
  if (/early/i.test(qualifier)) return [start, start + 39];
  if (/mid/i.test(qualifier)) return [start + 30, start + 69];
  if (/late|later/i.test(qualifier)) return [start + 60, start + 99];
  return [start, start + 99];
}

function extractDate(description?: string): DateValue | undefined {
  if (!description?.trim()) return undefined;
  const opening = description.split(/[.;]/, 1)[0].trim();
  const century = opening.match(/\b(early(?:-|\s*)mid|mid(?:-|\s*)late|early|mid|late|later)?\s*(1[2-9]|20)(?:th|st|nd|rd)(?:\s*[-–/]\s*(1[2-9]|20)(?:th|st|nd|rd)?)?\s+century\b/i);
  if (century) {
    const [earliest] = centuryRange(Number(century[2]), century[1]);
    const [, latest] = century[3] ? centuryRange(Number(century[3])) : centuryRange(Number(century[2]), century[1]);
    return { text: opening, earliest, latest, precision: 'period_range' };
  }
  const range = opening.match(/\b(?:c\.?|circa|about|dated)?\s*((?:1[2-9]|20)\d{2})\s*(?:-|–|to)\s*((?:1[2-9]|20)\d{2})\b/i);
  if (range) return { text: opening, earliest: Number(range[1]), latest: Number(range[2]), precision: 'year_range' };
  const year = opening.match(/\b(?:c\.?|circa|about|dated)?\s*((?:1[2-9]|20)\d{2})\b/i);
  if (year) return { text: opening, earliest: Number(year[1]), latest: Number(year[1]), precision: 'exact_year' };
  return undefined;
}

const datedById = new Map<string, HeritageFeature>();
for (const name of await readdir(resolve('data/projects'))) {
  if (!name.endsWith('.json') || files.includes(name.replace(/\.json$/, ''))) continue;
  try {
    const pkg = JSON.parse(await readFile(resolve('data/projects', name), 'utf8')) as ProjectPackage;
    for (const feature of pkg.features) {
      if (feature.documentedDateText && feature.earliestPossibleYear !== undefined && feature.latestPossibleYear !== undefined)
        datedById.set(feature.id, feature);
    }
  } catch { /* Ignore non-project JSON. */ }
}

const results = [];
for (const file of files) {
  const path = resolve('data/projects', `${file}.json`);
  const pkg = JSON.parse(await readFile(path, 'utf8')) as ProjectPackage;
  let reused = 0;
  let extracted = 0;
  let hiddenBuffer = 0;
  let hiddenUndated = 0;

  for (const feature of pkg.features) {
    const heritage = feature.id.startsWith('hes-') || feature.id.startsWith('nrhe:') || feature.tags.some((tag) => tag === 'hes-listed-building' || tag === 'nrhe');
    if (!heritage) continue;
    if (feature.tags.includes('town-selection-heritage-buffer')) {
      feature.tags = [...new Set([...feature.tags, 'map-hidden'])];
      feature.evidenceScope = 'related_context';
      hiddenBuffer += 1;
      continue;
    }
    if (!feature.documentedDateText) {
      const shared = datedById.get(feature.id);
      if (shared) {
        Object.assign(feature, {
          documentedDateText: shared.documentedDateText,
          earliestPossibleYear: shared.earliestPossibleYear,
          latestPossibleYear: shared.latestPossibleYear,
          datePrecision: shared.datePrecision,
          dateBasis: shared.dateBasis,
          dateConfidence: shared.dateConfidence,
        });
        reused += 1;
      } else if (feature.id.startsWith('hes-listed-building:')) {
        const reference = feature.id.split(':').at(-1)!;
        const date = extractDate(cache[reference]?.description);
        if (date) {
          const source: SourceRecord = {
            sourceName: 'Bundled HES designation-description date extraction',
            sourceOrganisation: 'Historic Environment Scotland', sourceRecordId: reference,
            sourceUrl: cache[reference].url, accessedAt: cache[reference].fetchedAt,
            licence: 'Open Government Licence v3.0; retain Historic Environment Scotland attribution.',
            notes: 'Construction period extracted from the locally cached official HES description. Administrative designation dates were not used.',
            reliability: 'official_statutory',
          };
          Object.assign(feature, {
            documentedDateText: date.text, earliestPossibleYear: date.earliest, latestPossibleYear: date.latest,
            datePrecision: date.precision, dateBasis: 'documented_date_range', dateConfidence: 'medium',
            sourceRecords: [...feature.sourceRecords.filter((item) => item.sourceName !== source.sourceName), source],
          });
          extracted += 1;
        }
      }
    }
    const dated = Boolean(feature.documentedDateText?.trim()) && feature.earliestPossibleYear !== undefined && feature.latestPossibleYear !== undefined && feature.dateBasis !== 'unknown';
    feature.tags = [...new Set([...feature.tags, 'local-hes-batch-reviewed', ...(dated ? [] : ['map-hidden'])])];
    if (!dated) hiddenUndated += 1;
    feature.updatedAt = reviewedAt;
  }

  const visible = pkg.features.filter((feature) => (feature.id.startsWith('hes-') || feature.id.startsWith('nrhe:')) && !feature.tags.includes('map-hidden'));
  const visibleUndated = visible.filter((feature) => !feature.documentedDateText?.trim() || feature.earliestPossibleYear === undefined || feature.latestPossibleYear === undefined || feature.dateBasis === 'unknown');
  if (visibleUndated.length) throw new Error(`${pkg.project.name} still has undated visible HES/NRHE pins: ${visibleUndated.map((feature) => feature.id).join(', ')}`);
  pkg.validation = validateFeatures(pkg.project, pkg.features);
  const errors = pkg.validation.filter((item) => item.severity === 'error');
  if (errors.length) throw new Error(`${pkg.project.name}: ${errors.map((item) => item.message).join('; ')}`);
  await writeFile(path, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
  results.push({ projectId: pkg.project.id, name: pkg.project.name, listedBuildings: pkg.features.filter((feature) => feature.tags.includes('hes-listed-building')).length, nrheRecords: pkg.features.filter((feature) => feature.tags.includes('nrhe')).length, scheduledMonuments: pkg.features.filter((feature) => feature.id.startsWith('hes-scheduled-monument:')).length, visibleDatedPins: visible.length, visibleUndatedPins: visibleUndated.length, reusedDates: reused, locallyExtractedDates: extracted, hiddenBufferRecords: hiddenBuffer, hiddenUndatedRecords: hiddenUndated });
}

await writeFile(resolve('data/review', reportFile), `${JSON.stringify({
  reviewedAt, source: 'Bundled local HES Listed Buildings, Canmore/NRHE and statutory polygon datasets',
  rule: 'All records remain intact. Buffer and undated records remain in the library but are map-hidden. Every visible heritage heat pin has construction or material-period evidence; designation dates are never used.',
  results,
}, null, 2)}\n`, 'utf8');
console.log(`Finalised local HES integrity for ${results.length} new places: ${results.reduce((sum, item) => sum + item.visibleDatedPins, 0)} visible dated pins, 0 visible undated pins.`);
