import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { bboxPolygon, buffer, featureCollection, intersect } from '@turf/turf';
import type { Feature, MultiPolygon, Polygon } from 'geojson';
import type { ProjectPackage } from '../src/domain/models';

const splitLongitude = -2.827;
const files = ['elie', 'earlsferry'] as const;
function pointCoordinates(item: ProjectPackage['features'][number]): [number, number] | undefined {
  return item.geometry?.type === 'Point' ? item.geometry.coordinates as [number, number] : undefined;
}

for (const slug of files) {
  const path = resolve(`data/projects/${slug}.json`);
  const pkg = JSON.parse(await readFile(path, 'utf8')) as ProjectPackage;
  const project = pkg.project as typeof pkg.project & { townStudyArea: { localityBoundary: Feature<Polygon | MultiPolygon>; bufferedBoundary: Feature<Polygon | MultiPolygon>; visitorBoundary?: Feature<Polygon | MultiPolygon>; notes: string } };
  const clip = slug === 'elie' ? bboxPolygon([splitLongitude, 55.5, -2.7, 56.5]) : bboxPolygon([-3, 55.5, splitLongitude, 56.5]);
  const clipped = intersect(featureCollection([project.townStudyArea.bufferedBoundary, clip]));
  if (!clipped) throw new Error(`Could not clip ${slug} study buffer.`);
  project.townStudyArea.bufferedBoundary = clipped;
  const widerVisitorArea = buffer(project.townStudyArea.localityBoundary, 0.65, { units: 'kilometers' });
  if (!widerVisitorArea) throw new Error(`Could not create ${slug} visitor boundary.`);
  const clippedVisitorArea = intersect(featureCollection([widerVisitorArea, clip]));
  if (!clippedVisitorArea) throw new Error(`Could not clip ${slug} visitor boundary.`);
  project.townStudyArea.visitorBoundary = clippedVisitorArea;
  project.townStudyArea.notes = `${project.townStudyArea.notes.replace(/ The buffered study area is clipped[^.]*\./g, '')} The buffered study area is clipped at longitude ${splitLongitude} so Elie and Earlsferry do not overlap.`;
  if (slug === 'elie') {
    for (const item of pkg.features) {
      const coordinates = pointCoordinates(item);
      if (!coordinates || coordinates[0] > splitLongitude) continue;
      item.tags = [...new Set([...item.tags, 'map-hidden', 'earlsferry-assignment'])];
      item.evidenceScope = 'out_of_scope';
      item.reviewNotes = `Assigned to Earlsferry by the transparent Elie–Earlsferry split at longitude ${splitLongitude}; retained here only as source provenance.`;
    }
  }
  await writeFile(path, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
}

console.log(`Clipped Elie and Earlsferry displayed study buffers at longitude ${splitLongitude}.`);
