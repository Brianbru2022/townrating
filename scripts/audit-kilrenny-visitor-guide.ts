import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { HeritageFeature, ProjectPackage, VisitorHighlight } from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';

const reviewedAt = '2026-08-25T20:30:00.000Z';
const reviewedDate = '2026-08-25';
const projectPath = resolve('data/projects/kilrenny.json');
const plannerPath = resolve('data/east-neuk-visitor-planner-curation.json');
const dogPath = resolve('data/east-neuk-dog-access-curation.json');
const project = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;

const officialConservationUrl = 'https://www.fife.gov.uk/planning/built-heritage-and-planning/conservation-areas';
const churchUrl = 'https://e-voice.org.uk/kilrenny/';
const hesChurchUrl = 'https://portal.historicenvironment.scot/designation/LB35975';
const walkUrl = 'https://www.walkfife.org/maps-routes/kilrenny-walking-loop/';
const outdoorCodeUrl = 'https://www.outdooraccess-scotland.scot/dog-owners';
const councilParkingUrl = 'https://www.fife.gov.uk/roads-travel-parking/parking-and-car-parks/car-park-list';
const councilToiletsUrl = 'https://www.fife.gov.uk/facilities/public-toilet/public-toilets';

function feature(id: string): HeritageFeature {
  const found = project.features.find((item) => item.id === id);
  if (!found) throw new Error(`Missing Kilrenny feature ${id}`);
  return found;
}

function source(sourceName: string, sourceOrganisation: string, sourceUrl: string, notes: string, reliability: 'official_statutory' | 'official_non_statutory' | 'local_authority' | 'secondary' = 'secondary') {
  return { sourceName, sourceOrganisation, sourceUrl, accessedAt: reviewedAt, licence: 'Source-linked editorial record; verify current visitor information before travel.', notes, reliability };
}

const church = feature('curated-attraction:kilrenny-1');
Object.assign(church, {
  name: 'Kilrenny Parish Church and Kirkyard',
  featureType: 'church',
  significance: 'national',
  documentedDateText: '15th-century tower; 16th-century spire; church rebuilt 1807–08',
  earliestPossibleYear: 1400,
  latestPossibleYear: 1499,
  datePrecision: 'Primary surviving component dated by HES',
  dateBasis: 'estimated_from_authoritative_source',
  dateConfidence: 'high',
  shortDescription: 'A layered church-and-kirkyard ensemble: medieval tower, 16th-century spire, 1807–08 nave and separately listed burial monuments.',
  fullDescription: 'Kilrenny’s landmark church preserves a 15th-century north-west tower and 16th-century spire beside the Gothick nave rebuilt in 1807–08. The surrounding kirkyard adds the Lumsdaine and Beaton burial enclosures, Scott of Balcomie mausoleum, historic walls and monuments; earlier carved-stone evidence points to a much older Christian focus in the village.',
  sourceRecords: [
    source('Historic Environment Scotland church designation', 'Historic Environment Scotland', hesChurchUrl, 'HES dates the tower to the 15th century, the spire to the 16th century, the rebuilt church to 1807-08 and the porch remodelling to 1932.', 'official_statutory'),
    source('East Fife Rural Parish – Kilrenny', 'East Fife Rural Parish', churchUrl, 'Current congregation page checked. Worship use is confirmed, but general visitor opening hours and a pet policy are not published.', 'official_non_statutory'),
  ],
  visitorWebsiteUrl: churchUrl,
  reviewed: true,
  updatedAt: reviewedAt,
  reviewNotes: 'Full Kilrenny visitor audit: church and kirkyard treated as one coherent visit; interior access and dog policy remain explicitly unconfirmed.',
  attractionGuide: {
    headline: 'A medieval tower above an unusually rich kirkyard',
    intro: 'Walk the exterior ensemble for the 15th-century tower, later Gothick nave and a concentrated group of carved burial monuments.',
    bestFor: ['Church architecture', 'Kirkyard monuments', 'Early Christian history', 'Quiet heritage stops'],
    parking: 'Use the small mapped parking area by Kilrenny Common. No capacity, tariff, payment method or formal visitor designation is published; do not obstruct residents or church access.',
    toilets: 'No public toilet is listed in Kilrenny by Fife Council. Nearby facilities in Anstruther and Cellardyke are not counted as Kilrenny facilities.',
    picnic: 'Two mapped picnic tables are available around Kilrenny Common, a short walk north of the church.',
    foodNote: 'No current café, pub or restaurant was verified within Kilrenny; plan food in a neighbouring settlement.',
    trails: [{ name: 'Kilrenny Walking Loop', summary: 'A mapped easy loop linking Anstruther shore, Kilrenny church, the Common and Cellardyke.', routeType: 'Easy circular walk', distance: '5.46 km', duration: 'About 1 hour 22 minutes', difficulty: 'Grade 2; mostly good surfaces with a gentle slope and road crossings.', externalUrl: walkUrl }],
    thingsToDo: [
      { name: 'Read the building phases', summary: 'Compare the medieval tower and 16th-century spire with the 1807–08 nave and 1932 porch.' },
      { name: 'Explore the kirkyard monuments', summary: 'Look for the Lumsdaine and Beaton enclosures and the Scott of Balcomie mausoleum.' },
      { name: 'Trace the earlier sacred landscape', summary: 'Use the carved-stone and church evidence to understand Kilrenny’s pre-medieval Christian story.' },
    ],
  },
});

const village = feature('curated-attraction:kilrenny-2');
Object.assign(village, {
  name: 'Kilrenny Conservation Village and Common',
  featureType: 'street',
  significance: 'local',
  documentedDateText: 'Royal-burgh townscape with buildings chiefly from the 17th–19th centuries',
  earliestPossibleYear: 1600,
  latestPossibleYear: 1899,
  datePrecision: 'Broad townscape development range',
  dateBasis: 'estimated_from_authoritative_source',
  dateConfidence: 'medium',
  shortDescription: 'A compact conservation-area circuit through Main Street, Kirkwynd, Routine Row and the open Common.',
  fullDescription: 'Kilrenny rewards a slow circuit rather than a checklist visit: traditional stone houses and cottages frame narrow lanes before the village opens onto the green Common and picnic area. The conservation appraisal identifies the street pattern, buildings, spaces, views and materials as the source of its special character.',
  sourceRecords: [
    source('Fife Council Kilrenny conservation-area evidence', 'Fife Council', officialConservationUrl, 'Official conservation-area appraisal route checked for history, townscape, streets, open spaces and listed buildings.', 'local_authority'),
    source('Walk Fife Kilrenny Walking Loop', 'Walk Fife', walkUrl, 'The published route enters by Main Street, passes the church, uses Kirkwynd and Common Road, circles the Common and returns through the village.', 'secondary'),
  ],
  visitorWebsiteUrl: walkUrl,
  reviewed: true,
  updatedAt: reviewedAt,
  reviewNotes: 'Published as the visitable conservation-village ensemble, distinct from the longer Trails route card.',
  attractionGuide: {
    headline: 'Stone lanes, listed cottages and a quiet village Common',
    intro: 'Take the compact lanes slowly and notice how the enclosed historic core opens into the greener northern edge.',
    bestFor: ['Historic streets', 'Architecture', 'Photography', 'A quiet stroll'],
    parking: 'The mapped Common parking area has no published capacity or tariff. Street parking is not promoted as a visitor facility.',
    toilets: 'No public toilet is listed in Kilrenny by Fife Council.',
    picnic: 'Two picnic tables are mapped at the Common.',
    foodNote: 'No current in-village Eat venue was verified.',
    trails: [{ name: 'Kilrenny Walking Loop', summary: 'Continue beyond the compact village circuit on Walk Fife’s signed and downloadable route.', routeType: 'Circular walking route', distance: '5.46 km', duration: 'About 1 hour 22 minutes', difficulty: 'Easy / Grade 2', externalUrl: walkUrl }],
    thingsToDo: [
      { name: 'Follow the old street pattern', summary: 'Link Main Street, Kirkwynd, Routine Row and Common Road.' },
      { name: 'Pause at the Common', summary: 'Use the green northern edge and picnic tables as the natural turning point.' },
      { name: 'Notice the listed details', summary: 'Look for crowsteps, pantiles, rubble walls, historic cottages and the burn footbridge.' },
    ],
  },
});

const parking = feature('osm-community:way-635445353');
Object.assign(parking, {
  name: 'Kilrenny Common Parking Area',
  shortDescription: 'A small mapped surface parking area by the Common. Capacity, charge, hours, payment methods and formal visitor status are not published.',
  reviewed: true,
  updatedAt: reviewedAt,
  reviewNotes: 'Retained as the only central mapped parking area. It is absent from Fife Council’s current car-park register and no Kilrenny facility was returned by the Parkopedia audit, so no spaces, price or payment claims are made.',
  sourceRecords: [
    ...parking.sourceRecords,
    source('Kilrenny parking audit', 'Fife Council and Parkopedia search review', councilParkingUrl, 'parking=surface; location=Kilrenny Common; capacity=Not published; price_display=Not published; payment_methods=Not published; opening_hours:description=Not published; council_register=No Kilrenny car park listed; parkopedia_result=No Kilrenny car park returned.', 'local_authority'),
  ],
  tags: [...new Set([...parking.tags, 'service-context-parking', 'visitor-context-parking'])],
});

for (const id of ['osm-community:way-1061859457', 'osm-community:way-1282026151']) {
  const item = feature(id);
  item.reviewed = true;
  item.updatedAt = reviewedAt;
  item.reviewNotes = 'Excluded from visitor parking: peripheral OSM geometry with no responsible-source confirmation as a public Kilrenny visitor car park.';
  item.tags = item.tags.filter((tag) => !['service-context-parking', 'visitor-context-parking'].includes(tag));
}

for (const [id, name] of [['osm-community:node-5994260871', 'Kilrenny Common North Picnic Table'], ['osm-community:node-5994260872', 'Kilrenny Common South Picnic Table']] as const) {
  const item = feature(id);
  item.name = name;
  item.shortDescription = 'A mapped picnic table on Kilrenny Common for a simple outdoor pause; no toilets or food outlet are attached.';
  item.reviewed = true;
  item.updatedAt = reviewedAt;
  item.tags = [...new Set([...item.tags, 'service-context-picnic', 'visitor-context-picnic'])];
}

const trail: HeritageFeature = {
  id: 'curated-trail:kilrenny-walking-loop', projectId: project.project.id, name: 'Kilrenny Walking Loop', alternativeNames: [], countryCode: 'GB-SCT', region: 'Fife', locality: 'Kilrenny', featureType: 'walking_route', significance: 'local',
  geometry: { type: 'Point', coordinates: [-2.68901, 56.23445] }, locationType: 'representative_point', locationConfidence: 'high', dateBasis: 'unknown', dateConfidence: 'unknown', survival: 'substantially_intact',
  shortDescription: 'Walk Fife’s mapped 5.46 km easy loop links Anstruther shore, Kilrenny church, Kirkwynd, the Common and Cellardyke.',
  sourceRecords: [source('Walk Fife Kilrenny Walking Loop', 'Walk Fife', walkUrl, 'Current-place curation: visitor_place_type=Walking route; trail_score=78; trail_type=Easy circular walk; distance=5.46 km; time_to_spend=1 hour 22 minutes; accessibility=Grade 2, generally good surfaces, gentle slope and road crossings; entrance_fee=Free; downloadable=GPX and KML; description=Mapped coast-and-country circuit through Kilrenny.', 'secondary')],
  licence: 'Source-linked editorial record; route copyright remains with its publisher.', tags: ['service-context-trail', 'visitor-context-trail', 'current-context'], createdAt: reviewedAt, updatedAt: reviewedAt, reviewed: true, evidenceScope: 'parish_evidence', visitorWebsiteUrl: walkUrl,
  editorialReview: { status: 'editorially_researched', category: 'trail', methodVersion: '2026-08-13-researched-visitor-value-v1', reviewedAt: reviewedDate, scoreRationale: 'A usable mapped circular route with GPX/KML downloads, clear distance and duration, and direct coverage of Kilrenny’s church and Common.', evidenceUrls: [walkUrl] },
};
project.features = project.features.filter((item) => item.id !== trail.id).concat(trail);

const highlights: VisitorHighlight[] = [
  { rank: 1, featureId: church.id, name: church.name, reason: 'Kilrenny’s strongest visitor experience combines a medieval tower, later Gothick nave and an unusually concentrated group of listed kirkyard monuments.', visitorScore: 77, tagline: 'Medieval tower and monumental kirkyard', timeToSpend: '35–60 minutes', openingTimes: 'Kirkyard and exterior in daylight; church interior access is not published, so attend a listed service or check directly.', admission: 'Free exterior and kirkyard visit.', freeAdmission: true, visitorWebsiteUrl: churchUrl, sourceName: 'Historic Environment Scotland and East Fife Rural Parish', sourceUrl: hesChurchUrl, verifiedInBoundaryAt: reviewedDate, editorialReview: { status: 'editorially_researched', category: 'attraction', methodVersion: '2026-08-13-researched-visitor-value-v1', reviewedAt: reviewedDate, scoreRationale: 'A coherent, visibly layered church-and-kirkyard visit with nationally recorded components, strong architectural presentation and reliable exterior access, reduced for uncertain interior access.', evidenceUrls: [hesChurchUrl, churchUrl], attractionAssessment: { experienceDepth: 24, distinctiveness: 17, presentation: 17, journeyWorth: 10, accessAndReliability: 4, evidenceConfidence: 5, visitability: 'full_visitor_experience' } } },
  { rank: 2, featureId: village.id, name: village.name, reason: 'A short, coherent conservation-area circuit with traditional stone streets, listed cottages, burn crossings and the open village Common.', visitorScore: 64, tagline: 'Historic lanes and village Common', timeToSpend: '30–50 minutes', openingTimes: 'Public streets and Common; visit in daylight.', admission: 'Free.', freeAdmission: true, visitorWebsiteUrl: walkUrl, sourceName: 'Fife Council conservation-area evidence and Walk Fife', sourceUrl: officialConservationUrl, verifiedInBoundaryAt: reviewedDate, editorialReview: { status: 'editorially_researched', category: 'attraction', methodVersion: '2026-08-13-researched-visitor-value-v1', reviewedAt: reviewedDate, scoreRationale: 'A pleasant and coherent historic townscape that rewards a short stop, but lacks the depth, interpretation and visitor facilities of a stronger destination.', evidenceUrls: [officialConservationUrl, walkUrl], attractionAssessment: { experienceDepth: 18, distinctiveness: 13, presentation: 14, journeyWorth: 9, accessAndReliability: 6, evidenceConfidence: 4, visitability: 'full_visitor_experience' } } },
];

project.project.visitorHighlights = highlights;
project.project.touristAppeal = {
  score: 62, dogOwnerScore: 61, dogAccessScoreAdjustment: -1, rating: 0, label: 'Notable Stop',
  summary: 'A notably intact small East Neuk burgh whose church, monumental kirkyard, stone lanes and Common justify a focused heritage stop, but with little commercial or practical visitor infrastructure.',
  dogAccessRating: 2,
  dogAccessSummary: 'Good for a controlled outdoor walk and the Common, but the church interior dog policy is unconfirmed and there are no verified dog-friendly food stops or public toilets in the village.',
};
project.project.townGuide = {
  characterTag: 'Quiet historic inland burgh',
  headline: 'A medieval church, old stone lanes and a green village edge',
  intro: 'Kilrenny is best approached as one concentrated heritage walk: start with the layered parish church and monumental kirkyard, thread through the conservation-area lanes, then pause on the Common. The village is rewarding because it is quiet and coherent, not because it has a long attractions list.',
  bestFor: ['Church architecture', 'Kirkyard monuments', 'Historic lanes', 'A quiet walk'],
  perfectFor: ['A focused 1–2 hour heritage stop', 'Visitors who value intact small settlements over busy attractions'],
  suggestedFirstVisit: { title: 'Start with Kilrenny Parish Church and Kirkyard', summary: 'Read the medieval tower and later nave, explore the listed monuments, then continue through Kirkwynd to the Common.' },
  dontMiss: ['Kilrenny Parish Church and Kirkyard', 'Kilrenny Conservation Village and Common', 'Kilrenny Walking Loop'],
  suggestedTime: '1–2 hours; about 2½ hours with the full walking loop',
  visitorMood: 'A restrained but worthwhile heritage stop: the church-and-kirkyard ensemble is the anchor, while the lanes and Common add atmosphere rather than a full day of attractions.',
  sourceUrls: [officialConservationUrl, hesChurchUrl, churchUrl, walkUrl, councilParkingUrl, councilToiletsUrl, outdoorCodeUrl],
  lastReviewedAt: reviewedDate,
};
project.project.visualIdentity = { theme: 'east-neuk-church', badgeImage: '/town-guides/kilrenny-parish-church-watercolour-guide.png', badgeAlt: 'Watercolour illustration of Kilrenny Parish Church seen from inside the historic kirkyard wall', heroImage: '/town-guides/kilrenny-parish-church-watercolour-guide.png', heroAlt: 'Watercolour illustration of Kilrenny Parish Church seen from inside the historic kirkyard wall', heroObjectPosition: '50% 52%', motifs: ['Parish church', 'Historic kirkyard', 'Stone village', 'East Neuk landscape'], primaryColour: '#17464A', accentColour: '#B27713', backgroundColour: '#EAF2F0' };

const planner = JSON.parse(await readFile(plannerPath, 'utf8')) as { projects: Record<string, Record<string, string[]>> };
planner.projects[project.project.id] = { eat: [], trails: [trail.id], parking: [parking.id], toilets: [], picnic: ['osm-community:node-5994260871', 'osm-community:node-5994260872'] };
await writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`, 'utf8');

const dog = JSON.parse(await readFile(dogPath, 'utf8')) as { reviewedAt: string; projects: Record<string, { attraction?: Record<string, unknown>; eat?: Record<string, unknown> }> };
dog.reviewedAt = reviewedDate;
dog.projects[project.project.id] = { attraction: {
  [church.id]: { rating: 0, status: 'unconfirmed', label: 'Church pet policy not published', summary: 'The kirkyard can be experienced outdoors, but a current pet policy for the church interior is not published by East Fife Rural Parish. Keep dogs under close control around graves and check directly before relying on indoor access.', sourceName: 'East Fife Rural Parish and Scottish Outdoor Access Code review', sourceUrl: churchUrl, reviewedAt: reviewedDate },
  [village.id]: { rating: 3, status: 'welcoming', label: 'Outdoor village circuit', summary: 'The experience is on public streets, paths and the Common. Dogs can accompany the walk under responsible-access rules: keep them in sight and under control, use a lead when needed and clear waste.', sourceName: 'Walk Fife route and Scottish Outdoor Access Code', sourceUrl: outdoorCodeUrl, reviewedAt: reviewedDate },
  [trail.id]: { rating: 2, status: 'restricted', label: 'Dog-suitable with road care', summary: 'The route is an outdoor circuit, but includes road crossings, minor roads and a coastal section. Keep dogs under close control and use a lead beside traffic, livestock or other people.', sourceName: 'Walk Fife route and Scottish Outdoor Access Code', sourceUrl: outdoorCodeUrl, reviewedAt: reviewedDate },
} };
await writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`, 'utf8');

project.validation = validateFeatures(project.project, project.features);
const errors = project.validation.filter((item) => item.severity === 'error');
if (errors.length) throw new Error(`Kilrenny audit introduced ${errors.length} validation errors: ${errors.map((item) => item.message).join('; ')}`);
await writeFile(projectPath, `${JSON.stringify(project, null, 2)}\n`, 'utf8');
await writeFile(resolve('data/review/kilrenny-full-visitor-audit-2026-08-25.json'), `${JSON.stringify({ reviewedAt, townScore: 62, dogOwnerScore: 61, publicationRule: 'visitor score > 60', attractions: highlights.map(({ name, visitorScore }) => ({ name, score: visitorScore, published: true })), trail: { name: trail.name, score: 78, distance: '5.46 km', duration: '1 hour 22 minutes' }, facilities: { eat: [], parking: [{ name: parking.name, capacity: 'not published', pricing: 'not published', payment: 'not published', parkopedia: 'no Kilrenny result' }], toilets: [], picnic: ['Kilrenny Common North Picnic Table', 'Kilrenny Common South Picnic Table'] }, dogAudit: { church: 'unconfirmed', village: '3 paws', trail: '2 paws' }, exclusions: ['No current in-village Eat venue verified', 'No Fife Council public toilet listed', 'Two peripheral OSM parking polygons excluded', 'Skeith Stone retained as heritage evidence but not promoted above the >60 visitor-experience threshold'] }, null, 2)}\n`, 'utf8');
console.log('Kilrenny audit complete: 2 attractions, 1 trail, 1 cautious parking record, 2 picnic tables, no Eats or public toilets.');
