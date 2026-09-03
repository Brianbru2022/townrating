import { describe, expect, it } from 'vitest';
import boarhillsReport from '../../data/review/boarhills-full-visitor-audit-2026-09-01.json';
import duninoReport from '../../data/review/dunino-full-visitor-audit-2026-09-01.json';
import guardbridgeReport from '../../data/review/guardbridge-full-visitor-audit-2026-09-01.json';
import leucharsReport from '../../data/review/leuchars-full-visitor-audit-2026-09-01.json';
import rhyndReport from '../../data/review/rhynd-fife-full-visitor-audit-2026-09-01.json';
import tayportReport from '../../data/review/tayport-full-visitor-audit-2026-09-01.json';
import {
  certifyFullTownAudit,
  type FullTownAuditReport,
  type TownAuditCertificationResult,
} from '../domain/townAuditCertification';
import { stAndrewsCoastPackages } from './stAndrewsCoast';
import { publishedPlannerCurationForProject } from './visitorPlannerCuration';

const expected: Record<string, TownAuditCertificationResult['actualCounts']> = {
  'tayport-scotland': { see: 2, eat: 2, trails: 3, picnic: 2, parking: 1, toilets: 1 },
  'leuchars-scotland': { see: 1, eat: 0, trails: 1, picnic: 0, parking: 1, toilets: 0 },
  'guardbridge-scotland': { see: 2, eat: 1, trails: 0, picnic: 0, parking: 0, toilets: 0 },
  'rhynd-fife-scotland': { see: 0, eat: 1, trails: 0, picnic: 0, parking: 1, toilets: 0 },
  'boarhills-scotland': { see: 1, eat: 0, trails: 2, picnic: 1, parking: 0, toilets: 0 },
  'dunino-scotland': { see: 2, eat: 0, trails: 1, picnic: 0, parking: 1, toilets: 0 },
};

const reports: Record<string, FullTownAuditReport> = {
  'tayport-scotland': tayportReport as FullTownAuditReport,
  'leuchars-scotland': leucharsReport as FullTownAuditReport,
  'guardbridge-scotland': guardbridgeReport as FullTownAuditReport,
  'rhynd-fife-scotland': rhyndReport as FullTownAuditReport,
  'boarhills-scotland': boarhillsReport as FullTownAuditReport,
  'dunino-scotland': duninoReport as FullTownAuditReport,
};

describe('corrected St Andrews coast audit certification', () => {
  it.each(Object.keys(reports))('%s passes the full fail-closed audit gate', (projectId) => {
    const pkg = stAndrewsCoastPackages.find((item) => item.project.id === projectId)!;
    const result = certifyFullTownAudit(
      pkg,
      reports[projectId],
      publishedPlannerCurationForProject(projectId),
    );
    expect(result.actualCounts).toEqual(expected[projectId]);
    expect(result.issues, projectId).toEqual([]);
  });
});
