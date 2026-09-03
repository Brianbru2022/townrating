import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { ProjectPackage } from '../src/domain/models';
import type { PlannerCurationState } from '../src/domain/plannerCuration';
import {
  certifyFullTownAudit,
  type FullTownAuditReport,
} from '../src/domain/townAuditCertification';

const [projectArg, reportArg, plannerArg] = process.argv.slice(2);
if (!projectArg || !reportArg || !plannerArg) {
  throw new Error(
    'Usage: npm run certify-town-audit -- <project.json> <audit-report.json> <planner-curation.json>',
  );
}

const pkg = JSON.parse(await readFile(resolve(projectArg), 'utf8')) as ProjectPackage;
const report = JSON.parse(await readFile(resolve(reportArg), 'utf8')) as FullTownAuditReport;
const plannerLibrary = JSON.parse(await readFile(resolve(plannerArg), 'utf8')) as {
  projects?: Record<string, PlannerCurationState>;
};
const curation = plannerLibrary.projects?.[pkg.project.id] ?? {};
const result = certifyFullTownAudit(pkg, report, curation);

console.log(JSON.stringify({ projectId: pkg.project.id, ...result }, null, 2));
if (result.issues.length) process.exitCode = 1;
