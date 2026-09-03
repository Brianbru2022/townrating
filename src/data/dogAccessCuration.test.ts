import { describe, expect, it } from 'vitest';
import { publishedProjectPackages } from './publishedProjects';
import {
  dogAccessReviewedAt,
  publishedDogAccess,
  publishedDogAccessForPlace,
} from './dogAccessCuration';
import { publishedPlannerCurationForProject } from './visitorPlannerCuration';
import { topFoodAndDrink, visitPlaceFromFeature } from '../domain/visitorExperience';
import { topVisitPlaces } from '../domain/visiting';

describe('published dog-access curation', () => {
  it('covers every published attraction and curated food stop', () => {
    let attractionCount = 0;
    let foodCount = 0;
    for (const projectPackage of publishedProjectPackages) {
      const projectId = projectPackage.project.id;
      for (const highlight of projectPackage.project.visitorHighlights ?? []) {
        attractionCount += 1;
        expect(
          publishedDogAccessForPlace(projectId, 'attraction', highlight.featureId),
          `${projectId}:${highlight.featureId}`,
        ).toBeDefined();
      }
      for (const featureId of publishedPlannerCurationForProject(projectId).eat ?? []) {
        foodCount += 1;
        expect(
          publishedDogAccessForPlace(projectId, 'eat', featureId),
          `${projectId}:${featureId}`,
        ).toBeDefined();
      }
    }

    expect(attractionCount).toBeGreaterThanOrEqual(112);
    expect(foodCount).toBeGreaterThanOrEqual(131);
  });

  it('uses complete 0-3 ratings and explains every zero', () => {
    const allEntries = Object.values(publishedDogAccess).flatMap((project) => [
      ...Object.values(project.attraction ?? {}),
      ...Object.values(project.eat ?? {}),
    ]);

    expect(dogAccessReviewedAt).toBe('2026-08-11');
    expect(allEntries.length).toBeGreaterThanOrEqual(243);
    for (const entry of allEntries) {
      expect(Number.isInteger(entry.rating)).toBe(true);
      expect(entry.rating).toBeGreaterThanOrEqual(0);
      expect(entry.rating).toBeLessThanOrEqual(3);
      expect(entry.label.trim()).not.toBe('');
      expect(entry.summary.trim()).not.toBe('');
      expect(Date.parse(entry.reviewedAt)).toBeLessThanOrEqual(Date.parse(dogAccessReviewedAt));
      if (entry.rating === 0) {
        expect(['not-allowed', 'unconfirmed']).toContain(entry.status);
      } else {
        expect(['welcoming', 'restricted']).toContain(entry.status);
      }
    }
  });

  it('does not treat a generic mapped dog permission as a three-paw venue audit', () => {
    const mappedFoodEntries = Object.values(publishedDogAccess).flatMap((project) =>
      Object.values(project.eat ?? {}).filter(
        (entry) =>
          entry.rating > 0 &&
          (entry.sourceName?.toLocaleLowerCase().includes('openstreetmap') ||
            entry.sourceUrl?.includes('openstreetmap.org')),
      ),
    );

    expect(mappedFoodEntries.length).toBeGreaterThan(0);
    for (const entry of mappedFoodEntries) {
      expect(entry.rating).toBeLessThanOrEqual(2);
    }
  });

  it('records confirmed operator restrictions separately from an unconfirmed policy', () => {
    expect(publishedDogAccessForPlace('alloa-scotland', 'attraction', 'nrhe:320380')).toMatchObject({
      rating: 1,
      status: 'restricted',
      label: 'Limited dog access',
    });
    expect(publishedDogAccessForPlace('culross-scotland', 'attraction', 'nrhe:48021')).toMatchObject({
      rating: 0,
      status: 'not-allowed',
      label: 'Pet dogs not admitted',
    });
    expect(
      publishedDogAccessForPlace('kirriemuir-scotland', 'attraction', 'osm-community:way-548034712'),
    ).toMatchObject({
      rating: 0,
      status: 'unconfirmed',
      label: 'Dog policy not confirmed',
    });
  });

  it('surfaces paw data through attraction and food visit places', () => {
    const callander = publishedProjectPackages.find(
      (projectPackage) => projectPackage.project.id === 'callander-scotland',
    );
    const kirriemuir = publishedProjectPackages.find(
      (projectPackage) => projectPackage.project.id === 'kirriemuir-scotland',
    );
    expect(callander).toBeDefined();
    expect(kirriemuir).toBeDefined();
    if (!callander || !kirriemuir) return;

    expect(topFoodAndDrink(callander, 50).find((place) => place.name === 'Pips Coffee House'))
      .toMatchObject({ dogFriendly: true, dogAccess: { rating: 3 } });
    expect(topVisitPlaces(kirriemuir, 20).find((place) => place.name === 'Kirriemuir Den'))
      .toMatchObject({ dogFriendly: true, dogAccess: { rating: 3 } });

    const birthplace = kirriemuir.features.find(
      (feature) => feature.id === 'osm-community:way-548034712',
    );
    expect(birthplace).toBeDefined();
    if (birthplace) {
      expect(visitPlaceFromFeature(birthplace)).toMatchObject({
        dogFriendly: false,
        dogAccess: { rating: 0, status: 'unconfirmed' },
      });
    }
  });
});
