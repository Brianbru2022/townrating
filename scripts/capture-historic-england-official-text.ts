import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { HeritageFeature, ProjectPackage } from '../src/domain/models';

interface OfficialTextRecord {
  featureId: string;
  listEntry: string;
  name: string;
  designationType: string;
  sourceUrl: string;
  officialName: string;
  details: string;
}

const projectPath = resolve(process.argv[2] ?? 'data/projects/peterborough.json');
const auditDate = new Date().toISOString().slice(0, 10);
const outputPath = resolve(
  process.argv[3] ?? `data/review/peterborough-nhle-official-text-${auditDate}.json`,
);
const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
const features = pkg.features.filter((feature) => feature.tags.includes('nhle'));
const requestDelayMs = Number(process.env.HE_CAPTURE_DELAY_MS ?? 1_250);
const workerCount = Math.max(
  1,
  Math.min(Number(process.env.HE_CAPTURE_WORKERS ?? 1), Math.max(features.length, 1)),
);

function sourceFor(feature: HeritageFeature) {
  return feature.sourceRecords.find(
    (source) =>
      source.sourceOrganisation === 'Historic England' &&
      /\/list-entry\/\d+/.test(source.sourceUrl ?? ''),
  );
}

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
        const error = new Error(`HTTP ${response.status}`) as Error & {
          retryAfterMs?: number;
        };
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
        const backoffMs = Math.min(30_000, 1_500 * 2 ** (attempt - 1));
        await wait(Math.max(retryAfterMs, backoffMs) + Math.floor(Math.random() * 500));
      }
    }
  }
  throw lastError;
}

interface CaptureOutput {
  accessedAt: string;
  source: string;
  records: OfficialTextRecord[];
  errors: Array<{ featureId: string; reason: string }>;
}

const existing = await readFile(outputPath, 'utf8')
  .then((value) => JSON.parse(value) as CaptureOutput)
  .catch(() => undefined);
const recordsByFeatureId = new Map(
  (existing?.records ?? []).map((record) => [record.featureId, record]),
);
const errorsByFeatureId = new Map(
  (existing?.errors ?? []).map((error) => [error.featureId, error]),
);
const queue = features.filter((feature) => !recordsByFeatureId.has(feature.id));
let processedCount = features.length - queue.length;

async function saveCheckpoint() {
  const records = [...recordsByFeatureId.values()].sort((left, right) =>
    left.listEntry.localeCompare(right.listEntry),
  );
  const errors = [...errorsByFeatureId.values()].sort((left, right) =>
    left.featureId.localeCompare(right.featureId),
  );
  await writeFile(
    outputPath,
    `${JSON.stringify(
      {
        accessedAt: auditDate,
        source: 'Historic England official list entries via a read-only text rendering proxy',
        records,
        errors,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
}

async function worker() {
  while (queue.length) {
    const feature = queue.shift();
    if (!feature) return;
    const source = sourceFor(feature);
    if (!source?.sourceUrl) {
      errorsByFeatureId.set(feature.id, {
        featureId: feature.id,
        reason: 'Historic England list-entry URL is missing.',
      });
      processedCount += 1;
      continue;
    }
    const listEntry = source.sourceRecordId ?? source.sourceUrl.match(/\/list-entry\/(\d+)/)?.[1];
    if (!listEntry) {
      errorsByFeatureId.set(feature.id, {
        featureId: feature.id,
        reason: 'Historic England list-entry number is missing.',
      });
      processedCount += 1;
      continue;
    }
    try {
      const markdown = await fetchWithRetry(readerUrl(source.sourceUrl));
      const details = section(markdown, 'Details');
      if (!details) throw new Error('Official Details section is empty');
      recordsByFeatureId.set(feature.id, {
        featureId: feature.id,
        listEntry,
        name: feature.name,
        designationType: feature.designationType ?? 'unknown',
        sourceUrl: `${source.sourceUrl}?section=official-list-entry`,
        officialName: officialName(markdown),
        details,
      });
      errorsByFeatureId.delete(feature.id);
      processedCount += 1;
    } catch (error) {
      errorsByFeatureId.set(feature.id, {
        featureId: feature.id,
        reason: error instanceof Error ? error.message : String(error),
      });
      processedCount += 1;
    }
    if (processedCount % 5 === 0 || processedCount === features.length) {
      await saveCheckpoint();
      console.log(
        `Captured ${processedCount}/${features.length} (${recordsByFeatureId.size} successful)`,
      );
    }
    await wait(requestDelayMs);
  }
}

console.log(
  `Resuming with ${recordsByFeatureId.size}/${features.length} successful record(s); ` +
    `${queue.length} request(s) remain, using ${workerCount} worker(s).`,
);
await Promise.all(Array.from({ length: workerCount }, () => worker()));
await saveCheckpoint();
console.log(
  `Captured ${recordsByFeatureId.size} record(s); ${errorsByFeatureId.size} error(s).`,
);
