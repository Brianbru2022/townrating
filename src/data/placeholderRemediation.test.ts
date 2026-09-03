import { describe, expect, it } from 'vitest';
import aboyneAudit from '../../data/review/aboyne-full-visitor-audit-2026-09-02.json';
import alfordAudit from '../../data/review/alford-aberdeenshire-full-visitor-audit-2026-09-02.json';
import dinnetAudit from '../../data/review/dinnet-full-visitor-audit-2026-09-02.json';
import finzeanAudit from '../../data/review/finzean-full-visitor-audit-2026-09-02.json';
import kincardineAudit from '../../data/review/kincardine-oneil-full-visitor-audit-2026-09-02.json';
import lumphananAudit from '../../data/review/lumphanan-full-visitor-audit-2026-09-02.json';
import newtonhillAudit from '../../data/review/newtonhill-full-visitor-audit-2026-09-02.json';
import quarriersAudit from '../../data/review/quarriers-village-full-visitor-audit-2026-09-02.json';
import tarlandAudit from '../../data/review/tarland-full-visitor-audit-2026-09-02.json';
import torphinsAudit from '../../data/review/torphins-full-visitor-audit-2026-09-02.json';
import aberdeenPlanner from '../../data/aberdeen-north-visitor-planner-curation.json';
import generalPlanner from '../../data/visitor-planner-curation.json';
import type { PlannerCurationState } from '../domain/plannerCuration';
import {
  certifyFullTownAudit,
  type FullTownAuditReport,
} from '../domain/townAuditCertification';
import { homeTownOverviews } from '../map/homeOverview';
import { visitorNeedPlaces } from '../domain/visitorExperience';
import { publishedProjectPackages } from './publishedProjects';

const audits = [
  alfordAudit,
  tarlandAudit,
  torphinsAudit,
  aboyneAudit,
  kincardineAudit,
  newtonhillAudit,
  quarriersAudit,
  dinnetAudit,
  finzeanAudit,
  lumphananAudit,
] as Array<FullTownAuditReport & { projectId: string }>;

function curationFor(projectId: string): PlannerCurationState {
  const libraries = [aberdeenPlanner, generalPlanner] as Array<{
    projects: Record<string, PlannerCurationState>;
  }>;
  return libraries.find((library) => library.projects[projectId])?.projects[projectId] ?? {};
}

describe('2026-09-02 placeholder-score remediation', () => {
  it.each(audits)('certifies $place against what the live guide actually publishes', (audit) => {
    const pkg = publishedProjectPackages.find((candidate) => candidate.project.id === audit.projectId);
    expect(pkg).toBeDefined();
    expect(certifyFullTownAudit(pkg!, audit, curationFor(audit.projectId)).issues).toEqual([]);
  });

  it('includes every 60+ catalogue project in the home-map town dataset', () => {
    const expected = publishedProjectPackages
      .filter((pkg) => (pkg.project.touristAppeal?.score ?? 0) >= 60)
      .map((pkg) => pkg.project.id)
      .sort();
    expect(homeTownOverviews(publishedProjectPackages).map((town) => town.id).sort()).toEqual(expected);
  });

  it('replaces the three non-58 score placeholders identified by the database scan', () => {
    const auditedIds = new Set(['dinnet-scotland', 'finzean-scotland', 'lumphanan-scotland']);
    const pending = publishedProjectPackages.filter((pkg) =>
      auditedIds.has(pkg.project.id) &&
      /(?:held below publication pending|pending (?:a|any) full (?:destination )?audit)/i.test(
        JSON.stringify({
          touristAppeal: pkg.project.touristAppeal,
          townGuide: pkg.project.townGuide,
          researchNotes: pkg.project.researchNotes,
        }),
      ));
    expect(pending.map((pkg) => pkg.project.name)).toEqual([]);
  });

  it('publishes Finzean’s connected farm-shop café at its real reviewed coordinates', () => {
    const pkg = publishedProjectPackages.find((candidate) => candidate.project.id === 'finzean-scotland')!;
    const curation = curationFor(pkg.project.id);
    expect(visitorNeedPlaces(pkg, 'eat', 10, { curatedFeatureIds: curation.eat })).toHaveLength(1);
    expect(pkg.features.find((feature) => feature.id === 'curated-food:finzean-farm-shop')).toMatchObject({
      evidenceScope: 'related_context',
      geometry: { type: 'Point', coordinates: [-2.6527824, 57.0261269] },
    });
  });

  it('corrects Dinnet Bridge and exposes every Lumphanan HES record with honest date metadata', () => {
    const dinnet = publishedProjectPackages.find((candidate) => candidate.project.id === 'dinnet-scotland')!;
    expect(dinnet.features.find((feature) => feature.id === 'hes-listed-building:LB50735')).toMatchObject({
      documentedDateText: '1935',
      earliestPossibleYear: 1935,
      latestPossibleYear: 1935,
      dateBasis: 'documented_construction',
    });

    const lumphanan = publishedProjectPackages.find((candidate) => candidate.project.id === 'lumphanan-scotland')!;
    const statutory = lumphanan.features.filter((feature) =>
      feature.tags.some((tag) => ['hes-listed-building', 'hes-scheduled-monument'].includes(tag)));
    expect(statutory).toHaveLength(8);
    expect(statutory.every((feature) =>
      !feature.tags.includes('map-hidden') &&
      Boolean(feature.documentedDateText) &&
      feature.dateBasis !== 'unknown' &&
      !feature.name.includes(feature.documentedDateText!),
    )).toBe(true);
    expect(statutory.find((feature) => feature.id === 'hes-listed-building:LB9278')?.dateConfidence).toBe('low');
    expect(statutory.find((feature) => feature.id === 'hes-listed-building:LB9280')?.dateConfidence).toBe('low');
  });
});
