import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { DataSourceDefinition, ProjectPackage } from '../src/domain/models';

const projectPath = resolve(process.argv[2] ?? 'data/projects/biggar.json');
const reportPath = resolve(process.argv[3] ?? 'data/review/biggar-initial-source-audit.json');
const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
const accessedAt = new Date().toISOString();

const councilSource: DataSourceDefinition = {
  id: 'south-lanarkshire-biggar-conservation-area',
  name: 'Biggar Conservation Area',
  organisation: 'South Lanarkshire Council',
  coverage:
    'Council conservation-area boundary and statutory context for the historic core of Biggar.',
  accessMethod: 'Council publication and conservation-area map.',
  sourceUrl:
    'https://www.southlanarkshire.gov.uk/download/downloads/id/10850/biggar_conservation_area.pdf',
  licence:
    'Copyright South Lanarkshire Council; cited as contextual evidence only, not redistributed as a map overlay.',
  reliability: 'local_authority',
  limitations:
    'The document confirms conservation-area context. It is not used to infer individual feature construction dates or to create settlement-age geometry.',
};
pkg.sources = [councilSource, ...pkg.sources.filter((source) => source.id !== councilSource.id)];

const listedBuildings = pkg.features.filter((feature) =>
  feature.tags.includes('hes-listed-building'),
);
const report = {
  projectId: pkg.project.id,
  generatedAt: accessedAt,
  purpose:
    'Initial Biggar source audit. Records locally supplied source collections inspected before publication and explicitly records material not applied to Biggar.',
  usedLocalSources: [
    'D:\\Map Data\\Scotland HES\\lb_scotland\\Listed_Buildings.*',
    'D:\\Map Data\\Scotland HES\\lb_scotland\\Listed_Buildings_boundaries.*',
    'D:\\Map Data\\Scotland HES\\Canmore_Points\\Canmore_Points.*',
    'D:\\Map Data\\Scotland HES\\ca_scotland\\Conservation_Areas.*',
    'D:\\Map Data\\Scotland HES\\sam_scotland\\Scheduled_Monuments.*',
    'D:\\Map Data\\Scotland HES\\gdl_scotland\\Gardens_and_Designed_Landscapes.*',
    'D:\\Map Data\\Scotland HES\\battlefields_scotland\\Battlefields_Inventory_Boundary.*',
    'D:\\Map Data\\Scotland HES\\pic\\properties_in_care.*',
    'D:\\Map Data\\Scotland HES\\WHS\\World_Heritage_Sites.*',
    'D:\\Map Data\\Scotland HES\\HMPA_scotland\\Historic_Marine_Protected_Areas.*',
    'data/runtime/reference/nrs-localities-2022.zip',
  ],
  reviewedButNotApplied: [
    'The Alloa, Alva, Culross, Kincardine-on-Forth and Tillicoultry heritage packs: town-specific records, not Biggar evidence.',
    'South Lanarkshire planning documents supplied locally: not a feature-level historic-environment inventory.',
    'No Biggar-specific heritage pack, licensed historic-map raster, or reviewed settlement-age geometry was found among the supplied local files.',
  ],
  importResults: {
    listedBuildings: listedBuildings.length,
    insideNrsLocality: listedBuildings.filter((feature) =>
      feature.tags.includes('town-selection-inside-locality'),
    ).length,
    heritageBufferCandidates: listedBuildings.filter((feature) =>
      feature.tags.includes('town-selection-heritage-buffer'),
    ).length,
    nrhePoints: pkg.features.filter((feature) => feature.id.startsWith('nrhe:')).length,
    statutoryAreas: pkg.features.filter((feature) =>
      /^hes-(?:conservation-area|scheduled-monument|designed-landscape):/.test(feature.id),
    ).length,
    currentOsmPlaces: pkg.features.filter((feature) => feature.tags.includes('osm-community-place'))
      .length,
  },
  publicationLimitations: [
    'No Biggar historic-map overlay is published until a source, licence, coverage and rendering review are complete.',
    'No settlement-age polygons are published until evidence-backed, reviewed geometry is available.',
    'Only source-backed historic-period dates are shown; remaining undated records are exposed through the date-review CSV rather than guessed.',
  ],
};

await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(`Recorded Biggar provenance and source audit at ${reportPath}.`);
