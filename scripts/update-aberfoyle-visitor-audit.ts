import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { booleanPointInPolygon, buffer, point, polygon } from '@turf/turf';
import type { HeritageFeature, ProjectPackage, SourceRecord } from '../src/domain/models';

type PlannerCuration = Record<string, Record<string, string[]>>;

const projectPath = resolve('data/projects/aberfoyle.json');
const curationPath = resolve('data/visitor-planner-curation.json');
const auditPath = resolve('data/review/aberfoyle-visitor-audit-2026-08-06.json');
const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
const curationLibrary = JSON.parse(await readFile(curationPath, 'utf8')) as {
  projects: PlannerCuration;
};
const reviewedAt = '2026-08-06T00:00:00Z';
const reviewedDate = '2026-08-06';
const auditTag = 'aberfoyle-visitor-audit';
const visitorPackTag = 'aberfoyle-scotland-visitor-pack';
const editorialMetadataLicence =
  'Original editorial summary and factual visitor metadata; linked source content is not redistributed.';
const osmLicence = 'Open Database Licence (ODbL) v1.0; © OpenStreetMap contributors.';

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

function upsertFeature(feature: HeritageFeature): HeritageFeature {
  const index = pkg.features.findIndex((candidate) => candidate.id === feature.id);
  if (index === -1) {
    pkg.features.push(feature);
    return feature;
  }
  const previous = pkg.features[index];
  pkg.features[index] = {
    ...feature,
    attractionGuide: feature.attractionGuide ?? previous.attractionGuide,
  };
  return pkg.features[index];
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

function updateFood(options: {
  id: string;
  coordinates: [number, number];
  name: string;
  score: number;
  tagline: string;
  description: string;
  opening: string;
  price: string;
  cuisine: string;
  website: string;
  organisation: string;
  kind: 'cafe' | 'restaurant' | 'pub' | 'fast_food';
  address: string;
  dogFriendly?: boolean;
  reliability?: SourceRecord['reliability'];
}): HeritageFeature {
  const dogDetail = options.dogFriendly ? '; dog=true' : '';
  return upsertFeature(
    curatedPoint(
      options.id,
      options.name,
      options.kind,
      options.coordinates,
      options.description,
      currentSource(
        `${options.name} visitor information`,
        options.organisation,
        `visitor-audit:food:${options.id}`,
        options.website,
        `Current-place curation: amenity=${options.kind}; name=${options.name}; cuisine=${options.cuisine}; visit_score=${options.score}; price_band=${options.price}; opening_hours:description=${options.opening}; description=${options.tagline}: ${options.description}; website=${options.website}${dogDetail}.`,
        options.reliability,
      ),
      ['current-context', 'service-context-food', 'visitor-context-food'],
    ),
  );
}

function attribute(tag: string, name: string): string | undefined {
  return tag.match(new RegExp(`\\b${name}="([^"]+)"`))?.[1];
}

async function fetchOsmWayPolygon(wayId: string) {
  const sourceUrl = `https://api.openstreetmap.org/api/0.6/way/${wayId}/full`;
  const response = await fetch(sourceUrl, {
    headers: { 'User-Agent': 'TownscapeGuides-AberfoyleAudit/1.0' },
  });
  if (!response.ok) throw new Error(`OpenStreetMap way ${wayId} failed: ${response.status}`);
  const xml = await response.text();
  const nodes = new Map<string, [number, number]>();
  for (const [tag] of xml.matchAll(/<node\b[^>]*>/g)) {
    const id = attribute(tag, 'id');
    const latitude = Number(attribute(tag, 'lat'));
    const longitude = Number(attribute(tag, 'lon'));
    if (id && Number.isFinite(latitude) && Number.isFinite(longitude)) {
      nodes.set(id, [longitude, latitude]);
    }
  }
  const way = xml.match(new RegExp(`<way id="${wayId}"[\\s\\S]*?<\\/way>`))?.[0];
  if (!way) throw new Error(`OpenStreetMap way ${wayId} was not present in the response`);
  const coordinates = [...way.matchAll(/<nd ref="(\d+)"/g)].map((match) => {
    const coordinate = nodes.get(match[1]);
    if (!coordinate) throw new Error(`OpenStreetMap node ${match[1]} was not present`);
    return coordinate;
  });
  if (coordinates.length < 4) throw new Error(`OpenStreetMap way ${wayId} is not a polygon`);
  return polygon([coordinates], {
    sourceDataset: 'OpenStreetMap residential landuse',
    localityName: 'Aberfoyle',
    osmType: 'way',
    osmId: Number(wayId),
    sourceUrl,
    licence: osmLicence,
    reviewedAt: reviewedDate,
  });
}

const osmResidentialBoundary = await fetchOsmWayPolygon('166576344');
const visitorBoundary = buffer(osmResidentialBoundary, 0.1, { units: 'kilometers' });
if (!visitorBoundary) throw new Error('Could not build the Aberfoyle visitor boundary');
visitorBoundary.properties = {
  ...osmResidentialBoundary.properties,
  sourceDataset: 'OSM-derived Aberfoyle visitor-town boundary',
  bufferMetres: 100,
  boundaryMethod:
    'A 100-metre envelope around OpenStreetMap residential landuse way 166576344, sufficient to include the village Main Street, Riverside facilities and edge-of-village bike park without absorbing the forest visitor-centre cluster.',
};

pkg.project.boundary = visitorBoundary;
pkg.project.boundarySource =
  'OpenStreetMap residential landuse way 166576344 with a transparent 100-metre visitor envelope. This is a curated visitor-town boundary, not an administrative boundary.';
pkg.project.boundaryConfidence = 'medium';
pkg.project.centre = [-4.383, 56.1785];
pkg.project.townStudyArea = {
  localityName: 'Aberfoyle',
  localityCode: '166576344',
  sourceName: 'OpenStreetMap residential landuse-derived visitor boundary',
  sourceUrl: 'https://www.openstreetmap.org/way/166576344',
  sourceVersion: 'OpenStreetMap data accessed 2026-08-06',
  bufferMetres: 100,
  localityBoundary: osmResidentialBoundary,
  bufferedBoundary: visitorBoundary,
  visitorBoundary,
  notes:
    'The original supplied rectangular study extent was rejected because it absorbed major forest attractions well beyond the built village. The active visitor boundary is a 100-metre envelope around OSM residential landuse, including Main Street, Riverside and the edge-of-village bike park while excluding The Lodge, Go Ape and Three Lochs Forest Drive.',
};
pkg.project.researchNotes =
  'Visitor audit completed 2026-08-06. Town-planner places must sit inside the active OSM-derived visitor boundary; nearby forest attractions remain Home-map standalone discoveries and do not raise Aberfoyle\'s town rating.';

pkg.project.touristAppeal = {
  rating: 2,
  label: 'Worth a planned stop',
  summary:
    'Aberfoyle earns two stars as a lively Trossachs gateway with Robert Kirk folklore, the Doon Hill walk, a purpose-built bike park, the Scottish Wool Centre and an unusually useful cluster of independent cafes and inns. Its best-known forest attractions sit beyond the village boundary, so it is a rewarding planned stop rather than a three-star destination in its own right.',
};

pkg.project.visualIdentity = {
  theme: 'trossachs-village-folklore-and-cycling',
  badgeImage: '/town-guides/aberfoyle-main-street-watercolour-guide.png',
  badgeAlt:
    'Light ink-and-watercolour illustration of the sandstone shops on Aberfoyle Main Street with wooded Trossachs hills beyond',
  heroImage: '/town-guides/aberfoyle-main-street-watercolour-guide.png',
  heroAlt:
    'Light ink-and-watercolour illustration of the sandstone shops on Aberfoyle Main Street with wooded Trossachs hills beyond',
  primaryColour: '#17444A',
  accentColour: '#B9792C',
  backgroundColour: '#EFF4E8',
  heroObjectPosition: '50% 54%',
  motifs: ['Fairy folklore', 'Forest walks', 'Cycling', 'Village cafes'],
};

pkg.project.townGuide = {
  headline: 'Fairy folklore, forest-edge walks and a lively village stop',
  intro:
    'Aberfoyle is best enjoyed as a compact Trossachs village with an outdoorsy pulse. Browse the Scottish Wool Centre, follow Robert Kirk\'s strange fairy story onto Doon Hill, try the bike park and return to a particularly good run of independent bakeries, cafes and inns along Main Street.',
  bestFor: ['Fairy folklore', 'Forest-edge walking', 'Cycling families', 'Cafe stops'],
  perfectFor: [
    'A half-day village and Doon Hill wander',
    'Families mixing the bike park with an easy food stop',
    'Visitors beginning a wider Trossachs day from the village',
  ],
  suggestedFirstVisit: {
    title: 'Main Street, Riverside and Doon Hill',
    summary:
      'Start with the Main Street shops and Scottish Wool Centre, cross the Riverside area, then follow the signed Doon Hill Trail for Robert Kirk\'s Fairy Knowe story and a wooded climb above the village.',
  },
  dontMiss: ['Doon Hill Trail', 'Scottish Wool Centre', 'Aberfoyle Bike Park'],
  suggestedTime: 'Half a day; allow longer for Doon Hill',
  visitorMood:
    'For walkers, cyclists and curious visitors who like folklore, independent food and a village that opens naturally into the Trossachs.',
  sourceUrls: [
    'https://www.lochlomond-trossachs.org/discover-the-park/towns-villages/aberfoyle/',
    'https://forestryandland.gov.scot/visit/destinations/aberfoyle/visitor-information',
    'https://forestryandland.gov.scot/media/kzhfrgp3/fls-routecard-qefp-aberfoyle.pdf',
    'https://www.ewm.co.uk/store-finder',
    'https://www.lochlomond-trossachs.org/things-to-do/cycling/aberfoyle-bike-park/',
    'https://www.goaberfoyle.co.uk/food-drink/',
    'https://www.stirling.gov.uk/community-life-and-leisure/public-toilets/list-of-the-public-toilets-in-stirling/aberfoyle/',
    'https://www.geograph.org.uk/photo/7492996',
  ],
  lastReviewedAt: reviewedDate,
};

const woolCentre = upsertFeature(
  curatedPoint(
    'curated-attraction:aberfoyle-scottish-wool-centre',
    'Scottish Wool Centre and seasonal demonstrations',
    'attraction',
    [-4.3816, 56.17795],
    'A long-established visitor stop combining Scottish textiles, souvenirs, a restaurant, play area and seasonal live animal demonstrations.',
    currentSource(
      'Scottish Wool Centre visitor information',
      'Edinburgh Woollen Mill and VisitScotland',
      'visitor-audit:attraction:aberfoyle-scottish-wool-centre',
      'https://www.ewm.co.uk/store-finder',
      'Current-place curation: tourism=attraction; name=Scottish Wool Centre and seasonal demonstrations; visitor_place_type=Textile and visitor centre; visit_score=68; opening_hours:description=Monday-Saturday 09:30-17:00 and Sunday 10:30-16:30; entrance_fee=Free entry, retail purchases optional; time_to_spend=45-90 minutes; description=Browse Scottish textiles and souvenirs, use the restaurant and play area, and look for the seasonal live animal demonstrations; website=https://www.ewm.co.uk/store-finder.',
    ),
    ['current-context', 'service-context-visitor'],
  ),
);

const bikePark = upsertFeature(
  curatedPoint(
    'osm-community:way-307345455',
    'Aberfoyle Bike Park',
    'sports_centre',
    [-4.3769706, 56.176196],
    'A purpose-built edge-of-village mountain-bike skills area with rock garden, skinnies, drops, jumps and berms.',
    currentSource(
      'Aberfoyle Bike Park',
      'Loch Lomond & The Trossachs National Park Authority and OpenStreetMap contributors',
      'visitor-audit:attraction:osm-community:way-307345455',
      'https://www.lochlomond-trossachs.org/things-to-do/cycling/aberfoyle-bike-park/',
      'Current-place curation: tourism=attraction; leisure=sports_centre; sport=cycling; name=Aberfoyle Bike Park; visitor_place_type=Mountain-bike skills park; visit_score=63; opening_hours:description=Open-access outdoor facility, daylight use recommended; entrance_fee=Free; time_to_spend=45-120 minutes; description=Practise off-road skills on a compact purpose-built park with rock garden, skinnies, drops, jumps and berms; website=https://www.lochlomond-trossachs.org/things-to-do/cycling/aberfoyle-bike-park/.',
      'official_non_statutory',
      `${editorialMetadataLicence} Geometry derived from ${osmLicence}`,
    ),
    ['current-context', 'service-context-leisure', 'service-context-visitor'],
  ),
);

const lodge = upsertFeature(
  curatedPoint(
    'curated-attraction:aberfoyle-lodge-forest-visitor-centre',
    'The Lodge Forest Visitor Centre and viewpoint',
    'visitor_centre',
    [-4.3855056, 56.182462],
    'A major forest visitor centre north of Aberfoyle with panoramic views, wildlife, accessible trails and a cafe.',
    currentSource(
      'The Lodge Forest Visitor Centre visitor information',
      'Forestry and Land Scotland',
      'visitor-audit:standalone:aberfoyle-lodge',
      'https://forestryandland.gov.scot/visit/destinations/the-lodge-forest-visitor-centre/visitor-information',
      'Current-place curation: tourism=visitor_centre; name=The Lodge Forest Visitor Centre and viewpoint; visitor_place_type=Forest visitor centre; visit_score=88; opening_hours:description=April-October 10:00-16:30, November and March 10:00-16:00, December-February 10:00-15:00; entrance_fee=Free entry, parking £2 up to one hour or £5 all day; time_to_spend=90-180 minutes; description=Use the panoramic viewpoint, cafe, wildlife areas and forest trails at this major visitor centre north of Aberfoyle; website=https://forestryandland.gov.scot/visit/destinations/the-lodge-forest-visitor-centre/visitor-information.',
    ),
    ['current-context', 'service-context-visitor', 'home-standalone-place'],
  ),
);
lodge.attractionGuide = {
  ...lodge.attractionGuide,
  toilets: 'Toilets and accessible toilets are available at the visitor centre.',
  picnic: 'A dedicated picnic area is available beside the visitor centre and forest trails.',
  food: [
    {
      name: 'The Lodge Cafe',
      visitorScore: 76,
      summary: 'A useful on-site cafe for coffee, cake or lunch before or after the forest trails.',
      priceBand: '££',
      externalUrl:
        'https://forestryandland.gov.scot/visit/destinations/the-lodge-forest-visitor-centre/visitor-information',
    },
  ],
  trails: [
    {
      name: 'Waterfall Trail',
      routeType: 'Forest trail',
      distance: '1 mile / 1.8 km',
      duration: 'About 30 minutes',
      difficulty: 'Easy',
      summary: 'The most accessible Lodge route, leading through the forest to the waterfall.',
      externalUrl:
        'https://forestryandland.gov.scot/visit/destinations/the-lodge-forest-visitor-centre/trails',
    },
    {
      name: 'Oak Coppice Trail',
      routeType: 'Forest trail',
      distance: '1.75 miles / 2.9 km',
      duration: 'About 1 hour',
      difficulty: 'Moderate',
      summary: 'A varied woodland route through the oak coppice below the visitor centre.',
      externalUrl:
        'https://forestryandland.gov.scot/visit/destinations/the-lodge-forest-visitor-centre/trails',
    },
    {
      name: 'Craigmore View Trail',
      routeType: 'Viewpoint trail',
      distance: '1.75 miles / 2.8 km',
      duration: 'About 90 minutes',
      difficulty: 'Strenuous',
      summary: 'A steeper climb rewarded by broad views over the Trossachs landscape.',
      externalUrl:
        'https://forestryandland.gov.scot/visit/destinations/the-lodge-forest-visitor-centre/trails',
    },
    {
      name: 'Lime Craig Trail',
      routeType: 'Forest and hill trail',
      distance: '4 miles / 6.6 km',
      duration: 'About 2.5 hours',
      difficulty: 'Strenuous',
      summary: 'The Lodge\'s longest published route, climbing through forest to Lime Craig.',
      externalUrl:
        'https://forestryandland.gov.scot/visit/destinations/the-lodge-forest-visitor-centre/trails',
    },
  ],
  thingsToDo: [
    {
      name: 'Panoramic forest viewpoint',
      summary: 'Take in the broad Trossachs outlook from the visitor-centre viewpoint.',
    },
    {
      name: 'Waterfall Trail',
      summary: 'Follow the gentle all-abilities route through the forest to the waterfall.',
    },
    {
      name: 'Lumberjills Memorial',
      summary: "Pause at the monument to the Women's Timber Corps on the Waterfall Trail.",
    },
    {
      name: 'Wildlife watching',
      summary:
        'Use the visitor centre and forest viewpoints to look for local wildlife and seasonal bird activity.',
    },
    {
      name: 'Go Ape Aberfoyle',
      summary:
        'Add the separately operated treetop course for a more active visit; booking and an additional charge apply.',
    },
  ],
};

const threeLochs = upsertFeature(
  curatedPoint(
    'three-lochs-drive',
    'Three Lochs Forest Drive',
    'scenic_route',
    [-4.399, 56.2145],
    'A seasonal one-way forest drive through classic Trossachs scenery beside three lochs.',
    currentSource(
      'Three Lochs Forest Drive',
      'Forestry and Land Scotland',
      'visitor-audit:standalone:aberfoyle-three-lochs',
      'https://forestryandland.gov.scot/visit/destinations/three-lochs-forest-drive',
      'Current-place curation: tourism=attraction; name=Three Lochs Forest Drive; visitor_place_type=Seasonal scenic forest drive; visit_score=87; opening_hours:description=Seasonal vehicle route, check live opening information before travel; entrance_fee=Vehicle charge applies; time_to_spend=120-240 minutes; description=Drive a distinctive one-way forest route through classic Trossachs scenery beside Lochan Reoidhte, Loch Drunkie and Loch Achray; website=https://forestryandland.gov.scot/visit/destinations/three-lochs-forest-drive.',
    ),
    ['current-context', 'service-context-visitor', 'home-standalone-place'],
  ),
);
threeLochs.attractionGuide = {
  ...threeLochs.attractionGuide,
  trails: [
    {
      name: 'Achray Trail',
      routeType: 'Forest trail',
      distance: '1 mile / 1.5 km',
      duration: 'About 45 minutes',
      difficulty: 'Strenuous',
      summary: 'A short but rough route with long, steep slopes and uneven rock and earth.',
      externalUrl:
        'https://forestryandland.gov.scot/media/cqclu5dk/three-lochs-forest-drive-qefp-central-routecard-v10.pdf',
    },
    {
      name: 'Pine Ridge Trail',
      routeType: 'Forest trail',
      distance: '0.75 miles / 1.2 km',
      duration: 'About 30 minutes',
      difficulty: 'Strenuous',
      summary: 'A compact, steep route whose uneven surface can be muddy after rain.',
      externalUrl:
        'https://forestryandland.gov.scot/media/cqclu5dk/three-lochs-forest-drive-qefp-central-routecard-v10.pdf',
    },
    {
      name: 'Loch Drunkie Trail',
      routeType: 'Lochside forest trail',
      distance: '1.25 miles / 1.9 km',
      duration: 'About 45 minutes',
      difficulty: 'Moderate',
      summary: 'A firm gravel route with loch views and a mixture of moderate and steeper slopes.',
      externalUrl:
        'https://forestryandland.gov.scot/media/cqclu5dk/three-lochs-forest-drive-qefp-central-routecard-v10.pdf',
    },
  ],
};

const goApe = upsertFeature(
  curatedPoint(
    'go-ape',
    'Go Ape Aberfoyle',
    'adventure_park',
    [-4.3856721, 56.1827126],
    'A paid high-ropes and zip-line experience in the forest visitor cluster north of the village.',
    currentSource(
      'Go Ape Aberfoyle',
      'Go Ape',
      'visitor-audit:standalone:aberfoyle-go-ape',
      'https://goape.co.uk/locations/aberfoyle',
      'Current-place curation: tourism=attraction; name=Go Ape Aberfoyle; visitor_place_type=High-ropes adventure course; visit_score=81; opening_hours:description=Session times vary by date, advance booking recommended; entrance_fee=Paid, current price varies by course and date; time_to_spend=120-180 minutes; description=Book a high-ropes adventure featuring some of the longest zip lines in the Go Ape network; website=https://goape.co.uk/locations/aberfoyle.',
    ),
    ['current-context', 'service-context-visitor', 'home-standalone-place'],
  ),
);

pkg.project.visitorHighlights = [
  {
    rank: 1,
    featureId: woolCentre.id,
    name: woolCentre.name,
    reason:
      'The village\'s most substantial drop-in visitor stop combines Scottish textiles, souvenirs, food, family facilities and seasonal animal demonstrations.',
    tagline: 'Village visitor hub',
    visitorScore: 68,
    openingTimes: 'Monday-Saturday 09:30-17:00; Sunday 10:30-16:30.',
    admission: 'Free entry; retail purchases optional.',
    freeAdmission: true,
    sourceName: 'Edinburgh Woollen Mill store finder and VisitScotland',
    sourceUrl: 'https://www.ewm.co.uk/store-finder',
    verifiedInBoundaryAt: reviewedDate,
  },
  {
    rank: 2,
    featureId: bikePark.id,
    name: bikePark.name,
    reason:
      'A genuine edge-of-village family cycling stop with purpose-built features for practising off-road skills.',
    tagline: 'Cycling skills',
    visitorScore: 63,
    openingTimes: 'Open-access outdoor facility; daylight use recommended.',
    admission: 'Free.',
    freeAdmission: true,
    sourceName: 'Loch Lomond & The Trossachs National Park Authority',
    sourceUrl:
      'https://www.lochlomond-trossachs.org/things-to-do/cycling/aberfoyle-bike-park/',
    verifiedInBoundaryAt: reviewedDate,
  },
  {
    rank: 3,
    featureId: lodge.id,
    name: lodge.name,
    reason:
      'The strongest nearby forest attraction has panoramic Trossachs views, wildlife, a cafe and a range of trails, but sits beyond the village boundary.',
    tagline: 'Nearby forest hub',
    visitorScore: 88,
    openingTimes:
      'April-October 10:00-16:30; November and March 10:00-16:00; December-February 10:00-15:00.',
    admission: 'Free entry; parking £2 up to one hour or £5 all day.',
    freeAdmission: true,
    organisationPills: ['Free entry', 'FLS'],
    sourceName: 'Forestry and Land Scotland',
    sourceUrl:
      'https://forestryandland.gov.scot/visit/destinations/the-lodge-forest-visitor-centre/visitor-information',
    verifiedInBoundaryAt: reviewedDate,
  },
  {
    rank: 4,
    featureId: threeLochs.id,
    name: threeLochs.name,
    reason:
      'A distinctive seasonal forest drive through wider Trossachs scenery, retained for Home discovery rather than the town planner.',
    tagline: 'Nearby scenic drive',
    visitorScore: 87,
    openingTimes: 'Seasonal vehicle route; check live opening information before travel.',
    admission: 'Vehicle charge applies.',
    freeAdmission: false,
    sourceName: 'Forestry and Land Scotland',
    sourceUrl: 'https://forestryandland.gov.scot/visit/destinations/three-lochs-forest-drive',
    verifiedInBoundaryAt: reviewedDate,
  },
  {
    rank: 5,
    featureId: goApe.id,
    name: goApe.name,
    reason:
      'A major paid high-ropes and zip-line experience in The Lodge forest cluster, outside the village itself.',
    tagline: 'Nearby adventure',
    visitorScore: 81,
    openingTimes: 'Session times vary by date; advance booking recommended.',
    admission: 'Paid; current price varies by course and date.',
    freeAdmission: false,
    sourceName: 'Go Ape',
    sourceUrl: 'https://goape.co.uk/locations/aberfoyle',
    verifiedInBoundaryAt: reviewedDate,
  },
];

const maggies = updateFood({
  id: 'osm-community:node-9412972204',
  coordinates: [-4.3826135, 56.1785931],
  name: "Maggie's Aberfoyle Kitchen",
  score: 84,
  tagline: 'Best baking',
  description:
    'A distinctive working bakery for shortbread, scones, clootie dumpling, cakes, tablet and small-batch preserves made in the village.',
  opening: 'Current listings indicate daily 09:00-17:00; confirm before a special journey',
  price: '£',
  cuisine: 'Scottish baking, cakes and preserves',
  website: 'https://www.maggiesaberfoylekitchen.co.uk/',
  organisation: "Maggie's Aberfoyle Kitchen and Forth Valley Food & Drink Network",
  kind: 'cafe',
  address: 'Station Building, Main Street, Aberfoyle, FK8 3UG',
});

const station = updateFood({
  id: 'osm-community:node-9388927746',
  coordinates: [-4.3824076, 56.1785791],
  name: 'The Station Coffee Shop',
  score: 82,
  tagline: 'Best coffee stop',
  description:
    'A bright, child-friendly cafe for speciality coffee, hot and cold food, takeaway and gluten-free or vegan cakes beside the old station.',
  opening: 'Open all year from 10:00; closing time varies seasonally',
  price: '££',
  cuisine: 'Speciality coffee, cafe meals and cakes',
  website: 'https://www.goaberfoyle.co.uk/food-drink/station-cafe/',
  organisation: 'Go Aberfoyle and The Station Coffee Shop',
  kind: 'cafe',
  address: 'Main Street, Aberfoyle, FK8 3UG',
  reliability: 'secondary',
});

const faerieTree = updateFood({
  id: 'osm-community:node-5801241398',
  coordinates: [-4.3815326, 56.1788171],
  name: 'The Faerie Tree',
  score: 80,
  tagline: 'Best family meal',
  description:
    'A dog-friendly village restaurant and bar serving seasonal British and international dishes, brunch, lunch, dinner and daily specials.',
  opening: 'Open daily; meal and late-bar hours vary, check the current booking page',
  price: '££',
  cuisine: 'Seasonal British and international restaurant food',
  website: 'https://thefaerietree.co.uk/',
  organisation: 'The Faerie Tree',
  kind: 'restaurant',
  address: 'Main Street, Aberfoyle, FK8 3UG',
  dogFriendly: true,
});

const forthInn = updateFood({
  id: 'osm-community:node-10879342147',
  coordinates: [-4.3836123, 56.1784431],
  name: 'The Forth Inn',
  score: 78,
  tagline: 'Country pub meal',
  description:
    'A notably dog-friendly traditional inn for Scottish pub food, cask ales and an easy central meal after a walk or ride.',
  opening: 'Open all year from 12:00; food and final-order times vary',
  price: '££',
  cuisine: 'Scottish pub food and cask ales',
  website: 'https://www.goaberfoyle.co.uk/food-drink/forth-inn/',
  organisation: 'The Forth Inn and Go Aberfoyle',
  kind: 'pub',
  address: 'Main Street, Aberfoyle, FK8 3UG',
  dogFriendly: true,
  reliability: 'secondary',
});

const lizMacgregors = updateFood({
  id: 'osm-community:node-4981925908',
  coordinates: [-4.3844073, 56.1787285],
  name: "Liz MacGregor's Coffee Shop",
  score: 75,
  tagline: 'Traditional cafe',
  description:
    'A straightforward all-year Main Street cafe for breakfast, filled rolls, paninis, salads, hot dishes and homemade cakes.',
  opening: 'Open all year from 09:00 through teatime; confirm the current closing time',
  price: '££',
  cuisine: 'Traditional Scottish cafe food and home baking',
  website: 'https://www.goaberfoyle.co.uk/food-drink/liz-macgregors-coffee-shop/',
  organisation: "Liz MacGregor's Coffee Shop and Go Aberfoyle",
  kind: 'cafe',
  address: 'Main Street, Aberfoyle, FK8 3UG',
  reliability: 'secondary',
});

const aberfoyleInn = updateFood({
  id: 'osm-community:node-4280069594',
  coordinates: [-4.3835399, 56.1786743],
  name: 'Aberfoyle Inn',
  score: 71,
  tagline: 'Relaxed inn meal',
  description:
    'A family-run village inn for hearty home-cooked lunches, dinners and drinks in a relaxed central setting.',
  opening: 'Lunch and dinner service; seasonal hours vary, check before travelling specifically',
  price: '££',
  cuisine: 'Home-cooked British and Scottish inn food',
  website: 'https://www.aberfoyleinn.com/',
  organisation: 'Aberfoyle Inn',
  kind: 'restaurant',
  address: '16 Main Street, Aberfoyle, FK8 3UG',
});

const doonHillTrail = upsertFeature(
  curatedPoint(
    'curated-trail:aberfoyle-doon-hill',
    'Doon Hill Trail',
    'walking_route',
    [-4.3829274, 56.1782519],
    'A signed 3.5-kilometre woodland trail from Riverside Car Park to the Fairy Knowe associated with Robert Kirk.',
    currentSource(
      'Doon Hill Trail route card',
      'Forestry and Land Scotland',
      'visitor-audit:trail:aberfoyle-doon-hill',
      'https://forestryandland.gov.scot/media/kzhfrgp3/fls-routecard-qefp-aberfoyle.pdf',
      'Current-place curation: route=foot; name=Doon Hill Trail; trail_type=Signed woodland folklore trail; visit_score=86; best_for=Robert Kirk folklore and a short forest climb; distance=3.5 km / 2.25 miles; time_to_spend=Allow 90 minutes; accessibility=Uneven gravel with narrow rough rocky and muddy sections, exposed roots and long steep slopes; entrance_fee=Free; description=Climb from Aberfoyle Riverside Car Park to the solitary Scots pine traditionally associated with the entrance to the Fairy Queen\'s underground palace; website=https://forestryandland.gov.scot/media/kzhfrgp3/fls-routecard-qefp-aberfoyle.pdf.',
    ),
    ['current-context', 'service-context-walk', 'visitor-context-trail'],
  ),
);

const riversideParking = upsertFeature(
  curatedPoint(
    'osm-community:way-184629108',
    'Riverside Car Park, Main Street',
    'parking',
    [-4.3827543, 56.1780575],
    'The main free public village car park beside the Scottish Wool Centre, visitor information, toilets and Doon Hill trail start.',
    currentSource(
      'Riverside Car Park',
      'Stirling Council, Forestry and Land Scotland and OpenStreetMap contributors',
      'visitor-audit:parking:osm-community:way-184629108',
      'https://forestryandland.gov.scot/visit/destinations/aberfoyle/visitor-information',
      'Current-place curation: amenity=parking; name=Riverside Car Park, Main Street; parking=surface; access=public; capacity=126; accessible_spaces=10; price_display=Free; payment_required=no; opening_hours:description=Open daily; observe any current entrance signs; description=The main free public village car park beside the Scottish Wool Centre, visitor information, toilets and Doon Hill trail start; website=https://forestryandland.gov.scot/visit/destinations/aberfoyle/visitor-information.',
      'local_authority',
      `${editorialMetadataLicence} Geometry derived from ${osmLicence}`,
    ),
    ['current-context', 'service-context-parking'],
  ),
);

const riversideToilets = upsertFeature(
  curatedPoint(
    'osm-community:node-271932462',
    'Riverside Car Park public toilets, Main Street',
    'toilets',
    [-4.3829274, 56.1782519],
    'Free 24-hour public toilets with disabled access at the main Riverside visitor car park.',
    currentSource(
      'Aberfoyle public toilets',
      'Stirling Council',
      'visitor-audit:toilets:osm-community:node-271932462',
      'https://www.stirling.gov.uk/community-life-and-leisure/public-toilets/list-of-the-public-toilets-in-stirling/aberfoyle/',
      'Current-place curation: amenity=toilets; name=Riverside Car Park public toilets, Main Street; access=public; price_display=Free; disabled_access=yes; baby_changing=no; opening_hours:description=Open 24 hours; description=Free public toilets with disabled access at the main Riverside visitor car park; website=https://www.stirling.gov.uk/community-life-and-leisure/public-toilets/list-of-the-public-toilets-in-stirling/aberfoyle/.',
      'local_authority',
      `${editorialMetadataLicence} Geometry derived from ${osmLicence}`,
    ),
    ['current-context', 'service-context-toilets'],
  ),
);

const riversidePicnic = upsertFeature(
  curatedPoint(
    'osm-community:node-9388927753',
    'Riverside picnic area, beside the Scottish Wool Centre',
    'picnic_site',
    [-4.3822267, 56.1778579],
    'The named village picnic stop at Riverside, close to the Scottish Wool Centre and public facilities.',
    currentSource(
      'Aberfoyle Riverside picnic facilities',
      'Forestry and Land Scotland and OpenStreetMap contributors',
      'visitor-audit:picnic:osm-community:node-9388927753',
      'https://forestryandland.gov.scot/visit/destinations/aberfoyle/visitor-information',
      'Current-place curation: tourism=picnic_site; name=Riverside picnic area, beside the Scottish Wool Centre; access=public; price_display=Free; opening_hours:description=Open-air picnic area, daylight use recommended; description=Village picnic facilities at Riverside close to the Scottish Wool Centre and public toilets; website=https://forestryandland.gov.scot/visit/destinations/aberfoyle/visitor-information.',
      'official_non_statutory',
      `${editorialMetadataLicence} Geometry derived from ${osmLicence}`,
    ),
    ['current-context', 'service-context-picnic'],
  ),
);

curationLibrary.projects[pkg.project.id] = {
  eat: [
    maggies.id,
    station.id,
    faerieTree.id,
    forthInn.id,
    lizMacgregors.id,
    aberfoyleInn.id,
  ],
  trails: [doonHillTrail.id],
  picnic: [riversidePicnic.id],
  parking: [riversideParking.id],
  toilets: [riversideToilets.id],
};

const townHighlightIds = [woolCentre.id, bikePark.id];
const publicTownFeatureIds = [
  ...townHighlightIds,
  ...Object.values(curationLibrary.projects[pkg.project.id]).flat(),
];
for (const featureId of new Set(publicTownFeatureIds)) {
  const feature = pkg.features.find((candidate) => candidate.id === featureId);
  if (!feature || feature.geometry?.type !== 'Point') {
    throw new Error(`Aberfoyle public visitor feature is missing a point: ${featureId}`);
  }
  if (!booleanPointInPolygon(point(feature.geometry.coordinates), visitorBoundary)) {
    throw new Error(`Aberfoyle public visitor feature falls outside visitor boundary: ${featureId}`);
  }
}

for (const feature of [lodge, threeLochs, goApe]) {
  if (feature.geometry?.type !== 'Point') throw new Error(`${feature.name} is not a point`);
  if (booleanPointInPolygon(point(feature.geometry.coordinates), visitorBoundary)) {
    throw new Error(`${feature.name} unexpectedly falls inside the Aberfoyle visitor boundary`);
  }
}

for (const id of [
  'curated-parking:aberfoyle-lodge',
  'curated-parking:aberfoyle-main-street',
  'curated-parking:aberfoyle-three-lochs',
]) {
  const feature = pkg.features.find((candidate) => candidate.id === id);
  if (!feature) continue;
  addTags(feature, 'visitor-audit-excluded', 'map-hidden', auditTag);
  feature.reviewed = true;
  feature.updatedAt = reviewedAt;
  feature.reviewNotes =
    id === 'curated-parking:aberfoyle-main-street'
      ? 'Replaced by the named, mapped and capacity-checked Riverside Car Park record.'
      : 'Outside the active Aberfoyle visitor boundary and excluded from the town planner.';
}

const audit = {
  projectId: pkg.project.id,
  reviewedAt,
  townRating: {
    previous: 3,
    rating: pkg.project.touristAppeal.rating,
    rationale:
      'Two stars are appropriate for a strong gateway village with Doon Hill folklore, a bike park, the Scottish Wool Centre and a notably useful food cluster. The Lodge, Go Ape and Three Lochs Forest Drive are nearby standalone attractions outside the town boundary and cannot justify a three-star town rating.',
  },
  boundary: {
    previous:
      'Supplied rectangular study extent from longitude -4.418 to -4.358 and latitude 56.1715 to 56.2205.',
    active:
      'A 100-metre envelope around OpenStreetMap residential landuse way 166576344.',
    rule:
      'Town planner items must be inside the active visitor boundary. Trail markers may represent routes continuing outward, but their published start point must be inside. Nearby forest attractions remain Home-only standalone discoveries.',
  },
  published: {
    townAttractions: townHighlightIds,
    homeOnlyAttractions: [lodge.id, threeLochs.id, goApe.id],
    eat: curationLibrary.projects[pkg.project.id].eat,
    trails: curationLibrary.projects[pkg.project.id].trails,
    parking: curationLibrary.projects[pkg.project.id].parking,
    toilets: curationLibrary.projects[pkg.project.id].toilets,
    picnic: curationLibrary.projects[pkg.project.id].picnic,
  },
  excluded: [
    {
      name: 'The Lodge Forest Visitor Centre, Go Ape and Three Lochs Forest Drive',
      reason:
        'Outside the active OSM-derived town boundary. Retained as Home-map standalone discoveries, not Aberfoyle planner items.',
    },
    {
      name: 'Lodge trails, Statute Labour Road and Old Military Road',
      reason:
        'Outside the town boundary or insufficiently town-centred for the public planner. The official Doon Hill Trail is the single curated town-start trail.',
    },
    {
      name: 'Customer-only and unnamed parking or toilets',
      reason:
        'Only the named free public Riverside car park and council-verified Main Street toilets are published.',
    },
  ],
  artwork: {
    asset: '/town-guides/aberfoyle-main-street-watercolour-guide.png',
    referenceSource: 'Businesses on Main Street, Aberfoyle by Richard Sutcliffe',
    referenceUrl: 'https://www.geograph.org.uk/photo/7492996',
    referenceLicence: 'CC BY-SA 2.0',
    treatment: 'Text-free original light ink-and-watercolour visitor-guide illustration.',
  },
  sourceUrls: pkg.project.townGuide.sourceUrls,
};

await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`);
await writeFile(curationPath, `${JSON.stringify(curationLibrary, null, 2)}\n`);
await writeFile(auditPath, `${JSON.stringify(audit, null, 2)}\n`);

console.log(
  `Updated Aberfoyle visitor audit: ${townHighlightIds.length} in-town attractions, ${curationLibrary.projects[pkg.project.id].eat.length} food stops, 1 trail, 1 car park, 1 toilet and 1 picnic area. Town rating: ${pkg.project.touristAppeal.rating} stars.`,
);
