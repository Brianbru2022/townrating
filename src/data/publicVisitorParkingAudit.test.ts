import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

interface PlannerLibrary {
  projects: Record<string, { parking?: string[] }>;
}

interface ProjectFile {
  features: Array<{ id: string; name: string }>;
}

interface ParkingAudit {
  summary: { before: number; after: number; policyViolations: number };
  projects: Array<{ projectId: string; before: number; after: number }>;
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(path), 'utf8')) as T;
}

describe('bundled public visitor parking audit', () => {
  const planner = readJson<PlannerLibrary>('data/visitor-planner-curation.json');
  const daventry = readJson<ProjectFile>('data/projects/daventry-england.json');
  const audit = readJson<ParkingAudit>('data/review/public-visitor-parking-audit-2026-08-12.json');

  it('keeps Daventry to a defensible visitor-scale list', () => {
    const parkingIds = planner.projects['daventry-england']?.parking ?? [];
    const names = daventry.features
      .filter((feature) => parkingIds.includes(feature.id))
      .map((feature) => feature.name);

    expect(parkingIds).toHaveLength(13);
    expect(names).toEqual(expect.arrayContaining([
      'Brook Street',
      'Chapel Lane',
      'Chaucer Way',
      'High Street',
      'Newlands',
      'Old Gasworks',
      'Primrose Hill',
      'St James Street',
      'St Johns Square',
    ]));
    expect(names.join(' ')).not.toMatch(/bowen|tea room|retail|tesco|customer|waterloo/i);
  });

  it('records the removal of raw OSM parking noise', () => {
    const daventryAudit = audit.projects.find((project) => project.projectId === 'daventry-england');
    const curatedTotal = Object.values(planner.projects).reduce(
      (total, project) => total + (project.parking?.length ?? 0),
      0,
    );

    expect(audit.summary.before).toBeGreaterThan(audit.summary.after);
    expect(audit.summary.after).toBe(curatedTotal);
    expect(audit.summary.policyViolations).toBe(0);
    expect(daventryAudit?.before).toBeGreaterThan(100);
    expect(daventryAudit?.after).toBeLessThan(20);
  });
});
