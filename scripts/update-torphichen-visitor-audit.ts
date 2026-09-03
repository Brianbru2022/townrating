import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { booleanPointInPolygon, point } from '@turf/turf';
import type { HeritageFeature, ProjectPackage, SourceRecord } from '../src/domain/models';

type PlannerCuration = Record<string, Record<string, string[]>>;

const projectPath = resolve('data/projects/torphichen.json');
const curationPath = resolve('data/visitor-planner-curation.json');
const auditPath = resolve('data/review/torphichen-visitor-audit-2026-08-07.json');
const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
const curationLibrary = JSON.parse(await readFile(curationPath, 'utf8')) as {
  projects: PlannerCuration;
};
const reviewedAt = '2026-08-07T00:00:00Z';
const reviewedDate = '2026-08-07';
const auditTag = 'torphichen-visitor-audit';
const visitorPackTag = 'torphichen-scotland-visitor-pack';
const editorialMetadataLicence =
  'Original editorial summary and factual visitor metadata; linked source content is not redistributed.';

function featureById(id: string): HeritageFeature {
  const feature = pkg.features.find((candidate) => candidate.id === id);
  if (!feature) throw new Error(`Missing Torphichen feature: ${id}`);
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
): SourceRecord {
  return {
    sourceName,
    sourceOrganisation,
    sourceRecordId,
    sourceUrl,
    accessedAt: reviewedAt,
    licence: editorialMetadataLicence,
    reliability,
    notes,
  };
}

function replaceCurrentCurationSource(feature: HeritageFeature, source: SourceRecord): void {
  feature.sourceRecords = [
    ...feature.sourceRecords.filter(
      (record) =>
        !record.sourceRecordId?.startsWith('visitor-audit:') &&
        !record.sourceRecordId?.startsWith('visitor-context-curation:') &&
        !record.notes?.startsWith('Current-place curation'),
    ),
    source,
  ];
  feature.licence ??= editorialMetadataLicence;
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
    locationType: 'exact',
    locationConfidence: 'high',
    dateBasis: 'unknown',
    dateConfidence: 'unknown',
    survival: 'unknown',
    shortDescription,
    sourceRecords: [source],
    tags: [...new Set([...tags, auditTag, visitorPackTag])],
    createdAt: reviewedAt,
    updatedAt: reviewedAt,
    reviewed: true,
    reviewNotes:
      'Curated as present-day visitor information on 2026-08-07; excluded from historic dating and heat-map evidence.',
    evidenceScope: 'related_context',
    licence: editorialMetadataLicence,
  };
}

pkg.project.centre = [-3.65378, 55.93378];
pkg.project.touristAppeal = {
  rating: 1,
  label: 'Local detour',
  summary:
    'Torphichen earns one star for a compact, specialist heritage visit. Scotland\'s only surviving Knights Hospitaller headquarters is nationally important and unusually atmospheric, while the conservation village and Jubilee Well add a short supporting wander. Seasonal opening, one limited food option and very little visitor infrastructure keep it below a broader two-star stop.',
};

pkg.project.visualIdentity = {
  theme: 'hospitaller-preceptory-and-sanctuary-village',
  badgeImage: '/town-guides/torphichen-preceptory-watercolour-guide.png',
  badgeAlt:
    'Light ink-and-watercolour illustration of Torphichen Preceptory, Parish Kirk and churchyard',
  heroImage: '/town-guides/torphichen-preceptory-watercolour-guide.png',
  heroAlt:
    'Light ink-and-watercolour illustration of Torphichen Preceptory, Parish Kirk and churchyard',
  primaryColour: '#244A46',
  accentColour: '#A86B2D',
  backgroundColour: '#F4F4E8',
  heroObjectPosition: '52% 48%',
  motifs: ['Hospitaller story', 'Sanctuary stone', 'Village square', 'Medieval kirk'],
};

pkg.project.townGuide = {
  headline: 'Knights Hospitaller history in a quiet conservation village',
  intro:
    'Torphichen is a small West Lothian village with one remarkable historic core. Its medieval Preceptory was the Scottish headquarters of the Knights Hospitaller, and the surviving tower, transepts, later parish kirk, old headstones and sanctuary stone make an absorbing compact visit. A short wander to the Jubilee Well and traditional village square completes the story.',
  bestFor: [
    'Medieval history',
    'Knights Hospitaller',
    'Church architecture',
    'Quiet village wandering',
  ],
  perfectFor: [
    'A focused heritage detour between Bathgate and Linlithgow',
    'Visitors drawn to unusual medieval religious sites',
    'A peaceful hour among old stone and village history',
  ],
  suggestedFirstVisit: {
    title: 'Preceptory, kirkyard and the village square',
    summary:
      'Begin with the Preceptory and Parish Kirk, look for the refuge stone and old headstones in the kirkyard, then walk down to the Jubilee Well and the historic buildings around The Square.',
  },
  dontMiss: [
    'Torphichen Preceptory and Parish Kirk',
    'The sanctuary stone and historic churchyard',
    'Jubilee Well and The Square',
  ],
  suggestedTime: '1-2 hours; check seasonal opening before travelling',
  visitorMood:
    'A rewarding specialist stop for visitors who enjoy quiet historic villages and a nationally important story hidden in plain sight.',
  sourceUrls: [
    'https://www.historicenvironment.scot/visit/all/torphichen-preceptory/',
    'https://www.historicenvironment.scot/visit/all/torphichen-preceptory/plan-your-visit/',
    'https://www.stjohnscotland.org.uk/torphichen-preceptory',
    'https://www.nationalchurchestrust.org/church/torphichen-kirk-preceptory-torphichen',
    'https://www.scotlandschurchestrust.org.uk/church/torphichen-kirk/',
    'https://www.visitwestlothian.co.uk/explore/torphichen/',
    'https://www.westlothian.gov.uk/media/58093/Approved-Torphichen-Conservation-Area-Appraisal-2023/pdf/Approved_Torphichen_Conservation_Area_Appraisal_2023.pdf',
    'https://www.torphicheninn.co.uk/',
    'https://www.torphicheninn.co.uk/home/calendar',
    'https://www.geograph.org.uk/photo/1979013',
  ],
  lastReviewedAt: reviewedDate,
};

const townStudyArea = pkg.project.townStudyArea;
if (!townStudyArea) throw new Error('Torphichen town study area is missing');
townStudyArea.notes =
  'The original NRS 2022 Torphichen locality is preserved unchanged and is also the active visitor boundary. The Preceptory, Parish Kirk, village square, Jubilee Well, Torphichen Inn and curated practical points all fall inside it. Cairnpapple Hill, Witchcraig Wood, the Scottish Korean War Memorial, Wallace\'s Cave, Beecraigs and other Bathgate Hills places remain wider-area context only and do not contribute to Torphichen\'s planner or rating.';

const preceptory = featureById('hes-listed-building:LB14533');
preceptory.name = 'Torphichen Preceptory, Parish Kirk and sanctuary stone';
preceptory.featureType = 'historic_church';
preceptory.shortDescription =
  'Scotland\'s only surviving Knights Hospitaller headquarters combines a medieval crossing tower and transepts with the later parish kirk, an atmospheric churchyard and sanctuary stone.';
addTags(
  preceptory,
  'current-context',
  'service-context-heritage',
  'service-context-visitor',
  auditTag,
  visitorPackTag,
);
replaceCurrentCurationSource(
  preceptory,
  currentSource(
    'Torphichen Preceptory visitor information',
    'Historic Environment Scotland',
    'visitor-audit:torphichen-preceptory',
    'https://www.historicenvironment.scot/visit/all/torphichen-preceptory/plan-your-visit/',
    'Current-place curation: tourism=attraction; name=Torphichen Preceptory, Parish Kirk and sanctuary stone; visitor_place_type=Medieval preceptory and parish kirk; visit_score=82; opening_hours:description=1 April-30 September, Saturday and Sunday and bank holidays 13:00-17:00, last entry 16:30; closed 1 October-31 March; entrance_fee=Adult £2, child aged 5-15 £1.50, under 5 and Historic Scotland members free; time_to_spend=45-75 minutes; description=Step inside the only surviving Scottish headquarters of the Knights Hospitaller, then explore the atmospheric kirk and sanctuary-marked churchyard; website=https://www.historicenvironment.scot/visit/all/torphichen-preceptory/plan-your-visit/.',
  ),
);

const gatehouse = featureById('hes-listed-building:LB14534');
addTags(gatehouse, 'visitor-audit-combined', auditTag);
gatehouse.reviewNotes =
  'Retained as a statutory historic record but combined with the Preceptory, Parish Kirk and sanctuary stone for one coherent public visitor card.';
gatehouse.updatedAt = reviewedAt;
gatehouse.reviewed = true;

const jubileeWell = featureById('hes-listed-building:LB14535');
jubileeWell.name = 'Torphichen village square and Jubilee Well';
jubileeWell.featureType = 'monument';
jubileeWell.shortDescription =
  'A short village-centre wander around the 1897 Jubilee Well and the listed stone buildings of Torphichen\'s historic square.';
addTags(
  jubileeWell,
  'current-context',
  'service-context-heritage',
  'service-context-visitor',
  auditTag,
  visitorPackTag,
);
replaceCurrentCurationSource(
  jubileeWell,
  currentSource(
    'Torphichen Conservation Area Appraisal',
    'West Lothian Council',
    'visitor-audit:torphichen-square-jubilee-well',
    'https://www.westlothian.gov.uk/media/58093/Approved-Torphichen-Conservation-Area-Appraisal-2023/pdf/Approved_Torphichen_Conservation_Area_Appraisal_2023.pdf',
    'Current-place curation: tourism=attraction; name=Torphichen village square and Jubilee Well; visitor_place_type=Historic village square and commemorative well; visit_score=52; opening_hours:description=Open-access outdoor village feature, best appreciated in daylight; entrance_fee=Free; time_to_spend=20-35 minutes; description=Walk from the Preceptory to the 1897 Jubilee Well and the listed stone buildings that give Torphichen its conservation-village character; website=https://www.westlothian.gov.uk/media/58093/Approved-Torphichen-Conservation-Area-Appraisal-2023/pdf/Approved_Torphichen_Conservation_Area_Appraisal_2023.pdf.',
    'local_authority',
  ),
);

const duplicateMemorial = featureById('osm-community:node-3725355463');
addTags(duplicateMemorial, 'visitor-audit-combined', 'map-hidden', auditTag);
duplicateMemorial.reviewNotes =
  'Duplicate current-map point for the listed Jubilee Well. It is retained for provenance but hidden so the public map shows one researched village-square card.';
duplicateMemorial.updatedAt = reviewedAt;
duplicateMemorial.reviewed = true;

pkg.project.visitorHighlights = [
  {
    rank: 1,
    featureId: preceptory.id,
    name: preceptory.name,
    reason:
      'The only surviving Scottish headquarters of the Knights Hospitaller is a genuinely unusual medieval visit, enriched by the later kirk, historic headstones and sanctuary stone.',
    tagline: 'Scotland\'s Hospitaller headquarters',
    visitorScore: 82,
    openingTimes:
      '1 April-30 September: Saturday, Sunday and bank holidays 13:00-17:00. Last entry 16:30. Closed 1 October-31 March; check for short-notice closures before a special journey.',
    admission:
      'Adult £2; child aged 5-15 £1.50; under 5 and Historic Scotland members free. Prices may change.',
    freeAdmission: false,
    organisationPills: ['HES'],
    sourceName: 'Historic Environment Scotland',
    sourceUrl:
      'https://www.historicenvironment.scot/visit/all/torphichen-preceptory/plan-your-visit/',
    verifiedInBoundaryAt: reviewedDate,
  },
  {
    rank: 2,
    featureId: jubileeWell.id,
    name: jubileeWell.name,
    reason:
      'The 1897 well and surrounding listed buildings give a compact second chapter to the visit and make the short walk from the kirkyard worthwhile.',
    tagline: 'Historic village square',
    visitorScore: 52,
    openingTimes: 'Open-access outdoor village feature. Daylight gives the clearest context.',
    admission: 'Free.',
    freeAdmission: true,
    organisationPills: [],
    sourceName: 'West Lothian Council',
    sourceUrl:
      'https://www.westlothian.gov.uk/media/58093/Approved-Torphichen-Conservation-Area-Appraisal-2023/pdf/Approved_Torphichen_Conservation_Area_Appraisal_2023.pdf',
    verifiedInBoundaryAt: reviewedDate,
  },
];

const torphichenInn = upsertFeature(
  curatedPoint(
    'osm-current:node-7306453004',
    'Torphichen Inn',
    'pub',
    [-3.6544653, 55.9332323],
    'A traditional village pub known for Scottish evenings, music, stories, poetry and bagpipes, with opening dates managed through its live calendar.',
    currentSource(
      'Torphichen Inn visitor information',
      'Torphichen Inn',
      'visitor-audit:food:torphichen-inn',
      'https://www.torphicheninn.co.uk/home/calendar',
      'Current-place curation: amenity=pub; name=Torphichen Inn; cuisine=Traditional pub and Scottish hospitality; visit_score=66; price_band=££; opening_hours:description=Open on published calendar dates, generally 18:30-21:30; Friday usually 18:30-23:00; check the current calendar because dates and hours vary; description=Village pub & Scottish nights: A characterful village pub for music, stories, poetry, bagpipes and a drink after the heritage visit; website=https://www.torphicheninn.co.uk/; dog_friendly=unknown.',
    ),
    ['current-context', 'service-context-food', 'visitor-context-food'],
  ),
);
torphichenInn.address = '7 The Square, Torphichen, EH48 4LY';

const parking = featureById('osm-community:way-368687979');
parking.name = 'Bowyett / Preceptory street-side parking';
parking.featureType = 'parking';
parking.shortDescription =
  'Marked street-side parking on Bowyett beside Torphichen Kirk and the Preceptory.';
parking.address = 'Bowyett, Torphichen, EH48 4LZ';
addTags(parking, 'current-context', 'service-context-parking', auditTag, visitorPackTag);
replaceCurrentCurationSource(
  parking,
  currentSource(
    'Torphichen Kirk and Preceptory visitor facilities',
    'National Churches Trust and OpenStreetMap contributors',
    'visitor-audit:parking:bowyett-preceptory',
    'https://www.nationalchurchestrust.org/church/torphichen-kirk-preceptory-torphichen',
    'Current-place curation: amenity=parking; name=Bowyett / Preceptory street-side parking; parking=street_side; access=public; price_display=Check signs; payment_required=unknown; opening_hours:description=Open-access street-side parking, observe current signs and keep entrances clear; description=Marked street-side parking beside Torphichen Kirk and the Preceptory; website=https://www.openstreetmap.org/way/368687979.',
  ),
);

const visitorToilet = upsertFeature(
  curatedPoint(
    'curated-toilets:torphichen-kirk',
    'Torphichen Kirk visitor toilet, Bowyett',
    'toilets',
    [-3.65212, 55.93452],
    'A visitor toilet on the church premises, available only when the Parish Kirk and Preceptory are open.',
    currentSource(
      'Torphichen Kirk visitor facilities',
      'Scotland\'s Churches Trust',
      'visitor-audit:toilets:torphichen-kirk',
      'https://www.scotlandschurchestrust.org.uk/church/torphichen-kirk/',
      'Current-place curation: amenity=toilets; name=Torphichen Kirk visitor toilet, Bowyett; access=visitors during venue opening; price_display=Included with visit; opening_hours:description=Available when the Parish Kirk and Preceptory are open, normally April-September weekends and bank holidays 13:00-17:00; wheelchair=Accessible toilets are reported nearby by National Churches Trust, confirm exact access before relying on them; description=Visitor toilet on the Torphichen Kirk premises; website=https://www.scotlandschurchestrust.org.uk/church/torphichen-kirk/.',
      'secondary',
    ),
    ['current-context', 'service-context-toilets'],
  ),
);
visitorToilet.address = 'Torphichen Kirk, Bowyett, Torphichen, EH48 4LZ';

curationLibrary.projects[pkg.project.id] = {
  ...(curationLibrary.projects[pkg.project.id] ?? {}),
  eat: [torphichenInn.id],
  trails: [],
  picnic: [],
  parking: [parking.id],
  toilets: [visitorToilet.id],
};

for (const id of [
  'osm-community:way-1011207756',
  'osm-community:way-1063051064',
  'osm-community:way-1063051065',
]) {
  const feature = featureById(id);
  addTags(feature, 'visitor-audit-excluded', auditTag);
  feature.reviewNotes =
    id === 'osm-community:way-1011207756'
      ? 'Excluded from Torphichen\'s public planner because it is customer-only and falls outside the NRS locality.'
      : 'Excluded from Torphichen\'s public planner because OpenStreetMap records private access.';
  feature.updatedAt = reviewedAt;
  feature.reviewed = true;
}

const activeVisitorBoundary = townStudyArea.visitorBoundary ?? townStudyArea.localityBoundary;
const publicFeatureIds = [
  ...pkg.project.visitorHighlights.map((highlight) => highlight.featureId),
  ...Object.values(curationLibrary.projects[pkg.project.id]).flat(),
];
for (const featureId of new Set(publicFeatureIds)) {
  const feature = featureById(featureId);
  if (feature.geometry?.type !== 'Point') {
    throw new Error(`Torphichen public visitor feature is not a point: ${featureId}`);
  }
  if (!booleanPointInPolygon(point(feature.geometry.coordinates), activeVisitorBoundary)) {
    throw new Error(`Torphichen public visitor feature falls outside the NRS locality: ${featureId}`);
  }
}

const audit = {
  projectId: pkg.project.id,
  reviewedAt,
  townRating: {
    rating: pkg.project.touristAppeal.rating,
    rationale:
      'One star is retained. Torphichen Preceptory is nationally important and a genuine specialist detour, but it is a short seasonal visit supported by one modest village wander and limited food and practical infrastructure. Nearby Bathgate Hills attractions are outside the town boundary and were not used to raise the rating.',
  },
  boundaryRule:
    'The official NRS 2022 Torphichen locality is preserved unchanged and used as the active visitor boundary. Every public planner marker is inside it. Nearby countryside attractions are excluded even when Visit West Lothian markets them under Torphichen.',
  published: {
    attractions: pkg.project.visitorHighlights.map((highlight) => ({
      name: highlight.name,
      score: highlight.visitorScore,
      featureId: highlight.featureId,
    })),
    eat: curationLibrary.projects[pkg.project.id].eat,
    trails: curationLibrary.projects[pkg.project.id].trails,
    parking: curationLibrary.projects[pkg.project.id].parking,
    toilets: curationLibrary.projects[pkg.project.id].toilets,
    picnic: curationLibrary.projects[pkg.project.id].picnic,
  },
  excluded: [
    {
      name: 'Cairnpapple Hill',
      reason: 'Outside the active NRS locality; retained as wider Bathgate Hills context only.',
    },
    {
      name: 'Scottish Korean War Memorial and Witchcraig Wood',
      reason: 'Outside the active NRS locality and excluded from the town planner and rating.',
    },
    {
      name: 'Wallace\'s Cave, River Avon routes, Beecraigs and wider countryside places',
      reason: 'Outside the active town polygon and unsuitable for Torphichen\'s public planner.',
    },
    {
      name: 'Private and customer-only parking',
      reason:
        'Only the public street-side parking by the Preceptory is published. One customer-only and two private OSM parking records are excluded.',
    },
    {
      name: 'Generic benches, playgrounds and possible picnic substitutes',
      reason:
        'No defensible public picnic location or current published town trail was found, so neither category is padded.',
    },
  ],
  artwork: {
    asset: '/town-guides/torphichen-preceptory-watercolour-guide.png',
    referenceSource: 'Torphichen Parish Kirk and Preceptory by Kim Traynor',
    referenceUrl: 'https://www.geograph.org.uk/photo/1979013',
    referenceLicence: 'CC BY-SA 2.0',
    treatment: 'Text-free original ink-and-watercolour visitor-guide illustration.',
  },
  sourceUrls: pkg.project.townGuide.sourceUrls,
};

await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`);
await writeFile(curationPath, `${JSON.stringify(curationLibrary, null, 2)}\n`);
await writeFile(auditPath, `${JSON.stringify(audit, null, 2)}\n`);

console.log(
  `Updated Torphichen visitor audit: ${pkg.project.visitorHighlights.length} attractions, 1 food stop, 0 trails, 1 car park, 1 limited-hours toilet and 0 picnic sites. Rating: ${pkg.project.touristAppeal.rating} star.`,
);
