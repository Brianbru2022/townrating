import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import shp from 'shpjs';
import type { Feature, MultiPolygon, Polygon } from 'geojson';
import type { ProjectPackage } from '../src/domain/models';
import { bufferedTownBoundary } from '../src/domain/townStudy';

const reviewedAt = '2026-09-01T18:30:00.000Z';
const sourceUrl = 'https://www.nrscotland.gov.uk/media/im2nqu55/censuslocality2022_mhw.zip';
const targets: Record<string, string> = {
  arbroath: 'Arbroath',
  brechin: 'Brechin',
  carnoustie: 'Carnoustie',
  forfar: 'Forfar',
  monifieth: 'Monifieth',
  montrose: 'Montrose',
};

type BoundaryFeature = Feature<Polygon | MultiPolygon, {
  code?: string;
  name?: string;
  Popcount?: number;
}>;
type ShapeCollection = { features: BoundaryFeature[] };

const archive = await readFile(resolve('data/runtime/reference/nrs-localities-2022.zip'));
const parsed = await shp(archive) as ShapeCollection | ShapeCollection[];
const boundaries = (Array.isArray(parsed) ? parsed : [parsed]).flatMap((collection) => collection.features);
const report: Array<Record<string, unknown>> = [];

for (const [stem, locality] of Object.entries(targets)) {
  const projectPath = resolve(`data/projects/${stem}.json`);
  const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
  const boundary = boundaries.find((candidate) => candidate.properties.name === locality);
  if (!boundary) throw new Error(`NRS 2022 locality not found: ${locality}`);

  const localityBoundary: BoundaryFeature = {
    type: 'Feature',
    properties: boundary.properties,
    geometry: boundary.geometry,
  };
  const previousBoundarySource = pkg.project.boundarySource;
  const preservedVisitorBoundary = pkg.project.townStudyArea?.visitorBoundary;
  pkg.project.boundary = localityBoundary;
  pkg.project.boundarySource = 'National Records of Scotland 2022 Census Locality Boundary';
  pkg.project.townStudyArea = {
    localityName: locality,
    localityCode: String(boundary.properties.code ?? ''),
    sourceName: 'National Records of Scotland 2022 Census Locality Boundaries',
    sourceUrl,
    sourceVersion: '2022 Census Geography Products',
    bufferMetres: 500,
    localityBoundary,
    bufferedBoundary: bufferedTownBoundary(localityBoundary, 500),
    visitorBoundary: preservedVisitorBoundary ?? localityBoundary,
    notes: preservedVisitorBoundary
      ? 'The NRS locality is the strict HES assignment boundary. The pre-existing manually reviewed visitor boundary is retained separately for visitor facilities and attractions.'
      : 'The NRS locality is the strict HES and visitor assignment boundary; neighbouring attractions do not transfer merit into the town score.',
  };
  pkg.sources = [{
    id: 'nrs-localities-2022',
    name: 'National Records of Scotland 2022 Census Locality Boundaries',
    organisation: 'National Records of Scotland',
    coverage: `${locality} statistical locality`,
    accessMethod: 'Bundled official national Shapefile; exact locality-name match',
    sourceUrl,
    licence: 'Open Government Licence v3.0',
    reliability: 'official_non_statutory',
    limitations: 'A modern statistical settlement boundary, used transparently for strict town attribution rather than as a historic parish boundary.',
  }, ...pkg.sources.filter((source) => source.id !== 'nrs-localities-2022')];
  pkg.project.researchNotes = `${pkg.project.researchNotes ?? ''} Boundary correction 2026-09-01: replaced the early circular placeholder with official NRS 2022 locality ${String(boundary.properties.code ?? '')}; neighbouring attractions and facilities remain excluded unless inside the separately documented visitor boundary.`.trim();
  await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
  report.push({ projectId: pkg.project.id, locality, localityCode: boundary.properties.code, population2022: boundary.properties.Popcount, previousBoundarySource, retainedManualVisitorBoundary: Boolean(preservedVisitorBoundary) });
}

await writeFile(resolve('data/review/angus-principal-town-boundary-correction-2026-09-01.json'), `${JSON.stringify({ reviewedAt, sourceUrl, towns: report }, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(report, null, 2));
