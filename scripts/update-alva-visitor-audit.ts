import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  booleanPointInPolygon,
  buffer,
  featureCollection,
  lineString,
  point,
  union,
} from '@turf/turf';
import type { HeritageFeature, ProjectPackage, SourceRecord } from '../src/domain/models';

type PlannerCuration = Record<string, Record<string, string[]>>;

const projectPath = resolve('data/projects/alva.json');
const curationPath = resolve('data/visitor-planner-curation.json');
const auditPath = resolve('data/review/alva-visitor-audit-2026-08-05.json');
const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
const curationLibrary = JSON.parse(await readFile(curationPath, 'utf8')) as {
  projects: PlannerCuration;
};
const reviewedAt = '2026-08-05T00:00:00Z';
const reviewedDate = '2026-08-05';
const editorialMetadataLicence =
  'Original editorial summary and factual visitor metadata; linked source content is not redistributed.';
const visitorPackTag = 'alva-scotland-visitor-pack';
const auditTag = 'alva-visitor-audit';

function featureById(id: string): HeritageFeature {
  const feature = pkg.features.find((candidate) => candidate.id === id);
  if (!feature) throw new Error(`Missing Alva feature: ${id}`);
  return feature;
}

function addTags(feature: HeritageFeature, ...tags: string[]): void {
  feature.tags = [...new Set([...feature.tags, ...tags])];
}

function removeTag(feature: HeritageFeature, tag: string): void {
  feature.tags = feature.tags.filter((candidate) => candidate !== tag);
}

function replaceCurrentCurationSource(feature: HeritageFeature, source: SourceRecord): void {
  feature.sourceRecords = [
    ...feature.sourceRecords.filter(
      (record) =>
        !record.notes?.startsWith('Current-place curation') &&
        !record.notes?.startsWith('Current-context curation'),
    ),
    source,
  ];
  feature.licence ??= editorialMetadataLicence;
  feature.updatedAt = reviewedAt;
  feature.reviewed = true;
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
  locationType: HeritageFeature['locationType'] = 'exact',
  locationConfidence: HeritageFeature['locationConfidence'] = 'high',
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
    locationType,
    locationConfidence,
    dateBasis: 'unknown',
    dateConfidence: 'unknown',
    survival: 'unknown',
    shortDescription,
    sourceRecords: [source],
    tags: [...new Set([...tags, visitorPackTag, auditTag])],
    createdAt: reviewedAt,
    updatedAt: reviewedAt,
    reviewed: true,
    reviewNotes:
      'Curated as present-day visitor information on 2026-08-05; it is excluded from historic dating and heat-map evidence.',
    evidenceScope: 'related_context',
    licence: editorialMetadataLicence,
  };
}

function updateFood(
  id: string,
  options: {
    score: number;
    tagline: string;
    description: string;
    opening: string;
    price: string;
    cuisine: string;
    website: string;
    organisation: string;
    kind: 'cafe' | 'restaurant' | 'fast_food';
    address: string;
    dogFriendly?: boolean;
    reliability?: SourceRecord['reliability'];
  },
): void {
  const feature = featureById(id);
  feature.featureType = options.kind;
  feature.shortDescription = options.description;
  feature.address = options.address;
  addTags(feature, 'service-context-food', 'visitor-context-food', visitorPackTag, auditTag);
  replaceCurrentCurationSource(
    feature,
    currentSource(
      `${feature.name} visitor audit`,
      options.organisation,
      `visitor-audit-food:${feature.id}`,
      options.website,
      `Current-place curation: amenity=${options.kind}; name=${feature.name}; cuisine=${options.cuisine}; visit_score=${options.score}; price_band=${options.price}; opening_hours:description=${options.opening}; description=${options.tagline}: ${options.description}; website=${options.website}${options.dogFriendly ? '; dog_friendly=yes' : ''}.`,
      options.reliability ?? 'secondary',
    ),
  );
}

pkg.project.touristAppeal = {
  rating: 1,
  label: 'Local detour',
  summary:
    'Alva is a worthwhile local stop for Alva Glen, especially for walkers and families using the parks, but its permanent general visitor offer is too small for a higher destination rating.',
};

pkg.project.visualIdentity = {
  theme: 'ochil-glen',
  badgeImage: '/town-guides/alva-glen-watercolour-guide.png',
  badgeAlt:
    'Editorial ink-and-watercolour illustration of the formal gardens, burn and wooded gorge at Alva Glen',
  heroImage: '/town-guides/alva-glen-watercolour-guide.png',
  heroAlt:
    'Editorial ink-and-watercolour illustration of the formal gardens, burn and wooded gorge at Alva Glen',
  primaryColour: '#17464A',
  accentColour: '#8D6B2D',
  backgroundColour: '#EDF4E8',
  heroObjectPosition: '50% 50%',
  motifs: ['Alva Glen', 'Ochil scenery', 'Textile heritage', 'Family parks'],
};

pkg.project.townGuide = {
  headline: 'A dramatic Ochil glen and a compact Hillfoots town',
  intro:
    'Alva is defined by the Ochils rising immediately behind its streets. Alva Glen combines wooded paths, gorge scenery and mill remains; the town adds family parks, a rare Adam mausoleum and independent food stops.',
  bestFor: ['Glen walks', 'Ochil scenery', 'Family park time', 'Small-town heritage'],
  perfectFor: [
    'A two- to four-hour Hillfoots stop',
    'Families mixing a short walk with play and picnic time',
    'Visitors following Clackmannanshire beyond its headline towers',
  ],
  suggestedFirstVisit: {
    title: 'Alva Glen, then coffee or the parks',
    summary:
      'Begin in Alva Glen and choose the distance to suit the weather and your footing. Return through the town for an independent cafe, or add Johnstone and Cochrane Parks when travelling with children.',
  },
  dontMiss: ['Alva Glen', 'Johnstone & Cochrane Parks', 'Johnstone Mausoleum'],
  suggestedTime: '2-4 hours; longer for an extended glen walk',
  visitorMood:
    'A worthwhile local detour for a dramatic glen and a quieter Hillfoots stop, rather than a town packed with formal attractions.',
  sourceUrls: [
    'https://www.clacks.gov.uk/visiting/alvaglen/',
    'https://www.clackmannanshire.scot/index.php/leisure/alva-glen',
    'https://www.clacks.gov.uk/culture/johnstonecochraneparks/',
    'https://www.clacks.gov.uk/visiting/johnstonemausoleum/',
    'https://www.clacks.gov.uk/property/alvaconservationarea/',
    'https://www.clacks.gov.uk/transport/parking/',
    'https://www.clacks.gov.uk/community/caps/',
    'https://www.clacks.gov.uk/culture/alvapopuplibrary/',
    'https://www.littleowlscafe.co.uk/contact',
    'https://www.tripadvisor.co.uk/Restaurant_Review-g3785921-d7740877-Reviews-No71_Coffee_House-Alva_Clackmannanshire_Scotland.html',
    'https://www.tripadvisor.co.uk/Restaurant_Review-g3785921-d2413863-Reviews-No_5_Inn-Alva_Clackmannanshire_Scotland.html',
    'https://alvatandoori.com/',
    'https://www.bollinisofalva.co.uk/',
    'https://baynes.co.uk/our-shops/',
  ],
  lastReviewedAt: reviewedDate,
};

const townStudyArea = pkg.project.townStudyArea;
if (!townStudyArea) throw new Error('Alva town study area is missing');
const glenExtension = buffer(
  lineString([
    [-3.7976, 56.1566],
    [-3.8001, 56.16],
  ]),
  0.12,
  { units: 'kilometers' },
);
if (!glenExtension) throw new Error('Could not build the Alva Glen visitor extension');
const visitorBoundary = union(
  featureCollection([townStudyArea.localityBoundary, glenExtension]),
);
if (!visitorBoundary) throw new Error('Could not build the Alva visitor boundary');
visitorBoundary.properties = {
  ...townStudyArea.localityBoundary.properties,
  sourceDataset: 'Curated Alva visitor boundary',
  originalSourceDataset: townStudyArea.sourceName,
  visitorExtensionReviewedAt: reviewedDate,
  visitorExtensionReason:
    'Narrow extension follows the Alva Glen visitor approach and gorge because the glen rises directly from the town and is the official headline Alva attraction.',
};
townStudyArea.visitorBoundary = visitorBoundary;
townStudyArea.notes =
  'The original NRS 2022 Alva locality is preserved unchanged for provenance and statutory-register transparency. The tourist-facing map uses a narrow curated extension into Alva Glen so the official glen entrance, visitor car park and gorge attraction are honestly part of the Alva guide; it does not extend east to Ochil Hills Woodland Park.';

const alvaGlen = featureById('nrhe:47054');
alvaGlen.name = 'Alva Glen';
alvaGlen.shortDescription =
  'Follow the burn from formal gardens into a steep wooded gorge, passing the old mill dam and gaining a strong sense of how closely the town sits beneath the Ochils.';
addTags(alvaGlen, 'current-context', 'service-context-visitor', visitorPackTag, auditTag);
replaceCurrentCurationSource(
  alvaGlen,
  currentSource(
    'Alva Glen visitor information',
    'Clackmannanshire Council',
    'visitor-audit:alva-glen',
    'https://www.clacks.gov.uk/visiting/alvaglen/',
    'Current-place curation: tourism=attraction; name=Alva Glen; visitor_place_type=Glen and nature walk; display_context=visitor; visit_score=79; opening_hours:description=Open access in daylight. Paths become uneven, slippery and unfenced above the formal gardens, with steep drops; entrance_fee=Free; time_to_spend=60-150 minutes; description=Walk from formal gardens into a dramatic wooded gorge with wildlife, an old mill dam and direct access to the Ochil landscape; website=https://www.clacks.gov.uk/visiting/alvaglen/.',
    'local_authority',
  ),
);

const parks = upsertFeature(
  curatedPoint(
    'curated-attraction:alva-johnstone-cochrane-parks',
    'Johnstone & Cochrane Parks',
    'park',
    [-3.805562617240617, 56.15433567623898],
    'Two adjoining parks with inventive play areas, an outdoor gym, sports space and the Ochils as a backdrop; in July they also host the long-running Alva Games.',
    currentSource(
      'Johnstone & Cochrane Parks visitor information',
      'Clackmannanshire Council',
      'visitor-audit:johnstone-cochrane-parks',
      'https://www.clacks.gov.uk/culture/johnstonecochraneparks/',
      'Current-place curation: tourism=attraction; name=Johnstone & Cochrane Parks; visit_score=62; opening_hours:description=Open public parks, daylight visit recommended; entrance_fee=Free; time_to_spend=45-120 minutes; description=Combine creative play, open lawns and an Ochil backdrop in the parks that host the annual Alva Games; website=https://www.clacks.gov.uk/culture/johnstonecochraneparks/.',
      'local_authority',
    ),
    ['current-context', 'curated-visitor-place', 'service-context-visitor'],
  ),
);

const mausoleum = featureById('curated-attraction:alva-johnstone-mausoleum-old-kirkyard');
mausoleum.name = 'Johnstone Mausoleum & Old Alva Kirkyard';
mausoleum.featureType = 'mausoleum';
mausoleum.geometry = { type: 'Point', coordinates: [-3.7923121366576726, 56.155577668090906] };
mausoleum.locationType = 'exact';
mausoleum.locationConfidence = 'high';
mausoleum.address = 'Old Kirkyard, Ochil Road, Alva, FK12 5JU';
mausoleum.shortDescription =
  'A rare c1789 Robert and James Adam mausoleum, accompanied by the footprint of St Serf\'s Church and early gravestones in the old kirkyard.';
addTags(mausoleum, 'current-context', 'service-context-visitor', visitorPackTag, auditTag);
replaceCurrentCurationSource(
  mausoleum,
  currentSource(
    'Johnstone Mausoleum visitor information and HES designation',
    'Clackmannanshire Council and Historic Environment Scotland',
    'visitor-audit:johnstone-mausoleum',
    'https://www.clacks.gov.uk/visiting/johnstonemausoleum/',
    'Current-place curation: tourism=attraction; name=Johnstone Mausoleum & Old Alva Kirkyard; visit_score=53; opening_hours:description=No formal tourist hours are published, visit respectfully in daylight; entrance_fee=Free for an exterior visit; time_to_spend=20-40 minutes; description=See one of only four Adam mausolea in Scotland alongside the surviving footprint and gravestones of old St Serf\'s Church; website=https://www.clacks.gov.uk/visiting/johnstonemausoleum/.',
    'local_authority',
  ),
);

pkg.project.visitorHighlights = [
  {
    rank: 1,
    featureId: alvaGlen.id,
    name: 'Alva Glen',
    reason:
      'The clear reason to visit Alva: a wooded gorge rising directly from the town, with formal gardens, wildlife, mill-water remains and increasingly rugged paths beneath the Ochils.',
    tagline: 'Wooded gorge and mill landscape',
    visitorScore: 79,
    openingTimes:
      'Open access in daylight; upper paths are uneven, slippery and unfenced, with steep drops.',
    admission: 'Free.',
    freeAdmission: true,
    organisationPills: [],
    sourceName: 'Clackmannanshire Council',
    sourceUrl: 'https://www.clacks.gov.uk/visiting/alvaglen/',
    verifiedInBoundaryAt: reviewedDate,
  },
  {
    rank: 2,
    featureId: parks.id,
    name: 'Johnstone & Cochrane Parks',
    reason:
      'The best family addition to an Alva visit, with two play areas, picnic tables, open space and the annual Alva Games giving the parks a distinctive local identity.',
    tagline: 'Play, picnics and Highland Games',
    visitorScore: 62,
    openingTimes: 'Open public parks; daylight use is most suitable.',
    admission: 'Free.',
    freeAdmission: true,
    organisationPills: [],
    sourceName: 'Clackmannanshire Council',
    sourceUrl: 'https://www.clacks.gov.uk/culture/johnstonecochraneparks/',
    verifiedInBoundaryAt: reviewedDate,
  },
  {
    rank: 3,
    featureId: mausoleum.id,
    name: 'Johnstone Mausoleum & Old Alva Kirkyard',
    reason:
      'A short but genuinely distinctive heritage stop: one of only four Adam mausolea in Scotland, set among the traces of old St Serf\'s Church.',
    tagline: 'Rare Adam mausoleum',
    visitorScore: 53,
    openingTimes: 'No formal tourist hours are published; visit respectfully in daylight.',
    admission: 'Free for an exterior visit.',
    freeAdmission: true,
    organisationPills: [],
    sourceName: 'Clackmannanshire Council',
    sourceUrl: 'https://www.clacks.gov.uk/visiting/johnstonemausoleum/',
    verifiedInBoundaryAt: reviewedDate,
  },
];

const glenTrail = upsertFeature(
  curatedPoint(
    'curated-trail:alva-glen-smugglers-cave',
    'Alva Glen to Smuggler\'s Cave',
    'walking_route',
    [-3.7976208, 56.1569928],
    'A short but rugged glen walk from the formal gardens towards Smuggler\'s Cave, with gorge views and slippery, exposed sections requiring care.',
    currentSource(
      'Alva Glen walking route',
      'Clackmannanshire Council and Discover Clackmannanshire',
      'visitor-audit:trail:alva-glen-smugglers-cave',
      'https://www.clackmannanshire.scot/index.php/leisure/alva-glen',
      'Current-place curation: route=foot; trail_type=Rugged glen walk; visit_score=84; distance=About 3 km return depending on turnaround point; time_to_spend=75-120 minutes; accessibility=Uneven, slippery and unfenced paths with steep drops, unsuitable for wheels and requiring close supervision of children; entrance_fee=Free; description=Climb from Alva Glen gardens towards Smuggler\'s Cave for a compact route with waterfalls, gorge scenery and mill-history traces; website=https://www.clackmannanshire.scot/index.php/leisure/alva-glen.',
      'secondary',
    ),
    ['current-context', 'service-context-walk', 'visitor-context-trail', 'trail route'],
    'representative_point',
    'medium',
  ),
);

const textileTrail = featureById('curated-attraction:alva-alva-textile-town-heritage-walk');
textileTrail.name = 'Alva textile-town heritage walk';
textileTrail.featureType = 'walking_route';
textileTrail.shortDescription =
  'A self-guided wander through Stirling Street and Upper Alva, reading the street pattern, civic buildings and surviving fragments of a town once powered by the glen.';
addTags(
  textileTrail,
  'current-context',
  'service-context-walk',
  'visitor-context-trail',
  'heritage trail',
  visitorPackTag,
  auditTag,
);
removeTag(textileTrail, 'service-context-visitor');
replaceCurrentCurationSource(
  textileTrail,
  currentSource(
    'Alva Conservation Area appraisal',
    'Clackmannanshire Council',
    'visitor-audit:trail:alva-textile-town',
    'https://www.clacks.gov.uk/property/alvaconservationarea/',
    'Current-place curation: route=foot; trail_type=Self-guided conservation-area walk; visit_score=68; distance=Flexible town-centre circuit; time_to_spend=45-75 minutes; accessibility=Mostly town streets with normal pavements and road crossings; entrance_fee=Free; description=Use the conservation-area streets and buildings to trace Alva\'s textile-town development below the glen; website=https://www.clacks.gov.uk/property/alvaconservationarea/.',
    'local_authority',
  ),
);

const littleOwls = featureById('osm-community:node-13638168004');
littleOwls.name = 'Little Owls Cafe, Bakery & Kitchen';
updateFood(littleOwls.id, {
  score: 84,
  tagline: 'Best daytime cafe',
  description:
    'Alva\'s strongest daytime cafe, with cooked breakfasts, light lunches and a particularly good home-baking counter in the centre of town.',
  opening: 'Wednesday-Saturday 10:00-16:00, Sunday 10:00-15:00, Monday-Tuesday closed',
  price: '\u00a3\u00a3',
  cuisine: 'Cafe, bakery and light lunches',
  website: 'https://www.littleowlscafe.co.uk/contact',
  organisation: 'Little Owls',
  kind: 'cafe',
  address: '86 Stirling Street, Alva, FK12 5EA',
  reliability: 'official_non_statutory',
});

const no5 = featureById('curated-eat:alva-no5-inn-alva');
no5.geometry = { type: 'Point', coordinates: [-3.799115, 56.154999] };
no5.name = 'The No 5 Inn';
updateFood(no5.id, {
  score: 82,
  tagline: 'Best pub meal',
  description:
    'A characterful local pub for a proper meal and drink, with a long Alva identity and a reputed connection to Robert Burns\'s 1787 journey.',
  opening:
    'Friday-Sunday from noon, Monday-Thursday from 16:00, closing times vary; confirm current kitchen service',
  price: '\u00a3\u00a3',
  cuisine: 'Pub and British',
  website:
    'https://www.tripadvisor.co.uk/Restaurant_Review-g3785921-d2413863-Reviews-No_5_Inn-Alva_Clackmannanshire_Scotland.html',
  organisation: 'The No 5 Inn and Tripadvisor',
  kind: 'restaurant',
  address: '34-38 Brook Street, Alva, FK12 5JL',
  dogFriendly: true,
});

const no71 = upsertFeature(
  curatedPoint(
    'curated-food:alva-no71-coffee-house',
    'No71 Coffee House',
    'cafe',
    [-3.800587, 56.1530117],
    'A friendly central coffee house for breakfast, lunch, homemade cakes and a more distinctive Mexican-influenced menu alongside cafe favourites.',
    currentSource(
      'No71 Coffee House current listing',
      'No71 Coffee House and Tripadvisor',
      'visitor-audit:food:no71-coffee-house',
      'https://www.tripadvisor.co.uk/Restaurant_Review-g3785921-d7740877-Reviews-No71_Coffee_House-Alva_Clackmannanshire_Scotland.html',
      'Current-place curation: amenity=cafe; name=No71 Coffee House; cuisine=Mexican, cafe, British and Scottish; visit_score=79; price_band=\u00a3; opening_hours:description=Monday-Friday 08:00-15:30, Saturday 08:30-15:30, Sunday 09:30-15:30; description=Breakfast and lunch choice: A friendly central coffee house for breakfast, lunch, homemade cakes and Mexican-influenced dishes; website=https://www.tripadvisor.co.uk/Restaurant_Review-g3785921-d7740877-Reviews-No71_Coffee_House-Alva_Clackmannanshire_Scotland.html.',
      'secondary',
    ),
    ['current-context', 'service-context-food', 'visitor-context-food'],
  ),
);
no71.address = '71 Stirling Street, Alva, FK12 5ED';

const tandoori = upsertFeature(
  curatedPoint(
    'curated-food:alva-tandoori',
    'Alva Tandoori',
    'restaurant',
    [-3.799801, 56.1531431],
    'The strongest evening alternative to pub food, serving a broad Indian menu from a central Stirling Street address.',
    currentSource(
      'Alva Tandoori current visitor information',
      'Alva Tandoori',
      'visitor-audit:food:alva-tandoori',
      'https://alvatandoori.com/',
      'Current-place curation: amenity=restaurant; name=Alva Tandoori; cuisine=Indian; visit_score=77; price_band=\u00a3\u00a3; opening_hours:description=Monday and Wednesday-Sunday evening service, Tuesday closed, confirm current ordering hours; description=Evening Indian choice: A broad menu and central location make this Alva\'s strongest alternative to pub dining; website=https://alvatandoori.com/.',
    ),
    ['current-context', 'service-context-food', 'visitor-context-food'],
  ),
);
tandoori.address = '74-76 Stirling Street, Alva, FK12 5EA';

const bollinis = upsertFeature(
  curatedPoint(
    'curated-food:alva-bollinis',
    'Bollinis of Alva',
    'fast_food',
    [-3.8028614, 56.1530916],
    'A dependable evening takeaway for fish and chips, pizza, burgers and other familiar choices rather than a sit-down visitor meal.',
    currentSource(
      'Bollinis of Alva current visitor information',
      'Bollinis of Alva',
      'visitor-audit:food:bollinis',
      'https://www.bollinisofalva.co.uk/',
      'Current-place curation: amenity=fast_food; name=Bollinis of Alva; cuisine=Fish and chips, pizza and takeaway; visit_score=71; price_band=\u00a3; opening_hours:description=Evening takeaway service seven days, confirm live ordering hours; description=Best takeaway range: A useful evening choice for fish and chips and a broad familiar takeaway menu; website=https://www.bollinisofalva.co.uk/.',
      'official_non_statutory',
    ),
    ['current-context', 'service-context-food', 'visitor-context-food'],
  ),
);
bollinis.address = '132 West Stirling Street, Alva, FK12 5EN';

const baynes = featureById('osm-community:node-5879489144');
updateFood(baynes.id, {
  score: 65,
  tagline: 'Early bakery stop',
  description:
    'A practical central bakery for an early roll, pastry, coffee or simple takeaway lunch when independent cafes are closed.',
  opening: 'Monday-Saturday 06:00-16:30, Sunday 08:00-15:00',
  price: '\u00a3',
  cuisine: 'Bakery and takeaway',
  website: 'https://baynes.co.uk/our-shops/',
  organisation: "Bayne's",
  kind: 'fast_food',
  address: 'Stirling Street, Alva, FK12 5EA',
  reliability: 'official_non_statutory',
});

const parkingSources = {
  current: 'https://www.clacks.gov.uk/transport/parking/',
  mapped: 'https://www.clacks.gov.uk/document/tros/1172.pdf',
};
const parkingPlaces: Array<{
  id: string;
  name: string;
  coordinates: [number, number];
  description: string;
  sourceUrl: string;
  locationType?: HeritageFeature['locationType'];
  locationConfidence?: HeritageFeature['locationConfidence'];
}> = [
  {
    id: 'curated-parking:alva-upper-queen-street',
    name: 'Upper Queen Street Car Park',
    coordinates: [-3.8012465740799875, 56.15326244741099],
    description: 'Free council car park just off Stirling Street in the centre of Alva.',
    sourceUrl: parkingSources.mapped,
  },
  {
    id: 'curated-parking:alva-lower-cobden-street',
    name: 'Lower Cobden Street Car Park',
    coordinates: [-3.7994065632629663, 56.152480408316976],
    description: 'Free council car park on the west side of Cobden Street.',
    sourceUrl: parkingSources.mapped,
  },
  {
    id: 'curated-parking:alva-cochrane-park',
    name: 'Cochrane Park Car Park',
    coordinates: [-3.8089984, 56.1536836],
    description: 'Free council parking by Cochrane Hall and the adjoining public parks.',
    sourceUrl: parkingSources.current,
    locationType: 'representative_point',
    locationConfidence: 'medium',
  },
  {
    id: 'curated-parking:alva-glen',
    name: 'Alva Glen Car Park',
    coordinates: [-3.7976208, 56.1569928],
    description: 'Free visitor parking at the lower entrance to Alva Glen and its formal gardens.',
    sourceUrl: 'https://www.clacks.gov.uk/visiting/alvaglen/',
    locationType: 'representative_point',
    locationConfidence: 'medium',
  },
];

const parkingIds = parkingPlaces.map((place) => {
  const feature = upsertFeature(
    curatedPoint(
      place.id,
      place.name,
      'parking',
      place.coordinates,
      place.description,
      currentSource(
        'Alva public parking audit',
        'Clackmannanshire Council',
        `visitor-audit:parking:${place.id}`,
        place.sourceUrl,
        `Current-place curation: amenity=parking; name=${place.name}; parking=surface; access=public; price_display=Free; payment_required=no; maxstay=No time restriction published; description=${place.description}; website=${place.sourceUrl}.`,
        'local_authority',
      ),
      ['current-context', 'service-context-parking'],
      place.locationType,
      place.locationConfidence,
    ),
  );
  return feature.id;
});

const capToilets = upsertFeature(
  curatedPoint(
    'curated-toilets:alva-pop-up-library',
    'Alva Pop-up Library public toilets',
    'other',
    [-3.7968158, 56.150753],
    'Public toilets at Alva Primary School during the published community and fortnightly pop-up library sessions.',
    currentSource(
      'Alva Community Access Point and pop-up library',
      'Clackmannanshire Council',
      'visitor-audit:toilets:alva-pop-up-library',
      'https://www.clacks.gov.uk/culture/alvapopuplibrary/',
      'Current-place curation: amenity=toilets; name=Alva Pop-up Library public toilets; access=public during staffed sessions; price_display=Free; opening_hours:description=Available during published Alva CAP and fortnightly pop-up library sessions, check the live dates before relying on this facility; description=Public toilets inside Alva Primary School during staffed community sessions; website=https://www.clacks.gov.uk/culture/alvapopuplibrary/.',
      'local_authority',
    ),
    ['current-context', 'service-context-toilets'],
    'representative_point',
    'medium',
  ),
);

const parkToilets = upsertFeature(
  curatedPoint(
    'curated-toilets:alva-cochrane-park-seasonal',
    'Cochrane Park seasonal public toilets',
    'other',
    [-3.8091854, 56.1532095],
    'Seasonal public toilets by Cochrane Park; council consultation material reports that they open only in the summer months.',
    currentSource(
      'Cochrane Park toilet service evidence',
      'Clackmannanshire Council',
      'visitor-audit:toilets:cochrane-park',
      'https://www.clacks.gov.uk/document/meeting/1/748/5496.pdf',
      'Current-place curation: amenity=toilets; name=Cochrane Park seasonal public toilets; access=public; opening_hours:description=Summer months only, exact dates and daily hours are not published, check locally before relying on this facility; description=Seasonal public toilets by Cochrane Park and Cochrane Hall; website=https://www.clacks.gov.uk/document/meeting/1/748/5496.pdf.',
      'local_authority',
    ),
    ['current-context', 'service-context-toilets'],
    'representative_point',
    'medium',
  ),
);

const parkPicnic = upsertFeature(
  curatedPoint(
    'curated-picnic:alva-johnstone-cochrane-parks',
    'Johnstone & Cochrane Parks picnic tables',
    'park',
    [-3.805562617240617, 56.15433567623898],
    'Council-confirmed picnic tables in the adjoining parks, close to play areas and open lawns beneath the Ochils.',
    currentSource(
      'Johnstone & Cochrane Parks visitor information',
      'Clackmannanshire Council',
      'visitor-audit:picnic:johnstone-cochrane-parks',
      'https://www.clacks.gov.uk/culture/johnstonecochraneparks/',
      'Current-place curation: tourism=picnic_site; name=Johnstone & Cochrane Parks picnic tables; access=public; price_display=Free; opening_hours:description=Open public parks, daylight use recommended; description=Picnic tables beside the play areas and open lawns of Johnstone and Cochrane Parks; website=https://www.clacks.gov.uk/culture/johnstonecochraneparks/.',
      'local_authority',
    ),
    ['current-context', 'service-context-picnic'],
    'representative_point',
    'medium',
  ),
);

for (const excludedId of [
  'curated-attraction:alva-ochil-hills-woodland-park-and-wood-hill',
  'curated-attraction:alva-alva-golf-club-visitor-round',
]) {
  const excluded = featureById(excludedId);
  addTags(excluded, 'map-hidden', 'visitor-audit-excluded', auditTag);
  excluded.reviewNotes =
    excludedId.includes('woodland-park')
      ? 'Excluded from the Alva town planner on 2026-08-05 because its mapped point is outside the active NRS Alva locality boundary.'
      : 'Excluded from the general Alva visitor planner on 2026-08-05 because a specialist golf round is not a defensible general top attraction.';
  excluded.updatedAt = reviewedAt;
  excluded.reviewed = true;
}

curationLibrary.projects[pkg.project.id] = {
  ...(curationLibrary.projects[pkg.project.id] ?? {}),
  eat: [littleOwls.id, no5.id, no71.id, tandoori.id, bollinis.id, baynes.id],
  trails: [glenTrail.id, textileTrail.id],
  picnic: [parkPicnic.id],
  parking: parkingIds,
  toilets: [capToilets.id, parkToilets.id],
};

const activeVisitorBoundary = pkg.project.townStudyArea?.visitorBoundary;
if (!activeVisitorBoundary) throw new Error('Alva visitor boundary is missing');
const publicFeatureIds = [
  ...pkg.project.visitorHighlights.map((highlight) => highlight.featureId),
  ...Object.values(curationLibrary.projects[pkg.project.id]).flat(),
];
for (const featureId of new Set(publicFeatureIds)) {
  const feature = featureById(featureId);
  if (feature.geometry?.type !== 'Point') {
    throw new Error(`Alva public visitor feature is not a point: ${featureId}`);
  }
  const location = point(feature.geometry.coordinates);
  if (!booleanPointInPolygon(location, activeVisitorBoundary)) {
    throw new Error(`Alva public visitor feature falls outside the visitor boundary: ${featureId}`);
  }
  if (!booleanPointInPolygon(location, pkg.project.boundary)) {
    throw new Error(`Alva public visitor feature falls outside the study boundary: ${featureId}`);
  }
}

const audit = {
  projectId: pkg.project.id,
  reviewedAt,
  boundaryRule:
    'Every public town-planner point was tested against the curated Alva visitor boundary and the retained Alva parish study boundary. The visitor boundary preserves the NRS locality and adds only a narrow extension into Alva Glen.',
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
      name: 'Ochil Hills Woodland Park and Wood Hill walks',
      reason: 'Mapped outside the active Alva locality boundary.',
    },
    {
      name: 'Alva Golf Club visitor round',
      reason: 'Specialist paid activity rather than a general town attraction.',
    },
    {
      name: 'West Stirling Street public convenience',
      reason: 'Council asset evidence records the former public convenience as non-operational.',
    },
    {
      name: 'Unidentified OSM parking and picnic pins',
      reason: 'Not published without a defensible public name and visitor-use status.',
    },
  ],
  sourceUrls: pkg.project.townGuide.sourceUrls,
};

await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`);
await writeFile(curationPath, `${JSON.stringify(curationLibrary, null, 2)}\n`);
await writeFile(auditPath, `${JSON.stringify(audit, null, 2)}\n`);

console.log(
  `Updated Alva visitor audit: ${pkg.project.visitorHighlights.length} attractions, ${curationLibrary.projects[pkg.project.id].eat.length} food stops, ${parkingIds.length} car parks, 2 toilets, 1 picnic place and 2 trails.`,
);
