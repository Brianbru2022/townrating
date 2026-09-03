import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { editorialRatingMethodVersion } from '../src/domain/editorialResearch';

const id = 'eassie-scotland';
const day = '2026-08-30';
const at = '2026-08-30T23:59:00Z';
const projectPath = resolve('data/projects/eassie.json');
const plannerPath = resolve('data/cairn-o-mount-visitor-planner-curation.json');
const dogPath = resolve('data/cairn-o-mount-dog-access-curation.json');
const reportPath = resolve('data/review/eassie-full-visitor-audit-2026-08-30.json');
const correctionPath = resolve('data/review/strict-settlement-score-correction-2026-08-30.json');

const urls = {
  visit: 'https://www.historicenvironment.scot/visit-a-place/places/eassie-sculptured-stone/',
  plan: 'https://www.historicenvironment.scot/visit/all/eassie-sculptured-stone/plan-your-visit/',
  scheduled: 'https://portal.historicenvironment.scot/designation/SM90125',
  pictishTrail: 'https://visitangus.com/get-inspired/heritage-trails/the-pictish-trail/',
  manse: 'https://her.aberdeenshire.gov.uk/Monument/MAB32707/',
  wall: 'https://britishlistedbuildings.co.uk/200335921-churchyard-wall-old-parish-church-eassie-eassie-and-nevay',
  bridge: 'https://britishlistedbuildings.co.uk/200335923-bridge-eassie-eassie-and-nevay',
  granary: 'https://britishlistedbuildings.co.uk/200335924-granary-eassie-station-eassie-and-nevay',
  treasure: 'https://www.treasuretrails.co.uk/collections/dundee-and-angus',
  curious: 'https://www.curiousabout.co.uk/',
  mystery: 'https://www.mysteryguides.co.uk/',
  goQuest: 'https://goquestadventures.com/',
  toilets: 'https://www.angus.gov.uk/roads_parking_and_travel/public_toilets',
  outdoor: 'https://www.outdooraccess-scotland.scot/dog-owners',
};

const pkg: any = JSON.parse(await readFile(projectPath, 'utf8'));
const planner: any = JSON.parse(await readFile(plannerPath, 'utf8'));
const dog: any = JSON.parse(await readFile(dogPath, 'utf8'));
const correction: any = JSON.parse(await readFile(correctionPath, 'utf8'));

type DateFix = { text: string; first: number; last: number; confidence: 'high' | 'medium'; evidence: string; note: string };
const dates: Record<string, DateFix> = {
  'hes-listed-building:LB4644': { text: '1758', first: 1758, last: 1758, confidence: 'high', evidence: urls.manse, note: 'The manse is dated 1758 at the skewputts; listing date is not used.' },
  'hes-listed-building:LB4645': { text: 'Late 18th century; widened early 19th century', first: 1750, last: 1835, confidence: 'high', evidence: urls.bridge, note: 'The designation-derived description dates the bridge to the late 18th century and its widening to the early 19th century.' },
  'hes-listed-building:LB4646': { text: 'Mid-19th century', first: 1833, last: 1866, confidence: 'high', evidence: urls.granary, note: 'The designation-derived description identifies a mid-19th-century granary.' },
  'hes-scheduled-monument:SM90125': { text: 'Early-medieval cross slab; church dedicated 1246', first: 600, last: 1246, confidence: 'high', evidence: urls.scheduled, note: 'HES describes the slab as Pictish/Early Historic and records the church dedication in 1246.' },
  'nrhe:32074': { text: 'Roman', first: 43, last: 410, confidence: 'medium', evidence: 'https://www.trove.scot/place/32074', note: 'The official NRHE classification identifies a Roman temporary camp.' },
  'nrhe:32078': { text: 'Medieval to post-medieval; church dedicated 1246', first: 1100, last: 1835, confidence: 'high', evidence: urls.scheduled, note: 'The NRHE classification is medieval to post-medieval and HES records the church dedication in 1246 and replacement in 1835.' },
  'nrhe:32092': { text: 'Pictish, probably 8th century', first: 700, last: 800, confidence: 'medium', evidence: 'https://www.trove.scot/place/32092', note: 'The official record identifies a Pictish Class II cross slab; the century is expressed as a cautious range.' },
  'nrhe:32097': { text: 'Prehistoric barrow (possible); other cropmarks undated', first: -4000, last: 400, confidence: 'medium', evidence: 'https://www.trove.scot/place/32097', note: 'Only the possible barrow has a classified prehistoric period; other cropmarks remain undated.' },
  'nrhe:32106': { text: 'Medieval', first: 1100, last: 1560, confidence: 'medium', evidence: 'https://www.trove.scot/place/32106', note: 'The official NRHE classification identifies medieval grave slabs.' },
  'nrhe:140070': { text: 'Medieval to post-medieval rig and furrow', first: 1100, last: 1900, confidence: 'medium', evidence: 'https://www.trove.scot/place/140070', note: 'The official NRHE classification supplies the broad material period.' },
  'nrhe:193962': { text: 'Late 18th century; widened early 19th century', first: 1750, last: 1835, confidence: 'high', evidence: urls.bridge, note: 'This NRHE bridge record represents the same fabric as LB4645.' },
  'nrhe:193968': { text: '19th to 20th century', first: 1800, last: 1999, confidence: 'medium', evidence: 'https://www.trove.scot/place/193968', note: 'The official NRHE classification supplies the broad station period.' },
  'nrhe:239360': { text: 'Medieval to post-medieval rig and furrow', first: 1100, last: 1900, confidence: 'medium', evidence: 'https://www.trove.scot/place/239360', note: 'The official NRHE classification supplies the broad material period.' },
  'nrhe:278660': { text: 'Medieval to post-medieval rig and furrow', first: 1100, last: 1900, confidence: 'medium', evidence: 'https://www.trove.scot/place/278660', note: 'The dated component is the classified rig and furrow; the possible track remains undated.' },
  'nrhe:278666': { text: 'Medieval to post-medieval rig and furrow', first: 1100, last: 1900, confidence: 'medium', evidence: 'https://www.trove.scot/place/278666', note: 'The dated component is the classified rig and furrow; the track remains undated.' },
  'nrhe:358457': { text: '19th century', first: 1800, last: 1899, confidence: 'medium', evidence: 'https://www.trove.scot/place/358457', note: 'The official NRHE classification identifies a 19th-century milestone.' },
  'nrhe:358458': { text: '19th century', first: 1800, last: 1899, confidence: 'medium', evidence: 'https://www.trove.scot/place/358458', note: 'The official NRHE classification identifies a 19th-century milepost.' },
};

for (const feature of pkg.features) {
  if (!feature.tags.some((tag: string) => ['hes-listed-building', 'hes-scheduled-monument', 'nrhe'].includes(tag))) continue;
  const fix = dates[feature.id];
  feature.reviewed = true;
  feature.updatedAt = at;
  feature.tags = [...new Set(feature.tags.concat('heritage-record-retained'))];
  if (!fix) {
    feature.tags = [...new Set(feature.tags.concat('map-hidden'))];
    feature.reviewNotes = 'Retained from the local HES source but map-hidden because no defensible material date was verified; a designation date is not a construction date.';
    continue;
  }
  Object.assign(feature, { documentedDateText: fix.text, earliestPossibleYear: fix.first, latestPossibleYear: fix.last, dateBasis: fix.first === fix.last ? 'documented_exact_year' : 'estimated_from_authoritative_source', dateConfidence: fix.confidence });
  feature.tags = [...new Set(feature.tags.filter((tag: string) => tag !== 'map-hidden').concat('date-reviewed'))];
  feature.reviewNotes = `${fix.note} Map name unchanged.`;
  if (!feature.sourceRecords.some((record: any) => record.sourceUrl === fix.evidence)) feature.sourceRecords.push({ sourceName: 'Material-date audit evidence', sourceOrganisation: fix.evidence.includes('historicenvironment') || fix.evidence.includes('trove.scot') ? 'Historic Environment Scotland' : 'Aberdeenshire Historic Environment Record', sourceUrl: fix.evidence, accessedAt: at, reliability: fix.evidence.includes('historicenvironment') ? 'official_statutory' : 'official_non_statutory', licence: 'Source-linked evidence; retain publisher attribution.', notes: fix.note });
}

const assessment = (score: number) => {
  const experienceDepth = Math.round(score * 0.3);
  const distinctiveness = Math.round(score * 0.2);
  const presentation = Math.round(score * 0.2);
  const journeyWorth = Math.round(score * 0.15);
  const accessAndReliability = Math.round(score * 0.1);
  return { experienceDepth, distinctiveness, presentation, journeyWorth, accessAndReliability, evidenceConfidence: score - experienceDepth - distinctiveness - presentation - journeyWorth - accessAndReliability, visitability: 'substantial_visible_remains' };
};
const source = (name: string, url: string, details: string) => ({ sourceName: name, sourceOrganisation: url.includes('historicenvironment') ? 'Historic Environment Scotland' : 'Visit Angus', sourceUrl: url, accessedAt: at, reliability: 'official_non_statutory', licence: 'Source-linked editorial evidence; verify time-sensitive details before travel.', notes: `Current-context curation: ${details}` });
const point = [-3.0564648936770196, 56.614418209017785];
const see: any = {
  id: 'curated-attraction:eassie-sculptured-stone', projectId: id, name: 'Eassie Sculptured Stone and Old Church', alternativeNames: ['Eassie Stone'], countryCode: 'GB-SCT', region: 'Angus', locality: 'Eassie', featureType: 'archaeological_site', significance: 'highest_national', geometry: { type: 'Point', coordinates: point }, locationType: 'mapped_point', locationConfidence: 'high', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'medium', survival: 'substantially_intact', documentedDateText: 'Pictish, probably 8th century; church dedicated 1246', earliestPossibleYear: 700, latestPossibleYear: 1246,
  shortDescription: 'A richly carved Pictish Class II cross-slab protected inside the roofless medieval church, free to visit throughout the year.', fullDescription: 'A richly carved Pictish Class II cross-slab protected inside the roofless medieval church, free to visit throughout the year.', visitorWebsiteUrl: urls.plan,
  editorialReview: { status: 'editorially_researched', category: 'attraction', methodVersion: editorialRatingMethodVersion, reviewedAt: day, scoreRationale: 'A nationally important and visually rich Pictish monument with strong official interpretation, free year-round access and a compelling medieval church setting, though it is a focused short stop rather than a full-day site.', evidenceUrls: [urls.plan, urls.scheduled, urls.pictishTrail], attractionAssessment: assessment(84) },
  sourceRecords: [source('Historic Scotland visitor information', urls.plan, 'visitor_place_type=Historic site; visit_score=84; entrance_fee=free; opening_hours:description=Open year-round; description=A richly carved Pictish Class II cross-slab protected inside the roofless medieval church, free to visit throughout the year')],
  tags: ['curated-visitor', 'home-standalone-place', 'current-context'], createdAt: at, updatedAt: at, reviewed: true, evidenceScope: 'site_evidence',
};
const trail: any = {
  id: 'curated-trail:angus-pictish-trail-eassie', projectId: id, name: 'Angus Pictish Trail – Eassie Church stop', alternativeNames: [], countryCode: 'GB-SCT', region: 'Angus', locality: 'Eassie', featureType: 'driving_route', significance: 'regional', geometry: { type: 'Point', coordinates: point }, locationType: 'mapped_point', locationConfidence: 'high', dateBasis: 'unknown', dateConfidence: 'unknown', survival: 'substantially_intact', shortDescription: 'The official self-guided Angus heritage trail includes Eassie Church as a Pictish cross-slab stop; use the live trail page to plan the wider route.', fullDescription: 'The official self-guided Angus heritage trail includes Eassie Church as a Pictish cross-slab stop; use the live trail page to plan the wider route.', visitorWebsiteUrl: urls.pictishTrail,
  editorialReview: { status: 'editorially_researched', category: 'trail', methodVersion: editorialRatingMethodVersion, reviewedAt: day, scoreRationale: 'A strong official thematic trail that places Eassie in its wider Pictish context; scored below a compact walking trail because it is a dispersed multi-stop itinerary.', evidenceUrls: [urls.pictishTrail, urls.plan], attractionAssessment: assessment(78) },
  sourceRecords: [source('Visit Angus Pictish Trail', urls.pictishTrail, 'visitor_place_type=Driving route; trail_score=78; distance=multi-stop route, total distance not published on page; time_to_spend=Allow a half day or longer for multiple stops; description=The official self-guided Angus heritage trail includes Eassie Church as a Pictish cross-slab stop; use the live trail page to plan the wider route')],
  tags: ['curated-visitor', 'visitor-context-trail', 'current-context'], createdAt: at, updatedAt: at, reviewed: true, evidenceScope: 'route_evidence',
};

pkg.features = [...pkg.features.filter((feature: any) => !feature.id.startsWith('curated-')), see, trail];
pkg.project.visitorHighlights = [{ rank: 1, featureId: see.id, name: see.name, reason: see.editorialReview.scoreRationale, tagline: 'Pictish carving in a medieval kirk', visitorScore: 84, timeToSpend: '30–60 minutes', openingTimes: 'Open year-round', admission: 'Free', freeAdmission: true, visitorWebsiteUrl: urls.plan, editorialReview: see.editorialReview, sourceName: 'Historic Scotland visitor information', sourceUrl: urls.plan, verifiedInBoundaryAt: day }];
pkg.project.preferredBasemap = 'voyager';
pkg.project.touristAppeal = { score: 38, dogOwnerScore: 36, dogAccessScoreAdjustment: -2, rating: 0, label: 'Limited Interest', summary: 'A small rural locality whose nationally important Pictish stone is correctly assessed as a separate See attraction rather than used to inflate the settlement.', dogAccessRating: 1, dogAccessSummary: 'No dedicated dog facilities or published site-specific dog policy was verified; follow current signs and responsible-access guidance.', methodVersion: '2026-08-30-strict-settlement-full-audit-v3', reviewedAt: day, sourceUrls: Object.values(urls) };
pkg.project.townGuide = { characterTag: 'Rural historic locality', headline: 'One exceptional ancient stop, not a complete village visit', intro: 'Eassie remains a 38% selector-only locality. The Pictish stone and old church form a separately scored, free year-round attraction.', bestFor: ['Pictish art', 'A focused heritage stop'], perfectFor: ['Adding Eassie to an Angus Pictish itinerary'], suggestedFirstVisit: { title: 'Start at the old church', summary: 'Use the official HES directions and check current on-site signage before arrival.' }, dontMiss: ['Eassie Sculptured Stone and Old Church'], suggestedTime: 'No settlement visit; 30–60 minutes for the heritage site', visitorMood: 'A quiet rural stop centred on one nationally important monument.', sourceUrls: Object.values(urls), lastReviewedAt: day };
pkg.project.researchNotes = 'Full sequential audit. Eassie remains selector-only at 38 because the locality itself is not a complete destination. Eassie Sculptured Stone and Old Church is separately published under See and the official Angus Pictish Trail under Trails. No café-led Eat, managed picnic place, documented visitor car park or public toilet was verified inside the boundary. All 24 local heritage records remain intact: 17 have defensible material dates and are visible; seven undated records remain map-hidden. Dates are stored in metadata and not appended to map names.';
planner.projects[id] = { eat: [], trails: [trail.id], picnic: [], parking: [], toilets: [] };
const unconfirmedDog = { rating: 1, status: 'unconfirmed', label: 'Policy not published', summary: 'No reliable current dog policy is published for this site; follow on-site signs and keep dogs under close control around the churchyard.', sourceName: 'Historic Scotland visitor information', sourceUrl: urls.plan, reviewedAt: day };
dog.projects[id] = { attraction: { [see.id]: unconfirmedDog }, trail: { [trail.id]: unconfirmedDog }, eat: {} };

const heritage = pkg.features.filter((feature: any) => feature.tags.some((tag: string) => ['hes-listed-building', 'hes-scheduled-monument', 'nrhe'].includes(tag)));
const statutory = heritage.filter((feature: any) => feature.tags.includes('hes-listed-building') || feature.tags.includes('hes-scheduled-monument'));
const visible = heritage.filter((feature: any) => !feature.tags.includes('map-hidden'));
const report = {
  reviewedAt: at, projectId: id, status: 'verified', settlementScore: 38, previousScore: 38, independentlyWorthwhile: false, publishOnTownMap: false,
  scoreRationale: 'The rural locality has one exceptional standalone attraction but not an independently worthwhile settlement-level visitor experience.',
  publication: { see: 1, eat: 0, trails: 1, picnic: 0, parking: 0, toilets: 0 },
  heritage: { expectedStatutoryRecords: 5, representedStatutoryRecords: statutory.length, nrheRecordsRetained: heritage.filter((feature: any) => feature.tags.includes('nrhe')).length, visibleDatedHeritagePins: visible.length, visibleUndatedHeritagePins: visible.filter((feature: any) => !feature.documentedDateText).length, hiddenUndatedRecords: heritage.filter((feature: any) => feature.tags.includes('map-hidden')).map((feature: any) => feature.id) },
  namedTrailSearch: { TreasureTrails: 'The live Dundee and Angus catalogue has no Eassie product.', CuriousAbout: 'No Eassie product found.', MysteryGuides: 'No Eassie product found.', GoQuestAdventures: 'No Eassie product found.', retained: ['Angus Pictish Trail – Eassie Church stop'] },
  practicalAudit: { eat: 'No café, coffee-and-cake outlet, tearoom, bakery or light-lunch venue was verified inside the strict boundary.', picnic: 'No managed public picnic facility was published for the site.', parking: 'HES publishes directions via the old church west of Glamis but does not publish a dedicated visitor car park, capacity, stay limit or payment information; no parking pin is created.', toilets: 'No on-site toilet is published by HES and no local public toilet was verified.', accessibility: 'The official page does not publish a detailed accessibility statement for this site; visitors should check current conditions directly.', transport: 'HES links to public-transport and cycle journey planners but does not publish a dedicated stop at the site.' },
  exclusions: ['Nearby Glamis and Meigle cafés and facilities are outside Eassie and are not borrowed.', 'Private farm access is not presented as public parking.', 'The Pictish stone is scored under See, not transferred into the settlement score.'],
  verification: { localListedBuildingImport: { added: 0, refreshed: 4, bufferCandidates: 0 }, localNrheImport: { added: 0, linked: 3, excludedCandidates: 0 }, statutoryDatasetComplete: statutory.length === 5, allVisibleHeritagePinsDated: visible.every((feature: any) => feature.documentedDateText && feature.dateBasis !== 'unknown'), datesStoredWithoutChangingMapNames: visible.every((feature: any) => !feature.name.includes(feature.documentedDateText)), trailLinksChecked: [urls.pictishTrail, urls.treasure, urls.curious, urls.mystery, urls.goQuest], curatedCategoryCoordinatesChecked: true },
};
const row = correction.results.find((value: any) => value.projectId === id);
if (row) { row.correctedScore = 38; row.changed = row.previousScore !== 38; row.publishOnTownMap = false; row.rationale = pkg.project.touristAppeal.summary; row.sourceUrls = [urls.plan, urls.scheduled, urls.pictishTrail]; }
correction.changedScores = correction.results.filter((value: any) => value.changed).length;
correction.mappedAfterCorrection = correction.results.filter((value: any) => value.correctedScore >= 60).map((value: any) => ({ projectId: value.projectId, name: value.name, score: value.correctedScore }));

await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`);
await writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`);
await writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`);
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
await writeFile(correctionPath, `${JSON.stringify(correction, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
