import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { HeritageFeature, ProjectPackage, VisitorHighlight } from '../src/domain/models';
import { editorialRatingMethodVersion } from '../src/domain/editorialResearch';
import { validateFeatures } from '../src/domain/validation';

const projectId = 'auchenblae-scotland';
const reviewedDate = '2026-08-30';
const reviewedAt = '2026-08-30T20:15:00Z';
const projectPath = resolve('data/projects/auchenblae.json');
const plannerPath = resolve('data/cairn-o-mount-visitor-planner-curation.json');
const dogPath = resolve('data/cairn-o-mount-dog-access-curation.json');
const reportPath = resolve('data/review/auchenblae-full-visitor-audit-2026-08-30.json');
type Feature = HeritageFeature & Record<string, any>;
type Package = ProjectPackage & { project: ProjectPackage['project'] & Record<string, any>; features: Feature[] };

const urls = {
  den: 'https://www.laurencekirkab30.co.uk/the-den-auchenblae/',
  chapel: 'https://www.aberdeenshire.gov.uk/leisure-sport-and-culture/archaeology/projects/historic-kirkyards/st-palladiuss-chapel-fordoun-parish-kirkyard-auchenblae',
  chapelVisit: 'https://visitabdn.com/businesses/st-palladiuss-chapel-auchenblae',
  chapelHes: 'https://portal.historicenvironment.scot/designation/SM9723',
  churchesTrail: 'https://aberdeenshirestorage.blob.core.windows.net/acblobstorage/8455f8d2-6b05-4465-ae92-98d4274abc80/2022_churches_trail_leaflet_web_small.pdf',
  golf: 'https://auchenblaeparks.com/golf/',
  cafe: 'https://auchenblae.cylex-uk.co.uk/company/the-brae-cafe-27200158.html',
  community: 'https://theblae.org/',
  conservation: 'https://publications.aberdeenshire.gov.uk/conservation-areas',
  toilets: 'https://publications.aberdeenshire.gov.uk/asset-transfer-auchenblae-public-toilets',
  recycling: 'https://www.aberdeenshire.gov.uk/waste/recycling/recycling-point/',
  osmMap: 'https://www.openstreetmap.org/api/0.6/map?bbox=-2.47%2C56.889%2C-2.43%2C56.909',
  dogCode: 'https://www.outdooraccess-scotland.scot/dog-owners',
  treasureSearch: 'https://www.treasuretrails.co.uk/pages/search-results-page?q=auchenblae',
};

const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as Package;
const planner = JSON.parse(await readFile(plannerPath, 'utf8')) as any;
const dog = JSON.parse(await readFile(dogPath, 'utf8')) as any;

const scoreParts = (score: number, food = false) => food
  ? {
      foodAndDrinkQuality: Math.round(score * 0.29), daytimeRelevance: Math.round(score * 0.21),
      distinctiveness: Math.round(score * 0.15), consistency: Math.round(score * 0.14),
      visitorFit: Math.round(score * 0.11), evidenceConfidence: 0,
    }
  : {
      experienceDepth: Math.round(score * 0.3), distinctiveness: Math.round(score * 0.2),
      presentation: Math.round(score * 0.2), journeyWorth: Math.round(score * 0.15),
      accessAndReliability: Math.round(score * 0.1), evidenceConfidence: 0,
      visitability: 'full_visitor_experience' as const,
    };

function normaliseParts(parts: Record<string, any>, score: number) {
  const numeric = Object.entries(parts).filter(([, value]) => typeof value === 'number');
  const total = numeric.reduce((sum, [, value]) => sum + value, 0);
  parts.evidenceConfidence += score - total;
  return parts;
}

function make(spec: Record<string, any>): Feature {
  const assessment = spec.score ? normaliseParts(scoreParts(spec.score, spec.category === 'food'), spec.score) : undefined;
  const placeType = spec.placeType === 'Toilets' ? 'Public toilets' : spec.placeType;
  const foodDetails = spec.category === 'food'
    ? `amenity=cafe; food_score=${spec.score}; cuisine=coffee, cake and light lunches; price_band=££; opening_hours:description=${spec.opening}; description=${spec.tagline}. ${spec.description}; `
    : '';
  return {
    id: spec.id, projectId, name: spec.name, alternativeNames: [], countryCode: 'GB-SCT',
    region: 'Aberdeenshire', locality: 'Auchenblae', featureType: spec.featureType,
    significance: spec.significance ?? 'local', geometry: { type: 'Point', coordinates: spec.coordinates },
    locationType: spec.locationType ?? 'exact', locationConfidence: spec.locationConfidence ?? 'high',
    dateBasis: 'unknown', dateConfidence: 'unknown', survival: 'substantially_intact',
    shortDescription: spec.description, visitorWebsiteUrl: spec.website,
    editorialReview: spec.score ? {
      status: 'editorially_researched', category: spec.category, methodVersion: editorialRatingMethodVersion,
      reviewedAt: reviewedDate, scoreRationale: spec.reason, evidenceUrls: spec.evidenceUrls,
      ...(spec.category === 'food' ? { foodAssessment: assessment } : { attractionAssessment: assessment }),
    } : undefined,
    sourceRecords: spec.evidenceUrls.map((url: string, index: number) => ({
      sourceName: index ? `${spec.name} supporting evidence` : spec.sourceName,
      sourceOrganisation: index ? (url.includes('openstreetmap.org') ? 'OpenStreetMap contributors' : 'Supporting publisher') : spec.sourceOrganisation,
      sourceUrl: url, sourceRecordId: spec.sourceRecordIds?.[index], accessedAt: reviewedAt,
      reliability: url.includes('historicenvironment.scot') ? 'official_statutory' : url.includes('aberdeenshire.gov.uk') || url.includes('aberdeenshirestorage') ? 'local_authority' : url.includes('openstreetmap.org') ? 'discovery_only' : 'official_non_statutory',
      licence: url.includes('openstreetmap.org') ? 'Open Database Licence (ODbL) v1.0; © OpenStreetMap contributors.' : 'Source-linked editorial evidence; verify time-sensitive details before travel.',
      notes: `Current-place curation: visitor_place_type=${placeType}; ${spec.score ? `visit_score=${spec.score}; ` : ''}${foodDetails}${spec.details ?? ''}`,
    })),
    tags: [...new Set([...spec.tags, ...(spec.category === 'food' ? ['service-context-food', 'visitor-context-food'] : [])])],
    createdAt: reviewedAt, updatedAt: reviewedAt, reviewed: true, evidenceScope: 'parish_evidence',
  } as Feature;
}

for (const feature of pkg.features.filter((item) => item.tags.includes('hes-listed-building'))) {
  const dated = Boolean(feature.documentedDateText?.trim() && feature.earliestPossibleYear != null && feature.latestPossibleYear != null && feature.dateBasis !== 'unknown');
  feature.tags = [...new Set([...feature.tags.filter((tag: string) => tag !== 'map-hidden'), 'heritage-record-retained', ...(dated ? [] : ['map-hidden'])])];
}

const attractions = [
  make({
    id: 'curated-attraction:auchenblae-st-palladius', name: 'St Palladius’s Chapel, Parish Church and Fordoun Stone', score: 74,
    coordinates: [-2.4511462395974464, 56.89631557922967], featureType: 'historic_site', significance: 'national',
    description: 'A nationally important medieval chapel site, historic kirkyard and 1829 parish church whose vestibule contains the Pictish Fordoun Stone.',
    reason: 'A strong, multi-layered heritage visit with visible medieval fabric and nationally significant early-Christian and Pictish associations.',
    website: urls.chapel, sourceName: 'St Palladius’s Chapel and Fordoun Parish Kirkyard', sourceOrganisation: 'Aberdeenshire Council',
    evidenceUrls: [urls.chapel, urls.chapelVisit, urls.chapelHes], sourceRecordIds: [undefined, undefined, 'SM9723'],
    placeType: 'Attraction', category: 'attraction', tags: ['curated-visitor', 'home-standalone-place', 'current-context', 'service-context-heritage'],
    details: 'chapel oldest fabric 1244; parish church 1829; Fordoun Stone displayed inside the active church; free outdoor access; church opening not guaranteed',
  }),
  make({
    id: 'curated-attraction:auchenblae-den', name: 'The Den, Auchenblae', score: 69,
    coordinates: [-2.45384771, 56.90140869], featureType: 'park',
    description: 'Community-owned burnside park with a woodland walk, bridges, fairy doors, two play areas, picnic tables, tennis courts and summer pavilion facilities.',
    reason: 'A characterful and unusually well-equipped village park that supports a genuine family or dog-walking stop, though the experience remains compact.',
    website: urls.den, sourceName: 'The Den, Auchenblae', sourceOrganisation: 'LaurencekirkAB30 / Auchenblae Parks',
    evidenceUrls: [urls.den, 'https://www.openstreetmap.org/way/932348336'], sourceRecordIds: [undefined, 'way/932348336'],
    placeType: 'Attraction', category: 'attraction', tags: ['curated-visitor', 'home-standalone-place', 'current-context', 'family-friendly'],
    details: 'open community park; woodland walk; summer toilets; dogs welcome under responsible control; donation points at car park and pavilion',
  }),
  make({
    id: 'curated-attraction:auchenblae-golf-course', name: 'Auchenblae Golf Course', score: 64,
    coordinates: [-2.440792188235294, 56.90409637058824], featureType: 'attraction',
    description: 'Community-owned nine-hole, par-64 rural course with countryside views and online visitor tee-time booking.',
    reason: 'A genuine bookable visitor activity and distinctive local asset, but specialist rather than a general sightseeing draw.',
    website: urls.golf, sourceName: 'Auchenblae Golf Course', sourceOrganisation: 'Auchenblae Parks SCIO',
    evidenceUrls: [urls.golf, 'https://www.openstreetmap.org/way/932382512'], sourceRecordIds: [undefined, 'way/932382512'],
    placeType: 'Attraction', category: 'attraction', tags: ['curated-visitor', 'home-standalone-place', 'current-context', 'paid-activity'],
    details: '9 holes; 3,640 yards; par 64; open to members, guests and visitors; pre-book tee time and check current green fees',
  }),
];

const foods = [make({
  id: 'curated-food:auchenblae-brae-cafe', name: 'The Brae Cafe', tagline: 'Coffee, cakes and village lunches',
  opening: 'Published 2026 hours: 10:00–16:00 most days, closed Wednesday; later Friday and Saturday service; verify before travel',
  score: 72, coordinates: [-2.449969489106028, 56.899737846982056], locationType: 'address_centroid', locationConfidence: 'medium',
  featureType: 'food_drink', description: 'Traditional village café serving coffee, homemade cakes, breakfasts and light lunches, with later bar and restaurant service on selected days.',
  reason: 'The village’s strongest independently verified coffee-and-cake stop, with current 2026 hours and a clear daytime café offer.',
  website: urls.cafe, sourceName: 'The Brae Cafe current listing', sourceOrganisation: 'Cylex / Yably',
  evidenceUrls: [urls.cafe, urls.community], placeType: 'Eat', category: 'food', tags: ['curated-visitor', 'current-context', 'food-coffee-cake'],
  details: 'Kintore Street AB30 1XP; coordinate uses the local NRHE Post Office address point because the café is not separately mapped in the current OSM extract',
})];

const trails = [
  make({
    id: 'curated-trails:auchenblae-den-woodland-walk', name: 'The Den Woodland Walk', score: 67,
    coordinates: [-2.45384771, 56.90140869], featureType: 'walking_route',
    description: 'Short community-published woodland walk following the Luther Water through The Den, crossing bridges and passing the former dam site and fairy doors.',
    reason: 'A verified, family-friendly local walk wholly within the village park, with a working route information link and practical facilities.',
    website: urls.den, sourceName: 'The Den, Auchenblae', sourceOrganisation: 'LaurencekirkAB30 / Auchenblae Parks',
    evidenceUrls: [urls.den, 'https://www.openstreetmap.org/way/932348336'], sourceRecordIds: [undefined, 'way/932348336'],
    placeType: 'Trail', category: 'trail', tags: ['curated-visitor', 'visitor-context-trail', 'current-context'],
    details: 'trail_type=Short woodland park walk; best_for=Families, dogs and a gentle village stroll; distance=Short local loop, exact distance not published; time_to_spend=30–60 minutes; route link checked 2026-08-30',
  }),
  make({
    id: 'curated-trails:auchenblae-historic-kirkyards', name: 'Aberdeenshire Historic Kirkyards Trail: Auchenblae', score: 64,
    coordinates: [-2.4511462395974464, 56.89631557922967], featureType: 'walking_route',
    description: 'Council heritage-trail leaflet entry for St Palladius’s Chapel, Fordoun Stone, parish church and kirkyard, with directions and historical interpretation.',
    reason: 'A verified council trail resource that deepens the chapel visit, though it is one stop in a wider multi-site regional trail.',
    website: urls.churchesTrail, sourceName: 'Aberdeenshire Historic Kirkyards Trail', sourceOrganisation: 'Aberdeenshire Council',
    evidenceUrls: [urls.churchesTrail, urls.chapel], placeType: 'Trail', category: 'trail',
    tags: ['curated-visitor', 'visitor-context-trail', 'current-context', 'cross-boundary-route'],
    details: 'trail_type=Regional heritage trail stop; best_for=Medieval and Pictish history; distance=Multi-site driving trail, Auchenblae stop is compact; time_to_spend=30–60 minutes at Auchenblae; PDF link checked 2026-08-30',
  }),
];

const picnics = [make({
  id: 'curated-picnic:auchenblae-den', name: 'The Den Picnic Tables', coordinates: [-2.45384771, 56.90140869],
  featureType: 'picnic_site', description: 'Picnic tables distributed through the community park beside the woodland walk and play areas.',
  website: urls.den, sourceName: 'The Den visitor facilities', sourceOrganisation: 'LaurencekirkAB30 / Auchenblae Parks',
  evidenceUrls: [urls.den, 'https://www.openstreetmap.org/way/932348336'], sourceRecordIds: [undefined, 'way/932348336'],
  placeType: 'Picnic', tags: ['service-context-picnic', 'current-context'],
  details: 'multiple picnic tables stated by the park publisher; exact individual table coordinates are not mapped, so the park centroid is used',
})];

const parking = [
  make({
    id: 'curated-parking:auchenblae-den', name: 'The Den Car Park', coordinates: [-2.4534188333333335, 56.9006006],
    featureType: 'parking', description: 'Surface car park at the Kintore Street entrance to The Den; the park requests donations rather than publishing a parking charge.',
    website: urls.den, sourceName: 'The Den visitor information', sourceOrganisation: 'LaurencekirkAB30 / Auchenblae Parks',
    evidenceUrls: [urls.den, 'https://www.openstreetmap.org/way/1006781057'], sourceRecordIds: [undefined, 'way/1006781057'],
    placeType: 'Parking', tags: ['service-context-parking', 'current-context'],
    details: 'access=public; fee=no; payment_required=no; price_display=Free; donations welcome; capacity and accessible bays not published',
  }),
  make({
    id: 'curated-parking:auchenblae-football-pitch', name: 'Auchenblae Football Pitch Car Park', coordinates: [-2.456938566666667, 56.900581933333335],
    featureType: 'parking', description: 'Mapped surface car park serving the football pitch and council-listed recycling point on the west side of the village.',
    website: urls.recycling, sourceName: 'Auchenblae recycling-point location', sourceOrganisation: 'Aberdeenshire Council',
    evidenceUrls: [urls.recycling, 'https://www.openstreetmap.org/way/1530548886'], sourceRecordIds: [undefined, 'way/1530548886'],
    placeType: 'Parking', tags: ['service-context-parking', 'current-context'],
    details: 'access=public; fee=unknown; price_display=Fee status not published; capacity and accessible bays not published; do not infer free parking from absent OSM fee tags',
  }),
];

const toilets = [make({
  id: 'curated-toilets:auchenblae-den-pavilion', name: 'The Den Pavilion Toilets', coordinates: [-2.45384771, 56.90140869],
  featureType: 'toilets', description: 'Seasonal toilet facilities in The Den pavilion, available during the summer season.',
  website: urls.den, sourceName: 'The Den visitor facilities', sourceOrganisation: 'LaurencekirkAB30 / Auchenblae Parks',
  evidenceUrls: [urls.den, urls.toilets], placeType: 'Toilets', tags: ['service-context-toilets', 'current-context', 'limited-opening'],
  details: 'opening_hours:description=Summer season only; accessible-toilet and baby-changing provision not confirmed; the former Mackenzie Avenue public conveniences are excluded because reopening is only proposed, not verified',
})];

const curated = [...attractions, ...foods, ...trails, ...picnics, ...parking, ...toilets];
pkg.features = [...pkg.features.filter((feature) => !feature.id.startsWith('curated-')), ...curated];

const highlightDetails: Record<string, [string, string, string, string, boolean]> = {
  'curated-attraction:auchenblae-st-palladius': ['Medieval chapel and Pictish stone', '45–75 minutes', 'Kirkyard and chapel exterior always accessible; active church opening is not guaranteed', 'Free', true],
  'curated-attraction:auchenblae-den': ['Woodland, play and picnic park', '45–90 minutes', 'Park open year-round; pavilion toilets summer only', 'Free; donations welcome', true],
  'curated-attraction:auchenblae-golf-course': ['A bookable rural nine-hole course', '2–3 hours', 'Book a visitor tee time and check course conditions', 'Green fee applies', false],
};
pkg.project.visitorHighlights = attractions.map((feature) => {
  const detail = highlightDetails[feature.id];
  const visitorScore = Object.values(feature.editorialReview!.attractionAssessment).filter((value) => typeof value === 'number').reduce((sum: number, value: any) => sum + value, 0);
  return { rank: 1, featureId: feature.id, name: feature.name, reason: feature.editorialReview!.scoreRationale, tagline: detail[0], visitorScore, timeToSpend: detail[1], openingTimes: detail[2], admission: detail[3], freeAdmission: detail[4], visitorWebsiteUrl: feature.visitorWebsiteUrl, editorialReview: feature.editorialReview, sourceName: feature.sourceRecords[0].sourceName, sourceUrl: feature.visitorWebsiteUrl!, verifiedInBoundaryAt: reviewedDate } as VisitorHighlight;
}).sort((a, b) => b.visitorScore - a.visitorScore).map((item, index) => ({ ...item, rank: index + 1 }));

pkg.project.preferredBasemap = 'voyager';
pkg.project.touristAppeal = {
  score: 66, dogOwnerScore: 66, dogAccessScoreAdjustment: 0, rating: 1, label: 'Worth a Stop',
  summary: 'A compact but coherent Mearns village visit combining an important medieval and Pictish church site, a strong community park, a visitor golf course and a dependable café.',
  dogAccessRating: 4, dogAccessSummary: 'The Den explicitly welcomes responsible dog walking and provides the village’s best dog-friendly experience; indoor café and church access remain unconfirmed.',
  methodVersion: '2026-08-30-strict-settlement-full-audit-v3', reviewedAt: reviewedDate, sourceUrls: Object.values(urls),
};
pkg.project.townGuide = {
  characterTag: 'Medieval Mearns heritage and a community woodland den', headline: 'A compact heritage village that earns a short stop',
  intro: 'Auchenblae has enough independent village content for a worthwhile half-day: explore the St Palladius complex and Fordoun Stone, walk and picnic in The Den, then stop for coffee and home baking. The golf course adds a longer specialist activity.',
  bestFor: ['Medieval and Pictish history', 'A family woodland-and-play stop', 'Coffee, cake and a quiet village wander'],
  perfectFor: ['A focused 2–4 hour stop', 'Families and responsible dog walkers', 'Adding a heritage stop to a Mearns route'],
  suggestedFirstVisit: { title: 'St Palladius’s Chapel, The Den and The Brae Cafe', summary: 'Begin at the chapel and parish church, continue to The Den for its short woodland walk and picnic tables, then finish with coffee or a light lunch in the village.' },
  dontMiss: ['St Palladius’s Chapel and Fordoun Stone', 'The Den woodland walk', 'The James Taylor tea-pioneer statue in the village square'],
  suggestedTime: '2–4 hours; longer for a round of golf', visitorMood: 'Quiet, locally distinctive and unusually well supplied for its size, but still a modest village rather than a full-day destination.',
  sourceUrls: Object.values(urls), lastReviewedAt: reviewedDate,
};

planner.projects[projectId] = { eat: foods.map((f) => f.id), trails: trails.map((f) => f.id), picnic: picnics.map((f) => f.id), parking: parking.map((f) => f.id), toilets: toilets.map((f) => f.id) };
const dogRecord = (rating: number, status: string, label: string, summary: string, sourceUrl: string) => ({ rating, status, label, summary, sourceName: 'Auchenblae dog-access audit', sourceUrl, reviewedAt: reviewedDate });
dog.reviewedAt = reviewedDate;
dog.projects[projectId] = {
  attraction: {
    'curated-attraction:auchenblae-st-palladius': dogRecord(2, 'outdoor_only', 'Outdoor churchyard access', 'Responsible dogs can accompany the outdoor chapel and kirkyard visit; interior church access is unconfirmed.', urls.chapel),
    'curated-attraction:auchenblae-den': dogRecord(5, 'allowed', 'Dogs welcome in The Den', 'The park publisher explicitly promotes exploring The Den with dogs; follow the Scottish Outdoor Access Code.', urls.den),
    'curated-attraction:auchenblae-golf-course': dogRecord(1, 'unconfirmed', 'Confirm course dog policy', 'No reliable current dog policy was found for the golf course.', urls.golf),
  },
  trail: {
    'curated-trails:auchenblae-den-woodland-walk': dogRecord(5, 'allowed', 'Excellent village dog walk', 'The route publisher explicitly describes exploring The Den with dogs.', urls.den),
    'curated-trails:auchenblae-historic-kirkyards': dogRecord(2, 'outdoor_only', 'Outdoor heritage stop', 'Keep dogs under close control in the active kirkyard; church interior access is unconfirmed.', urls.chapel),
  },
  eat: { 'curated-food:auchenblae-brae-cafe': dogRecord(1, 'unconfirmed', 'Confirm current café dog policy', 'No reliable current dog policy was found for indoor or outdoor seating.', urls.cafe) },
};

pkg.validation = validateFeatures(pkg.project, pkg.features);
const errors = pkg.validation.filter((entry: any) => entry.severity === 'error');
if (errors.length) throw new Error(errors.map((entry: any) => entry.message).join('; '));
const hes = pkg.features.filter((feature) => feature.tags.includes('hes-listed-building'));
const visibleHes = hes.filter((feature) => !feature.tags.includes('map-hidden'));
const undatedVisible = visibleHes.filter((feature) => !feature.documentedDateText?.trim() || feature.earliestPossibleYear == null || feature.latestPossibleYear == null || feature.dateBasis === 'unknown');
if (undatedVisible.length) throw new Error(`Undated Auchenblae heritage pins: ${undatedVisible.map((feature) => feature.id).join(', ')}`);

await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`);
await writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`);
await writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`);
await writeFile(reportPath, `${JSON.stringify({
  reviewedAt, projectId, townScore: 66, dogOwnerScore: 66,
  settlementMerit: { result: 'publish_on_town_map', rationale: 'The medieval/Pictish church complex, The Den, bookable golf course, café and practical facilities form an independent 2–4 hour village visit. Nearby Drumtochty and Monboddo assets are excluded.' },
  categoryCounts: { see: attractions.length, eat: foods.length, trails: trails.length, picnic: picnics.length, parking: parking.length, toilets: toilets.length },
  heritageDateAudit: { statutoryDesignations: hes.length, visiblePins: visibleHes.length, datedVisiblePins: visibleHes.length - undatedVisible.length, undatedVisiblePins: undatedVisible.map((f) => f.id), hiddenRetained: hes.filter((f) => f.tags.includes('map-hidden')).length, unresolvedHidden: hes.filter((f) => f.tags.includes('map-hidden')).map((f) => f.id), localGeometrySource: 'Local HES statutory spatial library', descriptionSource: 'Official HES designation descriptions', dateRule: 'Construction or material-period evidence only; never designation dates.' },
  trailProviderSearches: [
    { provider: 'TreasureTrails.co.uk', result: 'No Auchenblae product found; none published.' },
    { provider: 'Auchenblae Parks / LaurencekirkAB30', result: 'Verified working page for The Den woodland walk.' },
    { provider: 'Aberdeenshire Council', result: 'Verified working Historic Kirkyards Trail PDF and St Palladius interpretation page.' },
  ],
  parkingAudit: { published: parking.length, den: 'Free/donation basis stated by park publisher and current OSM polygon.', footballPitch: 'Current OSM polygon and council recycling-point evidence; fee status explicitly left unknown.', exclusions: ['Church Square naming was found in an asset list, but no additional distinct current car-park geometry was safely established.'] },
  foodAudit: { published: foods.length, brief: 'Coffee, home baking and light lunches prioritised.', exclusions: ['Community café events are intermittent and not published as a dependable daily stop.', 'Premier News coffee machine is a convenience-store fallback, not a café.'] },
  picnicAudit: { published: picnics.length, result: 'The park publisher explicitly states that picnic tables are dotted through The Den; park centroid used rather than invented table coordinates.' },
  toiletAudit: { published: toilets.length, result: 'Summer pavilion toilets verified. Former Mackenzie Avenue conveniences excluded because reopening remains a proposal rather than verified current access.' },
  accessibility: { result: 'The Den is approached from Kintore Street and has surfaced recreation areas, but no reliable step-free specification was published. Chapel churchyard terrain and church opening/access should be checked locally. Café listing reports wheelchair access, but this is not independently confirmed by the operator.' },
  transport: { result: 'Auchenblae has a bus stop and road access, but live timetable details are deliberately not embedded; travellers should check the current operator or Traveline before departure.' },
  boundaryReview: { result: 'Every published marker is within the existing Auchenblae visitor boundary.', excludedNearby: ['Drumtochty Castle', 'St Palladius Episcopal Church at Drumtochty', 'Monboddo House', 'Fordoun village attractions'] },
  verification: { linksChecked: reviewedDate, visibleHeritageDated: `${visibleHes.length}/${visibleHes.length}`, validationErrors: 0, currentOsmChecked: 'Official OSM API bbox checked 2026-08-30 against the local 2026-08-04 snapshot.' },
}, null, 2)}\n`);

console.log(`Auchenblae audit complete: ${attractions.length} See, ${foods.length} Eat, ${trails.length} Trails, ${picnics.length} Picnic, ${parking.length} Parking, ${toilets.length} Toilets; ${visibleHes.length}/${visibleHes.length} visible HES pins dated.`);
