import { readFile, writeFile } from 'node:fs/promises';
import {
  booleanPointInPolygon,
  buffer,
  featureCollection,
  lineString,
  point,
  polygon,
  union,
} from '@turf/turf';
import type { Feature, MultiPolygon, Polygon } from 'geojson';
import type { HeritageFeature, ProjectPackage, SourceRecord } from '../src/domain/models';

const projectPath = 'data/projects/strathyre.json';
const curationPath = 'data/visitor-planner-curation.json';
const auditPath = 'data/review/strathyre-visitor-audit-2026-08-06.json';
const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
const curationLibrary = JSON.parse(await readFile(curationPath, 'utf8')) as {
  projects: Record<string, Record<string, string[]>>;
};

const reviewedAt = '2026-08-06T00:00:00Z';
const reviewedDate = '2026-08-06';
const auditTag = 'strathyre-visitor-audit';
const editorialLicence =
  'Original editorial summary and factual visitor metadata; linked source content is not redistributed.';
const osmLicence = 'Open Database Licence (ODbL) v1.0; © OpenStreetMap contributors.';

function currentSource(
  sourceName: string,
  sourceOrganisation: string,
  sourceRecordId: string,
  sourceUrl: string,
  notes: string,
  reliability: SourceRecord['reliability'] = 'official_non_statutory',
  licence = editorialLicence,
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

function addTags(feature: HeritageFeature, ...tags: string[]) {
  feature.tags = [...new Set([...feature.tags, ...tags])];
}

function upsertFeature(feature: HeritageFeature): HeritageFeature {
  const index = pkg.features.findIndex((candidate) => candidate.id === feature.id);
  if (index === -1) pkg.features.push(feature);
  else pkg.features[index] = feature;
  return feature;
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
}): HeritageFeature {
  return {
    id: options.id,
    projectId: pkg.project.id,
    name: options.name,
    alternativeNames: [],
    countryCode: pkg.project.countryCode,
    region: pkg.project.region,
    locality: pkg.project.locality,
    address: options.address,
    featureType: options.featureType,
    significance: 'local',
    geometry: { type: 'Point', coordinates: options.coordinates },
    locationType: 'representative_point',
    locationConfidence: 'high',
    dateBasis: 'unknown',
    dateConfidence: 'unknown',
    survival: 'unknown',
    shortDescription: options.description,
    sourceRecords: [options.source],
    tags: [...new Set([...options.tags, auditTag])],
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
  sourceName: string;
  organisation: string;
  website: string;
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
  kind: 'walking_route' | 'cycling_route';
  trailType: string;
  description: string;
  distance: string;
  time: string;
  terrain: string;
  website: string;
  organisation: string;
}): HeritageFeature {
  return upsertFeature(
    curatedPoint({
      id: options.id,
      name: options.name,
      featureType: options.kind,
      coordinates: options.coordinates,
      description: options.description,
      source: currentSource(
        `${options.name} route information`,
        options.organisation,
        `visitor-audit:trail:${options.id}`,
        options.website,
        `Current-place curation: route=${options.kind === 'cycling_route' ? 'bicycle' : 'foot'}; name=${options.name}; trail_type=${options.trailType}; visit_score=${options.score}; distance=${options.distance}; time_to_spend=${options.time}; accessibility=${options.terrain}; entrance_fee=Free; description=${options.description}; website=${options.website}.`,
      ),
      tags: ['current-context', 'service-context-walk', 'visitor-context-trail'],
    }),
  );
}

function food(options: {
  id: string;
  name: string;
  coordinates: [number, number];
  score: number;
  tagline: string;
  description: string;
  opening: string;
  price: string;
  cuisine: string;
  website: string;
  address: string;
  dogFriendly?: boolean;
}): HeritageFeature {
  return upsertFeature(
    curatedPoint({
      id: options.id,
      name: options.name,
      featureType: 'cafe',
      coordinates: options.coordinates,
      description: options.description,
      address: options.address,
      source: currentSource(
        `${options.name} visitor information`,
        options.name,
        `visitor-audit:food:${options.id}`,
        options.website,
        `Current-place curation: amenity=cafe; name=${options.name}; cuisine=${options.cuisine}; visit_score=${options.score}; price_band=${options.price}; opening_hours:description=${options.opening}; dog_friendly=${options.dogFriendly ? 'yes' : 'unknown'}; description=${options.tagline}: ${options.description}; website=${options.website}.`,
        'official_non_statutory',
        `${editorialLicence} Geometry derived from ${osmLicence}`,
      ),
      tags: ['current-context', 'service-context-food', 'visitor-context-food'],
    }),
  );
}

function practical(options: {
  id: string;
  name: string;
  featureType: 'parking' | 'toilets' | 'picnic_site';
  coordinates: [number, number];
  description: string;
  metadata: string;
  sourceName: string;
  organisation: string;
  website: string;
  reliability?: SourceRecord['reliability'];
}): HeritageFeature {
  const tag =
    options.featureType === 'picnic_site'
      ? 'service-context-picnic'
      : `service-context-${options.featureType}`;
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
        `visitor-audit:${options.featureType}:${options.id}`,
        options.website,
        `Current-place curation: ${options.metadata}; description=${options.description}; website=${options.website}.`,
        options.reliability,
        `${editorialLicence} Geometry derived from ${osmLicence}`,
      ),
      tags: ['current-context', tag],
    }),
  );
}

type OsmWay = {
  type: 'way';
  id: number;
  geometry: Array<{ lon: number; lat: number }>;
};

async function osmResidentialPolygons(wayIds: number[]): Promise<Feature<Polygon>[]> {
  const query = `[out:json][timeout:30];(${wayIds.map((id) => `way(${id});`).join('')});out geom;`;
  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ];
  let lastError: unknown;
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'User-Agent': 'Townscape-Guides-Strathyre-Audit/1.0',
        },
        body: new URLSearchParams({ data: query }),
      });
      if (!response.ok) throw new Error(`${endpoint} returned ${response.status}`);
      const data = (await response.json()) as { elements: OsmWay[] };
      const byId = new Map(data.elements.map((element) => [element.id, element]));
      return wayIds.map((wayId) => {
        const way = byId.get(wayId);
        if (!way?.geometry?.length) throw new Error(`OSM residential way ${wayId} was not found`);
        const coordinates = way.geometry.map(({ lon, lat }) => [lon, lat] as [number, number]);
        const first = coordinates[0];
        const last = coordinates.at(-1);
        if (first[0] !== last?.[0] || first[1] !== last?.[1]) coordinates.push(first);
        return polygon([coordinates], {
          sourceDataset: 'OpenStreetMap residential landuse',
          localityName: 'Strathyre',
          osmType: 'way',
          osmId: wayId,
          sourceUrl: `https://www.openstreetmap.org/way/${wayId}`,
          licence: osmLicence,
          reviewedAt: reviewedDate,
        });
      });
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

const residentialWayIds = [372012315, 372012317, 372012318, 372012319, 372012320];
const residentialPolygons = await osmResidentialPolygons(residentialWayIds);
const residentialBoundary = union(featureCollection(residentialPolygons));
if (!residentialBoundary) throw new Error('Could not construct the Strathyre residential boundary');
const residentialEnvelope = buffer(residentialBoundary, 0.09, { units: 'kilometers' });
if (!residentialEnvelope) throw new Error('Could not buffer the Strathyre residential boundary');
const visitorSpine = buffer(
  lineString([
    [-4.3306, 56.3217],
    [-4.3292, 56.3242],
    [-4.326, 56.3281],
  ]),
  0.12,
  { units: 'kilometers' },
);
if (!visitorSpine) throw new Error('Could not construct the Strathyre visitor spine');
const visitorBoundary = union(featureCollection([residentialEnvelope, visitorSpine]));
if (!visitorBoundary) throw new Error('Could not construct the Strathyre visitor boundary');
visitorBoundary.properties = {
  sourceDataset: 'OSM-derived Strathyre visitor-town boundary',
  localityName: 'Strathyre',
  residentialWayIds,
  residentialBufferMetres: 90,
  visitorSpineBufferMetres: 120,
  boundaryMethod:
    'Union of five OpenStreetMap residential landuse polygons with a narrow corridor linking the Broch Field, village centre, forest car park and Village Hall.',
  sourceUrl: 'https://www.openstreetmap.org/node/232934098',
  licence: osmLicence,
  reviewedAt: reviewedDate,
};

pkg.project.centre = [-4.3289, 56.3242];
pkg.project.boundary = visitorBoundary as Feature<Polygon | MultiPolygon>;
pkg.project.boundarySource =
  'OpenStreetMap residential landuse with transparent 90-metre envelopes and a narrow visitor corridor linking directly adjoining public facilities. This is a curated visitor-town boundary, not an administrative boundary.';
pkg.project.boundaryConfidence = 'medium';
pkg.project.townStudyArea = {
  localityName: 'Strathyre',
  localityCode: residentialWayIds.join(','),
  sourceName: 'OpenStreetMap residential landuse-derived visitor boundary',
  sourceUrl: 'https://www.openstreetmap.org/node/232934098',
  sourceVersion: 'OpenStreetMap data accessed 2026-08-06',
  bufferMetres: 90,
  localityBoundary: residentialBoundary as Feature<Polygon | MultiPolygon>,
  bufferedBoundary: visitorBoundary as Feature<Polygon | MultiPolygon>,
  visitorBoundary: visitorBoundary as Feature<Polygon | MultiPolygon>,
  notes:
    'NRS 2022 does not publish Strathyre as a census locality. The active study area therefore follows five mapped residential landuse polygons and a narrow corridor between the village visitor facilities. The earlier supplied rectangle is retained only in the audit record and is no longer used for inclusion decisions.',
};
pkg.project.researchNotes =
  'Full visitor audit completed 2026-08-06. Town-planner markers must fall inside the active OSM-derived visitor boundary. Walking and cycling routes may continue beyond it, but their published start marker must be inside Strathyre. Loch Lubnaig, Balquhidder, Kingshouse and accommodation-only facilities remain outside the town planner.';

pkg.project.touristAppeal = {
  rating: 1,
  label: 'Local detour',
  summary:
    'Strathyre earns one star as a rewarding outdoor detour: excellent forest and hill routes begin in the village, NCN 7 and the Rob Roy Way pass through, BLiSS sculptures add character and the Broch Café is a notably strong stop. Its limited indoor interest and weather-dependent visitor depth keep it below a two-star planned destination.',
};
pkg.project.visualIdentity = {
  theme: 'river-forest-and-highland-routes',
  badgeImage: '/town-guides/strathyre-river-forest-watercolour-guide.png',
  badgeAlt:
    'Light ink-and-watercolour illustration of Strathyre beside the River Balvaig with wooded Highland slopes rising behind the village',
  heroImage: '/town-guides/strathyre-river-forest-watercolour-guide.png',
  heroAlt:
    'Light ink-and-watercolour illustration of Strathyre beside the River Balvaig with wooded Highland slopes rising behind the village',
  primaryColour: '#173F3B',
  accentColour: '#A7742A',
  backgroundColour: '#EEF5E8',
  heroObjectPosition: '50% 52%',
  motifs: ['Forest trails', 'River Balvaig', 'BLiSS art', 'Railway path'],
};
pkg.project.townGuide = {
  headline: 'Forest trails, public art and a Highland village tucked between the hills',
  intro:
    'Strathyre is a slender Highland village where the River Balvaig, the old railway line and dense forest are never far apart. The best visit is active: follow Tighanes Burn through Scots pine, climb An Sidhean for broad Trossachs views or ride the Rob Roy Loop, then spot the village’s BLiSS sculptures and refuel at the Broch Café.',
  bestFor: ['Forest walks', 'Easy cycling', 'Public art', 'Quiet Highland scenery'],
  perfectFor: [
    'A two-hour forest walk and café stop',
    'An NCN 7 or Rob Roy Loop ride',
    'A quiet outdoor detour between Callander and Killin',
  ],
  suggestedFirstVisit: {
    title: 'Tighanes Burn, BLiSS art and the Broch Café',
    summary:
      'Begin at the village forest car park for the Tighanes Burn Trail, return through the village past the BLiSS sculptures and finish with coffee or lunch at the Broch Café. Choose An Sidhean instead only when you have more time, suitable hill conditions and navigation experience.',
  },
  dontMiss: ['Tighanes Burn Trail', 'BLiSS Trail Strathyre sculptures', 'The Broch Café'],
  suggestedTime: 'Two to four hours; allow longer for An Sidhean or a cycle loop',
  visitorMood:
    'A small, unhurried outdoor base whose appeal comes from stepping straight from the village into forest, river and hill scenery.',
  currentAdvisory: {
    title: 'Check forest notices',
    summary:
      'Tighanes Burn remains open during nearby forestry work, but visitors should obey temporary signs and instructions on site.',
    sourceUrl: 'https://forestryandland.gov.scot/visit/destinations/strathyre-village/trails',
    linkLabel: 'Check current trail information',
  },
  sourceUrls: [
    'https://forestryandland.gov.scot/visit/destinations/strathyre-village',
    'https://forestryandland.gov.scot/visit/destinations/strathyre-village/trails',
    'https://forestryandland.gov.scot/visit/destinations/strathyre-village/activities',
    'https://www.lochlomond-trossachs.org/things-to-do/cycling/cycling-routes/rob-roy-loop/',
    'https://www.lochlomond-trossachs.org/things-to-do/walking/long-distance-routes/rob-roy-way/',
    'https://www.seelochlomond.co.uk/discover/bliss-trail',
    'https://portal.historicenvironment.scot/designation/LB50348',
    'https://www.trove.scot/place/131142',
    'https://brochcafe.com/',
    'https://www.blscommunitytrust.org.uk/what-we-do/broch-field',
    'https://www.stirling.gov.uk/community-life-and-leisure/community-centres-and-halls/our-centres-and-halls/community-run-centres-and-halls/strathyre-village-hall/',
  ],
  lastReviewedAt: reviewedDate,
};

const dugald = upsertFeature({
  id: 'hes-listed-building:LB50348',
  projectId: pkg.project.id,
  name: 'Dugald Buchanan Monument',
  alternativeNames: [],
  countryCode: pkg.project.countryCode,
  region: pkg.project.region,
  locality: pkg.project.locality,
  featureType: 'monument',
  designationType: 'Listed Building',
  designationCategory: 'C',
  statutoryStatus: 'Designated',
  significance: 'local',
  geometry: { type: 'Point', coordinates: [-4.3288083, 56.3241226] },
  locationType: 'site_centroid',
  locationConfidence: 'high',
  documentedDateText: '1883',
  earliestPossibleYear: 1883,
  latestPossibleYear: 1883,
  dateBasis: 'documented_construction',
  dateConfidence: 'high',
  survival: 'substantially_intact',
  shortDescription:
    'A prominent 1883 Gothic monument to the influential Gaelic poet Dugald Buchanan, standing beside the main road in the village centre.',
  sourceRecords: [
    currentSource(
      'Dugald Buchanan Monument, listing LB50348',
      'Historic Environment Scotland',
      'LB50348',
      'https://portal.historicenvironment.scot/designation/LB50348',
      'The statutory listing records the Gothic monument as dating from 1883.',
      'official_statutory',
      'Open Government Licence v3.0.',
    ),
    currentSource(
      'Dugald Buchanan Monument visitor curation',
      'Townscape Guides',
      'visitor-audit:attraction:dugald-buchanan-monument',
      'https://portal.historicenvironment.scot/designation/LB50348',
      'Current-place curation: tourism=attraction; name=Dugald Buchanan Monument; visitor_place_type=Gaelic literary monument; visit_score=44; opening_hours:description=Open-air roadside monument, visible at any time; daylight gives the best view; entrance_fee=Free; time_to_spend=10-15 minutes; description=Pause at an ornate village landmark commemorating one of the most important Gaelic religious poets of the eighteenth century; website=https://portal.historicenvironment.scot/designation/LB50348.',
      'official_statutory',
    ),
  ],
  tags: ['hes-listed-building', 'designation-category-c', 'service-context-visitor', auditTag],
  createdAt: reviewedAt,
  updatedAt: reviewedAt,
  reviewed: true,
  reviewNotes: 'HES designation and visitor location checked on 2026-08-06.',
  evidenceScope: 'parish_evidence',
  licence: 'Open Government Licence v3.0.',
});

const bliss = attraction({
  id: 'curated-attraction:strathyre-bliss-trail-strathyre',
  name: 'BLiSS Trail Strathyre sculptures',
  featureType: 'public_art',
  coordinates: [-4.3289431, 56.3243345],
  score: 53,
  tagline: 'Outdoor art',
  description:
    'Look for a playful cluster of contemporary sculptures around the village, including Drover’s Bho, the Soaring Eagle and Thistle the Heilan’ Coo at the Broch Café.',
  opening: 'Open-air installations, best explored in daylight',
  admission: 'Free',
  time: '20-40 minutes across the village',
  sourceName: 'BLiSS Trail',
  organisation: 'Loch Earn Tourism Information',
  website: 'https://www.seelochlomond.co.uk/discover/bliss-trail',
});

const station = pkg.features.find((feature) => feature.id === 'strathyre-station');
if (!station) throw new Error('Strathyre station record is missing');
station.name = 'Strathyre station heritage and heron fountain';
station.geometry = { type: 'Point', coordinates: [-4.32984, 56.32389] };
station.locationConfidence = 'high';
station.documentedDateText = 'Opened 1 June 1870';
station.earliestPossibleYear = 1870;
station.latestPossibleYear = 1870;
station.dateBasis = 'documented_construction';
station.dateConfidence = 'high';
station.shortDescription =
  'The old Callander and Oban Railway station site is now part of the village path network, where a heron-shaped fountain recalls the former station setting.';
station.sourceRecords = [
  currentSource(
    'Strathyre Station',
    'Historic Environment Scotland / Trove',
    '131142',
    'https://www.trove.scot/place/131142',
    'The station opened on 1 June 1870 and closed to passengers on 28 September 1965; the former site retains a heron-shaped fountain.',
    'official_non_statutory',
    'Open Government Licence v3.0.',
  ),
  currentSource(
    'Strathyre station visitor curation',
    'Townscape Guides',
    'visitor-audit:attraction:strathyre-station',
    'https://www.trove.scot/place/131142',
    'Current-place curation: tourism=attraction; name=Strathyre station heritage and heron fountain; visitor_place_type=Railway heritage; visit_score=42; opening_hours:description=Open-air path-side heritage, daylight visit recommended; entrance_fee=Free; time_to_spend=10-20 minutes; description=See how the former station and railway alignment survive within today’s village path and cycle network; website=https://www.trove.scot/place/131142.',
  ),
];
addTags(station, 'service-context-visitor', auditTag);
station.updatedAt = reviewedAt;
station.reviewed = true;

const anSidhean = trail({
  id: 'curated-attraction:strathyre-an-sidhean-viewpoint',
  name: 'An Sidhean viewpoint route',
  coordinates: [-4.3292181, 56.3241691],
  score: 84,
  kind: 'walking_route',
  trailType: 'Hill route',
  description:
    'A sustained climb above the village to a 546-metre summit with wide views over Loch Lubnaig, Ben Ledi, Ben Vorlich, Ben More and Stob Binnein.',
  distance: '6.75 km / 4.25 miles return',
  time: 'Allow 2.5-3 hours',
  terrain:
    'Signposted through the lower forest but not waymarked on the open hill; carry a map and compass and choose suitable hill weather',
  website: 'https://forestryandland.gov.scot/visit/destinations/strathyre-village/activities',
  organisation: 'Forestry and Land Scotland',
});

const robRoyLoop = trail({
  id: 'curated-trail:strathyre-rob-roy-loop',
  name: 'Rob Roy Loop',
  coordinates: [-4.3304459, 56.3222392],
  score: 82,
  kind: 'cycling_route',
  trailType: 'Easy cycle loop',
  description:
    'An easy signed circuit through Strathyre Forest and Balquhidder, linking mountain, river and glen scenery with Rob Roy country.',
  distance: '12.5 km / 7.8 miles',
  time: 'Allow about 1.5-2.5 hours, depending on stops',
  terrain:
    'Suitable for all types of bike; follows NCN 7 and quiet roads, with care needed on the busier Balquhidder road section',
  website: 'https://www.lochlomond-trossachs.org/things-to-do/cycling/cycling-routes/rob-roy-loop/',
  organisation: 'Loch Lomond and The Trossachs National Park Authority',
});

const tighanes = trail({
  id: 'curated-attraction:strathyre-tighanes-burn-trail',
  name: 'Tighanes Burn Trail',
  coordinates: [-4.3292181, 56.3241691],
  score: 79,
  kind: 'walking_route',
  trailType: 'Waymarked forest trail',
  description:
    'Follow the burn through Scots pine past small waterfalls, with wildlife-rich woodland and views towards Ben Vane and the Braes of Balquhidder.',
  distance: '3 km / 1.75 miles',
  time: 'Allow 1.5 hours',
  terrain:
    'Strenuous: a long steep 400-metre slope, narrow earth and grass paths, muddy sections, one bridge and a road crossing',
  website: 'https://forestryandland.gov.scot/visit/destinations/strathyre-village/trails',
  organisation: 'Forestry and Land Scotland',
});

const ncn7 = trail({
  id: 'curated-attraction:strathyre-national-cycle-route-7',
  name: 'NCN 7 Strathyre railway path',
  coordinates: [-4.3304018, 56.3220497],
  score: 76,
  kind: 'cycling_route',
  trailType: 'Traffic-free railway path',
  description:
    'Walk or cycle a flexible there-and-back section of the former Callander and Oban Railway through the glen, with easy gradients and onward links north or south.',
  distance: 'Flexible there-and-back route',
  time: 'Allow 1-3 hours depending on the chosen distance',
  terrain: 'Mostly traffic-free shared path on the former railway alignment; give way considerately',
  website: 'https://forestryandland.gov.scot/visit/destinations/strathyre-village/activities',
  organisation: 'Forestry and Land Scotland',
});

const brochCafe = food({
  id: 'curated-eat:strathyre-broch-cafe',
  name: 'The Broch Café',
  coordinates: [-4.3289348, 56.3216644],
  score: 84,
  tagline: 'Village favourite',
  description:
    'A welcoming independent café beside Broch Field, known for coffee, cakes and freshly prepared breakfasts and lunches, with vegetarian, vegan and gluten-free choices. Dogs are welcome.',
  opening: 'Monday, Tuesday and Thursday-Sunday 10:00-16:00; Wednesday closed',
  price: '££',
  cuisine: 'cafe breakfast lunch cakes',
  website: 'https://brochcafe.com/',
  address: 'Main Street, Strathyre, FK18 8NA',
  dogFriendly: true,
});

const forestParking = practical({
  id: 'curated-parking:strathyre-strathyre-fls-car-park',
  name: 'Strathyre Village Forest car park',
  featureType: 'parking',
  coordinates: [-4.3292181, 56.3241691],
  description:
    'Free public surface car park on the west side of the A84, best placed for Tighanes Burn, An Sidhean and the village forest.',
  metadata:
    'amenity=parking; name=Strathyre Village Forest car park; parking=surface; access=public; price_display=Free; payment_required=no; opening_hours:description=Open daily; observe current forestry signs and do not stay overnight',
  sourceName: 'Strathyre Village visitor information',
  organisation: 'Forestry and Land Scotland',
  website: 'https://forestryandland.gov.scot/visit/destinations/strathyre-village/visitor-information',
});

const brochParking = practical({
  id: 'curated-parking:strathyre-broch-field-community-car-park',
  name: 'Broch Field community car park - donation requested',
  featureType: 'parking',
  coordinates: [-4.3304459, 56.3222392],
  description:
    'Community-owned public parking around Broch Field beside NCN 7 and the Broch Café; donations support upkeep.',
  metadata:
    'amenity=parking; name=Broch Field community car park; parking=surface; access=public; price_display=Donation requested; payment_required=donation; opening_hours:description=Main gate open daily 08:00-20:00, with a small number of 24-hour spaces near the entrance',
  sourceName: 'Broch Community Field and Car Park',
  organisation: 'Balquhidder, Lochearnhead and Strathyre Community Trust',
  website: 'https://www.blscommunitytrust.org.uk/what-we-do/broch-field',
});

const villageToilets = practical({
  id: 'curated-toilets:strathyre-village-hall-main-street',
  name: 'Strathyre Village Hall public toilets, Main Street',
  featureType: 'toilets',
  coordinates: [-4.3260245, 56.3280187],
  description:
    'Public toilets inside Strathyre Village Hall on Main Street; the council listing states that there is no disabled toilet.',
  metadata:
    'amenity=toilets; name=Strathyre Village Hall public toilets, Main Street; access=public; price_display=Free; opening_hours:description=Open daily 08:00-17:00 for public toilet use; wheelchair=no; changing_table=unknown',
  sourceName: 'Strathyre Village Hall',
  organisation: 'Stirling Council',
  website:
    'https://www.stirling.gov.uk/community-life-and-leisure/community-centres-and-halls/our-centres-and-halls/community-run-centres-and-halls/strathyre-village-hall/',
  reliability: 'local_authority',
});

const forestPicnic = practical({
  id: 'curated-picnic:strathyre-village-forest-car-park',
  name: 'Strathyre Village Forest picnic tables, beside the car park',
  featureType: 'picnic_site',
  coordinates: [-4.3294876, 56.3242854],
  description:
    'Public picnic tables at the village forest entrance, convenient before or after the waymarked trails.',
  metadata:
    'tourism=picnic_site; name=Strathyre Village Forest picnic tables, beside the car park; access=public; price_display=Free; opening_hours:description=Open-air picnic tables, daylight use recommended',
  sourceName: 'Strathyre Village visitor information',
  organisation: 'Forestry and Land Scotland',
  website: 'https://forestryandland.gov.scot/visit/destinations/strathyre-village',
});

const brochPicnic = practical({
  id: 'curated-picnic:strathyre-broch-field',
  name: 'Broch Field picnic benches, beside NCN 7',
  featureType: 'picnic_site',
  coordinates: [-4.3304618, 56.3219596],
  description:
    'Community picnic benches on Strathyre’s village green beside NCN 7 and the Broch Café.',
  metadata:
    'tourism=picnic_site; name=Broch Field picnic benches, beside NCN 7; access=public; price_display=Free; opening_hours:description=Field gate open daily 08:00-20:00',
  sourceName: 'Broch Community Field and Car Park',
  organisation: 'Balquhidder, Lochearnhead and Strathyre Community Trust',
  website: 'https://www.blscommunitytrust.org.uk/what-we-do/broch-field',
});

pkg.project.visitorHighlights = [
  {
    rank: 1,
    featureId: bliss.id,
    name: bliss.name,
    reason:
      'A playful, village-scale strand of the wider BLiSS Trail, with outdoor sculpture adding character to the railway path, river crossing and café stop.',
    tagline: 'Outdoor art',
    visitorScore: 53,
    openingTimes: 'Open-air installations, best explored in daylight',
    admission: 'Free',
    freeAdmission: true,
    organisationPills: [],
    sourceName: 'BLiSS Trail',
    sourceUrl: 'https://www.seelochlomond.co.uk/discover/bliss-trail',
    verifiedInBoundaryAt: reviewedDate,
  },
  {
    rank: 2,
    featureId: dugald.id,
    name: dugald.name,
    reason:
      'An ornate 1883 Gothic landmark that opens a concise window onto Strathyre’s Gaelic literary heritage.',
    tagline: 'Gaelic heritage',
    visitorScore: 44,
    openingTimes: 'Open-air roadside monument, best viewed in daylight',
    admission: 'Free',
    freeAdmission: true,
    organisationPills: ['HES'],
    sourceName: 'Historic Environment Scotland',
    sourceUrl: 'https://portal.historicenvironment.scot/designation/LB50348',
    verifiedInBoundaryAt: reviewedDate,
  },
  {
    rank: 3,
    featureId: station.id,
    name: station.name,
    reason:
      'A brief railway-history stop where the former station, old line and heron fountain connect directly with today’s walking and cycling route.',
    tagline: 'Railway heritage',
    visitorScore: 42,
    openingTimes: 'Open-air path-side heritage, daylight visit recommended',
    admission: 'Free',
    freeAdmission: true,
    organisationPills: [],
    sourceName: 'Historic Environment Scotland / Trove',
    sourceUrl: 'https://www.trove.scot/place/131142',
    verifiedInBoundaryAt: reviewedDate,
  },
];

curationLibrary.projects[pkg.project.id] = {
  eat: [brochCafe.id],
  trails: [anSidhean.id, robRoyLoop.id, tighanes.id, ncn7.id],
  picnic: [forestPicnic.id, brochPicnic.id],
  parking: [forestParking.id, brochParking.id],
  toilets: [villageToilets.id],
};

for (const id of [
  'curated-attraction:strathyre-strathyre-village-forest',
  'curated-attraction:strathyre-rob-roy-way-section',
  'curated-attraction:strathyre-balvaig-river-bridge',
  'curated-parking:strathyre-strathyre-village-hall',
]) {
  const feature = pkg.features.find((candidate) => candidate.id === id);
  if (!feature) continue;
  addTags(feature, 'visitor-audit-excluded', 'map-hidden', auditTag);
  feature.reviewed = true;
  feature.updatedAt = reviewedAt;
  feature.reviewNotes =
    id.endsWith('village-hall')
      ? 'Excluded from general visitor parking: Stirling Council describes only three or four limited hall spaces. The public hall toilets remain curated.'
      : 'Removed from the public attraction list because this is a route, generic landscape point or duplicated context rather than a strong standalone sight.';
}

for (const id of ['drovers-bho', 'thistle-coo']) {
  const feature = pkg.features.find((candidate) => candidate.id === id);
  if (!feature) continue;
  if (id === 'drovers-bho') feature.geometry = { type: 'Point', coordinates: [-4.3289431, 56.3243345] };
  if (id === 'thistle-coo') feature.geometry = { type: 'Point', coordinates: [-4.3289348, 56.3216644] };
  addTags(feature, 'map-hidden', auditTag);
  feature.locationConfidence = 'high';
  feature.updatedAt = reviewedAt;
  feature.reviewed = true;
  feature.reviewNotes =
    'Location corrected during the 2026 visitor audit; hidden as an individual public marker because the curated BLiSS Trail attraction represents the sculpture cluster without duplicate pins.';
}

const publicFeatureIds = new Set([
  ...pkg.project.visitorHighlights.map((highlight) => highlight.featureId),
  ...Object.values(curationLibrary.projects[pkg.project.id]).flat(),
]);
for (const featureId of publicFeatureIds) {
  const feature = pkg.features.find((candidate) => candidate.id === featureId);
  if (!feature || feature.geometry?.type !== 'Point') {
    throw new Error(`Strathyre public visitor feature is missing a point: ${featureId}`);
  }
  if (!booleanPointInPolygon(point(feature.geometry.coordinates), visitorBoundary)) {
    throw new Error(`Strathyre public visitor feature falls outside visitor boundary: ${featureId}`);
  }
}

const audit = {
  projectId: pkg.project.id,
  reviewedAt,
  townRating: {
    previous: 1,
    rating: pkg.project.touristAppeal.rating,
    rationale:
      'One star remains accurate: Strathyre has unusually good village-start walking and cycling, one top food stop and characterful outdoor art, but limited indoor depth and little reason for a broad all-weather visit.',
  },
  boundary: {
    previous:
      'Supplied rectangular study extent from longitude -4.336 to -4.3085 and latitude 56.3186 to 56.3368.',
    active:
      'Five OpenStreetMap residential landuse polygons with 90-metre envelopes and a narrow 120-metre visitor corridor between Broch Field, the village centre, forest car park and Village Hall.',
    nrsFinding: 'Strathyre is not present as a named locality in the NRS 2022 locality shapefile.',
    rule:
      'Every town-planner marker is inside the active visitor boundary. Trail routes may leave it, but their published start point must remain inside Strathyre.',
  },
  published: {
    see: pkg.project.visitorHighlights.map((highlight) => highlight.featureId),
    eat: curationLibrary.projects[pkg.project.id].eat,
    trails: curationLibrary.projects[pkg.project.id].trails,
    parking: curationLibrary.projects[pkg.project.id].parking,
    toilets: curationLibrary.projects[pkg.project.id].toilets,
    picnic: curationLibrary.projects[pkg.project.id].picnic,
  },
  excluded: [
    {
      name: 'The White Stag Inn and The Munro Inn',
      reason: 'Current sources indicate closure; neither is published as an Eat recommendation.',
    },
    {
      name: 'Ben Sheann Hotel restaurant',
      reason:
        'The current hotel website does not provide sufficiently clear public restaurant information for a defensible curated Eat listing.',
    },
    {
      name: 'Strathyre Village Hall parking',
      reason:
        'The council describes only three or four limited spaces; these are not promoted as general visitor parking.',
    },
    {
      name: 'Loch Lubnaig, Balquhidder and Kingshouse places',
      reason: 'Outside the active Strathyre town boundary and not counted towards its rating.',
    },
  ],
  artwork: {
    asset: '/town-guides/strathyre-river-forest-watercolour-guide.png',
    treatment:
      'Text-free original light ink-and-watercolour illustration in the established Townscape Guides style.',
  },
  sourceUrls: pkg.project.townGuide.sourceUrls,
};

await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
await writeFile(curationPath, `${JSON.stringify(curationLibrary, null, 2)}\n`, 'utf8');
await writeFile(auditPath, `${JSON.stringify(audit, null, 2)}\n`, 'utf8');

console.log(
  `Updated Strathyre visitor audit: ${pkg.project.visitorHighlights.length} sights, ${curationLibrary.projects[pkg.project.id].eat.length} food stop, ${curationLibrary.projects[pkg.project.id].trails.length} trails, ${curationLibrary.projects[pkg.project.id].parking.length} car parks, ${curationLibrary.projects[pkg.project.id].toilets.length} toilet and ${curationLibrary.projects[pkg.project.id].picnic.length} picnic areas. Town rating: ${pkg.project.touristAppeal.rating} star.`,
);
