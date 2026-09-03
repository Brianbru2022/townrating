import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { localHesDatasetFiles, localHesListedBuildingFiles } from './lib/reference-data';

const reviewedAt = '2026-08-28T17:30:00Z';

function dbfRecordCount(buffer: Buffer): number {
  return buffer.readUInt32LE(4);
}

async function describeDataset(
  id: string,
  files: { shp: string; dbf: string; prj: string; cpg: string },
  schemaPath: string,
  historicDateCapability: string,
) {
  const [dbf, schema] = await Promise.all([readFile(files.dbf), readFile(schemaPath, 'utf8')]);
  const fields = schema.split(/\r?\n/).slice(1).map((line) => line.trim().split(/\s+/)[0]).filter(Boolean);
  return {
    id,
    localFiles: files,
    records: dbfRecordCount(dbf),
    fields,
    historicDateCapability,
  };
}

const listedFiles = await localHesListedBuildingFiles();
const scheduledFiles = await localHesDatasetFiles('scheduledMonuments');
const canmoreFiles = await localHesDatasetFiles('canmorePoints');
if (!listedFiles || !scheduledFiles || !canmoreFiles) {
  throw new Error('The complete local HES Listed Buildings, Scheduled Monuments and Canmore datasets are required.');
}

const descriptionPath = resolve('data/reference/scotland-hes/hes-listed-building-descriptions.json');
const descriptions = JSON.parse(await readFile(descriptionPath, 'utf8')) as Record<string, { description?: string }>;
const report = {
  reviewedAt,
  policy: 'Use local HES spatial and descriptive snapshots first. Administrative DESIGNATED, ENTRYDATE and LASTUPDATE values are provenance dates and must never be used as construction dates. Internet fallback is permitted only for references emitted by the unresolved-date audit.',
  datasets: [
    await describeDataset(
      'hes-listed-buildings',
      listedFiles,
      resolve('data/reference/scotland-hes/lb_scotland/Listed_Buildings_Attribute_Schema.txt'),
      'The spatial DBF has no construction-period or description field. Historic dates come from the formal local official-description snapshot.',
    ),
    await describeDataset(
      'hes-scheduled-monuments',
      scheduledFiles,
      resolve('data/reference/scotland-hes/sam_scotland/Scheduled_Monuments_Attribute_Schema.txt'),
      'The spatial DBF has no monument-period or description field. DESIGNATED and AMENDED are administrative dates only.',
    ),
    await describeDataset(
      'hes-canmore-points',
      canmoreFiles,
      resolve('data/reference/scotland-hes/Canmore_Points/Canmore_Points_Attribute_Schema.txt'),
      'The local export supplies names, broad classes and site types but no historic period field. ENTRYDATE and LASTUPDATE are database-administration dates, so no construction date is inferred from them.',
    ),
  ],
  localOfficialDescriptions: {
    path: descriptionPath,
    records: Object.values(descriptions).filter((item) => item.description?.trim()).length,
  },
};

await mkdir(resolve('data/review'), { recursive: true });
await writeFile(
  resolve('data/review/scotland-local-hes-source-capabilities-2026-08-28.json'),
  `${JSON.stringify(report, null, 2)}\n`,
  'utf8',
);
console.log(report.datasets.map((dataset) => `${dataset.id}: ${dataset.records} local records`).join('\n'));
console.log(`hes-listed-building-descriptions: ${report.localOfficialDescriptions.records} local records`);
