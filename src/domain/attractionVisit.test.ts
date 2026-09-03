import { describe, expect, it } from 'vitest';
import type { HeritageFeature } from './models';
import { attractionVisitPlan, recommendedAttractionDuration } from './attractionVisit';

function attraction(
  name: string,
  featureType: string,
  notes?: string,
): HeritageFeature {
  return {
    id: name.toLocaleLowerCase().replaceAll(/[^a-z0-9]+/g, '-'),
    projectId: 'test-town',
    name,
    alternativeNames: [],
    countryCode: 'GB-ENG',
    featureType,
    geometry: { type: 'Point', coordinates: [0, 0] },
    locationType: 'exact',
    dateBasis: 'unknown',
    dateConfidence: 'unknown',
    locationConfidence: 'high',
    sourceRecords: notes
      ? [
          {
            sourceName: 'OpenStreetMap current community places',
            sourceOrganisation: 'OpenStreetMap contributors',
            accessedAt: '2026-08-12',
            notes: `Current OSM: ${notes}`,
            reliability: 'secondary',
          },
        ]
      : [],
    tags: [],
    createdAt: '2026-08-12',
    updatedAt: '2026-08-12',
    reviewed: true,
  };
}

describe('attraction visitor planning', () => {
  it('uses realistic type-aware durations instead of a generic five-minute visit', () => {
    expect(recommendedAttractionDuration(attraction('Great Castle', 'castle'), 88)).toBe(
      'Allow 90 minutes-3 hours',
    );
    expect(recommendedAttractionDuration(attraction('Town Castle', 'castle'), 70)).toBe(
      'Allow 60-120 minutes',
    );
    expect(recommendedAttractionDuration(attraction('City Museum', 'museum'), 90)).toBe(
      'Allow 2-3 hours',
    );
    expect(recommendedAttractionDuration(attraction('War Memorial', 'memorial'), 45)).toBe(
      'Allow 10-25 minutes',
    );
  });

  it('retains researched visitor facts from the bundled current-place source', () => {
    const plan = attractionVisitPlan(
      attraction(
        'Research Museum',
        'museum',
        'time_to_spend=Allow 90 minutes; opening_hours=Tuesday-Sunday, 10am-5pm; entrance_fee=Adult £12; parking=Paid visitor car park; toilets=yes; picnic=no; cafe=yes.',
      ),
      84,
    );

    expect(plan).toEqual({
      timeToSpend: 'Allow 90 minutes',
      openingTimes: 'Tuesday-Sunday, 10am-5pm',
      admission: 'Adult £12',
      parking: 'Paid visitor car park',
      toilets: 'Visitor toilets are available on site.',
      picnic: 'No dedicated picnic provision is available.',
      foodNote: 'An on-site café or food outlet is available.',
    });
  });

  it('states unconfirmed facilities honestly instead of hiding the fields', () => {
    const plan = attractionVisitPlan(attraction('Old Hall', 'country_house'), 82);

    expect(plan.openingTimes).toContain('check');
    expect(plan.admission).toContain('Check');
    expect(plan.parking).toContain('not confirmed');
    expect(plan.toilets).toContain('not confirmed');
    expect(plan.picnic).toContain('not confirmed');
    expect(plan.foodNote).toContain('not confirmed');
  });
});
