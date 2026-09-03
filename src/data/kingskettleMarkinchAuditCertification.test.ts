import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ProjectPackage } from '../domain/models';
import { certifyFullTownAudit, hasAppendedHeritageDateInMapName, type FullTownAuditReport } from '../domain/townAuditCertification';
import { homeTownOverviews } from '../map/homeOverview';
import { publishedAuditCounts } from '../domain/townAuditCertification';
import { stAndrewsCoastPackages } from './stAndrewsCoast';
import { publishedPlannerCurationForProject } from './visitorPlannerCuration';

const slugs = [
  'kingskettle', 'balmalcolm', 'kettlebridge', 'kettlehill', 'montrave', 'rameldry-mill-bank',
  'langdyke-fife', 'muirhead-freuchie', 'kennoway', 'bonnybank', 'scoonie', 'balcurvie',
  'windygates', 'milton-of-balgonie', 'markinch',
] as const;

const requestedBatch = [...slugs.slice(0, 10), 'lundin-links', 'scoonie', 'leven-fife', ...slugs.slice(11)] as const;

const expectedCounts: Record<string, [number, number, number, number, number, number]> = {
  kingskettle: [1, 0, 2, 0, 0, 0],
  balmalcolm: [1, 1, 1, 0, 0, 0],
  kettlebridge: [0, 0, 1, 0, 0, 0],
  kettlehill: [0, 0, 0, 0, 0, 0],
  montrave: [0, 0, 0, 0, 0, 0],
  'rameldry-mill-bank': [0, 0, 0, 0, 0, 0],
  'langdyke-fife': [0, 0, 0, 0, 0, 0],
  'muirhead-freuchie': [0, 0, 0, 0, 0, 0],
  kennoway: [1, 0, 2, 0, 2, 0],
  bonnybank: [0, 0, 2, 0, 0, 0],
  'lundin-links': [3, 2, 3, 0, 0, 0],
  scoonie: [1, 0, 1, 0, 0, 0],
  'leven-fife': [5, 5, 4, 1, 2, 3],
  balcurvie: [1, 0, 0, 0, 0, 0],
  windygates: [1, 0, 0, 0, 0, 0],
  'milton-of-balgonie': [1, 0, 1, 0, 0, 0],
  markinch: [2, 1, 4, 1, 2, 1],
};

describe('Kingskettle-to-Markinch sequential audit certification', () => {
  it.each(requestedBatch)('%s passes the fail-closed full-audit gate', (slug) => {
    const pkg = loadPackage(slug);
    const report = loadReport(slug);
    expect(certifyFullTownAudit(pkg, report, publishedPlannerCurationForProject(pkg.project.id)).issues, pkg.project.name).toEqual([]);
  });

  it.each(requestedBatch)('%s publishes exactly its audited category counts', (slug) => {
    const pkg = loadPackage(slug);
    const counts = publishedAuditCounts(pkg, publishedPlannerCurationForProject(pkg.project.id));
    expect([counts.see, counts.eat, counts.trails, counts.picnic, counts.parking, counts.toilets], pkg.project.name).toEqual(expectedCounts[slug]);
  });

  it('maps only independently scoring 60+ towns while retaining every requested selector entry', () => {
    const packages = requestedBatch.map(loadPackage);
    expect(packages).toHaveLength(17);
    expect(homeTownOverviews(packages).map((town) => town.name)).toEqual(['Leven', 'Markinch', 'Lundin Links', 'Kennoway', 'Balmalcolm']);
    expect(packages.every((pkg) => Number.isFinite(pkg.project.touristAppeal?.score))).toBe(true);
    expect(packages.map((pkg) => pkg.project.touristAppeal?.score)).not.toContain(58);
  });

  it.each(requestedBatch)('%s retains all local HES/NRHE records and dates every visible map pin without changing its label', (slug) => {
    const pkg = loadPackage(slug);
    const heritage = pkg.features.filter((feature) => feature.tags.some((tag) => tag.startsWith('hes-') || tag === 'nrhe-record' || tag === 'nrhe-site'));
    const visible = heritage.filter((feature) => feature.evidenceScope !== 'related_context' && !feature.tags.includes('town-selection-heritage-buffer') && !feature.tags.includes('map-hidden'));
    expect(visible.every((feature) => Boolean(feature.documentedDateText) && feature.dateBasis !== 'unknown'), pkg.project.name).toBe(true);
    expect(visible.every((feature) => !hasAppendedHeritageDateInMapName(feature.name, feature.documentedDateText)), pkg.project.name).toBe(true);
  });

  it('records the complete local-data heritage reconciliation and a zero-broken-link check', () => {
    const heritage = JSON.parse(readFileSync(resolve('data/review/kingskettle-markinch-hes-date-certification-2026-09-02.json'), 'utf8'));
    expect(heritage.projects).toHaveLength(17);
    expect(heritage.totals).toMatchObject({ records: 1071, visiblePins: 497, visiblePinsWithoutDates: 0, visiblePinNamesContainingDate: 0 });
    const links = JSON.parse(readFileSync(resolve('data/review/kingskettle-markinch-link-check-2026-09-02.json'), 'utf8'));
    expect(links).toMatchObject({ checked: 62, broken: 0 });
    expect(links.trailLinks.broken).toBe(0);
  });
});

function loadReport(slug: string): FullTownAuditReport {
  return JSON.parse(readFileSync(resolve('data/review', `${slug}-full-visitor-audit-2026-09-02.json`), 'utf8')) as FullTownAuditReport;
}

function loadPackage(slug: string): ProjectPackage {
  const id = slug === 'leven-fife' ? 'leven-fife-scotland' : `${slug}-scotland`;
  const pkg = stAndrewsCoastPackages.find((candidate) => candidate.project.id === id);
  if (!pkg) throw new Error(`Missing package ${slug}`);
  return pkg;
}
