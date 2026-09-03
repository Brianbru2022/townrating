import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function json(path: string) {
  return JSON.parse(readFileSync(resolve(path), 'utf8'));
}

const listed = json('data/review/aberdeen-rated-towns-listed-buildings-2026-08-28.json');
const scheduled = json('data/review/aberdeen-rated-towns-scheduled-monuments-2026-08-28.json');
const settlements = json('data/review/aberdeen-rated-settlement-independence-audit-2026-08-28.json');

const expectedListed: Record<string, number> = {
  'monymusk.json': 30,
  'kemnay.json': 11,
  'kintore.json': 8,
  'bridge-of-don-aberdeen.json': 38,
  'old-aberdeen.json': 164,
  'aberdeen.json': 544,
  'torry-aberdeen.json': 37,
  'cove-bay.json': 18,
  'peterculter.json': 10,
};

describe('rated Aberdeen-area HES and settlement independence audit', () => {
  it('matches every listed-building reference in each strict visitor boundary', () => {
    expect(listed.projects).toBe(9);
    expect(listed.statutoryDesignationsAssigned).toBe(845);
    expect(listed.missingStatutoryDesignations).toBe(0);
    expect(listed.undatedVisiblePins).toBe(0);
    expect(Object.fromEntries(listed.projectsDetail.map((item: any) => [item.file, item.expectedHesDesignations])))
      .toEqual(expectedListed);
  });

  it('restores every intersecting scheduled monument with a construction or use period', () => {
    const byFile = new Map<string, any>(scheduled.projects.map((item: any) => [item.file, item]));
    expect(byFile.get('monymusk.json')?.expectedScheduledMonuments).toEqual(['SM12008']);
    expect(byFile.get('kintore.json')?.expectedScheduledMonuments).toEqual([
      'SM12465', 'SM3958', 'SM50', 'SM76', 'SM7674',
    ]);
    expect(byFile.get('old-aberdeen.json')?.expectedScheduledMonuments).toEqual(['SM1907', 'SM90001']);
    expect(byFile.get('torry-aberdeen.json')?.expectedScheduledMonuments).toEqual([
      'SM10400', 'SM10403', 'SM4055', 'SM9215',
    ]);
    expect(scheduled.projects.every((item: any) => item.missing.length === 0 && item.undated.length === 0)).toBe(true);
  });

  it('records a settlement-only reason for every retained 60+ map score', () => {
    expect(settlements.results).toHaveLength(9);
    expect(settlements.results.every((item: any) =>
      item.decision === 'retain_on_map' &&
      item.score >= 60 &&
      item.dogOwnerScore <= item.score &&
      item.settlementIndependentEvidence.length >= 3 &&
      item.rationale.length > 30,
    )).toBe(true);
  });
});
