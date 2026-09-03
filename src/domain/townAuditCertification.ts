import type { PlannerCurationState } from './plannerCuration';
import type { ProjectPackage } from './models';
import { visitorNeedPlaces } from './visitorExperience';
import { topVisitPlaces } from './visiting';

export type AuditedVisitorCategory =
  | 'see'
  | 'eat'
  | 'trails'
  | 'picnic'
  | 'parking'
  | 'toilets';

export interface FullTownAuditReport {
  projectId?: string;
  reviewedAt?: string;
  place?: string;
  townScore?: number;
  mapPublished?: boolean;
  categories?: Partial<Record<AuditedVisitorCategory, {
    audited?: boolean;
    published?: number;
    providerChecks?: Record<string, string>;
  }>>;
  hes?: {
    assigned?: number;
    visibleDated?: number;
    visibleUndated?: number;
    missing?: number;
  };
  research?: {
    currentWebResearch?: boolean;
    strictBoundaryChecked?: boolean;
    sourceChecks?: Array<{
      url?: string;
      checkedAt?: string;
      outcome?: 'verified' | 'no_result' | 'excluded';
      note?: string;
    }>;
  };
  scoreReanalysis?: {
    required?: boolean;
    completed?: boolean;
    resultScore?: number;
    rationale?: string;
  };
  certification?: {
    publicationCountsReconciled?: boolean;
    liveBrowserVerifiedAt?: string | null;
  };
}

export interface TownAuditCertificationResult {
  actualCounts: Record<AuditedVisitorCategory, number>;
  issues: string[];
}

const categories: AuditedVisitorCategory[] = [
  'see',
  'eat',
  'trails',
  'picnic',
  'parking',
  'toilets',
];

function validHttpUrl(value?: string): boolean {
  if (!value) return false;
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

/**
 * Historic names can legitimately contain period words (for example "Roman
 * camp"). A date is treated as presentation text only when the complete saved
 * date has been appended to the label behind a visual separator or brackets.
 */
export function hasAppendedHeritageDateInMapName(
  name: string,
  documentedDateText?: string,
): boolean {
  const dateText = documentedDateText?.trim();
  if (!dateText) return false;
  const escaped = dateText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:\\s*[—–-]\\s*|\\s*[([]\\s*)${escaped}\\s*[)\\]]?$`, 'i').test(name.trim());
}

export function publishedAuditCounts(
  pkg: ProjectPackage,
  curation: PlannerCurationState,
): Record<AuditedVisitorCategory, number> {
  const countNeed = (need: Exclude<AuditedVisitorCategory, 'see' | 'eat'>) =>
    visitorNeedPlaces(pkg, need, Number.MAX_SAFE_INTEGER, {
      curatedFeatureIds: curation[need] ?? [],
    }).length;

  return {
    see: topVisitPlaces(pkg, Number.MAX_SAFE_INTEGER).length,
    eat: visitorNeedPlaces(pkg, 'eat', Number.MAX_SAFE_INTEGER, {
      curatedFeatureIds: curation.eat ?? [],
    }).length,
    trails: countNeed('trails'),
    picnic: countNeed('picnic'),
    parking: countNeed('parking'),
    toilets: countNeed('toilets'),
  };
}

export function certifyFullTownAudit(
  pkg: ProjectPackage,
  report: FullTownAuditReport,
  curation: PlannerCurationState,
): TownAuditCertificationResult {
  const issues: string[] = [];
  const actualCounts = publishedAuditCounts(pkg, curation);
  const projectScore = pkg.project.touristAppeal?.score;

  if (report.place !== pkg.project.name) issues.push('report place does not match project name');
  if (report.townScore !== projectScore) issues.push('report town score does not match project score');
  if (report.mapPublished !== (Number(projectScore) >= 60)) {
    issues.push('map publication flag does not match the 60-point rule');
  }

  for (const category of categories) {
    const audited = report.categories?.[category];
    if (audited?.audited !== true) issues.push(`${category} was not explicitly audited`);
    if (audited?.published !== actualCounts[category]) {
      issues.push(
        `${category} report count ${String(audited?.published)} does not match published count ${actualCounts[category]}`,
      );
    }
  }

  const providerChecks = report.categories?.trails?.providerChecks ?? {};
  const providerNames = Object.keys(providerChecks).join(' ').toLocaleLowerCase('en-GB');
  for (const provider of ['treasure', 'curious', 'mystery', 'goquest']) {
    if (!providerNames.includes(provider)) issues.push(`trail search missing ${provider} provider`);
  }
  if (!/(?:official|walk|fife|council|trust|path|visit|discover|community|forestry|national park)/i.test(providerNames)) {
    issues.push('trail search missing a conventional or official route provider');
  }

  const statutory = pkg.features.filter((feature) =>
    feature.tags.some((tag) =>
      ['hes-listed-building', 'hes-scheduled-monument', 'hes-garden-designed-landscape'].includes(tag),
    ),
  );
  const visible = statutory.filter((feature) => !feature.tags.includes('map-hidden'));
  const undatedVisible = visible.filter(
    (feature) => !feature.documentedDateText || feature.dateBasis === 'unknown',
  );
  const dateInMapName = visible.filter(
    (feature) => hasAppendedHeritageDateInMapName(feature.name, feature.documentedDateText),
  );
  if (report.hes?.assigned !== statutory.length) issues.push('HES assigned count does not match local project data');
  if (report.hes?.visibleDated !== visible.length) issues.push('HES visible-dated count does not match local project data');
  if (report.hes?.visibleUndated !== 0 || undatedVisible.length) issues.push('one or more visible HES pins is undated');
  if (report.hes?.missing !== 0) issues.push('audit reports missing HES records');
  if (dateInMapName.length) issues.push('one or more HES dates is appended to a map label');

  if (report.research?.currentWebResearch !== true) issues.push('current web research is not certified');
  if (report.research?.strictBoundaryChecked !== true) issues.push('strict visitor boundary is not certified');
  const sourceChecks = report.research?.sourceChecks ?? [];
  if (!sourceChecks.length) issues.push('no current source checks were recorded');
  for (const source of sourceChecks) {
    if (!validHttpUrl(source.url) || !source.checkedAt || !source.outcome || !source.note?.trim()) {
      issues.push('a source check is incomplete');
      break;
    }
  }

  if (projectScore === 58) {
    if (
      report.scoreReanalysis?.required !== true ||
      report.scoreReanalysis?.completed !== true ||
      report.scoreReanalysis?.resultScore !== 58 ||
      !report.scoreReanalysis?.rationale?.trim()
    ) {
      issues.push('exact score 58 lacks a completed documented second pass');
    }
  }

  if (report.certification?.publicationCountsReconciled !== true) {
    issues.push('publication counts were not marked reconciled');
  }
  if (!report.certification?.liveBrowserVerifiedAt) {
    issues.push('live browser verification has not been recorded');
  }

  return { actualCounts, issues };
}
