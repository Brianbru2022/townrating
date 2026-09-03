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

const projectPath = resolve('data/projects/callander.json');
const curationPath = resolve('data/visitor-planner-curation.json');
const auditPath = resolve('data/review/callander-visitor-audit-2026-08-06.json');
const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
const curationLibrary = JSON.parse(await readFile(curationPath, 'utf8')) as {
  projects: PlannerCuration;
};
const reviewedAt = '2026-08-06T00:00:00Z';
const reviewedDate = '2026-08-06';
const auditTag = 'callander-visitor-audit';
const visitorPackTag = 'callander-scotland-visitor-pack';
const editorialMetadataLicence =
  'Original editorial summary and factual visitor metadata; linked source content is not redistributed.';
const osmLicence = 'Open Database Licence (ODbL) v1.0; © OpenStreetMap contributors.';

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

function upsertFeature(feature: HeritageFeature): HeritageFeature {
  const index = pkg.features.findIndex((candidate) => candidate.id === feature.id);
  if (index === -1) pkg.features.push(feature);
  else pkg.features[index] = feature;
  return feature;
}

function featureDescription(feature: HeritageFeature): string {
  if (!feature.shortDescription) {
    throw new Error(`${feature.name} is missing its visitor description`);
  }
  return feature.shortDescription;
}

function curatedPoint(options: {
  id: string;
  name: string;
  featureType: string;
  coordinates: [number, number];
  description: string;
  source: SourceRecord;
  tags: string[];
  address?: string;
  locationConfidence?: HeritageFeature['locationConfidence'];
}): HeritageFeature {
  return {
    id: options.id,
    projectId: pkg.project.id,
    name: options.name,
    alternativeNames: [],
    countryCode: pkg.project.countryCode,
    region: pkg.project.region,
    locality: pkg.project.locality,
    featureType: options.featureType,
    significance: 'local',
    geometry: { type: 'Point', coordinates: options.coordinates },
    locationType: 'representative_point',
    locationConfidence: options.locationConfidence ?? 'high',
    dateBasis: 'unknown',
    dateConfidence: 'unknown',
    survival: 'unknown',
    shortDescription: options.description,
    address: options.address,
    sourceRecords: [options.source],
    tags: [...new Set([...options.tags, auditTag, visitorPackTag])],
    createdAt: reviewedAt,
    updatedAt: reviewedAt,
    reviewed: true,
    reviewNotes:
      'Curated as present-day visitor information on 2026-08-06; excluded from historic dating and heat-map evidence.',
    evidenceScope: 'related_context',
    licence: options.source.licence,
  };
}

function attraction(options: {
  id: string;
  name: string;
  featureType: string;
  coordinates: [number, number];
  score: number;
  tagline: string;
  description: string;
  opening: string;
  admission: string;
  time: string;
  website: string;
  sourceName: string;
  organisation: string;
  reliability?: SourceRecord['reliability'];
}): HeritageFeature {
  return upsertFeature(
    curatedPoint({
      id: options.id,
      name: options.name,
      featureType: options.featureType,
      coordinates: options.coordinates,
      description: options.description,
      source: currentSource(
        options.sourceName,
        options.organisation,
        `visitor-audit:attraction:${options.id}`,
        options.website,
        `Current-place curation: tourism=attraction; name=${options.name}; visitor_place_type=${options.tagline}; visit_score=${options.score}; opening_hours:description=${options.opening}; entrance_fee=${options.admission}; time_to_spend=${options.time}; description=${options.description}; website=${options.website}.`,
        options.reliability,
      ),
      tags: ['current-context', 'service-context-visitor'],
    }),
  );
}

function trail(options: {
  id: string;
  name: string;
  coordinates: [number, number];
  score: number;
  trailType: string;
  description: string;
  distance: string;
  time: string;
  accessibility: string;
  website: string;
}): HeritageFeature {
  return upsertFeature(
    curatedPoint({
      id: options.id,
      name: options.name,
      featureType: 'walking_route',
      coordinates: options.coordinates,
      description: options.description,
      source: currentSource(
        `${options.name} route information`,
        'Loch Lomond & The Trossachs National Park Authority',
        `visitor-audit:trail:${options.id}`,
        options.website,
        `Current-place curation: route=foot; name=${options.name}; trail_type=${options.trailType}; visit_score=${options.score}; distance=${options.distance}; time_to_spend=${options.time}; accessibility=${options.accessibility}; entrance_fee=Free; description=${options.description}; website=${options.website}.`,
      ),
      tags: ['current-context', 'service-context-walk', 'visitor-context-trail'],
    }),
  );
}

function food(options: {
  id: string;
  name: string;
  kind: 'cafe' | 'restaurant' | 'pub';
  coordinates: [number, number];
  score: number;
  tagline: string;
  description: string;
  opening: string;
  price: string;
  cuisine: string;
  website: string;
  organisation: string;
  address: string;
  dogFriendly?: boolean;
  reliability?: SourceRecord['reliability'];
}): HeritageFeature {
  const dogDetail = options.dogFriendly ? '; dog_friendly=yes' : '';
  return upsertFeature(
    curatedPoint({
      id: options.id,
      name: options.name,
      featureType: options.kind,
      coordinates: options.coordinates,
      description: options.description,
      address: options.address,
      source: currentSource(
        `${options.name} visitor information`,
        options.organisation,
        `visitor-audit:food:${options.id}`,
        options.website,
        `Current-place curation: amenity=${options.kind}; name=${options.name}; cuisine=${options.cuisine}; visit_score=${options.score}; price_band=${options.price}; opening_hours:description=${options.opening}${dogDetail}; description=${options.tagline}: ${options.description}; website=${options.website}.`,
        options.reliability,
        `${editorialMetadataLicence} Geometry derived from ${osmLicence}`,
      ),
      tags: ['current-context', 'service-context-food', 'visitor-context-food'],
    }),
  );
}

function parking(options: {
  id: string;
  name: string;
  coordinates: [number, number];
  capacity?: number;
  paid: boolean;
  description: string;
  sourceUrl: string;
  organisation: string;
}): HeritageFeature {
  const price = options.paid
    ? 'Pay: 2 hours £2.60, 4 hours £3.10 or all day £4.10'
    : 'Free';
  const chargingHours = options.paid
    ? 'Open daily; charges apply every day 08:45-17:00'
    : 'Open daily; observe current entrance signs';
  const capacity = options.capacity ? `; capacity=${options.capacity}` : '';
  const payment = options.paid
    ? '; payment_required=yes; payment:app=yes; payment:cash=yes'
    : '; payment_required=no';
  return upsertFeature(
    curatedPoint({
      id: options.id,
      name: options.name,
      featureType: 'parking',
      coordinates: options.coordinates,
      description: options.description,
      source: currentSource(
        `${options.name} visitor information`,
        options.organisation,
        `visitor-audit:parking:${options.id}`,
        options.sourceUrl,
        `Current-place curation: amenity=parking; name=${options.name}; parking=surface; access=public${capacity}; price_display=${price}${payment}; opening_hours:description=${chargingHours}; description=${options.description}; website=${options.sourceUrl}.`,
        options.organisation === 'Stirling Council' ? 'local_authority' : 'official_non_statutory',
        `${editorialMetadataLicence} Geometry derived from ${osmLicence}`,
      ),
      tags: ['current-context', 'service-context-parking'],
    }),
  );
}

function toilets(options: {
  id: string;
  name: string;
  coordinates: [number, number];
  opening: string;
  accessibility: string;
  babyChanging?: boolean;
  sourceUrl: string;
  reliability?: SourceRecord['reliability'];
}): HeritageFeature {
  return upsertFeature(
    curatedPoint({
      id: options.id,
      name: options.name,
      featureType: 'toilets',
      coordinates: options.coordinates,
      description: `${options.name}; available ${options.opening.toLocaleLowerCase()}.`,
      source: currentSource(
        `${options.name} visitor information`,
        options.reliability === 'local_authority'
          ? 'Stirling Council'
          : 'Callander Visitor Information Centre',
        `visitor-audit:toilets:${options.id}`,
        options.sourceUrl,
        `Current-place curation: amenity=toilets; name=${options.name}; access=public; price_display=Free; opening_hours:description=${options.opening}; wheelchair=${options.accessibility}; baby_changing=${options.babyChanging ? 'yes' : 'unknown'}; description=${options.name}; website=${options.sourceUrl}.`,
        options.reliability ?? 'secondary',
        `${editorialMetadataLicence} Geometry derived from ${osmLicence}`,
      ),
      tags: ['current-context', 'service-context-toilets'],
      locationConfidence: options.id.includes('station-road') ? 'high' : 'medium',
    }),
  );
}

const townStudyArea = pkg.project.townStudyArea;
if (!townStudyArea) throw new Error('Callander town study area is missing');

const northEastVisitorCorridor = buffer(
  lineString([
    [-4.208, 56.2452],
    [-4.2068207, 56.2463889],
    [-4.2010435, 56.2477561],
    [-4.1979, 56.2527],
    [-4.1940273, 56.2604988],
  ]),
  0.16,
  { units: 'kilometers' },
);
const cragsVisitorCorridor = buffer(
  lineString([
    [-4.2068207, 56.2463889],
    [-4.204, 56.2506],
  ]),
  0.15,
  { units: 'kilometers' },
);
const meadowsVisitorCorridor = buffer(
  lineString([
    [-4.2186, 56.2445],
    [-4.2191466, 56.2442168],
    [-4.2208, 56.2418],
  ]),
  0.16,
  { units: 'kilometers' },
);
if (!northEastVisitorCorridor || !cragsVisitorCorridor || !meadowsVisitorCorridor) {
  throw new Error('Could not construct Callander visitor extensions');
}
const visitorBoundary = union(
  featureCollection([
    townStudyArea.localityBoundary,
    northEastVisitorCorridor,
    cragsVisitorCorridor,
    meadowsVisitorCorridor,
  ]),
);
if (!visitorBoundary) throw new Error('Could not construct the Callander visitor boundary');
visitorBoundary.properties = {
  sourceDataset: 'Curated Callander visitor study boundary',
  localityName: 'Callander',
  originalSourceDataset: townStudyArea.sourceName,
  originalOsmType: 'way',
  originalOsmId: 369986773,
  visitorExtensionReviewedAt: reviewedDate,
  visitorExtensionReason:
    'The original OSM Callander place polygon is preserved and unioned with narrow visitor corridors for the Meadows, Lower Woods, Callander Crags and the Bracklinn Falls circuit. The corridors include only named town-start visitor clusters and do not claim an administrative boundary.',
};
townStudyArea.bufferMetres = 160;
townStudyArea.bufferedBoundary = visitorBoundary;
townStudyArea.visitorBoundary = visitorBoundary;
townStudyArea.notes =
  'The original OSM Callander place polygon is preserved unchanged for provenance. The active visitor boundary is a proper geometric union with narrow corridors to Callander Meadows, the Crags and the Bracklinn Falls circuit. Walks may continue beyond the study area, but every published planner marker is inside it.';
pkg.project.boundary = visitorBoundary;
pkg.project.boundarySource =
  'OpenStreetMap Callander place polygon with transparent, narrow visitor corridors to the Meadows, Callander Crags, Lower Woods and Bracklinn Falls circuit. This is a curated visitor-town boundary, not an administrative boundary.';
pkg.project.boundaryConfidence = 'medium';
pkg.project.researchNotes =
  'Full visitor audit completed 2026-08-06. Attractions and practical markers must be inside the active visitor boundary. Trail cards use a verified town or visitor-cluster start point even where the route continues farther into the landscape.';

pkg.project.touristAppeal = {
  rating: 3,
  label: 'Destination draw',
  summary:
    'Callander merits three stars as a compact Trossachs destination rather than merely a gateway. Bracklinn Falls, Callander Crags, a strong network of signed walks, an engaging seasonal toy museum and an unusually useful independent food scene can comfortably fill a day or a walking weekend.',
};

pkg.project.visualIdentity = {
  theme: 'trossachs-waterfall',
  badgeImage: '/town-guides/callander-bracklinn-falls-guide.png',
  badgeAlt:
    'Light editorial ink-and-watercolour illustration of mossy rocks, woodland and tumbling water at Bracklinn Falls near Callander',
  heroImage: '/town-guides/callander-bracklinn-falls-guide.png',
  heroAlt:
    'Light editorial ink-and-watercolour illustration of mossy rocks, woodland and tumbling water at Bracklinn Falls near Callander',
  primaryColour: '#173F3D',
  accentColour: '#7B8F3E',
  backgroundColour: '#EEF6E8',
  heroObjectPosition: '50% 50%',
  motifs: ['Bracklinn Falls', 'Crag-top views', 'River Teith', 'Trossachs walks'],
};

pkg.project.townGuide = {
  headline: 'Waterfalls, crag-top views and a lively Trossachs base',
  intro:
    'Callander makes an easy first taste of the Trossachs with more depth than a simple gateway stop. Walk from the centre through its planned Georgian streets, climb towards the Crags, follow the River Teith or set out for Bracklinn Falls, then return to independent cafes, bakeries and relaxed evening food.',
  bestFor: ['Waterfall walks', 'Big-view short hikes', 'Riverside wandering', 'Independent food'],
  perfectFor: [
    'A full day mixing Bracklinn Falls with the town centre',
    'A walking weekend with several routes from one base',
    'Families combining the toy museum with an easy riverside walk',
  ],
  suggestedFirstVisit: {
    title: 'Bracklinn Falls, Ancaster Square and the River Teith',
    summary:
      'Begin at Bracklinn Falls before the paths become busy, return to Ancaster Square for lunch, then choose the short heritage trail or the level Callander Meadows circuit beside the River Teith.',
  },
  dontMiss: ['Bracklinn Falls and Bridge', 'Callander Crags', 'Hamilton Toy Museum'],
  suggestedTime: 'A full day; a weekend for several walks',
  visitorMood:
    'For visitors who want genuine Highland-edge scenery without giving up a compact town, useful food choices and several walks that begin close to the centre.',
  sourceUrls: [
    'https://www.lochlomond-trossachs.org/discover-the-park/towns-villages/callander/',
    'https://www.lochlomond-trossachs.org/things-to-do/walking/short-moderate-walks/bracklinn-falls-circuit/',
    'https://www.lochlomond-trossachs.org/things-to-do/walking/hillwalking/callander-crags/',
    'https://www.lochlomond-trossachs.org/discover-the-park/our-heritage-culture/heritage-walks/callander-heritage-trail/',
    'https://thehamiltontoycollection.co.uk/',
    'https://www.visitcallander.uk/cafes-coffee-shops',
    'https://www.visitcallander.uk/restaurants',
    'https://www.stirling.gov.uk/roads-transport-and-parking/parking-and-permits/parking-in-stirling/',
    'https://www.stirling.gov.uk/community-life-and-leisure/public-toilets/list-of-the-public-toilets-in-stirling/callander-station-square/',
  ],
  lastReviewedAt: reviewedDate,
};

const bracklinnFalls = attraction({
  id: 'curated-attraction:callander-bracklinn-falls-and-bridge',
  name: 'Bracklinn Falls and Bridge',
  featureType: 'waterfall',
  coordinates: [-4.1979, 56.2527],
  score: 88,
  tagline: 'Waterfall and gorge',
  description:
    'Hear the Keltie Water gather force through a rocky gorge, then look directly into the cascades from the striking footbridge: Callander\'s clearest natural showpiece.',
  opening: 'Open access; visit in daylight and take care near steep drops and slippery rock',
  admission: 'Free',
  time: '30-60 minutes for the falls; 2-2.5 hours for the full circuit',
  website:
    'https://www.lochlomond-trossachs.org/things-to-do/walking/short-moderate-walks/bracklinn-falls-circuit/',
  sourceName: 'Bracklinn Falls Circuit',
  organisation: 'Loch Lomond & The Trossachs National Park Authority',
});

const toyMuseum = attraction({
  id: 'curated-attraction:callander-hamilton-toy-museum',
  name: 'Hamilton Toy Museum and Collectors Shop',
  featureType: 'museum',
  coordinates: [-4.211559, 56.2430456],
  score: 78,
  tagline: 'Toy museum',
  description:
    'Three densely packed floors turn 175 years of family collecting into an affectionate, nostalgic journey through model trains, die-cast cars, dolls, puppets and childhood favourites.',
  opening:
    'Easter to the end of October: Tuesday-Saturday 10:30-17:00; last admission 16:30; Sunday-Monday closed',
  admission: 'Adults £4; children £2; family ticket £10',
  time: '45-90 minutes',
  website: 'https://thehamiltontoycollection.co.uk/',
  sourceName: 'Hamilton Toy Museum visitor information',
  organisation: 'Hamilton Toy Museum and Collectors Shop',
});

const ancasterSquare = attraction({
  id: 'curated-attraction:callander-ancaster-square-main-street',
  name: 'Ancaster Square and historic Main Street',
  featureType: 'historic_townscape',
  coordinates: [-4.2154, 56.2447],
  score: 64,
  tagline: 'Historic townscape',
  description:
    'The broad planned street, old church, war memorial and changing Georgian and Victorian frontages give Callander a recognisable town-centre character worth exploring on foot.',
  opening: 'Open access at all times',
  admission: 'Free',
  time: '30-60 minutes',
  website:
    'https://www.lochlomond-trossachs.org/discover-the-park/our-heritage-culture/heritage-walks/callander-heritage-trail/',
  sourceName: 'Callander Heritage Trail: Stories in the Stones',
  organisation: 'Loch Lomond & The Trossachs National Park Authority',
});

const oldKirkyard = attraction({
  id: 'curated-attraction:callander-old-kirkyard-tom-na-chisaig',
  name: 'Old Kirkyard, Watch House and Tom na Chisaig',
  featureType: 'historic_site',
  coordinates: [-4.2169, 56.2425],
  score: 57,
  tagline: 'Kirkyard and medieval mound',
  description:
    'A compact atmospheric group links an early church site, late-18th and early-19th-century graves, a body-snatchers\' watch house and a probable medieval castle mound.',
  opening: 'Open-air site; daylight visiting is most respectful',
  admission: 'Free',
  time: '20-40 minutes',
  website:
    'https://www.lochlomond-trossachs.org/discover-the-park/our-heritage-culture/heritage-walks/callander-heritage-trail/',
  sourceName: 'Callander Heritage Trail: Stories in the Stones',
  organisation: 'Loch Lomond & The Trossachs National Park Authority',
});

const redBridge = attraction({
  id: 'curated-attraction:callander-red-bridge-river-teith',
  name: 'Red Bridge and River Teith',
  featureType: 'bridge_viewpoint',
  coordinates: [-4.216, 56.2418],
  score: 52,
  tagline: 'River viewpoint',
  description:
    'Pause on the red-sandstone 1908 bridge for an easy River Teith view and a small piece of television history from the opening titles of Dr Finlay\'s Casebook.',
  opening: 'Open access at all times',
  admission: 'Free',
  time: '10-20 minutes',
  website:
    'https://www.lochlomond-trossachs.org/discover-the-park/our-heritage-culture/heritage-walks/callander-heritage-trail/',
  sourceName: 'Callander Heritage Trail: Stories in the Stones',
  organisation: 'Loch Lomond & The Trossachs National Park Authority',
});

pkg.project.visitorHighlights = [
  {
    rank: 1,
    featureId: bracklinnFalls.id,
    name: bracklinnFalls.name,
    reason: featureDescription(bracklinnFalls),
    tagline: 'Waterfall drama',
    visitorScore: 88,
    openingTimes:
      'Open access; visit in daylight and take care near steep drops and slippery rock.',
    admission: 'Free.',
    freeAdmission: true,
    sourceName: 'Loch Lomond & The Trossachs National Park Authority',
    sourceUrl:
      'https://www.lochlomond-trossachs.org/things-to-do/walking/short-moderate-walks/bracklinn-falls-circuit/',
    verifiedInBoundaryAt: reviewedDate,
  },
  {
    rank: 2,
    featureId: toyMuseum.id,
    name: toyMuseum.name,
    reason: featureDescription(toyMuseum),
    tagline: 'Nostalgic collection',
    visitorScore: 78,
    openingTimes:
      'Easter-end October: Tuesday-Saturday 10:30-17:00; last admission 16:30.',
    admission: 'Adults £4; children £2; family ticket £10.',
    freeAdmission: false,
    sourceName: 'Hamilton Toy Museum and Collectors Shop',
    sourceUrl: 'https://thehamiltontoycollection.co.uk/',
    verifiedInBoundaryAt: reviewedDate,
  },
  {
    rank: 3,
    featureId: ancasterSquare.id,
    name: ancasterSquare.name,
    reason: featureDescription(ancasterSquare),
    tagline: 'Planned town centre',
    visitorScore: 64,
    openingTimes: 'Open access at all times.',
    admission: 'Free.',
    freeAdmission: true,
    sourceName: 'Callander Heritage Trail: Stories in the Stones',
    sourceUrl:
      'https://www.lochlomond-trossachs.org/discover-the-park/our-heritage-culture/heritage-walks/callander-heritage-trail/',
    verifiedInBoundaryAt: reviewedDate,
  },
  {
    rank: 4,
    featureId: oldKirkyard.id,
    name: oldKirkyard.name,
    reason: featureDescription(oldKirkyard),
    tagline: 'Layered local history',
    visitorScore: 57,
    openingTimes: 'Open-air site; daylight visiting is most respectful.',
    admission: 'Free.',
    freeAdmission: true,
    sourceName: 'Callander Heritage Trail: Stories in the Stones',
    sourceUrl:
      'https://www.lochlomond-trossachs.org/discover-the-park/our-heritage-culture/heritage-walks/callander-heritage-trail/',
    verifiedInBoundaryAt: reviewedDate,
  },
  {
    rank: 5,
    featureId: redBridge.id,
    name: redBridge.name,
    reason: featureDescription(redBridge),
    tagline: 'River and screen history',
    visitorScore: 52,
    openingTimes: 'Open access at all times.',
    admission: 'Free.',
    freeAdmission: true,
    sourceName: 'Callander Heritage Trail: Stories in the Stones',
    sourceUrl:
      'https://www.lochlomond-trossachs.org/discover-the-park/our-heritage-culture/heritage-walks/callander-heritage-trail/',
    verifiedInBoundaryAt: reviewedDate,
  },
];

const bracklinnCircuit = trail({
  id: 'curated-attraction:callander-bracklinn-falls-circuit',
  name: 'Bracklinn Falls Circuit',
  coordinates: [-4.2010435, 56.2477561],
  score: 88,
  trailType: 'Moderate waterfall and woodland circuit',
  description:
    'Follow the Keltie Water to the bridge and falls, then climb through forest for wider mountain views before returning by the minor road.',
  distance: '5.3 km / 3.5 miles',
  time: 'Allow 2-2.5 hours',
  accessibility:
    'Compacted path with loose and uneven sections, steps, a steep climb and exposed gorge edges',
  website:
    'https://www.lochlomond-trossachs.org/things-to-do/walking/short-moderate-walks/bracklinn-falls-circuit/',
});

const callanderCrags = trail({
  id: 'curated-attraction:callander-callander-crags',
  name: 'Callander Crags',
  coordinates: [-4.2068207, 56.2463889],
  score: 85,
  trailType: 'Steep woodland and crag-top circuit',
  description:
    'Climb through woodland to the 343-metre cairn for a bird\'s-eye view over Callander, Loch Venachar, Ben Ledi and the Highland Boundary landscape.',
  distance: 'About 4 km / 2.5 miles',
  time: 'Allow 1.5-3 hours',
  accessibility: 'Steep hill path with uneven and exposed sections; stout footwear recommended',
  website:
    'https://www.lochlomond-trossachs.org/things-to-do/walking/hillwalking/callander-crags/',
});

const heritageTrail = trail({
  id: 'curated-attraction:callander-callander-heritage-trail',
  name: 'Callander Heritage Trail - Stories in the Stones',
  coordinates: [-4.2153, 56.2446],
  score: 81,
  trailType: 'Easy self-guided town heritage trail',
  description:
    'Interpretation panels lead through one of Scotland\'s early planned towns, linking Ancaster Square, railway tourism, the old kirkyard, Red Bridge and Victorian architecture.',
  distance: '1-2 miles / 1.6-3.2 km',
  time: 'Allow 30-60 minutes',
  accessibility: 'Pavements and firm-surfaced paths with road crossings',
  website:
    'https://www.lochlomond-trossachs.org/discover-the-park/our-heritage-culture/heritage-walks/callander-heritage-trail/',
});

const meadowsTrail = trail({
  id: 'curated-attraction:callander-callander-meadows',
  name: 'Callander Meadows and River Teith',
  coordinates: [-4.2191466, 56.2442168],
  score: 76,
  trailType: 'Easy level riverside circuit',
  description:
    'A short, wildlife-rich loop beside the River Teith with meadow flowers, open water views and an easy return to the town centre.',
  distance: '1.8 km / 1.25 miles',
  time: 'Allow 30 minutes',
  accessibility: 'Level surfaced roads and paths; the meadow can flood after heavy rain',
  website:
    'https://www.lochlomond-trossachs.org/things-to-do/walking/short-moderate-walks/callander-meadows/',
});

const threeBridges = trail({
  id: 'curated-attraction:callander-three-bridges-walk',
  name: 'Three Bridges of Callander',
  coordinates: [-4.2143036, 56.2443932],
  score: 75,
  trailType: 'Moderate countryside and woodland circuit',
  description:
    'A varied half-day circuit combines the River Teith, Coilhallan Wood, open fields, old railway paths and traces of Roman and prehistoric Callander.',
  distance: '7.2 km / 4.5 miles',
  time: 'Allow about 2.5 hours',
  accessibility: 'Mixed woodland, field and surfaced paths with moderate gradients',
  website:
    'https://www.lochlomond-trossachs.org/things-to-do/walking/short-moderate-walks/three-bridges-callander/',
});

const lowerWoods = trail({
  id: 'curated-attraction:callander-lower-woods',
  name: 'Lower Woods',
  coordinates: [-4.2068207, 56.2463889],
  score: 72,
  trailType: 'Moderate woodland loop',
  description:
    'An atmospheric mixed-woodland circuit climbs gently to a viewpoint over the Menteith Hills before returning through the east side of town.',
  distance: '3 km / 2 miles',
  time: 'Allow 1 hour',
  accessibility: 'Compacted and loose surfaces, uneven in places, with a short steep descent',
  website:
    'https://www.lochlomond-trossachs.org/things-to-do/walking/short-moderate-walks/lower-woods-callander/',
});

const glacierTrail = trail({
  id: 'curated-trail:callander-glacier-trail',
  name: 'Callander Glacier Trail',
  coordinates: [-4.2076, 56.2428],
  score: 70,
  trailType: 'Easy low-level geology trail',
  description:
    'A gentle route from the east end of Main Street reveals the deposits and landforms left as glaciers retreated from the area around 12,000 years ago.',
  distance: '3.5-4.7 km / 2.2-2.9 miles',
  time: 'Allow about 90 minutes',
  accessibility: 'Low-level but uneven and sometimes muddy paths',
  website: 'https://www.visitcallander.uk/walking',
});

const graceRestaurant = food({
  id: 'curated-food:callander-grace-restaurant',
  name: 'Grace Restaurant at Callander Meadows',
  kind: 'restaurant',
  coordinates: [-4.2169613, 56.2441445],
  score: 87,
  tagline: 'Best special meal',
  description:
    'Hyper-local, season-led cooking turns nearby farms, foraged ingredients and careful technique into Callander\'s most distinctive sit-down meal.',
  opening:
    'October-March Thursday-Sunday dinner 18:00-20:30; April-September Thursday-Sunday garden menu 12:00-20:00, weather permitting',
  price: '£££',
  cuisine: 'Hyper-local seasonal Scottish',
  website: 'https://www.callandermeadows.co.uk/restaurant',
  organisation: 'Callander Meadows',
  address: '24 Main Street, Callander, FK17 8BB',
  dogFriendly: true,
});

const puddingstone = food({
  id: 'curated-food:callander-puddingstone-place',
  name: 'Puddingstone Place',
  kind: 'cafe',
  coordinates: [-4.2115336, 56.2427694],
  score: 84,
  tagline: 'Best all-round cafe',
  description:
    'A popular independent cafe for changing home-cooked lunches, good-value weekend specials, coffee and baking made with locally sourced produce.',
  opening:
    'Current listings show Tuesday-Sunday 10:00-16:00 and Monday closed; confirm before a special journey',
  price: '££',
  cuisine: 'Home-cooked cafe lunches and baking',
  website: 'https://www.pstone.space/',
  organisation: 'Puddingstone Place and Callander Visitor Information Centre',
  address: '120 Main Street, Callander, FK17 8BG',
  reliability: 'secondary',
});

const deliEcosse = food({
  id: 'curated-food:callander-deli-ecosse',
  name: 'Deli Ecosse',
  kind: 'cafe',
  coordinates: [-4.2140642, 56.2440787],
  score: 82,
  tagline: 'Best deli lunch',
  description:
    'A relaxed cafe and deli for Scottish cheeses, generous breakfasts, home-made soup, filled baked potatoes, panini and notably tempting cakes and scones.',
  opening: 'The operator asks visitors to check its current Facebook hours before travelling',
  price: '££',
  cuisine: 'Scottish deli, breakfast, lunch and home baking',
  website: 'https://deliecosse.co.uk/',
  organisation: 'Deli Ecosse',
  address: '10 Ancaster Square, Callander, FK17 8ED',
});

const pips = food({
  id: 'curated-food:callander-pips-coffee-house',
  name: 'Pips Coffee House',
  kind: 'cafe',
  coordinates: [-4.2145975, 56.2433516],
  score: 80,
  tagline: 'Best family cafe',
  description:
    'A warm family-run cafe with proper breakfasts, freshly made sandwiches and toasties, home baking, children\'s choices and even a small dog menu.',
  opening: 'Monday-Sunday 08:00-16:00',
  price: '££',
  cuisine: 'Breakfast, light lunches, coffee and home baking',
  website: 'https://pipscoffeehouse.co.uk/',
  organisation: 'Pips Coffee House',
  address: '21-23 Ancaster Square, Callander, FK17 8BL',
  dogFriendly: true,
});

const atrium = food({
  id: 'curated-food:callander-atrium-cafe',
  name: 'Atrium Cafe',
  kind: 'cafe',
  coordinates: [-4.2133851, 56.2435177],
  score: 79,
  tagline: 'Bright dog-friendly cafe',
  description:
    'The glass-roofed room above CCW is a bright, notably dog-friendly pause for well-presented breakfast, lunch, home baking and good coffee.',
  opening: 'Monday-Saturday 09:00-16:00; Sunday 10:30-16:00',
  price: '££',
  cuisine: 'Contemporary cafe food and home baking',
  website: 'https://www.ccwclothing.com/atrium-cafe/',
  organisation: 'CCW Clothing and Atrium Cafe',
  address: '79-81 Main Street, Callander, FK17 8DX',
  dogFriendly: true,
});

const waverley = food({
  id: 'curated-food:callander-waverley-hotel',
  name: 'The Waverley Hotel',
  kind: 'pub',
  coordinates: [-4.2134748, 56.2432348],
  score: 76,
  tagline: 'Best flexible evening option',
  description:
    'A practical, dog-friendly all-day choice for breakfast, real ales, pub classics and an evening meal after the cafes have closed.',
  opening: 'Breakfast daily 09:00-11:00; food daily 12:00-21:00',
  price: '££',
  cuisine: 'Scottish pub classics and family meals',
  website: 'https://thewaverleycallander.co.uk/',
  organisation: 'The Waverley Hotel and Callander Visitor Information Centre',
  address: '88-94 Main Street, Callander, FK17 8BD',
  dogFriendly: true,
  reliability: 'secondary',
});

const riversideInn = food({
  id: 'curated-food:callander-riverside-inn',
  name: 'The Riverside Inn',
  kind: 'pub',
  coordinates: [-4.2193399, 56.244579],
  score: 74,
  tagline: 'Riverside pub stop',
  description:
    'A relaxed dog-friendly pub beside the western end of town, useful for hearty food, drinks and sunny beer-garden seating near the river walks.',
  opening:
    'Published daily hours are noon-late with food to 20:00; winter opening may be reduced',
  price: '££',
  cuisine: 'Pub meals and drinks',
  website: 'https://www.visitcallander.uk/restaurants',
  organisation: 'Callander Visitor Information Centre and CAMRA Forth Valley',
  address: '8-10 Leny Road, Callander, FK17 8BA',
  dogFriendly: true,
  reliability: 'secondary',
});

const benLediCoffee = food({
  id: 'curated-food:callander-ben-ledi-coffee-company',
  name: 'Ben Ledi Coffee Company',
  kind: 'cafe',
  coordinates: [-4.2172241, 56.2445648],
  score: 72,
  tagline: 'Coffee and secret garden',
  description:
    'A friendly dog-welcoming coffee shop for Scottish-roasted coffee, smoothies, house baking and light lunches, with a tucked-away garden behind Main Street.',
  opening: 'Published daily hours 08:30-17:00; confirm current closing time',
  price: '£',
  cuisine: 'Speciality coffee, cakes and light lunches',
  website: 'https://incallander.co.uk/benledicoffeeco',
  organisation: 'In Callander and Ben Ledi Coffee Company',
  address: '11 Main Street, Callander, FK17 8DU',
  dogFriendly: true,
  reliability: 'secondary',
});

const parkingPage =
  'https://www.stirling.gov.uk/roads-transport-and-parking/parking-and-permits/parking-in-stirling/';
const stationRoadParking = parking({
  id: 'curated-parking:callander-station-road',
  name: 'Station Road Car Park',
  coordinates: [-4.2184281, 56.2456071],
  capacity: 276,
  paid: true,
  description: 'Large central council car park for Main Street, the visitor centre and town trails.',
  sourceUrl: parkingPage,
  organisation: 'Stirling Council',
});
const riversideMeadowsParking = parking({
  id: 'curated-parking:callander-riverside-meadows',
  name: 'Riverside - The Meadows Car Park',
  coordinates: [-4.2191466, 56.2442168],
  capacity: 193,
  paid: true,
  description: 'Council car park beside the River Teith, Meadows circuit and western Main Street.',
  sourceUrl: parkingPage,
  organisation: 'Stirling Council',
});
const northAncasterParking = parking({
  id: 'curated-parking:callander-north-ancaster-square',
  name: 'North Ancaster Square Car Park',
  coordinates: [-4.2143036, 56.2443932],
  capacity: 15,
  paid: false,
  description: 'Small free council car park in the heart of the town centre.',
  sourceUrl:
    'https://services-eu1.arcgis.com/cECIr59LclpO818r/arcgis/rest/services/Traffic_Management_Car_Park_Locations_Points_Current/FeatureServer/1',
  organisation: 'Stirling Council',
});
const glenartneyParking = parking({
  id: 'curated-parking:callander-glenartney-road',
  name: 'Glenartney Road Car Park',
  coordinates: [-4.2126867, 56.244625],
  capacity: 20,
  paid: false,
  description: 'Small free council car park near the east end of Main Street.',
  sourceUrl:
    'https://services-eu1.arcgis.com/cECIr59LclpO818r/arcgis/rest/services/Traffic_Management_Car_Park_Locations_Points_Current/FeatureServer/1',
  organisation: 'Stirling Council',
});
const bracklinnParking = parking({
  id: 'curated-parking:callander-bracklinn-falls',
  name: 'Bracklinn Falls Car Park',
  coordinates: [-4.2010435, 56.2477561],
  paid: false,
  description: 'Free open surface car park at the signed start of the Bracklinn Falls circuit.',
  sourceUrl: 'https://www.openstreetmap.org/way/502786484',
  organisation: 'Loch Lomond & The Trossachs National Park Authority and OpenStreetMap contributors',
});

const stationRoadToilets = toilets({
  id: 'curated-toilets:callander-station-road-car-park',
  name: 'Station Road Car Park public toilets',
  coordinates: [-4.2182802, 56.2452826],
  opening: 'Open daily 08:00-19:00',
  accessibility: 'yes',
  babyChanging: true,
  sourceUrl:
    'https://www.stirling.gov.uk/community-life-and-leisure/public-toilets/list-of-the-public-toilets-in-stirling/callander-station-square/',
  reliability: 'local_authority',
});
const leisureCentreToilets = toilets({
  id: 'curated-toilets:callander-mclaren-leisure-centre',
  name: 'McLaren Community Leisure Centre toilets, Mollands Road',
  coordinates: [-4.2179, 56.2415],
  opening:
    'During centre hours: Monday 07:30-21:00, Tuesday 07:30-22:00, Wednesday-Friday 07:30-21:00, weekends 08:30-17:00',
  accessibility: 'yes',
  sourceUrl: 'https://www.visitcallander.uk/local-information',
});
const libraryToilets = toilets({
  id: 'curated-toilets:callander-library',
  name: 'Callander Library toilets, South Church Street',
  coordinates: [-4.2161, 56.2431],
  opening:
    'During library hours: Monday and Friday 10:00-13:00 and 14:00-17:00; Tuesday and Thursday 10:00-13:00 and 14:00-19:00; Saturday 10:00-12:00; closed Wednesday and Sunday',
  accessibility: 'ramped access',
  sourceUrl: 'https://www.visitcallander.uk/local-information',
});

const bracklinnPicnic = upsertFeature(
  curatedPoint({
    id: 'osm-community:node-8373012594',
    name: 'Bracklinn Falls circuit picnic bench',
    featureType: 'picnic_site',
    coordinates: [-4.1940273, 56.2604988],
    description:
      'A single picnic bench in the riverside clearing beyond Bracklinn Bridge on the signed circuit.',
    source: currentSource(
      'Bracklinn Falls picnic information',
      'Loch Lomond & The Trossachs National Park Authority and OpenStreetMap contributors',
      'visitor-audit:picnic:osm-community:node-8373012594',
      'https://www.lochlomond-trossachs.org/discover-the-park/food-and-drink/picnic-in-the-park/spectacular-waterfall/',
      'Current-place curation: tourism=picnic_site; name=Bracklinn Falls circuit picnic bench; access=public; price_display=Free; opening_hours:description=Open-air location, daylight use recommended; description=A single picnic bench in the riverside clearing beyond Bracklinn Bridge on the signed circuit; website=https://www.lochlomond-trossachs.org/discover-the-park/food-and-drink/picnic-in-the-park/spectacular-waterfall/.',
      'official_non_statutory',
      `${editorialMetadataLicence} Geometry derived from ${osmLicence}`,
    ),
    tags: ['current-context', 'service-context-picnic'],
  }),
);

curationLibrary.projects[pkg.project.id] = {
  eat: [
    graceRestaurant.id,
    puddingstone.id,
    deliEcosse.id,
    pips.id,
    atrium.id,
    waverley.id,
    riversideInn.id,
    benLediCoffee.id,
  ],
  trails: [
    bracklinnCircuit.id,
    callanderCrags.id,
    heritageTrail.id,
    meadowsTrail.id,
    threeBridges.id,
    lowerWoods.id,
    glacierTrail.id,
  ],
  picnic: [bracklinnPicnic.id],
  parking: [
    stationRoadParking.id,
    riversideMeadowsParking.id,
    northAncasterParking.id,
    glenartneyParking.id,
    bracklinnParking.id,
  ],
  toilets: [stationRoadToilets.id, leisureCentreToilets.id, libraryToilets.id],
};

const obsoleteRiverside = pkg.features.find(
  (feature) => feature.id === 'curated-parking:callander-riverside',
);
if (obsoleteRiverside) {
  obsoleteRiverside.tags = [
    ...new Set([...obsoleteRiverside.tags, auditTag, 'visitor-audit-excluded', 'map-hidden']),
  ];
  obsoleteRiverside.reviewed = true;
  obsoleteRiverside.updatedAt = reviewedAt;
  obsoleteRiverside.reviewNotes =
    'Excluded on 2026-08-06 because the current Stirling Council car-park dataset has one Riverside - The Meadows record rather than two separate public visitor car parks.';
}

const publishedFeatureIds = [
  ...(pkg.project.visitorHighlights ?? []).map((highlight) => highlight.featureId),
  ...Object.values(curationLibrary.projects[pkg.project.id]).flat(),
];
for (const featureId of new Set(publishedFeatureIds)) {
  const feature = pkg.features.find((candidate) => candidate.id === featureId);
  if (!feature || feature.geometry?.type !== 'Point') {
    throw new Error(`Callander public visitor feature is missing a point: ${featureId}`);
  }
  if (!booleanPointInPolygon(point(feature.geometry.coordinates), visitorBoundary)) {
    throw new Error(`Callander public visitor feature falls outside visitor boundary: ${featureId}`);
  }
}

const customerOnlyParking = pkg.features.filter((feature) =>
  feature.sourceRecords.some((source) => /access=customers/i.test(source.notes ?? '')),
);
for (const feature of customerOnlyParking) {
  if (curationLibrary.projects[pkg.project.id].parking.includes(feature.id)) {
    throw new Error(`Customer-only parking was published: ${feature.id}`);
  }
}

const audit = {
  projectId: pkg.project.id,
  reviewedAt,
  townRating: {
    previous: 3,
    rating: 3,
    rationale:
      'Three stars are retained. Callander has a nationally credible waterfall, a high-quality crag walk, six further signed or interpreted routes, a seasonal indoor museum and a strong independent food cluster. It can sustain a full visitor day or walking weekend without relying on attractions outside the active visitor boundary.',
  },
  boundary: {
    original: 'OpenStreetMap Callander place polygon way 369986773, preserved unchanged.',
    active:
      'A proper Turf union of the original OSM polygon and narrow visitor corridors to Callander Meadows, Lower Woods, Callander Crags and the Bracklinn Falls circuit.',
    correction:
      'The prior extension rings were encoded as additional Polygon rings and therefore behaved as holes. The audited boundary uses a true geometric union and validates every public marker.',
    rule:
      'Attractions, food and practical facilities must be inside the active visitor boundary. Trail cards use an in-boundary start marker; the walked route may continue beyond it.',
  },
  published: {
    attractions: (pkg.project.visitorHighlights ?? []).map((highlight) => ({
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
      name: 'Duplicate Riverside Car Park record',
      reason:
        'The current council dataset publishes one Riverside - The Meadows Car Park. The older second Riverside record was removed from public curation.',
    },
    {
      name: 'Tesco and other customer-only, private or unnamed parking',
      reason:
        'Only named public council or National Park visitor car parks are published.',
    },
    {
      name: 'Mhor Bread tearoom',
      reason:
        'The visitor directory states that the tearoom is closed until further notice. The bakery remains useful but was not ranked as a sit-in Eat card.',
    },
    {
      name: 'Kilmahog picnic table and attractions farther into the Trossachs',
      reason:
        'Outside Callander\'s active visitor boundary. Only the accurately mapped bench on the Bracklinn circuit is published as a Callander picnic stop.',
    },
  ],
  practicalCorrections: {
    parking:
      'Current Stirling Council tariff is £2.60 for two hours, £3.10 for four hours and £4.10 all day. Glenartney Road and North Ancaster Square are free. Bracklinn Falls is mapped as free.',
    toilets:
      'Station Road is the council public toilet, open daily 08:00-19:00 with disabled access and baby changing. Library and leisure-centre facilities are explicitly labelled as available only during building hours.',
  },
  sourceUrls: pkg.project.townGuide.sourceUrls,
};

await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`);
await writeFile(curationPath, `${JSON.stringify(curationLibrary, null, 2)}\n`);
await writeFile(auditPath, `${JSON.stringify(audit, null, 2)}\n`);

console.log(
  `Updated Callander visitor audit: ${pkg.project.visitorHighlights?.length ?? 0} attractions, ${curationLibrary.projects[pkg.project.id].eat.length} food stops, ${curationLibrary.projects[pkg.project.id].trails.length} trails, ${curationLibrary.projects[pkg.project.id].parking.length} car parks, ${curationLibrary.projects[pkg.project.id].toilets.length} toilets and ${curationLibrary.projects[pkg.project.id].picnic.length} picnic stop. Rating: 3 stars.`,
);
