import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { distance, point } from '@turf/turf';
import type { HeritageFeature, ProjectPackage, SourceRecord } from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';

const projectPath = resolve(process.argv[2] ?? 'data/projects/culross.json');
const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
const accessedAt = new Date().toISOString();

interface CommunityCandidate {
  id: string;
  name: string;
  featureType: 'memorial' | 'plaque';
  coordinates: [number, number];
  dateText: string;
  year: number;
  description: string;
  sources: SourceRecord[];
}

const candidates: CommunityCandidate[] = [
  {
    id: 'community:culross-cochrane-monument',
    name: 'Admiral Lord Thomas Alexander Cochrane monument',
    featureType: 'memorial',
    coordinates: [-3.6307468, 56.0552943],
    dateText: 'Present by Fife Council’s 2009 appraisal; installation date not established',
    year: 2009,
    description:
      'Bronze bust on a stone plinth with bronze plaque, recorded by Fife Council between Culross Palace and the Town House.',
    sources: [
      {
        sourceName: 'Culross Conservation Area Appraisal and Management Plan',
        sourceOrganisation: 'Fife Council',
        sourceUrl:
          'https://www.fife.gov.uk/__data/assets/pdf_file/0029/155918/Culross-Conservation-Area-Appraisal-and-Management-Plan.pdf',
        accessedAt,
        licence: 'Public council document; record metadata only, no imagery redistributed.',
        reliability: 'local_authority',
        quotedDateText:
          'The Cochrane monument has several elements: a bronze bust on a stone plinth with a bronze plaque.',
      },
      {
        sourceName: 'OpenStreetMap Nominatim discovery coordinate',
        sourceOrganisation: 'OpenStreetMap contributors',
        sourceRecordId: 'node/4995290444',
        sourceUrl: 'https://www.openstreetmap.org/node/4995290444',
        accessedAt,
        licence: 'ODbL 1.0; coordinate used as supplementary location evidence.',
        reliability: 'discovery_only',
      },
    ],
  },
  {
    id: 'community:culross-witch-memorial-plaque',
    name: 'Culross witch memorial plaque',
    featureType: 'plaque',
    coordinates: [-3.630637, 56.05512],
    dateText:
      'Present by the referenced memorial record (2025); installation date requires local primary confirmation',
    year: 2025,
    description:
      'Bronze plaque commemorating people accused of witchcraft in Culross. The memorial register supplies the coordinate and refers to the Women of Scotland memorial record.',
    sources: [
      {
        sourceName: 'Women of Scotland memorial record (via referenced Wikidata entry)',
        sourceOrganisation: 'Women of Scotland',
        sourceRecordId: 'plaque-alleged-witches-culross',
        sourceUrl: 'https://womenofscotland.org.uk/memorials/plaque-alleged-witches-culross',
        accessedAt,
        licence: 'Metadata and link only; no imagery redistributed. Reuse terms not stated.',
        reliability: 'secondary',
      },
      {
        sourceName: 'Wikidata memorial coordinate reference',
        sourceOrganisation: 'Wikimedia community',
        sourceRecordId: 'Q123250198',
        sourceUrl: 'https://www.wikidata.org/wiki/Q123250198',
        accessedAt,
        licence: 'CC0 structured-data record; used as a supplementary coordinate reference.',
        reliability: 'discovery_only',
      },
    ],
  },
];

function duplicate(candidate: CommunityCandidate): HeritageFeature | undefined {
  return pkg.features.find((feature) => {
    const sourceIds = new Set(feature.sourceRecords.map((source) => source.sourceRecordId));
    if (
      candidate.sources.some(
        (source) => source.sourceRecordId && sourceIds.has(source.sourceRecordId),
      )
    )
      return true;
    if (feature.geometry?.type !== 'Point') return false;
    return (
      feature.name.toLocaleLowerCase() === candidate.name.toLocaleLowerCase() &&
      distance(point(feature.geometry.coordinates), point(candidate.coordinates), {
        units: 'kilometers',
      }) < 0.03
    );
  });
}

const published: string[] = [];
const skipped: string[] = [];
for (const candidate of candidates) {
  if (duplicate(candidate)) {
    skipped.push(candidate.id);
    continue;
  }
  pkg.features.push({
    id: candidate.id,
    projectId: pkg.project.id,
    name: candidate.name,
    alternativeNames: [],
    countryCode: pkg.project.countryCode,
    region: pkg.project.region,
    locality: pkg.project.locality,
    featureType: candidate.featureType,
    designationType: 'Community memorial record',
    significance: 'local',
    geometry: { type: 'Point', coordinates: candidate.coordinates },
    locationType: 'exact',
    documentedDateText: candidate.dateText,
    earliestPossibleYear: candidate.year,
    latestPossibleYear: candidate.year,
    dateBasis: 'present_by',
    dateConfidence: 'low',
    locationConfidence: 'medium',
    survival: 'unknown',
    shortDescription: candidate.description,
    sourceRecords: candidate.sources,
    licence: 'Record metadata only; see individual source licences and attribution.',
    tags: ['community-layer', candidate.featureType === 'plaque' ? 'plaque' : 'memorial'],
    createdAt: accessedAt,
    updatedAt: accessedAt,
    reviewed: true,
    evidenceScope: 'parish_evidence',
    reviewNotes:
      'Published after duplicate screening. Installation date is not claimed where the source does not establish it.',
  });
  published.push(candidate.id);
}

pkg.validation = validateFeatures(pkg.project, pkg.features);
const errors = pkg.validation.filter((item) => item.severity === 'error');
if (errors.length) throw new Error(`Refusing to write ${errors.length} validation error(s).`);
await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
console.log(
  `Published ${published.length} community record(s); skipped ${skipped.length} duplicate(s).`,
);
