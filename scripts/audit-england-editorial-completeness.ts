import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { publishedDogAccessForPlace } from '../src/data/dogAccessCuration';
import { publishedProjectPackages } from '../src/data/publishedProjects';
import { publishedPlannerCurationForProject } from '../src/data/visitorPlannerCuration';
import {
  attractionEditorialScore,
  editorialRatingMethodVersion,
  editorialEvidenceTier,
  foodEditorialScore,
  isEditorialBoilerplate,
  maximumAttractionScoreForVisitability,
  publishedAttractionScore,
  publishedFoodScore,
  publishedTrailScore,
  visitorWebsiteRejectionReason,
  type EditorialEvidenceTier,
  type EditorialSourceInput,
} from '../src/domain/editorialResearch';
import type {
  AttractionEditorialAssessment,
  AttractionVisitability,
  FoodEditorialAssessment,
  HeritageFeature,
  VisitorHighlight,
} from '../src/domain/models';
import {
  currentPlaceInfo,
  parkingPriceStatus,
  visitorDescriptionParts,
} from '../src/domain/visitorExperience';
import {
  hasResearchedDogAccess,
  hasSpecificEditorialTagline,
  hasUsefulOpeningInformation,
  hasUsefulPriceInformation,
} from '../src/domain/visitorPublication';

type ReviewedCategory = 'see' | 'eat' | 'parking' | 'trails';
type ReviewStatus = 'complete' | 'no_suitable_results';

interface CategoryReview {
  status: ReviewStatus;
  reviewedAt: string;
  searches: string[];
  sourceUrls: string[];
  notes: string;
  records?: Record<string, RecordReview>;
}

interface RecordReview {
  status: 'approved' | 'excluded';
  reviewedAt: string;
  searches: string[];
  sourceUrls: string[];
  notes: string;
  scoreRationale?: string;
  visitorWebsiteUrl?: string;
  methodVersion?: string;
  attractionAssessment?: AttractionEditorialAssessment;
  foodAssessment?: FoodEditorialAssessment;
  visitability?: AttractionVisitability;
}

interface EditorialResearchStatus {
  schemaVersion: 1 | 2;
  projects: Record<string, Partial<Record<ReviewedCategory, CategoryReview>>>;
}

interface TrailSearchAudit {
  towns?: Array<{
    projectId: string;
    webSearch?: { status?: string };
  }>;
}

interface RecordAudit {
  id: string;
  name: string;
  tagline?: string;
  score?: number;
  evidenceTier: EditorialEvidenceTier;
  issues: string[];
}

interface CategoryAuditStatus {
  status: 'complete' | 'incomplete';
  explicitReview: boolean;
  reviewStatus?: ReviewStatus;
  records: number;
  recordsWithIssues: number;
  issueCount: number;
  widerWebSearch?: string;
}

const reviewedAt = new Date().toISOString();
const date = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/London',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());
const jsonPath = resolve(`data/review/england-editorial-completeness-${date}.json`);
const markdownPath = resolve(`data/review/england-editorial-completeness-${date}.md`);
const queuePath = resolve(`data/review/england-editorial-research-queue-${date}.json`);

async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

function isEnglishProject(country: string, countryCode: string): boolean {
  return country.toLocaleLowerCase('en-GB') === 'england' || /(?:^|-)ENG$/i.test(countryCode);
}

function details(feature: HeritageFeature): Map<string, string> {
  return new Map(currentPlaceInfo(feature).currentDetails.map(({ key, value }) => [key, value]));
}

function firstDetail(values: Map<string, string>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = values.get(key)?.trim();
    if (value) return value;
  }
  return undefined;
}

function webSourceForFeature(feature: HeritageFeature): EditorialSourceInput[] {
  const featureDetails = details(feature);
  const directUrl = firstDetail(featureDetails, 'website', 'external_url', 'contact:website');
  return [
    ...feature.sourceRecords,
    ...(directUrl ? [{ sourceName: 'Place website', sourceUrl: directUrl }] : []),
    ...(feature.editorialReview?.evidenceUrls ?? []).map((sourceUrl) => ({
      sourceName: 'Saved editorial evidence',
      sourceUrl,
    })),
  ];
}

function hasResponsibleSource(tier: EditorialEvidenceTier): boolean {
  return tier === 'official_or_operator' || tier === 'established_secondary';
}

function explicitDogIssues(
  projectId: string,
  kind: 'attraction' | 'eat',
  featureId: string,
): string[] {
  const dog = publishedDogAccessForPlace(projectId, kind, featureId);
  return hasResearchedDogAccess(dog) ? [] : ['dog policy not researched'];
}

function seeAudit(
  projectId: string,
  highlight: VisitorHighlight,
  feature: HeritageFeature | undefined,
  review?: RecordReview,
): RecordAudit {
  const sources: EditorialSourceInput[] = [
    ...(feature?.sourceRecords ?? []),
    {
      sourceName: highlight.sourceName,
      sourceUrl: highlight.sourceUrl,
    },
    ...(highlight.editorialReview?.evidenceUrls ?? []).map((sourceUrl) => ({ sourceUrl })),
  ];
  const evidenceTier = editorialEvidenceTier(sources);
  const issues: string[] = [];
  if (!Number.isFinite(highlight.visitorScore)) issues.push('editorial score missing');
  if (publishedAttractionScore(highlight, feature) === undefined) {
    issues.push('score is not publishable under the current researched assessment method');
  }
  if (highlight.editorialReview?.methodVersion !== editorialRatingMethodVersion) {
    issues.push('current editorial method version missing');
  }
  if (!highlight.editorialReview?.attractionAssessment) {
    issues.push('saved attraction scoring dimensions missing');
  } else if (
    attractionEditorialScore(highlight.editorialReview.attractionAssessment) !==
    Math.round(Number(highlight.visitorScore))
  ) {
    issues.push('saved attraction dimensions do not reproduce the public score');
  }
  if (review?.status !== 'approved') issues.push('saved editorial record review missing');
  if (!review?.scoreRationale?.trim()) issues.push('score rationale missing');
  if (!review?.sourceUrls?.length) issues.push('opened editorial evidence URLs missing');
  if (isEditorialBoilerplate(highlight.reason)) issues.push('visitor copy is missing or boilerplate');
  if (!hasSpecificEditorialTagline(highlight.tagline)) {
    issues.push('specific short highlight pill missing');
  }
  if (!highlight.timeToSpend || /5\s*(?:-|to)\s*20\s*minutes/i.test(highlight.timeToSpend)) {
    issues.push('realistic time to spend missing');
  }
  if (!hasUsefulOpeningInformation(highlight.openingTimes)) {
    issues.push('usable opening pattern missing');
  }
  if (!hasUsefulPriceInformation(highlight.admission)) {
    issues.push('explicit admission/free status missing');
  }
  if (!hasResponsibleSource(evidenceTier)) issues.push('responsible web source missing');
  const publicWebsite = highlight.visitorWebsiteUrl;
  if (publicWebsite && visitorWebsiteRejectionReason(publicWebsite)) {
    issues.push('visitor website is evidence-only or invalid');
  }
  if (review?.visitorWebsiteUrl && review.visitorWebsiteUrl !== highlight.visitorWebsiteUrl) {
    issues.push('researched visitor website is not saved on the attraction');
  }
  const historicSite = Boolean(
    feature &&
      /(?:castle|fort|archaeological_site|demolished_site)/i.test(
        `${feature.featureType} ${feature.name}`,
      ),
  );
  if (
    historicSite &&
    (highlight.visitorScore ?? 0) >= 75 &&
    !highlight.editorialReview?.attractionAssessment?.visitability
  ) {
    issues.push('high-scoring historic site has no saved visitability assessment');
  }
  if (
    feature?.survival === 'site_only_or_demolished' &&
    (highlight.visitorScore ?? 0) > maximumAttractionScoreForVisitability('no_visible_remains')
  ) {
    issues.push('score exceeds no-visible-remains cap');
  }
  issues.push(...explicitDogIssues(projectId, 'attraction', highlight.featureId));
  if (!feature) issues.push('feature missing');
  return {
    id: highlight.featureId,
    name: highlight.name,
    tagline: highlight.tagline,
    score: highlight.visitorScore,
    evidenceTier,
    issues,
  };
}

function eatAudit(projectId: string, feature: HeritageFeature, review?: RecordReview): RecordAudit {
  const featureDetails = details(feature);
  const evidenceTier = editorialEvidenceTier(webSourceForFeature(feature));
  const score = Number(firstDetail(featureDetails, 'visit_score'));
  const summary = firstDetail(featureDetails, 'description', 'why_go') ?? feature.shortDescription;
  const tagline = visitorDescriptionParts(feature).tagline;
  const issues: string[] = [];
  if (!Number.isFinite(score)) issues.push('explicit editorial food score missing');
  if (publishedFoodScore(feature, Number.isFinite(score) ? score : undefined, summary) === undefined) {
    issues.push('score is not publishable under the current researched assessment method');
  }
  if (feature.editorialReview?.methodVersion !== editorialRatingMethodVersion) {
    issues.push('current editorial method version missing');
  }
  if (!feature.editorialReview?.foodAssessment) {
    issues.push('saved food scoring dimensions missing');
  } else if (foodEditorialScore(feature.editorialReview.foodAssessment) !== Math.round(score)) {
    issues.push('saved food dimensions do not reproduce the public score');
  }
  if (review?.status !== 'approved') issues.push('saved editorial record review missing');
  if (!review?.scoreRationale?.trim()) issues.push('score rationale missing');
  if (!review?.sourceUrls?.length) issues.push('opened editorial evidence URLs missing');
  if (isEditorialBoilerplate(summary)) issues.push('food copy is missing or boilerplate');
  if (!hasSpecificEditorialTagline(tagline)) {
    issues.push('specific short highlight pill missing');
  }
  if (
    !hasUsefulOpeningInformation(
      firstDetail(featureDetails, 'opening_hours:description', 'opening_hours'),
    )
  ) {
    issues.push('usable opening pattern missing');
  }
  if (!/^(?:£|££|£££)$/u.test(firstDetail(featureDetails, 'price_band') ?? '')) {
    issues.push('consistent price band missing');
  }
  if (!firstDetail(featureDetails, 'cuisine', 'food_style')) issues.push('food style missing');
  if (!hasResponsibleSource(evidenceTier)) issues.push('responsible web source missing');
  if (review?.visitorWebsiteUrl && visitorWebsiteRejectionReason(review.visitorWebsiteUrl)) {
    issues.push('visitor website is evidence-only or invalid');
  }
  if (review?.visitorWebsiteUrl && review.visitorWebsiteUrl !== feature.visitorWebsiteUrl) {
    issues.push('researched visitor website is not saved on the food place');
  }
  issues.push(...explicitDogIssues(projectId, 'eat', feature.id));
  return {
    id: feature.id,
    name: feature.name,
    tagline,
    score: Number.isFinite(score) ? score : undefined,
    evidenceTier,
    issues,
  };
}

function parkingAudit(feature: HeritageFeature, review?: RecordReview): RecordAudit {
  const featureDetails = details(feature);
  const evidenceTier = editorialEvidenceTier(webSourceForFeature(feature));
  const priceStatus = parkingPriceStatus(feature);
  const issues: string[] = [];
  if (review?.status !== 'approved') issues.push('saved editorial record review missing');
  if (!review?.sourceUrls?.length) issues.push('opened editorial evidence URLs missing');
  if (/^(parking|car park)$/i.test(feature.name.trim())) issues.push('specific public name/location missing');
  if (priceStatus === 'unknown') issues.push('free/paid status unverified');
  if (!hasResponsibleSource(evidenceTier)) issues.push('council/operator source missing');
  if (priceStatus === 'paid') {
    if (!firstDetail(featureDetails, 'price_display', 'charge', 'parking_fee', 'parking:fee')) {
      issues.push('current tariff missing');
    }
    const payment = [...featureDetails.keys()].find((key) => key.startsWith('payment:'));
    if (!payment && !firstDetail(featureDetails, 'payment_methods', 'payment')) {
      issues.push('payment methods missing');
    }
  }
  if (!firstDetail(featureDetails, 'maxstay', 'max_stay')) issues.push('maximum stay unverified');
  return { id: feature.id, name: feature.name, evidenceTier, issues };
}

function trailAudit(feature: HeritageFeature, review?: RecordReview): RecordAudit {
  const featureDetails = details(feature);
  const evidenceTier = editorialEvidenceTier(webSourceForFeature(feature));
  const score = Number(firstDetail(featureDetails, 'trail_score', 'visit_score'));
  const issues: string[] = [];
  if (publishedTrailScore(feature, Number.isFinite(score) ? score : undefined) === undefined) {
    issues.push('score is not publishable under the current researched assessment method');
  }
  if (feature.editorialReview?.methodVersion !== editorialRatingMethodVersion) {
    issues.push('current editorial method version missing');
  }
  if (review?.status !== 'approved') issues.push('saved editorial record review missing');
  if (!review?.scoreRationale?.trim()) issues.push('score rationale missing');
  if (!review?.sourceUrls?.length) issues.push('opened editorial evidence URLs missing');
  if (!Number.isFinite(score)) issues.push('trail score missing');
  if (!hasResponsibleSource(evidenceTier)) issues.push('responsible trail link missing');
  if (!firstDetail(featureDetails, 'distance')) issues.push('distance missing');
  if (!firstDetail(featureDetails, 'time_to_spend', 'duration')) issues.push('duration missing');
  if (!firstDetail(featureDetails, 'difficulty')) issues.push('difficulty missing');
  return {
    id: feature.id,
    name: feature.name,
    score: Number.isFinite(score) ? score : undefined,
    evidenceTier,
    issues,
  };
}

function missingFeatureAudit(id: string): RecordAudit {
  return {
    id,
    name: id,
    evidenceTier: 'no_web_evidence',
    issues: ['feature missing'],
  };
}

function flagDuplicateTaglines(records: RecordAudit[]): void {
  const byTagline = new Map<string, RecordAudit[]>();
  for (const record of records) {
    const key = record.tagline?.trim().toLocaleLowerCase('en-GB');
    if (!key) continue;
    const matches = byTagline.get(key) ?? [];
    matches.push(record);
    byTagline.set(key, matches);
  }
  for (const matches of byTagline.values()) {
    if (matches.length < 2) continue;
    for (const record of matches) {
      record.issues.push('highlight pill is not unique within category');
    }
  }
}

const status = await readJson<EditorialResearchStatus>(
  resolve('data/editorial-research-status.json'),
  { schemaVersion: 1, projects: {} },
);
const trailAuditReport = await readJson<TrailSearchAudit>(
  resolve('data/review/online-town-trail-audit.json'),
  {},
);
const trailWebStatus = new Map(
  (trailAuditReport.towns ?? []).map((town) => [town.projectId, town.webSearch?.status ?? 'not_run']),
);

const projects = publishedProjectPackages
  .filter((pkg) => isEnglishProject(pkg.project.country, pkg.project.countryCode))
  .map((pkg) => {
    const featureById = new Map(pkg.features.map((feature) => [feature.id, feature]));
    const curation = publishedPlannerCurationForProject(pkg.project.id);
    const reviews = status.projects[pkg.project.id] ?? {};
    const see = (pkg.project.visitorHighlights ?? []).map((highlight) =>
      seeAudit(
        pkg.project.id,
        highlight,
        featureById.get(highlight.featureId),
        reviews.see?.records?.[highlight.featureId],
      ),
    );
    const eat = (curation.eat ?? []).map((id) => {
      const feature = featureById.get(id);
      return feature
        ? eatAudit(pkg.project.id, feature, reviews.eat?.records?.[id])
        : missingFeatureAudit(id);
    });
    flagDuplicateTaglines(see);
    flagDuplicateTaglines(eat);
    const parking = (curation.parking ?? []).map((id) => {
      const feature = featureById.get(id);
      return feature ? parkingAudit(feature, reviews.parking?.records?.[id]) : missingFeatureAudit(id);
    });
    const trails = (curation.trails ?? []).map((id) => {
      const feature = featureById.get(id);
      return feature ? trailAudit(feature, reviews.trails?.records?.[id]) : missingFeatureAudit(id);
    });
    const categoryRecords = { see, eat, parking, trails };
    const categoryStatus = Object.fromEntries(
      (Object.keys(categoryRecords) as ReviewedCategory[]).map((category) => {
        const records = categoryRecords[category];
        const review = reviews[category];
        const issueCount = records.reduce((total, record) => total + record.issues.length, 0);
        const explicitReview = Boolean(
          review &&
            review.searches?.length &&
            review.sourceUrls?.length &&
            (review.status === 'complete' || review.status === 'no_suitable_results'),
        );
        return [
          category,
          {
            status: explicitReview && issueCount === 0 ? 'complete' : 'incomplete',
            explicitReview,
            reviewStatus: review?.status,
            records: records.length,
            recordsWithIssues: records.filter((record) => record.issues.length).length,
            issueCount,
            ...(category === 'trails' ? { widerWebSearch: trailWebStatus.get(pkg.project.id) } : {}),
          },
        ];
      }),
    ) as Record<ReviewedCategory, CategoryAuditStatus>;
    const issueCount = [...see, ...eat, ...parking, ...trails].reduce(
      (total, record) => total + record.issues.length,
      0,
    );
    const completedCategories = Object.values(categoryStatus).filter(
      (category) => category.status === 'complete',
    ).length;
    return {
      projectId: pkg.project.id,
      locality: pkg.project.locality,
      region: pkg.project.region,
      rating: pkg.project.touristAppeal?.rating ?? 0,
      featureCount: pkg.features.length,
      completedCategories,
      issueCount,
      categories: categoryStatus,
      records: categoryRecords,
    };
  })
  .sort(
    (left, right) =>
      right.rating - left.rating ||
      right.issueCount - left.issueCount ||
      right.featureCount - left.featureCount ||
      left.locality.localeCompare(right.locality),
  );

const allRecords = projects.flatMap((project) => Object.values(project.records).flat());
const summary = {
  englishProjects: projects.length,
  fullyEditoriallyReviewedTowns: projects.filter((project) => project.completedCategories === 4).length,
  townsWithNoCompletedCategory: projects.filter((project) => project.completedCategories === 0).length,
  recordsAudited: allRecords.length,
  recordsWithIssues: allRecords.filter((record) => record.issues.length).length,
  osmOnlyRecords: allRecords.filter((record) => record.evidenceTier === 'osm_discovery_only').length,
  recordsWithoutWebEvidence: allRecords.filter((record) => record.evidenceTier === 'no_web_evidence').length,
  unconfirmedDogPolicies: allRecords.filter((record) =>
    record.issues.includes('dog policy not researched'),
  ).length,
  parkingRecordsWithUnknownPrice: allRecords.filter((record) =>
    record.issues.includes('free/paid status unverified'),
  ).length,
  townsWithoutCompletedTrailWebSearch: projects.filter(
    (project) => project.categories.trails.widerWebSearch !== 'completed',
  ).length,
};

const report = {
  schemaVersion: 2,
  reviewedAt,
  standard: 'docs/ENGLAND_EDITORIAL_RESEARCH_STANDARD.md',
  interpretation:
    'OSM is discovery evidence only. A populated field does not count as researched without responsible web evidence and explicit category sign-off.',
  summary,
  projects,
};
const queue = {
  schemaVersion: 1,
  generatedAt: reviewedAt,
  ordering: 'Town rating, issue count, feature count, then locality.',
  projects: projects.map((project) => ({
    projectId: project.projectId,
    locality: project.locality,
    region: project.region,
    rating: project.rating,
    completedCategories: project.completedCategories,
    issueCount: project.issueCount,
    categories: project.categories,
  })),
};
const markdown = `# England editorial completeness audit\n\nGenerated: ${reviewedAt}\n\nThis is a strict editorial audit. OpenStreetMap-only records and generated catalogue copy are not treated as completed research.\n\n## Summary\n\n- English towns: ${summary.englishProjects}\n- Fully editorially reviewed towns: ${summary.fullyEditoriallyReviewedTowns}\n- Towns with no completed category: ${summary.townsWithNoCompletedCategory}\n- See/Eat/Parking/Trail records audited: ${summary.recordsAudited}\n- Records with one or more research gaps: ${summary.recordsWithIssues}\n- OSM-only records: ${summary.osmOnlyRecords}\n- Records with no web evidence: ${summary.recordsWithoutWebEvidence}\n- Unconfirmed dog policies: ${summary.unconfirmedDogPolicies}\n- Parking records with unknown price status: ${summary.parkingRecordsWithUnknownPrice}\n- Towns without a completed wider-web trail search: ${summary.townsWithoutCompletedTrailWebSearch}\n\n## Priority queue\n\n${projects
  .slice(0, 100)
  .map(
    (project, index) =>
      `${index + 1}. ${project.locality} (${project.region ?? 'region not recorded'}) - rating ${project.rating}, ${project.issueCount} issues, ${project.completedCategories}/4 categories signed off`,
  )
  .join('\n')}\n`;

for (const path of [jsonPath, markdownPath, queuePath]) await mkdir(dirname(path), { recursive: true });
await Promise.all([
  writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8'),
  writeFile(queuePath, `${JSON.stringify(queue, null, 2)}\n`, 'utf8'),
  writeFile(markdownPath, markdown, 'utf8'),
]);

console.log(JSON.stringify({ jsonPath, markdownPath, queuePath, summary }, null, 2));
