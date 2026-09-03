import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { HeritageFeature, ProjectPackage, VisitorHighlight } from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';

const projectId = 'muchalls-scotland';
const reviewedDate = '2026-08-28';
const reviewedAt = '2026-08-28T21:30:00Z';
const projectPath = resolve('data/projects/muchalls.json');
const plannerPath = resolve('data/aberdeen-north-visitor-planner-curation.json');
const dogPath = resolve('data/aberdeen-north-dog-access-curation.json');
const reportPath = resolve('data/review/muchalls-full-visitor-audit-2026-08-28.json');
type F = HeritageFeature & Record<string, any>;
type P = ProjectPackage & { project: ProjectPackage['project'] & Record<string, any>; features: F[] };

const urls = {
  listedCottages: 'https://portal.historicenvironment.scot/designation/LB9355',
  conservationPlan: 'https://publications.aberdeenshire.gov.uk/acblobstorage/ddc2290a-ffe5-4c7a-9a15-7f7921f5a504/nmccclocalplaceplan.pdf',
  councilBeach: 'https://www.aberdeenshire.gov.uk/leisure-sport-and-culture/aberdeenshire-tourist-and-visitor-information/beaches',
  corePaths: 'https://www.aberdeenshire.gov.uk/outdoor-access-and-countryside/paths/core-paths-plan',
  muchallsMeander: 'https://www.bettridgecentre.org.uk/newtonhill-walks.html',
  stack: 'https://thestackrestaurant.com/',
  stackVisitor: 'https://visitabdn.com/businesses/the-stack-restaurant-and-bar',
  councilParking: 'https://www.aberdeenshire.gov.uk/roads-and-travel/car-parking/car-parks',
  pavementParking: 'https://www.aberdeenshire.gov.uk/roads-and-travel/car-parking/pavement-parking-ban/',
  councilToilets: 'https://www.aberdeenshire.gov.uk/local/public-toilets?area=Kincardine+and+Mearns',
  busPlanner: 'https://www.stagecoachbus.com/plan-a-journey',
  dogCode: 'https://www.outdooraccess-scotland.scot/dog-owners',
  heritageRecord: 'https://her.aberdeenshire.gov.uk/Monument/MAB43052',
  treasureTrails: 'https://www.treasuretrails.co.uk/collections/trails',
  curiousAbout: 'https://www.curiousabout.co.uk/',
  mysteryGuides: 'https://www.mysteryguides.co.uk/',
  goQuest: 'https://goquestadventures.com/',
};

const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as P;
const planner = JSON.parse(await readFile(plannerPath, 'utf8')) as any;
const dog = JSON.parse(await readFile(dogPath, 'utf8')) as any;
const assess = (score: number) => ({ experienceDepth: Math.round(score * .3), distinctiveness: Math.round(score * .2), presentation: Math.round(score * .2), journeyWorth: Math.round(score * .15), accessAndReliability: Math.round(score * .1), evidenceConfidence: score - Math.round(score * .3) - Math.round(score * .2) - Math.round(score * .2) - Math.round(score * .15) - Math.round(score * .1), visitability: 'full_visitor_experience' as const });
const foodAssess = (score: number) => ({ foodAndDrinkQuality: Math.round(score * .29), daytimeRelevance: Math.round(score * .21), distinctiveness: Math.round(score * .15), consistency: Math.round(score * .14), visitorFit: Math.round(score * .11), evidenceConfidence: score - Math.round(score * .29) - Math.round(score * .21) - Math.round(score * .15) - Math.round(score * .14) - Math.round(score * .11) });
const src = (name: string, org: string, url: string, notes: string, reliability: any = 'official_non_statutory') => ({ sourceName: name, sourceOrganisation: org, sourceUrl: url, accessedAt: reviewedAt, reliability, licence: 'Source-linked editorial evidence; verify time-sensitive details before travel.', notes });
const review = (category: 'attraction' | 'trail' | 'food', score: number, reason: string, evidenceUrls: string[]) => ({ status: 'editorially_researched', category, methodVersion: '2026-08-13-researched-visitor-value-v1', reviewedAt: reviewedDate, scoreRationale: reason, evidenceUrls, ...(category === 'food' ? { foodAssessment: foodAssess(score) } : { attractionAssessment: assess(score) }) });
const make = (s: Record<string, any>): F => ({
  id: s.id, projectId, name: s.name, alternativeNames: [], countryCode: 'GB-SCT', region: 'Aberdeenshire', locality: 'Muchalls', featureType: s.featureType,
  significance: s.significance ?? 'local', geometry: { type: 'Point', coordinates: s.coordinates }, locationType: s.locationType ?? 'exact', locationConfidence: s.locationConfidence ?? 'high',
  dateBasis: s.dateBasis ?? 'unknown', dateConfidence: s.dateConfidence ?? 'unknown', survival: s.survival ?? 'substantially_intact', documentedDateText: s.dateText,
  earliestPossibleYear: s.earliest, latestPossibleYear: s.latest, datePrecision: s.datePrecision, shortDescription: s.description, visitorWebsiteUrl: s.website,
  attractionGuide: s.guide, editorialReview: s.category ? review(s.category, s.score, s.reason, s.evidenceUrls) : undefined,
  sourceRecords: s.evidenceUrls.map((url: string, i: number) => src(i ? `${s.name} supporting evidence` : s.sourceName, i ? 'Supporting publisher' : s.sourceOrganisation, url, `Current-place curation: visitor_place_type=${s.placeType}; ${s.score ? `visit_score=${s.score}; ` : ''}${s.details ?? ''}; description=${s.description}`, url.includes('historicenvironment.scot') ? 'official_statutory' : url.includes('aberdeenshire.gov.uk') || url.includes('visitabdn.com') ? 'local_authority' : 'official_non_statutory')),
  tags: s.tags, createdAt: reviewedAt, updatedAt: reviewedAt, reviewed: true, evidenceScope: 'parish_evidence',
}) as F;

const addTag = (feature: F, tag: string) => {
  feature.tags = [...new Set([...(feature.tags ?? []), tag])];
};
const removeTag = (feature: F, tag: string) => {
  feature.tags = (feature.tags ?? []).filter((candidate: string) => candidate !== tag);
};
const dateFeature = (feature: F, text: string, earliest: number, latest: number, confidence: 'high' | 'medium', precision: string, sourceUrl?: string) => {
  feature.documentedDateText = text;
  feature.earliestPossibleYear = earliest;
  feature.latestPossibleYear = latest;
  feature.dateBasis = earliest === latest ? 'documented_construction' : 'documented_period';
  feature.dateConfidence = confidence;
  feature.datePrecision = precision;
  feature.updatedAt = reviewedAt;
  addTag(feature, 'date-reviewed');
  removeTag(feature, 'map-hidden');
  if (sourceUrl && !feature.sourceRecords.some((record: any) => record.sourceUrl === sourceUrl)) {
    feature.sourceRecords.push(src(`${feature.name} date evidence`, 'Historic Environment Scotland / Aberdeenshire Council HER', sourceUrl, `Construction or material-period evidence used for the heat date: ${text}.`, sourceUrl.includes('historicenvironment.scot') ? 'official_statutory' : 'local_authority'));
  }
};
const hideFeature = (feature: F, reason: string) => {
  addTag(feature, 'map-hidden');
  addTag(feature, 'heritage-record-retained');
  feature.updatedAt = reviewedAt;
  const notes = `Record retained in the project library but hidden from the heat map: ${reason}`;
  if (!feature.sourceRecords.some((record: any) => record.notes === notes)) {
    feature.sourceRecords.push(src(`${feature.name} visibility review`, 'Heatmap editorial audit', feature.sourceRecords[0]?.sourceUrl ?? urls.corePaths, notes, 'secondary_research'));
  }
};
const feature = (id: string) => {
  const found = pkg.features.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`Missing imported Muchalls heritage record ${id}`);
  return found;
};

// Retain the complete local HES/NRHE import, but only expose individually located
// records for which a construction or material period can be defended.
const monduff = feature('hes-listed-building:LB9355');
monduff.name = '1–7 Monduff Road Fisher Cottages';
monduff.shortDescription = 'A Category C listed row of harled, slate-roofed fisher cottages forming the clearest surviving part of Muchalls’ old village.';
monduff.visitorWebsiteUrl = urls.listedCottages;
dateFeature(monduff, 'Early 19th century', 1800, 1839, 'high', 'period_range', urls.listedCottages);
monduff.editorialReview = review('attraction', 67, 'The listed Monduff Road row anchors a coherent conservation-area streetscape and makes Muchalls legibly different from a generic residential village, although it is a brief exterior-only visit.', [urls.listedCottages, urls.conservationPlan]);
monduff.attractionGuide = { headline: 'Read the old fishing village in its whitewashed cottage rows', intro: 'Follow Monduff Road and Stranathro Terrace to see the early-19th-century fisher-cottage character that defines the conservation area.', parking: 'No dedicated visitor parking; keep narrow streets and property access clear.', toilets: 'No public toilet has been verified.', picnic: 'No formal picnic provision.', foodNote: 'The Stack is on Dunnyfell Road.' };
addTag(monduff, 'curated-visitor');
addTag(monduff, 'home-standalone-place');
addTag(monduff, 'historic-place');
for (const duplicateId of ['nrhe:37229', 'nrhe:244152', 'nrhe:244154']) {
  const duplicate = feature(duplicateId);
  monduff.sourceRecords.push(...duplicate.sourceRecords.filter((record: any) => !monduff.sourceRecords.some((existing: any) => existing.sourceUrl === record.sourceUrl)));
  addTag(duplicate, 'duplicate-of-hes-listed-building:LB9355');
  hideFeature(duplicate, 'This address is already represented by the statutory 1–7 Monduff Road listed-building pin.');
}

for (const id of ['nrhe:37226', 'nrhe:37227', 'nrhe:37228']) {
  const cottage = feature(id);
  dateFeature(cottage, 'Post-medieval; present by the First Edition Ordnance Survey mapping', 1561, 1869, 'medium', 'period_range', id === 'nrhe:37228' ? urls.heritageRecord : undefined);
  cottage.shortDescription = `${cottage.name.replace(/^MUCHALLS,\s*/i, '')}: a traditional cottage record in the conserved old village, documented as post-medieval and present by the first national mapping.`;
  addTag(cottage, 'historic-place');
}
dateFeature(feature('nrhe:37231'), '19th century', 1800, 1899, 'high', 'century');
feature('nrhe:37231').name = 'Muchalls Railway Viaduct';
feature('nrhe:37231').shortDescription = 'A 19th-century railway viaduct on the former coastal railway alignment.';
addTag(feature('nrhe:37231'), 'historic-place');
dateFeature(feature('nrhe:184770'), '19th–20th century', 1800, 1999, 'high', 'period_range');
feature('nrhe:184770').name = 'Site of Muchalls Railway Station';
feature('nrhe:184770').shortDescription = 'The recorded site of Muchalls’ former railway station, used during the 19th and 20th centuries.';
addTag(feature('nrhe:184770'), 'historic-place');
dateFeature(feature('nrhe:371476'), '19th century', 1800, 1899, 'high', 'century');
feature('nrhe:371476').name = 'Muchalls Boundary Stone';
feature('nrhe:371476').shortDescription = 'A 19th-century boundary stone recorded beside the old village.';
addTag(feature('nrhe:371476'), 'historic-place');
dateFeature(feature('nrhe:338635'), '20th century', 1900, 1999, 'high', 'century');
feature('nrhe:338635').name = 'Muchalls Station War Memorial';
feature('nrhe:338635').shortDescription = 'A 20th-century war memorial recorded near the former station.';
addTag(feature('nrhe:338635'), 'historic-place');
for (const [id, reason] of [
  ['hes-conservation-area:CA441', 'The conservation-area polygon is a designation boundary, not a construction-period heat point.'],
  ['nrhe:37218', 'The unperiodised hammer find has only one-kilometre positional accuracy.'],
  ['nrhe:37224', 'The unperiodised axehead find has only one-kilometre positional accuracy.'],
  ['nrhe:118816', 'This is an undated whole-village record rather than an individual structure.'],
  ['nrhe:184771', 'The former Marine Hotel record has no defensible construction period in the imported local source.'],
  ['nrhe:184658', 'The farmstead record has no defensible construction period in the imported local source.'],
  ['nrhe:272897', 'Craigness Villa has no defensible construction period in the imported local source.'],
] as const) hideFeature(feature(id), reason);

const cliffs = make({
  id: 'curated-attractions:muchalls-cliffs-grim-haven', name: 'Muchalls Cliffs and Grim Haven View', featureType: 'natural_landmark', coordinates: [-2.16275, 57.01655], website: urls.conservationPlan,
  description: 'A dramatic cliff-edge coastal outlook above the rocky inlet of Grim Haven and Muchalls’ sea stacks. This is curated as a viewpoint, not as assured beach access.',
  reason: 'The cliffs give Muchalls genuine visual distinctiveness and support a worthwhile short stop, but storm damage, steep ground and uncertain shore access keep it below a major-attraction score.',
  evidenceUrls: [urls.conservationPlan, urls.councilBeach], sourceName: 'Newtonhill, Muchalls and Cammachmore Local Place Plan', sourceOrganisation: 'Newtonhill, Muchalls and Cammachmore Community Council / Aberdeenshire Council', placeType: 'Attraction', score: 68, category: 'attraction',
  tags: ['curated-visitor', 'home-standalone-place', 'natural-place', 'current-context'],
  guide: { headline: 'Take in the red-rock coast from above Grim Haven', parking: 'No formal public visitor car park has been verified. Village streets are narrow and parking must follow current signs without blocking access.', toilets: 'No public toilet has been verified in Muchalls.', picnic: 'No formal picnic tables have been verified. Treat the coast as an informal viewpoint and take litter away.', foodNote: 'The Stack on Dunnyfell Road is the village’s verified coffee and light-lunch stop.', accessibility: 'The clifftop approach includes uneven ground and steep, exposed edges. The storm-damaged path to the beach is not presented as accessible or reliably open.' },
});

const attractions = [
  { f: monduff, score: 67, tag: 'Early-19th-century fisher cottages', reason: 'The listed Monduff Road row anchors a coherent conservation-area streetscape and makes Muchalls legibly different from a generic residential village, although it is a brief exterior-only visit.', web: urls.listedCottages, time: '20–40 minutes', open: 'Public-road views only; cottages are private homes', admission: 'Free', guide: { headline: 'Read the old fishing village in its whitewashed cottage rows', parking: 'No dedicated visitor parking; keep narrow streets and property access clear.', toilets: 'No public toilet has been verified.', picnic: 'No formal picnic provision.', foodNote: 'The Stack is on Dunnyfell Road.' } },
  { f: cliffs, score: 68, tag: 'Clifftop red-rock coast', reason: cliffs.editorialReview!.scoreRationale, web: urls.conservationPlan, time: '30–60 minutes', open: 'Open-air viewpoint; visit in daylight and keep back from cliff edges', admission: 'Free', guide: cliffs.attractionGuide },
];

const trails = [make({
  id: 'curated-trails:muchalls-meander', name: 'Muchalls Meander', score: 69, coordinates: [-2.1621, 57.0213], website: urls.muchallsMeander, featureType: 'walking_route', locationType: 'representative_point',
  description: 'A signed 1.38-mile village circuit using yellow waymarkers to link the traditional cottages, Marine Terrace and former railway-station area.',
  reason: 'This is the only exact Muchalls route with a live dedicated page, named waymarking, distance and downloadable mapping. It gives the village a coherent short visit without borrowing Newtonhill attractions.',
  evidenceUrls: [urls.muchallsMeander, urls.corePaths, urls.conservationPlan], sourceName: 'Newtonhill Walks: Muchalls Meander', sourceOrganisation: 'Bettridge Centre community walking project', placeType: 'Trail', details: 'distance=1.38 miles; waymarking=yellow; format=downloadable map; route_link_checked=2026-08-28; warning=the separate descent to Muchalls beach is not included as reliable access because the local place plan records storm damage', category: 'trail',
  tags: ['curated-visitor', 'service-context-trail', 'visitor-context-trail', 'current-context'],
})];

const foods = [make({
  id: 'curated-eat:the-stack-muchalls', name: 'The Stack Restaurant and Bar', score: 76, coordinates: [-2.1622376, 57.0219588], website: urls.stackVisitor, featureType: 'commercial_building',
  description: 'Coffee in the old village: A relaxed restaurant and bar that explicitly welcomes coffee-only visits, with seasonal local food, outside seating and dogs welcome in the bar and outdoor area.',
  reason: 'Although restaurant-led, The Stack qualifies for the café-focused Eat layer because the current visitor listing explicitly welcomes drop-in coffee visits; it is the only verified in-boundary coffee and light-lunch option.',
  evidenceUrls: [urls.stackVisitor, urls.stack], sourceName: 'The Stack Restaurant and Bar visitor listing', sourceOrganisation: 'VisitAberdeenshire', placeType: 'Eat', details: 'price_band=££; cuisine=coffee, seasonal local food and lighter daytime choices; dog_policy=dogs welcome in bar and outside, treats and water bowls provided; opening_hours=check current operator page before travel', category: 'food',
  tags: ['curated-visitor', 'service-context-food', 'visitor-context-food', 'current-context'],
})];

const curated = [cliffs, ...trails, ...foods];
const curatedIds = new Set(curated.map((candidate) => candidate.id));
pkg.features = [...pkg.features.filter((candidate) => !curatedIds.has(candidate.id)), ...curated];
const highlights: VisitorHighlight[] = attractions.map((item, index) => ({ rank: index + 1, featureId: item.f.id, name: item.f.name, reason: item.reason, tagline: item.tag, visitorScore: item.score, timeToSpend: item.time, openingTimes: item.open, admission: item.admission, freeAdmission: true, visitorWebsiteUrl: item.web, attractionGuide: item.guide, editorialReview: item.f.editorialReview, sourceName: item.f.sourceRecords[0].sourceName, sourceUrl: item.web, verifiedInBoundaryAt: reviewedDate }));

pkg.project.preferredBasemap = 'voyager';
pkg.project.boundarySource = 'Conservative 600-metre Muchalls settlement study boundary covering the conservation-area village, former station and immediate clifftop; Newtonhill, Muchalls Castle and wider coast are excluded';
pkg.project.boundaryConfidence = 'medium';
pkg.project.touristAppeal = { score: 65, dogOwnerScore: 64, dogAccessScoreAdjustment: -1, rating: 0, label: 'Notable Stop', summary: 'A small conservation-area fishing village with a dramatic clifftop setting, a signed local walk and one strong refreshment stop.', dogAccessRating: 2, dogAccessSummary: 'The Stack welcomes dogs and the village route is outdoors, but narrow roads, cliffs, wildlife and unreliable beach access require close control and keep the dog score slightly lower.', methodVersion: '2026-08-28-strict-settlement-full-audit-v2', reviewedAt: reviewedDate, sourceUrls: Object.values(urls) };
pkg.project.visitorHighlights = highlights;
pkg.project.visualIdentity = {
  theme: 'muchalls-red-rock-cliffs-watercolour',
  badgeImage: '/town-guides/muchalls-cliffs-grim-haven-watercolour-guide-v1.png',
  badgeAlt: 'Illustrated view along Muchalls’ red-rock cliffs and narrow coves towards rounded sea stacks',
  heroImage: '/town-guides/muchalls-cliffs-grim-haven-watercolour-guide-v1.png',
  heroAlt: 'Watercolour guide illustration of Muchalls’ gorse-covered cliffs, rocky inlets, sea stacks and distant village houses',
  heroObjectPosition: '58% 55%',
  motifs: ['Red-rock cliffs', 'Grim Haven', 'Rounded sea stacks', 'Yellow gorse'],
  primaryColour: '#315D65',
  accentColour: '#B9782C',
  backgroundColour: '#EEF1E7',
};
pkg.project.townGuide = {
  characterTag: 'Whitewashed fisher cottages and red-rock cliffs', headline: 'A tiny historic coastal village that rewards a careful short wander',
  intro: 'Muchalls scores 65% on its own settlement offer: early-19th-century fisher cottages, a conserved village core, a dramatic clifftop view, the signed Muchalls Meander and a verified coffee stop. Newtonhill, Muchalls Castle and remote coastal attractions are not used to support the score.',
  bestFor: ['Fishing-village character', 'Short coastal walks', 'Clifftop scenery', 'Coffee with a dog'], perfectFor: ['A one-to-two-hour village wander', 'A scenic coffee stop between Aberdeen and Stonehaven'],
  suggestedFirstVisit: { title: 'Follow the Muchalls Meander', summary: 'Use the yellow-waymarked village circuit for the cottages, former station area and coast-facing lanes, then stop at The Stack.' },
  dontMiss: ['Muchalls Cliffs and Grim Haven View', '1–7 Monduff Road Fisher Cottages', 'Muchalls Meander'], suggestedTime: '1–2 hours', visitorMood: 'Quiet, exposed and genuinely historic, with limited practical infrastructure.',
  practicalNote: 'No formal public visitor car park, public toilet or serviced picnic site has been verified. Monduff Road and Stranathro Terrace have signed pavement-parking exemptions, but these are not promoted as visitor parking and access must be kept clear. The path down to the beach was reported storm-damaged in the current local place plan.',
  transportNote: 'Use the current Stagecoach journey planner before travel. Muchalls has no operating railway station and the village’s narrow road network limits convenient public-transport access.',
  accessibilityNote: 'The village lanes can be walked from the main street, but the clifftop and shore approaches are uneven, steep and exposed. No accessible public toilet or designated accessible visitor parking has been verified.',
  sourceUrls: Object.values(urls), lastReviewedAt: reviewedDate,
};

planner.projects[projectId] = { eat: foods.map((item) => item.id), trails: trails.map((item) => item.id), parking: [], toilets: [], picnic: [] };
const dogReview = (rating: number, status: string, label: string, summary: string, sourceUrl: string) => ({ rating, status, label, summary, sourceName: 'Muchalls dog-access audit', sourceUrl, reviewedAt: reviewedDate });
dog.reviewedAt = reviewedDate;
dog.projects[projectId] = {
  attraction: {
    [monduff.id]: dogReview(2, 'restricted', 'Street-based heritage stop', 'Dogs can accompany the exterior village walk; use a short lead on narrow residential roads and respect private homes.', urls.dogCode),
    [cliffs.id]: dogReview(2, 'restricted', 'Clifftop access with close control', 'Keep dogs close around exposed cliffs, livestock, nesting birds and other path users; do not assume the storm-damaged beach descent is open.', urls.dogCode),
  },
  trail: { [trails[0].id]: dogReview(2, 'restricted', 'Village walk with road and coast controls', 'The circuit uses village roads and outdoor paths; use a lead near traffic, livestock, wildlife and cliff edges.', urls.dogCode) },
  eat: { [foods[0].id]: dogReview(3, 'welcoming', 'Dogs welcome in the bar and outside', 'The current visitor listing states that dogs are welcome in the bar and outside area, with treats and water bowls provided.', urls.stackVisitor) },
};

pkg.validation = validateFeatures(pkg.project, pkg.features);
const errors = pkg.validation.filter((entry: any) => entry.severity === 'error');
if (errors.length) throw new Error(errors.map((entry: any) => entry.message).join('; '));
const historicPins = pkg.features.filter((candidate) => candidate.tags.some((tag: string) => ['hes-listed-building', 'hes-scheduled-monument', 'historic-place', 'local-heritage-record', 'nrhe'].includes(tag)) && !candidate.tags.includes('map-hidden'));
const undated = historicPins.filter((candidate) => !candidate.documentedDateText?.trim() || candidate.earliestPossibleYear == null || candidate.latestPossibleYear == null || candidate.dateBasis === 'unknown');
if (undated.length) throw new Error(`Undated Muchalls pins: ${undated.map((candidate) => candidate.id).join(', ')}`);

await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`);
await writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`);
await writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`);
await writeFile(reportPath, `${JSON.stringify({
  reviewedAt, townScore: 65, dogOwnerScore: 64, dogAccessRating: 2,
  categoryCounts: { see: highlights.length, eat: foods.length, trails: trails.length, picnic: 0, parking: 0, toilets: 0, importedHeritageRecords: pkg.features.filter((candidate) => candidate.tags.includes('nrhe') || candidate.tags.includes('hes-listed-building') || candidate.tags.includes('hes-designation')).length, visibleHeritagePins: historicPins.length },
  heritageDateAudit: { visiblePins: historicPins.length, dated: historicPins.length - undated.length, undated: undated.map((candidate) => candidate.id), hiddenRetainedRecords: pkg.features.filter((candidate) => candidate.tags.includes('heritage-record-retained')).map((candidate) => ({ id: candidate.id, reason: candidate.sourceRecords.at(-1)?.notes })), dateRule: 'Construction, opening or material-period dates only; never designation dates. Area records, duplicates, imprecise finds and records without defensible periods remain in the library but are hidden from the heat map.' },
  trailProviderSearches: [
    { provider: 'Bettridge Centre / Newtonhill Walks', result: 'Exact Muchalls Meander verified: live page, 1.38 miles, yellow waymarkers and downloadable map.' },
    { provider: 'Aberdeenshire Council Core Paths', result: 'Newtonhill and Muchalls path-network map verified.' },
    { provider: 'TreasureTrails.co.uk', result: 'No exact Muchalls product found; none published.' },
    { provider: 'Curious About', result: 'No exact Muchalls walk found; none published.' },
    { provider: 'Mystery Guides', result: 'No exact Muchalls product found; none published.' },
    { provider: 'Go Quest Adventures', result: 'No exact Muchalls quest found; none published.' },
  ],
  eatAudit: { published: ['The Stack Restaurant and Bar'], rationale: 'Restaurant-led but explicitly accepts coffee-only drop-ins and is the only verified in-boundary coffee/light-lunch option.', excluded: ['No second current in-boundary café, tearoom, bakery or farm-café premises was established. Newtonhill and Chapelton venues are outside the Muchalls boundary.'] },
  parking: { published: 0, result: 'No formal public visitor car park found on the council car-park directory. Pavement-parking exemptions on Monduff Road and Stranathro Terrace are recorded as restrictions/context, not presented as car parks.' },
  toilets: { published: 0, result: 'No Muchalls public toilet found on the current Aberdeenshire Council directory. Customer toilets are not presented as public facilities.' },
  picnic: { published: 0, result: 'No formal picnic tables or serviced picnic site verified. The coast may be used informally, but storm-damaged beach access prevents publication as a reliable picnic facility.' },
  boundaryExclusions: ['Newtonhill', 'Muchalls Castle', 'Chapelton', 'Portlethen', 'Stonehaven attractions'],
  accessWarning: 'The current local place plan states that the path to Muchalls beach was washed away by storms and must be reinstated; the beach is not presented as routine visitor access.',
  verification: { heritagePinsDated: `${historicPins.length - undated.length}/${historicPins.length}`, undatedHistoricPins: undated.length, checkedLinks: [urls.listedCottages, urls.muchallsMeander, urls.corePaths, urls.stackVisitor, urls.stack, urls.councilParking, urls.councilToilets, urls.conservationPlan] },
}, null, 2)}\n`);
console.log(`Muchalls audit complete: ${highlights.length} See, ${foods.length} Eat, ${trails.length} Trails, 0 Picnic, 0 Parking, 0 Toilets; ${historicPins.length - undated.length}/${historicPins.length} visible historic pins dated.`);
