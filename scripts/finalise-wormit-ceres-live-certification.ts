import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { ProjectPackage } from '../src/domain/models';
import type { PlannerCurationState } from '../src/domain/plannerCuration';
import {
  certifyFullTownAudit,
  type FullTownAuditReport,
} from '../src/domain/townAuditCertification';

const liveVerifiedAt = '2026-09-02T15:35:00.000Z';
const auditFiles = [
  'wormit',
  'pickletillum',
  'lucklawhill',
  'balmullo',
  'logie-fife',
  'dairsie',
  'strathkinness',
  'kemback',
  'blebo-craigs',
  'pitscottie',
  'baldinnie',
  'bridgend-ceres',
  'ceres',
] as const;

const plannerLibrary = JSON.parse(
  await readFile(resolve('data/east-neuk-visitor-planner-curation.json'), 'utf8'),
) as { projects?: Record<string, PlannerCurationState> };

for (const file of auditFiles) {
  const projectPath = resolve('data/projects', `${file}.json`);
  const reportPath = resolve(
    'data/review',
    `${file}-full-visitor-audit-2026-09-02.json`,
  );
  const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
  const report = JSON.parse(await readFile(reportPath, 'utf8')) as FullTownAuditReport;
  const curation = plannerLibrary.projects?.[pkg.project.id] ?? {};
  const before = certifyFullTownAudit(pkg, report, curation);
  if (
    before.issues.length !== 1 ||
    before.issues[0] !== 'live browser verification has not been recorded'
  ) {
    throw new Error(`${pkg.project.name}: pre-live certification failed: ${before.issues.join('; ')}`);
  }

  report.certification = {
    ...report.certification,
    publicationCountsReconciled: true,
    liveBrowserVerifiedAt: liveVerifiedAt,
  };
  const after = certifyFullTownAudit(pkg, report, curation);
  if (after.issues.length) {
    throw new Error(`${pkg.project.name}: final certification failed: ${after.issues.join('; ')}`);
  }
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`${pkg.project.name}: live-certified; ${JSON.stringify(after.actualCounts)}`);
}

