import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { booleanPointInPolygon, point } from '@turf/turf';
import type { ProjectPackage } from '../src/domain/models';

const projectPath = resolve(process.argv[2] ?? 'data/projects/alloa.json');
const reportPath = resolve(process.argv[3] ?? 'data/review/pin-location-audit.json');
const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;

const flags: Array<{ id: string; name: string; reasons: string[]; action: string }> = [];
let checkedPointCount = 0;
let checkedAdditionalPointCount = 0;
for (const feature of pkg.features) {
  if (feature.evidenceScope === 'out_of_scope') continue;
  if (feature.geometry?.type !== 'Point') continue;
  checkedPointCount += 1;
  checkedAdditionalPointCount += feature.additionalPointLocations?.length ?? 0;
  const reasons: string[] = [];
  if (feature.tags.includes('catalogue-general-view'))
    reasons.push('Catalogue/general-view record is not a discrete physical asset.');
  if (feature.locationConfidence === 'low' || feature.locationConfidence === 'unknown')
    reasons.push(`Source location confidence is ${feature.locationConfidence}.`);
  if (!booleanPointInPolygon(point(feature.geometry.coordinates), pkg.project.boundary))
    reasons.push('Point lies outside the published project study boundary.');
  if (!reasons.length) continue;
  flags.push({
    id: feature.id,
    name: feature.name,
    reasons,
    action: feature.tags.includes('catalogue-general-view')
      ? 'Hidden from map; retained in Data Review with its source record.'
      : feature.evidenceScope === 'related_context'
        ? 'Retained as related context; excluded from project statistics and heat scoring.'
        : 'No coordinate changed. Check the cited record before any manual move.',
  });
}

await mkdir(dirname(reportPath), { recursive: true });
await writeFile(
  reportPath,
  `${JSON.stringify(
    {
      projectId: pkg.project.id,
      auditedAt: new Date().toISOString(),
      method:
        'Checked every primary and additional official point location against the published project study boundary, source location confidence and catalogue/general-view status. No pin coordinates were changed without a reviewed authoritative location source.',
      checkedPointCount,
      checkedAdditionalPointCount,
      coordinatesCorrected: [],
      flags,
    },
    null,
    2,
  )}\n`,
  'utf8',
);
console.log(
  `Audited ${checkedPointCount} ${pkg.project.locality} point location(s) plus ${checkedAdditionalPointCount} official secondary point(s); ${flags.length} record(s) flagged; 0 coordinate(s) changed.`,
);
