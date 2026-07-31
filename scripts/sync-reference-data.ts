import { mkdir, writeFile } from 'node:fs/promises';
import {
  referenceDatasets,
  referenceManifestPath,
  syncReferenceDataset,
} from './lib/reference-data';

const refresh = process.argv.includes('--refresh');
const records = await Promise.all(
  Object.keys(referenceDatasets).map((key) =>
    syncReferenceDataset(key as keyof typeof referenceDatasets, refresh),
  ),
);
await mkdir('data/reference', { recursive: true });
await writeFile(
  referenceManifestPath,
  `${JSON.stringify({ generatedAt: new Date().toISOString(), datasets: records }, null, 2)}\n`,
  'utf8',
);
console.log(`Reference data ready: ${records.map((record) => record.id).join(', ')}.`);
