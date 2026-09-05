import { describe, expect, it } from 'vitest';
import { carseGowriePackages } from './carseGowrie';
import { publishedDogAccessForPlace } from './dogAccessCuration';
import { publishedAttractionScore } from '../domain/editorialResearch';
import { townScoreBand } from '../domain/tourism';

describe('Elcho sequential visitor audit', () => {
  const pkg = carseGowriePackages[0]!;
  const highlight = pkg.project.visitorHighlights?.[0]!;

  it('keeps the guide scoped to Elcho Castle and its official visitor evidence', () => {
    expect(pkg.project.id).toBe('elcho-perthshire-scotland');
    expect(pkg.features.map((feature) => feature.id)).toEqual(['hes-scheduled-monument:SM90140']);
    expect(highlight.name).toBe('Elcho Castle');
    expect(highlight.attractionGuide?.parking).toMatch(/visitor/i);
    expect(highlight.attractionGuide?.toilets).toMatch(/toilet/i);
    expect(highlight.attractionGuide?.foodNote).toMatch(/No separately assessed/i);
  });

  it('uses a reproducible attraction score and conservative settlement band', () => {
    expect(publishedAttractionScore(highlight, pkg.features[0])).toBe(85);
    expect(townScoreBand(pkg.project.touristAppeal?.score ?? -1)).toMatchObject({
      label: 'Notable Stop',
      rating: 0,
    });
  });

  it('publishes the researched restricted dog policy', () => {
    expect(publishedDogAccessForPlace(pkg.project.id, 'attraction', highlight.featureId)).toMatchObject({
      status: 'restricted',
      rating: 1,
      label: 'Assistance dogs only',
    });
  });

  it('retains Ballindean heritage without converting private premises into a visitor offer', () => {
    const ballindean = carseGowriePackages.find((candidate) => candidate.project.id === 'ballindean-scotland')!;
    expect(ballindean.project.visitorHighlights).toBeUndefined();
    expect(ballindean.features[0]?.reviewNotes).toMatch(/not promoted/i);
    expect(ballindean.project.touristAppeal?.score).toBe(34);
  });
});
