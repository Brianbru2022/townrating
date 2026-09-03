import { describe, expect, it } from 'vitest';
import type { ProjectPackage } from '../domain/models';
import { publishedProjectPackages } from './publishedProjects';
import {
  publishedPlannerCuration,
  publishedPlannerCurationForProject,
} from './visitorPlannerCuration';

describe('published visitor planner curation', () => {
  it('loads the bundled planner curation library', () => {
    expect(publishedPlannerCuration).toEqual(expect.any(Object));
    expect(publishedPlannerCurationForProject('missing-project')).toEqual({});
  });

  it('ships Kirriemuir curation for public planner map categories', () => {
    const kirriemuir = publishedPlannerCurationForProject('kirriemuir-scotland');
    expect(kirriemuir.see).toBeUndefined();
    expect(kirriemuir.eat).toHaveLength(8);
    expect(kirriemuir.picnic).toEqual([
      'osm-community:node-2050736820',
      'osm-community:node-13264886749',
      'osm-picnic-rest:way-1427531356',
      'osm-picnic-rest:node-5301037632',
      'osm-picnic-rest:node-12164098251',
    ]);
    expect(kirriemuir.parking).toHaveLength(4);
    expect(kirriemuir.toilets).toEqual([
      'osm-community:node-5893732663',
      'osm-community:way-548880054',
      'osm-community:way-1314221838',
    ]);
    expect(kirriemuir.trails).toEqual([
      'curated-trail:kirriemuir-explorer',
      'curated-trail:kirriemuir-path-network',
    ]);
  });

  it('ships South Queensferry curation for food and practical planning', () => {
    const queensferry = publishedPlannerCurationForProject('south-queensferry-scotland');
    expect(queensferry.see).toBeUndefined();
    expect(queensferry.eat).toHaveLength(13);
    expect(queensferry.eat).toEqual(expect.arrayContaining([
      'osm-community:node-2158074189',
      'osm-community:node-12046519297',
      'osm-community:node-1529914813',
      'osm-community:node-4006159812',
      'osm-community:node-6017919651',
      'hes-listed-building:LB40354',
      'curated-food:south-queensferry-ferry-tap',
      'osm-community:node-2661485246',
      'osm-community:node-2661485248',
      'curated-food:south-queensferry-thirty-knots',
      'curated-food:south-queensferry-little-parlour',
      'osm-community:way-1083846163',
    ]));
    expect(new Set(queensferry.parking)).toEqual(new Set([
      'osm-community:way-102686798',
      'osm-community:way-260629261',
      'osm-community:way-435121560',
      'osm-community:way-52709832',
    ]));
    expect(queensferry.toilets).toEqual([
      'osm-community:node-10300195913',
      'osm-community:node-13088892512',
      'osm-community:node-14003506933',
      'osm-community:node-9932295752',
    ]);
    expect(queensferry.picnic).toEqual([
      'osm-community:node-7609664976',
      'osm-community:node-10764563863',
      'osm-picnic-rest:node-7609664983',
      'osm-picnic-rest:node-10764563858',
      'osm-picnic-rest:node-11206120856',
    ]);
    expect(queensferry.trails).toEqual([
      'osm-community:node-10557250203',
      'curated-trail:south-queensferry-treasure-trail',
      'curated-trail:south-queensferry-heritage-trail',
    ]);
  });

  it('ships Gourock curation and keeps empty categories explicitly empty', () => {
    const gourock = publishedPlannerCurationForProject('gourock-scotland');
    expect(gourock.see).toBeUndefined();
    expect(gourock.eat).toHaveLength(10);
    expect(gourock.eat).toEqual(expect.arrayContaining([
      'curated-food:gourock-1830-eatery',
      'curated-food:gourock-wildfire-cafe',
      'osm-community:node-4496387418',
      'osm-community:node-5646287019',
      'osm-community:node-7077369812',
      'curated-food:gourock-cafe-continental',
      'curated-food:gourock-wildfire-deli',
      'osm-community:node-4496406700',
      'osm-community:node-5646287020',
      'curated-food:gourock-spinnaker-hotel-restaurant',
    ]));
    expect(gourock.parking).toEqual([
      'curated-parking:gourock-kempock-street-car-park',
      'osm-community:way-151830522',
      'curated-parking:gourock-station-road-south',
      'curated-parking:gourock-cove-road-car-park',
      'osm-community:way-761321869',
    ]);
    expect(gourock.toilets).toEqual(['osm-community:way-287572002', 'osm-community:way-539300535']);
    expect(gourock.picnic).toEqual([
      'osm-picnic-rest:node-13307930252',
      'osm-picnic-rest:node-10220529266',
    ]);
    expect(gourock.trails).toEqual(['curated-trail:gourock-circuit']);
  });

  it("ships Quarrier's Village curation as a compact heritage stop", () => {
    const quarriers = publishedPlannerCurationForProject('quarriers-village-scotland');
    expect(quarriers.see).toBeUndefined();
    expect(quarriers.eat).toEqual(['curated-food:quarriers-village-three-sisters-bake']);
    expect(quarriers.parking).toEqual(['curated-parking:quarriers-village-faith-avenue']);
    expect(quarriers.toilets).toEqual([]);
    expect(quarriers.picnic).toEqual([]);
    expect(quarriers.trails).toEqual([
      'curated-visitor:quarriers-village-heritage-walk',
      'curated-trail:quarriers-village-treasure-trail',
    ]);
  });

  it('caps curated discovery categories at twenty places', () => {
    for (const curation of Object.values(publishedPlannerCuration)) {
      expect(curation.see?.length ?? 0).toBeLessThanOrEqual(20);
      expect(curation.eat?.length ?? 0).toBeLessThanOrEqual(20);
    }
  });

  it('keeps curated practical stops location-specific for public visitor display', () => {
    const packagesById = new Map<string, ProjectPackage>(
      publishedProjectPackages.map((pkg) => [pkg.project.id, pkg]),
    );
    const genericPracticalName =
      /^(public toilets|toilets|parking|car park|picnic site|picnic table)$/i;

    for (const [projectId, curation] of Object.entries(publishedPlannerCuration)) {
      const pkg = packagesById.get(projectId);
      if (!pkg) continue;
      const featuresById = new Map(pkg.features.map((feature) => [feature.id, feature]));

      for (const need of ['parking', 'toilets', 'picnic'] as const) {
        const names = new Set<string>();
        for (const featureId of curation[need] ?? []) {
          const feature = featuresById.get(featureId);
          expect(feature, `${projectId} ${need} ${featureId}`).toBeDefined();
          expect(feature?.name, `${projectId} ${need} ${featureId}`).not.toMatch(
            genericPracticalName,
          );
          const normalisedName = feature?.name.toLowerCase();
          expect(
            normalisedName ? names.has(normalisedName) : false,
            `${projectId} ${need} duplicate name ${feature?.name}`,
          ).toBe(false);
          if (normalisedName) names.add(normalisedName);
        }
      }
    }
  });
});
