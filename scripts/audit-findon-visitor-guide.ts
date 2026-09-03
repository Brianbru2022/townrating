import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { HeritageFeature, ProjectPackage, VisitorHighlight } from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';

const projectId = 'findon-aberdeenshire-scotland';
const reviewedDate = '2026-08-28';
const reviewedAt = '2026-08-28T22:30:00Z';
const projectPath = resolve('data/projects/findon-aberdeenshire.json');
const plannerPath = resolve('data/aberdeen-north-visitor-planner-curation.json');
const dogPath = resolve('data/aberdeen-north-dog-access-curation.json');
const reportPath = resolve('data/review/findon-full-visitor-audit-2026-08-28.json');
type F = HeritageFeature & Record<string, any>;
type P = ProjectPackage & { project: ProjectPackage['project'] & Record<string, any>; features: F[] };

const urls = {
  villageHer: 'https://her.aberdeenshire.gov.uk/Monument/MAB43014',
  oldInnHer: 'https://her.aberdeenshire.gov.uk/Monument/MAB43015/',
  cycleRoutes: 'https://www.aberdeenshire.gov.uk/media/25055/portlethen-cycling.pdf',
  corePaths: 'https://www.aberdeenshire.gov.uk/outdoor-access-and-countryside/paths/core-paths-plan',
  pathNetwork: 'https://www.aberdeenshire.gov.uk/outdoor-access-and-countryside/paths',
  coastalTrail: 'https://www.aberdeenshire.gov.uk/document-store/tourist-trails',
  coastalPathUpdate: 'https://aberdeenshire.moderngov.co.uk/documents/s24496/Appendix%2B4%2B-%2BNorth%2BEast%2BScotland%2BCoastal%2BTrail%2BAberdeenshire%2BCouncil%2BProject%2BUpdate.pdf',
  circuit: 'https://www.garioch.info/walks/Scotland/Aberdeenshire/Old%20Portlethen-Findon%20Moor%20Circuit.pdf',
  toilets: 'https://www.aberdeenshire.gov.uk/local/public-toilets',
  parking: 'https://www.aberdeenshire.gov.uk/roads-and-travel/car-parking/car-parks',
  placeStatement: 'https://aberdeenshire.moderngov.co.uk/Data/Aberdeenshire%20Council/20150312/Agenda/Appendix%208%20Kincardine%20and%20Mearns%20Settlement%20Statements.pdf',
  busPlanner: 'https://www.stagecoachbus.com/plan-a-journey',
  dogCode: 'https://www.outdooraccess-scotland.scot/dog-owners',
  treasureTrails: 'https://www.treasuretrails.co.uk/collections/aberdeenshire',
  curiousAbout: 'https://www.curiousabout.co.uk/',
  mysteryGuides: 'https://www.mysteryguides.co.uk/',
  goQuest: 'https://goquestadventures.com/',
};

const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as P;
const planner = JSON.parse(await readFile(plannerPath, 'utf8')) as any;
const dog = JSON.parse(await readFile(dogPath, 'utf8')) as any;
const assess = (score: number) => ({ experienceDepth: Math.round(score * .3), distinctiveness: Math.round(score * .2), presentation: Math.round(score * .2), journeyWorth: Math.round(score * .15), accessAndReliability: Math.round(score * .1), evidenceConfidence: score - Math.round(score * .3) - Math.round(score * .2) - Math.round(score * .2) - Math.round(score * .15) - Math.round(score * .1), visitability: 'full_visitor_experience' as const });
const review = (score: number, reason: string, evidenceUrls: string[], category: 'attraction' | 'trail' = 'attraction') => ({ status: 'editorially_researched', category, methodVersion: '2026-08-13-researched-visitor-value-v1', reviewedAt: reviewedDate, scoreRationale: reason, evidenceUrls, attractionAssessment: assess(score) });
const src = (name: string, org: string, url: string, notes: string, reliability: any = 'official_non_statutory') => ({ sourceName: name, sourceOrganisation: org, sourceUrl: url, accessedAt: reviewedAt, reliability, licence: 'Source-linked editorial evidence; verify time-sensitive details before travel.', notes });
const make = (s: Record<string, any>): F => ({
  id: s.id, projectId, name: s.name, alternativeNames: [], countryCode: 'GB-SCT', region: 'Aberdeenshire', locality: 'Findon', featureType: s.featureType,
  significance: s.significance ?? 'local', geometry: { type: 'Point', coordinates: s.coordinates }, locationType: s.locationType ?? 'representative_point', locationConfidence: s.locationConfidence ?? 'medium',
  dateBasis: 'unknown', dateConfidence: 'unknown', survival: 'substantially_intact', shortDescription: s.description, visitorWebsiteUrl: s.website,
  attractionGuide: s.guide, editorialReview: review(s.score, s.reason, s.evidenceUrls, s.category),
  sourceRecords: s.evidenceUrls.map((url: string, i: number) => src(i ? `${s.name} supporting evidence` : s.sourceName, i ? 'Supporting publisher' : s.sourceOrganisation, url, `Current-place curation: visitor_place_type=${s.placeType}; visit_score=${s.score}; ${s.details ?? ''}; description=${s.description}`, url.includes('aberdeenshire.gov.uk') ? 'local_authority' : 'official_non_statutory')),
  tags: s.tags, createdAt: reviewedAt, updatedAt: reviewedAt, reviewed: true, evidenceScope: 'parish_evidence',
}) as F;

const addTag = (feature: F, tag: string) => { feature.tags = [...new Set([...(feature.tags ?? []), tag])]; };
const removeTag = (feature: F, tag: string) => { feature.tags = (feature.tags ?? []).filter((candidate: string) => candidate !== tag); };
const dateFeature = (feature: F, text: string, earliest: number, latest: number, sourceUrl: string) => {
  feature.documentedDateText = text;
  feature.earliestPossibleYear = earliest;
  feature.latestPossibleYear = latest;
  feature.dateBasis = 'documented_period';
  feature.dateConfidence = 'high';
  feature.datePrecision = 'period_range';
  feature.updatedAt = reviewedAt;
  addTag(feature, 'date-reviewed');
  removeTag(feature, 'map-hidden');
  if (!feature.sourceRecords.some((record: any) => record.sourceUrl === sourceUrl)) feature.sourceRecords.push(src(`${feature.name} date evidence`, 'Aberdeenshire Council Historic Environment Record', sourceUrl, `Construction or material-period evidence used for the heat date: ${text}.`, 'local_authority'));
};
const hideFeature = (feature: F, reason: string) => {
  addTag(feature, 'map-hidden');
  addTag(feature, 'heritage-record-retained');
  feature.updatedAt = reviewedAt;
  const notes = `Record retained in the project library but hidden from the heat map: ${reason}`;
  if (!feature.sourceRecords.some((record: any) => record.notes === notes)) feature.sourceRecords.push(src(`${feature.name} visibility review`, 'Heatmap editorial audit', feature.sourceRecords[0]?.sourceUrl ?? urls.villageHer, notes, 'secondary_research'));
};
const feature = (id: string) => {
  const found = pkg.features.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`Missing imported Findon heritage record ${id}`);
  return found;
};

// The local HES/NRHE layer is kept complete. Only individually positioned,
// period-supported records appear as historic heat points.
const oldInn = feature('nrhe:183772');
oldInn.name = 'Site of the Old Inn, Findon';
oldInn.shortDescription = 'The local heritage record identifies the former inn as a post-medieval component of the fishing village.';
dateFeature(oldInn, 'Post-medieval, 1561–1899', 1561, 1899, urls.oldInnHer);
addTag(oldInn, 'historic-place');

const villageRecord = feature('nrhe:118805');
dateFeature(villageRecord, 'Post-medieval fishing village, 1561–1899', 1561, 1899, urls.villageHer);
hideFeature(villageRecord, 'This is an aggregate whole-village record rather than an individual structure; the visitor attraction and town marker already represent the settlement.');

for (const [id, reason] of [
  ['nrhe:37204', 'The Gallows Hill record has 100-metre positional accuracy and no defensible period in the local NRHE extract.'],
  ['nrhe:118806', 'The Findon Farm record has no defensible construction period in the local NRHE extract.'],
  ['nrhe:183769', 'The Blackhill record has no defensible construction period in the local NRHE extract.'],
  ['nrhe:183773', 'The Findon Croft record has no defensible construction period in the local NRHE extract.'],
] as const) hideFeature(feature(id), reason);

const village = make({
  id: 'curated-attractions:findon-fishing-village', name: 'Findon Fishing Village and Finnan Haddie Story', featureType: 'historic_settlement', coordinates: [-2.10445, 57.06868], website: urls.villageHer,
  description: 'A compact former fishing village whose historic record links Findon with the first preparation of the smoked fish known as Findon or Finnan haddock.',
  reason: 'Findon has a genuinely distinctive food-history association and a surviving compact village pattern, but there is no museum, formal interpretation centre or substantial indoor attraction.', evidenceUrls: [urls.villageHer, urls.placeStatement], sourceName: 'Findon Historic Environment Record', sourceOrganisation: 'Aberdeenshire Council', placeType: 'Attraction', score: 67, category: 'attraction',
  tags: ['curated-visitor', 'home-standalone-place', 'historic-place-context', 'current-context'],
  guide: { headline: 'Walk the village associated with the original Finnan haddie', parking: 'No dedicated visitor car park has been verified; use only lawful roadside space without obstructing residents or access.', toilets: 'No public toilet has been verified in Findon.', picnic: 'No formal picnic tables or serviced picnic site have been verified.', foodNote: 'No current in-village café, tearoom or bakery has been verified.', accessibility: 'The village roads are narrow and the coastal approaches are uneven; there is no verified accessible visitor facility.' },
});
const coast = make({
  id: 'curated-attractions:findon-moor-coastal-view', name: 'Findon Moor Coastal View', featureType: 'natural_landmark', coordinates: [-2.09825, 57.06605], website: urls.coastalPathUpdate,
  description: 'An exposed clifftop outlook over the rocky Findon coast, reached by the local path network rather than a serviced viewpoint.',
  reason: 'The open coast strengthens a short Findon visit and is visually distinctive, but rough ground, cliff exposure and incomplete coastal-path infrastructure limit reliability and accessibility.', evidenceUrls: [urls.coastalPathUpdate, urls.corePaths, urls.circuit], sourceName: 'North East Scotland Coastal Trail project update', sourceOrganisation: 'Aberdeenshire Council', placeType: 'Attraction', score: 64, category: 'attraction',
  tags: ['curated-visitor', 'home-standalone-place', 'natural-place', 'current-context'],
  guide: { headline: 'Look east from Findon Moor across the exposed Kincardineshire coast', parking: 'No dedicated viewpoint parking has been verified.', toilets: 'No public toilet has been verified.', picnic: 'This is not a serviced picnic site; take litter away.', foodNote: 'Bring refreshments or use Portlethen services outside the Findon boundary.', accessibility: 'Uneven paths, cliff edges and the Findon Burn crossing make this unsuitable as an assured step-free attraction.' },
});
const trail = make({
  id: 'curated-trails:old-portlethen-findon-moor-circuit', name: 'Old Portlethen–Findon Moor Circuit', featureType: 'walking_route', coordinates: [-2.1049, 57.0675], website: urls.circuit,
  description: 'A published 5.7-mile circuit linking Old Portlethen, Findon Moor and Findon village, with coastal paths, steps, rough sections and the Findon Burn crossing.',
  reason: 'This is the strongest conventional walk that explicitly includes Findon and provides detailed route instructions, distance and mapping. It is a wider circuit, so only the Findon section supports the village audit.', evidenceUrls: [urls.circuit, urls.pathNetwork, urls.coastalPathUpdate], sourceName: 'Old Portlethen–Findon Moor Circuit', sourceOrganisation: 'The Mack Walks', placeType: 'Trail', score: 68, category: 'trail', details: 'distance=5.7 miles; duration=about 3 hours; format=downloadable PDF; route_link_checked=2026-08-28; extent=route starts outside Findon and only its Findon section supports the town score; access=steps, rough and seasonally overgrown paths, burn crossing',
  tags: ['curated-visitor', 'service-context-trail', 'visitor-context-trail', 'current-context'],
});

const curated = [village, coast, trail];
const curatedIds = new Set(curated.map((candidate) => candidate.id));
pkg.features = [...pkg.features.filter((candidate) => !curatedIds.has(candidate.id)), ...curated];
const attractions = [village, coast];
const highlights: VisitorHighlight[] = attractions.map((item, index) => ({ rank: index + 1, featureId: item.id, name: item.name, reason: item.editorialReview!.scoreRationale, tagline: index ? 'Exposed coastal outlook' : 'Home of the Finnan haddie story', visitorScore: item.editorialReview!.attractionAssessment!.experienceDepth + item.editorialReview!.attractionAssessment!.distinctiveness + item.editorialReview!.attractionAssessment!.presentation + item.editorialReview!.attractionAssessment!.journeyWorth + item.editorialReview!.attractionAssessment!.accessAndReliability + item.editorialReview!.attractionAssessment!.evidenceConfidence, timeToSpend: index ? '30–60 minutes' : '30–45 minutes', openingTimes: 'Open-air visit in daylight; respect private homes and current path conditions', admission: 'Free', freeAdmission: true, visitorWebsiteUrl: item.visitorWebsiteUrl, attractionGuide: item.attractionGuide, editorialReview: item.editorialReview, sourceName: item.sourceRecords[0].sourceName, sourceUrl: item.visitorWebsiteUrl!, verifiedInBoundaryAt: reviewedDate }));

pkg.project.preferredBasemap = 'voyager';
pkg.project.boundarySource = 'Conservative 520-metre Findon settlement study boundary covering the historic village and its immediate moorland edge; Portlethen, Old Portlethen, Downies and wider coastal attractions are excluded';
pkg.project.boundaryConfidence = 'medium';
pkg.project.touristAppeal = { score: 61, dogOwnerScore: 60, dogAccessScoreAdjustment: -1, rating: 0, label: 'Notable Stop', summary: 'A very small former fishing village with a distinctive Finnan-haddie story, surviving historic character and an exposed coastal setting.', dogAccessRating: 2, dogAccessSummary: 'Outdoor walking suits dogs, but narrow roads, exposed cliffs, livestock and wildlife, steps and rough or overgrown paths require close control.', methodVersion: '2026-08-28-strict-settlement-full-audit-v2', reviewedAt: reviewedDate, sourceUrls: Object.values(urls) };
pkg.project.visitorHighlights = highlights;
pkg.project.visualIdentity = {
  theme: 'findon-fishing-cove-watercolour',
  badgeImage: '/town-guides/findon-fishing-cove-watercolour-guide-v1.png',
  badgeAlt: 'Illustrated view of Findon’s sheltered rocky fishing cove with small boats, grassy cliffs and a white fishing cottage',
  heroImage: '/town-guides/findon-fishing-cove-watercolour-guide-v1.png',
  heroAlt: 'Watercolour guide illustration of Findon’s small boats drawn up in a rocky cove below a white fishing cottage and the North Sea',
  heroObjectPosition: '50% 58%',
  motifs: ['Sheltered fishing cove', 'Small boats', 'White fishing cottage', 'North Sea cliffs'],
  primaryColour: '#245C68',
  accentColour: '#B67B2D',
  backgroundColour: '#EAF2ED',
};
pkg.project.townGuide = {
  characterTag: 'Finnan haddie fishing village and exposed coast', headline: 'A tiny coastal village with one unusually strong story',
  intro: 'Findon remains at 61% because the village itself has a distinctive fishing identity, the documented Finnan-haddie association and immediate clifftop character. Portlethen services, Old Portlethen, Downies and wider coastal attractions are not counted.',
  bestFor: ['Fishing-village history', 'Finnan haddie story', 'Coastal walking'], perfectFor: ['A short historic-village stop', 'The Findon section of a longer coastal walk'],
  suggestedFirstVisit: { title: 'Village and moor', summary: 'Walk through the old village, read its Finnan-haddie story, then use the current path information for a cautious clifftop extension.' },
  dontMiss: attractions.map((item) => item.name), suggestedTime: '1–2 hours', visitorMood: 'Quiet, residential and exposed, with a distinctive story but almost no visitor infrastructure.',
  practicalNote: 'No current in-village café, formal visitor car park, public toilet or serviced picnic site was verified. The council settlement statement describes Findon as having no services and depending on Portlethen.',
  transportNote: 'Check the current Stagecoach journey planner before travelling. Findon has no railway station.',
  accessibilityNote: 'Narrow village roads and rough, stepped coastal paths limit accessibility. No designated accessible visitor parking or accessible public toilet has been verified.',
  sourceUrls: Object.values(urls), lastReviewedAt: reviewedDate,
};

planner.projects[projectId] = { eat: [], trails: [trail.id], parking: [], toilets: [], picnic: [] };
const dogReview = (rating: number, status: string, label: string, summary: string, sourceUrl: string) => ({ rating, status, label, summary, sourceName: 'Findon dog-access audit', sourceUrl, reviewedAt: reviewedDate });
dog.reviewedAt = reviewedDate;
dog.projects[projectId] = {
  attraction: {
    [village.id]: dogReview(2, 'restricted', 'Residential village walk', 'Dogs can accompany the exterior village visit; use a short lead on narrow roads and respect private homes.', urls.dogCode),
    [coast.id]: dogReview(2, 'restricted', 'Exposed coast with close control', 'Keep dogs close around cliffs, livestock, wildlife, rough ground and the burn crossing.', urls.dogCode),
  },
  trail: { [trail.id]: dogReview(2, 'restricted', 'Rough coastal circuit', 'The route includes roads, steps, rough or overgrown paths and exposed coast; close control is necessary.', urls.dogCode) },
  eat: {},
};

pkg.validation = validateFeatures(pkg.project, pkg.features);
const errors = pkg.validation.filter((entry: any) => entry.severity === 'error');
if (errors.length) throw new Error(errors.map((entry: any) => entry.message).join('; '));
const historicPins = pkg.features.filter((candidate) => candidate.tags.some((tag: string) => ['hes-listed-building', 'hes-scheduled-monument', 'historic-place', 'local-heritage-record', 'nrhe'].includes(tag)) && !candidate.tags.includes('map-hidden'));
const undated = historicPins.filter((candidate) => !candidate.documentedDateText?.trim() || candidate.earliestPossibleYear == null || candidate.latestPossibleYear == null || candidate.dateBasis === 'unknown');
if (undated.length) throw new Error(`Undated Findon pins: ${undated.map((candidate) => candidate.id).join(', ')}`);

await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`);
await writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`);
await writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`);
await writeFile(reportPath, `${JSON.stringify({
  reviewedAt, townScore: 61, dogOwnerScore: 60, dogAccessRating: 2,
  categoryCounts: { see: highlights.length, eat: 0, trails: 1, picnic: 0, parking: 0, toilets: 0, importedHeritageRecords: pkg.features.filter((candidate) => candidate.id.startsWith('nrhe:') || candidate.tags.includes('hes-listed-building') || candidate.tags.includes('hes-designation')).length, visibleHeritagePins: historicPins.length },
  settlementMerit: { result: 'retain_on_map', rationale: 'Findon narrowly clears 60 on the settlement itself: a compact historic fishing-village pattern, the documented Finnan-haddie association and immediate coastal character. No neighbouring attraction or Portlethen service is counted.' },
  heritageDateAudit: { importedRecords: pkg.features.filter((candidate) => candidate.id.startsWith('nrhe:')).map((candidate) => candidate.id), visiblePins: historicPins.length, dated: historicPins.length - undated.length, undated: undated.map((candidate) => candidate.id), hiddenRetainedRecords: pkg.features.filter((candidate) => candidate.tags.includes('heritage-record-retained')).map((candidate) => ({ id: candidate.id, reason: candidate.sourceRecords.at(-1)?.notes })), dateRule: 'Construction or material-period dates only; never designation dates. Aggregate, imprecise and unsupported-period records remain in the library but are hidden from the heat map.' },
  trailProviderSearches: [
    { provider: 'The Mack Walks', result: 'Old Portlethen–Findon Moor Circuit verified: live downloadable PDF, 5.7 miles, roughly 3 hours, with mapped instructions and access cautions.' },
    { provider: 'Aberdeenshire Council', result: 'Core paths, Portlethen cycling routes and the current North East Scotland Coastal Trail project update checked; coastal infrastructure at Findon Burn remains work in progress.' },
    { provider: 'TreasureTrails.co.uk', result: 'No exact Findon or Portlethen product found in the current Aberdeenshire catalogue; Aberdeen products are outside the boundary.' },
    { provider: 'Curious About', result: 'No exact Findon or Portlethen walk found; Aberdeen city walks are outside the boundary.' },
    { provider: 'Mystery Guides', result: 'No exact Findon or Portlethen product found.' },
    { provider: 'Go Quest Adventures', result: 'No exact Findon or Portlethen quest found.' },
  ],
  eatAudit: { published: [], result: 'No current in-boundary café, coffee shop, tearoom, bakery or dependable light-lunch stop was verified. Portlethen and Chapelton venues are outside the boundary.' },
  parking: { published: 0, result: 'No formal public visitor car park was verified. Residential roadside space is not published as visitor parking.' },
  toilets: { published: 0, result: 'Findon does not appear in the current Aberdeenshire Council public-toilet directory.' },
  picnic: { published: 0, result: 'No formal picnic tables or serviced picnic site were verified; the cliff edge is not promoted as a facility.' },
  boundaryExclusions: ['Portlethen', 'Old Portlethen', 'Downies', 'Chapelton', 'Cove Bay', 'wider Aberdeenshire Coastal Trail attractions'],
  verification: { heritagePinsDated: `${historicPins.length - undated.length}/${historicPins.length}`, undatedHistoricPins: undated.length, checkedLinks: [urls.villageHer, urls.oldInnHer, urls.circuit, urls.pathNetwork, urls.coastalPathUpdate, urls.toilets, urls.parking, urls.placeStatement] },
}, null, 2)}\n`);

console.log(`Findon audit complete: ${highlights.length} See, 0 Eat, 1 Trails, 0 Picnic, 0 Parking, 0 Toilets; ${historicPins.length - undated.length}/${historicPins.length} visible historic pins dated.`);
