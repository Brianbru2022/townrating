import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { publishedProjectPackages } from '../src/data/publishedProjects';
import { topVisitPlaces, type VisitPlace } from '../src/domain/visiting';

const reviewDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/London',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());
const outputPath = resolve(`data/review/english-attraction-card-compliance-${reviewDate}.json`);

interface ResearchQueueItem {
  projectId: string;
  town: string;
  featureId: string;
  attraction: string;
  visitorScore?: number;
  missingCurrentResearch: string[];
}

function isEnglishProject(country: string, countryCode: string): boolean {
  return country.toLocaleLowerCase() === 'england' || /(?:^|-)ENG$/i.test(countryCode);
}

function isFallback(value: string | undefined, pattern: RegExp): boolean {
  return !value || pattern.test(value);
}

function completeCard(place: VisitPlace): boolean {
  const guide = place.attractionGuide;
  return Boolean(
    place.timeToSpend &&
      place.openingTimes &&
      place.admission &&
      place.dogAccess &&
      guide?.parking &&
      guide.toilets &&
      guide.picnic &&
      (guide.food?.length || guide.foodNote),
  );
}

function missingCurrentResearch(place: VisitPlace): string[] {
  const guide = place.attractionGuide;
  const missing: string[] = [];
  if (
    isFallback(
      place.openingTimes,
      /opening times vary|check .*current visitor information|open access; daylight/i,
    )
  ) {
    missing.push('opening times');
  }
  if (
    isFallback(
      place.admission,
      /check .*current admission prices|admission charged; check current prices/i,
    )
  ) {
    missing.push('admission/prices');
  }
  if (!place.dogAccess || place.dogAccess.status === 'unconfirmed') {
    missing.push('dog policy');
  }
  if (isFallback(guide?.parking, /not confirmed|check current visitor information/i)) {
    missing.push('parking');
  }
  if (isFallback(guide?.toilets, /not confirmed|check before relying/i)) {
    missing.push('toilets');
  }
  if (isFallback(guide?.picnic, /not confirmed/i)) missing.push('picnic provision');
  if (
    !guide?.food?.length &&
    isFallback(guide?.foodNote, /not confirmed|plan a separate daytime food stop/i)
  ) {
    missing.push('cafe/food');
  }
  return missing;
}

const rows: ResearchQueueItem[] = [];
let attractionCards = 0;
let completeCards = 0;
let invalidDurations = 0;
const confirmed = {
  openingTimes: 0,
  admissionOrPrices: 0,
  dogPolicy: 0,
  parking: 0,
  toilets: 0,
  picnic: 0,
  cafeOrFood: 0,
};

const englishProjects = publishedProjectPackages.filter((pkg) =>
  isEnglishProject(pkg.project.country, pkg.project.countryCode),
);

for (const pkg of englishProjects) {
  for (const place of topVisitPlaces(pkg, 20)) {
    attractionCards += 1;
    if (completeCard(place)) completeCards += 1;
    if (!place.timeToSpend || /5\s*(?:-|to)\s*20\s*minutes/i.test(place.timeToSpend)) {
      invalidDurations += 1;
    }
    const missing = missingCurrentResearch(place);
    if (!missing.includes('opening times')) confirmed.openingTimes += 1;
    if (!missing.includes('admission/prices')) confirmed.admissionOrPrices += 1;
    if (!missing.includes('dog policy')) confirmed.dogPolicy += 1;
    if (!missing.includes('parking')) confirmed.parking += 1;
    if (!missing.includes('toilets')) confirmed.toilets += 1;
    if (!missing.includes('picnic provision')) confirmed.picnic += 1;
    if (!missing.includes('cafe/food')) confirmed.cafeOrFood += 1;
    if (missing.length) {
      rows.push({
        projectId: pkg.project.id,
        town: pkg.project.locality,
        featureId: place.id,
        attraction: place.name,
        visitorScore: place.visitorScore,
        missingCurrentResearch: missing,
      });
    }
  }
}

rows.sort(
  (left, right) =>
    (right.visitorScore ?? 0) - (left.visitorScore ?? 0) ||
    left.town.localeCompare(right.town) ||
    left.attraction.localeCompare(right.attraction),
);

const report = {
  schemaVersion: 1,
  reviewedAt: new Date().toISOString(),
  scope: 'Published English town attraction cards, up to the public limit of 20 per town.',
  interpretation: {
    completeCard:
      'The public card has every required visitor field. A field may still use an honest unconfirmed fallback.',
    confirmedCurrentResearch:
      'The field is populated without one of the catalogue fallbacks. This is a curation coverage measure, not a guarantee that an operator has not changed details since review.',
  },
  totals: {
    englishProjects: englishProjects.length,
    attractionCards,
    completeCards,
    invalidDurations,
    attractionsNeedingCurrentResearch: rows.length,
  },
  confirmedCurrentResearch: confirmed,
  researchQueue: rows,
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ outputPath, ...report.totals, confirmed }, null, 2));
