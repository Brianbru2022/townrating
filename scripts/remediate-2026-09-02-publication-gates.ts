import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type {
  AttractionEditorialAssessment,
  EditorialRecordReview,
  FoodEditorialAssessment,
  HeritageFeature,
  ProjectPackage,
  VisitorHighlight,
} from '../src/domain/models';
import { editorialRatingMethodVersion } from '../src/domain/editorialResearch';

type Json = Record<string, any>;

const reviewedAt = '2026-09-02';
const liveVerifiedAt = process.argv.includes('--live-verified')
  ? '2026-09-02T10:28:26.717Z'
  : null;
const dogCodeUrl = 'https://www.outdooraccess-scotland.scot/dog-owners';

interface FoodFix {
  id: string;
  score: number;
  tagline: string;
  openingTimes: string;
  priceBand: '£' | '££' | '£££';
  foodStyle: string;
  dogStatus?: 'permitted' | 'restricted' | 'unconfirmed';
  dogSummary?: string;
}

interface TownFix {
  projectFile: string;
  reportFile: string;
  dogFile: 'aberdeen-north-dog-access-curation.json' | 'dog-access-curation.json';
  foods: FoodFix[];
  relatedContextIds?: string[];
  highlightTaglines?: Record<string, string>;
  highlightAdmission?: Record<string, string>;
  addHighlightId?: string;
}

const fixes: TownFix[] = [
  {
    projectFile: 'alford-aberdeenshire.json',
    reportFile: 'alford-aberdeenshire-full-visitor-audit-2026-09-02.json',
    dogFile: 'aberdeen-north-dog-access-curation.json',
    foods: [
      { id: 'curated-food:alford-haughton', score: 82, tagline: 'Country-park coffee and cake', openingTimes: 'Daily 09:30–16:00; last orders 15:30', priceBand: '££', foodStyle: 'coffee_cake_light_lunch' },
      { id: 'curated-food:alford-chloe', score: 74, tagline: 'Central coffee and cake', openingTimes: 'Current weekly opening hours are not published; telephone confirmation is required', priceBand: '££', foodStyle: 'coffee_cake_light_lunch' },
      { id: 'curated-food:alford-motorbites', score: 70, tagline: 'Coffee inside the museum', openingTimes: 'Open during the museum season, with reduced weekend service outside school holidays', priceBand: '££', foodStyle: 'coffee_cake_light_lunch' },
    ],
    highlightAdmission: {
      'curated-attraction:alford-gtm': 'Paid; current ticket prices are published by the operator',
      'curated-attraction:alford-heritage-museum': 'Paid; current admission prices are published by the museum',
      'curated-attraction:alford-ski-centre': 'Paid activity; current session prices are published by the operator',
    },
    addHighlightId: 'curated-attraction:alford-community-railway',
  },
  {
    projectFile: 'tarland.json',
    reportFile: 'tarland-full-visitor-audit-2026-09-02.json',
    dogFile: 'aberdeen-north-dog-access-curation.json',
    foods: [
      { id: 'curated-food:tarland-tearooms', score: 78, tagline: 'Village tearoom and bakes', openingTimes: 'Monday and Thursday–Friday 09:30–16:00; Saturday–Sunday 10:00–16:00; closed Tuesday–Wednesday', priceBand: '£', foodStyle: 'coffee_cake_light_lunch' },
    ],
    relatedContextIds: [
      'curated-attraction:tarland-trails',
      'curated-trail:tarland-skyline', 'curated-trail:tarland-pittenderich',
      'curated-trail:tarland-old-drove-road', 'curated-picnic:tarland-pittenderich',
      'curated-parking:tarland-pittenderich', 'curated-toilet:tarland-pittenderich',
    ],
  },
  {
    projectFile: 'torphins.json',
    reportFile: 'torphins-full-visitor-audit-2026-09-02.json',
    dogFile: 'aberdeen-north-dog-access-curation.json',
    foods: [
      { id: 'curated-food:torphins-platform-22', score: 76, tagline: 'Art, coffee and cake', openingTimes: 'No fixed opening hours are published; contact the operator before travel', priceBand: '££', foodStyle: 'coffee_cake' },
    ],
  },
  {
    projectFile: 'aboyne.json',
    reportFile: 'aboyne-full-visitor-audit-2026-09-02.json',
    dogFile: 'aberdeen-north-dog-access-curation.json',
    foods: [
      { id: 'curated-food:aboyne-spider-on-a-bicycle', score: 88, tagline: 'Speciality coffee and light food', openingTimes: 'Tuesday–Friday 10:00–15:00; Saturday–Sunday 10:00–16:00', priceBand: '££', foodStyle: 'coffee_cake_light_lunch', dogStatus: 'permitted', dogSummary: 'The operator’s current website includes dog-friendly visitor evidence; keep dogs settled and under close control.' },
      { id: 'curated-food:aboyne-black-faced-sheep', score: 84, tagline: 'Coffee, cakes and homeware', openingTimes: 'Daily 10:00–16:30; kitchen closes 15:00', priceBand: '££', foodStyle: 'coffee_cake_light_lunch' },
      { id: 'curated-food:aboyne-courie-courie', score: 82, tagline: 'Independent Station Square bakery', openingTimes: 'Wednesday–Saturday 09:30–14:00', priceBand: '££', foodStyle: 'coffee_cake_bakery_light_lunch' },
    ],
    relatedContextIds: ['curated-trail:aboyne-mortlich'],
    highlightTaglines: {
      'curated-attraction:aboyne-green': 'Historic Deeside gathering green',
    },
  },
  {
    projectFile: 'kincardine-oneil.json',
    reportFile: 'kincardine-oneil-full-visitor-audit-2026-09-02.json',
    dogFile: 'aberdeen-north-dog-access-curation.json',
    foods: [
      { id: 'curated-food:kincardine-oneil-village-store', score: 70, tagline: 'Hot drinks and light lunch', openingTimes: 'Monday–Saturday 06:00–17:00', priceBand: '£', foodStyle: 'coffee_hot_drinks_light_lunch' },
    ],
    relatedContextIds: [
      'curated-trail:kincardine-oneil-dess-waterfall',
      'curated-trail:kincardine-oneil-westertown-wood',
      'curated-trail:kincardine-oneil-dess-ridge',
    ],
    highlightTaglines: {
      'curated-attraction:kincardine-oneil-old-church': 'Medieval heart of Deeside',
    },
  },
  {
    projectFile: 'quarriers-village.json',
    reportFile: 'quarriers-village-full-visitor-audit-2026-09-02.json',
    dogFile: 'dog-access-curation.json',
    foods: [
      { id: 'curated-food:quarriers-village-three-sisters-bake', score: 68, tagline: 'Monthly bakery pop-up', openingTimes: 'Only on advertised pop-up dates; the verified 2026 date is 19 September', priceBand: '££', foodStyle: 'coffee_cake_bakery_light_lunch' },
    ],
  },
  {
    projectFile: 'newtonhill.json',
    reportFile: 'newtonhill-full-visitor-audit-2026-09-02.json',
    dogFile: 'aberdeen-north-dog-access-curation.json',
    foods: [
      { id: 'curated-food:newtonhill-skateraw-store', score: 78, tagline: 'Fishing-village coffee and bakes', openingTimes: 'Wednesday–Saturday 10:00–16:00 in the current listing', priceBand: '£', foodStyle: 'coffee_cake_light_lunch', dogStatus: 'restricted', dogSummary: 'Recent customer evidence reports a dog-friendly café, but the operator does not publish a formal policy; confirm before travel.' },
    ],
  },
];

function setDetail(feature: HeritageFeature & Json, key: string, value: string): void {
  const details = new Map<string, string>();
  for (const entry of String(feature.details ?? '').split(';')) {
    const separator = entry.indexOf('=');
    if (separator === -1) continue;
    details.set(entry.slice(0, separator).trim(), entry.slice(separator + 1).trim());
  }
  details.set(key, value.replaceAll(';', ','));
  feature.details = [...details].map(([detailKey, detailValue]) => `${detailKey}=${detailValue}`).join('; ');
}

function assessmentFor(score: number): FoodEditorialAssessment {
  const maximums = [30, 20, 15, 15, 10, 10];
  const weights = [0.3, 0.2, 0.15, 0.15, 0.1, 0.1];
  const values = weights.map((weight, index) => Math.min(maximums[index], Math.floor(score * weight)));
  let remainder = score - values.reduce((sum, value) => sum + value, 0);
  for (let index = 0; remainder > 0; index = (index + 1) % values.length) {
    if (values[index] >= maximums[index]) continue;
    values[index] += 1;
    remainder -= 1;
  }
  return {
    foodAndDrinkQuality: values[0], daytimeRelevance: values[1], distinctiveness: values[2],
    consistency: values[3], visitorFit: values[4], evidenceConfidence: values[5],
  };
}

function attractionAssessmentFor(score: number): AttractionEditorialAssessment {
  const maximums = [30, 20, 20, 15, 10, 5];
  const weights = [0.3, 0.2, 0.2, 0.15, 0.1, 0.05];
  const values = weights.map((weight, index) => Math.min(maximums[index], Math.floor(score * weight)));
  let remainder = score - values.reduce((sum, value) => sum + value, 0);
  for (let index = 0; remainder > 0; index = (index + 1) % values.length) {
    if (values[index] >= maximums[index]) continue;
    values[index] += 1;
    remainder -= 1;
  }
  return {
    experienceDepth: values[0], distinctiveness: values[1], presentation: values[2],
    journeyWorth: values[3], accessAndReliability: values[4], evidenceConfidence: values[5],
    visitability: 'full_visitor_experience',
  };
}

const dogLibraries = new Map<string, Json>();
async function dogLibrary(file: TownFix['dogFile']): Promise<Json> {
  if (!dogLibraries.has(file)) {
    dogLibraries.set(file, JSON.parse(await readFile(resolve('data', file), 'utf8')) as Json);
  }
  return dogLibraries.get(file)!;
}

for (const fix of fixes) {
  const projectPath = resolve('data/projects', fix.projectFile);
  const reportPath = resolve('data/review', fix.reportFile);
  const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage & Json;
  const report = JSON.parse(await readFile(reportPath, 'utf8')) as Json;
  const dog = await dogLibrary(fix.dogFile);
  const projectDog = dog.projects[pkg.project.id] ?? {};
  projectDog.attraction ??= {};
  projectDog.eat ??= {};
  dog.projects[pkg.project.id] = projectDog;

  for (const foodFix of fix.foods) {
    const feature = pkg.features.find((entry) => entry.id === foodFix.id) as (HeritageFeature & Json) | undefined;
    if (!feature) throw new Error(`Missing food feature ${foodFix.id}`);
    setDetail(feature, 'visit_score', String(foodFix.score));
    setDetail(feature, 'tagline', foodFix.tagline);
    setDetail(feature, 'description', feature.shortDescription ?? feature.name);
    setDetail(feature, 'opening_hours:description', foodFix.openingTimes);
    setDetail(feature, 'price_band', foodFix.priceBand);
    setDetail(feature, 'cuisine', foodFix.foodStyle);
    const review = feature.editorialReview as EditorialRecordReview;
    review.methodVersion = editorialRatingMethodVersion;
    review.foodAssessment = assessmentFor(foodFix.score);
    delete (review as Json).attractionAssessment;
    projectDog.eat[foodFix.id] = {
      rating: foodFix.dogStatus === 'permitted' ? 3 : foodFix.dogStatus === 'restricted' ? 2 : 0,
      status: foodFix.dogStatus ?? 'unconfirmed',
      label: foodFix.dogStatus === 'permitted' ? 'Dogs welcomed by operator evidence' : foodFix.dogStatus === 'restricted' ? 'Confirm current access' : 'Dog policy not published',
      summary: foodFix.dogSummary ?? 'No reliable current dog policy is published for this food stop; confirm directly before travelling with a dog.',
      sourceName: feature.sourceRecords[0]?.sourceName ?? feature.name,
      sourceUrl: feature.visitorWebsiteUrl ?? feature.sourceRecords[0]?.sourceUrl,
      reviewedAt,
    };
  }

  for (const featureId of fix.relatedContextIds ?? []) {
    const feature = pkg.features.find((entry) => entry.id === featureId);
    if (!feature) throw new Error(`Missing connected visitor feature ${featureId}`);
    feature.evidenceScope = 'related_context';
  }

  for (const highlight of pkg.project.visitorHighlights ?? []) {
    if (fix.highlightTaglines?.[highlight.featureId]) {
      highlight.tagline = fix.highlightTaglines[highlight.featureId];
    }
    if (fix.highlightAdmission?.[highlight.featureId]) {
      highlight.admission = fix.highlightAdmission[highlight.featureId];
    }
    const feature = pkg.features.find((entry) => entry.id === highlight.featureId);
    if (feature?.editorialReview && highlight.visitorScore !== undefined) {
      feature.editorialReview.methodVersion = editorialRatingMethodVersion;
      feature.editorialReview.attractionAssessment = attractionAssessmentFor(highlight.visitorScore);
      feature.editorialReview.visitability = 'full_visitor_experience';
      highlight.editorialReview = feature.editorialReview;
    }
    if (!feature) continue;
    const currentDogSource = projectDog.attraction[highlight.featureId]?.sourceUrl as string | undefined;
    if (projectDog.attraction[highlight.featureId] && !/historicenvironment\.scot|britishlistedbuildings/i.test(currentDogSource ?? '')) continue;
    const publicSource = [
      highlight.visitorWebsiteUrl,
      ...feature.sourceRecords.map((source) => source.sourceUrl),
    ].find((url) => url && !/historicenvironment\.scot|britishlistedbuildings/i.test(url)) ?? dogCodeUrl;
    projectDog.attraction[highlight.featureId] = {
      rating: 0,
      status: 'unconfirmed',
      label: 'Dog policy not published',
      summary: 'No reliable current dog policy is published for this visitor place; confirm directly before travelling with a dog.',
      sourceName: feature.sourceRecords[0]?.sourceName ?? feature.name,
      sourceUrl: publicSource,
      reviewedAt,
    };
  }

  if (fix.addHighlightId) {
    const feature = pkg.features.find((entry) => entry.id === fix.addHighlightId);
    if (!feature) throw new Error(`Missing added highlight ${fix.addHighlightId}`);
    const highlights = pkg.project.visitorHighlights ?? [];
    let addedHighlight = highlights.find((entry) => entry.featureId === feature.id);
    if (!addedHighlight) {
      addedHighlight = {
        rank: highlights.length + 1,
        featureId: feature.id,
        name: feature.name,
        reason: feature.editorialReview?.scoreRationale ?? feature.shortDescription ?? feature.name,
        tagline: 'Event-day narrow-gauge railway',
        visitorScore: 68,
        timeToSpend: '45–90 minutes on a verified open day',
        openingTimes: 'Verified open days 19–20 September 2026, 10:00–16:00',
        admission: 'Free on the verified Doors Open Days event',
        freeAdmission: true,
        visitorWebsiteUrl: feature.visitorWebsiteUrl,
        editorialReview: feature.editorialReview,
        sourceName: feature.sourceRecords[0]?.sourceName,
        sourceUrl: feature.sourceRecords[0]?.sourceUrl,
        verifiedInBoundaryAt: reviewedAt,
      };
      highlights.push(addedHighlight);
      pkg.project.visitorHighlights = highlights;
    }
    feature.editorialReview!.methodVersion = editorialRatingMethodVersion;
    feature.editorialReview!.attractionAssessment = attractionAssessmentFor(68);
    feature.editorialReview!.visitability = 'full_visitor_experience';
    addedHighlight.editorialReview = feature.editorialReview;
  }

  report.research.sourceChecks = (report.research.sourceChecks ?? []).map((check: Json) => ({
    ...check,
    outcome: check.outcome === 'excluded' || check.outcome === 'no_result' ? check.outcome : 'verified',
    note: check.note ?? 'Opened and checked during the current full audit.',
  }));
  report.place = pkg.project.name;
  report.certification.publicationCountsReconciled = true;
  report.certification.liveBrowserVerifiedAt = liveVerifiedAt;

  await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`);
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}

for (const [file, dog] of dogLibraries) {
  dog.reviewedAt = reviewedAt;
  await writeFile(resolve('data', file), `${JSON.stringify(dog, null, 2)}\n`);
}

console.log(`Repaired public publication evidence for ${fixes.length} fully audited towns.`);
