import { describe, expect, it } from 'vitest';
import bottomcraigReport from '../../data/review/bottomcraig-full-visitor-audit-2026-09-02.json';
import bruntonReport from '../../data/review/brunton-creich-full-visitor-audit-2026-09-02.json';
import creichReport from '../../data/review/creich-fife-full-visitor-audit-2026-09-02.json';
import hazeltonReport from '../../data/review/hazelton-walls-full-visitor-audit-2026-09-02.json';
import kilmanyReport from '../../data/review/kilmany-full-visitor-audit-2026-09-02.json';
import kirktonReport from '../../data/review/kirkton-balmerino-full-visitor-audit-2026-09-02.json';
import logieReport from '../../data/review/logie-fife-full-visitor-audit-2026-09-02.json';
import rathilletReport from '../../data/review/rathillet-full-visitor-audit-2026-09-02.json';
import { certifyFullTownAudit, type FullTownAuditReport } from '../domain/townAuditCertification';
import { stAndrewsCoastPackages } from './stAndrewsCoast';
import { publishedPlannerCurationForProject } from './visitorPlannerCuration';

const reports: Record<string, FullTownAuditReport> = {
  'kirkton-balmerino-scotland': kirktonReport as FullTownAuditReport,
  'bottomcraig-scotland': bottomcraigReport as FullTownAuditReport,
  'kilmany-scotland': kilmanyReport as FullTownAuditReport,
  'logie-fife-scotland': logieReport as FullTownAuditReport,
  'rathillet-scotland': rathilletReport as FullTownAuditReport,
  'hazelton-walls-scotland': hazeltonReport as FullTownAuditReport,
  'creich-fife-scotland': creichReport as FullTownAuditReport,
  'brunton-creich-scotland': bruntonReport as FullTownAuditReport,
};

const expected = {
  'kirkton-balmerino-scotland': { see: 0, eat: 0, trails: 1, picnic: 0, parking: 0, toilets: 0 },
  'bottomcraig-scotland': { see: 1, eat: 0, trails: 0, picnic: 0, parking: 0, toilets: 0 },
  'kilmany-scotland': { see: 1, eat: 0, trails: 2, picnic: 0, parking: 0, toilets: 0 },
  'logie-fife-scotland': { see: 0, eat: 0, trails: 0, picnic: 0, parking: 0, toilets: 0 },
  'rathillet-scotland': { see: 0, eat: 0, trails: 0, picnic: 0, parking: 0, toilets: 0 },
  'hazelton-walls-scotland': { see: 0, eat: 0, trails: 0, picnic: 0, parking: 0, toilets: 0 },
  'creich-fife-scotland': { see: 2, eat: 0, trails: 1, picnic: 0, parking: 0, toilets: 0 },
  'brunton-creich-scotland': { see: 1, eat: 0, trails: 1, picnic: 0, parking: 0, toilets: 0 },
};

describe('Kirkton-to-Brunton sequential full-audit gate', () => {
  it.each(Object.keys(reports))('%s reconciles its published categories and complete HES layer', (projectId) => {
    const pkg = stAndrewsCoastPackages.find((item) => item.project.id === projectId)!;
    const result = certifyFullTownAudit(pkg, reports[projectId], publishedPlannerCurationForProject(projectId));
    expect(result.actualCounts).toEqual(expected[projectId as keyof typeof expected]);
    expect(result.issues, projectId).toEqual([]);
  });
});
