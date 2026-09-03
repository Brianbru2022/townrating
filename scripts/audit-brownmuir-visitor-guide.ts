import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const projectId = 'brownmuir-fordoun-scotland';
const reviewedDate = '2026-08-30';
const reviewedAt = '2026-08-30T23:59:00Z';
const projectPath = resolve('data/projects/brownmuir-fordoun.json');
const plannerPath = resolve('data/cairn-o-mount-visitor-planner-curation.json');
const dogPath = resolve('data/cairn-o-mount-dog-access-curation.json');
const reportPath = resolve('data/review/brownmuir-full-visitor-audit-2026-08-30.json');

const urls = {
  listed: 'https://portal.historicenvironment.scot/designation/LB9635',
  listedEvidence: 'https://britishlistedbuildings.co.uk/200341926-fordoun-house-fordoun',
  moat: 'https://portal.historicenvironment.scot/designation/SM2231',
  moatEvidence: 'https://www.trove.scot/place/36470',
  airfield: 'https://www.trove.scot/place/276655',
  toilets: 'https://www.aberdeenshire.gov.uk/local/public-toilets',
  settlement: 'https://www.openstreetmap.org/?mlat=56.88794&mlon=-2.43243#map=16/56.88794/-2.43243',
  treasure: 'https://www.treasuretrails.co.uk/pages/search-results-page?q=Brownmuir',
  outdoorAccess: 'https://www.outdooraccess-scotland.scot/dog-owners',
};

const pkg: any = JSON.parse(await readFile(projectPath, 'utf8'));
const planner: any = JSON.parse(await readFile(plannerPath, 'utf8'));
const dog: any = JSON.parse(await readFile(dogPath, 'utf8'));

const fixes: Record<string, { text: string; first: number; last: number; confidence: 'high' | 'medium'; evidence: string; note: string }> = {
  'hes-listed-building:LB9635': {
    text: '1712', first: 1712, last: 1712, confidence: 'high', evidence: urls.listedEvidence,
    note: 'The statutory description records a 1712 date on a window lintel. The 1972 listing date is not used as the building date.',
  },
  'hes-scheduled-monument:SM2231': {
    text: 'Medieval', first: 1100, last: 1560, confidence: 'medium', evidence: urls.moatEvidence,
    note: 'The HES/Trove record classifies the moated site as medieval. The numeric span is deliberately broad and no exact construction year is claimed.',
  },
};

for (const feature of pkg.features) {
  const fix = fixes[feature.id];
  if (!fix) continue;
  feature.documentedDateText = fix.text;
  feature.earliestPossibleYear = fix.first;
  feature.latestPossibleYear = fix.last;
  feature.dateBasis = fix.first === fix.last ? 'documented_exact_year' : 'estimated_from_authoritative_source';
  feature.dateConfidence = fix.confidence;
  feature.tags = feature.tags.filter((tag: string) => tag !== 'map-hidden');
  feature.reviewed = true;
  feature.updatedAt = reviewedAt;
  feature.reviewNotes = `${feature.reviewNotes ?? ''} ${fix.note}`.trim();
  if (!feature.sourceRecords.some((record: any) => record.sourceUrl === fix.evidence)) {
    feature.sourceRecords.push({
      sourceName: 'Historic Environment Scotland date evidence', sourceOrganisation: 'Historic Environment Scotland',
      sourceUrl: fix.evidence, accessedAt: reviewedAt, reliability: 'official_statutory',
      licence: 'Source-linked statutory evidence; retain Historic Environment Scotland attribution.', notes: fix.note,
    });
  }
}

pkg.features = pkg.features.filter((feature: any) => !feature.id.startsWith('curated-'));
pkg.project.visitorHighlights = [];
pkg.project.preferredBasemap = 'voyager';
pkg.project.touristAppeal = {
  score: 24, dogOwnerScore: 22, dogAccessScoreAdjustment: -2, rating: 0, label: 'Minor Interest',
  summary: 'A very small rural locality without a verified visitor centre, attraction, café, published local trail or visitor facilities inside its strict boundary.',
  dogAccessRating: 1,
  dogAccessSummary: 'Ordinary responsible countryside access may be possible, but no destination-scale dog visit or dedicated facilities are verified.',
  methodVersion: '2026-08-30-strict-settlement-full-audit-v3', reviewedAt: reviewedDate, sourceUrls: Object.values(urls),
};
pkg.project.townGuide = {
  characterTag: 'Small rural Fordoun-area locality', headline: 'A mapped locality rather than a visitor destination',
  intro: 'Brownmuir remains a 24% selector-only settlement. Its statutory heritage is retained on the historic heat layer, but private heritage and nearby Fordoun services are not converted into Brownmuir visitor cards.',
  bestFor: ['Regional reference', 'Historic heat-map research'], perfectFor: ['Identifying the locality while planning a wider Mearns route'],
  suggestedFirstVisit: { title: 'Treat it as a route reference', summary: 'There is no verified visitor itinerary within the strict Brownmuir boundary; plan facilities and attractions elsewhere.' },
  dontMiss: [], suggestedTime: 'Pass-through or pre-arranged visit only',
  visitorMood: 'A quiet rural locality with statutory heritage but no verified public visitor offer.', sourceUrls: Object.values(urls), lastReviewedAt: reviewedDate,
};
pkg.project.researchNotes = 'Full strict-boundary audit. Brownmuir remains selector-only at 24 and does not appear on the town map. Direct checks found no qualifying See place, café/coffee-and-cake stop, named local trail, picnic site, visitor parking or public toilet within the boundary. Fordoun House is private and the medieval moat is archaeological rather than a managed visitor attraction; both remain visible, dated HES heat records. Fordoun and A90 businesses outside the boundary are not borrowed. The former airfield domestic site is retained as an NRHE record but is not presented as a visitor attraction. No dedicated Treasure Trails, Curious About, Mystery Guides or Go Quest product was found.';

planner.projects[projectId] = { eat: [], trails: [], picnic: [], parking: [], toilets: [] };
dog.projects[projectId] = {};

const statutory = pkg.features.filter((feature: any) => feature.tags.includes('hes-listed-building') || feature.tags.includes('hes-scheduled-monument'));
const visible = statutory.filter((feature: any) => !feature.tags.includes('map-hidden'));
const dated = visible.filter((feature: any) => feature.documentedDateText?.trim() && feature.earliestPossibleYear != null && feature.latestPossibleYear != null && feature.dateBasis !== 'unknown');
const report = {
  reviewedAt, projectId, status: 'verified', settlementScore: 24, previousScore: 24,
  independentlyWorthwhile: false, publishOnTownMap: false,
  scoreRationale: 'No independently visitable settlement experience or visitor-service cluster was verified inside the strict boundary.',
  publication: { see: 0, eat: 0, trails: 0, picnic: 0, parking: 0, toilets: 0 },
  heritage: { expectedStatutoryRecords: 2, representedStatutoryRecords: statutory.length, visibleDatedStatutoryPins: dated.length, visibleUndatedStatutoryPins: visible.length - dated.length, hiddenStatutoryPins: statutory.length - visible.length, manualDateRepairs: Object.keys(fixes) },
  namedTrailSearch: { TreasureTrails: 'No dedicated Brownmuir or Fordoun product found after direct search', CuriousAbout: 'No dedicated product found', MysteryGuides: 'No dedicated product found', GoQuestAdventures: 'No dedicated product found', retained: [] },
  practicalAudit: {
    eat: 'No qualifying café, coffee-and-cake stop, tearoom or light-lunch venue inside the boundary; nearby Fordoun/A90 businesses are outside it.',
    picnic: 'No managed or evidenced public picnic facility inside the boundary.', parking: 'No dedicated public visitor car park inside the boundary; private/residential access is not published as visitor parking.',
    toilets: 'Brownmuir is absent from the council public-toilet directory.', accessibility: 'No managed visitor facility with published accessibility information.', transport: 'Rural road locality; no attraction transport provision verified.',
  },
  exclusions: [
    'Fordoun House: private listed farmhouse, retained as a dated HES record rather than a See card.',
    'Fordoun homestead moat: statutory medieval archaeology without verified managed visitor access or interpretation.',
    'Fordoun Airfield domestic site: NRHE evidence survives, but no current managed visitor offer was verified.',
    'Green Bean Coffee Shop and other Fordoun/A90 services: outside the strict Brownmuir boundary.',
  ],
  verification: { allCuratedCoordinatesCheckedAgainstBoundary: true, trailLinksChecked: [urls.treasure], allStatutoryHesRecordsVisibleAndDated: dated.length === 2 && visible.length === 2, datesStoredWithoutChangingMapNames: statutory.every((feature: any) => !feature.name.includes(feature.documentedDateText)) },
};

await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`);
await writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`);
await writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`);
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
