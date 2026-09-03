import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const projectId = 'drunkendub-scotland';
const reviewedDate = '2026-08-30';
const reviewedAt = '2026-08-30T23:59:00Z';
const projectPath = resolve('data/projects/drunkendub.json');
const plannerPath = resolve('data/cairn-o-mount-visitor-planner-curation.json');
const dogPath = resolve('data/cairn-o-mount-dog-access-curation.json');
const reportPath = resolve('data/review/drunkendub-full-visitor-audit-2026-08-30.json');

const urls = {
  place: 'https://www.openstreetmap.org/node/4134265055',
  hes: 'https://portal.historicenvironment.scot/',
  westLodge: 'https://portal.historicenvironment.scot/designation/LB4766',
  newtonHouse: 'https://portal.historicenvironment.scot/designation/LB4767',
  workshop: 'https://portal.historicenvironment.scot/designation/LB4768',
  cairnton: 'https://portal.historicenvironment.scot/designation/LB4769',
  treasure: 'https://www.treasuretrails.co.uk/collections/dundee-and-angus',
  curious: 'https://www.curiousabout.co.uk/',
  mystery: 'https://www.mysteryguides.co.uk/',
  goQuest: 'https://goquestadventures.com/',
  visitAngusTrails: 'https://visitangus.com/things-to-see-do/trails/',
  outdoorAccess: 'https://www.outdooraccess-scotland.scot/dog-owners',
};

const pkg: any = JSON.parse(await readFile(projectPath, 'utf8'));
const planner: any = JSON.parse(await readFile(plannerPath, 'utf8'));
const dog: any = JSON.parse(await readFile(dogPath, 'utf8'));

const dates: Record<string, { text: string; start: number; end: number; confidence: string }> = {
  'hes-listed-building:LB4766': { text: 'Early 19th century', start: 1800, end: 1839, confidence: 'high' },
  'hes-listed-building:LB4767': { text: 'Early 19th century', start: 1800, end: 1839, confidence: 'high' },
  'hes-listed-building:LB4768': { text: '1842', start: 1842, end: 1842, confidence: 'high' },
  'hes-listed-building:LB4769': { text: '1704', start: 1704, end: 1704, confidence: 'high' },
};

for (const feature of pkg.features) {
  const date = dates[feature.id];
  if (!date) continue;
  feature.documentedDateText = date.text;
  feature.earliestPossibleYear = date.start;
  feature.latestPossibleYear = date.end;
  feature.dateBasis = 'documentary';
  feature.dateConfidence = date.confidence;
  feature.survival = 'extant';
  feature.reviewed = true;
  feature.updatedAt = reviewedAt;
  feature.reviewNotes = feature.id === 'hes-listed-building:LB4768'
    ? 'Inside the strict Drunkendub locality and dated 1842 by the designation description; retained as the sole visible local heritage pin.'
    : 'Dated from the designation description but retained map-hidden because the record lies in the surrounding 500 m context rather than the strict Drunkendub locality.';
  feature.sourceRecords = feature.sourceRecords.filter((record: any) => record.accessedAt !== reviewedAt);
  feature.sourceRecords.push({
    sourceName: 'Historic Environment Scotland designation record',
    sourceOrganisation: 'Historic Environment Scotland',
    sourceRecordId: feature.id.split(':')[1],
    sourceUrl: urls[feature.id === 'hes-listed-building:LB4766' ? 'westLodge' : feature.id === 'hes-listed-building:LB4767' ? 'newtonHouse' : feature.id === 'hes-listed-building:LB4768' ? 'workshop' : 'cairnton'],
    accessedAt: reviewedAt,
    licence: 'Open Government Licence v3.0; retain Historic Environment Scotland attribution.',
    notes: `Designation description supplies the material date: ${date.text}.`,
    reliability: 'official_statutory',
  });
  if (feature.id === 'hes-listed-building:LB4768') {
    feature.tags = [...new Set(feature.tags.filter((tag: string) => tag !== 'map-hidden').concat('strict-locality-heritage'))];
    feature.evidenceScope = 'inside_locality';
  } else {
    feature.tags = [...new Set(feature.tags.concat('map-hidden', 'related-context-only'))];
    feature.evidenceScope = 'related_context';
  }
}

pkg.project.visitorHighlights = [];
pkg.project.preferredBasemap = 'voyager';
pkg.project.touristAppeal = {
  score: 20,
  dogOwnerScore: 18,
  dogAccessScoreAdjustment: -2,
  rating: 0,
  label: 'Minor Interest',
  summary: 'A very small rural locality with one dated workshop heritage record but no independently worthwhile visitor experience or practical visitor cluster.',
  dogAccessRating: 1,
  dogAccessSummary: 'There is no dedicated dog destination or visitor infrastructure; use public roads with normal rural-road care.',
  methodVersion: '2026-08-30-strict-settlement-full-audit-v3',
  reviewedAt: reviewedDate,
  sourceUrls: Object.values(urls),
};
pkg.project.townGuide = {
  characterTag: 'Tiny rural Angus locality',
  headline: 'A named locality rather than a developed visitor stop',
  intro: 'Drunkendub remains at 20% after a complete settlement, practical and heritage audit. Its 1842 wheelwright workshop is valid local heritage, but a single private historic building does not make the locality independently worth visiting.',
  bestFor: ['Regional reference'],
  perfectFor: ['Identifying the locality while planning a wider Angus journey'],
  suggestedFirstVisit: { title: 'Treat it as a pass-through', summary: 'There is no verified visitor facility or formal stopping place; view only from public roads and respect private property.' },
  dontMiss: [],
  suggestedTime: 'Pass-through only',
  visitorMood: 'A sparse rural locality with a small amount of private historic fabric.',
  sourceUrls: Object.values(urls),
  lastReviewedAt: reviewedDate,
};
pkg.project.researchNotes = 'Full strict-boundary audit. The local HES set contains four listed records: the 1842 wheelwright workshop lies inside Drunkendub and is visible; Newton House, its early-19th-century lodge and the 1704-dated Cairnton farmhouse lie only in the surrounding context and remain stored but map-hidden. All four now carry material dates without changing map names. No attraction reached the 60-point publication threshold. No qualifying cafe-led food stop, named local trail, managed picnic area, dedicated visitor parking or public toilet was verified. Treasure Trails lists only Dundee, Forfar and Montrose in its current Dundee and Angus collection, with no Drunkendub product.';

planner.projects[projectId] = { eat: [], trails: [], picnic: [], parking: [], toilets: [] };
dog.projects[projectId] = {};

const heritage = pkg.features.filter((feature: any) => feature.tags.includes('hes-listed-building') || feature.tags.includes('hes-scheduled-monument') || feature.tags.includes('nrhe'));
const visible = heritage.filter((feature: any) => !feature.tags.includes('map-hidden'));
const report = {
  reviewedAt,
  projectId,
  status: 'verified',
  settlementScore: 20,
  previousScore: 20,
  independentlyWorthwhile: false,
  publishOnTownMap: false,
  scoreRationale: 'One private 1842 workshop gives local heritage interest, but there is no visitor-scale experience or supporting infrastructure.',
  publication: { see: 0, eat: 0, trails: 0, picnic: 0, parking: 0, toilets: 0 },
  heritage: {
    expectedStatutoryRecords: 4,
    representedStatutoryRecords: heritage.filter((feature: any) => feature.tags.includes('hes-listed-building')).length,
    nrheRecordsRetained: heritage.filter((feature: any) => feature.tags.includes('nrhe') || feature.tags.includes('nrhe-linked')).length,
    visibleDatedHeritagePins: visible.filter((feature: any) => feature.documentedDateText?.trim()).length,
    visibleUndatedHeritagePins: visible.filter((feature: any) => !feature.documentedDateText?.trim()).length,
    datedRelatedContextRecords: heritage.filter((feature: any) => feature.tags.includes('map-hidden') && feature.documentedDateText?.trim()).map((feature: any) => feature.id),
  },
  namedTrailSearch: {
    TreasureTrails: 'No Drunkendub product; the current Dundee and Angus collection lists Dundee, Forfar and Montrose.',
    CuriousAbout: 'No exact Drunkendub product found.',
    MysteryGuides: 'No exact Drunkendub product found.',
    GoQuestAdventures: 'No exact Drunkendub product found.',
    VisitAngus: 'No current named Drunkendub walking or cycling trail found.',
    retained: [],
  },
  practicalAudit: {
    see: 'The private 1842 wheelwright workshop remains a heritage pin, not a 60+ attraction card.',
    eat: 'No qualifying cafe, coffee-and-cake stop, tearoom or light-lunch venue verified.',
    picnic: 'No managed or expressly promoted public picnic facility verified.',
    parking: 'No dedicated public visitor car park verified; private drives and roadside margins are not published as parking.',
    toilets: 'No public toilet verified.',
    accessibility: 'No managed visitor site or documented step-free viewing provision exists.',
    transport: 'Rural-road locality with no promoted visitor transport hub.',
  },
  exclusions: [
    'The wheelwright workshop is private heritage rather than an independently visitable attraction.',
    'Newton House, West Lodge and Cairnton are related context outside the strict locality and remain map-hidden.',
    'Nearby facilities in Arbroath or other settlements are not assigned to Drunkendub.',
  ],
  verification: {
    statutoryDatasetComplete: heritage.filter((feature: any) => feature.tags.includes('hes-listed-building')).length === 4,
    allVisibleHeritagePinsDated: visible.every((feature: any) => feature.documentedDateText?.trim() && feature.dateBasis !== 'unknown'),
    datesStoredWithoutChangingMapNames: heritage.every((feature: any) => !feature.documentedDateText || !feature.name.includes(feature.documentedDateText)),
    trailLinksChecked: [urls.treasure, urls.curious, urls.mystery, urls.goQuest, urls.visitAngusTrails],
    curatedCategoryCoordinatesChecked: true,
  },
};

await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`);
await writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`);
await writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`);
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
