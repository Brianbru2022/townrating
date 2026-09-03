import { describe, expect, it } from 'vitest';
import treasureTrailsAudit from '../../data/review/online-town-trail-audit.json';
import trailSourceRegistry from '../../data/trail-source-registry.json';
import { publishedProjectPackages } from './publishedProjects';

describe('online town trail audit', () => {
  it('checks the full provider catalogue and records every published town', () => {
    expect(treasureTrailsAudit.schemaVersion).toBe(3);
    expect(treasureTrailsAudit.catalogue.productCount).toBeGreaterThan(1_000);
    expect(treasureTrailsAudit.catalogue.pages.length).toBeGreaterThan(1);
    expect(
      treasureTrailsAudit.summary.webSearchesCompleted
        + treasureTrailsAudit.summary.webSearchesPartial
        + treasureTrailsAudit.summary.webSearchesFailed
        + treasureTrailsAudit.summary.webSearchesNotRun,
    ).toBe(treasureTrailsAudit.summary.townCount);
    expect(treasureTrailsAudit.towns.map((town) => town.projectId).sort()).toEqual(
      publishedProjectPackages.map((pkg) => pkg.project.id).sort(),
    );
  });

  it('tracks verified council and heritage routes beyond Treasure Trails', () => {
    expect(trailSourceRegistry.trails.length).toBeGreaterThanOrEqual(5);
    expect(new Set(trailSourceRegistry.trails.map((trail) => trail.provider)).size).toBeGreaterThan(1);
    expect(treasureTrailsAudit.summary.verifiedNonTreasureSources).toBeGreaterThanOrEqual(5);
    for (const trail of trailSourceRegistry.trails) {
      expect(trail.url).not.toContain('treasuretrails.co.uk');
      expect(trail.boundaryStatus).toBe('confirmed_in_active_boundary');
    }
  });

  it('keeps non-Treasure sources as the majority of the shipped trail library', () => {
    const sources = treasureTrailsAudit.summary.curatedTrailSources;

    expect(sources.total).toBeGreaterThan(100);
    expect(sources.officialCivicOrWalkingProvider + sources.openStreetMapOnly)
      .toBeGreaterThan(sources.treasureTrails);
    expect(sources.missingSource).toBe(0);
    expect(sources.unresolved).toBe(0);
  });

  it('records a place-specific live web search without treating results as approved trails', () => {
    for (const town of treasureTrailsAudit.towns) {
      expect(town.webSearch.query).toContain(town.locality);
      expect(['completed', 'partial', 'failed', 'not_run']).toContain(town.webSearch.status);
      expect(town.webSearch.queries.length).toBeGreaterThanOrEqual(4);
      if (town.webSearch.status !== 'not_run') {
        expect(town.webSearch.queryResults).toHaveLength(town.webSearch.queries.length);
      }
      for (const candidate of town.webSearch.results as Array<{
        url: string;
        title: string;
        sourceTier: string;
      }>) {
        expect(candidate.url).toMatch(/^https?:\/\//);
        expect(candidate.title.length).toBeGreaterThan(0);
        expect([
          'official_or_destination',
          'established_route_provider',
          'other_discovery',
        ]).toContain(candidate.sourceTier);
      }
    }
  });

  it('records exact catalogue candidates without treating them as boundary-approved', () => {
    const candidates = treasureTrailsAudit.towns.flatMap((town) => town.candidates);
    expect(candidates.length).toBeGreaterThan(50);
    for (const candidate of candidates) {
      expect(candidate.url).toMatch(/^https:\/\/www\.treasuretrails\.co\.uk\/products\//);
      expect(candidate.title.length).toBeGreaterThan(0);
      expect(['exact_town_title', 'multi_place_title']).toContain(candidate.matchKind);
    }
  });

  it('rejects a wider-web result that names a different town', () => {
    const buckden = treasureTrailsAudit.towns.find((town) => town.projectId === 'buckden-england');

    expect(buckden).toBeDefined();
    expect(buckden?.webSearch.results).toEqual([]);
  });

  it('requires boundary review before publishing a newly discovered route', () => {
    for (const town of treasureTrailsAudit.towns) {
      if (town.status !== 'catalogue_match_requires_boundary_review') continue;
      expect(town.candidates.some((candidate) => !candidate.alreadyCurated)).toBe(true);
      expect(town.widerWebQueries.length).toBeGreaterThanOrEqual(4);
    }
  });
});
