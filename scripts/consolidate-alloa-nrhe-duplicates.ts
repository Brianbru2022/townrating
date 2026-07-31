import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { ProjectPackage, SourceRecord } from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';

const projectPath = resolve(process.argv[2] ?? 'data/projects/alloa.json');

// These mappings were manually reviewed against the official names, locations
// and detailed NRHE records. Source records are retained on the statutory HES
// feature so the public map has one feature per real-world asset.
const consolidations = [
  {
    canonicalId: 'hes-scheduled-monument:SM625',
    duplicateId: 'nrhe:47223',
  },
  {
    canonicalId: 'hes-listed-building:LB51622',
    duplicateId: 'nrhe:252682',
  },
  {
    canonicalId: 'hes-listed-building:LB52460',
    duplicateId: 'nrhe:220575',
  },
  {
    canonicalId: 'hes-listed-building:LB20970',
    duplicateId: 'nrhe:141472',
  },
  {
    canonicalId: 'hes-listed-building:LB21003',
    duplicateId: 'nrhe:141855',
  },
  {
    canonicalId: 'hes-listed-building:LB21021',
    duplicateId: 'nrhe:220235',
  },
  {
    canonicalId: 'hes-listed-building:LB21016',
    duplicateId: 'nrhe:263553',
  },
  {
    canonicalId: 'hes-listed-building:LB21001',
    duplicateId: 'nrhe:263560',
  },
  {
    canonicalId: 'hes-listed-building:LB50151',
    duplicateId: 'nrhe:371566',
  },
  {
    canonicalId: 'hes-listed-building:LB21024',
    duplicateId: 'nrhe:141908',
  },
  {
    canonicalId: 'hes-listed-building:LB21016',
    duplicateId: 'nrhe:47195',
  },
  {
    canonicalId: 'hes-listed-building:LB51392',
    duplicateId: 'nrhe:291069',
  },
] as const;

function uniqueSources(sources: SourceRecord[]): SourceRecord[] {
  const seen = new Set<string>();
  return sources.filter((source) => {
    const key = `${source.sourceOrganisation}|${source.sourceRecordId ?? ''}|${source.sourceUrl}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const packageJson = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
const accessedAt = new Date().toISOString();
let consolidated = 0;

for (const { canonicalId, duplicateId } of consolidations) {
  const canonical = packageJson.features.find((feature) => feature.id === canonicalId);
  const duplicate = packageJson.features.find((feature) => feature.id === duplicateId);
  if (!canonical) throw new Error(`Expected canonical record ${canonicalId} to be present.`);
  if (!duplicate) continue;

  canonical.sourceRecords = uniqueSources([...canonical.sourceRecords, ...duplicate.sourceRecords]);
  canonical.alternativeNames = [
    ...new Set(
      [
        ...canonical.alternativeNames,
        ...duplicate.alternativeNames,
        ...(duplicate.name === canonical.name ? [] : [duplicate.name]),
      ].filter(Boolean),
    ),
  ];
  canonical.tags = [...new Set([...canonical.tags, ...duplicate.tags, 'nrhe-linked'])];
  canonical.fullDescription ??= duplicate.fullDescription;
  canonical.reviewNotes = `${canonical.reviewNotes ? `${canonical.reviewNotes} ` : ''}NRHE record ${duplicateId.slice(5)} consolidated into this HES feature after manual review; its source record and aliases are retained.`;
  canonical.reviewed ||= duplicate.reviewed;
  canonical.updatedAt = accessedAt;
  consolidated += 1;
}

const duplicateIds = new Set<string>(consolidations.map(({ duplicateId }) => duplicateId));
packageJson.features = packageJson.features.filter((feature) => !duplicateIds.has(feature.id));
packageJson.validation = validateFeatures(packageJson.project, packageJson.features);
const errors = packageJson.validation.filter((result) => result.severity === 'error');
if (errors.length) throw new Error(`Refusing to write ${errors.length} validation error(s).`);

await writeFile(projectPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
console.log(`Consolidated ${consolidated} reviewed NRHE duplicate record(s) into HES features.`);
