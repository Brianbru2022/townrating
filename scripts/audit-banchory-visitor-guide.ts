import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { HeritageFeature, ProjectPackage, VisitorHighlight } from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';

const projectId = 'banchory-scotland';
const reviewedDate = '2026-08-28';
const reviewedAt = '2026-08-28T23:45:00Z';
const projectPath = resolve('data/projects/banchory.json');
const plannerPath = resolve('data/aberdeen-north-visitor-planner-curation.json');
const dogPath = resolve('data/aberdeen-north-dog-access-curation.json');
const reportPath = resolve('data/review/banchory-full-visitor-audit-2026-08-28.json');
type F = HeritageFeature & Record<string, any>;
type P = ProjectPackage & { project: ProjectPackage['project'] & Record<string, any>; features: F[] };

const urls = {
  destination: 'https://visitabdn.com/places/banchory',
  museum: 'https://www.livelifeaberdeenshire.org.uk/museums/find-a-museum/banchory-museum/',
  museumRefurbishment: 'https://www.aberdeenshire.gov.uk/news/2023/jun/banchory-museum-prepares-to-welcome-back-visitors-following-completion-of-refurbishment',
  falls: 'https://visitabdn.com/places/banchory',
  treasure: 'https://www.treasuretrails.co.uk/products/things-to-do-banchory-aberdeenshire',
  councilRoutes: 'https://www.aberdeenshire.gov.uk/media/11471/banchory-webmap-sept14.pdf',
  councilTrail: 'https://www.aberdeenshire.gov.uk/roads-and-travel/transportation/cycling/commuter-routes',
  deesideWay: 'https://visitabdn.com/businesses/the-deeside-way',
  parking: 'https://www.aberdeenshire.gov.uk/roads-and-travel/car-parking/car-parks',
  toilets: 'https://www.aberdeenshire.gov.uk/local/public-toilets',
  parks: 'https://www.aberdeenshire.gov.uk/leisure-sport-and-culture/parks-and-open-spaces/parks-and-open-spaces/',
  openSpaceAudit: 'https://www.aberdeenshire.gov.uk/media/6084/banchory.pdf',
  birdhouse: 'https://longwalkco.com/',
  birdhouseDirectory: 'https://www.discoverbanchory.co.uk/things-to-do/food-and-drink/cafes-in-banchory/',
  ride: 'https://visitabdn.com/businesses/ride-coffee-house',
  tease: 'https://teasecoffeebar.co.uk/',
  jgRoss: 'https://www.jg-ross.co.uk/coffee-shops',
  scoltyCafe: 'https://www.duncansofbanchory.co.uk/pages/scolty-coffee-shop',
  couch: 'https://www.couchofamber.co.uk/',
  curious: 'https://curiousabout.co.uk/',
  mystery: 'https://www.mysteryguides.co.uk/',
  goQuest: 'https://goquestadventures.com/',
  dogCode: 'https://www.outdooraccess-scotland.scot/dog-owners',
};

const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as P;
const planner = JSON.parse(await readFile(plannerPath, 'utf8')) as any;
const dog = JSON.parse(await readFile(dogPath, 'utf8')) as any;

const scoreAssessment = (score: number) => {
  const result = { experienceDepth: Math.round(score * .3), distinctiveness: Math.round(score * .2), presentation: Math.round(score * .2), journeyWorth: Math.round(score * .15), accessAndReliability: Math.round(score * .1), evidenceConfidence: 0, visitability: 'full_visitor_experience' as const };
  result.evidenceConfidence = score - Object.values(result).filter((value) => typeof value === 'number').reduce((sum, value) => sum + value, 0);
  return result;
};
const foodAssessment = (score: number) => {
  const result = { foodAndDrinkQuality: Math.round(score * .29), daytimeRelevance: Math.round(score * .21), distinctiveness: Math.round(score * .15), consistency: Math.round(score * .14), visitorFit: Math.round(score * .11), evidenceConfidence: 0 };
  result.evidenceConfidence = score - Object.values(result).reduce((sum, value) => sum + value, 0);
  return result;
};
const source = (name: string, organisation: string, url: string, notes: string, reliability: any = 'official_non_statutory') => ({ sourceName: name, sourceOrganisation: organisation, sourceUrl: url, accessedAt: reviewedAt, reliability, licence: 'Source-linked editorial evidence; verify time-sensitive details before travel.', notes });
const make = (spec: Record<string, any>): F => {
  const editorialReview = spec.score ? {
    status: 'editorially_researched', category: spec.category, methodVersion: '2026-08-13-researched-visitor-value-v1', reviewedAt: reviewedDate,
    scoreRationale: spec.reason, evidenceUrls: spec.evidenceUrls,
    ...(spec.category === 'food' ? { foodAssessment: foodAssessment(spec.score) } : { attractionAssessment: scoreAssessment(spec.score) }),
  } : undefined;
  const details = spec.details ?? '';
  return {
    id: spec.id, projectId, name: spec.name, alternativeNames: [], countryCode: 'GB-SCT', region: 'Aberdeenshire', locality: 'Banchory', featureType: spec.featureType,
    significance: spec.significance ?? 'local', geometry: { type: 'Point', coordinates: spec.coordinates }, locationType: spec.locationType ?? 'exact', locationConfidence: spec.locationConfidence ?? 'high',
    dateBasis: 'unknown', dateConfidence: 'unknown', survival: 'substantially_intact', shortDescription: spec.description, fullDescription: spec.fullDescription,
    visitorWebsiteUrl: spec.website, attractionGuide: spec.guide, editorialReview,
    sourceRecords: spec.evidenceUrls.map((url: string, index: number) => source(index ? `${spec.name} supporting evidence` : spec.sourceName, index ? 'Supporting publisher' : spec.sourceOrganisation, url, `Current-place curation: visitor_place_type=${spec.placeType}; ${spec.score ? `visit_score=${spec.score};` : ''} ${details}; description=${spec.description}`, url.includes('historicenvironment.scot') ? 'official_statutory' : url.includes('aberdeenshire.gov.uk') ? 'local_authority' : 'official_non_statutory')),
    tags: spec.tags, createdAt: reviewedAt, updatedAt: reviewedAt, reviewed: true, evidenceScope: 'parish_evidence',
  } as F;
};
const addTag = (feature: F, tag: string) => { feature.tags = [...new Set([...(feature.tags ?? []), tag])]; };
const removeTag = (feature: F, tag: string) => { feature.tags = (feature.tags ?? []).filter((candidate: string) => candidate !== tag); };
const byId = (id: string) => { const value = pkg.features.find((feature) => feature.id === id); if (!value) throw new Error(`Missing imported Banchory feature ${id}`); return value; };
const dateFeature = (feature: F, text: string, earliest: number, latest: number, url: string, confidence: 'high' | 'medium' = 'high') => {
  feature.documentedDateText = text; feature.earliestPossibleYear = earliest; feature.latestPossibleYear = latest;
  feature.dateBasis = 'documented_date_range'; feature.dateConfidence = confidence; feature.datePrecision = earliest === latest ? 'exact_year' : 'period_range';
  feature.updatedAt = reviewedAt; addTag(feature, 'date-reviewed'); removeTag(feature, 'map-hidden');
  if (!feature.sourceRecords.some((record: any) => record.sourceUrl === url && record.notes?.includes('heat date'))) feature.sourceRecords.push(source(`${feature.name} historic-date evidence`, url.includes('historicenvironment.scot') ? 'Historic Environment Scotland' : 'Heatmap local HES review', url, `Construction or material-period evidence used for the heat date: ${text}. Administrative designation dates were not used.`, url.includes('historicenvironment.scot') ? 'official_statutory' : 'official_non_statutory'));
};
const hide = (feature: F, reason: string) => {
  addTag(feature, 'map-hidden'); addTag(feature, 'heritage-record-retained'); feature.updatedAt = reviewedAt;
  const notes = `Record retained in the Banchory project library but hidden from the heat map: ${reason}`;
  if (!feature.sourceRecords.some((record: any) => record.notes === notes)) feature.sourceRecords.push(source(`${feature.name} visibility review`, 'Heatmap editorial audit', feature.sourceRecords[0]?.sourceUrl ?? urls.destination, notes, 'secondary'));
};

// Complete construction dates for all locally imported HES listed designations.
for (const [id, text, earliest, latest, confidence] of [
  ['LB3254', 'Early 19th century, incorporating an 18th-century coaching inn', 1700, 1832, 'medium'],
  ['LB3255', 'Late 18th century', 1760, 1799, 'high'], ['LB3256', 'Late 18th century', 1760, 1799, 'high'],
  ['LB3257', 'Early Victorian', 1837, 1860, 'medium'], ['LB21856', 'Built 1824; additions and alterations 1930', 1824, 1930, 'high'],
  ['LB21861', 'Early 19th century', 1800, 1832, 'high'], ['LB21862', 'Circa 1830', 1830, 1830, 'high'],
  ['LB21863', 'Built 1879–1885', 1879, 1885, 'high'], ['LB21864', 'Built 1851', 1851, 1851, 'high'],
  ['LB21865', 'Built 1838', 1838, 1838, 'high'], ['LB21867', 'Early 19th century', 1800, 1832, 'high'],
  ['LB21869', '19th century', 1800, 1899, 'high'],
] as const) dateFeature(byId(`hes-listed-building:${id}`), text, earliest, latest, `https://portal.historicenvironment.scot/designation/${id}`, confidence);

// Buffer designations are preserved for reference, but do not become Banchory heat pins.
for (const feature of pkg.features.filter((candidate) => candidate.tags?.includes('town-selection-heritage-buffer'))) hide(feature, 'The designation lies in the 500-metre review buffer outside the official Banchory locality.');

// Apply conservative material periods from the locally supplied NRHE classification.
const nrhePeriods: Record<string, [string, number, number]> = {
  '36178': ['19th century (NRHE records 1850)', 1850, 1850], '36186': ['19th century', 1800, 1899], '36188': ['Prehistoric standing stone; possible Bronze-Age stone circle', -4000, -800],
  '36663': ['Early medieval', 410, 1066], '36667': ['Later prehistoric field system with prehistoric hut circles', -2500, 43],
  '36675': ['Early-medieval to 18th-century church and burial site', 410, 1799], '36690': ['Medieval', 1066, 1560], '36691': ['Bronze Age', -2500, -800],
  '79832': ['20th century', 1900, 1999], '179001': ['Post-medieval', 1560, 1899], '183123': ['20th century', 1900, 1999],
  '183127': ['19th- to 20th-century railway station', 1800, 1999], '183141': ['19th century', 1800, 1899], '187996': ['20th century', 1900, 1999],
  '191590': ['19th- to 20th-century railway halt', 1800, 1999], '229802': ['20th century', 1900, 1999], '266840': ['20th century', 1900, 1999],
  '308754': ['Golf course established 1905', 1905, 1905], '331408': ['First World War / early 20th century', 1914, 1918],
  '378636': ['20th century', 1900, 1999], '378638': ['20th century', 1900, 1999], '384640': ['19th century', 1800, 1899],
  '385194': ['20th century', 1900, 1999], '385876': ['20th century', 1900, 1999],
};
for (const [id, [text, earliest, latest]] of Object.entries(nrhePeriods)) {
  const feature = byId(`nrhe:${id}`); dateFeature(feature, text, earliest, latest, feature.sourceRecords[0]?.sourceUrl ?? `https://www.trove.scot/place/${id}`, 'medium');
}
for (const id of ['36178', '183141', '236803']) hide(byId(`nrhe:${id}`), 'This is the same structure already represented by a dated HES listed-building pin; its NRHE record remains intact as linked evidence.');
for (const feature of pkg.features.filter((candidate) => candidate.id.startsWith('nrhe:') && !candidate.documentedDateText)) hide(feature, 'The local NRHE record gives no defensible material period. It remains searchable in the library without an invented heat date.');

const attractionSpecs = [
  { id: 'curated-attraction:falls-of-feugh', name: 'Falls of Feugh', score: 82, coordinates: [-2.4929283, 57.0448827], featureType: 'natural_landmark', description: 'The Feugh cascades and bridge viewpoint, best known for seasonal salmon watching.', reason: 'A distinctive and dependable free outdoor viewpoint on Banchory’s southern visitor edge. It is separately published and contributes no points to the settlement-only score.', website: urls.falls, sourceName: 'Banchory destination guide', sourceOrganisation: 'VisitAberdeenshire', evidenceUrls: [urls.falls, urls.councilRoutes], placeType: 'Attraction', category: 'attraction', tags: ['curated-visitor', 'home-standalone-place', 'current-context'], details: 'opening=Open-air; admission=Free; best salmon periods=September-November and February-March', guide: { headline: 'Watch the Feugh race below the old bridge', parking: 'Bridge of Feugh car park has 25 free spaces, two oversized spaces and two disabled spaces; voluntary cashless contributions are invited.', toilets: 'A council public toilet opens 08:00–20:00 April–September and 08:00–18:00 October–March; accessibility features are not specified.', picnic: 'No formal picnic facility has been verified at the viewpoint.', foodNote: 'Use Banchory’s town-centre cafés; restaurant provision at the Falls is not treated as a café-led Eat stop.' } },
  { id: 'curated-attraction:banchory-museum', name: 'Banchory Museum', score: 73, coordinates: [-2.50375, 57.050593], featureType: 'museum', description: 'A free, fully accessible local museum covering Deeside archaeology, Scottish traditional music, wildlife and Victorian tourism.', reason: 'A current, free and family-friendly indoor anchor with staffed opening, accessible facilities and a coherent local collection, reduced for limited opening days and compact scale.', website: urls.museum, sourceName: 'Banchory Museum', sourceOrganisation: 'Live Life Aberdeenshire', evidenceUrls: [urls.museum, urls.museumRefurbishment], placeType: 'Attraction', category: 'attraction', tags: ['curated-visitor', 'home-standalone-place', 'current-context'], details: 'admission=Free; disabled_access=Throughout; opening=Mon 10:00-16:30, Tue/Thu 10:00-17:30, Sat 11:00-13:30; Wed/Fri/Sun closed', guide: { headline: 'Begin Royal Deeside with archaeology and music', parking: 'Bridge Street and Scott Skinner Square car parks are immediately nearby.', toilets: 'Use the Bellfield public toilet; museum visitor facilities should be confirmed with the venue.', picnic: 'No picnic provision is claimed at the museum.', foodNote: 'Birdhouse, J.G. Ross, Tease and Couch of Amber are short town-centre walks.' } },
  { id: 'curated-attraction:banchory-old-kirkyard', name: 'Banchory-Ternan Old Church and Kirkyard', score: 68, coordinates: [-2.48472, 57.05176], featureType: 'historic_site', description: 'A layered burial place with early-medieval cross slabs, a medieval church site, an 18th-century mausoleum and the 1829 watch house.', reason: 'A rich and fully dated cluster beside the eastern town, but interpretation and dependable interior access are limited and it remains an active place of remembrance.', website: urls.destination, sourceName: 'Banchory-Ternan Old Church and Graveyard', sourceOrganisation: 'Historic Environment Scotland / NRHE', evidenceUrls: [urls.destination, 'https://www.trove.scot/place/36675', 'https://portal.historicenvironment.scot/designation/LB21858', 'https://portal.historicenvironment.scot/designation/LB21859'], placeType: 'Attraction', category: 'attraction', tags: ['curated-visitor', 'home-standalone-place', 'historic-place-context'], details: 'opening=Outdoor churchyard; admission=Free; access=Respect graves and worship; no interior opening claimed', guide: { headline: 'Read Banchory’s history from cross slabs to watch house', parking: 'Use lawful town parking; the site has no independently verified dedicated visitor spaces.', toilets: 'Bellfield is the nearest verified council public toilet.', picnic: 'This is a burial ground, not a picnic site.', foodNote: 'Ride Coffee House and Scolty Coffee Shop are east of the town centre.' } },
];
const attractions = attractionSpecs.map((spec) => make(spec));
const trailSpecs = [
  { id: 'curated-trails:banchory-town-park-riverside-treasure-trail', name: 'Banchory – Town, Park & Riverside Treasure Trail', score: 76, coordinates: [-2.50044, 57.05057], featureType: 'walking_route', description: 'A purchasable 2-mile, roughly 2-hour circular clue trail from Bellfield through the centre, George V Park, the Dee and St Ternan’s graveyard.', reason: 'An exact, live Banchory product with distance, duration, start, circular format and dog policy; reduced because it is not wheelchair or pushchair accessible.', website: urls.treasure, sourceName: 'Banchory Treasure Hunt Trail', sourceOrganisation: 'TreasureTrails.co.uk', evidenceUrls: [urls.treasure], placeType: 'Trail', category: 'trail', tags: ['curated-visitor', 'visitor-context-trail', 'current-context'], details: 'distance=2 miles; duration=2 hours; start=Bellfield Car Park; circular=yes; dog_friendly=yes; wheelchair_access=no; pushchair_access=no; price=£9.99 at review' },
  { id: 'curated-trails:banchory-council-treasure-trail', name: 'Banchory Council Treasure Trail', score: 66, coordinates: [-2.50375, 57.050593], featureType: 'walking_route', description: 'A free council clue circuit taking about one hour, collected from and returned to Banchory Library.', reason: 'A second exact Banchory clue trail from the local authority, with a clear start and typical duration; reduced because the online page does not publish the full route or accessibility details.', website: urls.councilTrail, sourceName: 'Aberdeenshire treasure trails', sourceOrganisation: 'Aberdeenshire Council', evidenceUrls: [urls.councilTrail], placeType: 'Trail', category: 'trail', tags: ['curated-visitor', 'visitor-context-trail', 'current-context'], details: 'duration=About 1 hour; start=Banchory Library; format=Collect paper map; accessibility=Not published; price=Free' },
  { id: 'curated-trails:banchory-walking-routes', name: 'Banchory Walking Routes', score: 72, coordinates: [-2.50375, 57.050593], featureType: 'walking_route', description: 'Eight council-mapped walks from 0.9 to 5 km, including riverside, circular-path, woodland and Deeside Way options.', reason: 'A useful official route set with eight exact distances and approximate times; reduced because several routes extend beyond the strict locality and surfaces vary.', website: urls.councilRoutes, sourceName: 'Banchory walking map', sourceOrganisation: 'Aberdeenshire Council', evidenceUrls: [urls.councilRoutes], placeType: 'Trail', category: 'trail', tags: ['curated-visitor', 'visitor-context-trail', 'current-context'], details: 'routes=0.9-5 km; durations=10-60 minutes; route_link_checked=2026-08-28; accessibility=Mixed urban paths, steps, riverside and woodland surfaces' },
  { id: 'curated-trails:deeside-way-banchory', name: 'Deeside Way from Banchory', score: 77, coordinates: [-2.50044, 57.05057], featureType: 'walking_route', description: 'The 41-mile Deeside Way passes through Banchory; official sections are 7 miles from Drumoak and 13 miles onward to Aboyne.', reason: 'A nationally useful walking and cycling route with exact section distances and durations, but most of each stage lies outside Banchory and current fallen-tree notices must be checked.', website: urls.deesideWay, sourceName: 'The Deeside Way', sourceOrganisation: 'VisitAberdeenshire', evidenceUrls: [urls.deesideWay], placeType: 'Trail', category: 'trail', tags: ['curated-visitor', 'visitor-context-trail', 'current-context'], details: 'Drumoak-Banchory=7 miles/11 km, 2-2.5 hours; Banchory-Aboyne=13 miles/21 km, 4-5 hours; use=walk/cycle, some horse access; check current closures' },
];
const trails = trailSpecs.map((spec) => make(spec));
const foodSpecs = [
  ['birdhouse-cafe', 'Birdhouse Cafe', 74, [-2.5029365, 57.0512299], urls.birdhouse, 'Speciality coffee and bakes: Brunch, fresh bakes and light lunches from a local speciality-coffee roaster.', [urls.birdhouse, urls.birdhouseDirectory, 'https://birdhouse-cafe.placejoys.com/']],
  ['ride-coffee-house', 'Ride Coffee House', 73, [-2.4912737, 57.051208], urls.ride, 'Cyclist and dog favourite: Speciality coffee, cakes, soup, salads, quiche and toasted light lunches.', [urls.ride]],
  ['couch-of-amber', 'Couch of Amber', 72, [-2.5023117, 57.0506275], urls.couch, 'Coffee, art and music: Dog-welcoming coffee, sweet treats, breakfast and light lunch in a creative café.', [urls.couch]],
  ['tease-coffee-bar', 'Tease Coffee Bar', 68, [-2.5057104, 57.0516395], urls.tease, 'High Street coffee bar: Independent coffee, cake, soup, rolls and paninis in the town centre.', [urls.tease, urls.birdhouseDirectory, 'https://www.restaurantji.co.uk/scotland/banchory/tease-coffee-bar-/']],
  ['jg-ross-banchory', 'J.G. Ross Coffee Shop', 66, [-2.503656, 57.0512633], urls.jgRoss, 'North-east craft baker: Breakfast, brunch, lunch, fresh coffee and cake from the regional bakery.', [urls.jgRoss, 'https://www.banchorybusinesses.co.uk/jg_ross_bakers.html']],
] as const;
const foodHours: Record<string, string> = {
  'birdhouse-cafe': 'Tue/Thu/Fri/Sat 09:00–16:00, Wed 09:00–14:30, Sun 10:00–16:00, Mon closed in the current listing',
  'ride-coffee-house': '10:00–16:00 daily in the current destination/business listing',
  'couch-of-amber': 'Mon–Thu 09:00–18:00, Fri–Sat 09:00–22:00, Sun closed',
  'tease-coffee-bar': 'Mon–Sat 09:00–17:00, Sun 10:00–17:00 in the current secondary listing',
  'jg-ross-banchory': 'Mon–Sat 08:30–16:00, Sun closed',
};
const foods = foodSpecs.map(([slug, name, score, coordinates, website, description, evidenceUrls]) => make({ id: `curated-eat:banchory-${slug}`, name, score, coordinates, featureType: 'commercial_building', description, reason: `A current, cafe-led Banchory stop focused on coffee, cake or light daytime food; scored for visitor fit and source strength rather than full-meal dining.`, website, sourceName: name, sourceOrganisation: name, evidenceUrls, placeType: 'Eat', category: 'food', tags: ['curated-visitor', 'service-context-food', 'visitor-context-food', 'current-context'], details: `amenity=cafe; food_score=${score}; cuisine=coffee, cake and light lunches; opening_hours:description=${foodHours[slug]}; price_band=££; dog_friendly=${name === 'Ride Coffee House' || name === 'Couch of Amber' ? 'yes' : 'unconfirmed'}` }));

const parkingData = [
  ['bellfield-1', 'Bellfield 1 Car Park', [-2.5004424, 57.0505698], '87 pay-and-display spaces, seven disabled spaces, four lorry/bus spaces, six motorcycle spaces and ten covered cycle spaces. Charges apply Monday–Saturday 08:00–17:00; coin, card, RingGo or PayByPhone 985571.'],
  ['bellfield-2', 'Bellfield 2 Car Park', [-2.4999, 57.05025], '53 free spaces; no payment required. Disabled-space count, maximum stay and overnight rules are not published in the council table.'],
  ['bridge-street', 'Bridge Street Car Park', [-2.5059494, 57.0505074], '40 free spaces; no payment required. Disabled-space count, maximum stay and overnight rules are not published in the council table.'],
  ['scott-skinner-square', 'Scott Skinner Square Car Park', [-2.5040449, 57.0507156], '16 pay-and-display spaces and two disabled spaces. Charges apply Monday–Saturday 08:00–17:00; coin, card, RingGo or PayByPhone 985572.'],
  ['the-square', 'The Square Car Park', [-2.5064857, 57.0517947], '15 free spaces and two disabled spaces; voluntary cashless contributions use location code 985546.'],
  ['town-hall', 'Town Hall Car Park', [-2.5067863, 57.0514464], '17 free spaces and two disabled spaces; voluntary cashless contributions use location code 985547.'],
  ['bridge-of-feugh', 'Bridge of Feugh Car Park', [-2.4911659, 57.0454766], '25 free spaces, two oversized spaces and two disabled spaces; voluntary cashless contributions use location code 985534. This serves the separate Falls attraction outside the official locality.'],
] as const;
const parking = parkingData.map(([slug, name, coordinates, description]) => make({ id: `curated-parking:banchory-${slug}`, name, coordinates, featureType: 'parking', description, website: urls.parking, sourceName: 'Aberdeenshire car parks', sourceOrganisation: 'Aberdeenshire Council', evidenceUrls: [urls.parking], placeType: 'Parking', tags: ['service-context-parking', 'current-context'], details: description }));
const toilets = [
  make({ id: 'curated-toilets:banchory-bellfield', name: 'Bellfield Car Park Public Toilet', coordinates: [-2.50045, 57.05048], featureType: 'toilet', description: 'Council public toilet open 08:00–20:00 April–September and 08:00–18:00 October–March, with disabled access and baby changing.', website: urls.toilets, sourceName: 'Aberdeenshire public toilets', sourceOrganisation: 'Aberdeenshire Council', evidenceUrls: [urls.toilets], placeType: 'Public toilets', tags: ['service-context-toilets', 'current-context'], details: 'fee=Not published; disabled_access=yes; baby_changing=yes; Changing Places=no facility listed' }),
  make({ id: 'curated-toilets:banchory-bridge-of-feugh', name: 'Bridge of Feugh Public Toilet', coordinates: [-2.4912, 57.04545], featureType: 'toilet', description: 'Council public toilet open 08:00–20:00 April–September and 08:00–18:00 October–March; disabled access and baby changing are not specified.', website: urls.toilets, sourceName: 'Aberdeenshire public toilets', sourceOrganisation: 'Aberdeenshire Council', evidenceUrls: [urls.toilets], placeType: 'Public toilets', tags: ['service-context-toilets', 'current-context'], details: 'fee=Not published; disabled_access=Not specified; baby_changing=Not specified; serves separate Falls attraction outside locality' }),
];

const curated = [...attractions, ...trails, ...foods, ...parking, ...toilets];
pkg.features = [...pkg.features.filter((feature) => !feature.id.startsWith('curated-')), ...curated];

const highlights: VisitorHighlight[] = attractions.map((feature, index) => ({ rank: index + 1, featureId: feature.id, name: feature.name, reason: feature.editorialReview!.scoreRationale, tagline: index === 0 ? 'Salmon cascades at the visitor edge' : index === 1 ? 'Free archaeology and music museum' : 'Early-medieval to 19th-century kirkyard', visitorScore: attractionSpecs[index].score, timeToSpend: index === 0 ? '30–60 minutes' : '30–45 minutes', openingTimes: index === 1 ? 'Mon 10:00–16:30; Tue/Thu 10:00–17:30; Sat 11:00–13:30; closed Wed/Fri/Sun' : 'Open-air daylight visit', admission: 'Free', freeAdmission: true, visitorWebsiteUrl: feature.visitorWebsiteUrl, editorialReview: feature.editorialReview, sourceName: feature.sourceRecords[0].sourceName, sourceUrl: feature.visitorWebsiteUrl!, verifiedInBoundaryAt: reviewedDate }));
pkg.project.preferredBasemap = 'voyager';
pkg.project.visualIdentity = {
  theme: 'banchory-clock-tower-watercolour',
  badgeImage: '/town-guides/banchory-clock-tower-watercolour-guide-v1.png',
  badgeAlt: 'Watercolour view across Banchory’s granite townscape towards the clock tower and Deeside hills',
  heroImage: '/town-guides/banchory-clock-tower-watercolour-guide-v1.png',
  heroAlt: 'Ink-and-watercolour guide illustration of Banchory’s clock tower, granite buildings and garden terraces',
  heroObjectPosition: '57% 48%',
  motifs: ['Clock tower', 'Granite townscape', 'Garden terraces', 'Deeside hills'],
  primaryColour: '#294E4A',
  accentColour: '#B97832',
  backgroundColour: '#F2EBDD',
};
pkg.project.boundarySource = 'NRS 2022 Banchory locality boundary for settlement scoring, with a separate 500-metre heritage review buffer. Falls of Feugh remains a standalone See attraction and does not inflate the settlement score.';
pkg.project.boundaryConfidence = 'high';
pkg.project.touristAppeal = { score: 74, dogOwnerScore: 72, dogAccessScoreAdjustment: -2, rating: 0, label: 'Worth a Visit', summary: 'A well-served Deeside town with a free museum, a substantial dated historic layer, two clue trails, eight mapped local walks and a notably strong café scene.', dogAccessRating: 2, dogAccessSummary: 'Outdoor routes, the Falls and several cafés work well with dogs, but churchyard etiquette, roads, wildlife, mixed surfaces and incomplete policies at some cafés require planning.', methodVersion: '2026-08-28-strict-settlement-full-audit-v2', reviewedAt: reviewedDate, sourceUrls: Object.values(urls) };
pkg.project.visitorHighlights = highlights;
pkg.project.townGuide = { characterTag: 'Royal Deeside gateway, music and riverside paths', headline: 'A genuine visitor town, not just a base for nearby castles', intro: 'Banchory earns 74% from the settlement itself: a free museum, a broad dated heritage layer, two exact clue trails, useful local circuits and five café-led daytime stops. Falls of Feugh is shown in See but is explicitly excluded from the town score, as are Crathes Castle, Drum Castle, Scolty and Milton of Crathes.', bestFor: ['Local history and music', 'Clue trails', 'Riverside walking', 'Coffee and cake'], perfectFor: ['A half-day Deeside stop', 'A family clue trail', 'A café-led walking visit'], suggestedFirstVisit: { title: 'Museum, town and river', summary: 'Begin at the free museum, follow the historic High Street and kirkyard, then choose the 2-mile Treasure Trail or a shorter council circuit.' }, dontMiss: ['Banchory Museum', 'Banchory – Town, Park & Riverside Treasure Trail', 'Banchory-Ternan Old Church and Kirkyard', 'Falls of Feugh (separate attraction)'], suggestedTime: 'Half day; full day with a longer route or the Falls', visitorMood: 'Lively, practical and more substantial than a roadside gateway, with strong everyday amenities and an unusually usable route network. Seven parking entries and two council toilets are documented; no formal public picnic site was verified. Banchory Museum is fully accessible, while trail surfaces vary.', sourceUrls: Object.values(urls), lastReviewedAt: reviewedDate };

planner.projects[projectId] = { eat: foods.map((feature) => feature.id), trails: trails.map((feature) => feature.id), parking: parking.map((feature) => feature.id), toilets: toilets.map((feature) => feature.id), picnic: [] };
const dogRecord = (rating: number, status: string, label: string, summary: string, url: string) => ({ rating, status, label, summary, sourceName: 'Banchory dog-access audit', sourceUrl: url, reviewedAt: reviewedDate });
dog.reviewedAt = reviewedDate;
dog.projects[projectId] = {
  attraction: Object.fromEntries(attractions.map((feature) => [feature.id, dogRecord(feature.id.includes('falls') ? 3 : 2, feature.id.includes('falls') ? 'welcoming' : 'restricted', feature.id.includes('falls') ? 'Outdoor viewpoint' : feature.id.includes('museum') ? 'No indoor dog access claimed' : 'Respectful churchyard visit', feature.id.includes('falls') ? 'Dogs can accompany the outdoor viewpoint under close control around water, wildlife, traffic and other visitors.' : feature.id.includes('museum') ? 'Assistance-dog access follows venue law; no general indoor pet policy is claimed.' : 'Use a short lead, keep off graves and prevent fouling.', feature.id.includes('museum') ? urls.museum : urls.dogCode)])),
  trail: Object.fromEntries(trails.map((feature) => [feature.id, dogRecord(feature.id.includes('town-park-riverside') ? 3 : 2, feature.id.includes('town-park-riverside') ? 'welcoming' : 'restricted', feature.id.includes('town-park-riverside') ? 'Provider marks this trail dog friendly' : 'Mixed-route close control', 'Use a lead beside roads and reliable close control around wildlife, livestock and other path users.', feature.id.includes('town-park-riverside') ? urls.treasure : urls.dogCode)])),
  eat: Object.fromEntries(foods.map((feature) => [feature.id, dogRecord(feature.name === 'Ride Coffee House' || feature.name === 'Couch of Amber' ? 3 : 1, feature.name === 'Ride Coffee House' || feature.name === 'Couch of Amber' ? 'welcoming' : 'unconfirmed', feature.name === 'Ride Coffee House' || feature.name === 'Couch of Amber' ? 'Dogs explicitly welcomed' : 'Current operator policy not established', feature.name === 'Ride Coffee House' || feature.name === 'Couch of Amber' ? 'The current operator or destination page explicitly welcomes dogs.' : 'No reliable current dog policy was found; confirm before relying on indoor access.', feature.visitorWebsiteUrl!)])),
};

pkg.validation = validateFeatures(pkg.project, pkg.features);
const errors = pkg.validation.filter((entry: any) => entry.severity === 'error');
if (errors.length) throw new Error(errors.map((entry: any) => entry.message).join('; '));
const listed = pkg.features.filter((feature) => feature.tags.includes('hes-listed-building'));
const nrhe = pkg.features.filter((feature) => feature.id.startsWith('nrhe:'));
const visibleHistoric = pkg.features.filter((feature) => (feature.tags.includes('hes-listed-building') || feature.id.startsWith('nrhe:')) && !feature.tags.includes('map-hidden'));
const undated = visibleHistoric.filter((feature) => !feature.documentedDateText?.trim() || feature.earliestPossibleYear == null || feature.latestPossibleYear == null || feature.dateBasis === 'unknown');
if (undated.length) throw new Error(`Undated Banchory heat pins: ${undated.map((feature) => feature.id).join(', ')}`);

await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`);
await writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`);
await writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`);
await writeFile(reportPath, `${JSON.stringify({ reviewedAt, townScore: 74, dogOwnerScore: 72, dogAccessRating: 2, settlementMerit: { result: 'retain_on_town_map', rationale: 'Banchory clears 60 independently through its museum, historic townscape, two exact clue trails, local walking network and visitor services. Falls of Feugh contributes no settlement-score points.' }, categoryCounts: { see: highlights.length, eat: foods.length, trails: trails.length, picnic: 0, parking: parking.length, toilets: toilets.length, listedBuildingsImported: listed.length, nrheRecordsImported: nrhe.length, scheduledMonumentsInLocality: 0 }, heritageDateAudit: { localDatasets: ['HES Listed Buildings', 'HES Scheduled Monuments', 'HES Canmore/NRHE points'], listedImported: listed.length, nrheImported: nrhe.length, scheduledMonumentsIntersectingOfficialLocality: 0, visiblePins: visibleHistoric.length, dated: visibleHistoric.length - undated.length, undated: undated.map((feature) => feature.id), hiddenRetained: pkg.features.filter((feature) => feature.tags.includes('heritage-record-retained')).map((feature) => feature.id), dateRule: 'Construction or material-period dates only; never designation, entry or database-update dates.' }, trailProviderSearches: [{ provider: 'TreasureTrails.co.uk', result: 'Exact live Banchory Town, Park & Riverside product verified: 2 miles, about 2 hours, dog friendly, not wheelchair or pushchair accessible.' }, { provider: 'Aberdeenshire Council clue trail', result: 'Exact Banchory paper clue trail verified: starts and finishes at the library, about one hour.' }, { provider: 'Aberdeenshire Council walking routes', result: 'Eight exact Banchory routes verified, 0.9–5 km and about 10–60 minutes.' }, { provider: 'VisitAberdeenshire / Deeside Way', result: 'Banchory stages verified; current fallen-tree notices recorded.' }, { provider: 'Curious About', result: 'No exact Banchory walk established.' }, { provider: 'Mystery Guides', result: 'No exact Banchory product established.' }, { provider: 'Go Quest Adventures', result: 'No exact Banchory quest established.' }], eatAudit: { published: foods.map((feature) => ({ name: feature.name, score: foodSpecs.find((entry) => `curated-eat:banchory-${entry[0]}` === feature.id)?.[2], source: feature.visitorWebsiteUrl })), exclusionRule: 'Cafe, coffee-and-cake, bakery café and light-lunch led. Full-meal restaurants, hotel dining and out-of-boundary Crathes venues excluded.' }, parking: parking.map((feature) => ({ name: feature.name, detail: feature.shortDescription, source: feature.visitorWebsiteUrl })), toilets: toilets.map((feature) => ({ name: feature.name, detail: feature.shortDescription, source: feature.visitorWebsiteUrl })), picnic: { published: 0, result: 'No formal public picnic tables or serviced picnic site verified inside the Banchory locality. Parks and ordinary seating are retained as context, not mislabelled as picnic facilities.' }, boundaryExclusions: ['Crathes Castle and Milton of Crathes', 'Drum Castle', 'Scolty Forest and Scolty Hill', 'Buchanan Bistro at Woodend of Crathes', 'Mains of Drum', 'Bridge of Feugh as settlement score evidence'], verification: { heritagePinsDated: `${visibleHistoric.length - undated.length}/${visibleHistoric.length}`, undatedHistoricPins: undated.length, linkChecksRequiredAtReview: Object.values(urls) } }, null, 2)}\n`);
console.log(`Banchory audit complete: ${highlights.length} See, ${foods.length} Eat, ${trails.length} Trails, 0 Picnic, ${parking.length} Parking, ${toilets.length} Toilets; ${visibleHistoric.length - undated.length}/${visibleHistoric.length} visible heritage pins dated.`);
