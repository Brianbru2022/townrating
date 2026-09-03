import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

interface ProjectResult {
  file: string;
  expectedHesDesignations: number;
  visibleHesPins: number;
  undated: string[];
}

interface IntegrityReport {
  projects: number;
  statutoryDesignationsAssigned: number;
  restoredPins: number;
  repairGeneratedPinsPresent: number;
  visibleHesPins: number;
  missingStatutoryDesignations: number;
  undatedVisiblePins: number;
  sourceMode: string;
  localDescriptionsAvailable: number;
  localDescriptionsMissing: string[];
  projectsDetail: ProjectResult[];
}

const report = JSON.parse(
  readFileSync(resolve('data/review/scotland-wide-hes-integrity-audit-2026-09-02.json'), 'utf8'),
) as IntegrityReport;
const unresolvedReport = JSON.parse(
  readFileSync(resolve('data/review/scotland-wide-hes-unresolved-dates-2026-09-02.json'), 'utf8'),
) as { sourceMode: string; unresolved: string[] };

describe('Scotland-wide HES integrity audit', () => {
  it('retains every in-boundary statutory designation and leaves no visible HES pin undated', () => {
    expect(report.projects).toBe(517);
    expect(report.statutoryDesignationsAssigned).toBe(6_347);
    expect(report.restoredPins).toBe(0);
    expect(report.repairGeneratedPinsPresent).toBe(0);
    expect(report.visibleHesPins).toBe(6_645);
    expect(report.missingStatutoryDesignations).toBe(0);
    expect(report.undatedVisiblePins).toBe(0);
    expect(
      report.projectsDetail
        .flatMap((project) => project.undated)
        .every((reference) => unresolvedReport.unresolved.includes(reference)),
    ).toBe(true);
  });

  it('runs from the formal local HES description snapshot and records every honest hidden-date exception', () => {
    expect(report.sourceMode).toBe('local-only');
    expect(report.localDescriptionsAvailable).toBe(6_345);
    expect(report.localDescriptionsMissing).toEqual(['LB25826', 'LB40935']);
    expect(unresolvedReport.sourceMode).toBe('local-only');
    expect(unresolvedReport.unresolved).toEqual([
      'LB13738',
      'LB17785',
      'LB4643',
      'LB8742',
    ]);
  });

  it('retains the large designation sets in the principal recent audits', () => {
    const byFile = new Map(report.projectsDetail.map((project) => [project.file, project]));
    expect(byFile.get('aberdeen.json')?.expectedHesDesignations).toBe(544);
    expect(byFile.get('old-aberdeen.json')?.expectedHesDesignations).toBe(164);
    expect(byFile.get('cove-bay.json')?.expectedHesDesignations).toBe(18);
  });

  it('keeps dates in the data but removes all date labels from the map source and style', () => {
    const mapSource = readFileSync(resolve('src/map/MapCanvas.tsx'), 'utf8');
    expect(mapSource).not.toContain('heritage-feature-date-labels');
    expect(mapSource).not.toContain('dateLabel:');
  });
});
