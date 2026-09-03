import { booleanPointInPolygon, point } from '@turf/turf';
import { describe, expect, it } from 'vitest';
import cambridgeshireSettlementManifest from '../../data/imports/cambridgeshire-settlements-2026-08-09.json';
import englandBroadVisitorReport from '../../data/review/england-broad-visitor-editorial-pass-2026-08-13.json';
import leicestershireSettlementManifest from '../../data/imports/leicestershire-settlements-2026-08-11.json';
import lincolnshireSettlementManifest from '../../data/imports/lincolnshire-settlements-2026-08-10.json';
import northamptonshireSettlementManifest from '../../data/imports/northamptonshire-settlements-2026-08-09.json';
import { sortPublishedPackages } from '../domain/projects';
import { ratingForProject, townRatingLabels } from '../domain/townRating';
import { touristAppealLabel } from '../domain/tourism';
import { topVisitPlaces } from '../domain/visiting';
import { publishedProjectPackages } from './publishedProjects';
import { publishedPlannerCurationForProject } from './visitorPlannerCuration';

describe('published project catalogue', () => {
  it('publishes the broad English visitor-attraction editorial pass', () => {
    const englishProjects = publishedProjectPackages.filter(
      (pkg) => pkg.project.countryCode === 'GB-ENG',
    );
    const projectsById = new Map(englishProjects.map((pkg) => [pkg.project.id, pkg]));
    const additions = englandBroadVisitorReport.changedTowns.flatMap((town) => town.additions);

    expect(englandBroadVisitorReport.totals.englishProjects).toBe(englishProjects.length);
    expect(englandBroadVisitorReport.totals.addedVisitorHighlights).toBe(additions.length);
    expect(additions.length).toBeGreaterThan(100);
    expect(additions.every((addition) => addition.visitorScore < 75)).toBe(true);

    for (const addition of additions) {
      expect(
        projectsById
          .get(addition.projectId)
          ?.project.visitorHighlights?.some(
            (highlight) => highlight.featureId === addition.featureId,
          ),
      ).toBe(true);
    }

    expect(new Set(additions.map((addition) => addition.category)).size).toBeGreaterThanOrEqual(9);
    expect(additions.map((addition) => addition.category)).toEqual(
      expect.arrayContaining([
        'active-and-adventure',
        'animal-and-family',
        'arts-and-entertainment',
        'beach-and-coast',
        'lake-and-waterside',
        'museum-and-gallery',
        'outdoor-and-nature',
        'water-activity',
        'viewpoint-and-landmark',
      ]),
    );
  });

  it('registers all published projects in country, region and town order', () => {
    const projects = sortPublishedPackages(publishedProjectPackages);
    const ids = projects.map((item) => item.project.id);
    expect(new Set(ids).size).toBe(ids.length);

    const normaliseName = (name: string) => name.trim().toLocaleLowerCase('en-GB');
    const localityCounts = new Map<string, number>();
    for (const item of projects) {
      const locality = normaliseName(item.project.locality);
      localityCounts.set(locality, (localityCounts.get(locality) ?? 0) + 1);
    }
    expect(northamptonshireSettlementManifest.settlements).toHaveLength(181);
    expect(
      northamptonshireSettlementManifest.settlements.filter(
        (locality) => !localityCounts.get(normaliseName(locality)),
      ),
    ).toEqual([]);
    expect(cambridgeshireSettlementManifest.settlements).toHaveLength(132);
    expect(
      cambridgeshireSettlementManifest.settlements.filter(
        (locality) => !localityCounts.get(normaliseName(locality)),
      ),
    ).toEqual([]);
    expect(lincolnshireSettlementManifest.settlements).toHaveLength(197);
    expect(
      lincolnshireSettlementManifest.settlements.filter(
        (locality) => !localityCounts.get(normaliseName(locality)),
      ),
    ).toEqual([]);
    expect(leicestershireSettlementManifest.settlements).toHaveLength(157);
    expect(
      leicestershireSettlementManifest.settlements.filter(
        (locality) => !localityCounts.get(normaliseName(locality)),
      ),
    ).toEqual([]);
    expect(
      projects.find((item) => item.project.id === 'culross-scotland')?.project.boundaryConfidence,
    ).toBe('high');
    expect(projects.find((item) => item.project.id === 'culross-scotland')?.project.centre).toEqual(
      [-3.629, 56.0558],
    );
    expect(
      projects.find((item) => item.project.id === 'kincardine-on-forth-scotland')?.project.centre,
    ).toEqual([-3.7188, 56.069]);
    expect(projects.find((item) => item.project.id === 'alva-scotland')?.project.centre).toEqual([
      -3.8005, 56.1538,
    ]);
  });

  it('publishes the Lincolnshire batch with collision-safe identities and documented boundaries', () => {
    const requested = new Set(
      lincolnshireSettlementManifest.settlements.map((locality) =>
        locality.trim().toLocaleLowerCase('en-GB'),
      ),
    );
    const lincolnshireRegions = new Set([
      'Lincolnshire',
      'North Lincolnshire',
      'North East Lincolnshire',
    ]);
    const projects = publishedProjectPackages.filter(
      (pkg) =>
        requested.has(pkg.project.locality.trim().toLocaleLowerCase('en-GB')) &&
        lincolnshireRegions.has(pkg.project.region ?? ''),
    );

    expect(projects).toHaveLength(197);
    expect(
      projects.filter(
        (pkg) =>
          !pkg.project.townStudyArea?.localityBoundary ||
          !pkg.project.townStudyArea?.sourceName ||
          !pkg.project.touristAppeal,
      ),
    ).toEqual([]);
    expect(
      projects.filter((pkg) => (pkg.project.visitorHighlights?.length ?? 0) > 20),
    ).toEqual([]);
    expect(projects.find((pkg) => pkg.project.locality === 'Alkborough')?.project.region).toBe(
      'North Lincolnshire',
    );
    expect(projects.find((pkg) => pkg.project.locality === 'Cleethorpes')?.project.region).toBe(
      'North East Lincolnshire',
    );
    expect(projects.find((pkg) => pkg.project.id === 'broughton-lincolnshire-england')).toBeDefined();
    expect(projects.find((pkg) => pkg.project.id === 'burwell-lincolnshire-england')).toBeDefined();
  });

  it('publishes the Cambridgeshire batch with conservative ratings and documented boundaries', () => {
    const requested = new Set(
      cambridgeshireSettlementManifest.settlements.map((locality) =>
        locality.trim().toLocaleLowerCase('en-GB'),
      ),
    );
    const projects = publishedProjectPackages.filter(
      (pkg) =>
        pkg.project.region === 'Cambridgeshire' &&
        requested.has(pkg.project.locality.trim().toLocaleLowerCase('en-GB')),
    );

    expect(projects).toHaveLength(132);
    expect(
      projects.filter(
        (pkg) =>
          !pkg.project.townStudyArea?.localityBoundary ||
          !pkg.project.townStudyArea?.sourceName ||
          !pkg.project.touristAppeal,
      ),
    ).toEqual([]);
    expect(
      projects.filter((pkg) => (pkg.project.visitorHighlights?.length ?? 0) > 20),
    ).toEqual([]);
    expect(
      projects.find((pkg) => pkg.project.locality === 'Cambridge')?.project.touristAppeal?.rating,
    ).toBe(3);
    expect(
      projects.find((pkg) => pkg.project.locality === 'Ely')?.project.touristAppeal?.rating,
    ).toBe(3);
    expect(
      projects.find((pkg) => pkg.project.locality === 'Abbots Ripton')?.project.touristAppeal
        ?.rating,
    ).toBe(0);
  });

  it('publishes the Leicestershire batch with county-safe identities and conservative ratings', () => {
    const requested = new Set(
      leicestershireSettlementManifest.settlements.map((locality) =>
        locality.trim().toLocaleLowerCase('en-GB'),
      ),
    );
    const projects = publishedProjectPackages.filter(
      (pkg) =>
        ['Leicestershire', 'City of Leicester'].includes(pkg.project.region ?? '') &&
        requested.has(pkg.project.locality.trim().toLocaleLowerCase('en-GB')),
    );

    expect(projects).toHaveLength(157);
    expect(
      projects.filter(
        (pkg) =>
          !pkg.project.townStudyArea?.localityBoundary ||
          !pkg.project.townStudyArea?.sourceName ||
          !pkg.project.touristAppeal,
      ),
    ).toEqual([]);
    expect(
      projects.filter((pkg) => (pkg.project.visitorHighlights?.length ?? 0) > 20),
    ).toEqual([]);
    expect(projects.find((pkg) => pkg.project.locality === 'Leicester')?.project.region).toBe(
      'City of Leicester',
    );
    expect(
      projects.find((pkg) => pkg.project.locality === 'Leicester')?.project.touristAppeal?.rating,
    ).toBe(3);
    expect(
      projects.find((pkg) => pkg.project.locality === 'Albert Village')?.project.touristAppeal
        ?.rating,
    ).toBe(0);
    expect(projects.find((pkg) => pkg.project.id === 'carlton-leicestershire-england')).toBeDefined();
    expect(
      projects.find((pkg) => pkg.project.id === 'carlton-leicestershire-england')?.project.centre[0],
    ).toBeLessThan(-1.3);
  });

  it('adds a tourist draw rating to every town dropdown label', () => {
    expect(publishedProjectPackages.every((item) => item.project.touristAppeal)).toBe(true);
    expect(
      publishedProjectPackages
        .map((item) => [item.project.id, touristAppealLabel(item.project)] as const)
        .filter(([id]) =>
          [
            'alva-scotland',
            'culross-scotland',
            'gourock-scotland',
            'linlithgow-scotland',
            'south-queensferry-scotland',
            'kirknewton-scotland',
            'kirriemuir-scotland',
            'quarriers-village-scotland',
            'tillicoultry-scotland',
            'torphichen-scotland',
            'bathgate-scotland',
            'broxburn-and-uphall-scotland',
            'bridge-of-earn-scotland',
            'dunning-scotland',
            'whitburn-scotland',
            'aberfoyle-scotland',
          ].includes(id),
        ),
    ).toEqual([
      ['aberfoyle-scotland', 'Aberfoyle ★★'],
      ['alva-scotland', 'Alva ★'],
      ['bathgate-scotland', 'Bathgate ★'],
      ['broxburn-and-uphall-scotland', 'Broxburn and Uphall ★'],
      ['bridge-of-earn-scotland', 'Bridge of Earn ⊘'],
      ['culross-scotland', 'Culross ★★'],
      ['dunning-scotland', 'Dunning ★'],
      ['gourock-scotland', 'Gourock ★'],
      ['kirknewton-scotland', 'Kirknewton ⊘'],
      ['kirriemuir-scotland', 'Kirriemuir ★'],
      ['linlithgow-scotland', 'Linlithgow ★★★'],
      ['south-queensferry-scotland', 'South Queensferry ★★'],
      ['torphichen-scotland', 'Torphichen ★'],
      ['tillicoultry-scotland', 'Tillicoultry ★'],
      ['whitburn-scotland', 'Whitburn ⊘'],
      ['quarriers-village-scotland', "Quarrier's Village ⊘"],
    ]);
  });

  it('derives every published town rating from the shared attraction-led policy', () => {
    const failures = publishedProjectPackages.flatMap((pkg) => {
      if (pkg.project.touristAppeal?.score !== undefined) return [];
      const rating = ratingForProject(
        pkg,
        publishedPlannerCurationForProject(pkg.project.id),
      );
      return pkg.project.touristAppeal?.rating === rating &&
        pkg.project.touristAppeal.label === townRatingLabels[rating]
        ? []
        : [pkg.project.id];
    });
    expect(failures).toEqual([]);
  });

  it('keeps town highlights inside while allowing explicit Home-only discoveries outside', () => {
    const failures: string[] = [];
    for (const pkg of publishedProjectPackages) {
      const featuresById = new Map(pkg.features.map((feature) => [feature.id, feature]));
      const activeVisitorBoundary =
        pkg.project.townStudyArea?.visitorBoundary ?? pkg.project.boundary;
      for (const highlight of pkg.project.visitorHighlights ?? []) {
        const feature = featuresById.get(highlight.featureId);
        const inside =
          feature?.geometry?.type === 'Point' &&
          booleanPointInPolygon(point(feature.geometry.coordinates), activeVisitorBoundary);
        const homeOnly = feature?.tags.includes('home-standalone-place') ?? false;
        if (homeOnly && inside) {
          failures.push(
            `${pkg.project.locality}: Home-only place is inside town (${highlight.featureId})`,
          );
        } else if (!homeOnly && !inside) {
          failures.push(`${pkg.project.locality}: ${highlight.name} (${highlight.featureId})`);
        }
      }
    }

    expect(failures).toEqual([]);
  });

  it('presents every published attraction through the current guide format', () => {
    const attractions = publishedProjectPackages.flatMap((pkg) => topVisitPlaces(pkg, 20));

    expect(attractions.length).toBeGreaterThan(100);
    expect(
      attractions.filter(
        (place) =>
          !place.attractionGuide?.intro ||
          !place.attractionGuide.bestFor?.length,
      ),
    ).toEqual([]);
    expect(
      attractions.find((place) => place.name === 'Peterborough Cathedral')?.attractionGuide
        ?.thingsToDo,
    ).toHaveLength(5);
  });

  it('gives every English attraction card a complete and honest visitor contract', () => {
    const failures: string[] = [];
    const englishPackages = publishedProjectPackages.filter(
      (pkg) => pkg.project.countryCode === 'GB-ENG',
    );

    for (const pkg of englishPackages) {
      for (const place of topVisitPlaces(pkg, 20)) {
        const prefix = `${pkg.project.locality}: ${place.name}`;
        if (!place.timeToSpend || /5\s*(?:-|to)\s*20 minutes/i.test(place.timeToSpend)) {
          failures.push(`${prefix} has an invalid visit duration`);
        }
        if (!place.openingTimes) failures.push(`${prefix} has no opening status`);
        if (!place.admission) failures.push(`${prefix} has no admission status`);
        if (!place.dogAccess) failures.push(`${prefix} has no dog-policy status`);
        if (!place.attractionGuide?.parking) failures.push(`${prefix} has no parking status`);
        if (!place.attractionGuide?.toilets) failures.push(`${prefix} has no toilet status`);
        if (!place.attractionGuide?.picnic) failures.push(`${prefix} has no picnic status`);
        if (!place.attractionGuide?.food?.length && !place.attractionGuide?.foodNote) {
          failures.push(`${prefix} has no café or food status`);
        }
      }
    }

    expect(englishPackages.length).toBeGreaterThan(500);
    expect(failures).toEqual([]);
  });
});
