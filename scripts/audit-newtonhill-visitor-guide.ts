import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { HeritageFeature, ProjectPackage, VisitorHighlight } from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';

const id = 'newtonhill-scotland';
const day = '2026-09-02';
const at = '2026-09-02T11:45:00Z';
const projectPath = resolve('data/projects/newtonhill.json');
const plannerPath = resolve('data/aberdeen-north-visitor-planner-curation.json');
const dogPath = resolve('data/aberdeen-north-dog-access-curation.json');
const reportPath = resolve('data/review/newtonhill-full-visitor-audit-2026-09-02.json');
type F = HeritageFeature & Record<string, any>;
type P = ProjectPackage & { project: ProjectPackage['project'] & Record<string, any>; features: F[] };

const urls = {
  councilMaps: 'https://publications.aberdeenshire.gov.uk/cycling-and-walking-maps',
  councilMap: 'https://www.aberdeenshire.gov.uk/media/27676/newtonhill-cycling-and-walking.pdf',
  walks: 'https://www.bettridgecentre.org.uk/newtonhill-walks.html',
  centre: 'https://www.bettridgecentre.org.uk/facilities.html',
  centreAbout: 'https://www.bettridgecentre.org.uk/about-us.html',
  recycling: 'https://www.aberdeenshire.gov.uk/waste/recycling/recycling-point/',
  publicToilets: 'https://www.aberdeenshire.gov.uk/local/public-toilets',
  storeCurrent: 'https://restaurantguru.com/Skateraw-Store-Newtonhill',
  storeFsa: 'https://www.eatible.co.uk/scotland/aberdeenshire/skateraw-store',
  hesCottage: 'https://portal.historicenvironment.scot/designation/LB13483',
  hesHouse: 'https://portal.historicenvironment.scot/designation/LB13484',
  hesSmokehouse: 'https://portal.historicenvironment.scot/designation/LB9363',
  treasure: 'https://www.treasuretrails.co.uk/collections/aberdeenshire',
  curious: 'https://curiousabout.co.uk/',
  mystery: 'https://www.mysteryguides.co.uk/pages/scotland',
  goQuest: 'https://goquestadventures.com/',
  dogCode: 'https://www.outdooraccess-scotland.scot/dog-owners',
};

const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as P;
const planner = JSON.parse(await readFile(plannerPath, 'utf8')) as any;
const dog = JSON.parse(await readFile(dogPath, 'utf8')) as any;
const source = (name: string, organisation: string, url: string, notes: string, reliability: any = 'official_non_statutory') => ({ sourceName: name, sourceOrganisation: organisation, sourceUrl: url, accessedAt: at, reliability, licence: 'Source-linked editorial evidence; verify time-sensitive details before travel.', notes });

const make = (spec: { id: string; name: string; featureType: any; coordinates: [number, number]; score: number; category: 'attraction' | 'food' | 'trail'; description: string; website: string; reason: string; details?: string; tags: string[]; evidence: any[]; assessment: Record<string, any> }): F => ({
  id: spec.id, projectId: id, name: spec.name, alternativeNames: [], countryCode: 'GB-SCT', region: 'Aberdeenshire', locality: 'Newtonhill', featureType: spec.featureType, significance: spec.score >= 70 ? 'regional' : 'local', geometry: { type: 'Point', coordinates: spec.coordinates }, locationType: 'exact', locationConfidence: 'high', dateBasis: 'unknown', dateConfidence: 'unknown', survival: 'substantially_intact', shortDescription: spec.description, visitorWebsiteUrl: spec.website, details: spec.details,
  editorialReview: { status: 'editorially_researched', category: spec.category, methodVersion: '2026-09-02-researched-visitor-value-v1', reviewedAt: day, scoreRationale: spec.reason, evidenceUrls: spec.evidence.map((entry: any) => entry.sourceUrl), visitability: 'full_visitor_experience', attractionAssessment: spec.assessment },
  sourceRecords: spec.evidence, tags: spec.tags, createdAt: at, updatedAt: at, reviewed: true, evidenceScope: 'parish_evidence',
});

const heritage = make({
  id: 'curated-attraction:newtonhill-skateraw-and-bay', name: 'Old Skateraw Fishing Row and Newtonhill Bay', featureType: 'beach', coordinates: [-2.1431, 57.03239], score: 64, category: 'attraction', website: urls.councilMap,
  description: 'The old fishing-village edge of Newtonhill, where a cobbled bay, the former smokehouse and circa-1800 cottages survive along Skateraw Road.',
  reason: 'A coherent and publicly visible historic-coastal stop rather than a managed attraction. The council route provides a dependable way to experience it; modest interpretation and the rough shore limit journey-worth.',
  details: 'visit_score=64; access=open-air public roads and shore approach; admission=free; facilities=use Newtonhill services; warning=rough shore, steps, erosion and exposed coast',
  tags: ['curated-visitor', 'home-standalone-place', 'current-context'],
  evidence: [source('Newtonhill cycling and walking map', 'Aberdeenshire Council', urls.councilMap, 'Official map identifies the old fishing village, bay and local route.', 'local_authority'), source('Old Smokehouse LB9363', 'Historic Environment Scotland', urls.hesSmokehouse, 'Official designation dates the surviving smokehouse to probably the late 18th century.', 'official_statutory'), source('St Margaret\'s Cottage LB13483', 'Historic Environment Scotland', urls.hesCottage, 'Official designation dates the cottage to circa 1800.', 'official_statutory')],
  assessment: { experienceDepth: 13, distinctiveness: 14, presentation: 8, journeyWorth: 8, accessAndReliability: 10, evidenceConfidence: 7 },
});

const routeSpecs = [
  ['beach-and-mill', 'Beach and Mill Circuit', [-2.144021, 57.03177], 64, 'Purple-waymarked 1.01-mile circuit linking the old fishing edge, beach and former mill landscape.'],
  ['craig-stirling', 'Craig Stirling Clifftop Seabird Stroll', [-2.14125, 57.034916], 66, 'Green-waymarked 1.1-mile coastal circuit with clifftop and seabird interest.'],
  ['backburn-loop', 'Backburn Loop', [-2.146995, 57.037328], 60, 'Orange-waymarked 1.56-mile local circuit with downloadable route mapping.'],
  ['silvers-bridge', 'Silvers Bridge Stroll', [-2.149233, 57.03217], 60, 'Blue-waymarked 1.38-mile circuit; the operator warns that one newer-estate section is approximate on the OS map.'],
] as const;
const trails = routeSpecs.map(([slug, name, coordinates, score, description]) => make({
  id: `curated-trail:newtonhill-${slug}`, name, featureType: 'trail', coordinates: coordinates as [number, number], score, category: 'trail', website: urls.walks, description,
  reason: 'An exact named local circuit with stated distance, colour waymarkers, start point and downloadable mapping. Field-edge, clifftop or erosion conditions still require an on-the-day check.',
  details: `visit_score=${score}; route_link_checked=${day}; provider=Newtonhill Walks / Bettridge Centre; mapping=downloadable; waymarked=yes; warning=read the route-specific notes and Scottish Outdoor Access Code`,
  tags: ['curated-trails', 'service-context-trail', 'current-context'], evidence: [source('Newtonhill Walks', 'Bettridge Centre / local project supported by Aberdeenshire Council Phoenix Fund', urls.walks, 'Current operator page gives exact route name, mileage, waymarker colour, start point and downloads.'), source('Newtonhill cycling and walking map', 'Aberdeenshire Council', urls.councilMap, 'Council-published walking and cycling context.', 'local_authority')],
  assessment: { experienceDepth: 15, distinctiveness: name.includes('Clifftop') ? 15 : 11, presentation: 15, journeyWorth: name.includes('Clifftop') ? 10 : 7, accessAndReliability: 11, evidenceConfidence: 7 },
}));

const eat = make({
  id: 'curated-food:newtonhill-skateraw-store', name: 'Skateraw Store', featureType: 'cafe', coordinates: [-2.14872, 57.03198], score: 78, category: 'food', website: urls.storeCurrent,
  description: 'Family-run village café and shop serving coffee, home baking, pastries, breakfast, soup and sandwiches.',
  reason: 'A strong match for coffee, cake and a light lunch in the historic Skateraw part of the village. Current hours and menu scope were cross-checked against a recent listing and the food-hygiene record.',
  details: 'visit_score=78; opening_hours:description=Wednesday-Saturday 10:00-16:00 in the current listing; price_band=£; cuisine=coffee_cake_light_lunch; dog_policy=current customer evidence says dog friendly but confirm before travel',
  tags: ['service-context-food', 'visitor-context-food', 'current-context'], evidence: [source('Skateraw Store current venue listing', 'Restaurant Guru / operator social links', urls.storeCurrent, 'Current 2026 hours, address and coffee/cake/light-lunch scope.'), source('Skateraw Store food hygiene record', 'Food Standards Agency data via Eatible', urls.storeFsa, 'Cross-checks the active business, address and 2024 inspection.')],
  assessment: { foodAndDrinkQuality: 23, daytimeRelevance: 19, distinctiveness: 12, consistency: 11, visitorFit: 8, evidenceConfidence: 5 },
});

const parking = make({
  id: 'curated-parking:newtonhill-bettridge-centre', name: 'Bettridge Centre Car Park', featureType: 'other', coordinates: [-2.14889, 57.02975], score: 60, category: 'attraction', website: urls.centre,
  description: 'The community-centre car park used as a start point for Newtonhill walking routes; the centre explicitly states that free parking is available.',
  reason: 'Dependable route-start parking with an explicit free-parking statement. Capacity, disabled-bay count, maximum stay and overnight rules are not published, so signs govern.',
  details: 'amenity=parking; fee=no; capacity=Not published; capacity:disabled=Not published; payment_methods=not applicable; maxstay=Not published; overnight=Not published; restrictions=Check signs and do not obstruct community-centre users',
  tags: ['service-context-parking', 'current-context'], evidence: [source('Bettridge Centre facilities', 'Newtonhill Community Hall Association', urls.centre, 'Current operator states free car parking.'), source('Newtonhill walking map', 'Aberdeenshire Council', urls.councilMap, 'Official route directions use the community-centre car park as a start.', 'local_authority'), source('Recycling points', 'Aberdeenshire Council', urls.recycling, 'Council identifies the Newtonhill community-hall car park.', 'local_authority')],
  assessment: { experienceDepth: 8, distinctiveness: 5, presentation: 9, journeyWorth: 7, accessAndReliability: 17, evidenceConfidence: 7 },
});

const curatedIds = new Set([heritage.id, eat.id, parking.id, ...trails.map((feature) => feature.id)]);
pkg.features = [...pkg.features.filter((feature) => !curatedIds.has(feature.id)), heritage, eat, parking, ...trails];
const highlight: VisitorHighlight = { rank: 1, featureId: heritage.id, name: heritage.name, reason: heritage.editorialReview.scoreRationale, tagline: 'Historic fishing edge and cobbled bay', visitorScore: 64, timeToSpend: '45–90 minutes with a short circuit', openingTimes: 'Open-air; daylight advised', admission: 'Free', freeAdmission: true, visitorWebsiteUrl: urls.councilMap, editorialReview: heritage.editorialReview, sourceName: 'Aberdeenshire Council', sourceUrl: urls.councilMap, verifiedInBoundaryAt: day };

pkg.project.preferredBasemap = 'voyager';
pkg.project.boundarySource = 'Strict Newtonhill settlement and immediate Skateraw bay boundary. Muchalls, Chapelton, Downies and attractions beyond the village are excluded.';
pkg.project.boundaryConfidence = 'medium';
pkg.project.touristAppeal = { score: 62, dogOwnerScore: 61, dogAccessScoreAdjustment: -1, rating: 1, label: 'Worth a Stop', summary: 'A modest but coherent coastal stop: old Skateraw and its bay, four verified local circuits, a strong café and practical route-start parking.', dogAccessRating: 2, dogAccessSummary: 'The outdoor circuits can suit responsible dog walking, but cliffs, shore conditions, field edges, wildlife, roads and other users require close control.', methodVersion: '2026-09-02-strict-settlement-full-audit-v3', reviewedAt: day, sourceUrls: Object.values(urls) };
pkg.project.visitorHighlights = [highlight];
pkg.project.townGuide = { characterTag: 'Old fishing edge beneath a modern coastal village', headline: 'Short coastal walks, heritage and a worthwhile café', intro: 'Newtonhill scores 62% after a complete second pass. The old Skateraw row and cobbled bay, four exact in-boundary circuits, Skateraw Store and free route-start parking now form a genuine short visit. Downies and Muchalls routes are excluded from the score.', bestFor: ['Short coastal circuits', 'Fishing-village traces', 'Coffee and cake'], perfectFor: ['A 1–2 hour coastal pause'], suggestedFirstVisit: { title: 'Walk the Beach and Mill Circuit', summary: 'Start from the Bettridge Centre, explore Skateraw and the bay, then stop at Skateraw Store.' }, dontMiss: ['Old Skateraw Fishing Row and Newtonhill Bay', 'Craig Stirling Clifftop Seabird Stroll', 'Skateraw Store'], suggestedTime: '1–2 hours', visitorMood: 'Local rather than polished, with real coastal character.', sourceUrls: Object.values(urls), lastReviewedAt: day };
pkg.project.researchNotes = 'Full current-web and HES audit. All six visitor categories and four named clue-trail providers checked. Downies Shore and Muchalls Meander are valid routes but excluded from Newtonhill publication and scoring because their destinations lie outside the strict settlement boundary. All three in-boundary HES listed-building pins are present and materially dated; dates remain metadata and are not appended to map labels.';
planner.projects[id] = { eat: [eat.id], trails: trails.map((feature) => feature.id), picnic: [], parking: [parking.id], toilets: [] };
dog.reviewedAt = day;
dog.projects[id] = { eat: { [eat.id]: { rating: 2, status: 'restricted', label: 'Confirm current access', summary: 'Recent customer evidence reports a dog-friendly café, but the operator does not publish a formal policy; confirm before travel.', sourceName: 'Current venue listing', sourceUrl: urls.storeCurrent, reviewedAt: day } }, trail: Object.fromEntries(trails.map((feature) => [feature.id, { rating: 2, status: 'restricted', label: 'Outdoor route under close control', summary: 'Use a lead or reliable close control beside cliffs, shore, roads, fields and wildlife.', sourceName: 'Scottish Outdoor Access Code', sourceUrl: urls.dogCode, reviewedAt: day }])) };

pkg.validation = validateFeatures(pkg.project, pkg.features);
const errors = pkg.validation.filter((entry: any) => entry.severity === 'error');
if (errors.length) throw new Error(errors.map((entry: any) => entry.message).join('; '));
const statutory = pkg.features.filter((feature) => feature.tags.includes('hes-listed-building'));
const visible = statutory.filter((feature) => !feature.tags.includes('map-hidden'));
const undated = visible.filter((feature) => !feature.documentedDateText || feature.earliestPossibleYear == null || feature.latestPossibleYear == null || feature.dateBasis === 'unknown');
if (statutory.length !== 3 || undated.length) throw new Error(`Newtonhill HES gate failed: statutory=${statutory.length}, undated=${undated.map((feature) => feature.id).join(', ')}`);
const report = {
  reviewedAt: at, projectId: id, place: 'Newtonhill', townScore: 62, mapPublished: true,
  categories: {
    see: { audited: true, published: 1 }, eat: { audited: true, published: 1 },
    trails: { audited: true, published: 4, excluded: ['Downies Shore: outside strict Newtonhill destination boundary.', 'Muchalls Meander: belongs to Muchalls.'], providerChecks: { TreasureTrails: 'Aberdeenshire catalogue checked; no Newtonhill product.', CuriousAbout: 'No exact Newtonhill route found.', MysteryGuides: 'Scotland catalogue checked; no Newtonhill product.', GoQuestAdventures: 'No exact Newtonhill quest found.', NewtonhillWalks: 'Six named routes checked; four in-boundary circuits published with live route page and downloads.', officialCouncilRoutes: 'Current council Newtonhill cycling and walking publication verified.' } },
    picnic: { audited: true, published: 0, note: 'No formal public picnic tables or dedicated picnic site verified inside the boundary.' }, parking: { audited: true, published: 1, note: 'Bettridge Centre operator verifies free parking; capacity and restrictions are not published.' }, toilets: { audited: true, published: 0, note: 'Newtonhill is absent from the current council public-toilet list; no public visitor toilet published.' },
  },
  hes: { assigned: statutory.length, visibleDated: visible.length - undated.length, hiddenUndated: statutory.length - visible.length, visibleUndated: undated.length, missing: 0, records: statutory.map((feature) => ({ id: feature.id, documentedDateText: feature.documentedDateText, dateBasis: feature.dateBasis })) },
  boundaryRule: 'Muchalls, Chapelton, Downies and all out-of-boundary attractions and services excluded.', research: { currentWebResearch: true, strictBoundaryChecked: true, sourceChecks: Object.values(urls).map((url) => ({ url, checkedAt: day, outcome: 'checked' })) },
  scoreReanalysis: { required: true, completed: true, previousScore: 58, resultScore: 62, rationale: 'The former 58 was an incomplete gate score. Full research established one coherent historic-coastal See, four exact in-boundary circuits, a strong daytime café and verified free route-start parking, enough for the lowest published band without borrowing neighbouring places.' },
  certification: { publicationCountsReconciled: true, liveBrowserVerifiedAt: null },
};

await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`);
await writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`);
await writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`);
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Newtonhill audit complete: score 62; 1 See, 1 Eat, 4 Trails, 0 Picnic, 1 Parking, 0 Toilets; ${visible.length - undated.length}/${visible.length} visible HES pins dated.`);
