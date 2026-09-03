import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { HeritageFeature, ProjectPackage, VisitorHighlight } from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';

const projectId = 'kincorth-aberdeen-scotland';
const reviewedDate = '2026-08-28';
const reviewedAt = '2026-08-28T12:00:00Z';
const projectPath = resolve('data/projects/kincorth-aberdeen.json');
const plannerPath = resolve('data/aberdeen-north-visitor-planner-curation.json');
const dogPath = resolve('data/aberdeen-north-dog-access-curation.json');
const reportPath = resolve('data/review/kincorth-full-visitor-audit-2026-08-28.json');
type F = HeritageFeature & Record<string, any>;
type P = ProjectPackage & { project: ProjectPackage['project'] & Record<string, any>; features: F[] };

const urls = {
  hill: 'https://visitabdn.com/businesses/kincorth-hill-local-nature-reserve',
  trailIndex: 'https://sites.aberdeencity.gov.uk/AAGM/local-history/heritage-trails',
  routePdf: 'https://www.aberdeencity.gov.uk/sites/default/files/2019-04/Kincorth%20Hill%20Walking%20Routes.pdf',
  cafeFsa: 'https://ratings.food.gov.uk/business/1649104/kincorth-community-centre-hub-cafe-kincorth',
  cafeCurrent: 'https://www.twfcharity.org/kincorth-community-centre-development-group-donation',
  cafeVolunteer: 'https://www.volunteeraberdeen.org.uk/opportunities/kincorth-community-hub-volunteers',
  archaeology: 'https://www.trove.scot/site/240301/kincorth-hill',
  dogCode: 'https://www.outdooraccess-scotland.scot/dog-owners',
  osmParking: 'https://www.openstreetmap.org/way/1138309320',
  osmAccessibleParking: 'https://www.openstreetmap.org/relation/15908251',
};

const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as P;
const planner = JSON.parse(await readFile(plannerPath, 'utf8')) as any;
const dog = JSON.parse(await readFile(dogPath, 'utf8')) as any;
const assess = (score: number) => ({ experienceDepth: Math.round(score * .3), distinctiveness: Math.round(score * .2), presentation: Math.round(score * .2), journeyWorth: Math.round(score * .15), accessAndReliability: Math.round(score * .1), evidenceConfidence: score - Math.round(score * .3) - Math.round(score * .2) - Math.round(score * .2) - Math.round(score * .15) - Math.round(score * .1), visitability: 'full_visitor_experience' as const });
const foodAssess = (score: number) => ({ foodAndDrinkQuality: Math.round(score * .29), daytimeRelevance: Math.round(score * .21), distinctiveness: Math.round(score * .15), consistency: Math.round(score * .14), visitorFit: Math.round(score * .11), evidenceConfidence: score - Math.round(score * .29) - Math.round(score * .21) - Math.round(score * .15) - Math.round(score * .14) - Math.round(score * .11) });
const source = (name: string, organisation: string, url: string, notes: string, reliability: any = 'official_non_statutory') => ({ sourceName: name, sourceOrganisation: organisation, sourceUrl: url, accessedAt: reviewedAt, reliability, licence: 'Source-linked editorial evidence; verify time-sensitive details before travel.', notes });
const review = (category: 'attraction' | 'trail' | 'food', score: number, reason: string, evidenceUrls: string[]) => ({ status: 'editorially_researched', category, methodVersion: '2026-08-13-researched-visitor-value-v1', reviewedAt: reviewedDate, scoreRationale: reason, evidenceUrls, ...(category === 'food' ? { foodAssessment: foodAssess(score) } : { attractionAssessment: assess(score) }) });
const make = (spec: Record<string, any>): F => ({
  id: spec.id, projectId, name: spec.name, alternativeNames: [], countryCode: 'GB-SCT', region: 'Aberdeen City', locality: 'Kincorth', featureType: spec.featureType,
  significance: spec.significance ?? 'local', geometry: { type: 'Point', coordinates: spec.coordinates }, locationType: spec.locationType ?? 'exact', locationConfidence: spec.locationConfidence ?? 'high',
  dateBasis: spec.dateBasis ?? 'unknown', dateConfidence: spec.dateConfidence ?? 'unknown', survival: spec.survival ?? 'substantially_intact', documentedDateText: spec.dateText,
  earliestPossibleYear: spec.earliest, latestPossibleYear: spec.latest, datePrecision: spec.datePrecision, shortDescription: spec.description, visitorWebsiteUrl: spec.website,
  attractionGuide: spec.guide, editorialReview: spec.category ? review(spec.category, spec.score, spec.reason, spec.evidenceUrls) : undefined,
  sourceRecords: spec.evidenceUrls.map((url: string, index: number) => source(index ? `${spec.name} supporting evidence` : spec.sourceName, index ? 'Supporting publisher' : spec.sourceOrganisation, url, `Current-place curation: visitor_place_type=${spec.placeType}; ${spec.score ? `visit_score=${spec.score}; ` : ''}${spec.details ?? ''}; description=${spec.description}`, url.includes('aberdeencity.gov.uk') ? 'local_authority' : 'official_non_statutory')),
  tags: spec.tags, createdAt: reviewedAt, updatedAt: reviewedAt, reviewed: true, evidenceScope: 'parish_evidence',
}) as F;

const hill = make({
  id: 'curated-attractions:kincorth-hill-local-nature-reserve', name: 'Kincorth Hill Local Nature Reserve and Viewpoint', featureType: 'nature_reserve', coordinates: [-2.1051272, 57.1150807], website: urls.hill,
  description: 'A large semi-natural hill reserve with heath, scrub, woodland, pond, seating and broad views across Aberdeen.',
  reason: 'Kincorth Hill is the district’s genuine visitor draw: a sizeable urban nature reserve with panoramic views, varied habitats and a useful path network, though it is a local outdoor stop rather than a major destination.',
  evidenceUrls: [urls.hill, urls.trailIndex, urls.routePdf], sourceName: 'Kincorth Hill Local Nature Reserve', sourceOrganisation: 'VisitAberdeenshire', placeType: 'Attraction', score: 74, category: 'attraction',
  tags: ['curated-visitor', 'home-standalone-place', 'current-context'],
  guide: { heroImage: '/town-guides/kincorth-hill-heather-watercolour-guide-v1.png', heroAlt: 'Watercolour view across Kincorth Hill heather and woodland towards Aberdeen', heroObjectPosition: '50% 54%', headline: 'Climb through heath and scrub for a wide Aberdeen panorama', intro: 'Kincorth Hill is the visitor experience here: an elevated local nature reserve with heath, woodland, a pond, viewpoints and a choice of mapped paths.', motifs: ['Heather hillside', 'Woodland paths', 'Aberdeen panorama', 'Pond and picnic sites'], bestFor: ['Short nature walks', 'City viewpoints', 'Birdwatching', 'Dog walks with close control'], parking: 'Parking is identified at both ends of Nigg Way. Designated accessible bays are available by the Abbotswells Crescent access; published sources do not state ordinary-bay capacities, charges or stay rules.', toilets: 'No dedicated public visitor toilet could be verified on the hill.', picnic: 'The council route map marks three picnic sites within the reserve.', foodNote: 'Kincorth Community Hub Café is the verified local coffee and light-lunch stop.', trails: [{ name: 'Kincorth Hill Walking Routes', summary: 'Four council-mapped choices with viewpoints, tactile maps, a pond and picnic locations.', routeType: 'Free self-guided hill routes', distance: '1.5 km, 2.5 km, 3.3 km or 3.5 km', difficulty: 'Mixed hill paths; some paths are steep, although most have good surfaces', externalUrl: urls.trailIndex }, { name: 'Sculpture Trail and Orienteering Course', summary: 'An on-site sculpture trail which also works as an orienteering course; follow the reserve interpretation on arrival.', routeType: 'On-site activity trail', difficulty: 'Outdoor hill paths with variable gradients', externalUrl: urls.hill }] },
});

const trail = make({
  id: 'curated-trails:kincorth-hill-walking-routes', name: 'Kincorth Hill Walking Routes', featureType: 'walking_route', coordinates: [-2.1051272, 57.1150807], website: urls.trailIndex, locationType: 'representative_point',
  description: 'Four mapped hill loops of 1.5 km, 2.5 km, 3.3 km and 3.5 km, with viewpoints, tactile maps, a pond and picnic locations.',
  reason: 'Aberdeen City Council publishes a Kincorth-specific route map with four clearly measured choices and practical access points; it is the strongest and most dependable trail resource for the district.',
  evidenceUrls: [urls.trailIndex, urls.routePdf, urls.hill], sourceName: 'Kincorth Hill Walking Routes', sourceOrganisation: 'Aberdeen City Council', placeType: 'Trail', score: 76, category: 'trail',
  details: 'distance=1.5 km, 2.5 km, 3.3 km or 3.5 km; format=Free council route map; surface=Mixed hill paths; facilities=Viewpoints, tactile 3D maps, pond and three mapped picnic sites; parking=Both ends of Nigg Way and accessible bays at Abbotswells Crescent; route_link_checked=2026-08-27; dog_friendly=Dog walking listed, responsible close control required',
  tags: ['curated-visitor', 'service-context-trail', 'visitor-context-trail', 'current-context'],
});

const sculptureTrail = make({
  id: 'curated-trails:kincorth-hill-sculpture-orienteering', name: 'Kincorth Hill Sculpture Trail and Orienteering Course', featureType: 'walking_route', coordinates: [-2.1051272, 57.1150807], website: urls.hill, locationType: 'representative_point',
  description: 'An on-site sculpture trail which doubles as an orienteering course, supported by interpretation boards around the reserve.',
  reason: 'The official destination page confirms a distinct sculpture-and-orienteering activity within the reserve. It clears the publication threshold as a useful free add-on, but lacks a dependable downloadable route of its own.',
  evidenceUrls: [urls.hill], sourceName: 'Kincorth Hill Local Nature Reserve', sourceOrganisation: 'VisitAberdeenshire', placeType: 'Trail', score: 64, category: 'trail',
  details: 'format=Free on-site sculpture and orienteering trail; distance=Not published; duration=Not published; difficulty=Outdoor hill paths with variable gradients; wayfinding=Interpretation boards on site; route_link_checked=2026-08-28; dog_friendly=Dog walking listed for the reserve, responsible close control required',
  tags: ['curated-visitor', 'service-context-trail', 'visitor-context-trail', 'current-context'],
});

const cafe = make({
  id: 'curated-eat:kincorth-community-hub-cafe', name: 'Kincorth Community Hub Café', featureType: 'cafe', coordinates: [-2.1044101, 57.1214382], website: urls.cafeFsa,
  description: 'Community coffee and cake: A café in Kincorth Community Centre serving affordable daytime refreshments, coffee, cake and light food.',
  reason: 'This is Kincorth’s clearest café-led visitor stop: the premises has a current food-business record and recent community evidence confirms the café remains active, while published volunteer information supports daytime service.',
  evidenceUrls: [urls.cafeFsa, urls.cafeCurrent, urls.cafeVolunteer], sourceName: 'Kincorth Community Centre Hub Cafe', sourceOrganisation: 'Food Standards Scotland', placeType: 'Eat', score: 70, category: 'food',
  details: 'opening_hours:description=Published volunteer information states 09:30–14:30; operating days not reliably published, check before travel; price_band=£; cuisine=Community café, coffee, cake and light food; dog_policy=Not published; food_hygiene_inspection=6 December 2023',
  tags: ['curated-visitor', 'service-context-food', 'visitor-context-food', 'current-context'],
});

const parking = [
  make({ id: 'curated-parking:kincorth-hill-nigg-way-north', name: 'Kincorth Hill Nigg Way North Parking', featureType: 'parking', coordinates: [-2.092704, 57.1185291], website: urls.hill, locationConfidence: 'medium', description: 'Visitor parking at the north-eastern end of Nigg Way. Capacity, accessible bays, charges, payment methods, maximum stay and overnight rules are not published; follow signs on arrival.', evidenceUrls: [urls.hill, urls.osmParking], sourceName: 'Kincorth Hill Local Nature Reserve', sourceOrganisation: 'VisitAberdeenshire', placeType: 'Parking', details: 'amenity=parking; location=North-eastern end of Nigg Way; capacity=Not published; capacity:disabled=Not published; fee=Not published; payment_methods=Not published; maxstay=Not published; overnight=Not published; surface=Not published', tags: ['service-context-parking', 'current-context'] }),
  make({ id: 'curated-parking:kincorth-hill-nigg-way-south', name: 'Kincorth Hill Nigg Way South Parking', featureType: 'parking', coordinates: [-2.1133856, 57.1123621], website: urls.hill, locationConfidence: 'medium', description: 'Visitor parking is stated at the southern end of Nigg Way. The source publishes no capacity, accessible-bay count, fee, payment, stay or overnight information.', evidenceUrls: [urls.hill], sourceName: 'Kincorth Hill Local Nature Reserve', sourceOrganisation: 'VisitAberdeenshire', placeType: 'Parking', details: 'amenity=parking; location=Southern end of Nigg Way; capacity=Not published; capacity:disabled=Not published; fee=Not published; payment_methods=Not published; maxstay=Not published; overnight=Not published; surface=Not published', tags: ['service-context-parking', 'current-context'] }),
  make({ id: 'curated-parking:kincorth-hill-abbotswells-accessible', name: 'Kincorth Hill Abbotswells Crescent Accessible Parking', featureType: 'parking', coordinates: [-2.0993517, 57.110867], website: urls.hill, locationConfidence: 'medium', description: 'Designated accessible parking at the Abbotswells Crescent access. OpenStreetMap currently records 12 designated accessible bays; charges, payment, maximum stay and overnight rules are not published and should be checked on site.', evidenceUrls: [urls.hill, urls.osmAccessibleParking], sourceName: 'Kincorth Hill Local Nature Reserve', sourceOrganisation: 'VisitAberdeenshire', placeType: 'Parking', details: 'amenity=parking; location=Abbotswells Crescent access; capacity=12; capacity:disabled=12; access=Designated accessible parking; fee=Not published; payment_methods=Not published; maxstay=Not published; overnight=Not published; surface=Paved; data_cross_checked=OpenStreetMap 2026-08-27', tags: ['service-context-parking', 'current-context'] }),
];

const picnic = [make({
  id: 'curated-picnic:kincorth-hill-picnic-sites', name: 'Kincorth Hill Picnic Sites', featureType: 'picnic_site', coordinates: [-2.1072, 57.1147], website: urls.trailIndex, locationType: 'representative_point', locationConfidence: 'medium',
  description: 'Three picnic-site locations are marked on Aberdeen City Council’s Kincorth Hill route map. Table count, accessibility, shelter, bins and barbecue rules are not published.',
  evidenceUrls: [urls.trailIndex, urls.routePdf], sourceName: 'Kincorth Hill Walking Routes', sourceOrganisation: 'Aberdeen City Council', placeType: 'Picnic', details: 'tourism=picnic_site; mapped_sites=3; table_count=Not published; accessible=Not published; shelter=Not published; bins=Not published; fee=Not published; barbecue_rules=Not published', tags: ['service-context-picnic', 'current-context'],
})];
const toilets: F[] = [];

const auditedFeatures = [hill, trail, sculptureTrail, cafe, ...parking, ...picnic];
const auditedFeatureIds = new Set(auditedFeatures.map((feature) => feature.id));
pkg.features = [...auditedFeatures, ...pkg.features.filter((feature) => !feature.tags.some((tag) => ['hes-listed-building', 'hes-scheduled-monument'].includes(tag)) && !auditedFeatureIds.has(feature.id))];
const highlights: VisitorHighlight[] = [{ rank: 1, featureId: hill.id, name: hill.name, reason: hill.editorialReview!.scoreRationale, tagline: 'Hilltop nature and city-wide views', visitorScore: 74, timeToSpend: '1–2.5 hours', openingTimes: 'Open-air reserve; visit in daylight', admission: 'Free', freeAdmission: true, visitorWebsiteUrl: urls.hill, attractionGuide: hill.attractionGuide, editorialReview: hill.editorialReview, sourceName: hill.sourceRecords[0].sourceName, sourceUrl: urls.hill, verifiedInBoundaryAt: reviewedDate }];
pkg.project.preferredBasemap = 'voyager';
pkg.project.boundary = {
  type: 'Feature',
  properties: {},
  geometry: {
    type: 'Polygon',
    coordinates: [[
      [-2.1165, 57.1105],
      [-2.097, 57.1105],
      [-2.092, 57.1145],
      [-2.0935, 57.1235],
      [-2.098, 57.127],
      [-2.1145, 57.127],
      [-2.1175, 57.1235],
      [-2.1165, 57.1105],
    ]],
  },
};
pkg.project.boundarySource = 'Conservative Kincorth district and Kincorth Hill visitor-study boundary. It excludes the separately catalogued Duthie Park, Ruthrieston, Bridge of Dee, Nigg Kirk, Tullos Hill, Torry and Cove records.';
pkg.project.boundaryConfidence = 'medium';
pkg.project.touristAppeal = { score: 48, dogOwnerScore: 47, dogAccessScoreAdjustment: -1, rating: 0, label: 'Limited Visitor Interest', summary: 'Kincorth is a residential Aberdeen district without enough independent settlement interest to qualify for the town map; Kincorth Hill Local Nature Reserve remains available separately under See.', dogAccessRating: 2, dogAccessSummary: 'The separate hill attraction is useful for dog walking, but shared paths, wildlife, roads and sensitive habitats require responsible close control; dog access does not raise the settlement score.', methodVersion: '2026-08-28-strict-settlement-full-audit-v3', reviewedAt: reviewedDate, sourceUrls: Object.values(urls) };
pkg.project.visitorHighlights = highlights;
pkg.project.townGuide = { characterTag: 'Residential south Aberdeen district', headline: 'A local district beside a worthwhile nature reserve', intro: 'Kincorth itself scores 48% and remains in the Aberdeen City library, but does not appear as a town pin. The independently assessed Kincorth Hill Local Nature Reserve is published under See, with its trails, parking and picnic information attached to that attraction.', bestFor: ['Local services', 'Access to the separate Kincorth Hill attraction'], perfectFor: ['Selecting Kincorth Hill from See rather than planning a town visit'], suggestedFirstVisit: { title: 'Use the See entry for Kincorth Hill', summary: 'The reserve guide holds the walking routes, sculpture-and-orienteering activity, parking, picnic and access information.' }, dontMiss: [], suggestedTime: 'No separate town visit recommended', visitorMood: 'Residential and practical rather than a sightseeing destination.', transportNote: 'Kincorth is served by Aberdeen city buses; verify current routes and stops before travel.', accessibilityNote: 'The settlement audit does not claim a visitor attraction. Accessibility details for the hill are recorded on the separate See entry.', sourceUrls: Object.values(urls), lastReviewedAt: reviewedDate };

planner.projects[projectId] = { eat: [cafe.id], trails: [trail.id, sculptureTrail.id], parking: parking.map((feature) => feature.id), toilets: [], picnic: picnic.map((feature) => feature.id) };
const dogRecord = (rating: number, status: string, label: string, summary: string, sourceUrl: string) => ({ rating, status, label, summary, sourceName: 'Kincorth dog-access audit', sourceUrl, reviewedAt: reviewedDate });
dog.reviewedAt = reviewedDate;
dog.projects[projectId] = {
  attraction: { [hill.id]: dogRecord(2, 'restricted', 'Good outdoor stop with close control', 'Dog walking is an identified use, but dogs should be kept under close control around wildlife, other path users, roads and sensitive habitat.', urls.hill) },
  trail: { [trail.id]: dogRecord(2, 'restricted', 'Dog-friendly hill routes with control points', 'Dogs can use the hill paths under responsible-access rules; keep them close around wildlife, other visitors and access roads.', urls.dogCode), [sculptureTrail.id]: dogRecord(2, 'restricted', 'Outdoor activity trail with close control', 'The activity sits within the dog-walking reserve, but normal wildlife and shared-path control responsibilities still apply.', urls.hill) },
  eat: { [cafe.id]: dogRecord(1, 'unknown', 'Dog policy not published', 'No dependable published evidence establishes that dogs are admitted inside the community café; ask before travelling.', urls.cafeCurrent) },
};

pkg.validation = validateFeatures(pkg.project, pkg.features);
const errors = pkg.validation.filter((entry: any) => entry.severity === 'error');
if (errors.length) throw new Error(errors.map((entry: any) => entry.message).join('; '));
const historicPins = pkg.features.filter((feature) => feature.tags.some((tag: string) => ['hes-listed-building', 'hes-scheduled-monument', 'historic-place', 'local-heritage-record'].includes(tag)) && !feature.tags.includes('map-hidden'));
const undated = historicPins.filter((feature) => !feature.documentedDateText?.trim() || feature.earliestPossibleYear == null || feature.latestPossibleYear == null || feature.dateBasis === 'unknown');
if (undated.length) throw new Error(`Undated Kincorth pins: ${undated.map((feature) => feature.id).join(', ')}`);
await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`);
await writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`);
await writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`);
await writeFile(reportPath, `${JSON.stringify({ reviewedAt, publicationDecision: 'Kincorth remains selectable in the Aberdeen City library but its 48% settlement score keeps it off the town map. Kincorth Hill Local Nature Reserve is independently published under See.', townScore: 48, dogOwnerScore: 47, dogAccessRating: 2, categoryCounts: { see: 1, eat: 1, trails: 2, picnic: 1, parking: 3, toilets: 0, heritage: historicPins.length }, heritageDateAudit: { officialDatasetSnapshot: 'Historic Environment Scotland local Listed Buildings and Scheduled Monuments datasets checked 2026-08-28', officialListedBuildingsInStrictBoundary: 0, officialScheduledMonumentsIntersectingStrictBoundary: 0, visiblePins: historicPins.length, dated: historicPins.length - undated.length, undated: undated.map((feature) => feature.id), dateRule: 'Construction, opening or material-period dates only, never designation dates.', scopeResult: 'No HES listed building point or scheduled monument polygon falls within the corrected Kincorth boundary. The previous five Kincorth assignments were Duthie Park, King George VI Bridge or Nigg records and have been removed from this project rather than mislabelled.', excludedNonStatutoryRecord: 'The possible prehistoric hut circle and small cairns recorded in Canmore/Trove at Kincorth Hill are not HES statutory designations and are obscured or uncertain, so they are not published as visible HES pins.' }, trailProviderSearches: [{ provider: 'Aberdeen City Council', result: 'Exact Kincorth Hill Walking Routes index verified; four route lengths and mapped facilities recorded.' }, { provider: 'VisitAberdeenshire', result: 'The reserve page verifies a sculpture trail which doubles as an orienteering course; added as a second 60+ Trail item.' }, { provider: 'TreasureTrails.co.uk', result: 'No exact Kincorth product found; Aberdeen city-centre products are outside the district and were excluded.' }, { provider: 'Curious About', result: 'No exact Kincorth walk found.' }, { provider: 'Mystery Guides', result: 'No exact Kincorth product found.' }, { provider: 'Go Quest Adventures', result: 'No exact Kincorth product found.' }], eatAudit: { published: [cafe.name], excluded: ['The Chef is an evening takeaway rather than a café, coffee-and-cake or light-lunch stop.', 'Cafe 100 is in Torry despite delivery-search wording mentioning Kincorth.', 'SPAR Barista Bar is convenience retail and was not preferred over the verified community café.'] }, boundaryExclusions: ['Duthie Park', 'Ruthrieston', 'Bridge of Dee', 'Nigg Kirk', 'Tullos Hill', 'Torry', 'Cove Bay', 'Loirston'], parking: parking.map((feature) => ({ name: feature.name, detail: feature.shortDescription, source: feature.visitorWebsiteUrl })), toilets: { published: 0, result: 'No dedicated public visitor toilet was verified. Customer or member facilities are not presented as public toilets.' }, picnic: { published: 1, mappedSites: 3, result: 'The council route map explicitly marks three picnic locations; unpublished table and access details remain labelled unknown.' }, verification: { townMapEligible: false, attractionPublishedUnderSee: true, heritagePinsDated: `${historicPins.length - undated.length}/${historicPins.length}`, undatedHistoricPins: undated.length, checkedWorkingLinks: [urls.hill, urls.trailIndex, urls.cafeFsa, urls.cafeCurrent, urls.cafeVolunteer], directPdfNote: 'The council trail index is the stable visitor link and exposes the Kincorth PDF.' } }, null, 2)}\n`);
console.log(`Kincorth audit complete: settlement 48 (off town map); 1 See, 1 Eat, 2 Trails, 1 Picnic group (3 mapped sites), 3 Parking, 0 Toilets; HES completeness ${historicPins.length - undated.length}/${historicPins.length}.`);
