import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

interface AuditIssue {
  featureId: string;
  name: string;
  issues: string[];
}

interface TownAudit {
  projectId: string;
  locality: string;
  categories: {
    eat: {
      issues: AuditIssue[];
    };
  };
}

interface AuditReport {
  reviewedAt: string;
  towns: TownAudit[];
}

interface PlannerCuration {
  schemaVersion: number;
  description?: string;
  projects: Record<string, Record<string, string[]>>;
}

const localDateParts = Object.fromEntries(
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .formatToParts(new Date())
    .map((part) => [part.type, part.value]),
);
const reviewDate = `${localDateParts.year}-${localDateParts.month}-${localDateParts.day}`;
const auditPath = resolve(`data/review/all-town-bundled-visitor-audit-${reviewDate}.json`);
const curationPath = resolve('data/visitor-planner-curation.json');
const remediationPath = resolve(`data/review/visitor-library-remediation-${reviewDate}.json`);

const audit = JSON.parse(await readFile(auditPath, 'utf8')) as AuditReport;
const curation = JSON.parse(await readFile(curationPath, 'utf8')) as PlannerCuration;
const removableIssue = /^(eat score missing|restricted access:)/i;
const removed: Array<{
  projectId: string;
  locality: string;
  featureId: string;
  name: string;
  reasons: string[];
}> = [];

for (const town of audit.towns) {
  const project = curation.projects[town.projectId];
  if (!project) continue;
  const removals = new Map(
    town.categories.eat.issues
      .filter((issue) => issue.issues.some((reason) => removableIssue.test(reason)))
      .map((issue) => [issue.featureId, issue]),
  );
  if (!removals.size) continue;

  const existing = project.eat ?? [];
  project.eat = existing.filter((featureId) => {
    const issue = removals.get(featureId);
    if (!issue) return true;
    removed.push({
      projectId: town.projectId,
      locality: town.locality,
      featureId,
      name: issue.name,
      reasons: issue.issues.filter((reason) => removableIssue.test(reason)),
    });
    return false;
  });
}

await writeFile(curationPath, `${JSON.stringify(curation, null, 2)}\n`);
await writeFile(
  remediationPath,
  `${JSON.stringify(
    {
      schemaVersion: 1,
      remediatedAt: new Date().toISOString(),
      sourceAudit: auditPath,
      policy:
        'Public Eat lists require a visitor score and must exclude restricted or customer-only access. Removed records remain in source project packages for future evidence-backed review.',
      removedCount: removed.length,
      removed,
    },
    null,
    2,
  )}\n`,
);

console.log(`Removed ${removed.length} unsuitable Eat records from public curation.`);
console.log(remediationPath);
