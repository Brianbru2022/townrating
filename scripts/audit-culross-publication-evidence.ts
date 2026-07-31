import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { ProjectPackage } from '../src/domain/models';

const projectPath = resolve(process.argv[2] ?? 'data/projects/culross.json');
const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
const mapIssues = pkg.historicMaps.flatMap((map) => {
  const missing = [
    !map.sourceUrl && 'source URL',
    !map.licence && 'licence',
    !map.attribution && 'attribution',
    !map.tileUrl && map.layerType !== 'four_corner_image' && 'renderable layer URL',
    map.layerType === 'four_corner_image' && 'four-corner overlays are not publishable',
  ].filter(Boolean);
  return missing.length ? [{ id: map.id, missing }] : [];
});
const settlementIssues = pkg.settlementPolygons.flatMap((polygon) => {
  const missing = [
    !polygon.reviewed && 'review status',
    !polygon.sourceRecords.length && 'source',
    !polygon.evidenceDescription && 'coverage limitation',
    !polygon.digitisationMethod && 'digitisation method',
  ].filter(Boolean);
  return missing.length ? [{ id: polygon.id, missing }] : [];
});
console.log(
  JSON.stringify(
    {
      projectId: pkg.project.id,
      mapsReviewed: pkg.historicMaps.length,
      settlementAreasReviewed: pkg.settlementPolygons.length,
      mapIssues,
      settlementIssues,
      publishable: !mapIssues.length && !settlementIssues.length,
    },
    null,
    2,
  ),
);
process.exit(mapIssues.length || settlementIssues.length ? 1 : 0);
