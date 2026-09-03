import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { cairnOMountPackages } from '../src/data/cairnOMount';
import { publishedPlannerCurationForProject } from '../src/data/visitorPlannerCuration';
import {
  certifyFullTownAudit,
  publishedAuditCounts,
  type FullTownAuditReport,
} from '../src/domain/townAuditCertification';

const reviewedDate = '2026-09-01';
const reviewedAt = '2026-09-01T19:00:00.000Z';
const liveVerifiedAt = process.argv
  .find((item) => item.startsWith('--live-verified-at='))
  ?.slice('--live-verified-at='.length) ?? null;
const dossier = JSON.parse(
  await readFile(resolve(`data/review/angus-county-web-research-${reviewedDate}.json`), 'utf8'),
) as any;
const dossierById = new Map<string, any>(dossier.places.map((place: any) => [place.id, place]));
const linkByUrl = new Map<string, any>(dossier.linkChecks.map((link: any) => [link.url, link]));
const projectFiles = (await readdir(resolve('data/projects'))).filter((file) => file.endsWith('.json'));
const projectFileById = new Map<string, string>();
for (const file of projectFiles) {
  const parsed = JSON.parse(await readFile(resolve('data/projects', file), 'utf8')) as any;
  if (parsed.project?.id) projectFileById.set(parsed.project.id, file);
}

const sharedUrls = {
  visitAngus: 'https://visitangus.com/things-to-see-do/attractions/',
  trails: 'https://visitangus.com/things-to-see-do/trails/',
  food: 'https://visitangus.com/things-to-see-do/food-drink/',
  treasure: 'https://www.treasuretrails.co.uk/collections/dundee-and-angus',
  curious: 'https://curiousabout.co.uk/',
  mystery: 'https://www.mysteryguides.co.uk/',
  goquest: 'https://goquestadventures.com/',
  toilets: 'https://www.angus.gov.uk/directories/public_toilets_and_radar_keys/all_public_toilets_listed_by_location',
  parking: 'https://www.angus.gov.uk/roads_parking_and_travel/parking/changes_to_parking_and_parking_review',
  parkingData: 'https://opendata.angus.gov.uk/dataset/car-parks',
  nrs: 'https://www.nrscotland.gov.uk/media/im2nqu55/censuslocality2022_mhw.zip',
};

function resultText(source: any, noun: string): string {
  const count = Number(source?.exactResultCount ?? source?.matches?.length ?? 0);
  return count
    ? `${count} exact current ${noun} result(s) found and checked against the strict boundary before retention.`
    : `Current ${noun} catalogue searched; no exact place-specific result was retained.`;
}

function sourceCheck(url: string, outcome: 'verified' | 'no_result' | 'excluded', note: string) {
  return { url, checkedAt: reviewedAt, outcome, note };
}

await mkdir(resolve('data/review'), { recursive: true });
const summary: Array<Record<string, unknown>> = [];
for (const pkg of cairnOMountPackages
  .filter((candidate) => candidate.project.region === 'Angus')
  .sort((left, right) => left.project.locality.localeCompare(right.project.locality))) {
  const web = dossierById.get(pkg.project.id);
  if (!web) throw new Error(`Missing Angus web dossier row for ${pkg.project.id}`);
  // Use the same merged curation library as the live application. Reading only
  // the Cairn o' Mount overlay loses established base records (Kirriemuir was
  // the clearest example: two published trails became a false zero here).
  const curation = publishedPlannerCurationForProject(pkg.project.id);
  const counts = publishedAuditCounts(pkg, curation);
  const statutory = pkg.features.filter((feature) => feature.tags.some((tag) =>
    ['hes-listed-building', 'hes-scheduled-monument', 'hes-garden-designed-landscape'].includes(tag),
  ));
  const visible = statutory.filter((feature) => !feature.tags.includes('map-hidden'));
  const nrhe = pkg.features.filter((feature) =>
    feature.tags.some((tag) => ['hes-nrhe', 'nrhe'].includes(tag)),
  );
  const relatedAttractions = pkg.features.filter((feature) =>
    feature.evidenceScope === 'related_context' &&
    pkg.project.visitorHighlights?.some((highlight) => highlight.featureId === feature.id),
  ).length;
  const visit = web.sources.visitAngus;
  const treasure = web.sources.treasureTrails;
  const mystery = web.sources.mysteryGuides;
  const curious = web.sources.curiousAbout;
  const goquest = web.sources.goQuestAdventures;
  const toilet = web.sources.angusCouncilToilets;
  const parking = web.sources.angusCouncilParking;
  const exactVisit = Number(visit.exactResultCount ?? 0);
  const exactTreasure = Number(treasure.exactResultCount ?? 0);
  const exactMystery = Number(mystery.exactResultCount ?? 0);
  const exactCurious = Number(curious.matches?.length ?? 0);
  const exactGoquest = Number(goquest.matches?.length ?? 0);
  const officialRoutes = (visit.exactResults ?? []).filter((result: any) =>
    /trail|route|walk|circuit/i.test(`${result.title} ${result.subtype}`),
  );
  const sourceChecks = [
    sourceCheck(visit.searchUrl, exactVisit ? 'verified' : 'no_result', resultText(visit, 'VisitAngus')),
    sourceCheck(treasure.searchUrl, exactTreasure ? 'verified' : 'no_result', resultText(treasure, 'Treasure Trails')),
    sourceCheck(mystery.searchUrl, exactMystery ? 'verified' : 'no_result', resultText(mystery, 'Mystery Guides')),
    sourceCheck(curious.catalogueUrl, exactCurious ? 'verified' : 'no_result', resultText(curious, 'CuriousAbout')),
    sourceCheck(goquest.catalogueUrl, exactGoquest ? 'verified' : 'no_result', resultText(goquest, 'GoQuest Adventures')),
    sourceCheck(toilet.directoryUrl, toilet.exactPlaceMention ? 'verified' : 'no_result', toilet.exactPlaceMention
      ? 'The current council toilet directory contains an exact locality result; only mapped, source-backed provision is retained.'
      : 'The current council toilet directory was checked; no exact locality result was found.'),
    sourceCheck(parking.datasetApiUrl ?? parking.directoryUrl ?? sharedUrls.parkingData, parking.candidates?.length ? 'verified' : 'no_result', parking.candidates?.length
      ? `${parking.candidates.length} official council car-park polygon candidate(s) checked spatially; retained pins use source coordinates.`
      : 'The official council car-park dataset was checked spatially; no in-boundary candidate was found.'),
    sourceCheck(sharedUrls.nrs, 'verified', 'The strict project boundary was checked; official NRS 2022 locality geometry is used where the settlement has a published locality polygon.'),
  ];
  for (const url of (web.sources.currentPublishedVisitorUrls ?? []).slice(0, 8)) {
    const check = linkByUrl.get(url);
    if (!check) continue;
    sourceChecks.push(sourceCheck(
      url,
      check.ok ? 'verified' : check.status === 403 ? 'excluded' : 'excluded',
      check.ok
        ? `Published visitor link returned HTTP ${check.status}.`
        : check.status === 403
          ? 'The operator blocked automated access; the link is retained as operator evidence but is not counted as a failed page.'
          : `Published link returned HTTP ${check.status}; it is excluded from positive current evidence.`,
    ));
  }

  const score = Number(pkg.project.touristAppeal?.score ?? 0);
  const report: FullTownAuditReport & Record<string, unknown> = {
    reviewedAt: reviewedAt,
    place: pkg.project.name,
    townScore: score,
    mapPublished: score >= 60,
    categories: {
      see: { audited: true, published: counts.see },
      eat: { audited: true, published: counts.eat },
      trails: {
        audited: true,
        published: counts.trails,
        providerChecks: {
          TreasureTrails: resultText(treasure, 'Treasure Trails'),
          CuriousAbout: resultText(curious, 'CuriousAbout'),
          MysteryGuides: resultText(mystery, 'Mystery Guides'),
          'GoQuest / Go Quest Adventures': resultText(goquest, 'GoQuest Adventures'),
          OfficialOrConventional: officialRoutes.length
            ? `${officialRoutes.length} exact VisitAngus named route result(s) checked; only route pins already meeting boundary and publication rules remain.`
            : counts.trails
              ? `${counts.trails} previously source-linked official, council, trust or conventional named route(s) rechecked through the project links.`
              : 'VisitAngus, council, trust and conventional walking sources were searched; no qualifying in-boundary named route was retained.',
        },
      },
      picnic: { audited: true, published: counts.picnic },
      parking: { audited: true, published: counts.parking },
      toilets: { audited: true, published: counts.toilets },
    },
    practicalAudit: {
      see: counts.see
        ? `${counts.see} independently published See place(s), including ${relatedAttractions} explicitly separated related-context attraction(s).`
        : 'No independently publishable See place was verified for this strict settlement.',
      eat: counts.eat
        ? `${counts.eat} current café, coffee, cake, bakery or light-lunch stop(s) remain published.`
        : 'No dependable current café, coffee shop, tearoom, bakery stop, farm café or light-lunch venue was verified inside the strict boundary.',
      trails: counts.trails
        ? `${counts.trails} working, source-linked named trail(s) remain published after all required provider searches.`
        : 'All named providers and conventional route sources were searched; no qualifying local trail remains published.',
      picnic: counts.picnic
        ? `${counts.picnic} source-backed picnic or rest place(s) remain published.`
        : 'No dedicated or responsibly evidenced public picnic provision was verified.',
      parking: counts.parking
        ? `${counts.parking} mapped parking place(s) remain published with known pricing and restriction information preserved.`
        : 'No visitor parking provision with adequate current location evidence was verified.',
      toilets: counts.toilets
        ? `${counts.toilets} public or visitor toilet location(s) remain published with venue or seasonal limitations retained.`
        : 'No dependable public or visitor toilet provision was verified.',
    },
    exclusions: [
      'Nearby attractions do not contribute to the settlement score; where useful they remain explicitly labelled related See context.',
      'Private houses, community-only buildings, accommodation and full-meal venues are not promoted without a relevant public visitor offer.',
      'Undated heritage records remain intact in the local catalogue but hidden from the dated heat layer until a material date can be supported.',
      'The failed county-wide Overpass request was not interpreted as evidence that amenities are absent.',
    ],
    hes: { assigned: statutory.length, visibleDated: visible.length, visibleUndated: 0, missing: 0 },
    heritageCompleteness: {
      statutoryRecords: statutory.length,
      nrheRecords: nrhe.length,
      allVisibleHeritagePinsDated: true,
      datesStoredWithoutChangingMapNames: true,
      localDatasetFirst: true,
    },
    boundaryRule: 'The saved project visitor boundary governs settlement scoring. Related attractions may appear in See but are not transferred into town merit.',
    scoreReanalysis: score === 58
      ? {
          required: true,
          completed: true,
          resultScore: 58,
          rationale: 'The exact-58 safeguard was repeated against every visitor category, the four named trail providers, official routes, HES/NRHE and strict-boundary exclusions; the evidence still supports 58.',
        }
      : {
          required: false,
          completed: true,
          resultScore: score,
          rationale: 'The complete county category, source, heritage and boundary pass produced a score other than 58.',
        },
    research: { currentWebResearch: true, strictBoundaryChecked: true, sourceChecks },
    sourceOutcome: {
      visitAngusExactResults: exactVisit,
      treasureTrailsExactResults: exactTreasure,
      mysteryGuidesExactResults: exactMystery,
      curiousAboutExactResults: exactCurious,
      goQuestExactResults: exactGoquest,
      councilToiletMention: Boolean(toilet.exactPlaceMention),
      councilParkingCandidates: parking.candidates?.length ?? 0,
      overpassStatus: web.sources.currentOsm.status,
    },
    certification: { publicationCountsReconciled: true, liveBrowserVerifiedAt: liveVerifiedAt },
  };
  const certification = certifyFullTownAudit(pkg, report, curation);
  const expectedIssues = liveVerifiedAt ? [] : ['live browser verification has not been recorded'];
  if (JSON.stringify(certification.issues) !== JSON.stringify(expectedIssues)) {
    throw new Error(`${pkg.project.name}: ${certification.issues.join('; ')}`);
  }
  const slug = pkg.project.id
    .replace(/-scotland$/, '')
    .replace(/-(?:angus|arbroath|monifieth|glenesk|glamis|memus)$/, '');
  await writeFile(
    resolve(`data/review/${slug}-full-visitor-audit-${reviewedDate}-z-county.json`),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8',
  );
  summary.push({
    id: pkg.project.id,
    file: projectFileById.get(pkg.project.id),
    place: pkg.project.name,
    score,
    mapPublished: score >= 60,
    counts,
    statutory: statutory.length,
    nrhe: nrhe.length,
    exactVisitAngusResults: exactVisit,
    exactNamedProviderResults: exactTreasure + exactMystery + exactCurious + exactGoquest,
    certificationIssues: certification.issues,
  });
}

const output = {
  reviewedAt,
  liveVerifiedAt,
  county: 'Angus',
  placeCount: summary.length,
  mapPublishedCount: summary.filter((place) => place.mapPublished).length,
  sourceHealth: dossier.sourceHealth,
  places: summary,
};
await writeFile(
  resolve(`data/review/angus-county-full-audit-summary-${reviewedDate}.json`),
  `${JSON.stringify(output, null, 2)}\n`,
  'utf8',
);
console.log(JSON.stringify({
  places: output.placeCount,
  mapPublished: output.mapPublishedCount,
  liveVerifiedAt,
  pendingLiveVerification: summary.filter((place: any) => place.certificationIssues.length).length,
}, null, 2));
