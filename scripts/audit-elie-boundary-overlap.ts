import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { area, booleanPointInPolygon, featureCollection, intersect, point } from '@turf/turf';
import type { Feature, MultiPolygon, Polygon } from 'geojson';
import type { ProjectPackage } from '../src/domain/models';

const reviewedAt = '2026-08-26';
const elie = JSON.parse(await readFile(resolve('data/projects/elie.json'), 'utf8')) as ProjectPackage;
const neighbours = await Promise.all(['earlsferry', 'kilconquhar', 'st-monans'].map(async (slug) => JSON.parse(await readFile(resolve(`data/projects/${slug}.json`), 'utf8')) as ProjectPackage));

function studyPolygon(pkg: ProjectPackage): Feature<Polygon | MultiPolygon> {
  const project = pkg.project as typeof pkg.project & { townStudyArea?: { bufferedBoundary?: Feature<Polygon | MultiPolygon> } };
  return (project.townStudyArea?.bufferedBoundary ?? project.boundary) as Feature<Polygon | MultiPolygon>;
}
function pointCoordinates(item: ProjectPackage['features'][number]): [number, number] | undefined {
  return item.geometry?.type === 'Point' ? item.geometry.coordinates as [number, number] : undefined;
}

const elieArea = studyPolygon(elie);
const comparisons = neighbours.map((neighbour) => {
  const neighbourArea = studyPolygon(neighbour);
  const overlap = intersect(featureCollection([elieArea, neighbourArea]));
  const overlapSquareMetres = overlap ? Math.round(area(overlap)) : 0;
  const neighbourSquareMetres = area(neighbourArea);
  const elieSquareMetres = area(elieArea);
  const elieFeaturesInsideNeighbourStudyArea = elie.features.filter((item) => {
    const coordinates = pointCoordinates(item);
    return Boolean(coordinates && item.evidenceScope !== 'out_of_scope' && !item.tags.includes('map-hidden') && booleanPointInPolygon(point(coordinates), neighbourArea));
  }).length;
  return { neighbour: neighbour.project.name, neighbourProjectId: neighbour.project.id, overlapSquareMetres, shareOfElieStudyArea: Number((overlapSquareMetres / elieSquareMetres).toFixed(6)), shareOfNeighbourStudyArea: Number((overlapSquareMetres / neighbourSquareMetres).toFixed(6)), elieFeaturesInsideNeighbourStudyArea };
});

await writeFile(resolve('data/review/elie-boundary-overlap-audit-2026-08-26.json'), `${JSON.stringify({ reviewedAt, projectId: elie.project.id, boundarySource: elie.project.boundarySource, comparisons, decision: comparisons.every((item) => item.overlapSquareMetres === 0 && item.elieFeaturesInsideNeighbourStudyArea === 0) ? 'The reviewed Elie study area remains separate from Earlsferry, Kilconquhar and St Monans.' : 'Overlap remains and requires editorial review; no automatic reassignment was made.' }, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(comparisons));
