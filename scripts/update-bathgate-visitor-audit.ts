import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { booleanPointInPolygon, point } from '@turf/turf';
import type { HeritageFeature, ProjectPackage, SourceRecord } from '../src/domain/models';

type PlannerCuration = Record<string, Record<string, string[]>>;

const projectPath = resolve('data/projects/bathgate.json');
const curationPath = resolve('data/visitor-planner-curation.json');
const auditPath = resolve('data/review/bathgate-visitor-audit-2026-08-07.json');
const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
const curationLibrary = JSON.parse(await readFile(curationPath, 'utf8')) as {
  projects: PlannerCuration;
};
const reviewedAt = '2026-08-07T00:00:00Z';
const reviewedDate = '2026-08-07';
const auditTag = 'bathgate-visitor-audit';
const visitorPackTag = 'bathgate-scotland-visitor-pack';
const editorialMetadataLicence =
  'Original editorial summary and factual visitor metadata; linked source content is not redistributed.';
const osmLicence = 'Open Database Licence (ODbL) v1.0; © OpenStreetMap contributors.';

function featureById(id: string): HeritageFeature {
  const feature = pkg.features.find((candidate) => candidate.id === id);
  if (!feature) throw new Error(`Missing Bathgate feature: ${id}`);
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
        !record.sourceRecordId?.startsWith('visitor-pack:') &&
        !record.sourceRecordId?.startsWith('current-context-curation:') &&
        !record.notes?.startsWith('Current-place curation'),
    ),
    source,
  ];
  feature.licence ??= source.licence;
  feature.updatedAt = reviewedAt;
  feature.reviewed = true;
}

function updateFood(
  feature: HeritageFeature,
  options: {
    name: string;
    score: number;
    tagline: string;
    description: string;
    opening: string;
    price: string;
    cuisine: string;
    website: string;
    organisation: string;
    kind: 'cafe' | 'restaurant' | 'pub';
    address: string;
    dogFriendly?: boolean;
    reliability?: SourceRecord['reliability'];
  },
): HeritageFeature {
  feature.name = options.name;
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
  const dogDetail = options.dogFriendly ? '; dog_friendly=yes' : '';
  replaceCurrentCurationSource(
    feature,
    currentSource(
      `${feature.name} visitor information`,
      options.organisation,
      `visitor-audit:food:${feature.id}`,
      options.website,
      `Current-place curation: amenity=${options.kind}; name=${feature.name}; cuisine=${options.cuisine}; visit_score=${options.score}; price_band=${options.price}; opening_hours:description=${options.opening}${dogDetail}; description=${options.tagline}: ${options.description}; website=${options.website}.`,
      options.reliability,
      `${editorialMetadataLicence} Geometry derived from ${osmLicence}`,
    ),
  );
  return feature;
}

function updateParking(
  feature: HeritageFeature,
  options: {
    name: string;
    capacity: number;
    description: string;
    address: string;
    pricingNote: string;
  },
): HeritageFeature {
  feature.name = options.name;
  feature.featureType = 'parking';
  feature.address = options.address;
  feature.shortDescription = options.description;
  addTags(feature, 'current-context', 'service-context-parking', auditTag, visitorPackTag);
  replaceCurrentCurationSource(
    feature,
    currentSource(
      'Bathgate public car parks and capacities',
      'Bathgate Community Development Trust',
      `visitor-audit:parking:${feature.id}`,
      'https://bathgatecdt.org/news/f/bathgate-solar-project-2025',
      `Current-place curation: amenity=parking; name=${options.name}; parking=surface; access=public; capacity=${options.capacity}; price_display=Free; payment_required=no; opening_hours:description=Open daily; observe current entrance signs and any stay limits; description=${options.description}; pricing_note=${options.pricingNote}; website=https://bathgatecdt.org/news/f/bathgate-solar-project-2025.`,
      'secondary',
      `${editorialMetadataLicence} Geometry derived from ${osmLicence}`,
    ),
  );
  return feature;
}

function updateToilets(
  feature: HeritageFeature,
  options: {
    name: string;
    description: string;
    opening: string;
    address: string;
    fee: string;
    wheelchair: string;
  },
): HeritageFeature {
  feature.name = options.name;
  feature.featureType = 'toilets';
  feature.address = options.address;
  feature.shortDescription = options.description;
  addTags(feature, 'current-context', 'service-context-toilets', auditTag, visitorPackTag);
  replaceCurrentCurationSource(
    feature,
    currentSource(
      'Public toilets in West Lothian',
      'West Lothian Council',
      `visitor-audit:toilets:${feature.id}`,
      'https://www.westlothian.gov.uk/toilets',
      `Current-place curation: amenity=toilets; name=${options.name}; access=public; price_display=${options.fee}; opening_hours:description=${options.opening}; wheelchair=${options.wheelchair}; description=${options.description}; website=https://www.westlothian.gov.uk/toilets.`,
      'local_authority',
      `${editorialMetadataLicence} Geometry derived from ${osmLicence}`,
    ),
  );
  return feature;
}

pkg.project.touristAppeal = {
  rating: 1,
  label: 'Local detour',
  summary:
    'Bathgate merits one star as a useful local-history and culture stop rather than a destination in its own right. The volunteer-run Bennie Museum, a compact official history trail and the Art Deco Reconnect Regal provide a credible two-to-three-hour visit, supported by a good independent food cluster. Cairnpapple Hill, Beecraigs and the wider Bathgate Hills are outside the town boundary and do not inflate this rating.',
};

pkg.project.visualIdentity = {
  theme: 'weavers-cottages-and-art-deco',
  badgeImage: '/town-guides/bathgate-weavers-watercolour-guide.png',
  badgeAlt:
    'Light ink-and-watercolour illustration of Bathgate weavers cottages with the Art Deco Regal in the townscape beyond',
  heroImage: '/town-guides/bathgate-weavers-watercolour-guide.png',
  heroAlt:
    'Light ink-and-watercolour illustration of Bathgate weavers cottages with the Art Deco Regal in the townscape beyond',
  heroObjectPosition: '52% 52%',
  primaryColour: '#173F43',
  accentColour: '#A76532',
  backgroundColour: '#EEF3E8',
  motifs: ["Weavers' cottages", 'Town trail', 'Art Deco theatre', 'Industrial story'],
};

pkg.project.townGuide = {
  headline: "Weavers' cottages, an Art Deco theatre and a town shaped by industry",
  intro:
    'Bathgate rewards a short, curious wander rather than a grand sightseeing day. Begin with the domestic-scale stories in the Bennie Museum, follow the town-centre heritage plaques and look for the Art Deco frontage of the Reconnect Regal before choosing one of the strong independent food stops nearby.',
  bestFor: ['Local history', 'Short town trails', 'Art Deco', 'Independent food'],
  perfectFor: [
    'A two-to-three-hour heritage stop',
    'Visitors who enjoy small volunteer-run museums',
    'An evening combining food with a Regal performance',
  ],
  suggestedFirstVisit: {
    title: 'Museum, plaques and the Regal',
    summary:
      'Start at the Bennie Museum, pick up or download the one-hour Bathgate History Trail and follow its town-centre plaques past the Steelyard and Regal. Finish with coffee, lunch or an evening performance if the programme aligns.',
  },
  dontMiss: ['Bennie Museum', 'Bathgate History Trail', 'Reconnect Regal Theatre'],
  suggestedTime: 'Two to three hours; longer with a performance',
  visitorMood:
    'For visitors who enjoy modest local museums, industrial stories, architectural details and finding character in an everyday Scottish town.',
  sourceUrls: [
    'https://www.visitwestlothian.co.uk/explore/bathgate/',
    'https://www.benniemuseum.org.uk/',
    'https://www.visitwestlothian.co.uk/things-to-do/history-heritage/bathgate-history-trail/',
    'https://www.visitwestlothian.co.uk/media/3518/bathgate-history-trail-lo.pdf',
    'https://www.reconnecttheatres.com/regal-theatre/',
    'https://www.westlothian.gov.uk/toilets',
    'https://bathgatecdt.org/news/f/bathgate-solar-project-2025',
  ],
  lastReviewedAt: reviewedDate,
};

const townStudyArea = pkg.project.townStudyArea;
if (!townStudyArea) throw new Error('Bathgate town study area is missing');
delete townStudyArea.visitorBoundary;
townStudyArea.notes =
  "The active visitor boundary is the original NRS 2022 Bathgate locality, preserved unchanged for provenance. Every public attraction, food and practical marker is validated inside this polygon. Cairnpapple Hill, Beecraigs Country Park, Lin's Mill Aqueduct, Ravencraig and the wider Bathgate Hills are nearby context only and are excluded from the Bathgate planner and town rating. The official history-trail marker is inside the locality.";

const bennie = featureById('osm-community:way-361177184');
bennie.name = 'Bennie Museum';
bennie.featureType = 'museum';
bennie.address = '9-11 Mansefield Street, Bathgate, EH48 4HU';
bennie.shortDescription =
  "Two small 18th-century weavers' cottages filled with volunteer-curated objects and stories from Bathgate's domestic, industrial and community past.";
addTags(bennie, 'current-context', 'service-context-heritage', 'service-context-visitor', auditTag);
replaceCurrentCurationSource(
  bennie,
  currentSource(
    'Bennie Museum visitor information',
    'Bennie Museum',
    'visitor-audit:attraction:bennie-museum',
    'https://www.benniemuseum.org.uk/',
    'Current-place curation: tourism=museum; name=Bennie Museum; visitor_place_type=Local history museum in weavers cottages; visit_score=66; opening_hours:description=April-September 11:00-16:00 and October-March 11:00-15:30; volunteer opening can vary, confirm before a special journey; entrance_fee=Free; time_to_spend=45-75 minutes; accessibility=Historic cottages have constrained access, contact the museum for current arrangements; description=Step inside two intimate weavers cottages to discover Bathgate through domestic objects, photographs and local memories; website=https://www.benniemuseum.org.uk/.',
  ),
);

const regal = featureById('hes-listed-building:LB45918');
regal.name = 'Reconnect Regal Theatre';
regal.featureType = 'theatre';
regal.address = '24-34 North Bridge Street, Bathgate, EH48 4PS';
regal.shortDescription =
  "Bathgate's restored Art Deco landmark remains an active theatre, cinema and community venue with a changing programme of live shows and events.";
addTags(regal, 'current-context', 'service-context-heritage', 'service-context-visitor', auditTag);
replaceCurrentCurationSource(
  regal,
  currentSource(
    'Reconnect Regal Theatre visitor information',
    'Reconnect Theatres',
    'visitor-audit:attraction:reconnect-regal',
    'https://www.reconnecttheatres.com/regal-theatre/',
    "Current-place curation: tourism=theatre; name=Reconnect Regal Theatre; visitor_place_type=Art Deco theatre and events venue; visit_score=60; opening_hours:description=Open for scheduled performances and events; the box office and enquiry desk operate limited weekly hours, so check the live programme before travelling; entrance_fee=Ticket prices vary by event; time_to_spend=120-180 minutes for a performance; accessibility=Contact the venue when booking for current access arrangements; description=Pair the surviving Art Deco frontage and auditorium with a live performance in Bathgate's best-known cultural landmark; website=https://www.reconnecttheatres.com/regal-theatre/.",
  ),
);

const oldKirk = featureById('nrhe:47770');
oldKirk.name = 'Bathgate Old Parish Kirk';
oldKirk.featureType = 'church';
oldKirk.address = 'Kirk Road, Bathgate';
oldKirk.shortDescription =
  "A quiet medieval church ruin and old burial ground whose site roots reach back to around 1220, offering a brief atmospheric stop on Bathgate's eastern edge.";
addTags(
  oldKirk,
  'current-context',
  'service-context-heritage',
  'service-context-visitor',
  auditTag,
);
replaceCurrentCurationSource(
  oldKirk,
  currentSource(
    'West Lothian Open Space Strategy: Bathgate Old Parish Kirk',
    'West Lothian Council',
    'visitor-audit:attraction:bathgate-old-parish-kirk',
    'https://www.westlothian.gov.uk/media/46269/Open-Space-Strategy-Appendix/pdf/Open_Space_Strategy_Appendix.pdf',
    "Current-place curation: tourism=attraction; name=Bathgate Old Parish Kirk; visitor_place_type=Medieval church ruin and burial ground; visit_score=47; opening_hours:description=Open-air historic site with no published visitor hours; visit in daylight and respect burials and services; entrance_fee=Free; time_to_spend=20-35 minutes; accessibility=Access is through a narrow roadside gate and the council audit records no formal paths or seating; description=Pause among the old stones and burial ground at one of Bathgate's oldest historic sites; website=https://www.westlothian.gov.uk/media/46269/Open-Space-Strategy-Appendix/pdf/Open_Space_Strategy_Appendix.pdf.",
    'local_authority',
  ),
);

pkg.project.visitorHighlights = [
  {
    rank: 1,
    featureId: bennie.id,
    name: bennie.name,
    reason: bennie.shortDescription,
    tagline: "Weavers' cottages",
    visitorScore: 66,
    openingTimes:
      'April-September 11:00-16:00; October-March 11:00-15:30. Volunteer opening can vary, so confirm before a special journey.',
    admission: 'Free.',
    freeAdmission: true,
    homeMapEligible: false,
    sourceName: 'Bennie Museum visitor information',
    sourceUrl: 'https://www.benniemuseum.org.uk/',
    verifiedInBoundaryAt: reviewedDate,
  },
  {
    rank: 2,
    featureId: regal.id,
    name: regal.name,
    reason: regal.shortDescription,
    tagline: 'Art Deco venue',
    visitorScore: 60,
    openingTimes: 'Open for scheduled performances and events; check the live programme.',
    admission: 'Ticket prices vary by event.',
    freeAdmission: false,
    homeMapEligible: false,
    sourceName: 'Reconnect Regal Theatre visitor information',
    sourceUrl: 'https://www.reconnecttheatres.com/regal-theatre/',
    verifiedInBoundaryAt: reviewedDate,
  },
  {
    rank: 3,
    featureId: oldKirk.id,
    name: oldKirk.name,
    reason: oldKirk.shortDescription,
    tagline: 'Medieval ruin',
    visitorScore: 47,
    openingTimes: 'Open-air site; visit in daylight and respect the burial ground.',
    admission: 'Free.',
    freeAdmission: true,
    homeMapEligible: false,
    sourceName: 'West Lothian Open Space Strategy',
    sourceUrl:
      'https://www.westlothian.gov.uk/media/46269/Open-Space-Strategy-Appendix/pdf/Open_Space_Strategy_Appendix.pdf',
    verifiedInBoundaryAt: reviewedDate,
  },
];

const historyTrail = featureById('visitor-context:bathgate-history-trail');
historyTrail.name = 'Bathgate History Trail';
historyTrail.featureType = 'walking_route';
historyTrail.shortDescription =
  'A compact self-guided loop linking 15 heritage plaques through the town centre, from weavers and hosiery to the Regal and Bennie Museum.';
historyTrail.address = 'Town centre start, Bathgate';
addTags(historyTrail, 'current-context', 'service-context-walk', 'visitor-context-trail', auditTag);
replaceCurrentCurationSource(
  historyTrail,
  currentSource(
    'Bathgate History Trail',
    'Visit West Lothian',
    'visitor-audit:trail:bathgate-history-trail',
    'https://www.visitwestlothian.co.uk/things-to-do/history-heritage/bathgate-history-trail/',
    "Current-place curation: route=heritage_trail; name=Bathgate History Trail; trail_type=Town heritage trail; visit_score=79; distance=Compact town-centre loop; time_to_spend=60-90 minutes; accessibility=Pavement-based town route with road crossings; entrance_fee=Free; description=Follow 15 plaques through Bathgate's weaving, industrial, civic and entertainment history; website=https://www.visitwestlothian.co.uk/things-to-do/history-heritage/bathgate-history-trail/; download_url=https://www.visitwestlothian.co.uk/media/3518/bathgate-history-trail-lo.pdf.",
  ),
);

const dnisi = updateFood(featureById('osm-community:node-8093619631'), {
  name: 'Dnisi Bathgate',
  score: 81,
  tagline: 'Best coffee & scones',
  description:
    'A polished independent cafe for artisan coffee, house-made scones, brunch and lunch, with a notably welcoming dog-friendly policy.',
  opening: 'Monday-Saturday 08:30-17:00; Sunday 10:00-16:00',
  price: '££',
  cuisine: 'coffee brunch lunch baking',
  website: 'https://dnisi.com/pages/bathgate',
  organisation: 'Dnisi',
  kind: 'cafe',
  address: '7 George Place, Bathgate, EH48 1PA',
  dogFriendly: true,
});

const cafeBar = updateFood(featureById('osm-community:way-460358425'), {
  name: 'CafeBar 1912',
  score: 79,
  tagline: 'Best all-round',
  description:
    'A versatile central stop covering coffee, lunch, dinner and drinks, with locally sourced dishes and live music on selected evenings.',
  opening: 'Sunday-Thursday 10:00-21:00; Friday 10:00-23:00; Saturday 09:30-late',
  price: '££',
  cuisine: 'cafe restaurant Scottish pub food',
  website: 'https://www.cafebar1912.org.uk/',
  organisation: 'CafeBar 1912',
  kind: 'restaurant',
  address: '2 South Bridge Street, Bathgate, EH48 1TJ',
});

const vim = updateFood(featureById('osm-community:node-9239060140'), {
  name: 'Vim & Vigour',
  score: 78,
  tagline: 'Sharing plates',
  description:
    'A small-plates restaurant and bar with a more occasion-led feel, well suited to a relaxed weekend meal and sharing boards.',
  opening:
    'Friday 12:00-23:00, kitchen to 20:00; Saturday 12:30-23:00, kitchen to 20:00; Sunday 12:30-21:00, kitchen to 19:00',
  price: '£££',
  cuisine: 'small plates tapas sharing boards',
  website: 'https://vimandvigour.restaurant/',
  organisation: 'Vim & Vigour',
  kind: 'restaurant',
  address: '28A Glasgow Road, Bathgate, EH48 2AG',
});

const elToro = updateFood(featureById('osm-community:node-6832316244'), {
  name: 'El Toro Gaucho',
  score: 76,
  tagline: 'Steak night',
  description:
    'An Argentine and South American grill specialising in steaks and generous evening meals near the town centre.',
  opening:
    'Monday 16:00-22:00; Tuesday closed; Wednesday-Friday 16:00-22:00; Saturday-Sunday 15:00-22:00',
  price: '£££',
  cuisine: 'Argentine steak grill South American',
  website: 'https://www.visitwestlothian.co.uk/food-drink/restaurants/el-toro-gaucho/',
  organisation: 'Visit West Lothian',
  kind: 'restaurant',
  address: '57 Hopetoun Street, Bathgate',
});

const neelam = updateFood(featureById('osm-community:way-460356765'), {
  name: 'Neelam',
  score: 73,
  tagline: 'Indian dinner',
  description:
    'A long-running central Indian restaurant with a broad dinner menu and clearly supported vegetarian and vegan choices.',
  opening: 'Monday 16:00-22:00; Tuesday closed; Wednesday-Sunday 16:00-22:00',
  price: '££',
  cuisine: 'Indian vegetarian vegan',
  website: 'https://www.neelamrestaurant.co.uk/',
  organisation: 'Neelam Restaurant',
  kind: 'restaurant',
  address: '4 Mid Street, Bathgate, EH48 1PR',
});

const coffeeClub = updateFood(featureById('osm-community:node-8093619618'), {
  name: 'The Coffee Club',
  score: 66,
  tagline: 'Easy cafe lunch',
  description:
    'A straightforward independent George Street cafe for breakfast, coffee and a light lunch close to the main shopping streets.',
  opening: 'Monday-Saturday 09:00-15:00; Sunday closed; confirm current hours',
  price: '£',
  cuisine: 'cafe breakfast lunch',
  website: 'https://www.restaurantji.co.uk/scotland/bathgate/the-coffee-club-/',
  organisation: 'Restaurantji',
  kind: 'cafe',
  address: '60 George Street, Bathgate',
  reliability: 'secondary',
});

const acredale = updateParking(featureById('osm-community:way-252930532'), {
  name: 'Acredale Car Park',
  capacity: 165,
  address: 'Acredale, Bathgate',
  description:
    'Large free public surface car park close to the town centre, with electric-vehicle charging available at separate charging tariffs.',
  pricingNote: 'General parking is free; EV charging has separate tariffs.',
});

const gardnersLane = updateParking(featureById('osm-community:way-266711457'), {
  name: 'Gardners Lane Car Park',
  capacity: 151,
  address: 'Gardners Lane, Bathgate',
  description: 'Large free public surface car park south-west of the town centre.',
  pricingNote: 'No general parking charge identified; observe entrance signs and stay limits.',
});

const gideonStreet = updateParking(featureById('osm-community:way-729110761'), {
  name: 'Gideon Street Car Park',
  capacity: 48,
  address: 'Gideon Street, Bathgate',
  description: 'Free public surface car park on the north side of the town centre.',
  pricingNote: 'No general parking charge identified; observe entrance signs and stay limits.',
});

const hopetounStreet = updateParking(featureById('osm-community:way-248061057'), {
  name: 'Hopetoun Street Car Park',
  capacity: 30,
  address: 'Hopetoun Street, Bathgate',
  description: 'Small free public surface car park close to the eastern town-centre shops.',
  pricingNote: 'No general parking charge identified; observe entrance signs and stay limits.',
});

const engineLaneToilets = updateToilets(featureById('osm-community:way-277546451'), {
  name: 'Engine Lane public toilets - Acredale Car Park',
  address: 'Acredale Car Park, Engine Lane, Bathgate',
  description: 'Public automatic conveniences in Acredale Car Park beside Engine Lane.',
  opening: 'Publicly available; check the facility notice for current access and charges',
  fee: 'Fee',
  wheelchair: 'unknown',
});

const partnershipToilets = updateToilets(featureById('osm-community:way-270477508'), {
  name: 'Jim Walker Partnership Centre toilets',
  address: 'Lindsay House, South Bridge Street, Bathgate, EH48 1TS',
  description: 'Public toilets inside the Jim Walker Partnership Centre on South Bridge Street.',
  opening: 'Available during the building and service opening hours',
  fee: 'Free',
  wheelchair: 'yes',
});

const kingStreetToilets = updateToilets(featureById('osm-community:node-1595571280'), {
  name: 'King Street public toilets - near Bathgate Station',
  address: 'King Street, Bathgate, EH48 1AZ',
  description:
    'Street-level public toilets on King Street, a short walk from Bathgate railway station.',
  opening: 'OpenStreetMap records 24-hour access; check the facility notice locally',
  fee: 'Fee',
  wheelchair: 'yes',
});

curationLibrary.projects[pkg.project.id] = {
  eat: [dnisi.id, cafeBar.id, vim.id, elToro.id, neelam.id, coffeeClub.id],
  trails: [historyTrail.id],
  picnic: [],
  parking: [acredale.id, gardnersLane.id, gideonStreet.id, hopetounStreet.id],
  toilets: [engineLaneToilets.id, partnershipToilets.id, kingStreetToilets.id],
};

for (const id of ['visitor-context:kirkton-park', 'visitor-context:bathgate-golf-club']) {
  const feature = pkg.features.find((candidate) => candidate.id === id);
  if (!feature) continue;
  addTags(feature, auditTag, 'visitor-audit-excluded', 'map-hidden');
  feature.reviewed = true;
  feature.updatedAt = reviewedAt;
  feature.reviewNotes =
    "Reviewed on 2026-08-07 and removed from Bathgate's ranked visitor highlights. It remains contextual source data but is not strong enough to be promoted as a leading town attraction.";
}

const activeBoundary = townStudyArea.localityBoundary;
const publishedFeatureIds = [
  ...(pkg.project.visitorHighlights ?? []).map((highlight) => highlight.featureId),
  ...Object.values(curationLibrary.projects[pkg.project.id]).flat(),
];
for (const featureId of new Set(publishedFeatureIds)) {
  const feature = pkg.features.find((candidate) => candidate.id === featureId);
  if (!feature || feature.geometry?.type !== 'Point') {
    throw new Error(`Bathgate public visitor feature is missing a point: ${featureId}`);
  }
  if (!booleanPointInPolygon(point(feature.geometry.coordinates), activeBoundary)) {
    throw new Error(
      `Bathgate public visitor feature falls outside the active boundary: ${featureId}`,
    );
  }
}

const audit = {
  projectId: pkg.project.id,
  reviewedAt,
  townRating: {
    previous: 1,
    rating: 1,
    rationale:
      'One star is retained. Bathgate offers a credible short local-history visit through the Bennie Museum, official one-hour history trail and active Art Deco Regal, but it does not have enough destination-scale attractions inside the NRS locality for two stars. Nearby landscape and prehistoric attractions were deliberately excluded.',
  },
  boundary: {
    active: 'Original NRS 2022 Bathgate locality S52000060, unchanged.',
    rule: 'All attraction, food and practical markers must fall inside the active locality polygon. The history-trail start marker is inside the town; nearby attractions beyond the polygon do not count towards Bathgate.',
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
      name: 'Kirkton Park and Bathgate Golf Club',
      reason:
        "Both remain useful local amenities and trail context, but neither is strong enough to pad Bathgate's leading attraction list.",
    },
    {
      name: 'Bathgate Castle mound',
      reason:
        'The official trail reaches the golf-club entrance plaque, but the archaeological remains do not provide a clear, accessible standalone visitor experience.',
    },
    {
      name: "Cairnpapple Hill, Beecraigs, Lin's Mill Aqueduct, Ravencraig and the Bathgate Hills",
      reason:
        'Outside the active Bathgate locality polygon and excluded from the town rating and planner.',
    },
    {
      name: 'Retail, school, residential, staff and customer-only car parks',
      reason:
        'Only named central public car parks with supported capacity information are published.',
    },
  ],
  practicalCorrections: {
    parking:
      'Four named central public car parks are published. The Regal rear car park is venue parking and is not presented as a general public car park.',
    toilets:
      'Generic OpenStreetMap toilet names were replaced with Engine Lane/Acredale, Jim Walker Partnership Centre and King Street/station location-led names. Xcite Bathgate was excluded because its point falls outside the active locality polygon.',
    picnic:
      'No defensible dedicated public picnic site was found inside the town boundary, so the category is intentionally empty.',
  },
  sourceUrls: pkg.project.townGuide.sourceUrls,
};

await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`);
await writeFile(curationPath, `${JSON.stringify(curationLibrary, null, 2)}\n`);
await writeFile(auditPath, `${JSON.stringify(audit, null, 2)}\n`);

console.log(
  `Updated Bathgate visitor audit: ${pkg.project.visitorHighlights.length} attractions, ${curationLibrary.projects[pkg.project.id].eat.length} food stops, ${curationLibrary.projects[pkg.project.id].trails.length} trail, ${curationLibrary.projects[pkg.project.id].parking.length} car parks, ${curationLibrary.projects[pkg.project.id].toilets.length} toilets and no invented picnic sites. Rating: 1 star.`,
);
