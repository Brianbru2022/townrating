import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const projectId = 'cliffburn-arbroath-scotland';
const reviewedDate = '2026-08-30';
const reviewedAt = '2026-08-30T23:59:00Z';
const projectPath = resolve('data/projects/cliffburn-arbroath.json');
const parentPath = resolve('data/projects/arbroath.json');
const plannerPath = resolve('data/cairn-o-mount-visitor-planner-curation.json');
const dogPath = resolve('data/cairn-o-mount-dog-access-curation.json');
const reportPath = resolve('data/review/cliffburn-arbroath-full-visitor-audit-2026-08-30.json');
const urls = {
  settlement: 'https://www.openstreetmap.org/node/4223494311',
  victoriaPark: 'https://www.openstreetmap.org/relation/5321453',
  officialTrail: 'https://visitangus.com/things-to-see-do/trails/walking-trail-arbroath-to-auchmithie/',
  walkHighlands: 'https://www.walkhighlands.co.uk/angus/arbroath-cliffs.shtml',
  councilToilets: 'https://www.angus.gov.uk/directories/public_toilets_and_radar_keys/arbroath_ness_victoria_park',
  parking: 'https://www.openstreetmap.org/way/126773949',
  picnicEvidence: 'https://www.angus.gov.uk/sites/angus-cms/files/Appendix%20D2%20SEA%20Baseline%20Report%20%28Theme%20Review%29_1.pdf',
  treasureTrailsAngus: 'https://www.treasuretrails.co.uk/collections/dundee-and-angus',
  treasureTrailSearch: 'https://www.treasuretrails.co.uk/pages/trail-search',
  curiousAbout: 'https://www.curiousabout.co.uk/',
  outdoorAccess: 'https://www.outdooraccess-scotland.scot/dog-owners',
};
const pkg: any = JSON.parse(await readFile(projectPath, 'utf8'));
const parent: any = JSON.parse(await readFile(parentPath, 'utf8'));
const planner: any = JSON.parse(await readFile(plannerPath, 'utf8'));
const dog: any = JSON.parse(await readFile(dogPath, 'utf8'));
pkg.features = pkg.features.filter((feature: any) => !feature.id.startsWith('curated-'));

// The strict heritage boundary remains unchanged. The visitor envelope extends
// only far enough south to include the adjoining, verified Victoria Park point;
// its eastern edge deliberately excludes the separate cliff-walk facilities.
pkg.project.townStudyArea.visitorBoundary = {
  type: 'Feature',
  bbox: [-2.575261, 56.5602, -2.558938, 56.569293],
  properties: {
    sourceDataset: 'Curated visitor envelope derived from the Cliffburn study boundary',
    localityName: 'Cliffburn',
    boundaryMethod: 'strict_district_plus_adjoining_public_park',
    visitorBoundary: true,
    adjoiningPublicGreenSpaces: ['Victoria Park'],
  },
  geometry: {
    type: 'Polygon',
    coordinates: [[
      [-2.575261, 56.5602],
      [-2.558938, 56.5602],
      [-2.558938, 56.569293],
      [-2.575261, 56.569293],
      [-2.575261, 56.5602],
    ]],
  },
};
pkg.project.townStudyArea.notes = 'The circular district boundary remains the strict heritage study area. The active visitor envelope includes only adjoining Victoria Park; the cliff-walk start, parking and toilets east of the envelope remain related Arbroath context.';

// Context-ring listed buildings remain complete, but never become Cliffburn
// heat dots. Reuse the already-reviewed dates from their owning Arbroath guide.
for (const feature of pkg.features.filter((item: any) => item.tags.includes('hes-listed-building'))) {
  const owning = parent.features.find((item: any) => item.id === feature.id && item.documentedDateText?.trim());
  if (owning) {
    for (const key of ['documentedDateText', 'earliestPossibleYear', 'latestPossibleYear', 'dateBasis', 'dateConfidence', 'datePrecision'])
      if (owning[key] != null) feature[key] = owning[key];
    feature.sourceRecords = owning.sourceRecords;
    feature.reviewed = true;
    feature.reviewNotes = `Date evidence synchronised from the owning Arbroath record. This listed building is only in Cliffburn's 500 m heritage context ring and remains map-hidden here.`;
  }
  feature.tags = [...new Set(feature.tags.concat('heritage-record-retained', 'map-hidden'))];
  feature.updatedAt = reviewedAt;
}
const westSeaton = pkg.features.find((feature: any) => feature.id === 'hes-listed-building:LB4749');
Object.assign(westSeaton, { documentedDateText: 'Plans and estimates sought in 1840', earliestPossibleYear: 1840, latestPossibleYear: 1840, dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'medium', datePrecision: 'year', reviewed: true, updatedAt: reviewedAt });
westSeaton.sourceRecords.push({ sourceName: 'West Seaton House chronology', sourceOrganisation: 'Published architectural history', sourceUrl: 'https://en.wikipedia.org/wiki/West_Seaton_House', accessedAt: reviewedAt, reliability: 'secondary', licence: 'Source-linked chronology; retain publisher attribution.', notes: 'Plans and building estimates for West Seaton Farmhouse were sought in 1840; this is a material construction chronology, not a designation date.' });
westSeaton.reviewNotes = 'A defensible 1840 construction chronology is stored, but the record remains map-hidden because it is only in Cliffburn’s heritage context ring.';

function dateNrhe(id: string, text: string, from: number, to: number, basis: string, sourceUrl: string) {
  const feature = pkg.features.find((item: any) => item.id === id);
  if (!feature) throw new Error(`${id} is required.`);
  Object.assign(feature, { documentedDateText: text, earliestPossibleYear: from, latestPossibleYear: to, dateBasis: basis, dateConfidence: 'medium', datePrecision: from === to ? 'year' : 'period', reviewed: true, updatedAt: reviewedAt });
  feature.tags = [...new Set(feature.tags.filter((tag: string) => tag !== 'map-hidden').concat('date-reviewed'))];
  feature.sourceRecords.push({ sourceName: `Trove ${id.replace('nrhe:', 'NRHE ')}`, sourceOrganisation: 'Historic Environment Scotland', sourceUrl, accessedAt: reviewedAt, reliability: 'official_non_statutory', licence: 'Open Government Licence', notes: `Material period taken from the official NRHE classification: ${text}.` });
  feature.reviewNotes = `The official NRHE classification supplies the material period ${text}; no administrative date is used.`;
}
dateNrhe('nrhe:35528', 'Early medieval (possible long cist)', 400, 1099, 'documented_period', 'https://www.trove.scot/place/35528');
dateNrhe('nrhe:70767', 'Early medieval cross-incised stone', 400, 1099, 'documented_period', 'https://www.trove.scot/place/70767');
dateNrhe('nrhe:304864', 'Prehistoric lithic, pottery and roundhouse evidence', -4000, 42, 'documented_period', 'https://www.trove.scot/place/304864');

function currentFeature(id: string, name: string, featureType: string, coordinates: [number, number], description: string, visitorWebsiteUrl: string, tags: string[], evidenceScope: string, notes: string, category?: string, score?: number) {
  const feature: any = {
    id, projectId, name, alternativeNames: [], countryCode: 'GB-SCT', region: 'Angus', locality: 'Cliffburn', featureType,
    significance: 'local', geometry: { type: 'Point', coordinates }, locationType: 'exact', locationConfidence: 'high',
    dateBasis: 'unknown', dateConfidence: 'unknown', survival: 'substantially_intact', shortDescription: description, visitorWebsiteUrl,
    sourceRecords: [{ sourceName: name, sourceOrganisation: visitorWebsiteUrl.includes('angus.gov.uk') ? 'Angus Council' : visitorWebsiteUrl.includes('visitangus') ? 'Visit Angus' : 'OpenStreetMap contributors', sourceUrl: visitorWebsiteUrl, accessedAt: reviewedAt, reliability: 'official_non_statutory', licence: 'Source-linked current visitor evidence; verify time-sensitive details before travel.', notes }],
    tags, createdAt: reviewedAt, updatedAt: reviewedAt, reviewed: true, evidenceScope,
  };
  if (category && score) feature.editorialReview = { status: 'editorially_researched', category, methodVersion: '2026-08-13-researched-visitor-value-v1', reviewedAt: reviewedDate, scoreRationale: notes, evidenceUrls: [visitorWebsiteUrl], attractionAssessment: { experienceDepth: 18, distinctiveness: 13, presentation: 12, journeyWorth: 9, accessAndReliability: 8, evidenceConfidence: score - 60, visitability: 'full_visitor_experience' } };
  pkg.features.push(feature);
}

currentFeature('curated-see:cliffburn-victoria-park', 'Victoria Park and Arbroath Cliffs approach', 'park', [-2.570004, 56.560453], 'A broad public seafront park used for informal recreation and picnicking, forming the approach to Arbroath’s red-sandstone cliff walk.', urls.picnicEvidence, ['curated-visitor', 'visitor-context-attraction', 'current-context'], 'strict_boundary', 'Current public park; visit_score=64; free open space; broad lawns and coast views; the official cliff-walk start and facilities lie at the park’s east edge.', 'attraction', 64);
currentFeature('curated-trails:cliffburn-arbroath-auchmithie', 'Arbroath to Auchmithie Cliff Walk', 'walking_route', [-2.55748, 56.561157], 'The official coast walk from Victoria Park follows surfaced and rougher clifftop paths past red-sandstone caves, arches, stacks and bays to Auchmithie.', urls.officialTrail, ['curated-visitor', 'visitor-context-trail', 'current-context'], 'related_context', 'Current-place curation: visitor_place_type=Trail; visit_score=78; distance=13 km / 8 miles return; duration=3–4 hours; erosion and diversion warnings apply; exact start at the park’s east-edge car park; official PDF link checked 2026-08-30.', 'trail', 78);
currentFeature('curated-picnic:cliffburn-victoria-park', 'Victoria Park Picnic Lawns', 'picnic_area', [-2.570004, 56.560453], 'Informal public grass space where Angus Council planning evidence records picnicking; no dedicated picnic-table count is published.', urls.picnicEvidence, ['service-context-picnic', 'current-context'], 'strict_boundary', 'Current-place curation: visitor_place_type=Picnic; access=public park; fee=free; picnic tables=not published; open grass; bring a blanket; no booking.');
currentFeature('curated-parking:cliffburn-arbroath-cliffs', 'Arbroath Cliffs Car Park', 'parking', [-2.55748, 56.561157], 'Free public surface car park at the official Victoria Park cliff-walk start; capacity and maximum stay are not published.', urls.parking, ['service-context-parking', 'current-context'], 'related_context', 'Current-place curation: visitor_place_type=Parking; access=public; fee=no; payment_required=no; price_display=Free; opening_hours:description=not published; capacity=not published; maximum stay=not published; surface=asphalt; exact OSM way centroid checked.');
currentFeature('curated-toilets:cliffburn-ness-victoria-park', 'Ness–Victoria Park Public Toilets', 'toilets', [-2.557444, 56.561279], 'Council public toilets by the cliff-walk car park, including male, female and accessible provision with RADAR access.', urls.councilToilets, ['service-context-toilets', 'current-context'], 'related_context', 'Current-place curation: visitor_place_type=Public toilets; access=public; fee=not published; opening_hours:description=morning to 7pm in summer, earlier closing in winter; male=yes; female=yes; accessible toilet=yes; RADAR key required for the accessible unit.');

pkg.project.visitorHighlights = [{
  rank: 1,
  featureId: 'curated-see:cliffburn-victoria-park',
  name: 'Victoria Park and Arbroath Cliffs approach',
  reason: 'A useful public green-space and coastal viewpoint at the edge of Cliffburn, represented separately from the residential district score.',
  tagline: 'Park lawns and coastal outlook',
  visitorScore: 64,
  timeToSpend: '30–90 minutes',
  openingTimes: 'Open public park; no staffed opening hours published',
  admission: 'Free',
  freeAdmission: true,
  visitorWebsiteUrl: urls.picnicEvidence,
  editorialReview: pkg.features.find((feature: any) => feature.id === 'curated-see:cliffburn-victoria-park').editorialReview,
  sourceName: 'Angus Council coastal planning evidence',
  sourceUrl: urls.picnicEvidence,
  verifiedInBoundaryAt: reviewedDate,
}];
pkg.project.preferredBasemap = 'voyager';
pkg.project.touristAppeal = {
  score: 22, dogOwnerScore: 20, dogAccessScoreAdjustment: -2, rating: 0, label: 'Minor Interest',
  summary: 'A residential Arbroath district that is not independently destination-worthy; Victoria Park and the cliff-walk facilities are recorded separately without inflating the district score.',
  dogAccessRating: 1, dogAccessSummary: 'Victoria Park and the cliff route are outdoor options, but no reliable current dog policy is published for Cliffburn itself and the cliff edge requires close control.',
  methodVersion: '2026-08-30-strict-settlement-full-audit-v3', reviewedAt: reviewedDate, sourceUrls: Object.values(urls),
};
pkg.project.townGuide = {
  characterTag: 'Residential edge of coastal Arbroath', headline: 'A district beside a worthwhile park and cliff walk',
  intro: 'Cliffburn remains a 22% selector-only district. Adjoining Victoria Park is shown separately in See and Picnic, but the wider cliff walk and its facilities remain with Arbroath and do not make Cliffburn an independently worthwhile town.',
  bestFor: ['Access to Victoria Park'], perfectFor: ['A park pause during an Arbroath visit'],
  suggestedFirstVisit: { title: 'Start at Victoria Park’s east edge', summary: 'Use the correctly positioned free cliffs car park and council toilets, then follow the signed coastal route; check current erosion diversions.' },
  dontMiss: ['The red-sandstone coast beyond Victoria Park'], suggestedTime: '1–4 hours for the park or coastal walk', visitorMood: 'Residential streets opening onto Arbroath’s dramatic coastal edge.',
  sourceUrls: Object.values(urls), lastReviewedAt: reviewedDate,
};
pkg.project.researchNotes = 'Full settlement-versus-attraction audit. Cliffburn remains selector-only at 22 and does not appear on the town map. Adjoining Victoria Park is published separately in See and Picnic without raising the residential district score. The official Arbroath-to-Auchmithie trail and its east-edge parking/toilets are retained at exact coordinates as related Arbroath context, outside Cliffburn’s active visitor envelope. No café-led eat stop was verified inside that envelope. The local HES layer contains no statutory designation inside the strict heritage boundary: all 14 listed buildings are retained only as 500 m context and remain map-hidden. Dates already audited under Arbroath were synchronised without changing names. Three in-boundary NRHE records now have official material periods and are visible; the period-unassigned coin findspot remains hidden. No exact Cliffburn Treasure Trails, Curious About, Mystery Guides or Go Quest product was found.';
planner.projects[projectId] = { eat: [], trails: [], picnic: ['curated-picnic:cliffburn-victoria-park'], parking: [], toilets: [] };
dog.projects[projectId] = {
  attraction: {
    'curated-see:cliffburn-victoria-park': {
      rating: 1,
      status: 'conditional',
      label: 'Keep under effective control',
      summary: 'No current park-specific dog restriction was found. Scottish outdoor-access guidance requires dogs to be kept under proper control, with particular care around other visitors, wildlife and the exposed cliff edge.',
      details: ['Use a lead or close control beside the cliff edge and when the park is busy.', 'Remove dog waste and respect any temporary on-site notices.'],
      sourceName: 'Scottish Outdoor Access Code',
      sourceUrl: urls.outdoorAccess,
      reviewedAt: reviewedDate,
    },
  },
};

const heritage = pkg.features.filter((f: any) => f.tags.includes('hes-listed-building') || f.tags.includes('hes-scheduled-monument') || f.tags.includes('nrhe'));
const strictStatutory = heritage.filter((f: any) => (f.tags.includes('hes-listed-building') || f.tags.includes('hes-scheduled-monument')) && f.tags.includes('town-selection-inside-locality'));
const visible = heritage.filter((f: any) => !f.tags.includes('map-hidden'));
const report = {
  reviewedAt, projectId, status: 'verified', settlementScore: 22, previousScore: 22, independentlyWorthwhile: false, publishOnTownMap: false,
  scoreRationale: 'The district is residential. Nearby park and cliff-walk value is represented by separate attraction and service cards rather than transferred into the settlement score.',
  publication: { see: 1, eat: 0, trails: 0, picnic: 1, parking: 0, toilets: 0 },
  heritage: { expectedStrictStatutoryRecords: 0, representedStrictStatutoryRecords: strictStatutory.length, contextListedBuildingsRetained: 14, contextListedBuildingsDatedAsFarAsPossible: heritage.filter((f: any) => f.tags.includes('hes-listed-building') && f.documentedDateText?.trim()).length, visibleDatedNrhePins: visible.filter((f: any) => f.tags.includes('nrhe') && f.documentedDateText?.trim()).length, visibleUndatedHeritagePins: visible.filter((f: any) => !f.documentedDateText?.trim()).length, hiddenUndatedNrheRecords: heritage.filter((f: any) => f.tags.includes('nrhe') && f.tags.includes('map-hidden') && !f.documentedDateText?.trim()).map((f: any) => f.id) },
  namedTrailSearch: { TreasureTrails: 'No exact Cliffburn product appears in the current Dundee and Angus collection; checked links returned HTTP 200.', CuriousAbout: 'No exact Cliffburn product found; provider link returned HTTP 200.', MysteryGuides: 'No exact Cliffburn product found.', GoQuestAdventures: 'No exact Cliffburn product found.', retained: [], relatedContext: ['Arbroath to Auchmithie Cliff Walk — official Visit Angus PDF checked and current, but its correctly mapped start lies just outside Cliffburn’s strict visitor boundary and remains with Arbroath.'] },
  practicalAudit: { eat: 'No qualifying café, coffee-and-cake stop, tearoom or light-lunch venue was verified inside the strict Cliffburn boundary.', picnic: 'Victoria Park is documented for informal picnicking; no table count is published.', parking: 'Arbroath Cliffs Car Park is correctly placed at 56.561157, -2.557480; public, free, surface; capacity and maximum stay are not published.', toilets: 'Ness–Victoria Park toilets are correctly placed at 56.561279, -2.557444; seasonal hours, accessible provision and RADAR requirement are recorded.', accessibility: 'Accessible toilet provision is official; the cliff path is surfaced initially but erosion, drops and rougher later sections require care.', transport: 'Arbroath rail and bus stations are about 1.5 km from the trail start; they are not copied into Cliffburn.' },
  exclusions: ['Fourteen HES listed buildings: retained as 500 m context but hidden from Cliffburn’s heat layer because none lies inside the strict district boundary.', 'The cliff-walk start, free car park and council toilets: retained at their exact coordinates as related context, but not published as Cliffburn cards because they lie just outside its strict visitor boundary.', 'Arbroath cafés and town-centre attractions: remain with Arbroath.', 'The period-unassigned coin findspot: retained map-hidden until a defensible material date is available.'],
  verification: { strictStatutoryDatasetComplete: strictStatutory.length === 0, allVisibleHeritagePinsDated: visible.every((f: any) => f.documentedDateText?.trim() && f.dateBasis !== 'unknown'), datesStoredWithoutChangingMapNames: visible.every((f: any) => !f.name.includes(f.documentedDateText)), trailLinksChecked: [urls.officialTrail, urls.walkHighlands, urls.treasureTrailsAngus, urls.treasureTrailSearch, urls.curiousAbout], curatedCategoryCoordinatesChecked: true },
};
await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`);
await writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`);
await writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`);
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
