import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { EditorialRecordReview, FoodEditorialAssessment, HeritageFeature, ProjectPackage, SourceRecord, VisitorHighlight } from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';

const projectPath = resolve('data/projects/crail.json');
const plannerPath = resolve('data/east-neuk-visitor-planner-curation.json');
const dogPath = resolve('data/crail-dog-access-curation.json');
const reviewedAt = '2026-08-25';
const updatedAt = `${reviewedAt}T18:30:00.000Z`;
const methodVersion = '2026-08-13-researched-visitor-value-v1';

interface FoodSeed {
  id: string;
  name: string;
  point?: [number, number];
  type: string;
  score: number;
  priceBand: '£' | '££' | '£££';
  opening: string;
  style: string;
  description: string;
  sourceUrl: string;
  dog?: { rating: 0 | 1 | 2 | 3; status: 'unconfirmed' | 'restricted' | 'welcoming'; label: string; summary: string; sourceUrl: string };
}

const foods: FoodSeed[] = [
  { id: 'curated-food:crail-shoregate', name: 'The Shoregate', point: [-2.6286985, 56.2589111], type: 'restaurant', score: 88, priceBand: '£££', opening: 'Wednesday-Sunday: lunch 12:30-15:30; dinner 18:00-20:30.', style: 'Modern Scottish dining and traditional pub', description: 'Best special meal. Award-winning modern Scottish cooking with a traditional bar in the historic village centre.', sourceUrl: 'https://theshoregate.com/', dog: { rating: 2, status: 'restricted', label: 'Dogs welcome in the bar', summary: 'Dogs are welcome in the Shoregate bar, but pets are not accepted in the dining room, so book the appropriate area.', sourceUrl: 'https://www.crail.info/eat-drink' } },
  { id: 'osm-community:node-7657404154', name: 'Crail Harbour Gallery and Tearoom', type: 'cafe', score: 84, priceBand: '££', opening: 'Open daily from approximately 10:00; operator advises checking short January closure.', style: 'Coffee, cakes and light lunches', description: 'Harbour coffee and art. A restored 17th-century fisherman’s cottage with local art, coffee, cakes, light lunches and a sea-view courtyard.', sourceUrl: 'https://www.crailharbourgallery.co.uk/' },
  { id: 'curated-food:crail-golf-hotel', name: 'The Golf Hotel', point: [-2.6264823, 56.2606104], type: 'restaurant', score: 82, priceBand: '££', opening: 'Food daily 12:00-20:00; breakfast for non-residents 08:00-10:30; seasonal variation.', style: 'Scottish pub food, seafood and breakfast', description: 'Best all-day choice. Locally sourced pub meals, seafood, breakfast and a garden restaurant in the centre of Crail.', sourceUrl: 'https://www.thegolfhotelcrail.com/restaurant', dog: { rating: 2, status: 'restricted', label: 'Dogs welcome in bar and garden', summary: 'The bar and beer garden welcome dogs; the main restaurant dog policy is not confirmed.', sourceUrl: 'https://www.crailposthouse.co.uk/guest-info' } },
  { id: 'osm-community:node-5902078913', name: 'Balcomie Links Hotel', type: 'restaurant', score: 78, priceBand: '££', opening: 'Restaurant service is published by the operator; telephone booking is recommended.', style: 'Freshly cooked Scottish pub food', description: 'Relaxed pub dinner. Freshly cooked pub classics, local seafood and daily specials at the north side of the village.', sourceUrl: 'https://www.balcomielinkshotel.com/eat-balcomielinkshotel' },
  { id: 'osm-community:way-225526906', name: 'Crail Fishbar and Café', type: 'restaurant', score: 76, priceBand: '£', opening: 'Wednesday-Thursday and Sunday 16:00-20:00; Friday-Saturday 16:00-21:00.', style: 'Fish and chips and takeaway', description: 'Classic fish supper. A popular evening fish-and-chip stop with takeaway and limited cafe service.', sourceUrl: 'https://www.tripadvisor.co.uk/Restaurant_Review-g551745-d4578430-Reviews-Crail_Fish_Bar_Cafe-Crail_Fife_Scotland.html' },
];

function source(name: string, organisation: string, url: string, notes: string, reliability: SourceRecord['reliability'] = 'secondary'): SourceRecord {
  return { sourceName: name, sourceOrganisation: organisation, sourceUrl: url, accessedAt: updatedAt, licence: 'Source-linked editorial record; verify current operator information before travel.', notes, reliability };
}

function foodAssessment(score: number): FoodEditorialAssessment {
  let remaining = score;
  const take = (maximum: number) => { const value = Math.min(maximum, remaining); remaining -= value; return value; };
  return { foodAndDrinkQuality: take(30), daytimeRelevance: take(20), distinctiveness: take(15), consistency: take(15), visitorFit: take(10), evidenceConfidence: take(10) };
}

function foodReview(seed: FoodSeed): EditorialRecordReview {
  return { status: 'editorially_researched', category: 'food', methodVersion, reviewedAt, scoreRationale: seed.description, evidenceUrls: [seed.sourceUrl], foodAssessment: foodAssessment(seed.score) };
}

function baseFeature(id: string, name: string, point: [number, number], type: string): HeritageFeature {
  return { id, projectId: 'crail-scotland', name, alternativeNames: [], countryCode: 'GB-SCT', region: 'Fife', locality: 'Crail', featureType: type, geometry: { type: 'Point', coordinates: point }, locationType: 'exact', locationConfidence: 'high', dateBasis: 'unknown', dateConfidence: 'unknown', significance: 'local', survival: 'substantially_intact', sourceRecords: [], tags: [], createdAt: updatedAt, updatedAt, reviewed: true, evidenceScope: 'parish_evidence' };
}

const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
const byId = new Map(pkg.features.map((feature) => [feature.id, feature]));
for (const seed of foods) {
  let feature = byId.get(seed.id);
  if (!feature) {
    if (!seed.point) throw new Error(`Missing point for ${seed.name}.`);
    feature = baseFeature(seed.id, seed.name, seed.point, seed.type);
    pkg.features.push(feature);
    byId.set(seed.id, feature);
  }
  feature.name = seed.name;
  feature.featureType = seed.type;
  feature.shortDescription = seed.description;
  feature.visitorWebsiteUrl = seed.sourceUrl;
  feature.editorialReview = foodReview(seed);
  feature.tags = [...new Set([...feature.tags, 'service-context-food', 'current-context'])];
  feature.sourceRecords.push(source('Researched Crail food curation', seed.name, seed.sourceUrl, `Current daytime food curation: amenity=restaurant; visit_score=${seed.score}; price_band=${seed.priceBand}; food_style=${seed.style}; opening_hours:description=${seed.opening}; description=${seed.description}`));
  feature.updatedAt = updatedAt;
}

function curateCurrent(id: string, name: string, notes: string, url: string, tag: string): void {
  const feature = byId.get(id);
  if (!feature) throw new Error(`Missing Crail current-place feature ${id}.`);
  feature.name = name;
  feature.tags = [...new Set([...feature.tags, tag])];
  feature.sourceRecords.push(source('Crail visitor-facility curation', 'Fife Council', url, `Current-place curation: ${notes}`, 'local_authority'));
  feature.updatedAt = updatedAt;
  feature.reviewed = true;
}

curateCurrent('osm-community:way-1367414238', 'Nethergate Car Park', 'amenity=parking; operator=Fife Council; parking=surface; capacity=15; fee=no; price_display=Free; payment_required=no; payment_methods=Not required.', 'https://www.fife.gov.uk/facilities/car-park/nethergate-car-park%2C-crail', 'service-context-parking');
curateCurrent('osm-community:way-306292353', 'Marketgate South Car Park', 'amenity=parking; operator=Fife Council; parking=street_side; capacity=19; capacity:disabled=2; capacity:charging=1; fee=unknown; price_display=Not published; payment_required=unknown; payment_methods=Not published.', 'https://www.fife.gov.uk/__data/assets/file/0023/41639/Fife-Council-EV-Strategy-Executive-Summary-10-February-2025.pdf', 'service-context-parking');
curateCurrent('osm-community:way-1367414235', 'Marketgate on-street parking', 'amenity=parking; operator=Fife Council; parking=street_side; capacity=Not published; fee=unknown; price_display=Not published; payment_required=unknown; payment_methods=Not published.', 'https://www.fife.gov.uk/roads-travel-parking/parking-and-car-parks/car-park-list', 'service-context-parking');
curateCurrent('osm-community:way-1479050408', 'Crail Harbour parking area', 'amenity=parking; parking=surface; capacity=Unmarked; fee=unknown; price_display=Not published; payment_required=unknown; payment_methods=Not published.', 'https://www.fife.gov.uk/facilities/harbours/crail-harbour', 'service-context-parking');
curateCurrent('osm-community:way-1367414236', 'Westgate parking area', 'amenity=parking; parking=surface; capacity=Not published; fee=unknown; price_display=Not published; payment_required=unknown; payment_methods=Not published.', 'https://www.fife.gov.uk/roads-travel-parking/parking-and-car-parks/car-park-list', 'service-context-parking');

curateCurrent('osm-community:node-13568340723', 'Crail Harbour Public Toilets', 'amenity=toilets; opening_hours:description=Daily 09:00-17:00; closed 25-26 December and 1-2 January; winter frost closures possible; fee=no; price_display=Free; accessibility=Male and female WCs.', 'https://www.fife.gov.uk/facilities/public-toilet/crail-harbour-public-toilets', 'service-context-toilets');
curateCurrent('osm-community:way-267283087', 'Crail Westgate Public Toilets', 'amenity=toilets; opening_hours:description=Daily 09:00-17:00; closed 25-26 December and 1-2 January; fee=yes; price_display=30p; accessibility=Accessible toilet, baby changing, level access and RADAR key facility.', 'https://www.fife.gov.uk/facilities/public-toilet/crail-westgate-public-toilets', 'service-context-toilets');

const coastal = byId.get('curated-trail:crail-fife-coastal-path');
if (!coastal) throw new Error('Missing Crail coastal path feature.');
coastal.tags = [...new Set([...coastal.tags, 'service-context-trail'])];
coastal.visitorWebsiteUrl = 'https://fifecoastandcountrysidetrust.co.uk/walks/fife-coastal-path/';
coastal.sourceRecords.push(source('Fife Coastal Path', 'Fife Coast and Countryside Trust', coastal.visitorWebsiteUrl, 'Current-place curation: visitor_place_type=Walking route; trail_score=84; trail_type=long-distance coastal path; distance=Choose an eastbound or westbound section from Crail; access=public; description=Waymarked coastal walking through Crail harbour and shore.', 'official_non_statutory'));

const heritageWalk = baseFeature('curated-trail:crail-heritage-walk', 'Crail Heritage Walk', [-2.62598, 56.26118], 'walking_route');
heritageWalk.shortDescription = 'A self-guided 27-stop route from Crail Museum through the Tolbooth, church, castle site, harbour, Hen’s Ladder and historic streets.';
heritageWalk.visitorWebsiteUrl = 'https://www.crailmuseum.uk/home/map';
heritageWalk.tags = ['service-context-trail', 'visitor-context-trail', 'current-context'];
heritageWalk.sourceRecords = [source('Crail Heritage Walk map', 'Crail Museum and Heritage Centre', heritageWalk.visitorWebsiteUrl, 'Current-place curation: visitor_place_type=Heritage trail; trail_score=86; trail_type=self-guided heritage walk; distance=27 stops around central Crail; duration=1.5-2.5 hours; access=public streets and paths; description=Detailed town history route with an online map.', 'secondary')];
heritageWalk.editorialReview = { status: 'editorially_researched', category: 'trail', methodVersion, reviewedAt, scoreRationale: 'A detailed, locally researched 27-stop route with a usable online map and strong coverage of the historic burgh.', evidenceUrls: [heritageWalk.visitorWebsiteUrl] };
pkg.features.push(heritageWalk);
byId.set(heritageWalk.id, heritageWalk);

const harbourGallery = byId.get('osm-community:node-7657404154');
if (!harbourGallery) throw new Error('Missing Crail Harbour Gallery feature.');
harbourGallery.tags = [...new Set([...harbourGallery.tags, 'service-context-art'])];
const artHighlight: VisitorHighlight = {
  rank: 4, featureId: harbourGallery.id, name: 'Crail Harbour Gallery', tagline: 'Local art above the harbour',
  reason: 'A restored 17th-century fisherman’s cottage combining a working gallery of locally influenced art with one of Crail’s best sea-view interiors and courtyards.',
  visitorScore: 78, timeToSpend: '30-60 minutes', openingTimes: 'Open daily; operator advises checking the short January closure.', admission: 'Free gallery visit; food and purchases extra.', freeAdmission: true,
  sourceName: 'Crail Harbour Gallery', sourceUrl: 'https://www.crailharbourgallery.co.uk/', visitorWebsiteUrl: 'https://www.crailharbourgallery.co.uk/', verifiedInBoundaryAt: reviewedAt,
  editorialReview: { status: 'editorially_researched', category: 'attraction', methodVersion, reviewedAt, scoreRationale: 'A genuine working local gallery in a distinctive historic harbour building, with dependable operator visitor information.', evidenceUrls: ['https://www.crailharbourgallery.co.uk/'], attractionAssessment: { experienceDepth: 22, distinctiveness: 17, presentation: 16, journeyWorth: 10, accessAndReliability: 8, evidenceConfidence: 5, visitability: 'full_visitor_experience' } },
};
pkg.project.visitorHighlights = [...(pkg.project.visitorHighlights ?? []).filter((item) => item.featureId !== artHighlight.featureId), artHighlight].sort((a, b) => a.rank - b.rank);
const pottery = byId.get('curated-attraction:crail-3');
if (pottery) pottery.tags = [...new Set([...pottery.tags, 'service-context-art'])];

pkg.sources.unshift({ id: 'crail-deep-visitor-research', name: 'Crail visitor facilities and operator research', organisation: 'Fife Council, Crail Museum and individual operators', coverage: 'Food, trails, public parking, public toilets and art for Crail', accessMethod: 'Opened official, responsible-body and operator visitor pages; linked exact current-place geometries', sourceUrl: 'https://www.crailmuseum.uk/home/map', reliability: 'local_authority', limitations: 'Only Nethergate has a complete current council price-and-capacity page. Unknown Marketgate, harbour and Westgate payment details remain explicitly unpublished rather than inferred.' });
pkg.validation = validateFeatures(pkg.project, pkg.features);
if (pkg.validation.some((item) => item.severity === 'error')) throw new Error('Crail visitor enrichment introduced validation errors.');
await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');

const planner = JSON.parse(await readFile(plannerPath, 'utf8')) as { schemaVersion: number; projects: Record<string, Record<string, string[]>> };
planner.projects['crail-scotland'] = {
  eat: foods.map((food) => food.id),
  trails: [heritageWalk.id, coastal.id],
  parking: ['osm-community:way-1367414238', 'osm-community:way-306292353', 'osm-community:way-1367414235', 'osm-community:way-1479050408', 'osm-community:way-1367414236'],
  toilets: ['osm-community:node-13568340723', 'osm-community:way-267283087'],
};
await writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`, 'utf8');

const unconfirmed = (url: string) => ({ rating: 0, status: 'unconfirmed', label: 'Dog policy not confirmed', summary: 'No reliable current dog policy was published in the reviewed visitor source; check directly before making a dog-dependent visit.', sourceName: 'Reviewed visitor information', sourceUrl: url, reviewedAt });
const eat = Object.fromEntries(foods.map((food) => [food.id, food.dog ? { ...food.dog, sourceName: 'Reviewed visitor information', reviewedAt } : unconfirmed(food.sourceUrl)]));
await writeFile(dogPath, `${JSON.stringify({ schemaVersion: 1, reviewedAt, projects: { 'crail-scotland': { attraction: { [harbourGallery.id]: unconfirmed('https://www.crailharbourgallery.co.uk/') }, eat } } }, null, 2)}\n`, 'utf8');
console.log(`Deepened Crail: ${foods.length} food, 2 trails, 5 parking, 2 toilets and 2 art-linked places.`);
