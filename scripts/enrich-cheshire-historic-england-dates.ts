import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { extractHistoricEnglandDate } from '../src/domain/historicDateExtraction';
import type { HeritageFeature, ProjectPackage, SourceRecord } from '../src/domain/models';

interface OfficialTextRecord {
  listEntry: string;
  sourceUrl: string;
  officialName: string;
  details: string;
}

interface CaptureError {
  listEntry: string;
  sourceUrl?: string;
  reason: string;
}

interface OfficialTextCache {
  accessedAt: string;
  source: string;
  records: OfficialTextRecord[];
  errors: CaptureError[];
}

interface FeatureReference {
  listEntry: string;
  sourceUrl: string;
}

const auditDate = new Date().toISOString().slice(0, 10);
const reviewedAt = `${auditDate}T00:00:00Z`;
const generatedModulePath = resolve('src/data/cheshireSettlements.generated.ts');
const cachePath = resolve(
  process.argv[2] ?? `data/review/cheshire-nhle-official-text-${auditDate}.json`,
);
const auditPath = resolve(
  process.argv[3] ?? `data/review/cheshire-nhle-date-enrichment-${auditDate}.json`,
);
const requestDelayMs = Math.max(0, Number(process.env.HE_CAPTURE_DELAY_MS ?? 150));
const workerCount = Math.max(1, Math.min(12, Number(process.env.HE_CAPTURE_WORKERS ?? 8)));
const cacheOnly = process.env.HE_CAPTURE_CACHE_ONLY === '1';

function normaliseText(value: string) {
  return value
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function section(markdown: string, heading: string) {
  const match = markdown.match(
    new RegExp(`(?:^|\\n)#{2,4}\\s+${heading}\\s*\\n([\\s\\S]*?)(?=\\n#{2,4}\\s+|$)`, 'i'),
  );
  return normaliseText(match?.[1] ?? '');
}

function officialName(markdown: string) {
  const officialSection = markdown.split(/\n##\s+Official list entry\s*\n/i)[1] ?? markdown;
  const match = officialSection.match(/List Entry Name:\s*([^\n]+)/i);
  return normaliseText(match?.[1] ?? '');
}

function readerUrl(sourceUrl: string) {
  const url = new URL(sourceUrl);
  url.searchParams.set('section', 'official-list-entry');
  return `https://r.jina.ai/${url.toString()}`;
}

function wait(milliseconds: number) {
  return new Promise((done) => setTimeout(done, milliseconds));
}

async function fetchWithRetry(url: string, attempts = 6): Promise<string> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'text/markdown,text/plain;q=0.9,*/*;q=0.5',
          'User-Agent': 'Townscape Guides official-list research/1.0',
        },
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) {
        const retryAfterSeconds = Number(response.headers.get('retry-after') ?? 0);
        const error = new Error(`HTTP ${response.status}`) as Error & { retryAfterMs?: number };
        if (retryAfterSeconds > 0) error.retryAfterMs = retryAfterSeconds * 1_000;
        throw error;
      }
      const text = await response.text();
      if (!text.includes('Historic England') || !/#{2,4}\s+Details/i.test(text)) {
        throw new Error('Official Details section was not returned');
      }
      return text;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        const retryAfterMs =
          error instanceof Error && 'retryAfterMs' in error
            ? Number((error as Error & { retryAfterMs?: number }).retryAfterMs ?? 0)
            : 0;
        const backoffMs = Math.min(30_000, 1_000 * 2 ** (attempt - 1));
        await wait(Math.max(retryAfterMs, backoffMs) + Math.floor(Math.random() * 400));
      }
    }
  }
  throw lastError;
}

function sourceFor(feature: HeritageFeature) {
  return feature.sourceRecords.find(
    (source) =>
      source.sourceOrganisation === 'Historic England' &&
      /\/list-entry\/\d+/.test(source.sourceUrl ?? ''),
  );
}

function listEntryFor(feature: HeritageFeature) {
  const source = sourceFor(feature);
  return source?.sourceRecordId ?? source?.sourceUrl?.match(/\/list-entry\/(\d+)/)?.[1];
}

function alreadyDated(feature: HeritageFeature) {
  return feature.earliestPossibleYear !== undefined || feature.latestPossibleYear !== undefined;
}

async function projectPaths() {
  const moduleSource = await readFile(generatedModulePath, 'utf8');
  const paths = [...moduleSource.matchAll(/from '\.\.\/\.\.\/(data\/projects\/[^']+\.json)'/g)]
    .map((match) => resolve(match[1]));
  if (!paths.length) throw new Error('No Cheshire project imports were found.');
  return paths;
}

const paths = await projectPaths();
const packages = await Promise.all(
  paths.map(async (path) => ({
    path,
    pkg: JSON.parse(await readFile(path, 'utf8')) as ProjectPackage,
  })),
);
const references = new Map<string, FeatureReference>();
for (const { pkg } of packages) {
  for (const feature of pkg.features.filter((item) => item.tags.includes('nhle'))) {
    const source = sourceFor(feature);
    const listEntry = listEntryFor(feature);
    if (source?.sourceUrl && listEntry) {
      references.set(listEntry, { listEntry, sourceUrl: source.sourceUrl.split('?')[0] });
    }
  }
}

const existing = await readFile(cachePath, 'utf8')
  .then((value) => JSON.parse(value) as OfficialTextCache)
  .catch(() => undefined);
const recordsByListEntry = new Map(
  (existing?.records ?? []).map((record) => [record.listEntry, record]),
);
const errorsByListEntry = new Map(
  (existing?.errors ?? []).map((error) => [error.listEntry, error]),
);
const uncachedReferences = [...references.values()].filter(
  (reference) => !recordsByListEntry.has(reference.listEntry),
);
const queue = cacheOnly ? [] : [...uncachedReferences];
let processedCount = references.size - queue.length;
let checkpointChain = Promise.resolve();

function checkpointPayload(): OfficialTextCache {
  return {
    accessedAt: auditDate,
    source: 'Historic England official list entries via a read-only text rendering proxy',
    records: [...recordsByListEntry.values()].sort((left, right) =>
      left.listEntry.localeCompare(right.listEntry),
    ),
    errors: [...errorsByListEntry.values()].sort((left, right) =>
      left.listEntry.localeCompare(right.listEntry),
    ),
  };
}

function saveCheckpoint() {
  const payload = checkpointPayload();
  checkpointChain = checkpointChain.then(() =>
    writeFile(cachePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8'),
  );
  return checkpointChain;
}

async function worker() {
  while (queue.length) {
    const reference = queue.shift();
    if (!reference) return;
    try {
      const markdown = await fetchWithRetry(readerUrl(reference.sourceUrl));
      const details = section(markdown, 'Details');
      if (!details) throw new Error('Official Details section is empty');
      recordsByListEntry.set(reference.listEntry, {
        listEntry: reference.listEntry,
        sourceUrl: `${reference.sourceUrl}?section=official-list-entry`,
        officialName: officialName(markdown),
        details,
      });
      errorsByListEntry.delete(reference.listEntry);
    } catch (error) {
      errorsByListEntry.set(reference.listEntry, {
        listEntry: reference.listEntry,
        sourceUrl: reference.sourceUrl,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
    processedCount += 1;
    if (processedCount % 25 === 0 || processedCount === references.size) {
      await saveCheckpoint();
      console.log(
        `Captured ${processedCount}/${references.size} unique list entries ` +
          `(${recordsByListEntry.size} successful; ${errorsByListEntry.size} unresolved requests).`,
      );
    }
    await wait(requestDelayMs);
  }
}

console.log(
  `Resuming with ${recordsByListEntry.size}/${references.size} unique list entries cached; ` +
    `${uncachedReferences.length} request(s) remain` +
    (cacheOnly ? '; cache-only mode will report them without requesting.' : `, using ${workerCount} worker(s).`),
);
await Promise.all(Array.from({ length: workerCount }, () => worker()));
await saveCheckpoint();

const enrichmentReviewPattern =
  /\s*Earliest dated fabric or historic component normalised from the official Historic England list-entry text on \d{4}-\d{2}-\d{2}; later restoration and administrative listing dates were excluded\./g;
const unresolvedReviewPattern =
  /\s*Official Historic England list-entry text checked on \d{4}-\d{2}-\d{2}; no defensible historic date expression was found\./g;
const enrichmentReviewNote =
  `Earliest dated fabric or historic component normalised from the official Historic England list-entry text on ${auditDate}; later restoration and administrative listing dates were excluded.`;
const unresolvedReviewNote =
  `Official Historic England list-entry text checked on ${auditDate}; no defensible historic date expression was found.`;
const enriched: Array<{
  projectId: string;
  featureId: string;
  listEntry: string;
  evidenceText: string;
  earliestPossibleYear: number;
  latestPossibleYear: number;
}> = [];
const unresolved: Array<{
  projectId: string;
  featureId: string;
  listEntry?: string;
  reason: string;
}> = [];

for (const { path, pkg } of packages) {
  for (const feature of pkg.features.filter((item) => item.tags.includes('nhle'))) {
    const previouslyEnriched = feature.tags.includes('historic-england-date-enriched');
    if (alreadyDated(feature) && !previouslyEnriched) continue;
    if (previouslyEnriched) {
      delete feature.documentedDateText;
      delete feature.earliestPossibleYear;
      delete feature.latestPossibleYear;
      delete feature.datePrecision;
      feature.dateBasis = 'unknown';
      feature.dateConfidence = 'unknown';
      feature.sourceRecords = feature.sourceRecords.filter(
        (source) => source.sourceName !== 'Historic England official list entry date evidence',
      );
      feature.tags = feature.tags.filter((tag) => tag !== 'historic-england-date-enriched');
    }
    feature.reviewNotes = feature.reviewNotes
      ?.replace(enrichmentReviewPattern, '')
      .replace(unresolvedReviewPattern, '')
      .replace(/\s+/g, ' ')
      .trim();

    const listEntry = listEntryFor(feature);
    const record = listEntry ? recordsByListEntry.get(listEntry) : undefined;
    if (!listEntry || !record) {
      unresolved.push({
        projectId: pkg.project.id,
        featureId: feature.id,
        listEntry,
        reason: cacheOnly
          ? 'Official list-entry text has not yet been captured; retained as unknown.'
          : 'No captured official list-entry text.',
      });
      continue;
    }
    const extracted = extractHistoricEnglandDate(
      feature.designationType === 'scheduled_monument'
        ? `${record.officialName || feature.name}. ${record.details}`
        : record.details,
    );
    if (!extracted) {
      feature.reviewNotes = `${feature.reviewNotes ?? ''} ${unresolvedReviewNote}`.trim();
      feature.updatedAt = reviewedAt;
      unresolved.push({
        projectId: pkg.project.id,
        featureId: feature.id,
        listEntry,
        reason: 'No defensible construction year, century or historic period found.',
      });
      continue;
    }

    const evidenceSource: SourceRecord = {
      sourceName: 'Historic England official list entry date evidence',
      sourceOrganisation: 'Historic England',
      sourceRecordId: listEntry,
      sourceUrl: record.sourceUrl,
      accessedAt: reviewedAt,
      reliability: 'official_statutory',
      licence: 'Open Government Licence v3.0; contains Historic England data.',
      notes:
        `Earliest dated fabric or historic component normalised from the official list-entry wording: ` +
        extracted.evidenceText,
    };
    feature.documentedDateText = extracted.evidenceText;
    feature.earliestPossibleYear = extracted.earliestPossibleYear;
    feature.latestPossibleYear = extracted.latestPossibleYear;
    feature.datePrecision = extracted.datePrecision;
    feature.dateBasis = extracted.dateBasis;
    feature.dateConfidence = extracted.dateConfidence;
    feature.sourceRecords = [
      ...feature.sourceRecords.filter((source) => source.sourceName !== evidenceSource.sourceName),
      evidenceSource,
    ];
    feature.tags = [...new Set([...feature.tags, 'historic-england-date-enriched'])];
    feature.reviewed = true;
    feature.reviewNotes = `${feature.reviewNotes ?? ''} ${enrichmentReviewNote}`.trim();
    feature.updatedAt = reviewedAt;
    enriched.push({
      projectId: pkg.project.id,
      featureId: feature.id,
      listEntry,
      evidenceText: extracted.evidenceText,
      earliestPossibleYear: extracted.earliestPossibleYear,
      latestPossibleYear: extracted.latestPossibleYear,
    });
  }

  const nhleFeatures = pkg.features.filter((feature) => feature.tags.includes('nhle'));
  const datedNhleCount = nhleFeatures.filter(alreadyDated).length;
  const baseResearchNotes = (pkg.project.researchNotes ?? '')
    .replace(
      /\s*Historic England official list-entry date enrichment (?:completed|reviewed) \d{4}-\d{2}-\d{2}: \d+ of \d+ statutory records now carry defensible date evidence; (?:unresolved entries were individually checked and retained as unknown|uncaptured or unresolved entries are retained as unknown and listed in the county audit)\./g,
      '',
    )
    .trim();
  pkg.project.researchNotes =
    `${baseResearchNotes} Historic England official list-entry date enrichment reviewed ${auditDate}: ` +
    `${datedNhleCount} of ${nhleFeatures.length} statutory records now carry defensible date evidence; ` +
    (cacheOnly
      ? 'uncaptured or unresolved entries are retained as unknown and listed in the county audit.'
      : 'unresolved entries were individually checked and retained as unknown.');
  await writeFile(path, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
}

const totalNhle = packages.reduce(
  (total, item) => total + item.pkg.features.filter((feature) => feature.tags.includes('nhle')).length,
  0,
);
const datedNhle = packages.reduce(
  (total, item) =>
    total +
    item.pkg.features.filter((feature) => feature.tags.includes('nhle') && alreadyDated(feature)).length,
  0,
);
await writeFile(
  auditPath,
  `${JSON.stringify(
    {
      reviewedAt,
      projectCount: packages.length,
      cachePath,
      methodology:
        'Normalised the earliest dated fabric or historic component from cached official Historic England list-entry text. Administrative listing dates and restoration-only dates were excluded. Uncaptured entries remain unknown and are explicitly listed.',
      counts: {
        uniqueListEntries: references.size,
        capturedOfficialEntries: recordsByListEntry.size,
        captureErrors: errorsByListEntry.size,
        nhleRecords: totalNhle,
        enriched: enriched.length,
        datedAfterEnrichment: datedNhle,
        unresolved: unresolved.length,
      },
      enriched,
      unresolved,
      captureErrors: [...errorsByListEntry.values()],
    },
    null,
    2,
  )}\n`,
  'utf8',
);

console.log(
  `Enriched ${enriched.length}/${totalNhle} Cheshire NHLE record(s); ` +
    `${unresolved.length} remain explicitly unresolved.`,
);
