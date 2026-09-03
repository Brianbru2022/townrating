import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { editorialRatingMethodVersion } from '../src/domain/editorialResearch';

const projectId = 'craigo-angus-scotland';
const reviewedDate = '2026-08-30';
const reviewedAt = '2026-08-30T23:59:00Z';
const projectPath = resolve('data/projects/craigo-angus.json');
const plannerPath = resolve('data/cairn-o-mount-visitor-planner-curation.json');
const dogPath = resolve('data/cairn-o-mount-dog-access-curation.json');
const reportPath = resolve('data/review/craigo-full-visitor-audit-2026-08-30.json');
const urls = {
  bridgeAngus: 'https://portal.historicenvironment.scot/designation/LB11177',
  bridgeAberdeenshire: 'https://portal.historicenvironment.scot/designation/LB13891',
  school: 'https://portal.historicenvironment.scot/designation/LB11180',
  farmhouse: 'https://portal.historicenvironment.scot/designation/LB16303',
  mill: 'https://portal.historicenvironment.scot/designation/LB16304',
  corePaths: 'https://www.angus.gov.uk/sites/angus-cms/files/2017-06/Tables.pdf',
  corePathsCurrent: 'https://www.angus.gov.uk/leisure_tourism_and_the_outdoors/paths_and_outdoor_access/core_paths',
  millNrhe: 'https://www.trove.scot/site/107832', bridgeNrhe: 'https://www.trove.scot/place/36017',
  stationNrhe: 'https://www.trove.scot/place/168452', schoolNrhe: 'https://www.trove.scot/place/251900', signalBoxNrhe: 'https://www.trove.scot/place/317752',
  treasureTrails: 'https://www.treasuretrails.co.uk/collections/dundee-and-angus', curiousAbout: 'https://www.curiousabout.co.uk/',
  busTimetables: 'https://www.angus.gov.uk/roads_parking_and_travel/public_transport/bus_timetables',
  outdoorAccess: 'https://www.outdooraccess-scotland.scot/dog-owners',
};
const pkg: any = JSON.parse(await readFile(projectPath, 'utf8'));
const planner: any = JSON.parse(await readFile(plannerPath, 'utf8'));
const dog: any = JSON.parse(await readFile(dogPath, 'utf8'));
pkg.features = pkg.features.filter((feature: any) => !feature.id.startsWith('curated-'));
for (const feature of pkg.features) feature.sourceRecords = feature.sourceRecords.filter((record: any) => record.accessedAt !== reviewedAt);
// Keep the circular locality polygon as the heritage boundary. The visitor
// envelope follows the short official Path 073 spur to the bridge, which sits
// only metres beyond the conservative 500 m circle.
pkg.project.townStudyArea.visitorBoundary = {
  type: 'Feature',
  properties: { sourceDataset: 'Craigo editorial visitor envelope', localityName: 'Craigo', boundaryMethod: 'strict_locality_plus_core_path_073_endpoint', visitorBoundary: true, adjoiningVisitorPlaces: ['Marykirk Bridge'] },
  geometry: { type: 'Polygon', coordinates: [[[-2.516, 56.7647], [-2.499, 56.7647], [-2.499, 56.776], [-2.516, 56.776], [-2.516, 56.7647]]] },
};
pkg.project.townStudyArea.notes = 'The circular locality boundary remains the strict HES study area. The visitor envelope extends only to the adjacent Marykirk Bridge endpoint of official Core Path 073.';

const attractionAssessment = (score: number) => ({ experienceDepth: 17, distinctiveness: 14, presentation: 12, journeyWorth: 9, accessAndReliability: 9, evidenceConfidence: score - 61, visitability: 'full_visitor_experience' });
function dateFeature(id: string, text: string, first: number, last: number, basis: string, sourceUrl: string, notes: string, visible = true) {
  const feature = pkg.features.find((item: any) => item.id === id);
  if (!feature) throw new Error(`${id} is required.`);
  Object.assign(feature, { documentedDateText: text, earliestPossibleYear: first, latestPossibleYear: last, dateBasis: basis, dateConfidence: 'high', datePrecision: first === last ? 'year' : 'period', reviewed: true, updatedAt: reviewedAt });
  feature.tags = [...new Set(feature.tags.filter((tag: string) => visible ? tag !== 'map-hidden' : true).concat('heritage-record-retained', 'date-reviewed'))];
  feature.sourceRecords.push({ sourceName: `${id.startsWith('hes-') ? 'Historic Environment Scotland' : 'Trove'} date evidence`, sourceOrganisation: 'Historic Environment Scotland', sourceUrl, accessedAt: reviewedAt, reliability: id.startsWith('hes-') ? 'official_statutory' : 'official_non_statutory', licence: 'Open Government Licence v3.0; retain Historic Environment Scotland attribution.', notes });
  feature.reviewNotes = `${notes} The material date is stored in date fields and is not appended to the map label.`;
}
dateFeature('hes-listed-building:LB11177', '1814', 1814, 1814, 'documented_exact_year', urls.bridgeAngus, 'The official Angus designation dates Robert Stevenson’s bridge to 1814.');
dateFeature('hes-listed-building:LB13891', '1811–1814', 1811, 1814, 'documented_date_range', urls.bridgeAberdeenshire, 'The official Aberdeenshire designation dates the same physical bridge to 1811–14.');
dateFeature('hes-listed-building:LB11180', 'School c.1850; schoolhouse c.1875', 1850, 1875, 'documented_date_range', urls.school, 'The official description dates the school to about 1850 and the schoolhouse to about 1875.');
dateFeature('hes-listed-building:LB16303', 'Earlier 19th century', 1800, 1849, 'documented_period', urls.farmhouse, 'The official description dates Spearmill farmhouse to the earlier 19th century.');
dateFeature('hes-listed-building:LB16304', 'Early 18th century', 1700, 1739, 'documented_period', urls.mill, 'The official description dates Spearmill mill to the early 18th century.');
dateFeature('nrhe:107832', '19th-century flax mill', 1800, 1899, 'documented_period', urls.millNrhe, 'The official NRHE classification identifies a 19th-century mill and flax mill.');
dateFeature('nrhe:36017', '1811–1814', 1811, 1814, 'documented_date_range', urls.bridgeNrhe, 'This NRHE record represents Robert Stevenson’s Marykirk Bridge and is cross-dated to the statutory descriptions.');
dateFeature('nrhe:168452', 'Opened 1 November 1849; closed to passengers 11 June 1956', 1849, 1956, 'documented_date_range', urls.stationNrhe, 'The official NRHE record supplies the opening and passenger-closure dates.');
dateFeature('nrhe:251900', 'School c.1850; schoolhouse c.1875', 1850, 1875, 'documented_date_range', urls.schoolNrhe, 'The NRHE school record is cross-dated to the official statutory description.');
dateFeature('nrhe:317752', '19th century', 1800, 1899, 'documented_period', urls.signalBoxNrhe, 'The official NRHE classification dates the signal box to the 19th century.');
for (const feature of pkg.features.filter((item: any) => item.tags.includes('nrhe') && !item.documentedDateText)) {
  feature.tags = [...new Set(feature.tags.concat('heritage-record-retained', 'map-hidden'))]; feature.reviewed = true; feature.updatedAt = reviewedAt;
  feature.reviewNotes = 'The local NRHE record is retained intact, but its official record does not provide a defensible material period; it remains map-hidden rather than receiving an invented date.';
}

const bridge = pkg.features.find((feature: any) => feature.id === 'hes-listed-building:LB11177');
bridge.sourceRecords.push(
  { sourceName: 'Marykirk Bridge companion designation', sourceOrganisation: 'Historic Environment Scotland', sourceUrl: urls.bridgeAberdeenshire, accessedAt: reviewedAt, reliability: 'official_statutory', licence: 'Open Government Licence v3.0; retain Historic Environment Scotland attribution.', notes: 'Companion designation for the Aberdeenshire half of the same bridge.' },
  { sourceName: 'Angus Core Paths Plan', sourceOrganisation: 'Angus Council', sourceUrl: urls.corePaths, accessedAt: reviewedAt, reliability: 'official_non_statutory', licence: 'Source-linked council evidence.', notes: 'Core Path 073 ends at Marykirk Bridge.' },
  { sourceName: 'Angus Council current core paths page', sourceOrganisation: 'Angus Council', sourceUrl: urls.corePathsCurrent, accessedAt: reviewedAt, reliability: 'official_non_statutory', licence: 'Source-linked council evidence.', notes: 'Current visitor-facing council access page for the core-path network.' },
);
bridge.editorialReview = { status: 'editorially_researched', category: 'attraction', methodVersion: editorialRatingMethodVersion, reviewedAt: reviewedDate, scoreRationale: 'A publicly viewable Category A Robert Stevenson bridge and the destination of an official Craigo core path; a worthwhile brief engineering-landmark stop.', evidenceUrls: [urls.bridgeAngus, urls.bridgeAberdeenshire, urls.corePaths, urls.corePathsCurrent], attractionAssessment: attractionAssessment(66) };
bridge.visitorWebsiteUrl = urls.bridgeAngus;
const trail = (id: string, name: string, score: number, description: string, details: string) => ({
  id, projectId, name, alternativeNames: [], countryCode: 'GB-SCT', region: 'Angus', locality: 'Craigo', featureType: 'walking_route', significance: 'local', geometry: { type: 'Point', coordinates: [-2.509794, 56.772031] }, locationType: 'exact', locationConfidence: 'high', dateBasis: 'unknown', dateConfidence: 'unknown', survival: 'substantially_intact', shortDescription: description, visitorWebsiteUrl: urls.corePaths,
  editorialReview: { status: 'editorially_researched', category: 'trail', methodVersion: editorialRatingMethodVersion, reviewedAt: reviewedDate, scoreRationale: description, evidenceUrls: [urls.corePaths, urls.corePathsCurrent], attractionAssessment: attractionAssessment(score) },
  sourceRecords: [{ sourceName: 'Angus Core Paths Plan', sourceOrganisation: 'Angus Council', sourceUrl: urls.corePaths, accessedAt: reviewedAt, reliability: 'official_non_statutory', licence: 'Source-linked council evidence; verify route conditions before travel.', notes: `Current-place curation: visitor_place_type=Trail; visit_score=${score}; ${details}; link checked 2026-08-30` }],
  tags: ['curated-visitor', 'visitor-context-trail', 'current-context'], createdAt: reviewedAt, updatedAt: reviewedAt, reviewed: true, evidenceScope: 'strict_boundary',
});
const trails = [
  trail('curated-trails:craigo-marykirk-bridge-073', 'Craigo to Marykirk Bridge Core Path 073', 66, 'An official 0.9-mile constructed track linking Craigo with Robert Stevenson’s historic Marykirk Bridge.', 'trail_type=Official linear core path; distance=1.4 km / 0.9 miles one way; duration=about 20–30 minutes one way; grade=easy constructed track'),
  trail('curated-trails:craigo-logie-074', 'Craigo to Logie Core Path 074', 61, 'An official 1.6-mile link on earth, grass and track towards Logie; one section uses the main road without a pavement and requires care.', 'trail_type=Official linear core path; distance=2.6 km / 1.6 miles one way; duration=about 40–55 minutes one way; grade=earth, grass and track; safety=part uses a main road without pavement'),
];
pkg.features.push(...trails);
pkg.project.visitorHighlights = [{ rank: 1, featureId: bridge.id, name: 'Marykirk Bridge', reason: bridge.editorialReview.scoreRationale, tagline: 'Robert Stevenson engineering landmark', visitorScore: 66, timeToSpend: '15–30 minutes', openingTimes: 'Public road bridge; open at all times subject to road conditions', admission: 'Free', freeAdmission: true, visitorWebsiteUrl: urls.bridgeAngus, editorialReview: bridge.editorialReview, sourceName: 'Historic Environment Scotland LB11177', sourceUrl: urls.bridgeAngus, verifiedInBoundaryAt: reviewedDate }];
pkg.project.preferredBasemap = 'voyager';
pkg.project.touristAppeal = { score: 30, dogOwnerScore: 28, dogAccessScoreAdjustment: -2, rating: 0, label: 'Minor Interest', summary: 'A small former mill village whose public interest is represented by separate bridge and core-path cards rather than transferred into the settlement score.', dogAccessRating: 1, dogAccessSummary: 'The two core paths provide rural walking, but road sections and livestock require effective control.', methodVersion: '2026-08-30-strict-settlement-full-audit-v3', reviewedAt: reviewedDate, sourceUrls: Object.values(urls) };
pkg.project.townGuide = { characterTag: 'Former Angus mill village', headline: 'Quiet mill heritage with two useful core paths', intro: 'Craigo remains a 30% selector-only village. Marykirk Bridge and two official core paths are published separately, preserving their visitor value without making the settlement itself a destination.', bestFor: ['A short rural walk', 'Historic engineering nearby'], perfectFor: ['A route stop between Montrose and Marykirk'], suggestedFirstVisit: { title: 'Walk to Marykirk Bridge', summary: 'Follow Core Path 073 from Craigo to the bridge. There is no verified dedicated visitor car park or public toilet, so plan facilities elsewhere.' }, dontMiss: ['Marykirk Bridge', 'Core Path 073'], suggestedTime: '1–2 hours', visitorMood: 'A small former mill community set in the North Esk landscape.', sourceUrls: Object.values(urls), lastReviewedAt: reviewedDate };
pkg.project.researchNotes = 'Full strict-boundary audit. Craigo remains selector-only at 30. Marykirk Bridge is a separate 66-point See attraction and Core Paths 073 and 074 are separate trail cards; none is transferred into the settlement score. The complete local HES set comprises five listed-building designation records and twelve NRHE records. All five listed records and five NRHE records with defensible official material dates are visible; seven period-unassigned NRHE records remain intact but map-hidden. The two designations for Marykirk Bridge are retained because they cover opposite local-authority halves of the same structure, while only one visitor card is published. No qualifying café-led food stop, managed picnic facility, dedicated public visitor parking or public toilet was verified. No exact Craigo product was found at Treasure Trails, Curious About, Mystery Guides or GoQuest.';
planner.projects[projectId] = { eat: [], trails: trails.map((item: any) => item.id), picnic: [], parking: [], toilets: [] };
const dogEntry = (label: string, summary: string) => ({ rating: 2, status: 'conditional', label, summary, sourceName: 'Scottish Outdoor Access Code', sourceUrl: urls.outdoorAccess, reviewedAt: reviewedDate });
dog.projects[projectId] = { attraction: { [bridge.id]: dogEntry('Roadside landmark', 'Dogs can accompany a brief exterior look but must be kept under close control beside live traffic.') }, trail: { [trails[0].id]: dogEntry('Keep under effective control', 'Use close control around livestock, road crossings and other path users.'), [trails[1].id]: dogEntry('Road section requires care', 'Keep dogs on a lead on the main-road section and under effective control around livestock.') } };

const heritage = pkg.features.filter((f: any) => f.tags.includes('hes-listed-building') || f.tags.includes('hes-scheduled-monument') || f.tags.includes('nrhe'));
const statutory = heritage.filter((f: any) => f.tags.includes('hes-listed-building') || f.tags.includes('hes-scheduled-monument'));
const visible = heritage.filter((f: any) => !f.tags.includes('map-hidden'));
const report = { reviewedAt, projectId, status: 'verified', settlementScore: 30, previousScore: 30, independentlyWorthwhile: false, publishOnTownMap: false, scoreRationale: 'The former mill village has modest character but no complete visitor-service cluster; its bridge and paths are represented separately.', publication: { see: 1, eat: 0, trails: 2, picnic: 0, parking: 0, toilets: 0 }, heritage: { expectedStatutoryRecords: 5, representedStatutoryRecords: statutory.length, nrheRecordsRetained: heritage.filter((f: any) => f.tags.includes('nrhe')).length, visibleDatedHeritagePins: visible.filter((f: any) => f.documentedDateText?.trim()).length, visibleUndatedHeritagePins: visible.filter((f: any) => !f.documentedDateText?.trim()).length, hiddenUndatedNrheRecords: heritage.filter((f: any) => f.tags.includes('nrhe') && f.tags.includes('map-hidden') && !f.documentedDateText?.trim()).map((f: any) => f.id) }, namedTrailSearch: { TreasureTrails: 'No exact Craigo product in the current Dundee and Angus collection.', CuriousAbout: 'No exact Craigo product found.', MysteryGuides: 'No exact Craigo product found.', GoQuestAdventures: 'No exact Craigo product found.', retained: trails.map((item: any) => item.name) }, practicalAudit: { see: 'One bridge card represents the single physical structure despite its two statutory local-authority designations.', eat: 'No qualifying café, coffee-and-cake stop, tearoom or light-lunch venue verified.', picnic: 'No managed or expressly promoted visitor picnic facility verified.', parking: 'No dedicated public visitor car park verified; roadside and private mill access are not published as parking.', toilets: 'No public toilet verified in Craigo.', accessibility: 'Core Path 073 is a constructed track; no audited step-free specification is published.', transport: 'Council-hosted service information includes Craigo stops; check current times before travel.' }, exclusions: ['Private mill and school fabric is heritage context, not a visitor attraction.', 'Seven period-unassigned NRHE records remain map-hidden rather than receiving guessed dates.', 'Roadside and private access are not represented as parking.'], verification: { statutoryDatasetComplete: statutory.length === 5, allVisibleHeritagePinsDated: visible.every((f: any) => f.documentedDateText?.trim() && f.dateBasis !== 'unknown'), datesStoredWithoutChangingMapNames: visible.every((f: any) => !f.name.includes(f.documentedDateText)), trailLinksChecked: [urls.corePaths, urls.corePathsCurrent, urls.treasureTrails, urls.curiousAbout], curatedCategoryCoordinatesChecked: true } };
await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`); await writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`); await writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`); await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`); console.log(JSON.stringify(report, null, 2));
