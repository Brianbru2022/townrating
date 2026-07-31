import { access, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

interface LocalHistoricMapManifest {
  projectId: string;
  mapId: string;
  title: string;
  displayDate: string;
  surveyStartYear: number;
  surveyEndYear: number;
  publicationYear: number;
  sourceInstitution: string;
  sourceUrl: string;
  licence: string;
  attribution: string;
  notes: string;
  bounds: [number, number, number, number];
  controlPoints: unknown[];
  approvedForPublication: boolean;
  tilePackageId: string;
}

const manifestDirectory = resolve('data/georeferencing/local-maps');
const projectFiles = new Map([
  ['alloa-scotland', resolve('data/projects/alloa.json')],
  ['alva-scotland', resolve('data/projects/alva.json')],
  ['culross-scotland', resolve('data/projects/culross.json')],
  ['kincardine-on-forth-scotland', resolve('data/projects/kincardine.json')],
]);
const manifestFiles = [
  'alloa-late-victorian.json',
  'alva-late-victorian.json',
  'culross-late-victorian.json',
  'kincardine-late-victorian.json',
];

for (const filename of manifestFiles) {
  const manifest = JSON.parse(
    await readFile(resolve(manifestDirectory, filename), 'utf8'),
  ) as LocalHistoricMapManifest;
  if (!manifest.approvedForPublication || manifest.controlPoints.length < 4)
    throw new Error(`${filename} has not passed the publication gate.`);
  await access(resolve('data/runtime/tiles', `${manifest.tilePackageId}.mbtiles`));
  const projectPath = projectFiles.get(manifest.projectId);
  if (!projectPath) throw new Error(`No registered project for ${manifest.projectId}.`);
  const projectPackage = JSON.parse(await readFile(projectPath, 'utf8')) as {
    historicMaps: Array<{ id?: string }>;
  };
  const layer = {
    id: manifest.mapId,
    projectId: manifest.projectId,
    title: manifest.title,
    displayDate: manifest.displayDate,
    surveyStartYear: manifest.surveyStartYear,
    surveyEndYear: manifest.surveyEndYear,
    publicationYear: manifest.publicationYear,
    sourceInstitution: manifest.sourceInstitution,
    sourceUrl: manifest.sourceUrl,
    licence: manifest.licence,
    attribution: manifest.attribution,
    notes: manifest.notes,
    layerType: 'georeferenced_raster_tiles',
    tileUrl: `/api/local-historic-maps/${manifest.tilePackageId}/{z}/{x}/{y}.png`,
    localPath: `data/runtime/tiles/${manifest.tilePackageId}.mbtiles`,
    bounds: manifest.bounds,
    opacity: 0.72,
    minZoom: 12,
    maxZoom: 19,
    georeferencingMethod: 'NLS publisher sheet-footprint transformation and local MBTiles package',
    georeferencingAccuracy: 'medium',
    controlPointCount: manifest.controlPoints.length,
  };
  projectPackage.historicMaps = [
    ...projectPackage.historicMaps.filter((map) => map.id === 'hes-listed-buildings-by-category'),
    layer,
  ];
  await writeFile(projectPath, `${JSON.stringify(projectPackage, null, 2)}\n`);
  console.log(`Published ${manifest.mapId} for ${manifest.projectId}.`);
}
