import { describe, expect, it } from 'vitest';
import type { ProjectPackage } from './models';
import type { PlannerCurationState } from './plannerCuration';
import {
  certifyFullTownAudit,
  hasAppendedHeritageDateInMapName,
  type FullTownAuditReport,
} from './townAuditCertification';

const polygon = {
  type: 'Polygon' as const,
  coordinates: [[[-3, 56], [-2, 56], [-2, 57], [-3, 57], [-3, 56]]],
};

function fixture(): ProjectPackage {
  return {
    project: {
      id: 'audit-fixture',
      name: 'Audit fixture',
      countryCode: 'GB-SCT',
      region: 'Fife',
      locality: 'Audit fixture',
      boundary: polygon,
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
      sources: [],
      touristAppeal: {
        score: 58,
        rating: 0,
        label: 'Limited Visitor Interest',
        summary: 'Fixture score.',
        methodVersion: 'test',
        reviewedAt: '2026-09-01',
        sourceUrls: ['https://example.com/'],
      },
    },
    features: [],
    validation: [],
  } as unknown as ProjectPackage;
}

function report(): FullTownAuditReport {
  return {
    reviewedAt: '2026-09-01T00:00:00.000Z',
    place: 'Audit fixture',
    townScore: 58,
    mapPublished: false,
    categories: {
      see: { audited: true, published: 0 },
      eat: { audited: true, published: 0 },
      trails: {
        audited: true,
        published: 0,
        providerChecks: {
          TreasureTrails: 'No result',
          CuriousAbout: 'No result',
          MysteryGuides: 'No result',
          GoQuestAdventures: 'No result',
          officialRoutes: 'No result',
        },
      },
      picnic: { audited: true, published: 0 },
      parking: { audited: true, published: 0 },
      toilets: { audited: true, published: 0 },
    },
    hes: { assigned: 0, visibleDated: 0, visibleUndated: 0, missing: 0 },
    research: {
      currentWebResearch: true,
      strictBoundaryChecked: true,
      sourceChecks: [{
        url: 'https://example.com/',
        checkedAt: '2026-09-01',
        outcome: 'verified',
        note: 'Current source checked.',
      }],
    },
    scoreReanalysis: {
      required: true,
      completed: true,
      resultScore: 58,
      rationale: 'Second pass confirms the score.',
    },
    certification: {
      publicationCountsReconciled: true,
      liveBrowserVerifiedAt: '2026-09-01T12:00:00.000Z',
    },
  };
}

describe('full town-audit certification', () => {
  it('does not mistake an historic period in the official name for appended date text', () => {
    expect(hasAppendedHeritageDateInMapName('Keithock, Roman camp N of East Mains', 'Roman')).toBe(false);
    expect(hasAppendedHeritageDateInMapName('Keithock Camp — Roman', 'Roman')).toBe(true);
    expect(hasAppendedHeritageDateInMapName('Keithock Camp (Roman)', 'Roman')).toBe(true);
  });

  it('passes only when the report, published selectors, sources and live check agree', () => {
    expect(certifyFullTownAudit(fixture(), report(), {} as PlannerCurationState).issues).toEqual([]);
  });

  it('fails a claimed published category that the real selector suppresses', () => {
    const badReport = report();
    badReport.categories!.see!.published = 1;
    expect(certifyFullTownAudit(fixture(), badReport, {}).issues).toContain(
      'see report count 1 does not match published count 0',
    );
  });

  it('fails an exact 58 without its documented second pass', () => {
    const badReport = report();
    delete badReport.scoreReanalysis;
    expect(certifyFullTownAudit(fixture(), badReport, {}).issues).toContain(
      'exact score 58 lacks a completed documented second pass',
    );
  });
});
