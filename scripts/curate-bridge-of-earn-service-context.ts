import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { HeritageFeature, ProjectPackage, Reliability, SourceRecord } from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';

const projectPath = resolve(process.argv[2] ?? 'data/projects/bridge-of-earn.json');
const reviewPath = resolve(process.argv[3] ?? 'data/review/bridge-of-earn-service-context-review.json');
const curationPath = resolve('data/curation/bridge-of-earn-service-context-curation.json');
const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
const reviewedAt = new Date().toISOString();
const reviewedDate = reviewedAt.slice(0, 10);
const servicePolishNote =
  'Service polish note: Bridge of Earn has useful food, parking and family recreation services, but no mapped public toilet record was found during the current-place pass; retain zero tourist rating unless a wider visitor attraction is added.';

interface ServiceCurationEntry {
  featureId: string;
  group: 'food' | 'parking' | 'park' | 'playground' | 'memorial';
  summary: string;
  sourceName: string;
  sourceOrganisation: string;
  sourceUrl: string;
  reliability: Reliability;
  notes?: string;
}

const entries: ServiceCurationEntry[] = [
  {
    featureId: 'osm-community:node-3301456255',
    group: 'food',
    summary:
      'The Earn Coffee Shop is the strongest current visitor-service stop: a farm-shop cafe on the north edge of Bridge of Earn with coffee, lunch and cakes.',
    sourceName: 'The Earn Coffee Shop website',
    sourceOrganisation: 'The Earn Coffee Shop',
    sourceUrl: 'https://theearncoffeeshop.co.uk/',
    reliability: 'secondary',
    notes: 'Good practical stop for anyone passing through by car; not a heritage attraction.',
  },
  {
    featureId: 'osm-community:node-3886480375',
    group: 'food',
    summary:
      'The Village Inn and Restaurant is a central Bridge of Earn restaurant-bar, useful as the main sit-down food stop in the village core.',
    sourceName: 'The Village Inn Bridge of Earn website',
    sourceOrganisation: 'The Village Inn',
    sourceUrl: 'https://www.thevillageinn-bridgeofearn.foodndrinkscotland.co.uk/',
    reliability: 'secondary',
  },
  {
    featureId: 'osm-community:node-4460996150',
    group: 'food',
    summary:
      'Village Spice Garden is a Main Street Indian restaurant/takeaway with online ordering, most useful as evening food service rather than a visitor draw.',
    sourceName: 'Village Spice Garden website',
    sourceOrganisation: 'Village Spice Garden',
    sourceUrl: 'https://villagespicegarden.com/',
    reliability: 'secondary',
  },
  {
    featureId: 'osm-community:node-4460996154',
    group: 'food',
    summary:
      'Tower Bakery is the local Main Street bakery branch, useful for bread, cakes and quick takeaway food during a practical stop.',
    sourceName: 'Tower Bakery shop locations',
    sourceOrganisation: 'Tower Bakery',
    sourceUrl: 'https://www.towerbakery.co.uk/shops/',
    reliability: 'secondary',
  },
  {
    featureId: 'osm-park:way-137101366',
    group: 'park',
    summary:
      'Victory Park is the main current recreation ground and local green-space context in Bridge of Earn, with a recently regenerated play area.',
    sourceName: 'Foundation Scotland Victory Park regeneration article',
    sourceOrganisation: 'Foundation Scotland',
    sourceUrl:
      'https://www.foundationscotland.org.uk/about-us/our-news/bridge-of-earn-children-benefit-from-victory-park-victory',
    reliability: 'secondary',
  },
  {
    featureId: 'osm-community:way-137101374',
    group: 'playground',
    summary:
      'Victory Park playground is the most useful family-service stop in the village, part of the regenerated Victory Park recreation area.',
    sourceName: 'Foundation Scotland Victory Park regeneration article',
    sourceOrganisation: 'Foundation Scotland',
    sourceUrl:
      'https://www.foundationscotland.org.uk/about-us/our-news/bridge-of-earn-children-benefit-from-victory-park-victory',
    reliability: 'secondary',
  },
  {
    featureId: 'osm-community:node-3301519291',
    group: 'memorial',
    summary:
      'Bridge of Earn War Memorial is a village-centre commemorative landmark beside the Public Hall and Institute, not a tourist destination by itself.',
    sourceName: 'War Memorials Online record',
    sourceOrganisation: 'War Memorials Online',
    sourceUrl: 'https://www.warmemorialsonline.org.uk/memorial/127121',
    reliability: 'secondary',
  },
  {
    featureId: 'osm-community:way-147995349',
    group: 'parking',
    summary:
      'Mapped surface parking serving The Earn Coffee Shop/farm-shop stop on the north edge of Bridge of Earn.',
    sourceName: 'OpenStreetMap service-context review',
    sourceOrganisation: 'OpenStreetMap contributors',
    sourceUrl: 'https://www.openstreetmap.org/way/147995349',
    reliability: 'discovery_only',
  },
  {
    featureId: 'osm-community:way-844332625',
    group: 'parking',
    summary:
      'Mapped parking near the village-centre/Victory Park service cluster; useful for short local stops.',
    sourceName: 'OpenStreetMap service-context review',
    sourceOrganisation: 'OpenStreetMap contributors',
    sourceUrl: 'https://www.openstreetmap.org/way/844332625',
    reliability: 'discovery_only',
  },
  {
    featureId: 'osm-community:way-1107763327',
    group: 'parking',
    summary:
      'Mapped village-centre parking close to Victory Park and the war memorial/service cluster.',
    sourceName: 'OpenStreetMap service-context review',
    sourceOrganisation: 'OpenStreetMap contributors',
    sourceUrl: 'https://www.openstreetmap.org/way/1107763327',
    reliability: 'discovery_only',
  },
  {
    featureId: 'osm-community:way-111408024',
    group: 'parking',
    summary:
      'Mapped north-side parking context; useful locally but not a visitor facility worth highlighting beyond services.',
    sourceName: 'OpenStreetMap service-context review',
    sourceOrganisation: 'OpenStreetMap contributors',
    sourceUrl: 'https://www.openstreetmap.org/way/111408024',
    reliability: 'discovery_only',
  },
  {
    featureId: 'osm-community:node-5430013607',
    group: 'parking',
    summary: 'Mapped roadside lay-by parking context on the Kintillo/south approach.',
    sourceName: 'OpenStreetMap service-context review',
    sourceOrganisation: 'OpenStreetMap contributors',
    sourceUrl: 'https://www.openstreetmap.org/node/5430013607',
    reliability: 'discovery_only',
  },
  {
    featureId: 'osm-community:node-5440844860',
    group: 'parking',
    summary: 'Mapped roadside lay-by parking context on the Kintillo/south approach.',
    sourceName: 'OpenStreetMap service-context review',
    sourceOrganisation: 'OpenStreetMap contributors',
    sourceUrl: 'https://www.openstreetmap.org/node/5440844860',
    reliability: 'discovery_only',
  },
  {
    featureId: 'osm-community:way-137101375',
    group: 'parking',
    summary: 'Mapped edge-of-village parking context; useful locally but not a visitor draw.',
    sourceName: 'OpenStreetMap service-context review',
    sourceOrganisation: 'OpenStreetMap contributors',
    sourceUrl: 'https://www.openstreetmap.org/way/137101375',
    reliability: 'discovery_only',
  },
  {
    featureId: 'osm-community:way-385332736',
    group: 'parking',
    summary: 'Mapped south-side parking context; useful locally but not a visitor draw.',
    sourceName: 'OpenStreetMap service-context review',
    sourceOrganisation: 'OpenStreetMap contributors',
    sourceUrl: 'https://www.openstreetmap.org/way/385332736',
    reliability: 'discovery_only',
  },
  {
    featureId: 'osm-community:way-844705173',
    group: 'parking',
    summary: 'Mapped residential/service parking context in Bridge of Earn.',
    sourceName: 'OpenStreetMap service-context review',
    sourceOrganisation: 'OpenStreetMap contributors',
    sourceUrl: 'https://www.openstreetmap.org/way/844705173',
    reliability: 'discovery_only',
  },
  {
    featureId: 'osm-community:way-916656000',
    group: 'parking',
    summary: 'Mapped west-edge surface parking context; useful locally but not a visitor draw.',
    sourceName: 'OpenStreetMap service-context review',
    sourceOrganisation: 'OpenStreetMap contributors',
    sourceUrl: 'https://www.openstreetmap.org/way/916656000',
    reliability: 'discovery_only',
  },
  {
    featureId: 'osm-community:way-1020089706',
    group: 'parking',
    summary: 'Mapped south/village-edge parking context; useful locally but not a visitor draw.',
    sourceName: 'OpenStreetMap service-context review',
    sourceOrganisation: 'OpenStreetMap contributors',
    sourceUrl: 'https://www.openstreetmap.org/way/1020089706',
    reliability: 'discovery_only',
  },
  {
    featureId: 'osm-community:way-1221386720',
    group: 'parking',
    summary: 'Mapped residential/service parking context in Bridge of Earn.',
    sourceName: 'OpenStreetMap service-context review',
    sourceOrganisation: 'OpenStreetMap contributors',
    sourceUrl: 'https://www.openstreetmap.org/way/1221386720',
    reliability: 'discovery_only',
  },
  {
    featureId: 'osm-community:way-931993901',
    group: 'playground',
    summary: 'Mapped local playground in the southern residential part of Bridge of Earn.',
    sourceName: 'OpenStreetMap service-context review',
    sourceOrganisation: 'OpenStreetMap contributors',
    sourceUrl: 'https://www.openstreetmap.org/way/931993901',
    reliability: 'discovery_only',
  },
  {
    featureId: 'osm-community:way-933607435',
    group: 'playground',
    summary: 'Mapped local playground in the southern residential part of Bridge of Earn.',
    sourceName: 'OpenStreetMap service-context review',
    sourceOrganisation: 'OpenStreetMap contributors',
    sourceUrl: 'https://www.openstreetmap.org/way/933607435',
    reliability: 'discovery_only',
  },
];

function addTags(feature: HeritageFeature, ...tags: string[]): void {
  feature.tags = [...new Set([...feature.tags, ...tags])];
}

for (const entry of entries) {
  const feature = pkg.features.find((candidate) => candidate.id === entry.featureId);
  if (!feature) throw new Error(`Missing Bridge of Earn service-context target ${entry.featureId}.`);
  const source: SourceRecord = {
    sourceName: entry.sourceName,
    sourceOrganisation: entry.sourceOrganisation,
    sourceRecordId: `service-context-curation:${entry.featureId}`,
    sourceUrl: entry.sourceUrl,
    accessedAt: reviewedAt,
    reliability: entry.reliability,
    notes: `Bridge of Earn service-context curation: description=${entry.summary}${entry.notes ? `; ${entry.notes}` : ''}.`,
  };
  feature.shortDescription = entry.summary;
  feature.sourceRecords = [
    ...feature.sourceRecords.filter((record) => record.sourceRecordId !== source.sourceRecordId),
    source,
  ];
  feature.updatedAt = reviewedAt;
  feature.reviewed = true;
  addTags(feature, 'bridge-of-earn-service-polished', `service-context-${entry.group}`);
  feature.reviewNotes =
    `${feature.reviewNotes ?? ''} Bridge of Earn service-context polish reviewed against ${entry.sourceOrganisation} on ${reviewedDate}.`.trim();
}

const researchNotes = pkg.project.researchNotes ?? '';
if (!researchNotes.includes(servicePolishNote)) {
  pkg.project.researchNotes = `${researchNotes} ${servicePolishNote}`.trim();
}

pkg.validation = validateFeatures(pkg.project, pkg.features);
const errors = pkg.validation.filter((item) => item.severity === 'error');
if (errors.length) throw new Error(`Refusing to write ${errors.length} validation error(s).`);

await mkdir(dirname(reviewPath), { recursive: true });
await mkdir(dirname(curationPath), { recursive: true });
await writeFile(
  reviewPath,
  `${JSON.stringify(
    {
      projectId: pkg.project.id,
      reviewedAt,
      policy:
        'Curated every imported current service record for Bridge of Earn: food, parking, park/playgrounds and memorial context. These remain present-day service records, not historic-date evidence.',
      toilets:
        'No public-toilet current-place record was imported for the Bridge of Earn locality; Perth and Kinross public-toilet sources were checked for regional context, but no Bridge of Earn toilet record was added.',
      curated: entries.map(({ featureId, group, summary, sourceOrganisation, sourceUrl }) => ({
        featureId,
        group,
        summary,
        sourceOrganisation,
        sourceUrl,
      })),
    },
    null,
    2,
  )}\n`,
  'utf8',
);
await writeFile(curationPath, `${JSON.stringify(entries, null, 2)}\n`, 'utf8');
await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');

console.log(`Polished ${entries.length} Bridge of Earn service-context record(s).`);
