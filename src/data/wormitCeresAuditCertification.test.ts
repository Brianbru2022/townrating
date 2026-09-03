import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ProjectPackage } from '../domain/models';
import {
  certifyFullTownAudit,
  type FullTownAuditReport,
} from '../domain/townAuditCertification';
import { publishedPlannerCurationForProject } from './visitorPlannerCuration';
import { publishedDogAccessForPlace } from './dogAccessCuration';

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

describe('Wormit-to-Ceres sequential audit certification', () => {
  it.each(auditFiles)('%s passes the fail-closed full-audit gate', (file) => {
    const pkg = JSON.parse(
      readFileSync(resolve('data/projects', `${file}.json`), 'utf8'),
    ) as ProjectPackage;
    const report = JSON.parse(
      readFileSync(
        resolve('data/review', `${file}-full-visitor-audit-2026-09-02.json`),
        'utf8',
      ),
    ) as FullTownAuditReport;
    const result = certifyFullTownAudit(
      pkg,
      report,
      publishedPlannerCurationForProject(pkg.project.id),
    );

    expect(result.issues, pkg.project.name).toEqual([]);
  });

  it.each(auditFiles)('%s has dog-access evidence for every published See and Eat entry', (file) => {
    const pkg = JSON.parse(
      readFileSync(resolve('data/projects', `${file}.json`), 'utf8'),
    ) as ProjectPackage;
    const curation = publishedPlannerCurationForProject(pkg.project.id);

    for (const highlight of pkg.project.visitorHighlights ?? []) {
      expect(
        publishedDogAccessForPlace(pkg.project.id, 'attraction', highlight.featureId),
        `${pkg.project.name}: ${highlight.featureId}`,
      ).toBeDefined();
    }
    for (const featureId of curation.eat ?? []) {
      expect(
        publishedDogAccessForPlace(pkg.project.id, 'eat', featureId),
        `${pkg.project.name}: ${featureId}`,
      ).toBeDefined();
    }
  });

  it('keeps the selected internet-fallback HES evidence isolated from the Scotland-wide report', () => {
    const report = JSON.parse(
      readFileSync(
        resolve('data/review/wormit-ceres-hes-integrity-2026-09-02.json'),
        'utf8',
      ),
    ) as {
      projects: number;
      missingStatutoryDesignations: number;
      undatedVisiblePins: number;
      sourceMode: string;
      projectsDetail: Array<{ undated: string[] }>;
    };
    const unresolved = JSON.parse(
      readFileSync(
        resolve(
          'data/review/wormit-ceres-hes-integrity-2026-09-02-unresolved-dates.json',
        ),
        'utf8',
      ),
    ) as { sourceMode: string; unresolved: string[] };

    expect(report).toMatchObject({
      projects: 13,
      missingStatutoryDesignations: 0,
      undatedVisiblePins: 0,
      sourceMode: 'local-first-with-explicit-network-fallback',
    });
    expect(unresolved.sourceMode).toBe(report.sourceMode);
    expect(
      report.projectsDetail
        .flatMap((project) => project.undated)
        .every((reference) => unresolved.unresolved.includes(reference)),
    ).toBe(true);
  });
});
