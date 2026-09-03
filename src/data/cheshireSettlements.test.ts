import { booleanPointInPolygon, point } from '@turf/turf';
import { describe, expect, it } from 'vitest';
import dogAccessCuration from '../../data/dog-access-curation.json';
import cheshireSettlementManifest from '../../data/imports/cheshire-settlements-2026-08-12.json';
import plannerCuration from '../../data/visitor-planner-curation.json';
import type { PlannerCurationState } from '../domain/plannerCuration';
import { ratingForProject } from '../domain/townRating';
import { publishedProjectPackages } from './publishedProjects';
import { cheshireSettlementPackages } from './cheshireSettlements.generated';

const normaliseName = (name: string) => name.trim().toLocaleLowerCase('en-GB');
const authorities = new Set(['Cheshire East', 'Cheshire West and Chester', 'Halton', 'Warrington']);

describe('Cheshire settlement batch', () => {
  it('publishes the complete audited OSM city, town and village inventory once', () => {
    const requested = cheshireSettlementManifest.settlements.map(normaliseName);
    const inventoried = cheshireSettlementManifest.inventory.map((item) => normaliseName(item.locality));
    const published = cheshireSettlementPackages.map((pkg) => normaliseName(pkg.project.locality));
    const registered = publishedProjectPackages.filter(
      (pkg) => pkg.project.countryCode === 'GB-ENG' && authorities.has(pkg.project.region ?? ''),
    );

    expect(cheshireSettlementManifest.counts.city + cheshireSettlementManifest.counts.town + cheshireSettlementManifest.counts.village).toBe(requested.length);
    expect(cheshireSettlementManifest.inventory.every((item) => authorities.has(item.authority))).toBe(true);
    expect(requested.length).toBeGreaterThan(100);
    expect(new Set(requested).size).toBe(requested.length);
    expect(inventoried).toEqual(requested);
    expect(cheshireSettlementPackages).toHaveLength(requested.length);
    expect(registered).toHaveLength(requested.length);
    expect(new Set(published)).toEqual(new Set(requested));
    expect(cheshireSettlementPackages.filter((pkg) =>
      pkg.project.countryCode !== 'GB-ENG'
      || pkg.project.country !== 'England'
      || !authorities.has(pkg.project.region ?? '')
      || !pkg.project.id.endsWith('-cheshire-england')
      || !pkg.project.townStudyArea?.sourceName
      || !pkg.project.townStudyArea.localityBoundary
      || !pkg.project.townStudyArea.visitorBoundary
    )).toEqual([]);
  });

  it('keeps audited centres and all public point features inside active visitor boundaries', () => {
    const inventory = new Map(
      cheshireSettlementManifest.inventory.map((item) => [normaliseName(item.locality), item]),
    );
    const failures: string[] = [];

    for (const pkg of cheshireSettlementPackages) {
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
        failures.push(`${locality}: OSM settlement centre is outside the active boundary`);
      }
      if (pkg.project.centre[0] !== inventoryItem.centre[0] || pkg.project.centre[1] !== inventoryItem.centre[1]) {
        failures.push(`${locality}: map centre differs from the audited OSM centre`);
      }
      for (const feature of pkg.features) {
        if (feature.geometry?.type === 'Point' && !booleanPointInPolygon(point(feature.geometry.coordinates), boundary)) {
          failures.push(`${locality}: ${feature.id} is outside the active boundary`);
        }
      }
    }

    expect(failures).toEqual([]);
  });

  it('ships resolved capped visitor lists and uncapped practical curation', () => {
    const plannerProjects = plannerCuration.projects as Record<string, PlannerCurationState>;
    const dogProjects = dogAccessCuration.projects as Record<string, {
      attraction?: Record<string, { rating?: number }>;
      eat?: Record<string, { rating?: number }>;
    }>;
    const failures: string[] = [];

    for (const pkg of cheshireSettlementPackages) {
      const curation = plannerProjects[pkg.project.id];
      const featureIds = new Set(pkg.features.map((feature) => feature.id));
      if (!curation) {
        failures.push(`${pkg.project.locality}: missing planner curation`);
        continue;
      }
      if ((pkg.project.visitorHighlights?.length ?? 0) > 20) failures.push(`${pkg.project.locality}: more than 20 See places`);
      if ((curation.eat?.length ?? 0) > 20) failures.push(`${pkg.project.locality}: more than 20 Eat places`);
      for (const [need, ids] of Object.entries(curation)) {
        for (const id of ids ?? []) {
          if (!featureIds.has(id)) failures.push(`${pkg.project.locality}: unresolved ${need} ID ${id}`);
        }
      }
      const dogs = dogProjects[pkg.project.id];
      if (!dogs) failures.push(`${pkg.project.locality}: missing dog-access curation`);
      for (const entry of Object.values({ ...dogs?.attraction, ...dogs?.eat })) {
        if (!Number.isInteger(entry.rating) || (entry.rating ?? -1) < 0 || (entry.rating ?? 4) > 3) {
          failures.push(`${pkg.project.locality}: invalid dog-access rating`);
        }
      }
    }

    expect(failures).toEqual([]);
  });

  it('does not publish zoo enclosures or individual animals as standalone attractions', () => {
    const failures = cheshireSettlementPackages.flatMap((pkg) =>
      (pkg.project.visitorHighlights ?? []).flatMap((highlight) => {
        const feature = pkg.features.find((item) => item.id === highlight.featureId);
        const sourceText = feature?.sourceRecords.map((record) => record.notes ?? '').join(' ') ?? '';
        return /(?:^|[;\s])(?:attraction=animal|zoo=enclosure|animal=|species=)/i.test(sourceText)
          ? [`${pkg.project.locality}: ${feature?.name ?? highlight.featureId}`]
          : [];
      }),
    );

    expect(failures).toEqual([]);
  });

  it('uses meaningful public practical names and excludes customer-only parking', () => {
    const plannerProjects = plannerCuration.projects as Record<string, PlannerCurationState>;
    const failures: string[] = [];

    for (const pkg of cheshireSettlementPackages) {
      const byId = new Map(pkg.features.map((feature) => [feature.id, feature]));
      for (const id of plannerProjects[pkg.project.id]?.parking ?? []) {
        const feature = byId.get(id);
        if (!feature) continue;
        if (/^(parking|car park)$/i.test(feature.name)) failures.push(`${pkg.project.locality}: generic parking name`);
        const text = `${feature.shortDescription ?? ''} ${feature.sourceRecords.map((item) => item.notes ?? '').join(' ')}`;
        if (/customers? only|staff only|residents? only/i.test(text)) failures.push(`${pkg.project.locality}: restricted parking published`);
      }
      for (const id of plannerProjects[pkg.project.id]?.toilets ?? []) {
        if (/^public toilets?$/i.test(byId.get(id)?.name ?? '')) failures.push(`${pkg.project.locality}: generic toilet name`);
      }
      for (const id of plannerProjects[pkg.project.id]?.picnic ?? []) {
        if (/^(picnic site|picnic table)$/i.test(byId.get(id)?.name ?? '')) failures.push(`${pkg.project.locality}: generic picnic name`);
      }
    }

    expect(failures).toEqual([]);
  });

  it('orders rated trails and attributes non-OSM trail research to its real publisher', () => {
    const plannerProjects = plannerCuration.projects as Record<string, PlannerCurationState>;
    const failures: string[] = [];

    for (const pkg of cheshireSettlementPackages) {
      const byId = new Map(pkg.features.map((feature) => [feature.id, feature]));
      const trails = (plannerProjects[pkg.project.id]?.trails ?? []).map((id) => byId.get(id)).filter(Boolean);
      const scores = trails.map((feature) => {
        const notes = feature?.sourceRecords.map((record) => record.notes ?? '').join('; ') ?? '';
        return Number(notes.match(/(?:^|;\s*)trail_score=(\d+)/)?.[1]
          ?? feature?.tags.find((tag) => tag.startsWith('trail-score:'))?.split(':')[1]
          ?? 0);
      });
      if (scores.some((score, index) => index > 0 && score > scores[index - 1])) failures.push(`${pkg.project.locality}: trails are not score ordered`);
      for (const feature of trails) {
        const publishedSource = feature?.sourceRecords.find((record) => /treasuretrails\.co\.uk|cheshireeast\.gov\.uk|cheshirewestandchester\.gov\.uk|warrington\.gov\.uk|halton\.gov\.uk|visitcheshire\.com/.test(record.sourceUrl ?? ''))
          ?? feature?.sourceRecords[0];
        const external = publishedSource?.sourceUrl ?? '';
        if (/treasuretrails\.co\.uk/.test(external) && publishedSource?.sourceOrganisation !== 'Treasure Trails') {
          failures.push(`${pkg.project.locality}: Treasure Trail has incorrect attribution`);
        }
        if (/cheshireeast\.gov\.uk/.test(external) && publishedSource?.sourceOrganisation !== 'Cheshire East Council') {
          failures.push(`${pkg.project.locality}: Cheshire East trail has incorrect attribution`);
        }
        if (/cheshirewestandchester\.gov\.uk/.test(external) && publishedSource?.sourceOrganisation !== 'Cheshire West and Chester Council') {
          failures.push(`${pkg.project.locality}: Cheshire West trail has incorrect attribution`);
        }
        if (/warrington\.gov\.uk/.test(external) && publishedSource?.sourceOrganisation !== 'Warrington Borough Council') {
          failures.push(`${pkg.project.locality}: Warrington trail has incorrect attribution`);
        }
        if (/halton\.gov\.uk/.test(external) && publishedSource?.sourceOrganisation !== 'Halton Borough Council') {
          failures.push(`${pkg.project.locality}: Halton trail has incorrect attribution`);
        }
      }
    }

    expect(failures).toEqual([]);
  });

  it('applies the strict destination rating from attractions and genuine trails only', () => {
    const plannerProjects = plannerCuration.projects as Record<string, PlannerCurationState>;
    expect(cheshireSettlementPackages.filter((pkg) =>
      pkg.project.touristAppeal?.score === undefined &&
      ratingForProject(pkg, plannerProjects[pkg.project.id] ?? {}) !== pkg.project.touristAppeal?.rating
    )).toEqual([]);
    expect(cheshireSettlementPackages.every((pkg) => [0, 1, 2, 3].includes(pkg.project.touristAppeal?.rating ?? -1))).toBe(true);
  });

  it('preserves original boundary and Historic England provenance', () => {
    const boundaryFailures = cheshireSettlementPackages.filter((pkg) =>
      !pkg.project.townStudyArea?.localityBoundary
      || !pkg.project.townStudyArea.visitorBoundary
      || !pkg.project.townStudyArea.sourceName
      || !pkg.project.townStudyArea.sourceUrl
    );
    const heritage = cheshireSettlementPackages.flatMap((pkg) =>
      pkg.features.filter((feature) => feature.tags.includes('nhle')),
    );

    expect(boundaryFailures).toEqual([]);
    expect(heritage.length).toBeGreaterThan(0);
    expect(heritage.every((feature) => feature.sourceRecords.some((record) =>
      record.sourceOrganisation === 'Historic England' && /historicengland\.org\.uk/.test(record.sourceUrl ?? '')
    ))).toBe(true);
  });
});
