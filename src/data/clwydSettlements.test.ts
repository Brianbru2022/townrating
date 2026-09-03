import { booleanPointInPolygon, point } from '@turf/turf';
import { describe, expect, it } from 'vitest';
import dogAccessCuration from '../../data/dog-access-curation.json';
import clwydSettlementManifest from '../../data/imports/clwyd-settlements-2026-08-11.json';
import plannerCuration from '../../data/visitor-planner-curation.json';
import { clwydSettlementPackages } from './clwydSettlements.generated';
import { publishedProjectPackages } from './publishedProjects';

const normaliseName = (name: string) => name.trim().toLocaleLowerCase('en-GB');

describe('Clwyd settlement batch', () => {
  it('publishes every requested settlement once with Welsh identities and documented boundaries', () => {
    const requested = clwydSettlementManifest.settlements.map(normaliseName);
    const published = clwydSettlementPackages.map((pkg) => normaliseName(pkg.project.locality));
    const registered = publishedProjectPackages.filter(
      (pkg) => pkg.project.countryCode === 'GB-WLS' && pkg.project.region === 'Clwyd',
    );

    expect(requested).toHaveLength(144);
    expect(new Set(requested).size).toBe(144);
    expect(clwydSettlementPackages).toHaveLength(144);
    expect(registered).toHaveLength(144);
    expect(new Set(published)).toEqual(new Set(requested));
    expect(
      clwydSettlementPackages.filter(
        (pkg) =>
          pkg.project.countryCode !== 'GB-WLS' ||
          pkg.project.country !== 'Wales' ||
          pkg.project.region !== 'Clwyd' ||
          !pkg.project.id.endsWith('-clwyd-wales') ||
          !pkg.project.townStudyArea?.sourceName ||
          !pkg.project.townStudyArea.localityBoundary ||
          !pkg.project.townStudyArea.visitorBoundary,
      ),
    ).toEqual([]);
  });

  it('keeps generated visitor content inside active boundaries and within public list limits', () => {
    const failures: string[] = [];

    for (const pkg of clwydSettlementPackages) {
      const boundary = pkg.project.townStudyArea?.visitorBoundary ?? pkg.project.boundary;
      if ((pkg.project.visitorHighlights?.length ?? 0) > 20) {
        failures.push(`${pkg.project.locality}: more than 20 visitor highlights`);
      }

      for (const feature of pkg.features) {
        if (
          feature.geometry?.type === 'Point' &&
          !booleanPointInPolygon(point(feature.geometry.coordinates), boundary)
        ) {
          failures.push(`${pkg.project.locality}: ${feature.id} is outside the active boundary`);
        }
      }
    }

    expect(failures).toEqual([]);
  });

  it('ships planner and dog-access curation entries for every Clwyd project', () => {
    const projectIds = clwydSettlementPackages.map((pkg) => pkg.project.id);
    const plannerProjects = plannerCuration.projects as Record<string, unknown>;
    const dogProjects = dogAccessCuration.projects as Record<string, unknown>;

    expect(projectIds.filter((id) => !plannerProjects[id])).toEqual([]);
    expect(projectIds.filter((id) => !dogProjects[id])).toEqual([]);
  });

  it('does not expose duplicate public food names within a town', () => {
    const plannerProjects = plannerCuration.projects as Record<string, { eat?: string[] }>;
    const failures: string[] = [];

    for (const pkg of clwydSettlementPackages) {
      const featureById = new Map(pkg.features.map((feature) => [feature.id, feature]));
      const names = (plannerProjects[pkg.project.id]?.eat ?? [])
        .map((featureId) => featureById.get(featureId)?.name)
        .filter((name): name is string => Boolean(name))
        .map(normaliseName);
      const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
      if (duplicates.length > 0) failures.push(`${pkg.project.locality}: ${[...new Set(duplicates)].join(', ')}`);
    }

    expect(failures).toEqual([]);
  });

  it('imports the bundled Welsh heritage records and defensible period dates', () => {
    const heritage = clwydSettlementPackages.flatMap((pkg) =>
      pkg.features.filter((feature) => feature.tags.includes('welsh-heritage')),
    );
    const dated = heritage.filter(
      (feature) =>
        typeof feature.earliestPossibleYear === 'number' &&
        typeof feature.latestPossibleYear === 'number',
    );

    expect(heritage.length).toBeGreaterThan(5_000);
    expect(dated.length).toBeGreaterThan(3_000);
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

  it('keeps automated town ratings conservative under the strict destination scale', () => {
    const ratings = clwydSettlementPackages.map((pkg) => pkg.project.touristAppeal?.rating ?? -1);

    expect(ratings.filter((rating) => rating === 0)).toHaveLength(119);
    expect(ratings.filter((rating) => rating === 1)).toHaveLength(20);
    expect(ratings.filter((rating) => rating === 2)).toHaveLength(3);
    expect(ratings.filter((rating) => rating === 3)).toHaveLength(2);
    expect(
      clwydSettlementPackages
        .filter((pkg) => pkg.project.touristAppeal?.rating === 2)
        .map((pkg) => pkg.project.locality)
        .sort(),
    ).toEqual(['Denbigh', 'Llangollen', 'Ruthin']);
    expect(
      clwydSettlementPackages
        .filter((pkg) => pkg.project.touristAppeal?.rating === 3)
        .map((pkg) => pkg.project.locality)
        .sort(),
    ).toEqual(['Conwy', 'Llandudno']);
  });

  it('keeps every namesake settlement inside the Clwyd working extent', () => {
    const byLocality = new Map(clwydSettlementPackages.map((pkg) => [pkg.project.locality, pkg]));

    for (const pkg of clwydSettlementPackages) {
      expect(pkg.project.centre[0], pkg.project.locality).toBeGreaterThanOrEqual(-4.15);
      expect(pkg.project.centre[0], pkg.project.locality).toBeLessThanOrEqual(-2.75);
      expect(pkg.project.centre[1], pkg.project.locality).toBeGreaterThanOrEqual(52.75);
      expect(pkg.project.centre[1], pkg.project.locality).toBeLessThanOrEqual(53.42);
    }

    expect(byLocality.get('Cwm')?.project.centre[0]).toBeCloseTo(-3.41, 2);
    expect(byLocality.get('Cwm')?.project.centre[1]).toBeCloseTo(53.28, 2);
    expect(byLocality.get('Llanfynydd')?.project.centre[0]).toBeCloseTo(-3.08, 2);
    expect(byLocality.get('Llanfynydd')?.project.centre[1]).toBeCloseTo(53.1, 2);
    expect(byLocality.get('Llangwm')?.project.centre[0]).toBeCloseTo(-3.54, 2);
    expect(byLocality.get('Llangwm')?.project.centre[1]).toBeCloseTo(52.99, 2);
  });

  it('assigns overlapping visitor attractions to only one town', () => {
    const owners = new Map<string, string[]>();
    for (const pkg of clwydSettlementPackages) {
      for (const highlight of pkg.project.visitorHighlights ?? []) {
        owners.set(highlight.featureId, [...(owners.get(highlight.featureId) ?? []), pkg.project.locality]);
      }
    }

    expect([...owners.entries()].filter(([, towns]) => towns.length > 1)).toEqual([]);
  });

  it('retains researched anchors without duplicate records from the same visitor site', () => {
    const byLocality = new Map(clwydSettlementPackages.map((pkg) => [pkg.project.locality, pkg]));
    const highlights = (locality: string) => byLocality.get(locality)?.project.visitorHighlights ?? [];

    expect(highlights('Llangollen').find((item) => item.name === 'Llangollen Railway')).toMatchObject({
      visitorScore: 89,
      sourceUrl: 'https://llangollen-railway.co.uk/',
    });
    expect(highlights('Flint').find((item) => /Flint/i.test(item.name) && /Castell|Castle/i.test(item.name))).toMatchObject({
      visitorScore: 84,
      sourceUrl: 'https://cadw.gov.wales/visit/places-to-visit/flint-castle',
    });
    expect(highlights('Wrexham').filter((item) => /Xplore!/i.test(item.name))).toHaveLength(1);
    expect(highlights('Bodelwyddan').filter((item) => /Bodelwyddan Castle/i.test(item.name))).toHaveLength(1);
    expect(highlights('Conwy').slice(0, 5).map((item) => [item.name, item.visitorScore])).toEqual([
      ['Conwy Castle', 94],
      ['Conwy Town Walls', 90],
      ['Plas Mawr', 87],
      ['Aberconwy House', 82],
      ['The Smallest House in Great Britain', 78],
    ]);
    expect(highlights('Llandudno').slice(0, 5).map((item) => [item.name, item.visitorScore])).toEqual([
      ['Great Orme Visitor Centre', 90],
      ['Great Orme Tramway', 89],
      ['Great Orme Bronze Age Mines', 88],
      ['Llandudno Pier', 87],
      ['Llandudno Museum', 78],
    ]);
  });

  it('preserves Rhuddlan locality provenance while using the curated visitor boundary', () => {
    const rhuddlan = clwydSettlementPackages.find((pkg) => pkg.project.locality === 'Rhuddlan')!;

    expect(rhuddlan.project.townStudyArea?.sourceName).toContain('ONS Built-up Areas');
    expect(rhuddlan.project.townStudyArea?.localityBoundary).toBeDefined();
    expect(rhuddlan.project.townStudyArea?.visitorBoundary).toBeDefined();
    expect(rhuddlan.project.boundary.properties?.visitorBoundary).toBe(true);
  });
});
