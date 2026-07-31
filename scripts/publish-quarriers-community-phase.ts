import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type {
  DataSourceDefinition,
  HeritageFeature,
  ProjectPackage,
  SourceRecord,
} from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';

const projectPath = resolve(process.argv[2] ?? 'data/projects/quarriers-village.json');
const reportPath = resolve(process.argv[3] ?? 'data/review/quarriers-village-community-phase.json');
const accessedAt = new Date().toISOString();
const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;

const osmArtworkId = 'osm-community:node-424363738';
const osmMemorialId = 'osm-community:node-13202468343';
const officialMemorialId = 'nrhe:340549';

function upsertSource(source: DataSourceDefinition): void {
  const index = pkg.sources.findIndex((candidate) => candidate.id === source.id);
  if (index >= 0) pkg.sources[index] = source;
  else pkg.sources.push(source);
}

function source(record: Omit<SourceRecord, 'accessedAt'>): SourceRecord {
  return { ...record, accessedAt };
}

function upsertFeature(feature: HeritageFeature): void {
  const index = pkg.features.findIndex((candidate) => candidate.id === feature.id);
  if (index >= 0) pkg.features[index] = feature;
  else pkg.features.push(feature);
}

function uniqueSources(records: SourceRecord[]): SourceRecord[] {
  const seen = new Set<string>();
  return records.filter((record) => {
    const key = `${record.sourceOrganisation}:${record.sourceRecordId ?? record.sourceUrl ?? record.sourceName}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const originalArtwork =
  pkg.features.find((feature) => feature.id === osmArtworkId) ??
  pkg.features.find((feature) => feature.id === 'curated:public-art-the-lost-xvii');
if (!originalArtwork?.geometry || originalArtwork.geometry.type !== 'Point')
  throw new Error('Expected the imported OSM XVII Legion artwork point before community curation.');

// Keep the OSM source ID on the curated feature: this prevents a later Overpass
// refresh from creating a second marker for the same sculpture.
pkg.features = pkg.features.filter(
  (feature) => feature.id !== osmArtworkId && feature.id !== 'curated:public-art-the-lost-xvii',
);
upsertFeature({
  ...originalArtwork,
  id: 'curated:public-art-the-lost-xvii',
  name: 'The Lost XVII',
  alternativeNames: ['XVII Legion'],
  featureType: 'public_art',
  significance: 'local',
  statutoryStatus: 'Not designated',
  locationType: 'exact',
  locationConfidence: 'medium',
  documentedDateText: 'Created 1990',
  earliestPossibleYear: 1990,
  latestPossibleYear: 1990,
  dateBasis: 'documented_construction',
  dateConfidence: 'medium',
  survival: 'unknown',
  shortDescription:
    'Scrap-metal sculpture of Roman legionnaires beside National Cycle Network Route 75, at the Quarrier’s Village approach.',
  fullDescription:
    'David Kemp’s The Lost XVII is a local public sculpture made from salvaged railway material. It is retained as related context because the official locality boundary runs just south of the mapped artwork point.',
  sourceRecords: uniqueSources([
    source({
      sourceName: 'National Cycle Network Route 75',
      sourceOrganisation: 'Geograph Britain and Ireland',
      sourceRecordId: 'geograph:3527856',
      sourceUrl: 'https://www.geograph.org.uk/photo/3527856',
      licence:
        'Creative Commons Attribution-ShareAlike 2.0; retain the source link and photographer attribution.',
      reliability: 'secondary',
      notes:
        'Identifies The Lost XVII as a sculpture by David Kemp and Jack Dempsey, made from salvaged railway material on National Cycle Network Route 75.',
    }),
    source({
      sourceName: 'Public Sculptures',
      sourceOrganisation: 'David Kemp',
      sourceUrl: 'https://www.davidkemp.uk.com/public-sculptures/',
      reliability: 'secondary',
      notes: 'The artist’s catalogue lists The Lost XVII under 1990.',
    }),
    ...originalArtwork.sourceRecords,
  ]),
  tags: ['public-art', 'sculpture', 'community-layer', 'cycle-route-75', 'source-backed-community'],
  evidenceScope: 'related_context',
  updatedAt: accessedAt,
  reviewed: true,
  reviewNotes:
    'Source-backed community public-art record. The point is the OSM-mapped sculpture location, corroborated by Geograph; it is just outside the NRS locality and remains clearly labelled related context.',
});

const officialMemorial = pkg.features.find((feature) => feature.id === officialMemorialId);
if (!officialMemorial?.geometry || officialMemorial.geometry.type !== 'Point')
  throw new Error('Expected the NRHE Quarriers war memorial record before community curation.');
Object.assign(officialMemorial, {
  featureType: 'memorial',
  significance: 'local',
  survival: 'substantially_intact',
  shortDescription:
    'Boys of Quarriers Homes Scotland war memorial on Faith Avenue, recorded by the NRHE as a twentieth-century memorial dated 1929.',
  fullDescription:
    'This is the official NRHE place record for the Quarriers war memorial. Its exact NRHE location and 1929 classification date take precedence over a nearby current OSM marker with the same name.',
  tags: [
    ...new Set([
      ...officialMemorial.tags,
      'community-layer',
      'community-memorial',
      'war-memorial',
      'source-backed-community',
    ]),
  ],
  updatedAt: accessedAt,
  reviewed: true,
  reviewNotes:
    'Promoted to the community memorial layer from the official NRHE record. The 1929 date remains an NRHE classification date, not an unsupported reconstruction date.',
});

const duplicateOsmMemorial = pkg.features.find((feature) => feature.id === osmMemorialId);
if (!duplicateOsmMemorial)
  throw new Error('Expected the imported OSM Quarriers war memorial marker before de-duplication.');
duplicateOsmMemorial.tags = [
  ...new Set([
    ...duplicateOsmMemorial.tags,
    'map-hidden',
    'curation-conflict',
    `duplicate-of:${officialMemorialId}`,
  ]),
];
duplicateOsmMemorial.updatedAt = accessedAt;
duplicateOsmMemorial.reviewed = true;
duplicateOsmMemorial.reviewNotes =
  'Hidden from the map as a name collision with the official NRHE Quarriers war memorial record. Retained in Data Review because its OSM coordinate differs from the official record and should not be silently discarded.';

upsertFeature({
  id: 'curated:plaque-holmlea',
  projectId: pkg.project.id,
  name: 'Holmlea commemorative plaque',
  alternativeNames: ['Plaque at Holmlea'],
  countryCode: pkg.project.countryCode,
  region: pkg.project.region,
  locality: pkg.project.locality,
  address: 'Holmlea, Quarrier’s Village',
  featureType: 'plaque',
  significance: 'local',
  statutoryStatus: 'Not designated',
  geometry: { type: 'Point', coordinates: [-4.616922, 55.866323] },
  locationType: 'exact',
  documentedDateText: 'Plaque present by 13 April 2020 (photographed)',
  earliestPossibleYear: 2020,
  latestPossibleYear: 2020,
  datePrecision: 'Photographic presence date',
  dateBasis: 'present_by',
  dateConfidence: 'medium',
  locationConfidence: 'medium',
  survival: 'unknown',
  shortDescription:
    'Commemorative plaque at Holmlea, documented by a geotagged 2020 photograph. The inscription and installation date have not yet been transcribed.',
  sourceRecords: [
    source({
      sourceName: 'Plaque at Holmlea, Quarriers Village',
      sourceOrganisation: 'Geograph Britain and Ireland / Wikimedia Commons',
      sourceRecordId: 'geograph:6450463',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:Plaque_at_Holmlea,_Quarriers_Village_-_geograph.org.uk_-_6450463.jpg',
      licence: 'CC BY-SA 2.0; Thomas Nugent / Geograph Britain and Ireland.',
      reliability: 'secondary',
      notes:
        'The source identifies the object as a commemorative plaque at Holmlea and supplies the object location. It establishes photographic presence in 2020, not the plaque’s installation date.',
    }),
  ],
  licence: 'See the cited CC BY-SA 2.0 source record.',
  tags: ['plaque', 'community-layer', 'source-backed-community'],
  createdAt: accessedAt,
  updatedAt: accessedAt,
  reviewed: true,
  reviewNotes:
    'Source-backed plaque record. A future close transcription or official archive source is required before asserting the plaque’s subject or installation date.',
  evidenceScope: 'parish_evidence',
});

upsertSource({
  id: 'quarriers-community-evidence',
  name: 'Quarrier’s Village community evidence: plaques, memorials and public art',
  organisation: 'Historic Environment Scotland, Geograph Britain and Ireland, David Kemp',
  coverage:
    'Source-reviewed community memorial, public-art and plaque records in and immediately beside Quarrier’s Village.',
  accessMethod:
    'Individual record review; OSM used only to locate pre-existing mapped artwork and detect a duplicate memorial marker.',
  sourceUrl: 'https://www.trove.scot/place/340549',
  licence:
    'See individual record sources; Open Government Licence, CC BY-SA and ODbL attribution are retained where applicable.',
  reliability: 'official_non_statutory',
  limitations:
    'This is a deliberately small verified release. Current OSM information boards and other visitor discoveries remain optional current-context records until an authoritative or independently reviewable source identifies them precisely.',
});

pkg.validation = validateFeatures(pkg.project, pkg.features);
const errors = pkg.validation.filter((result) => result.severity === 'error');
if (errors.length) throw new Error(`Refusing to write ${errors.length} validation error(s).`);

await mkdir(dirname(reportPath), { recursive: true });
await writeFile(
  reportPath,
  `${JSON.stringify(
    {
      projectId: pkg.project.id,
      publishedAt: accessedAt,
      published: [
        {
          id: officialMemorialId,
          category: 'memorial',
          source: 'NRHE / trove.scot',
          date: '1929 classification date',
        },
        {
          id: 'curated:public-art-the-lost-xvii',
          category: 'public_art',
          source: 'Geograph and artist catalogue',
          date: '1990',
        },
        {
          id: 'curated:plaque-holmlea',
          category: 'plaque',
          source: 'Geograph / Wikimedia Commons',
          date: 'present by 2020',
        },
      ],
      duplicateReview: [
        {
          hiddenFeatureId: osmMemorialId,
          canonicalFeatureId: officialMemorialId,
          rationale:
            'Exact same memorial name; official NRHE record takes precedence. The OSM record is retained in Data Review because the coordinates conflict.',
        },
      ],
      visitorCandidatesRetainedAsCurrentContext: pkg.features
        .filter(
          (feature) =>
            feature.tags.includes('osm-community-visitor') && !feature.tags.includes('map-hidden'),
        )
        .map((feature) => ({
          id: feature.id,
          name: feature.name,
          reason:
            'OSM discovery record only; no independent source yet identifies this physical visitor asset.',
        })),
      withheld: [
        'No additional plaque, memorial, artwork or visitor point was published from unsourced search references.',
        'No route geometry was invented for the Quarrier’s Village Heritage Path; only the published source description is retained for future reviewed digitisation.',
      ],
    },
    null,
    2,
  )}\n`,
  'utf8',
);
await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
console.log(
  'Published three source-backed Quarrier’s Village community records; one conflicting OSM memorial marker was retained but hidden.',
);
