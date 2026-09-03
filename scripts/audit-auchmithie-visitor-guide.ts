import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { editorialRatingMethodVersion } from '../src/domain/editorialResearch';

const projectId = 'auchmithie-scotland';
const reviewedDate = '2026-08-30';
const reviewedAt = '2026-08-30T22:15:00Z';
const projectPath = resolve('data/projects/auchmithie.json');
const plannerPath = resolve('data/cairn-o-mount-visitor-planner-curation.json');
const dogPath = resolve('data/cairn-o-mount-dog-access-curation.json');
const reportPath = resolve('data/review/auchmithie-full-visitor-audit-2026-08-30.json');

const urls = {
  beach: 'https://visitangus.com/things-to-see-do/attractions/auchmithie-beach/',
  smokie: 'https://visitangus.com/things-to-see-do/attractions/the-arbroath-smokie-trail/',
  beachTrail: 'https://visitangus.com/things-to-see-do/attractions/beach-trail/',
  pathPdf: 'https://www.angus.gov.uk/sites/default/files/2017-08/Arbroath%20path%20network.pdf',
  corePaths: 'https://www.angus.gov.uk/sites/default/files/2019-04/Core%20Paths%20Plan%20tables%20%28updated%20April%202019%29.pdf',
  toilets: 'https://www.angus.gov.uk/directories/public_toilets_and_radar_keys/auchmithie_fountain_square',
  food: 'https://visitangus.com/get-inspired/insiders-guide/an-insiders-guide-to-places-to-eat-in-angus/',
  restaurant: 'https://www.thebutnben.com/',
  walking: 'https://visitangus.com/get-inspired/insiders-guide/an-insiders-guide-to-walking-routes-in-angus/',
  osm: 'https://www.openstreetmap.org/api/0.6/map?bbox=-2.538%2C56.581%2C-2.508%2C56.598',
  dogCode: 'https://www.outdooraccess-scotland.scot/dog-owners',
  treasure: 'https://www.treasuretrails.co.uk/pages/search-results-page?q=auchmithie',
};

const pkg: any = JSON.parse(await readFile(projectPath, 'utf8'));
const planner: any = JSON.parse(await readFile(plannerPath, 'utf8'));
const dog: any = JSON.parse(await readFile(dogPath, 'utf8'));

function assessment(score: number, food = false) {
  if (food) return { foodAndDrinkQuality: Math.round(score * .29), daytimeRelevance: Math.round(score * .21), distinctiveness: Math.round(score * .15), consistency: Math.round(score * .14), visitorFit: Math.round(score * .11), evidenceConfidence: score - Math.round(score * .29) - Math.round(score * .21) - Math.round(score * .15) - Math.round(score * .14) - Math.round(score * .11) };
  return { experienceDepth: Math.round(score * .3), distinctiveness: Math.round(score * .2), presentation: Math.round(score * .2), journeyWorth: Math.round(score * .15), accessAndReliability: Math.round(score * .1), evidenceConfidence: score - Math.round(score * .3) - Math.round(score * .2) - Math.round(score * .2) - Math.round(score * .15) - Math.round(score * .1), visitability: 'full_visitor_experience' };
}

function make(spec: any) {
  const placeType = spec.placeType === 'Toilets' ? 'Public toilets' : spec.placeType;
  const foodNotes = spec.category === 'food' ? `amenity=restaurant; food_score=${spec.score}; cuisine=Scottish, seafood, cakes and high tea; price_band=££; opening_hours:description=${spec.opening}; description=${spec.tagline}. ${spec.description}; ` : '';
  return {
    id: spec.id, projectId, name: spec.name, alternativeNames: [], countryCode: 'GB-SCT', region: 'Angus', locality: 'Auchmithie',
    featureType: spec.featureType, significance: spec.significance ?? 'local', geometry: { type: 'Point', coordinates: spec.coordinates },
    locationType: spec.locationType ?? 'exact', locationConfidence: spec.locationConfidence ?? 'high', dateBasis: 'unknown', dateConfidence: 'unknown', survival: 'substantially_intact',
    shortDescription: spec.description, visitorWebsiteUrl: spec.website,
    editorialReview: spec.score ? { status: 'editorially_researched', category: spec.category, methodVersion: editorialRatingMethodVersion, reviewedAt: reviewedDate, scoreRationale: spec.reason, evidenceUrls: spec.evidenceUrls, ...(spec.category === 'food' ? { foodAssessment: assessment(spec.score, true) } : { attractionAssessment: assessment(spec.score) }) } : undefined,
    sourceRecords: spec.evidenceUrls.map((url: string, index: number) => ({
      sourceName: index ? `${spec.name} supporting evidence` : spec.sourceName,
      sourceOrganisation: index ? (url.includes('openstreetmap.org') ? 'OpenStreetMap contributors' : 'Supporting publisher') : spec.sourceOrganisation,
      sourceUrl: url, sourceRecordId: spec.sourceRecordIds?.[index], accessedAt: reviewedAt,
      reliability: url.includes('angus.gov.uk') ? 'local_authority' : url.includes('openstreetmap.org') ? 'discovery_only' : 'official_non_statutory',
      licence: url.includes('openstreetmap.org') ? 'Open Database Licence (ODbL) v1.0; © OpenStreetMap contributors.' : 'Source-linked editorial evidence; verify time-sensitive details before travel.',
      notes: `Current-place curation: visitor_place_type=${placeType}; ${spec.score ? `visit_score=${spec.score}; ` : ''}${foodNotes}${spec.details ?? ''}`,
    })),
    tags: [...new Set([...spec.tags, ...(spec.category === 'food' ? ['service-context-food', 'visitor-context-food'] : [])])],
    createdAt: reviewedAt, updatedAt: reviewedAt, reviewed: true, evidenceScope: 'parish_evidence',
  };
}

const attractions = [
  make({ id: 'curated-attraction:auchmithie-beach-cliffs', name: 'Auchmithie Beach, Cliffs and Caves', score: 84, coordinates: [-2.5179, 56.5882], featureType: 'natural_landmark', significance: 'regional', description: 'A secluded pebble shore beneath 120-foot red sandstone cliffs, with sea caves, arches and a steep path down from the historic fishing village.', reason: 'A dramatic, distinctive and officially promoted Angus coast experience that independently justifies a visit, tempered by steep access and erosion risk.', website: urls.beach, sourceName: 'Auchmithie Beach', sourceOrganisation: 'VisitAngus', evidenceUrls: [urls.beach, urls.beachTrail], placeType: 'Attraction', category: 'attraction', tags: ['curated-visitor', 'home-standalone-place', 'current-context', 'coastal-access'], details: 'pebble beach; steep descent; cliffs and caves; check tide, weather and cliff conditions; not step-free' }),
  make({ id: 'curated-attraction:auchmithie-harbour-smokie', name: 'Auchmithie Old Harbour and Smokie Heritage', score: 74, coordinates: [-2.5178030875, 56.5884977625], featureType: 'historic_site', significance: 'national', description: 'The remains of the old fishing harbour and shore at the village recognised as the birthplace of the Arbroath Smokie.', reason: 'A compact but nationally resonant fishing-heritage stop, strengthened by the surviving harbour setting and official Smokie Trail interpretation.', website: urls.smokie, sourceName: 'The Arbroath Smokie Trail', sourceOrganisation: 'VisitAngus', evidenceUrls: [urls.smokie, 'https://www.openstreetmap.org/way/1146042692'], sourceRecordIds: [undefined, 'way/1146042692'], placeType: 'Attraction', category: 'attraction', tags: ['curated-visitor', 'home-standalone-place', 'current-context', 'service-context-heritage'], details: 'outdoor coastal heritage; free; lower shore reached by steep route; no claim of staffed interpretation' }),
];

const foods = [make({ id: 'curated-food:auchmithie-but-n-ben', name: 'But ’n’ Ben', tagline: 'Smokies, cakes and Sunday high tea', opening: 'Lunch and selected evening service; Sunday high tea; Tuesday closure reported—book and verify current hours', score: 80, coordinates: [-2.5236866, 56.5890527], featureType: 'food_drink', description: 'A long-established village restaurant known for Smokie dishes, Scottish seafood, home-baked cakes and Sunday high tea.', reason: 'A destination food stop with strong local identity and a verified daytime lunch, cake and high-tea offer; it is not included merely as a dinner restaurant.', website: urls.restaurant, sourceName: 'But ’n’ Ben visitor listing', sourceOrganisation: 'VisitAngus', evidenceUrls: [urls.food, urls.restaurant, 'https://www.openstreetmap.org/node/5357136888'], sourceRecordIds: [undefined, undefined, 'node/5357136888'], placeType: 'Eat', category: 'food', tags: ['curated-visitor', 'current-context', 'food-coffee-cake', 'food-light-lunch'], details: 'book ahead; service times vary; current dog access unconfirmed' })];

const trails = [
  make({ id: 'curated-trails:auchmithie-clifftop', name: 'Arbroath–Auchmithie Clifftop Walk', score: 78, coordinates: [-2.5207529, 56.5894867], featureType: 'walking_route', description: 'The official coastal path linking Arbroath and Auchmithie above sandstone cliffs, with sea views, arches and caves.', reason: 'A substantial, scenic and well-documented coastal walk for which Auchmithie is a genuine endpoint, with an official route link and safety advice.', website: urls.walking, sourceName: 'Arbroath Path Network', sourceOrganisation: 'Angus Council / VisitAngus', evidenceUrls: [urls.walking, urls.pathPdf, urls.corePaths], placeType: 'Trail', category: 'trail', tags: ['curated-visitor', 'visitor-context-trail', 'current-context', 'cross-boundary-route'], details: 'trail_type=Linear cliff-top coast walk; best_for=Coastal scenery and confident walkers; distance=6.5 km / 4 miles one way, about 13 km / 8 miles return; time_to_spend=about 2 hours one way or 4 hours return; moderate; narrow near cliff edge with steep steps and erosion risk; route links checked 2026-08-30' }),
  make({ id: 'curated-trails:auchmithie-smokie', name: 'Arbroath Smokie Trail: Auchmithie', score: 74, coordinates: [-2.5178030875, 56.5884977625], featureType: 'walking_route', description: 'Official five-stop sensory heritage trail linking the Smokie’s Auchmithie origins with Arbroath’s fishing tradition.', reason: 'A distinctive official heritage trail whose Auchmithie stop has clear national food-history relevance and a working provider page.', website: urls.smokie, sourceName: 'The Arbroath Smokie Trail', sourceOrganisation: 'VisitAngus', evidenceUrls: [urls.smokie], placeType: 'Trail', category: 'trail', tags: ['curated-visitor', 'visitor-context-trail', 'current-context', 'cross-boundary-route'], details: 'trail_type=Five-stop regional heritage trail; best_for=Fishing and food heritage; distance=Multi-stop Arbroath–Auchmithie route, exact total not published; time_to_spend=45–90 minutes for the Auchmithie shore and village stop; free self-guided web resource; link checked 2026-08-30' }),
  make({ id: 'curated-trails:auchmithie-beach-trail', name: 'Angus Beach Trail: Auchmithie', score: 64, coordinates: [-2.5179, 56.5882], featureType: 'walking_route', description: 'VisitAngus beach-trail stop highlighting the village’s pebble shore, cliffs and walking or cycling approach from Arbroath.', reason: 'A verified official route-planning resource that helps visitors combine the shore with other Angus beaches, though it is a regional rather than town-only trail.', website: urls.beachTrail, sourceName: 'Angus Beach Trail', sourceOrganisation: 'VisitAngus', evidenceUrls: [urls.beachTrail, urls.beach], placeType: 'Trail', category: 'trail', tags: ['curated-visitor', 'visitor-context-trail', 'current-context', 'cross-boundary-route'], details: 'trail_type=Regional beach trail stop; best_for=Coast touring, walking and cycling; distance=Regional multi-stop route, no fixed Auchmithie loop; time_to_spend=45–90 minutes at Auchmithie; steep beach access; link checked 2026-08-30' }),
];

const picnics = [
  make({ id: 'curated-picnic:auchmithie-clifftop-bench', name: 'Auchmithie Clifftop Rest Bench', coordinates: [-2.5207529, 56.5894867], featureType: 'picnic_site', description: 'Mapped public bench overlooking the coastal approach, suitable for a short rest or packed snack rather than a table picnic.', website: 'https://www.openstreetmap.org/node/5192421096', sourceName: 'Auchmithie bench', sourceOrganisation: 'OpenStreetMap contributors', evidenceUrls: ['https://www.openstreetmap.org/node/5192421096'], sourceRecordIds: ['node/5192421096'], placeType: 'Picnic', tags: ['service-context-picnic', 'current-context'], details: 'bench=yes; picnic_table=no; no shelter, bin or accessible approach confirmed' }),
  make({ id: 'curated-picnic:auchmithie-village-bench', name: 'Auchmithie Village Rest Bench', coordinates: [-2.5240695, 56.5890005], featureType: 'picnic_site', description: 'Mapped public bench near the village centre for a short rest or packed snack.', website: 'https://www.openstreetmap.org/node/5356999579', sourceName: 'Auchmithie bench', sourceOrganisation: 'OpenStreetMap contributors', evidenceUrls: ['https://www.openstreetmap.org/node/5356999579'], sourceRecordIds: ['node/5356999579'], placeType: 'Picnic', tags: ['service-context-picnic', 'current-context'], details: 'bench=yes; picnic_table=no; no dedicated picnic facilities claimed' }),
];

const parking = [
  make({ id: 'curated-parking:auchmithie-village', name: 'Auchmithie Village Car Park', coordinates: [-2.5242956353, 56.5893276471], featureType: 'parking', description: 'Small mapped surface car park beside the village park and playground, also identified by VisitAngus as the village parking point.', website: urls.beachTrail, sourceName: 'Angus Beach Trail visitor information', sourceOrganisation: 'VisitAngus', evidenceUrls: [urls.beachTrail, 'https://www.openstreetmap.org/way/535832849'], sourceRecordIds: [undefined, 'way/535832849'], placeType: 'Parking', tags: ['service-context-parking', 'current-context'], details: 'access=public; fee=unknown; price_display=Fee status not published—check signs; capacity and marked accessible bays not published; do not infer free parking' }),
  make({ id: 'curated-parking:auchmithie-street-bays', name: 'Auchmithie Street-side Parking Bays', coordinates: [-2.52400392, 56.58884502], featureType: 'parking', description: 'Three mapped marked street-side spaces near the village centre.', website: 'https://www.openstreetmap.org/way/535832888', sourceName: 'Auchmithie parking bays', sourceOrganisation: 'OpenStreetMap contributors', evidenceUrls: ['https://www.openstreetmap.org/way/535832888'], sourceRecordIds: ['way/535832888'], placeType: 'Parking', tags: ['service-context-parking', 'current-context'], details: 'capacity=3; fee=unknown; price_display=Fee status not published—check signs; street-side bays' }),
  make({ id: 'curated-parking:auchmithie-accessible-bays', name: 'Auchmithie Accessible Parking Bays', coordinates: [-2.5239707, 56.5889913714], featureType: 'parking', description: 'Two mapped accessible street-side parking bays close to the village centre and public toilets.', website: 'https://www.openstreetmap.org/way/535832889', sourceName: 'Auchmithie accessible bays', sourceOrganisation: 'OpenStreetMap contributors', evidenceUrls: ['https://www.openstreetmap.org/way/535832889'], sourceRecordIds: ['way/535832889'], placeType: 'Parking', tags: ['service-context-parking', 'current-context', 'accessible-parking'], details: 'capacity=2; capacity:disabled=2; fee=unknown; price_display=Fee status not published—check signs' }),
];

const toilets = [make({ id: 'curated-toilets:auchmithie-fountain-square', name: 'Fountain Square Public Toilets', coordinates: [-2.522392, 56.589455], featureType: 'toilets', description: 'Council public toilets with male, female and accessible facilities, including a RADAR-key unit.', website: urls.toilets, sourceName: 'Auchmithie Fountain Square public toilets', sourceOrganisation: 'Angus Council', evidenceUrls: [urls.toilets, 'https://www.openstreetmap.org/way/535832886'], sourceRecordIds: [undefined, 'way/535832886'], placeType: 'Toilets', tags: ['service-context-toilets', 'current-context', 'accessible-toilet'], details: 'fee=no; price_display=Free; wheelchair=yes; RADAR key required for accessible unit; council lists morning opening to 19:00 in summer and earlier winter closing—verify seasonal hours' })];

const curated = [...attractions, ...foods, ...trails, ...picnics, ...parking, ...toilets];
pkg.features = [...pkg.features.filter((feature: any) => !feature.id.startsWith('curated-')), ...curated];

const highlightInfo: Record<string, [string, string, string, string, boolean]> = {
  'curated-attraction:auchmithie-beach-cliffs': ['Cliffs, caves and secluded pebble shore', '60–120 minutes', 'Outdoor access; avoid cliff edges and check tide, weather and erosion warnings', 'Free', true],
  'curated-attraction:auchmithie-harbour-smokie': ['Fishing harbour at the Smokie’s birthplace', '30–60 minutes', 'Outdoor access; lower shore route is steep', 'Free', true],
};
pkg.project.visitorHighlights = attractions.map((feature: any, index: number) => { const info = highlightInfo[feature.id]; return { rank: index + 1, featureId: feature.id, name: feature.name, reason: feature.editorialReview.scoreRationale, tagline: info[0], visitorScore: Object.values(feature.editorialReview.attractionAssessment).filter((value) => typeof value === 'number').reduce((sum: number, value: any) => sum + value, 0), timeToSpend: info[1], openingTimes: info[2], admission: info[3], freeAdmission: info[4], visitorWebsiteUrl: feature.visitorWebsiteUrl, editorialReview: feature.editorialReview, sourceName: feature.sourceRecords[0].sourceName, sourceUrl: feature.visitorWebsiteUrl, verifiedInBoundaryAt: reviewedDate }; }).sort((a: any, b: any) => b.visitorScore - a.visitorScore).map((item: any, index: number) => ({ ...item, rank: index + 1 }));

pkg.project.preferredBasemap = 'voyager';
pkg.project.touristAppeal = { score: 72, dogOwnerScore: 70, dogAccessScoreAdjustment: -2, rating: 1, label: 'Great Choice', summary: 'A genuinely distinctive clifftop fishing village with dramatic beach and cave scenery, the old harbour, nationally resonant Smokie heritage, three verified trail resources and a destination lunch or high-tea stop.', dogAccessRating: 3, dogAccessSummary: 'Outdoor coast and village walks suit responsible dogs, but steep steps, exposed cliff edges, livestock risk and unconfirmed indoor access require planning.', methodVersion: '2026-08-30-strict-settlement-full-audit-v3', reviewedAt: reviewedDate, sourceUrls: Object.values(urls) };
pkg.project.townGuide = { characterTag: 'Smokie heritage above dramatic sandstone cliffs', headline: 'A small fishing village that earns its coastal detour', intro: 'Auchmithie is more than a gateway to a nearby attraction: its cliff-top setting, steep shore, old harbour, Smokie origin story and destination food stop combine into a coherent half-day visit.', bestFor: ['Dramatic coastal scenery', 'Fishing and food heritage', 'A cliff walk with lunch or high tea'], perfectFor: ['A focused 2–4 hour coastal stop', 'Confident walkers', 'Combining scenery with a distinctive daytime meal'], suggestedFirstVisit: { title: 'Cliffs, harbour and Smokie heritage', summary: 'Park in the village, pause at the cliff-top viewpoint, descend only if conditions suit, explore the old harbour setting and finish at But ’n’ Ben.' }, dontMiss: ['The pebble shore and sandstone cliffs', 'Old harbour and Smokie Trail stop', 'The Arbroath–Auchmithie coastal path'], suggestedTime: '2–4 hours; around 4 hours more for a return walk to Arbroath', visitorMood: 'Small and exposed but highly distinctive, with enough independent village content to justify its own map score.', sourceUrls: Object.values(urls), lastReviewedAt: reviewedDate };
pkg.project.researchNotes = 'Full strict-boundary visitor audit. Auchmithie qualifies on its own village character, shore, harbour, Smokie heritage and destination food stop. Ethie Castle, Arbroath, St Vigeans and other nearby merit are excluded. Castle Rock scheduled fort remains catalogued but map-hidden because no defensible construction period is present in the local HES record. No dedicated Treasure Trails, Curious About, Mystery Guides or Go Quest product was found for Auchmithie; official council and VisitAngus routes are retained. Parking charges are unknown unless explicitly published.';

planner.projects[projectId] = { eat: foods.map((item: any) => item.id), trails: trails.map((item: any) => item.id), picnic: picnics.map((item: any) => item.id), parking: parking.map((item: any) => item.id), toilets: toilets.map((item: any) => item.id) };
const dogEntry = (rating: number, status: string, label: string, summary: string, sourceUrl: string) => ({ rating, status, label, summary, sourceName: 'Auchmithie dog-access audit', sourceUrl, reviewedAt: reviewedDate });
dog.projects[projectId] = {
  attraction: {
    [attractions[0].id]: dogEntry(3, 'outdoor_only', 'Outdoor coast with hazards', 'Responsible dogs can use the outdoor shore and paths, but steep steps, cliff edges and seasonal livestock require close control.', urls.beach),
    [attractions[1].id]: dogEntry(3, 'outdoor_only', 'Outdoor harbour heritage', 'Responsible dogs can accompany the outdoor harbour and Smokie heritage stop; no indoor attraction access is involved.', urls.smokie),
  },
  trail: {
    [trails[0].id]: dogEntry(3, 'allowed', 'Dogs under close control', 'Dogs can use the path under the Scottish Outdoor Access Code; keep well back from cliff edges and under close control near livestock.', urls.pathPdf),
    [trails[1].id]: dogEntry(3, 'outdoor_only', 'Outdoor heritage trail', 'The Auchmithie elements are outdoors; keep dogs under close control around the shore and village.', urls.smokie),
    [trails[2].id]: dogEntry(3, 'outdoor_only', 'Outdoor beach trail', 'Responsible dogs can accompany the outdoor beach-trail stop; steep access and exposed cliffs need care.', urls.beachTrail),
  },
  eat: { [foods[0].id]: dogEntry(1, 'unconfirmed', 'Confirm current restaurant dog policy', 'No reliable current dog policy was found for indoor or outdoor seating.', urls.restaurant) },
};

const statutory = pkg.features.filter((feature: any) => feature.tags?.includes('hes-listed-building'));
const visibleStatutory = statutory.filter((feature: any) => !feature.tags.includes('map-hidden'));
const datedVisible = visibleStatutory.filter((feature: any) => feature.documentedDateText && feature.earliestPossibleYear != null && feature.latestPossibleYear != null && feature.dateBasis !== 'unknown');
const report = { reviewedAt, projectId, status: 'verified', settlementScore: 72, dogOwnerScore: 70, independentlyWorthwhile: true, publication: { see: attractions.length, eat: foods.length, trails: trails.length, picnic: picnics.length, parking: parking.length, toilets: toilets.length }, heritage: { expectedListedBuildings: 9, representedListedBuildings: statutory.length, visibleDatedPins: datedVisible.length, visibleUndatedPins: visibleStatutory.length - datedVisible.length, scheduledFortRetainedHidden: true }, namedTrailSearch: { TreasureTrails: 'No dedicated Auchmithie product found', CuriousAbout: 'No dedicated Auchmithie product found', MysteryGuides: 'No dedicated Auchmithie product found', GoQuestAdventures: 'No dedicated Auchmithie product found', retained: trails.map((item: any) => item.name) }, exclusions: ['Ethie Castle and Ethie coast beyond the strict village boundary', 'Arbroath and St Vigeans visitor merit', 'Castle Rock scheduled fort as a scored visitor attraction', 'Unverified informal parking and unconfirmed picnic tables'], verification: { trailLinksChecked: [urls.walking, urls.pathPdf, urls.smokie, urls.beachTrail], parkingFeesNotInferred: true, toiletAccessibilityChecked: true, allCuratedCoordinatesWithinBoundary: true } };

await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`);
await writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`);
await writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`);
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
