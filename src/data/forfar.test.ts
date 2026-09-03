import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import audit from '../../data/review/forfar-full-visitor-audit-2026-08-29.json';
import { describe, expect, it } from 'vitest';
import { topFoodAndDrink } from '../domain/visitorExperience';
import { topVisitPlaces } from '../domain/visiting';
import { cairnOMountPackages } from './cairnOMount';
import { publishedDogAccessForPlace } from './dogAccessCuration';
import { publishedPlannerCurationForProject } from './visitorPlannerCuration';

const pkg = cairnOMountPackages.find((candidate) => candidate.project.id === 'forfar-scotland')!;

describe('Forfar full visitor audit', () => {
  it('publishes the audited town and separate dog-owner scores', () => {
    expect(pkg.project.touristAppeal?.score).toBe(78);
    expect(pkg.project.touristAppeal?.dogOwnerScore).toBe(76);
    expect(pkg.project.preferredBasemap).toBe('voyager');
    expect(pkg.project.visitorHighlights).toHaveLength(6);
    expect(topVisitPlaces(pkg, 20)).toHaveLength(6);
  });

  it('publishes complete café-led and practical planning categories', () => {
    const planner = publishedPlannerCurationForProject(pkg.project.id);
    expect(topFoodAndDrink(pkg, 20)).toHaveLength(9);
    expect(planner?.eat).toHaveLength(9);
    expect(planner?.trails).toHaveLength(9);
    expect(planner?.trails).toContain('curated-trails:forfar-treasure-trail');
    expect(planner?.picnic).toHaveLength(2);
    expect(planner?.parking).toHaveLength(8);
    expect(planner?.toilets).toHaveLength(4);
    expect(publishedDogAccessForPlace(pkg.project.id, 'attraction', 'curated-attraction:forfar-loch-country-park')?.rating).toBe(3);
    const lochParkingGeometry = pkg.features.find((feature) => feature.id === 'curated-parking:forfar-loch')?.geometry;
    const eastGreensGeometry = pkg.features.find((feature) => feature.id === 'curated-parking:forfar-east-greens')?.geometry;
    expect(lochParkingGeometry?.type === 'Point' ? lochParkingGeometry.coordinates : undefined).toEqual([-2.8972351, 56.644681]);
    expect(eastGreensGeometry?.type === 'Point' ? eastGreensGeometry.coordinates : undefined).toEqual([-2.8873, 56.6469]);
    expect(pkg.features.filter((feature) => feature.id.startsWith('curated-parking:')).every((feature) => feature.locationType === 'exact' && feature.locationConfidence === 'high')).toBe(true);
    expect(topVisitPlaces(pkg, 20).map((feature) => feature.name)).toEqual(expect.arrayContaining([
      'Castle Hill and Mercat Cross', 'Frosty’s Soft Play Centre', 'Reid Park',
    ]));
  });

  it('retains the complete local heritage layer and exposes no undated heat pin', () => {
    const heritage = pkg.features.filter((feature) => feature.id.startsWith('hes-') || feature.id.startsWith('nrhe:'));
    const visible = heritage.filter((feature) => !feature.tags.includes('map-hidden'));
    expect(heritage.length).toBe(audit.heritageDateAudit.imported);
    expect(visible).toHaveLength(121);
    expect(visible.every((feature) => Boolean(feature.documentedDateText?.trim() && feature.earliestPossibleYear != null && feature.latestPossibleYear != null && feature.dateBasis !== 'unknown'))).toBe(true);
    expect(audit.heritageDateAudit.undated).toEqual([]);
  });

  it('ships distinct artwork and records named-provider trail checks', () => {
    expect(pkg.project.visualIdentity?.heroImage).toBe('/town-guides/forfar-little-causeway-fountain-watercolour-guide-v1.png');
    expect(existsSync(resolve('public/town-guides/forfar-little-causeway-fountain-watercolour-guide-v1.png'))).toBe(true);
    expect(audit.trailProviderSearches.map((entry) => entry.provider)).toEqual(expect.arrayContaining([
      'TreasureTrails.co.uk', 'Curious About', 'Mystery Guides', 'Go Quest Adventures', 'Visit Angus',
    ]));
    expect(pkg.features.find((feature) => feature.id === 'curated-trails:forfar-treasure-trail')?.visitorWebsiteUrl).toBe('https://www.treasuretrails.co.uk/things-to-do/angus/forfar');
    expect(audit.trailProviderSearches.find((entry) => entry.provider === 'TreasureTrails.co.uk')?.result).toContain('HTTP 200');
  });
});
