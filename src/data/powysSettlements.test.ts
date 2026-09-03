import { booleanPointInPolygon, point } from '@turf/turf';
import { describe, expect, it } from 'vitest';
import dogAccessCuration from '../../data/dog-access-curation.json';
import powysSettlementManifest from '../../data/imports/powys-settlements-2026-08-12.json';
import plannerCuration from '../../data/visitor-planner-curation.json';
import type { PlannerCurationState } from '../domain/plannerCuration';
import { ratingForProject } from '../domain/townRating';
import { powysSettlementPackages } from './powysSettlements.generated';
import { publishedProjectPackages } from './publishedProjects';

const normaliseName = (name: string) => name.trim().toLocaleLowerCase('en-GB');

describe('Powys settlement batch', () => {
  it('publishes the complete audited OSM city, town and village inventory once', () => {
    const requested = powysSettlementManifest.settlements.map(normaliseName);
    const inventoried = powysSettlementManifest.inventory.map((item) => normaliseName(item.locality));
    const published = powysSettlementPackages.map((pkg) => normaliseName(pkg.project.locality));
    const registered = publishedProjectPackages.filter(
      (pkg) => pkg.project.countryCode === 'GB-WLS' && pkg.project.region === 'Powys',
    );

    expect(powysSettlementManifest.counts).toEqual({ city: 0, town: 15, village: 183 });
    expect(requested).toHaveLength(198);
    expect(new Set(requested).size).toBe(198);
    expect(inventoried).toEqual(requested);
    expect(powysSettlementPackages).toHaveLength(198);
    expect(registered).toHaveLength(198);
    expect(new Set(published)).toEqual(new Set(requested));
    expect(
      powysSettlementPackages.filter(
        (pkg) =>
          pkg.project.countryCode !== 'GB-WLS' ||
          pkg.project.country !== 'Wales' ||
          pkg.project.region !== 'Powys' ||
          !pkg.project.id.endsWith('-powys-wales') ||
          !pkg.project.townStudyArea?.sourceName ||
          !pkg.project.townStudyArea.localityBoundary ||
          !pkg.project.townStudyArea.visitorBoundary,
      ),
    ).toEqual([]);
  });

  it('keeps map centres, OSM inventory centres and public point features inside active boundaries', () => {
    const inventory = new Map(
      powysSettlementManifest.inventory.map((item) => [normaliseName(item.locality), item]),
    );
    const failures: string[] = [];

    for (const pkg of powysSettlementPackages) {
      const locality = pkg.project.locality;
      const boundary = pkg.project.townStudyArea?.visitorBoundary ?? pkg.project.boundary;
      const inventoryItem = inventory.get(normaliseName(locality));
      if (!inventoryItem) {
        failures.push(`${locality}: missing OSM inventory record`);
        continue;
      }

      if (!booleanPointInPolygon(point(pkg.project.centre), boundary)) {
        failures.push(`${locality}: map centre is outside the active boundary`);
      }
      if (!booleanPointInPolygon(point(inventoryItem.centre), boundary)) {
        failures.push(`${locality}: audited OSM settlement centre is outside the active boundary`);
      }
      if (pkg.project.centre[0] !== inventoryItem.centre[0] || pkg.project.centre[1] !== inventoryItem.centre[1]) {
        failures.push(`${locality}: map centre differs from the audited OSM inventory centre`);
      }
      if ((pkg.project.visitorHighlights?.length ?? 0) > 20) {
        failures.push(`${locality}: more than 20 visitor highlights`);
      }

      for (const feature of pkg.features) {
        if (
          feature.geometry?.type === 'Point' &&
          !booleanPointInPolygon(point(feature.geometry.coordinates), boundary)
        ) {
          failures.push(`${locality}: ${feature.id} is outside the active boundary`);
        }
      }
    }

    expect(failures).toEqual([]);
  });

  it('ships resolved planner and dog-access curation for every Powys project', () => {
    const plannerProjects = plannerCuration.projects as Record<string, PlannerCurationState>;
    const dogProjects = dogAccessCuration.projects as Record<string, unknown>;
    const failures: string[] = [];

    for (const pkg of powysSettlementPackages) {
      const curation = plannerProjects[pkg.project.id];
      const featureIds = new Set(pkg.features.map((feature) => feature.id));
      if (!curation) {
        failures.push(`${pkg.project.locality}: missing planner curation`);
        continue;
      }
      if (!dogProjects[pkg.project.id]) failures.push(`${pkg.project.locality}: missing dog curation`);
      if ((curation.eat?.length ?? 0) > 20) failures.push(`${pkg.project.locality}: more than 20 Eat places`);

      for (const [need, ids] of Object.entries(curation)) {
        for (const id of ids ?? []) {
          if (!featureIds.has(id)) failures.push(`${pkg.project.locality}: unresolved ${need} ID ${id}`);
        }
      }
    }

    expect(failures).toEqual([]);
  });

  it('has no duplicate public food names or cross-town attraction owners', () => {
    const plannerProjects = plannerCuration.projects as Record<string, PlannerCurationState>;
    const foodFailures: string[] = [];
    const attractionOwners = new Map<string, string[]>();

    for (const pkg of powysSettlementPackages) {
      const featureById = new Map(pkg.features.map((feature) => [feature.id, feature]));
      const names = (plannerProjects[pkg.project.id]?.eat ?? [])
        .map((featureId) => featureById.get(featureId)?.name)
        .filter((name): name is string => Boolean(name))
        .map(normaliseName);
      const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
      if (duplicates.length > 0) {
        foodFailures.push(`${pkg.project.locality}: ${[...new Set(duplicates)].join(', ')}`);
      }

      for (const highlight of pkg.project.visitorHighlights ?? []) {
        attractionOwners.set(highlight.featureId, [
          ...(attractionOwners.get(highlight.featureId) ?? []),
          pkg.project.locality,
        ]);
      }
    }

    expect(foodFailures).toEqual([]);
    expect([...attractionOwners.entries()].filter(([, towns]) => towns.length > 1)).toEqual([]);
  });

  it('applies the strict destination rating from attractions and genuine trails only', () => {
    const plannerProjects = plannerCuration.projects as Record<string, PlannerCurationState>;
    const mismatches = powysSettlementPackages.filter(
      (pkg) =>
        ratingForProject(pkg, plannerProjects[pkg.project.id] ?? {}) !==
        pkg.project.touristAppeal?.rating,
    );
    const ratings = powysSettlementPackages.map((pkg) => pkg.project.touristAppeal?.rating);

    expect(mismatches).toEqual([]);
    expect(ratings.filter((rating) => rating === 0)).toHaveLength(187);
    expect(ratings.filter((rating) => rating === 1)).toHaveLength(11);
    expect(ratings.filter((rating) => rating === 2)).toHaveLength(0);
    expect(ratings.filter((rating) => rating === 3)).toHaveLength(0);
  });

  it('imports Welsh heritage evidence and defensible dates for the heat map', () => {
    const heritage = powysSettlementPackages.flatMap((pkg) =>
      pkg.features.filter((feature) => feature.tags.includes('welsh-heritage')),
    );
    const dated = heritage.filter(
      (feature) =>
        typeof feature.earliestPossibleYear === 'number' &&
        typeof feature.latestPossibleYear === 'number',
    );

    expect(heritage.length).toBeGreaterThan(6_000);
    expect(dated.length).toBeGreaterThan(3_500);
    expect(
      heritage.some((feature) =>
        feature.sourceRecords.some((source) => source.sourceOrganisation === 'Cadw'),
      ),
    ).toBe(true);
    expect(
      dated.some((feature) =>
        feature.sourceRecords.some((source) => source.sourceOrganisation.includes('Royal Commission')),
      ),
    ).toBe(true);
  });

  it('preserves statistical provenance while documenting required settlement-centre extensions', () => {
    const centreEnvelopeLocalities = [
      'Abermule',
      'Churchstoke',
      'Coelbren',
      'Llangors',
      'Llangynidr',
      'Llanyre',
      'Pontrobert',
    ];

    for (const locality of centreEnvelopeLocalities) {
      const pkg = powysSettlementPackages.find((item) => item.project.locality === locality)!;
      const studyArea = pkg.project.townStudyArea!;
      expect(studyArea.localityBoundary, locality).toBeDefined();
      expect(studyArea.visitorBoundary, locality).toBeDefined();
      expect(studyArea.notes, locality).toContain('audited OSM settlement centre');
      expect(booleanPointInPolygon(point(pkg.project.centre), studyArea.visitorBoundary!), locality).toBe(true);
    }

    const llanwrtydWells = powysSettlementPackages.find(
      (item) => item.project.locality === 'Llanwrtyd Wells',
    )!;
    expect(llanwrtydWells.project.townStudyArea?.notes).toContain('Dolwen Fields');
    expect(llanwrtydWells.project.townStudyArea?.notes).not.toContain(
      'audited OSM settlement centre',
    );
  });

  it('retains the verified Brecon parking tariffs and official sources', () => {
    const brecon = powysSettlementPackages.find((pkg) => pkg.project.locality === 'Brecon')!;
    const theatre = brecon.features.find((feature) => feature.name === 'Theatr Brycheiniog Car Park')!;
    const canalRoad = brecon.features.find((feature) => feature.name === 'Canal Road Pay And Display')!;
    const sourceNotes = (feature: typeof theatre) => feature.sourceRecords.map((source) => source.notes).join(' ');

    expect(sourceNotes(theatre)).toContain('up to 10 minutes free');
    expect(sourceNotes(theatre)).toContain('RingGo 9129');
    expect(
      theatre.sourceRecords.some((source) => source.sourceUrl?.includes('brycheiniog.co.uk')),
    ).toBe(true);
    expect(sourceNotes(canalRoad)).toContain('up to 1 hour £1.50');
    expect(sourceNotes(canalRoad)).toContain('overnight £0');
    expect(canalRoad.sourceRecords.some((source) => source.sourceOrganisation === 'Powys County Council')).toBe(true);
  });
});
