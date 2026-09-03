import { booleanPointInPolygon, point } from '@turf/turf';
import { describe, expect, it } from 'vitest';
import dogAccessCuration from '../../data/dog-access-curation.json';
import gwyneddSettlementManifest from '../../data/imports/gwynedd-settlements-2026-08-11.json';
import plannerCuration from '../../data/visitor-planner-curation.json';
import { gwyneddSettlementPackages } from './gwyneddSettlements.generated';
import { publishedProjectPackages } from './publishedProjects';

const normaliseName = (name: string) => name.trim().toLocaleLowerCase('en-GB');

describe('Gwynedd settlement batch', () => {
  it('publishes every requested settlement once with Welsh identities and documented boundaries', () => {
    const requested = gwyneddSettlementManifest.settlements.map(normaliseName);
    const published = gwyneddSettlementPackages.map((pkg) => normaliseName(pkg.project.locality));
    const registered = publishedProjectPackages.filter(
      (pkg) => pkg.project.countryCode === 'GB-WLS' && pkg.project.region === 'Gwynedd',
    );

    expect(requested).toHaveLength(102);
    expect(new Set(requested).size).toBe(102);
    expect(gwyneddSettlementPackages).toHaveLength(102);
    expect(registered).toHaveLength(102);
    expect(new Set(published)).toEqual(new Set(requested));
    expect(
      gwyneddSettlementPackages.filter(
        (pkg) =>
          pkg.project.countryCode !== 'GB-WLS' ||
          pkg.project.country !== 'Wales' ||
          pkg.project.region !== 'Gwynedd' ||
          !pkg.project.id.endsWith('-gwynedd-wales') ||
          !pkg.project.townStudyArea?.sourceName ||
          !pkg.project.townStudyArea.localityBoundary ||
          !pkg.project.townStudyArea.visitorBoundary,
      ),
    ).toEqual([]);
  });

  it('keeps generated visitor content inside active boundaries and within public list limits', () => {
    const failures: string[] = [];

    for (const pkg of gwyneddSettlementPackages) {
      const boundary = pkg.project.townStudyArea?.visitorBoundary ?? pkg.project.boundary;
      if ((pkg.project.visitorHighlights?.length ?? 0) > 20) {
        failures.push(`${pkg.project.locality}: more than 20 visitor highlights`);
      }

      for (const feature of pkg.features) {
        const geometry = feature.geometry;
        if (
          geometry?.type === 'Point' &&
          !booleanPointInPolygon(point(geometry.coordinates), boundary)
        ) {
          failures.push(`${pkg.project.locality}: ${feature.id} is outside the active boundary`);
        }
      }
    }

    expect(failures).toEqual([]);
  });

  it('ships planner and dog-access curation entries for every Gwynedd project', () => {
    const projectIds = gwyneddSettlementPackages.map((pkg) => pkg.project.id);
    const plannerProjects = plannerCuration.projects as Record<string, unknown>;
    const dogProjects = dogAccessCuration.projects as Record<string, unknown>;

    expect(projectIds.filter((id) => !plannerProjects[id])).toEqual([]);
    expect(projectIds.filter((id) => !dogProjects[id])).toEqual([]);
  });

  it('does not expose duplicate public food names within a town', () => {
    const plannerProjects = plannerCuration.projects as Record<string, { eat?: string[] }>;
    const failures: string[] = [];

    for (const pkg of gwyneddSettlementPackages) {
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
    const heritage = gwyneddSettlementPackages.flatMap((pkg) =>
      pkg.features.filter((feature) => feature.tags.includes('welsh-heritage')),
    );
    const dated = heritage.filter(
      (feature) =>
        typeof feature.earliestPossibleYear === 'number' &&
        typeof feature.latestPossibleYear === 'number',
    );

    expect(heritage.length).toBeGreaterThan(4_000);
    expect(dated.length).toBeGreaterThan(2_000);
    expect(
      heritage.some((feature) =>
        feature.sourceRecords.some(
          (source) => source.sourceOrganisation === 'Cadw',
        ),
      ),
    ).toBe(true);
    expect(
      dated.some((feature) =>
        feature.sourceRecords.some((source) =>
          source.sourceOrganisation.includes('Royal Commission'),
        ),
      ),
    ).toBe(true);
  });

  it('uses the real Porthdinllaen coastal cluster rather than the similarly named campsite', () => {
    const porthdinllaen = gwyneddSettlementPackages.find(
      (pkg) => pkg.project.id === 'porthdinllaen-gwynedd-wales',
    );

    expect(porthdinllaen).toBeDefined();
    expect(porthdinllaen?.project.centre).toEqual([-4.56725, 52.944]);
    expect(porthdinllaen?.project.townStudyArea?.sourceName).toContain(
      'Curated visitor envelope',
    );
    expect(porthdinllaen?.features.length).toBeGreaterThanOrEqual(5);
    expect(porthdinllaen?.features.some((feature) => feature.name === 'Trwyn Porth Dinllaen')).toBe(
      true,
    );
  });

  it('uses the reviewed Dinas Dinlle village extent and official Marine toilet identity', () => {
    const dinasDinlle = gwyneddSettlementPackages.find(
      (pkg) => pkg.project.id === 'dinas-dinlle-gwynedd-wales',
    );
    const marineToilets = dinasDinlle?.features.find(
      (feature) => feature.name === 'Marine public toilets',
    );

    expect(dinasDinlle?.project.centre).toEqual([-4.3340739, 53.0845173]);
    expect(dinasDinlle?.project.townStudyArea?.sourceName).toContain(
      'OpenStreetMap settlement point',
    );
    expect(marineToilets).toBeDefined();
    expect(
      marineToilets?.sourceRecords.some(
        (source) => source.sourceOrganisation === 'Cyngor Gwynedd',
      ),
    ).toBe(true);
  });

  it('preserves the Aberdyfi settlement envelope while including both official public toilets', () => {
    const aberdyfi = gwyneddSettlementPackages.find(
      (pkg) => pkg.project.id === 'aberdyfi-gwynedd-wales',
    );
    const studyArea = aberdyfi?.project.townStudyArea;
    const neuaddDyfiPoint = point([-4.045011, 52.5436004]);
    const toiletNames = aberdyfi?.features
      .filter((feature) => feature.tags.includes('service-context-toilets'))
      .map((feature) => feature.name);

    expect(studyArea?.sourceName).toContain('Neuadd Dyfi public-facilities extension');
    expect(booleanPointInPolygon(neuaddDyfiPoint, studyArea!.localityBoundary!)).toBe(false);
    expect(booleanPointInPolygon(neuaddDyfiPoint, studyArea!.visitorBoundary!)).toBe(true);
    expect(toiletNames).toEqual(
      expect.arrayContaining([
        'Aberdyfi quay public toilets',
        'Neuadd Dyfi public toilets',
      ]),
    );
  });

  it('preserves the Morfa Bychan ONS boundary while including its official beach facilities', () => {
    const morfaBychan = gwyneddSettlementPackages.find(
      (pkg) => pkg.project.id === 'morfa-bychan-gwynedd-wales',
    );
    const studyArea = morfaBychan?.project.townStudyArea;
    const beachToiletPoint = point([-4.1877812, 52.9127381]);
    const toiletNames = morfaBychan?.features
      .filter((feature) => feature.tags.includes('service-context-toilets'))
      .map((feature) => feature.name);

    expect(studyArea?.sourceName).toContain('Morfa Bychan beach visitor extension');
    expect(booleanPointInPolygon(beachToiletPoint, studyArea!.localityBoundary!)).toBe(false);
    expect(booleanPointInPolygon(beachToiletPoint, studyArea!.visitorBoundary!)).toBe(true);
    expect(toiletNames).toEqual(
      expect.arrayContaining([
        'Gwydryn public toilets',
        'Morfa Bychan beach public toilets',
      ]),
    );
  });
});
