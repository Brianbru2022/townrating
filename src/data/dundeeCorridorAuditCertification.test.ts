import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import planner from '../../data/cairn-o-mount-visitor-planner-curation.json';
import { publishedAuditCounts, certifyFullTownAudit, type FullTownAuditReport } from '../domain/townAuditCertification';
import { homeTownOverviews } from '../map/homeOverview';
import { cairnOMountPackages } from './cairnOMount';

const projects = [
  ['tealing-scotland', 56, 'tealing-full-visitor-audit-2026-09-01.json'],
  ['kirkton-dundee-scotland', 34, 'kirkton-dundee-full-visitor-audit-2026-09-01.json'],
  ['newbigging-monifieth-scotland', 46, 'newbigging-monifieth-full-visitor-audit-2026-09-01.json'],
  ['muir-of-pert-tealing-scotland', 18, 'muir-of-pert-tealing-full-visitor-audit-2026-09-01.json'],
  ['inveraldie-scotland', 26, 'inveraldie-full-visitor-audit-2026-09-01.json'],
  ['bucklerheads-scotland', 24, 'bucklerheads-full-visitor-audit-2026-09-01.json'],
  ['burnside-of-duntrune-scotland', 26, 'burnside-of-duntrune-full-visitor-audit-2026-09-01.json'],
  ['fintry-dundee-scotland', 48, 'fintry-dundee-full-visitor-audit-2026-09-01.json'],
  ['douglas-and-angus-dundee-scotland', 32, 'douglas-and-angus-dundee-full-visitor-audit-2026-09-01.json'],
  ['craigie-dundee-scotland', 32, 'craigie-dundee-full-visitor-audit-2026-09-01.json'],
  ['stannergate-dundee-scotland', 28, 'stannergate-dundee-full-visitor-audit-2026-09-01.json'],
  ['dundee-scotland', 93, 'dundee-full-visitor-audit-2026-09-01.json'],
] as const;

const packages = projects.map(([id]) => {
  const pkg = cairnOMountPackages.find((item) => item.project.id === id);
  if (!pkg) throw new Error(`Missing Dundee-corridor project ${id}`);
  return pkg;
});

describe('Dundee corridor full-audit certification', () => {
  it('keeps every place in the library and applies the 60-point map rule', () => {
    expect(packages.map((pkg) => [pkg.project.id, pkg.project.touristAppeal?.score])).toEqual(
      projects.map(([id, score]) => [id, score]),
    );
    expect(homeTownOverviews(packages).map((town) => town.id)).toEqual(['dundee-scotland']);
  });

  it('publishes the reconciled Dundee and attraction-only category counts', () => {
    const byId = new Map(packages.map((pkg) => [pkg.project.id, pkg]));
    expect(publishedAuditCounts(byId.get('dundee-scotland')!, (planner as any).projects['dundee-scotland'])).toEqual({
      see: 8, eat: 7, trails: 7, picnic: 3, parking: 4, toilets: 4,
    });
    expect(publishedAuditCounts(byId.get('tealing-scotland')!, (planner as any).projects['tealing-scotland'])).toEqual({
      see: 2, eat: 0, trails: 0, picnic: 0, parking: 1, toilets: 0,
    });
    expect(publishedAuditCounts(byId.get('fintry-dundee-scotland')!, (planner as any).projects['fintry-dundee-scotland'])).toEqual({
      see: 1, eat: 0, trails: 1, picnic: 0, parking: 1, toilets: 0,
    });
  });

  it('retains complete heritage data while dating every visible historic pin without changing map names', () => {
    for (const pkg of packages) {
      const heritage = pkg.features.filter((feature) => feature.tags.some((tag) =>
        ['hes-listed-building', 'hes-scheduled-monument', 'hes-garden-designed-landscape', 'hes-nrhe', 'nrhe'].includes(tag),
      ));
      const visible = heritage.filter((feature) => !feature.tags.includes('map-hidden'));
      expect(visible.every((feature) =>
        Boolean(feature.documentedDateText) &&
        feature.dateBasis !== 'unknown' &&
        !feature.name.includes(feature.documentedDateText!),
      ), pkg.project.name).toBe(true);
    }
  });

  it('passes the reusable fail-closed audit certificate for all twelve places', async () => {
    for (const [id, _score, reportName] of projects) {
      const pkg = packages.find((item) => item.project.id === id)!;
      const report = JSON.parse(await readFile(resolve(`data/review/${reportName}`), 'utf8')) as FullTownAuditReport;
      expect(certifyFullTownAudit(pkg, report, (planner as any).projects[id]).issues, id).toEqual([]);
    }
  });
});
