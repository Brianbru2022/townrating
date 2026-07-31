import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { booleanPointInPolygon, point } from '@turf/turf';
import type { ProjectPackage } from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';

const projectPath = resolve(process.argv[2] ?? 'data/projects/tillicoultry.json');
const projectPackage = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
let relatedContextCount = 0;
const relatedContextNote =
  'Representative point lies beyond the authoritative NRS Tillicoultry parish boundary; retained as related context and excluded from parish totals and heat scoring.';

for (const feature of projectPackage.features) {
  if (
    feature.geometry?.type !== 'Point' ||
    booleanPointInPolygon(point(feature.geometry.coordinates), projectPackage.project.boundary)
  )
    continue;
  feature.evidenceScope = 'related_context';
  feature.reviewed = true;
  feature.reviewNotes = feature.reviewNotes?.includes(relatedContextNote)
    ? feature.reviewNotes
    : [feature.reviewNotes, relatedContextNote].filter(Boolean).join(' ');
  relatedContextCount += 1;
}

projectPackage.validation = validateFeatures(projectPackage.project, projectPackage.features);
const errors = projectPackage.validation.filter((item) => item.severity === 'error');
if (errors.length) throw new Error(`Refusing to write ${errors.length} validation error(s).`);
await writeFile(projectPath, `${JSON.stringify(projectPackage, null, 2)}\n`, 'utf8');
console.log(
  `Finalised Tillicoultry package: ${projectPackage.features.length} records, ${relatedContextCount} related-context record(s), ${projectPackage.validation.length} review warning(s).`,
);
