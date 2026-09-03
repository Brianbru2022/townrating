import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { booleanPointInPolygon, point } from '@turf/turf';
import type { HeritageFeature, ProjectPackage, SourceRecord } from '../src/domain/models';

type PlannerCuration = Record<string, Record<string, string[]>>;

const projectPath = resolve('data/projects/kirknewton.json');
const curationPath = resolve('data/visitor-planner-curation.json');
const auditPath = resolve('data/review/kirknewton-visitor-audit-2026-08-07.json');
const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
const curationLibrary = JSON.parse(await readFile(curationPath, 'utf8')) as {
  projects: PlannerCuration;
};
const reviewedAt = '2026-08-07T00:00:00Z';
const reviewedDate = '2026-08-07';
const auditTag = 'kirknewton-visitor-audit';
const editorialMetadataLicence =
  'Original editorial summary and factual visitor metadata; linked source content is not redistributed.';
const osmLicence = 'OpenStreetMap contributors, Open Database Licence.';

function featureById(id: string): HeritageFeature {
  const feature = pkg.features.find((candidate) => candidate.id === id);
  if (!feature) throw new Error(`Missing Kirknewton feature: ${id}`);
  return feature;
}

function addTags(feature: HeritageFeature, ...tags: string[]): void {
  feature.tags = [...new Set([...feature.tags, ...tags])];
}

function currentSource(
  sourceName: string,
  sourceOrganisation: string,
  sourceRecordId: string,
  sourceUrl: string,
  notes: string,
  reliability: SourceRecord['reliability'] = 'official_non_statutory',
  licence = editorialMetadataLicence,
): SourceRecord {
  return {
    sourceName,
    sourceOrganisation,
    sourceRecordId,
    sourceUrl,
    accessedAt: reviewedAt,
    licence,
    reliability,
    notes,
  };
}

function replaceCurrentCurationSource(feature: HeritageFeature, source: SourceRecord): void {
  feature.sourceRecords = [
    ...feature.sourceRecords.filter(
      (record) =>
        !record.sourceRecordId?.startsWith('visitor-audit:') &&
        !record.notes?.startsWith('Current-place curation'),
    ),
    source,
  ];
  feature.licence ??= source.licence;
  feature.updatedAt = reviewedAt;
  feature.reviewed = true;
}

function upsertFeature(feature: HeritageFeature): HeritageFeature {
  const index = pkg.features.findIndex((candidate) => candidate.id === feature.id);
  if (index === -1) pkg.features.push(feature);
  else pkg.features[index] = feature;
  return feature;
}

function curatedPoint(
  id: string,
  name: string,
  featureType: string,
  coordinates: [number, number],
  shortDescription: string,
  source: SourceRecord,
  tags: string[],
): HeritageFeature {
  return {
    id,
    projectId: pkg.project.id,
    name,
    alternativeNames: [],
    countryCode: pkg.project.countryCode,
    region: pkg.project.region,
    locality: pkg.project.locality,
    featureType,
    significance: 'local',
    geometry: { type: 'Point', coordinates },
    locationType: 'representative_point',
    locationConfidence: 'high',
    dateBasis: 'unknown',
    dateConfidence: 'unknown',
    survival: 'unknown',
    shortDescription,
    sourceRecords: [source],
    tags: [...new Set([...tags, auditTag])],
    createdAt: reviewedAt,
    updatedAt: reviewedAt,
    reviewed: true,
    reviewNotes:
      'Curated as present-day visitor information on 2026-08-07; excluded from historic dating and heat-map evidence.',
    evidenceScope: 'related_context',
    licence: editorialMetadataLicence,
  };
}

pkg.project.touristAppeal = {
  rating: 0,
  label: 'Not a tourist town',
  summary:
    'Kirknewton remains a zero-rated destination on the app\'s national visitor scale. The old parish churchyard, quiet Main Street and community park can reward a brief local pause, but there is no destination-scale attraction cluster inside the active settlement boundary. Potter Around, the military museum, Jupiter Artland and other better-known draws marketed under the wider Kirknewton area sit outside the polygon and are not counted.',
};

pkg.project.visualIdentity = {
  theme: 'quiet-village-and-country-paths',
  badgeImage: '/town-guides/kirknewton-main-street-watercolour-guide.png',
  badgeAlt:
    'Light ink-and-watercolour illustration of Kirknewton Main Street with whitewashed and sandstone cottages beneath a blue sky',
  heroImage: '/town-guides/kirknewton-main-street-watercolour-guide.png',
  heroAlt:
    'Light ink-and-watercolour illustration of Kirknewton Main Street with whitewashed and sandstone cottages beneath a blue sky',
  heroObjectPosition: '50% 58%',
  primaryColour: '#183F43',
  accentColour: '#A66A2A',
  backgroundColour: '#EEF4E8',
  motifs: ['Old kirk', 'Stone cottages', 'Village park', 'Country paths'],
};

pkg.project.townGuide = {
  headline: 'An old kirkyard, stone cottages and paths into open country',
  intro:
    'Kirknewton is a quiet West Lothian village rather than a conventional sightseeing stop. Its most rewarding corner is the old parish churchyard, where historic burial enclosures and memorials sit just off Main Street. Pair it with a short wander past the village cottages and park, or use the pavilion maps to begin a longer walk into the surrounding countryside.',
  bestFor: ['Quiet heritage', 'Village character', 'Local walking'],
  perfectFor: [
    'A brief local-history pause',
    'A starting point for country paths',
    'Visitors already exploring rural West Lothian',
  ],
  suggestedFirstVisit: {
    title: 'Old kirk, Main Street and the park',
    summary:
      'Begin at the old parish churchyard and its listed burial enclosures, follow Main Street west through the village, then finish at Kirknewton Park where the pavilion walking map offers ideas for a longer countryside route.',
  },
  dontMiss: ['Kirknewton Old Parish Church and churchyard'],
  suggestedTime: 'One to two hours',
  visitorMood:
    'For visitors who enjoy modest historic places, village streets and low-key walks more than headline attractions.',
  sourceUrls: [
    'https://www.visitwestlothian.co.uk/explore/kirknewton/',
    'https://www.trove.scot/place/50341',
    'https://www.crsbi.ac.uk/view-item?i=2500',
    'https://www.kirknewton.info/projects-6',
    'https://www.kirknewton.info/pavilion',
    'https://www.westlothian.gov.uk/media/61905/Community-Choices-Kirknewton-Play-Area-Report-May-2024/pdf/Kirknewton_Play_Area_-_Community_Choices_Survey_Report_May_2024.pdf',
    'https://marmarisinn.co.uk/',
    'https://commons.wikimedia.org/wiki/File:Main_Street,_Kirknewton_-_geograph.org.uk_-_2992500.jpg',
  ],
  lastReviewedAt: reviewedDate,
};

const townStudyArea = pkg.project.townStudyArea;
if (!townStudyArea) throw new Error('Kirknewton town study area is missing');
delete townStudyArea.visitorBoundary;
townStudyArea.notes =
  'The active visitor boundary is the original NRS 2022 Kirknewton locality S52000377, preserved unchanged. Every public town-planner marker is validated inside it. Potter Around at Overton Farm, Kirknewton station parking, A Stone\'s Progress, the western war memorial and wider-area attractions such as Military Museum Scotland and Jupiter Artland are outside the locality and excluded from the town rating and planner.';

const oldKirk = featureById('nrhe:50341');
oldKirk.name = 'Kirknewton Old Parish Church and churchyard';
oldKirk.featureType = 'burial_ground';
oldKirk.address = 'Main Street, Kirknewton';
oldKirk.shortDescription =
  'A quiet historic churchyard containing the old parish church site, listed 18th-century burial enclosures and village memorials.';
addTags(oldKirk, 'current-context', 'service-context-heritage', 'service-context-visitor', auditTag);
replaceCurrentCurationSource(
  oldKirk,
  currentSource(
    'Kirknewton Old Parish Church and churchyard visitor audit',
    'Historic Environment Scotland / Corpus of Romanesque Sculpture in Britain and Ireland',
    'visitor-audit:attraction:old-parish-church',
    'https://www.trove.scot/place/50341',
    'Current-place curation: historic=churchyard; name=Kirknewton Old Parish Church and churchyard; visitor_place_type=Historic churchyard; visit_score=43; opening_hours:description=Open burial ground; visit in daylight and respect burials and services; entrance_fee=Free; time_to_spend=20-40 minutes; visitor_advisory=The early medieval carved grave cover recorded at this site was moved to the National Museum of Scotland and should not be expected in the churchyard; description=Step into a quiet historic corner of the village, with old kirkyard walls, listed burial enclosures and memorials gathered around the former parish church site; website=https://www.trove.scot/place/50341.',
  ),
);

pkg.project.visitorHighlights = [
  {
    rank: 1,
    featureId: oldKirk.id,
    name: oldKirk.name,
    reason: oldKirk.shortDescription,
    tagline: 'Old kirk and memorials',
    visitorScore: 43,
    openingTimes: 'Open burial ground; visit in daylight and respect burials and services.',
    admission: 'Free.',
    freeAdmission: true,
    homeMapEligible: false,
    sourceName: 'Historic Environment Scotland / Trove',
    sourceUrl: 'https://www.trove.scot/place/50341',
    verifiedInBoundaryAt: reviewedDate,
  },
];

const marmaris = upsertFeature(
  curatedPoint(
    'visitor-context:marmaris-inn-kirknewton',
    'Marmaris Inn',
    'fast_food',
    [-3.4194374, 55.8875793],
    'The village takeaway for fish and chips, pizza, kebabs, burgers and freshly made pasta, with collection and local delivery.',
    currentSource(
      'Marmaris Inn visitor information',
      'Marmaris Inn',
      'visitor-audit:food:marmaris-inn',
      'https://marmarisinn.co.uk/',
      'Current-place curation: amenity=fast_food; name=Marmaris Inn; visitor_place_type=Takeaway; cuisine=fish and chips, pizza, kebabs and burgers; visit_score=61; price_band=£; opening_hours:description=Open seven days; check the live ordering page for current serving and delivery times; description=Village takeaway: a useful local option for fish and chips, pizza, kebabs, burgers and pasta; website=https://marmarisinn.co.uk/.',
      'official_non_statutory',
      `${editorialMetadataLicence} Geometry derived from ${osmLicence}`,
    ),
    ['current-context', 'service-context-food', 'visitor-context-food'],
  ),
);

const walkingRoutes = upsertFeature(
  curatedPoint(
    'visitor-context:kirknewton-pavilion-walking-routes',
    'Kirknewton Pavilion walking routes',
    'walking_route',
    [-3.4230677, 55.8874939],
    'Community-mapped routes start at the pavilion, from a short village-history stroll to longer paths towards Kaimes Hill, Selm Muir and the Pentlands.',
    currentSource(
      'Kirknewton walking and cycling maps',
      'Kirknewton Community Development Trust',
      'visitor-audit:trail:pavilion-walking-routes',
      'https://www.kirknewton.info/projects-6',
      'Current-place curation: route=walking; name=Kirknewton Pavilion walking routes; trail_type=Community walking-route hub; visit_score=68; distance=Several choices from a short village stroll to longer countryside routes; time_to_spend=30 minutes to half a day; accessibility=Varies by route; the longer routes use country paths and extend beyond the locality; entrance_fee=Free; description=Use the pavilion map to choose a village history stroll or a longer route into the surrounding countryside; website=https://www.kirknewton.info/projects-6; download_url=https://static.wixstatic.com/media/cd538d_5a46feb957634dd2b99398c2728ee63b~mv2.jpg.',
    ),
    ['current-context', 'service-context-walk', 'visitor-context-trail'],
  ),
);

const parkPicnic = featureById('osm-community:node-10792942515');
parkPicnic.name = 'Kirknewton Park picnic area';
parkPicnic.featureType = 'picnic_site';
parkPicnic.address = 'Kirknewton Park, Main Street, Kirknewton';
parkPicnic.shortDescription =
  'A cluster of picnic benches beside the pavilion, play area and paths in Kirknewton Park.';
addTags(parkPicnic, 'current-context', 'service-context-picnic', auditTag);
replaceCurrentCurationSource(
  parkPicnic,
  currentSource(
    'Kirknewton Pavilion and park facilities',
    'Kirknewton Community Development Trust',
    'visitor-audit:picnic:kirknewton-park',
    'https://www.kirknewton.info/pavilion',
    'Current-place curation: tourism=picnic_site; name=Kirknewton Park picnic area; access=public; entrance_fee=Free; opening_hours:description=Open park; daylight use recommended; description=Picnic benches beside the pavilion, play area and park paths.',
    'official_non_statutory',
    `${editorialMetadataLicence} Geometry derived from ${osmLicence}`,
  ),
);

const parkToilets = featureById('osm-community:node-10792942512');
parkToilets.name = 'Kirknewton Park Pavilion public toilets';
parkToilets.featureType = 'toilets';
parkToilets.address = 'Kirknewton Park Pavilion, Main Street, Kirknewton';
parkToilets.shortDescription =
  'Public toilets at the sports pavilion on the north-west side of Kirknewton Park.';
addTags(parkToilets, 'current-context', 'service-context-toilets', auditTag);
replaceCurrentCurationSource(
  parkToilets,
  currentSource(
    'Kirknewton Park Pavilion toilets',
    'West Lothian Council / OpenStreetMap contributors',
    'visitor-audit:toilets:kirknewton-park-pavilion',
    'https://www.westlothian.gov.uk/media/61905/Community-Choices-Kirknewton-Play-Area-Report-May-2024/pdf/Kirknewton_Play_Area_-_Community_Choices_Survey_Report_May_2024.pdf',
    'Current-place curation: amenity=toilets; name=Kirknewton Park Pavilion public toilets; access=public; price_display=Free; opening_hours:description=OpenStreetMap currently records daily 09:00-18:00; verify the pavilion notice on arrival; wheelchair=yes; description=Public toilets at Kirknewton Park Pavilion.',
    'local_authority',
    `${editorialMetadataLicence} Geometry derived from ${osmLicence}`,
  ),
);

function updateParking(
  feature: HeritageFeature,
  name: string,
  address: string,
  description: string,
): HeritageFeature {
  feature.name = name;
  feature.featureType = 'parking';
  feature.address = address;
  feature.shortDescription = description;
  addTags(feature, 'current-context', 'service-context-parking', auditTag);
  replaceCurrentCurationSource(
    feature,
    currentSource(
      `${name} visitor parking audit`,
      'OpenStreetMap contributors',
      `visitor-audit:parking:${feature.id}`,
      feature.sourceRecords.find((source) => source.sourceUrl?.includes('openstreetmap.org'))
        ?.sourceUrl ?? 'https://www.openstreetmap.org/',
      `Current-place curation: amenity=parking; name=${name}; parking=surface; access=public; price_display=Check signs; payment_required=unknown; opening_hours:description=Open access; observe current signs and restrictions; description=${description}`,
      'discovery_only',
      `${editorialMetadataLicence} Geometry derived from ${osmLicence}`,
    ),
  );
  return feature;
}

const parkParking = updateParking(
  featureById('osm-community:way-294736243'),
  'Kirknewton Park Pavilion car park',
  'Kirknewton Park, Main Street, Kirknewton',
  'Small surface car park beside the pavilion and play area; no public tariff was identified, so check the entrance signs.',
);
const churchyardParking = updateParking(
  featureById('osm-community:way-1087310541'),
  'Old Kirk and cemetery car park',
  'Main Street, Kirknewton',
  'Small surface car park beside the old parish churchyard and cemetery; no public tariff was identified, so check the entrance signs.',
);

curationLibrary.projects[pkg.project.id] = {
  eat: [marmaris.id],
  trails: [walkingRoutes.id],
  picnic: [parkPicnic.id],
  parking: [parkParking.id, churchyardParking.id],
  toilets: [parkToilets.id],
};

const excludedRecords: Array<[string, string]> = [
  [
    'osm-community:way-96189975',
    'Kirknewton station car park is free according to ScotRail but falls outside the active locality polygon.',
  ],
  [
    'osm-community:way-389738972',
    'Excluded because it appears to serve the parish church or school and public visitor access was not defensible.',
  ],
  [
    'osm-community:way-909351246',
    'Duplicate pavilion toilet geometry; the named OSM node is retained as the single public record.',
  ],
  [
    'osm-community:node-10792942516',
    'Duplicate table within the single curated Kirknewton Park picnic area.',
  ],
  [
    'osm-community:node-10792942518',
    'Duplicate table within the single curated Kirknewton Park picnic area.',
  ],
  [
    'osm-community:node-10792942519',
    'Duplicate table within the single curated Kirknewton Park picnic area.',
  ],
  [
    'osm-community:node-10792942521',
    'Duplicate table within the single curated Kirknewton Park picnic area.',
  ],
  [
    'osm-community:node-11099992869',
    'A Stone\'s Progress falls outside the active locality polygon.',
  ],
  [
    'osm-community:node-9044936859',
    'The western war memorial falls outside the active locality polygon.',
  ],
];

for (const [id, reason] of excludedRecords) {
  const feature = pkg.features.find((candidate) => candidate.id === id);
  if (!feature) continue;
  addTags(feature, auditTag, 'visitor-audit-excluded', 'map-hidden');
  feature.reviewed = true;
  feature.updatedAt = reviewedAt;
  feature.reviewNotes = `Reviewed on 2026-08-07 and excluded from the public Kirknewton planner. ${reason}`;
}

const activeBoundary = townStudyArea.localityBoundary;
const publishedFeatureIds = [
  ...(pkg.project.visitorHighlights ?? []).map((highlight) => highlight.featureId),
  ...Object.values(curationLibrary.projects[pkg.project.id]).flat(),
];
for (const featureId of new Set(publishedFeatureIds)) {
  const feature = pkg.features.find((candidate) => candidate.id === featureId);
  if (!feature || feature.geometry?.type !== 'Point') {
    throw new Error(`Kirknewton public visitor feature is missing a point: ${featureId}`);
  }
  if (!booleanPointInPolygon(point(feature.geometry.coordinates), activeBoundary)) {
    throw new Error(`Kirknewton public visitor feature falls outside the active boundary: ${featureId}`);
  }
}

const audit = {
  projectId: pkg.project.id,
  reviewedAt,
  townRating: {
    previous: 0,
    rating: 0,
    rationale:
      'Zero stars is retained. The old kirkyard, village park and community routes support a useful local guide, but Kirknewton has no destination-scale attraction cluster inside the active locality. Wider-area attractions must not inflate the town score.',
  },
  boundary: {
    active: 'Original NRS 2022 Kirknewton locality S52000377, unchanged.',
    rule: 'Every public town-planner marker is inside the locality polygon.',
  },
  published: {
    attractions: pkg.project.visitorHighlights.map((highlight) => ({
      name: highlight.name,
      score: highlight.visitorScore,
      featureId: highlight.featureId,
    })),
    eat: curationLibrary.projects[pkg.project.id].eat,
    trails: curationLibrary.projects[pkg.project.id].trails,
    picnic: curationLibrary.projects[pkg.project.id].picnic,
    parking: curationLibrary.projects[pkg.project.id].parking,
    toilets: curationLibrary.projects[pkg.project.id].toilets,
  },
  excluded: [
    {
      name: 'Potter Around at Overton Farm',
      reason:
        'Outside the active locality polygon. It can be considered later as a standalone Home discovery place, but it is not a Kirknewton town-planner attraction.',
    },
    {
      name: 'Military Museum Scotland, Jupiter Artland and wider-area countryside attractions',
      reason: 'Outside the locality and excluded from the town rating and planner.',
    },
    {
      name: 'Kirknewton station car park',
      reason: 'Outside the locality. ScotRail records it as free, but it is not published in the town planner.',
    },
    {
      name: 'The Kirknewton Inn',
      reason:
        'A current operating venue could not be established. An old premises licence is not sufficient evidence after the reported 2017 closure.',
    },
  ],
  practicalCorrections: {
    parking:
      'Two in-boundary OSM public-parking records are retained with location-led names. No current tariff evidence was found, so both tell visitors to check signs rather than claiming free parking.',
    toilets:
      'The duplicate pavilion geometries were consolidated into one named Kirknewton Park Pavilion public-toilet record.',
    picnic:
      'Five individual OSM picnic-table nodes were consolidated into one location-level Kirknewton Park picnic area.',
  },
  artwork: {
    path: '/town-guides/kirknewton-main-street-watercolour-guide.png',
    reference:
      'Main Street, Kirknewton by Richard Webb, Geograph Britain and Ireland / Wikimedia Commons, CC BY-SA 2.0.',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Main_Street,_Kirknewton_-_geograph.org.uk_-_2992500.jpg',
  },
  sourceUrls: pkg.project.townGuide.sourceUrls,
};

await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`);
await writeFile(curationPath, `${JSON.stringify(curationLibrary, null, 2)}\n`);
await writeFile(auditPath, `${JSON.stringify(audit, null, 2)}\n`);

console.log(
  `Updated Kirknewton visitor audit: ${pkg.project.visitorHighlights.length} attraction, ${curationLibrary.projects[pkg.project.id].eat.length} food stop, ${curationLibrary.projects[pkg.project.id].trails.length} trail hub, ${curationLibrary.projects[pkg.project.id].parking.length} car parks, ${curationLibrary.projects[pkg.project.id].toilets.length} toilet and ${curationLibrary.projects[pkg.project.id].picnic.length} picnic area. Rating: 0 stars.`,
);
