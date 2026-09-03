import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { ProjectPackage } from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';

const reviewedAt = '2026-09-02';
const packageUpdates = {
  'fowlis-easter': {
    highlightId: 'west-dundee-curated:fowlis-easter-church',
    opening: 'First Sunday of each month at 11:00 for public worship; other access by advertised event or arrangement.',
    admission: 'Free',
    tagline: 'Exceptional medieval church art',
    assessment: { experienceDepth: 22, distinctiveness: 18, presentation: 17, journeyWorth: 12, accessAndReliability: 5, evidenceConfidence: 4, visitability: 'full_visitor_experience' as const },
  },
  longforgan: {
    highlightId: 'west-dundee-curated:longforgan-parish-church',
    opening: 'Wednesdays, May to August, 14:00–16:00; also by arrangement.',
    admission: 'Free',
    tagline: 'Nine centuries of Carse worship',
    assessment: { experienceDepth: 18, distinctiveness: 17, presentation: 16, journeyWorth: 11, accessAndReliability: 6, evidenceConfidence: 4, visitability: 'full_visitor_experience' as const },
  },
  kingoodie: {
    highlightId: 'west-dundee-curated:kingoodie-quarry',
    opening: 'Open-access outdoor paths; use daylight and safe ground conditions.',
    admission: 'Free',
    tagline: 'Quarry reclaimed by woodland',
    assessment: { experienceDepth: 16, distinctiveness: 16, presentation: 15, journeyWorth: 10, accessAndReliability: 7, evidenceConfidence: 4, visitability: 'full_visitor_experience' as const },
  },
} as const;

const foodDetails: Record<string, string> = {
  'west-dundee-curated:downfield-tesco-cafe': 'amenity=cafe; visit_score=64; tagline=Reliable coffee and light meals; opening_hours:description=Monday–Saturday 07:00–17:00; Sunday 08:00–17:00; price_band=£; cuisine=coffee, cakes and light meals; description=Supermarket café for barista coffee and a straightforward light meal.',
  'west-dundee-curated:post-house-coffee': 'amenity=cafe; visit_score=78; tagline=Independent coffee and home baking; opening_hours:description=Current weekly opening hours are not published; contact the café before travel.; price_band=££; cuisine=artisan coffee, home baking and light lunch; description=Independent village café for artisan coffee, home baking, breakfast and light lunches.',
  'west-dundee-curated:longforgan-pop-in-cafe': 'amenity=cafe; visit_score=61; tagline=Weekly community coffee morning; opening_hours:description=Wednesdays 09:00–11:00 when the parish session is running; price_band=£; cuisine=coffee and light refreshments; description=Weekly community coffee stop in the church hall rather than an all-day commercial café.',
};

for (const [stem, update] of Object.entries(packageUpdates)) {
  const path = resolve(`data/projects/${stem}.json`);
  const pkg = JSON.parse(await readFile(path, 'utf8')) as ProjectPackage;
  const highlight = pkg.project.visitorHighlights?.find((item) => item.featureId === update.highlightId);
  if (!highlight) throw new Error(`${stem}: missing ${update.highlightId}`);
  highlight.openingTimes = update.opening;
  highlight.admission = update.admission;
  highlight.tagline = update.tagline;
  highlight.freeAdmission = true;
  const feature = pkg.features.find((item) => item.id === update.highlightId);
  if (!feature) throw new Error(`${stem}: missing feature ${update.highlightId}`);
  if (!highlight.editorialReview || !feature.editorialReview) throw new Error(`${stem}: missing editorial review`);
  highlight.editorialReview.attractionAssessment = update.assessment;
  feature.editorialReview.attractionAssessment = update.assessment;
  feature.attractionGuide = {
    headline: highlight.tagline,
    intro: highlight.reason,
    parking: stem === 'fowlis-easter' ? 'Use the separately audited public car park about 100 metres from Fowlis Hall.' : stem === 'longforgan' ? 'Huntly Wood has a small separately audited public car park; do not assume church forecourt parking.' : 'No dedicated public visitor car park has been verified.',
    toilets: stem === 'longforgan' ? 'An accessible toilet is available during church opening only.' : 'No general public toilet has been verified.',
    picnic: 'No formal picnic facility is claimed.',
    foodNote: stem === 'longforgan' ? 'The church hall hosts a Wednesday-morning Pop-in Café when advertised.' : 'No on-site café is available.',
  };
  pkg.validation = validateFeatures(pkg.project, pkg.features);
  await writeFile(path, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
}

for (const stem of ['downfield-dundee', 'invergowrie', 'longforgan']) {
  const path = resolve(`data/projects/${stem}.json`);
  const pkg = JSON.parse(await readFile(path, 'utf8')) as ProjectPackage;
  for (const feature of pkg.features) if (foodDetails[feature.id]) {
    feature.details = foodDetails[feature.id];
    if (!feature.editorialReview) throw new Error(`${stem}: missing food review for ${feature.id}`);
    const score = Number(/visit_score=(\d+)/.exec(feature.details)?.[1]);
    feature.editorialReview.foodAssessment = score === 78
      ? { foodAndDrinkQuality: 25, daytimeRelevance: 20, distinctiveness: 12, consistency: 10, visitorFit: 6, evidenceConfidence: 5 }
      : score === 64
        ? { foodAndDrinkQuality: 18, daytimeRelevance: 18, distinctiveness: 8, consistency: 8, visitorFit: 7, evidenceConfidence: 5 }
        : { foodAndDrinkQuality: 16, daytimeRelevance: 17, distinctiveness: 8, consistency: 8, visitorFit: 7, evidenceConfidence: 5 };
  }
  pkg.validation = validateFeatures(pkg.project, pkg.features);
  await writeFile(path, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
}

const dogPath = resolve('data/cairn-o-mount-dog-access-curation.json');
const dog = JSON.parse(await readFile(dogPath, 'utf8')) as any;
const unconfirmed = (label: string, url: string) => ({
  rating: 0, status: 'unconfirmed', label,
  summary: 'No reliable current dog policy is published; assistance-dog access may differ, so confirm directly before relying on indoor access.',
  sourceName: 'Current operator information and dog-policy review', sourceUrl: url, reviewedAt,
});
const outdoor = (label: string, summary: string, url: string, rating = 2) => ({
  rating, status: 'restricted', label, summary,
  sourceName: 'Current access information and Scottish Outdoor Access Code', sourceUrl: url, reviewedAt,
});

dog.projects['fowlis-easter-scotland'].attraction['west-dundee-curated:fowlis-easter-church'] = unconfirmed('Indoor pet policy not published', 'https://www.carseandsidlawchurches.org/fowlis-and-liff');
dog.projects['longforgan-scotland'].attraction['west-dundee-curated:longforgan-parish-church'] = unconfirmed('Indoor pet policy not published', 'https://www.scotlandschurchestrust.org.uk/church/longforgan-parish-church/');
dog.projects['kingoodie-scotland'].attraction['west-dundee-curated:kingoodie-quarry'] = outdoor('Outdoor paths with close control', 'Dogs can use the outdoor paths under responsible access; keep them controlled around wildlife, quarry edges, mud, livestock and other visitors.', 'https://www.pkc.gov.uk/article/15386/Invergowrie-Path-Network');
dog.projects['downfield-dundee-scotland'].eat['west-dundee-curated:downfield-tesco-cafe'] = unconfirmed('Café pet policy not published', 'https://www.tesco.com/store-locator/dundee/kingsway');
dog.projects['invergowrie-scotland'].eat['west-dundee-curated:post-house-coffee'] = unconfirmed('Café pet policy not published', 'https://www.posthouseinvergowrie.co.uk/');
dog.projects['longforgan-scotland'].eat['west-dundee-curated:longforgan-pop-in-cafe'] = unconfirmed('Hall pet policy not published', 'https://www.carseandsidlawchurches.org/longforgan');
await writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`, 'utf8');

console.log('Finalised visitor publication fields and source-backed dog-policy results.');
