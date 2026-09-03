import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { HeritageFeature, ProjectPackage, Reliability, SourceRecord } from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';

const projectPath = resolve(process.argv[2] ?? 'data/projects/dunning.json');
const reviewPath = resolve(process.argv[3] ?? 'data/review/dunning-visitor-context-review.json');
const curationPath = resolve('data/curation/dunning-visitor-context-curation.json');
const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
const reviewedAt = new Date().toISOString();
const reviewedDate = reviewedAt.slice(0, 10);
const visitorPolishNote =
  'Visitor polish note: Dunning is a niche detour rather than a full tourist town, but St Serf\'s Church and Dupplin Cross, the Roman-camp/Dun Knock/Thorn Tree context, the Kirkstyle Inn, Rollo Recreation Ground toilets, parking and small rest stops make it practical for a short heritage visit.';

interface VisitorCurationEntry {
  featureId: string;
  group:
    | 'food'
    | 'toilets'
    | 'parking'
    | 'park'
    | 'playground'
    | 'picnic'
    | 'visitor'
    | 'heritage'
    | 'memorial';
  summary: string;
  sourceName: string;
  sourceOrganisation: string;
  sourceUrl: string;
  reliability: Reliability;
  notes?: string;
}

function addTags(feature: HeritageFeature, ...tags: string[]): void {
  feature.tags = [...new Set([...feature.tags, ...tags])];
}

function appendReviewNote(feature: HeritageFeature, note: string): void {
  if (feature.reviewNotes?.includes(note)) return;
  feature.reviewNotes = `${feature.reviewNotes ? `${feature.reviewNotes} ` : ''}${note}`.trim();
}

function upsertSource(feature: HeritageFeature, source: SourceRecord): void {
  feature.sourceRecords = [
    ...feature.sourceRecords.filter((record) => record.sourceRecordId !== source.sourceRecordId),
    source,
  ];
}

function ensureDunningToiletFeature(): HeritageFeature {
  const existing = pkg.features.find((feature) => feature.id === 'pkc-public-toilet:124080925');
  if (existing) {
    existing.licence =
      'Open Government Licence v3.0; contains Ordnance Survey data under the stated Perth and Kinross Council attribution.';
    return existing;
  }
  const feature: HeritageFeature = {
    id: 'pkc-public-toilet:124080925',
    projectId: pkg.project.id,
    name: 'Rollo Recreation Ground Public Toilet',
    alternativeNames: ['Public Toilet, Rollo Recreation Ground, Station Road, Dunning'],
    countryCode: pkg.project.countryCode,
    region: pkg.project.region,
    locality: pkg.project.locality,
    address: 'Rollo Recreation Ground, Station Road, Dunning',
    featureType: 'amenities',
    significance: 'recognised',
    geometry: {
      type: 'Point',
      coordinates: [-3.5912178868439755, 56.313121304628758],
    },
    locationType: 'exact',
    locationConfidence: 'high',
    dateBasis: 'unknown',
    dateConfidence: 'unknown',
    survival: 'unknown',
    shortDescription:
      'Current public toilet/comfort-scheme record at Rollo Recreation Ground on Station Road, useful for short Dunning visits.',
    sourceRecords: [],
    licence:
      'Open Government Licence v3.0; contains Ordnance Survey data under the stated Perth and Kinross Council attribution.',
    tags: [
      'current-context',
      'pkc-public-toilet',
      'dunning-service-polished',
      'service-context-toilets',
    ],
    createdAt: reviewedAt,
    updatedAt: reviewedAt,
    reviewed: true,
    reviewNotes:
      'Added from Perth and Kinross Council public toilets/comfort schemes data as present-day visitor-service context, not historic-date evidence.',
    evidenceScope: 'related_context',
  };
  pkg.features.push(feature);
  return feature;
}

const entries: VisitorCurationEntry[] = [
  {
    featureId: 'hes-property-in-care:pic066',
    group: 'heritage',
    summary:
      'Dupplin Cross is the strongest visitor draw in Dunning: an early 9th-century Pictish cross displayed at St Serf\'s Church.',
    sourceName: 'Historic Environment Scotland visitor information',
    sourceOrganisation: 'Historic Environment Scotland',
    sourceUrl: 'https://www.historicenvironment.scot/visit/all/st-serfs-church-and-dupplin-cross/',
    reliability: 'official_non_statutory',
    notes: 'Use as the main reason for Dunning having niche tourist appeal.',
  },
  {
    featureId: 'hes-scheduled-monument:SM90321',
    group: 'heritage',
    summary:
      'St Serf\'s Church combines a medieval church site, Romanesque carving and the protected display setting for the Dupplin Cross.',
    sourceName: 'Historic Environment Scotland visitor information',
    sourceOrganisation: 'Historic Environment Scotland',
    sourceUrl: 'https://www.historicenvironment.scot/visit/all/st-serfs-church-and-dupplin-cross/',
    reliability: 'official_non_statutory',
  },
  {
    featureId: 'osm-community:node-12022638574',
    group: 'visitor',
    summary:
      'The Roman Camp at Dunning information board is useful orientation for a short village heritage walk.',
    sourceName: 'Dunning Parish Historical Society village guide',
    sourceOrganisation: 'Dunning Parish Historical Society',
    sourceUrl: 'https://dunning.uk.net/',
    reliability: 'secondary',
  },
  {
    featureId: 'osm-community:node-2553037364',
    group: 'heritage',
    summary:
      'Kincladie Wood Roman camp is the visible Roman context for Dunning, best treated as landscape/interpretation interest rather than a staffed attraction.',
    sourceName: 'Dunning Parish Historical Society village guide',
    sourceOrganisation: 'Dunning Parish Historical Society',
    sourceUrl: 'https://dunning.uk.net/',
    reliability: 'secondary',
  },
  {
    featureId: 'osm-community:way-702241566',
    group: 'heritage',
    summary:
      'Kincladie Wood Roman camp wall adds local landscape evidence for the Roman-camp stop north-west of the village.',
    sourceName: 'Dunning Parish Historical Society village guide',
    sourceOrganisation: 'Dunning Parish Historical Society',
    sourceUrl: 'https://dunning.uk.net/',
    reliability: 'secondary',
  },
  {
    featureId: 'hes-scheduled-monument:SM9434',
    group: 'heritage',
    summary:
      'Dun Knock fort is the Iron Age hillfort context above Dunning, adding depth for visitors who are deliberately seeking archaeology.',
    sourceName: 'Dunning Parish Historical Society village guide',
    sourceOrganisation: 'Dunning Parish Historical Society',
    sourceUrl: 'https://dunning.uk.net/',
    reliability: 'secondary',
  },
  {
    featureId: 'osm-community:node-4802470557',
    group: 'memorial',
    summary:
      'The Thorn Tree is a small village-centre memorial/context stop tied to Dunning local tradition.',
    sourceName: 'Dunning Parish Historical Society village guide',
    sourceOrganisation: 'Dunning Parish Historical Society',
    sourceUrl: 'https://dunning.uk.net/',
    reliability: 'secondary',
  },
  {
    featureId: 'osm-community:node-4802470568',
    group: 'memorial',
    summary:
      'Dunning War Memorial is a village-centre commemorative landmark, useful for orientation but not a destination by itself.',
    sourceName: 'War Memorials Online record',
    sourceOrganisation: 'War Memorials Online',
    sourceUrl: 'https://www.warmemorialsonline.org.uk/memorial/146642',
    reliability: 'secondary',
  },
  {
    featureId: 'osm-community:node-13144236115',
    group: 'memorial',
    summary:
      'Dunning War Comforts Committee Memorial is a small commemorative plaque context record, not a tourist draw on its own.',
    sourceName: 'Imperial War Museums war memorial register',
    sourceOrganisation: 'Imperial War Museums',
    sourceUrl: 'https://memorials.iwm.org.uk/memorial/82166',
    reliability: 'secondary',
  },
  {
    featureId: 'osm-community:way-488053718',
    group: 'food',
    summary:
      'The Kirkstyle Inn is Dunning\'s main visitor food/accommodation stop, giving the village a practical pub-and-rooms base close to St Serf\'s.',
    sourceName: 'The Kirkstyle Inn website',
    sourceOrganisation: 'The Kirkstyle Inn',
    sourceUrl: 'https://www.thekirkstyleinn.co.uk/',
    reliability: 'secondary',
  },
  {
    featureId: 'pkc-public-toilet:124080925',
    group: 'toilets',
    summary:
      'Rollo Recreation Ground Public Toilet is an open comfort-scheme/public-toilet record on Station Road, with unisex and accessible toilet provision listed by Perth and Kinross Council.',
    sourceName: 'Perth and Kinross public toilets and comfort schemes dataset',
    sourceOrganisation: 'Perth and Kinross Council',
    sourceUrl:
      'https://open-data-perth-kinross.hub.arcgis.com/datasets/fe5be39db17c4e98b0fe11fb2b4fabe2_3/explore',
    reliability: 'local_authority',
    notes:
      'Dataset record: Monday to Friday and Saturday 7.00 am to 3.00 pm; all year round; unisex toilet; suitable for disabled use; status Open.',
  },
  {
    featureId: 'osm-community:way-1085882188',
    group: 'parking',
    summary:
      'Mapped surface parking by Rollo Recreation Ground supports the toilet, play and short village heritage stops.',
    sourceName: 'OpenStreetMap service-context review',
    sourceOrganisation: 'OpenStreetMap contributors',
    sourceUrl: 'https://www.openstreetmap.org/way/1085882188',
    reliability: 'discovery_only',
  },
  {
    featureId: 'osm-park:way-1085882196',
    group: 'park',
    summary:
      'Rollo Park is Dunning\'s main mapped recreation-ground context and a practical family stop rather than a heritage attraction.',
    sourceName: 'OpenStreetMap service-context review',
    sourceOrganisation: 'OpenStreetMap contributors',
    sourceUrl: 'https://www.openstreetmap.org/way/1085882196',
    reliability: 'discovery_only',
  },
  {
    featureId: 'osm-park:way-1085882191',
    group: 'park',
    summary:
      'Dunning Tennis Club is mapped recreation context in the village service cluster.',
    sourceName: 'OpenStreetMap service-context review',
    sourceOrganisation: 'OpenStreetMap contributors',
    sourceUrl: 'https://www.openstreetmap.org/way/1085882191',
    reliability: 'discovery_only',
  },
  {
    featureId: 'osm-community:way-1013567606',
    group: 'playground',
    summary: 'Mapped playground beside Rollo Park, useful for family stops in the village.',
    sourceName: 'OpenStreetMap service-context review',
    sourceOrganisation: 'OpenStreetMap contributors',
    sourceUrl: 'https://www.openstreetmap.org/way/1013567606',
    reliability: 'discovery_only',
  },
  {
    featureId: 'osm-community:way-1013568423',
    group: 'playground',
    summary: 'Mapped playground/recreation context in Dunning, useful locally but not a visitor draw.',
    sourceName: 'OpenStreetMap service-context review',
    sourceOrganisation: 'OpenStreetMap contributors',
    sourceUrl: 'https://www.openstreetmap.org/way/1013568423',
    reliability: 'discovery_only',
  },
  {
    featureId: 'osm-community:node-12022637366',
    group: 'picnic',
    summary: 'Mapped picnic table close to the village service cluster, useful for short stops.',
    sourceName: 'OpenStreetMap service-context review',
    sourceOrganisation: 'OpenStreetMap contributors',
    sourceUrl: 'https://www.openstreetmap.org/node/12022637366',
    reliability: 'discovery_only',
  },
  {
    featureId: 'osm-community:node-4804188236',
    group: 'picnic',
    summary: 'Mapped bench/rest point in Dunning, useful as minor current visitor context.',
    sourceName: 'OpenStreetMap service-context review',
    sourceOrganisation: 'OpenStreetMap contributors',
    sourceUrl: 'https://www.openstreetmap.org/node/4804188236',
    reliability: 'discovery_only',
  },
  {
    featureId: 'osm-community:node-13890951709',
    group: 'picnic',
    summary: 'Mapped bench/rest point in Dunning, useful as minor current visitor context.',
    sourceName: 'OpenStreetMap service-context review',
    sourceOrganisation: 'OpenStreetMap contributors',
    sourceUrl: 'https://www.openstreetmap.org/node/13890951709',
    reliability: 'discovery_only',
  },
  {
    featureId: 'osm-community:node-13002270145',
    group: 'picnic',
    summary: 'Mapped drinking-fountain/rest context in Dunning, useful as a minor practical stop.',
    sourceName: 'OpenStreetMap service-context review',
    sourceOrganisation: 'OpenStreetMap contributors',
    sourceUrl: 'https://www.openstreetmap.org/node/13002270145',
    reliability: 'discovery_only',
  },
];

ensureDunningToiletFeature();

for (const entry of entries) {
  const feature = pkg.features.find((candidate) => candidate.id === entry.featureId);
  if (!feature) throw new Error(`Missing Dunning visitor-context target ${entry.featureId}.`);
  const source: SourceRecord = {
    sourceName: entry.sourceName,
    sourceOrganisation: entry.sourceOrganisation,
    sourceRecordId: `visitor-context-curation:${entry.featureId}`,
    sourceUrl: entry.sourceUrl,
    accessedAt: reviewedAt,
    reliability: entry.reliability,
    notes: `Dunning visitor-context curation: description=${entry.summary}${entry.notes ? `; ${entry.notes}` : ''}.`,
  };
  feature.shortDescription = entry.summary;
  feature.updatedAt = reviewedAt;
  feature.reviewed = true;
  upsertSource(feature, source);
  addTags(feature, 'dunning-service-polished', `service-context-${entry.group}`);
  appendReviewNote(
    feature,
    `Dunning visitor-context polish reviewed against ${entry.sourceOrganisation} on ${reviewedDate}.`,
  );
}

const researchNotes = pkg.project.researchNotes ?? '';
if (!researchNotes.includes(visitorPolishNote)) {
  pkg.project.researchNotes = `${researchNotes} ${visitorPolishNote}`.trim();
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
        'Curated practical Dunning visitor context for heritage orientation, food, toilets, parking, parks, playgrounds, picnic/rest points and memorials. Records remain current context, not historic-date evidence.',
      toilets:
        'Added Perth and Kinross Council public toilets/comfort schemes record for Rollo Recreation Ground, Station Road, Dunning.',
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

console.log(`Polished ${entries.length} Dunning visitor-context record(s).`);
