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

const projectPath = resolve('data/projects/kincardine.json');
const curationPath = resolve('data/visitor-planner-curation.json');
const auditPath = resolve('data/review/kincardine-visitor-audit-2026-08-06.json');
const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
const curationLibrary = JSON.parse(await readFile(curationPath, 'utf8')) as {
  projects: PlannerCuration;
};
const reviewedAt = '2026-08-06T00:00:00Z';
const reviewedDate = '2026-08-06';
const auditTag = 'kincardine-visitor-audit';
const visitorPackTag = 'kincardine-on-forth-scotland-visitor-pack';
const editorialMetadataLicence =
  'Original editorial summary and factual visitor metadata; linked source content is not redistributed.';

function featureById(id: string): HeritageFeature {
  const feature = pkg.features.find((candidate) => candidate.id === id);
  if (!feature) throw new Error(`Missing Kincardine feature: ${id}`);
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
        !record.notes?.startsWith('Current-place curation') &&
        !record.notes?.startsWith('Current-context curation'),
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
  locationType: HeritageFeature['locationType'] = 'representative_point',
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
    tags: [...new Set([...tags, auditTag, visitorPackTag])],
    createdAt: reviewedAt,
    updatedAt: reviewedAt,
    reviewed: true,
    reviewNotes:
      'Curated as present-day visitor information on 2026-08-06; excluded from historic dating and heat-map evidence.',
    evidenceScope: 'related_context',
    licence: editorialMetadataLicence,
  };
}

function updateFood(
  feature: HeritageFeature,
  options: {
    name?: string;
    score: number;
    tagline: string;
    description: string;
    opening: string;
    price: string;
    cuisine: string;
    website: string;
    organisation: string;
    kind: 'cafe' | 'restaurant' | 'fast_food' | 'bakery';
    address: string;
    reliability?: SourceRecord['reliability'];
  },
): HeritageFeature {
  if (options.name) feature.name = options.name;
  feature.featureType = options.kind;
  feature.shortDescription = options.description;
  feature.address = options.address;
  addTags(
    feature,
    'current-context',
    'service-context-food',
    'visitor-context-food',
    auditTag,
    visitorPackTag,
  );
  replaceCurrentCurationSource(
    feature,
    currentSource(
      `${feature.name} visitor audit`,
      options.organisation,
      `visitor-audit-food:${feature.id}`,
      options.website,
      `Current-place curation: amenity=${options.kind}; name=${feature.name}; cuisine=${options.cuisine}; visit_score=${options.score}; price_band=${options.price}; opening_hours:description=${options.opening}; description=${options.tagline}: ${options.description}; website=${options.website}.`,
      options.reliability ?? 'official_non_statutory',
    ),
  );
  return feature;
}

pkg.project.centre = [-3.7188, 56.069];
pkg.project.touristAppeal = {
  rating: 1,
  label: 'Local detour',
  summary:
    'Kincardine is a modest but genuine local detour for its historic port streets, 17th-century Mercat Cross and the engineering presence of Kincardine Bridge. It suits a short heritage walk or coastal-path pause rather than a destination journey on its own.',
};

pkg.project.visualIdentity = {
  theme: 'forth-bridge-and-historic-port',
  badgeImage: '/town-guides/kincardine-forth-bridge-watercolour-guide.png',
  badgeAlt:
    'Editorial ink-and-watercolour illustration of Kincardine Bridge, the Firth of Forth and historic Kincardine roofs',
  heroImage: '/town-guides/kincardine-forth-bridge-watercolour-guide.png',
  heroAlt:
    'Editorial ink-and-watercolour illustration of Kincardine Bridge, the Firth of Forth and historic Kincardine roofs',
  primaryColour: '#174B52',
  accentColour: '#B5792B',
  backgroundColour: '#EFF4EC',
  heroObjectPosition: '50% 52%',
  motifs: ['Kincardine Bridge', 'Historic port', 'Mercat Cross', 'Fife Coastal Path'],
};

pkg.project.townGuide = {
  headline: 'A historic Forth port beneath one of Scotland\'s landmark road bridges',
  intro:
    'Kincardine rewards a short wander rather than a rushed drive-through. Its 17th-century Mercat Cross, old port streets, Sailor\'s Memorial and rare historic pub interior preserve the village\'s maritime character, while the listed 1936 bridge gives the waterfront an unmistakable engineering landmark. The Fife Coastal Path begins here and turns the town into a useful starting point for a longer Forth-side walk.',
  bestFor: ['Industrial heritage', 'Short town walks', 'Bridge engineering', 'Forth views'],
  perfectFor: [
    'A one- to two-hour heritage pause',
    'Walkers beginning the Fife Coastal Path',
    'Visitors interested in bridges, ports and small historic towns',
  ],
  suggestedFirstVisit: {
    title: 'Mercat Cross, old port and Kincardine Bridge',
    summary:
      'Begin at the Mercat Cross, follow the old streets towards the Sailor\'s Memorial and waterfront, then continue to the bridge approach or join the first section of the Fife Coastal Path.',
  },
  dontMiss: [
    'Historic Kincardine townscape and Mercat Cross',
    'Kincardine Bridge viewpoint',
    'Sailor\'s Memorial and old port setting',
    'Tulliallan Old Parish Church',
  ],
  suggestedTime: 'One to two hours; half a day with a trail and food stop',
  visitorMood:
    'A low-key heritage stop for visitors who enjoy finding maritime and engineering stories in working small towns.',
  sourceUrls: [
    'https://www.fife.gov.uk/__data/assets/file/0024/41991/Kincardine-Conservation-Area-Appraisal-and-Management-Plan.pdf',
    'https://kincardinehistory.com/?page_id=350',
    'https://www.trove.scot/place/48126',
    'https://www.transport.gov.scot/transport-network/roads/bridges-and-structures/a985-kincardine-bridge/',
    'https://www.transport.gov.scot/publication/a985-kincardine-bridge-maintenance-works-fy25-26-environmental-impact-assessment-record-of-determination/description-of-main-environmental-impacts-and-proposed-mitigation/',
    'https://fifecoastandcountrysidetrust.co.uk/walks/fife-coastal-path/kincardine-to-limekilns/',
    'https://www.fife.gov.uk/facilities/cemetery/woodlea-old-cemetery%2C-kincardine',
    'https://camra.org.uk/pubs/railway-tavern-kincardine-168397',
    'https://www.fife.gov.uk/facilities/car-park/walker-street-car-park%2C-kincardine',
    'https://www.fife.gov.uk/facilities/public-toilet/public-toilets',
    'https://tulliallangolf.co.uk/the-club/the-puttery/',
    'https://baynes.co.uk/our-shops/',
  ],
  lastReviewedAt: reviewedDate,
};

const townStudyArea = pkg.project.townStudyArea;
if (!townStudyArea) throw new Error('Kincardine town study area is missing');
const bridgeExtension = buffer(
  lineString([
    [-3.7231, 56.06575],
    [-3.7279, 56.0648],
  ]),
  0.11,
  { units: 'kilometers' },
);
if (!bridgeExtension) throw new Error('Could not build the Kincardine Bridge extension');
const woodLeaExtension = buffer(
  lineString([
    [-3.71434, 56.07363],
    [-3.71334, 56.07526],
  ]),
  0.09,
  { units: 'kilometers' },
);
if (!woodLeaExtension) throw new Error('Could not build the Wood Lea visitor extension');
const visitorBoundary = union(
  featureCollection([townStudyArea.localityBoundary, bridgeExtension, woodLeaExtension]),
);
if (!visitorBoundary) throw new Error('Could not build the Kincardine visitor boundary');
visitorBoundary.properties = {
  sourceDataset: 'Curated Kincardine visitor boundary',
  originalSourceDataset: townStudyArea.sourceName,
  basis:
    'NRS Kincardine locality with narrow Kincardine Bridge pedestrian and Wood Lea visitor extensions',
  reviewedAt: reviewedDate,
  reason:
    'The statistical locality is retained for the settlement; only the signed pedestrian bridge approach and the short link from the old parish church to the mapped Wood Lea picnic tables are added.',
};
townStudyArea.visitorBoundary = visitorBoundary;
townStudyArea.notes =
  'The original NRS 2022 Kincardine locality is preserved unchanged for provenance. The tourist-facing boundary uses that locality plus narrow pedestrian extensions to Kincardine Bridge and the Wood Lea picnic tables beside the old parish area. It excludes Tulliallan Golf Club, Tulliallan Castle and Police College, Devilla Forest and wider Forth destinations.';

const mercat = featureById('curated:hes-lb16623');
mercat.name = 'Historic Kincardine townscape and Mercat Cross';
mercat.featureType = 'historic_townscape';
mercat.shortDescription =
  'Explore the compact conservation area around the 17th-century Mercat Cross, High Street and old port lanes for the clearest surviving sense of Kincardine\'s trading-burgh past.';
addTags(mercat, 'current-context', 'service-context-visitor', auditTag);
replaceCurrentCurationSource(
  mercat,
  currentSource(
    'Kincardine conservation area and Mercat Cross visitor audit',
    'Fife Council and Historic Environment Scotland',
    'visitor-audit:historic-kincardine',
    'https://www.trove.scot/place/48126',
    'Current-place curation: tourism=attraction; name=Historic Kincardine townscape and Mercat Cross; visitor_place_type=Historic conservation area and monument; visit_score=66; opening_hours:description=Open-access streets, daylight recommended; entrance_fee=Free; time_to_spend=45-75 minutes; description=Follow the Mercat Cross, High Street and old port lanes through Kincardine\'s compact historic core; website=https://www.trove.scot/place/48126.',
  ),
);

const bridge = featureById('curated:hes-lb50078');
bridge.name = 'Kincardine Bridge engineering viewpoint';
bridge.featureType = 'bridge_viewpoint';
bridge.shortDescription =
  'See the listed 1936 crossing at close range and walk part or all of its dedicated footway for broad estuary views and a clear look at the former swing-span engineering.';
addTags(bridge, 'current-context', 'service-context-visitor', auditTag);
replaceCurrentCurationSource(
  bridge,
  currentSource(
    'Kincardine Bridge visitor and access information',
    'Transport Scotland',
    'visitor-audit:kincardine-bridge',
    'https://www.transport.gov.scot/transport-network/roads/bridges-and-structures/a985-kincardine-bridge/',
    'Current-place curation: tourism=attraction; name=Kincardine Bridge engineering viewpoint; visitor_place_type=Listed road bridge and estuary viewpoint; visit_score=64; opening_hours:description=Pedestrian access is maintained, but check Traffic Scotland for temporary works or restrictions; entrance_fee=Free; accessibility=Dedicated footways run beside live traffic and can be noisy and exposed; time_to_spend=30-60 minutes; description=View or cross the listed 1936 bridge for engineering detail and Forth views; website=https://www.transport.gov.scot/transport-network/roads/bridges-and-structures/a985-kincardine-bridge/.',
    'official_statutory',
  ),
);

const oldChurch = featureById('curated:hes-lb16584');
oldChurch.name = 'Tulliallan Old Parish Church and Woodlea Cemetery';
oldChurch.featureType = 'historic_churchyard';
oldChurch.shortDescription =
  'A quiet historic church and burial landscape on the village edge, rewarding visitors interested in local architecture, memorials and the older Tulliallan parish story.';
addTags(oldChurch, 'current-context', 'service-context-visitor', auditTag);
replaceCurrentCurationSource(
  oldChurch,
  currentSource(
    'Woodlea Old Cemetery visitor information',
    'Fife Council',
    'visitor-audit:woodlea-old-cemetery',
    'https://www.fife.gov.uk/facilities/cemetery/woodlea-old-cemetery%2C-kincardine',
    'Current-place curation: tourism=attraction; name=Tulliallan Old Parish Church and Woodlea Cemetery; visitor_place_type=Historic church and cemetery; visit_score=54; opening_hours:description=No tourist opening hours are published, visit respectfully in daylight and do not disrupt services or burials; entrance_fee=Free; time_to_spend=25-45 minutes; description=Visit a quiet historic church and cemetery that preserves the older Tulliallan parish story; website=https://www.fife.gov.uk/facilities/cemetery/woodlea-old-cemetery%2C-kincardine.',
    'local_authority',
  ),
);

const railwayTavern = featureById('curated:hes-lb51130');
railwayTavern.name = 'Railway Tavern historic interior';
railwayTavern.featureType = 'historic_pub';
railwayTavern.shortDescription =
  'A rare surviving small public-house interior tied to Kincardine\'s ferry and railway story; appreciate it as a working pub rather than a formal museum.';
addTags(railwayTavern, 'current-context', 'service-context-visitor', auditTag);
replaceCurrentCurationSource(
  railwayTavern,
  currentSource(
    'Railway Tavern heritage pub listing',
    'CAMRA',
    'visitor-audit:railway-tavern',
    'https://camra.org.uk/pubs/railway-tavern-kincardine-168397',
    'Current-place curation: tourism=attraction; name=Railway Tavern historic interior; visitor_place_type=Historic working public house; visit_score=48; opening_hours:description=Opening varies, check before travelling specifically to see the interior; entrance_fee=Free to enter as a customer, purchases apply; time_to_spend=30-60 minutes; description=See a rare historic pub interior associated with Kincardine\'s ferry and railway past; website=https://camra.org.uk/pubs/railway-tavern-kincardine-168397.',
  ),
);

const sailor = featureById('osm-community:node-984839901');
sailor.name = 'Kincardine Sailor\'s Memorial';
sailor.featureType = 'memorial';
sailor.shortDescription =
  'A brief waterfront landmark that connects the present village to the sailors, ferries and small port that once defined Kincardine.';
addTags(sailor, 'current-context', 'service-context-visitor', auditTag);
replaceCurrentCurationSource(
  sailor,
  currentSource(
    'Kincardine maritime walk and Sailor\'s Memorial',
    'Kincardine Local History Group and OpenStreetMap contributors',
    'visitor-audit:sailors-memorial',
    'https://kincardinehistory.com/?page_id=350',
    'Current-place curation: tourism=attraction; name=Kincardine Sailor\'s Memorial; visitor_place_type=Maritime memorial; visit_score=43; opening_hours:description=Open-access outdoor memorial, daylight recommended; entrance_fee=Free; time_to_spend=10-20 minutes; description=Pause at a modest waterfront memorial to the sailors and port history of Kincardine; website=https://kincardinehistory.com/?page_id=350.',
  ),
);

pkg.project.visitorHighlights = [
  {
    rank: 1,
    featureId: mercat.id,
    name: mercat.name,
    reason:
      'The Mercat Cross and surrounding conservation area provide the best compact introduction to Kincardine\'s historic trading streets and former port.',
    tagline: 'Mercat Cross and old port streets',
    visitorScore: 66,
    openingTimes: 'Open-access streets. Visit in daylight for the best architecture and waterfront link.',
    admission: 'Free.',
    freeAdmission: true,
    organisationPills: ['HES'],
    sourceName: 'Fife Council and Historic Environment Scotland',
    sourceUrl: 'https://www.trove.scot/place/48126',
    verifiedInBoundaryAt: reviewedDate,
  },
  {
    rank: 2,
    featureId: bridge.id,
    name: bridge.name,
    reason:
      'The listed 1936 bridge is the town\'s defining engineering landmark, with dedicated footways giving close views of the structure and Upper Forth.',
    tagline: 'Listed 1936 Forth crossing',
    visitorScore: 64,
    openingTimes:
      'Pedestrian access is maintained, but check Traffic Scotland for temporary works or restrictions.',
    admission: 'Free.',
    freeAdmission: true,
    organisationPills: [],
    sourceName: 'Transport Scotland',
    sourceUrl:
      'https://www.transport.gov.scot/transport-network/roads/bridges-and-structures/a985-kincardine-bridge/',
    verifiedInBoundaryAt: reviewedDate,
  },
  {
    rank: 3,
    featureId: oldChurch.id,
    name: oldChurch.name,
    reason:
      'The old parish church and cemetery add a peaceful architectural and memorial stop beyond the busier historic core.',
    tagline: 'Old parish and memorial landscape',
    visitorScore: 54,
    openingTimes:
      'No tourist opening hours are published. Visit respectfully in daylight and avoid burials or services.',
    admission: 'Free.',
    freeAdmission: true,
    organisationPills: [],
    sourceName: 'Fife Council',
    sourceUrl:
      'https://www.fife.gov.uk/facilities/cemetery/woodlea-old-cemetery%2C-kincardine',
    verifiedInBoundaryAt: reviewedDate,
  },
  {
    rank: 4,
    featureId: railwayTavern.id,
    name: railwayTavern.name,
    reason:
      'This working pub retains a rare historic interior and gives the old ferry-and-railway story a tangible, characterful stop.',
    tagline: 'Rare historic pub interior',
    visitorScore: 48,
    openingTimes: 'Opening varies. Check before travelling specifically to see the interior.',
    admission: 'Free to enter as a customer; purchases apply.',
    freeAdmission: true,
    organisationPills: ['CAMRA'],
    sourceName: 'CAMRA',
    sourceUrl: 'https://camra.org.uk/pubs/railway-tavern-kincardine-168397',
    verifiedInBoundaryAt: reviewedDate,
  },
  {
    rank: 5,
    featureId: sailor.id,
    name: sailor.name,
    reason:
      'A modest but apt waterfront marker for the sailors, ferries and port trade behind Kincardine\'s historic identity.',
    tagline: 'Maritime memory',
    visitorScore: 43,
    openingTimes: 'Open-access outdoor memorial. Daylight recommended.',
    admission: 'Free.',
    freeAdmission: true,
    organisationPills: [],
    sourceName: 'Kincardine Local History Group',
    sourceUrl: 'https://kincardinehistory.com/?page_id=350',
    verifiedInBoundaryAt: reviewedDate,
  },
];

const marco = updateFood(featureById('osm-community:node-10990017763'), {
  name: 'Marco\'s Kitchen',
  score: 82,
  tagline: 'Best all-round',
  description:
    'Kincardine\'s strongest all-round daytime food stop, with a broad breakfast and lunch menu, homemade soup, sandwiches, baking and well-regarded coffee in the village centre.',
  opening: 'Monday-Friday 09:00-15:00; Saturday-Sunday 10:00-16:00',
  price: '£',
  cuisine: 'British and Scottish cafe, breakfast, lunch and baking',
  website: 'https://www.facebook.com/marcoskitchenkincardine',
  organisation: 'Marco\'s Kitchen and current business listings',
  kind: 'cafe',
  address: '7 Kirk Street, Kincardine, FK10 4PT',
  reliability: 'secondary',
});

const puttery = updateFood(featureById('curated-eat:kincardine-on-forth-the-puttery'), {
  name: 'The Puttery at Tulliallan Golf Club',
  score: 76,
  tagline: 'Lunch with a view',
  description:
    'The most attractive setting for a fuller lunch, looking across the golf course and welcoming non-members as well as golfers; book or check service before making a special journey.',
  opening: 'Open to non-members; check current food-service hours before travelling',
  price: '££',
  cuisine: 'Cafe and clubhouse lunch menu',
  website: 'https://tulliallangolf.co.uk/the-club/the-puttery/',
  organisation: 'Tulliallan Golf Club',
  kind: 'cafe',
  address: 'Tulliallan Golf Club, Alloa Road, Kincardine, FK10 4BB',
});

const baynes = updateFood(featureById('osm-community:node-12513969929'), {
  name: 'Bayne\'s Family Bakers',
  score: 67,
  tagline: 'Early and easy',
  description:
    'A dependable early-opening bakery stop for filled rolls, pies, soup, sweet baking and takeaway coffee, useful before other village cafes open.',
  opening: 'Monday-Saturday 05:30-16:00; Sunday 07:30-15:00',
  price: '£',
  cuisine: 'Bakery, filled rolls, pies, soup and takeaway coffee',
  website: 'https://baynes.co.uk/our-shops/',
  organisation: 'Bayne\'s Family Bakers',
  kind: 'bakery',
  address: '29 High Street, Kincardine, FK10 4RJ',
});

const ilarios = updateFood(
  upsertFeature(
    curatedPoint(
      'curated-eat:kincardine-ilarios',
      'Ilario\'s',
      'fast_food',
      [-3.71856, 56.0682],
      'A long-running village takeaway for fish and chips, pizza and an uncomplicated evening meal after daytime cafes have closed.',
      currentSource(
        'Ilario\'s current visitor listing',
        'Ilario\'s and current business listings',
        'visitor-audit-food:ilarios',
        'https://www.tripadvisor.com/Restaurant_Review-g2053607-d17655539-Reviews-Ilario_s-Kincardine_Fife_Scotland.html',
        'Current-place curation: amenity=fast_food; name=Ilario\'s; cuisine=Fish and chips, pizza and Italian takeaway; visit_score=62; price_band=£; opening_hours:description=Daily 16:00-21:00; description=Evening takeaway: a long-running village option for fish and chips and pizza after the cafes close; website=https://www.tripadvisor.com/Restaurant_Review-g2053607-d17655539-Reviews-Ilario_s-Kincardine_Fife_Scotland.html.',
        'secondary',
      ),
      ['current-context', 'service-context-food', 'visitor-context-food'],
      'representative_point',
      'medium',
    ),
  ),
  {
    score: 62,
    tagline: 'Evening takeaway',
    description:
      'A long-running village takeaway for fish and chips, pizza and an uncomplicated evening meal after daytime cafes have closed.',
    opening: 'Daily 16:00-21:00',
    price: '£',
    cuisine: 'Fish and chips, pizza and Italian takeaway',
    website:
      'https://www.tripadvisor.com/Restaurant_Review-g2053607-d17655539-Reviews-Ilario_s-Kincardine_Fife_Scotland.html',
    organisation: 'Ilario\'s and current business listings',
    kind: 'fast_food',
    address: '3 High Street, Kincardine, FK10 4RJ',
    reliability: 'secondary',
  },
);

const coastalPath = upsertFeature(
  curatedPoint(
    'curated-trail:kincardine-fife-coastal-path',
    'Fife Coastal Path from Kincardine',
    'walking_route',
    [-3.7215091, 56.0660997],
    'Begin the 117-mile waymarked coastal route at its western end, choosing a short Forth-side out-and-back or continuing through Culross towards Limekilns.',
    currentSource(
      'Kincardine to Limekilns Fife Coastal Path',
      'Fife Coast and Countryside Trust',
      'visitor-audit:trail:fife-coastal-path',
      'https://fifecoastandcountrysidetrust.co.uk/walks/fife-coastal-path/kincardine-to-limekilns/',
      'Current-place curation: route=foot; name=Fife Coastal Path from Kincardine; trail_type=Waymarked long-distance coastal path; visit_score=84; distance=Choose a short Forth-side out-and-back or continue on the Kincardine-to-Limekilns section; time_to_spend=60 minutes to multiple days; accessibility=Conditions and surfaces vary by section; entrance_fee=Free; description=Start the Fife Coastal Path at Kincardine and follow the Forth shoreline east; website=https://fifecoastandcountrysidetrust.co.uk/walks/fife-coastal-path/kincardine-to-limekilns/.',
    ),
    ['current-context', 'service-context-walk', 'visitor-context-trail'],
  ),
);

const roundTheHorn = upsertFeature(
  curatedPoint(
    'curated-trail:kincardine-round-the-horn',
    'Round the Horn village wander',
    'walking_route',
    [-3.7183696, 56.0684841],
    'A locally researched circular heritage wander through the old sailors\' village route, linking the historic core, port story and Tulliallan side of Kincardine.',
    currentSource(
      'Round the Horn: A Village Wander',
      'Kincardine Local History Group',
      'visitor-audit:trail:round-the-horn',
      'https://kincardinehistory.com/?page_id=350',
      'Current-place curation: route=foot; name=Round the Horn village wander; trail_type=Self-guided local-history circuit; visit_score=78; distance=Circular village wander, follow the local-history directions; time_to_spend=75-120 minutes; accessibility=One section uses Police College grounds where access can close at short notice and visitors may be asked for identification, use the public-road alternative if unavailable; entrance_fee=Free; description=Follow the old sailors\' circular village walk through Kincardine\'s port and local-history sites; website=https://kincardinehistory.com/?page_id=350.',
    ),
    ['current-context', 'service-context-walk', 'visitor-context-trail'],
  ),
);

const bridgeWalk = upsertFeature(
  curatedPoint(
    'curated-trail:kincardine-bridge-crossing',
    'Kincardine Bridge Forth crossing walk',
    'walking_route',
    [-3.72655, 56.06527],
    'Use the dedicated footway for a short out-and-back over the Upper Forth, with close engineering detail and wide estuary views beside live traffic.',
    currentSource(
      'Kincardine Bridge pedestrian access',
      'Transport Scotland',
      'visitor-audit:trail:kincardine-bridge',
      'https://www.transport.gov.scot/publication/a985-kincardine-bridge-maintenance-works-fy25-26-environmental-impact-assessment-record-of-determination/description-of-main-environmental-impacts-and-proposed-mitigation/',
      'Current-place curation: route=foot; name=Kincardine Bridge Forth crossing walk; trail_type=Bridge out-and-back; visit_score=74; distance=About 2 kilometres return from the Kincardine bridge approach, depending on turnaround point; time_to_spend=35-60 minutes; accessibility=Dedicated footway beside live traffic, exposed to wind and noise, check Traffic Scotland for works; entrance_fee=Free; description=Walk onto or across Kincardine Bridge for engineering and Upper Forth views; website=https://www.transport.gov.scot/publication/a985-kincardine-bridge-maintenance-works-fy25-26-environmental-impact-assessment-record-of-determination/description-of-main-environmental-impacts-and-proposed-mitigation/.',
      'official_statutory',
    ),
    ['current-context', 'service-context-walk', 'visitor-context-trail'],
  ),
);

const parking = featureById('osm-community:way-385084824');
parking.name = 'Walker Street Car Park';
parking.featureType = 'parking';
parking.shortDescription =
  'Free 24-hour public surface car park just off North Approach Road, with 67 spaces and a park-and-ride bus stop nearby.';
parking.address = 'Walker Street, Kincardine, FK10 4NT';
addTags(parking, 'current-context', 'service-context-parking', auditTag, visitorPackTag);
replaceCurrentCurationSource(
  parking,
  currentSource(
    'Walker Street Car Park visitor information',
    'Fife Council',
    'visitor-audit:parking:walker-street',
    'https://www.fife.gov.uk/facilities/car-park/walker-street-car-park%2C-kincardine',
    'Current-place curation: amenity=parking; name=Walker Street Car Park; parking=surface; access=public; capacity=67; opening_hours=24/7; price_display=Free; payment_required=no; park_ride=yes; description=Free 24-hour public car park just off North Approach Road, also used as a park-and-ride site; website=https://www.fife.gov.uk/facilities/car-park/walker-street-car-park%2C-kincardine.',
    'local_authority',
  ),
);

const picnic = upsertFeature(
  curatedPoint(
    'curated-picnic:kincardine-wood-lea',
    'Wood Lea picnic area',
    'picnic_site',
    [-3.71334, 56.07526],
    'A grouped public picnic stop at Wood Lea, representing the cluster of twelve mapped tables rather than publishing each table as a separate anonymous pin.',
    currentSource(
      'Wood Lea picnic-table cluster',
      'OpenStreetMap contributors',
      'visitor-audit:picnic:wood-lea',
      'https://www.openstreetmap.org/node/13094934349',
      'Current-place curation: tourism=picnic_site; name=Wood Lea picnic area; access=public; price_display=Free; opening_hours:description=Open outdoor tables, daylight use recommended; facilities=Twelve mapped picnic tables grouped as one visitor stop; description=Grouped picnic area at Wood Lea rather than separate generic table pins; website=https://www.openstreetmap.org/node/13094934349.',
      'discovery_only',
    ),
    ['current-context', 'service-context-picnic'],
  ),
);

curationLibrary.projects[pkg.project.id] = {
  ...(curationLibrary.projects[pkg.project.id] ?? {}),
  eat: [marco.id, puttery.id, baynes.id, ilarios.id],
  trails: [coastalPath.id, roundTheHorn.id, bridgeWalk.id],
  picnic: [picnic.id],
  parking: [parking.id],
  toilets: [],
};

const golfAttraction = featureById(
  'curated-attraction:kincardine-on-forth-tulliallan-golf-club-visitor-round',
);
addTags(golfAttraction, 'visitor-audit-excluded', auditTag);
golfAttraction.reviewNotes =
  'Excluded from the Kincardine town planner because the golf-course attraction point lies outside the active NRS-locality visitor boundary. The in-boundary Puttery remains a food stop.';
golfAttraction.updatedAt = reviewedAt;
golfAttraction.reviewed = true;

for (const feature of pkg.features) {
  const unnamedParking =
    feature.featureType === 'parking' && feature.id !== parking.id && feature.name === 'Parking';
  const genericPicnicTable = feature.featureType === 'picnic_table';
  if (!unnamedParking && !genericPicnicTable) continue;
  addTags(feature, 'visitor-audit-excluded', auditTag);
  feature.reviewNotes = unnamedParking
    ? 'Excluded from the public planner because this is unnamed OSM parking without verified public visitor access; Walker Street is the only official public car park.'
    : 'Excluded as an individual public card; twelve Wood Lea OSM table pins are grouped into one named picnic-area entry.';
  feature.updatedAt = reviewedAt;
  feature.reviewed = true;
}

const activeVisitorBoundary = townStudyArea.visitorBoundary;
if (!activeVisitorBoundary) throw new Error('Kincardine visitor boundary is missing');
const publicFeatureIds = [
  ...pkg.project.visitorHighlights.map((highlight) => highlight.featureId),
  ...Object.values(curationLibrary.projects[pkg.project.id]).flat(),
];
for (const featureId of new Set(publicFeatureIds)) {
  const feature = featureById(featureId);
  if (feature.geometry?.type !== 'Point') {
    throw new Error(`Kincardine public visitor feature is not a point: ${featureId}`);
  }
  const location = point(feature.geometry.coordinates);
  if (!booleanPointInPolygon(location, activeVisitorBoundary)) {
    throw new Error(`Kincardine public visitor feature falls outside visitor boundary: ${featureId}`);
  }
}

const audit = {
  projectId: pkg.project.id,
  reviewedAt,
  townRating: {
    rating: pkg.project.touristAppeal.rating,
    rationale:
      'One star is retained: Kincardine has a coherent short heritage and bridge visit, but not enough destination-scale attractions to justify a planned tourist journey on its own.',
  },
  boundaryRule:
    'The original NRS 2022 Kincardine locality and Tulliallan parish are preserved unchanged. Every public planner point was tested against the locality plus narrow pedestrian extensions to Kincardine Bridge and the Wood Lea picnic tables. These visitor extensions do not change parish heat scoring.',
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
      name: 'Tulliallan Golf Club visitor round',
      reason:
        'The attraction point is north of the active visitor boundary. The Puttery is retained because its entrance point is inside the NRS locality.',
    },
    {
      name: 'Tulliallan Castle and Police College',
      reason:
        'Restricted institutional grounds, not a dependable public tourist attraction. The Round the Horn trail carries an explicit access caveat.',
    },
    {
      name: 'Devilla Forest and wider Forth attractions',
      reason: 'Outside the active Kincardine visitor polygon and suitable only for wider-area context.',
    },
    {
      name: 'Unnamed and customer-only parking',
      reason: 'Only the verified Fife Council Walker Street public car park is published.',
    },
    {
      name: 'Generic public toilets',
      reason:
        'Fife Council does not list a Kincardine public toilet, and customer toilets are not dependable public visitor facilities.',
    },
    {
      name: 'Individual picnic-table pins',
      reason: 'The twelve Wood Lea tables are grouped into one named practical stop.',
    },
  ],
  sourceUrls: pkg.project.townGuide.sourceUrls,
};

await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`);
await writeFile(curationPath, `${JSON.stringify(curationLibrary, null, 2)}\n`);
await writeFile(auditPath, `${JSON.stringify(audit, null, 2)}\n`);

console.log(
  `Updated Kincardine visitor audit: ${pkg.project.visitorHighlights.length} attractions, ${curationLibrary.projects[pkg.project.id].eat.length} food stops, ${curationLibrary.projects[pkg.project.id].trails.length} trails, 1 car park, 0 toilets and 1 picnic area.`,
);
