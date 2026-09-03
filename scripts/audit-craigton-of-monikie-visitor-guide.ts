import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { HeritageFeature, ProjectPackage, VisitorHighlight } from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';

const projectId = 'craigton-of-monikie-scotland';
const reviewedDate = '2026-08-30';
const reviewedAt = '2026-08-30T23:59:59.000Z';
const projectPath = resolve('data/projects/craigton-of-monikie.json');
const plannerPath = resolve('data/cairn-o-mount-visitor-planner-curation.json');
const dogPath = resolve('data/cairn-o-mount-dog-access-curation.json');
const reportPath = resolve('data/review/craigton-of-monikie-full-visitor-audit-2026-08-30.json');
const correctionPath = resolve('data/review/strict-settlement-score-correction-2026-08-30.json');
type F = HeritageFeature & Record<string, any>;
type P = ProjectPackage & { project: ProjectPackage['project'] & Record<string, any>; features: F[] };

const urls = {
  place: 'https://www.openstreetmap.org/node/5000008607',
  park: 'https://angusalive.scot/countryside-adventure/visit-us/monikie-country-park/',
  parkOsm: 'https://www.openstreetmap.org/way/560521879',
  circuit: 'https://www.walkhighlands.co.uk/angus/monikie.shtml',
  cafe: 'https://www.cafebyzantium.com/',
  cafeOsm: 'https://www.openstreetmap.org/way/622083924',
  parkingOsm: 'https://www.openstreetmap.org/way/622083912',
  toiletsOsm: 'https://www.openstreetmap.org/way/622083910',
  picnicOsm: 'https://www.openstreetmap.org/node/5876535204',
  paths: 'https://www.angus.gov.uk/sites/default/files/2019-04/Core%20Paths%20Plan%20tables%20%28updated%20April%202019%29.pdf',
  treasure: 'https://www.treasuretrails.co.uk/collections/dundee-and-angus',
  curious: 'https://www.curiousabout.co.uk/',
  mystery: 'https://www.mysteryguides.co.uk/',
  goQuest: 'https://goquestadventures.com/',
  churchHer: 'https://her.aberdeenshire.gov.uk/Monument/MAB36075',
  manseHer: 'https://her.aberdeenshire.gov.uk/Monument/MAB36094',
  testimonial: 'https://portal.historicenvironment.scot/designation/LB17607',
  testimonialNrhe: 'https://www.trove.scot/place/34557',
  ruins: 'https://portal.historicenvironment.scot/designation/LB19877',
  reservoirs: 'https://www.trove.scot/place/219564',
  reservoirHistory: 'https://www.monikie.org.uk/journey-dta.htm',
  dogCode: 'https://www.outdooraccess-scotland.scot/dog-owners',
};

const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as P;
const planner = JSON.parse(await readFile(plannerPath, 'utf8')) as any;
const dog = JSON.parse(await readFile(dogPath, 'utf8')) as any;
const correction = JSON.parse(await readFile(correctionPath, 'utf8')) as any;

const scoreAssessment = (score: number) => ({
  experienceDepth: Math.round(score * .3), distinctiveness: Math.round(score * .2), presentation: Math.round(score * .2), journeyWorth: Math.round(score * .15), accessAndReliability: Math.round(score * .1),
  evidenceConfidence: score - Math.round(score * .3) - Math.round(score * .2) - Math.round(score * .2) - Math.round(score * .15) - Math.round(score * .1), visitability: 'full_visitor_experience' as const,
});
const foodAssessment = (score: number) => ({
  foodAndDrinkQuality: Math.round(score * .29), daytimeRelevance: Math.round(score * .21), distinctiveness: Math.round(score * .15), consistency: Math.round(score * .14), visitorFit: Math.round(score * .11),
  evidenceConfidence: score - Math.round(score * .29) - Math.round(score * .21) - Math.round(score * .15) - Math.round(score * .14) - Math.round(score * .11),
});
const source = (name: string, organisation: string, url: string, notes: string, reliability: any = 'official_non_statutory', sourceRecordId?: string) => ({
  sourceName: name, sourceOrganisation: organisation, sourceUrl: url, sourceRecordId, accessedAt: reviewedAt, reliability,
  licence: url.includes('openstreetmap.org') ? 'Open Database Licence (ODbL) v1.0; © OpenStreetMap contributors.' : 'Source-linked editorial evidence; verify time-sensitive details before travel.', notes,
});
const make = (spec: Record<string, any>): F => ({
  id: spec.id, projectId, name: spec.name, alternativeNames: [], countryCode: 'GB-SCT', region: 'Angus', locality: 'Craigton of Monikie', featureType: spec.featureType,
  significance: spec.significance ?? 'local', geometry: { type: 'Point', coordinates: spec.coordinates }, locationType: spec.locationType ?? 'exact', locationConfidence: 'high',
  dateBasis: 'unknown', dateConfidence: 'unknown', survival: 'substantially_intact', shortDescription: spec.description,
  visitorWebsiteUrl: spec.website,
  editorialReview: spec.score ? { status: 'editorially_researched', category: spec.category, methodVersion: '2026-08-30-researched-visitor-value-v1', reviewedAt: reviewedDate, scoreRationale: spec.reason, evidenceUrls: spec.evidenceUrls, ...(spec.category === 'food' ? { foodAssessment: foodAssessment(spec.score) } : { attractionAssessment: scoreAssessment(spec.score) }) } : undefined,
  sourceRecords: spec.evidenceUrls.map((url: string, index: number) => source(index ? `${spec.name} supporting evidence` : spec.sourceName, index ? (url.includes('openstreetmap.org') ? 'OpenStreetMap contributors' : 'Supporting publisher') : spec.sourceOrganisation, url, `Current-place curation: visitor_place_type=${spec.placeType}; ${spec.score ? `visit_score=${spec.score}; ` : ''}${spec.details}`, url.includes('angusalive.scot') || url.includes('angus.gov.uk') ? 'local_authority' : url.includes('openstreetmap.org') ? 'discovery_only' : 'official_non_statutory', spec.sourceRecordIds?.[index])),
  tags: spec.tags, createdAt: reviewedAt, updatedAt: reviewedAt, reviewed: true, evidenceScope: 'parish_evidence',
} as F);

const dates: Record<string, { text: string; earliest: number; latest: number; precision: string; confidence: string; url: string; organisation: string; hidden: boolean; notes: string }> = {
  'hes-listed-building:LB17604': { text: '1811–1812', earliest: 1811, latest: 1812, precision: 'year_range', confidence: 'high', url: urls.churchHer, organisation: 'Aberdeenshire Council Historic Environment Record', hidden: true, notes: 'Present church fabric; earlier church history and later alterations are not substituted for its construction date.' },
  'hes-listed-building:LB17605': { text: 'Probably early 19th century', earliest: 1800, latest: 1830, precision: 'period_range', confidence: 'medium', url: urls.churchHer, organisation: 'Aberdeenshire Council Historic Environment Record', hidden: true, notes: 'Material date of the hearse house; retained as Kirkton of Monikie context.' },
  'hes-listed-building:LB17606': { text: '1794; extended 1827', earliest: 1794, latest: 1827, precision: 'year_range', confidence: 'high', url: urls.manseHer, organisation: 'Aberdeenshire Council Historic Environment Record', hidden: true, notes: 'Original manse and documented extension; retained as Kirkton of Monikie context.' },
  'hes-listed-building:LB17607': { text: '1839', earliest: 1839, latest: 1839, precision: 'exact_year', confidence: 'high', url: urls.testimonialNrhe, organisation: 'Historic Environment Scotland', hidden: false, notes: 'Construction date of the Panmure Testimonial, not its listing date.' },
  'hes-listed-building:LB19877': { text: '18th century', earliest: 1700, latest: 1799, precision: 'century', confidence: 'medium', url: urls.ruins, organisation: 'Historic Environment Scotland', hidden: true, notes: 'Material century of the estate folly; retained as buffer context.' },
  'nrhe:219564': { text: '1848', earliest: 1848, latest: 1848, precision: 'exact_year', confidence: 'high', url: urls.reservoirs, organisation: 'Historic Environment Scotland', hidden: false, notes: 'NRHE classification supplies the material year 1848.' },
  'nrhe:219566': { text: '1847–1853', earliest: 1847, latest: 1853, precision: 'year_range', confidence: 'medium', url: urls.reservoirHistory, organisation: 'Monikie Local History', hidden: false, notes: 'Construction phase of the Monikie waterworks; not a database or designation date.' },
  'nrhe:219567': { text: '1847–1853', earliest: 1847, latest: 1853, precision: 'year_range', confidence: 'medium', url: urls.reservoirHistory, organisation: 'Monikie Local History', hidden: false, notes: 'Construction phase of the Monikie waterworks; not a database or designation date.' },
};

for (const feature of pkg.features.filter((item) => item.id.startsWith('hes-') || item.id.startsWith('nrhe:'))) {
  const date = dates[feature.id];
  feature.tags = [...new Set([...feature.tags, 'heritage-record-retained'])];
  if (!date) {
    feature.tags = [...new Set([...feature.tags, 'map-hidden'])];
    feature.reviewed = true;
    feature.reviewNotes = 'Record retained intact. No defensible construction or material-period date was found, so it remains hidden from the heat map rather than receiving a guessed date.';
    continue;
  }
  feature.dateBasis = date.earliest === date.latest ? 'documented_date' : 'documented_date_range';
  feature.dateConfidence = date.confidence;
  feature.datePrecision = date.precision;
  feature.documentedDateText = date.text;
  feature.earliestPossibleYear = date.earliest;
  feature.latestPossibleYear = date.latest;
  feature.reviewed = true;
  feature.reviewNotes = date.notes;
  feature.tags = [...new Set([...feature.tags, 'date-reviewed'])].filter((tag: string) => tag !== 'map-hidden');
  if (date.hidden) feature.tags.push('map-hidden');
  feature.sourceRecords.push(source(`${feature.name} material-date evidence`, date.organisation, date.url, date.notes, date.url.includes('her.aberdeenshire') ? 'official_non_statutory' : 'official_statutory'));
}

const attractions = [
  make({ id: 'curated-attraction:monikie-country-park', name: 'Monikie Country Park', score: 82, coordinates: [-2.8057096, 56.5333264], featureType: 'park', description: 'Reservoir country park with woodland and parkland, self-led trails, adventure play, watersports, accessible facilities and a café.', reason: 'A complete, operator-backed outdoor destination with year-round access, activities and practical facilities; it is published as a separate See destination and does not determine Craigton’s settlement score.', website: urls.park, sourceName: 'Monikie Country Park', sourceOrganisation: 'ANGUSalive', evidenceUrls: [urls.park, urls.parkOsm], sourceRecordIds: [undefined, 'way/560521879'], placeType: 'Attraction', category: 'attraction', tags: ['curated-visitor', 'home-standalone-place', 'current-context'], details: 'park_open=365 days; information_centre=09:00-16:30; admission=Free general park access; accessible_trails=yes; play_park=yes; watersports=yes; dog_friendly=close control, excluded from play park' }),
];
const trails = [
  make({ id: 'curated-trails:monikie-reservoir-circuit', name: 'Monikie Reservoir Circuit', score: 72, coordinates: [-2.8101, 56.5341], featureType: 'walking_route', description: 'A level two-mile circuit around the former reservoirs, with grassy paths, a surfaced bird-hide alternative, café and toilets at the start.', reason: 'A verified exact route with a working description, distance and start facilities; deep water, grass and blue-green-algae risk require care.', website: urls.circuit, sourceName: 'Monikie Country Park route', sourceOrganisation: 'Walkhighlands', evidenceUrls: [urls.circuit, urls.park], placeType: 'Trail', category: 'trail', tags: ['curated-visitor', 'visitor-context-trail', 'current-context'], details: 'distance=3.25 km/2 miles; duration=1 hour; ascent=7 m; terrain=grassy paths beside deep water; start=Monikie Country Park car park; route_link_checked=2026-08-30' }),
];
const foods = [
  make({ id: 'curated-eat:cafe-byzantium-monikie', name: 'Café Byzantium', score: 76, coordinates: [-2.8110346, 56.5340353], featureType: 'commercial_building', description: 'Independent park café and Mediterranean restaurant that explicitly welcomes coffee-only visits and serves casual light lunches.', reason: 'A current operator-backed coffee and light-lunch stop embedded in the country-park visit; limited Friday-to-Sunday opening prevents a higher score.', website: urls.cafe, sourceName: 'Café Byzantium', sourceOrganisation: 'Café Byzantium', evidenceUrls: [urls.cafe, urls.park, urls.cafeOsm], sourceRecordIds: [undefined, undefined, 'way/622083924'], placeType: 'Eat', category: 'food', tags: ['curated-visitor', 'service-context-food', 'visitor-context-food', 'current-context'], details: 'cuisine=coffee, cakes and light lunches; opening_hours:description=Friday-Saturday 12:00-21:00 and Sunday 12:00-20:00; price_band=££; description=Coffee beside the reservoirs: independent park cafe for hot drinks, cakes and casual light lunches' }),
];
const facilities = [
  make({ id: 'curated-parking:monikie-country-park', name: 'Monikie Country Park Car Park', coordinates: [-2.8121175, 56.5347668], featureType: 'parking', description: 'Dedicated country-park visitor car park; the current operator states that all parking is free.', website: urls.park, sourceName: 'Monikie Country Park parking', sourceOrganisation: 'ANGUSalive', evidenceUrls: [urls.park, urls.parkingOsm], sourceRecordIds: [undefined, 'way/622083912'], placeType: 'Parking', tags: ['service-context-parking', 'current-context'], details: 'access=public; fee=no; price_display=Free; payment_required=no; capacity=Not published; disabled_spaces=Available but count not published; coordinate_source=OpenStreetMap car-park polygon centroid' }),
  make({ id: 'curated-toilets:monikie-country-park', name: 'Monikie Country Park Toilets', coordinates: [-2.8113827, 56.5346068], featureType: 'toilet', description: 'Visitor toilets beside the country-park information centre, including accessible provision and baby changing.', website: urls.park, sourceName: 'Monikie Country Park toilets', sourceOrganisation: 'ANGUSalive', evidenceUrls: [urls.park, urls.toiletsOsm], sourceRecordIds: [undefined, 'way/622083910'], placeType: 'Public toilets', tags: ['service-context-toilets', 'current-context'], details: 'access=public during facility opening; accessible_toilet=yes; baby_changing=yes; opening=Information Centre hours 09:00-16:30; coordinate_source=OpenStreetMap toilet-building centroid' }),
  make({ id: 'curated-picnic:monikie-country-park', name: 'Monikie Country Park Picnic Site', coordinates: [-2.8108336, 56.5355012], featureType: 'park', description: 'Mapped picnic area in the country park, near the reservoir paths and main visitor facilities.', website: urls.park, sourceName: 'Monikie Country Park picnic site', sourceOrganisation: 'ANGUSalive / OpenStreetMap contributors', evidenceUrls: [urls.park, urls.picnicOsm], sourceRecordIds: [undefined, 'node/5876535204'], placeType: 'Picnic', tags: ['service-context-picnic', 'current-context'], details: 'picnic=yes; tables=Mapped picnic site; parking=Free at main car park; toilets=At information centre; coordinate_source=OpenStreetMap picnic-site node' }),
];
pkg.features = [...pkg.features.filter((feature) => !feature.id.startsWith('curated-')), ...attractions, ...trails, ...foods, ...facilities];

const highlights: VisitorHighlight[] = attractions.map((feature, index) => ({
  rank: index + 1, featureId: feature.id, name: feature.name, reason: feature.editorialReview!.scoreRationale, tagline: 'Reservoir park, trails and outdoor activities', visitorScore: 82,
  timeToSpend: '1.5–3 hours', openingTimes: 'Park open year-round; information centre 09:00–16:30', admission: 'Free general park access; activities may charge', freeAdmission: true,
  visitorWebsiteUrl: feature.visitorWebsiteUrl, editorialReview: feature.editorialReview, sourceName: feature.sourceRecords[0].sourceName, sourceUrl: feature.visitorWebsiteUrl!, verifiedInBoundaryAt: reviewedDate,
}));

pkg.project.preferredBasemap = 'voyager';
// Keep the settlement polygon strict for scoring and heritage. The separate visitor
// boundary admits the immediately adjoining country-park facilities without claiming
// that they form part of Craigton's independent town offer.
pkg.project.townStudyArea = pkg.project.townStudyArea ?? {};
pkg.project.townStudyArea.visitorBoundary = pkg.project.townStudyArea.bufferedBoundary;
pkg.project.touristAppeal = {
  score: 44, dogOwnerScore: 43, dogAccessScoreAdjustment: -1, rating: 0, label: 'Minor Interest',
  summary: 'A small rural village with modest independent character. Monikie Country Park is a worthwhile adjacent See destination with complete facilities, but it is assessed separately and does not lift Craigton above the town-map threshold.',
  dogAccessRating: 2, dogAccessSummary: 'The adjacent country park welcomes dogs under close control except in the play park; deep water, wildlife and seasonal algae warnings require care.',
  methodVersion: '2026-08-30-strict-settlement-full-audit-v3', reviewedAt: reviewedDate, sourceUrls: Object.values(urls),
};
pkg.project.visitorHighlights = highlights;
pkg.project.townGuide = {
  characterTag: 'Small Angus village beside a reservoir park', headline: 'A quiet village with a separately assessed country-park visit',
  intro: 'Craigton of Monikie remains selector-only at 44%. Monikie Country Park appears in See with its own trail, café, picnic, free parking and accessible toilets, without transferring that destination value into the village score.',
  bestFor: ['Using as a reference point for Monikie Country Park', 'Reservoir and estate history'], perfectFor: ['Combining a brief village pass-through with the separate country-park circuit'],
  dontMiss: ['Monikie Country Park', 'Monikie Reservoir Circuit'], suggestedTime: 'No dedicated village visit; 1.5–3 hours for the adjacent country park',
  visitorMood: 'A modest rural settlement beside a genuinely useful outdoor destination, with the two assessments deliberately kept separate.', sourceUrls: Object.values(urls), lastReviewedAt: reviewedDate,
};
pkg.project.researchNotes = 'Full strict-boundary audit completed from local HES Listed Buildings and NRHE datasets. All nine imported records remain intact. Four in-scope dated records are visible on the heat layer; the undated Craigton lamp findspot and four Kirkton/Panmure buffer records remain map-hidden. The park, route, café and practical facilities are published as related visitor context and do not alter the settlement score.';

planner.projects[projectId] = {
  eat: foods.map((feature) => feature.id), trails: trails.map((feature) => feature.id), picnic: facilities.filter((feature) => feature.id.startsWith('curated-picnic:')).map((feature) => feature.id),
  parking: facilities.filter((feature) => feature.id.startsWith('curated-parking:')).map((feature) => feature.id), toilets: facilities.filter((feature) => feature.id.startsWith('curated-toilets:')).map((feature) => feature.id),
};
const dogRecord = (rating: number, status: string, label: string, summary: string, sourceUrl: string) => ({ rating, status, label, summary, sourceName: 'Craigton of Monikie dog-access audit', sourceUrl, reviewedAt: reviewedDate });
dog.reviewedAt = reviewedDate;
dog.projects[projectId] = {
  attraction: { [attractions[0].id]: dogRecord(3, 'welcoming', 'Dogs welcome under close control', 'Dogs are welcomed year-round except in the children’s play park; use close control around wildlife, water and other visitors.', urls.park) },
  trail: { [trails[0].id]: dogRecord(2, 'restricted', 'Close control beside reservoirs', 'Keep dogs under close control beside deep water and wildlife and follow any current blue-green-algae warning.', urls.park) },
  eat: { [foods[0].id]: dogRecord(1, 'unconfirmed', 'Indoor dog policy not published', 'No reliable current dog policy was found for indoor seating; confirm directly before relying on it.', urls.cafe) },
};

pkg.validation = validateFeatures(pkg.project, pkg.features);
const errors = pkg.validation.filter((entry: any) => entry.severity === 'error');
if (errors.length) throw new Error(errors.map((entry: any) => entry.message).join('; '));
const heritage = pkg.features.filter((feature) => feature.id.startsWith('hes-') || feature.id.startsWith('nrhe:'));
const visible = heritage.filter((feature) => !feature.tags.includes('map-hidden'));
const invalid = visible.filter((feature) => !feature.documentedDateText?.trim() || feature.earliestPossibleYear == null || feature.latestPossibleYear == null || feature.dateBasis === 'unknown' || feature.name.includes(feature.documentedDateText));
if (heritage.length !== 9 || visible.length !== 4 || invalid.length) throw new Error(`Heritage publication failure: records=${heritage.length}, visible=${visible.length}, invalid=${invalid.map((feature) => feature.id).join(',')}`);

const report = {
  reviewedAt, projectId, status: 'verified', settlementScore: 44, previousScore: 44, independentlyWorthwhile: false, publishOnTownMap: false,
  scoreRationale: pkg.project.touristAppeal.summary, publication: { see: attractions.length, eat: foods.length, trails: trails.length, picnic: 1, parking: 1, toilets: 1 },
  heritage: { localHesListedBuildings: 5, localNrheRecords: 4, totalRecordsRetained: 9, visibleDatedHeritagePins: 4, visibleUndatedHeritagePins: 0, mapHiddenRecords: 5, contextRecordsHidden: 4, undatedRecordsHidden: 1, dateRule: 'Construction or material-period dates only; never designation, database, assessment or publication dates.' },
  namedTrailSearch: { TreasureTrails: 'No Craigton or Monikie product appears in the current Dundee and Angus collection.', CuriousAbout: 'No exact Craigton or Monikie product found.', MysteryGuides: 'No exact Craigton or Monikie product found.', GoQuestAdventures: 'No exact Craigton or Monikie product found.', AngusCouncil: 'Core paths 182 and 183 cover Craigton and Monikie Country Park.', retained: [trails[0].id] },
  practicalAudit: { see: 'Monikie Country Park is retained as a separate related-context attraction; Panmure Testimonial remains a dated heritage pin because no authoritative current visitor access contract was found.', eat: 'Café Byzantium qualifies for coffee and light lunch. Victoria Sponge belongs to Monikie village and is not duplicated here; the Craigton Coach Inn is not included because current café-led evidence was not established.', picnic: 'One exact mapped country-park picnic site is retained.', parking: 'One exact dedicated park car park; current operator states all parking is free. Capacity and disabled-bay count are not invented.', toilets: 'One exact toilet building with operator-confirmed accessible and baby-changing provision.', accessibility: 'The operator states parking, toilets, café, trails and information centre are accessible.', transport: 'Park bus service is limited; check current timetable before travel.' },
  exclusions: ['Victoria Sponge, assigned to Monikie village', 'Craigton Coach Inn without current café-led evidence', 'Kirkton of Monikie church group as Craigton heat pins', 'Panmure Testimonial as a visitor attraction without authoritative access information'],
  verification: { localListedBuildingImport: { added: 5, refreshed: 0, bufferCandidates: 4 }, localNrheImport: { added: 4, linked: 1, excludedCandidates: 0 }, allHeritageRecordsIntact: true, allVisibleHeritagePinsDated: true, datesStoredWithoutChangingMapNames: true, trailLinksChecked: [urls.circuit, urls.paths, urls.treasure, urls.curious, urls.mystery, urls.goQuest], practicalCoordinatesChecked: true },
};
const existingRow = correction.results.find((row: any) => row.projectId === projectId);
const row = { projectId, name: 'Craigton of Monikie', region: 'Angus', previousScore: 44, correctedScore: 44, changed: false, publishOnTownMap: false, rationale: pkg.project.touristAppeal.summary, sourceUrls: [urls.place, urls.park, urls.circuit, urls.testimonialNrhe] };
if (existingRow) Object.assign(existingRow, row); else correction.results.push(row);
correction.affectedProjects = correction.results.length;
correction.changedScores = correction.results.filter((item: any) => item.changed).length;
correction.mappedAfterCorrection = correction.results.filter((item: any) => item.correctedScore >= 60).map((item: any) => ({ projectId: item.projectId, name: item.name, score: item.correctedScore }));

await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`);
await writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`);
await writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`);
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
await writeFile(correctionPath, `${JSON.stringify(correction, null, 2)}\n`);
console.log(JSON.stringify({ status: report.status, score: report.settlementScore, publication: report.publication, heritage: report.heritage }, null, 2));
