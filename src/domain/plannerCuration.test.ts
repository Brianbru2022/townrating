import { describe, expect, it } from 'vitest';
import {
  addCuratedPlannerPlace,
  cleanPlannerCurationState,
  curatedFeatureIds,
  hasCuratedNeed,
  isCuratedForNeed,
  mergePlannerCurationState,
  removeCuratedPlannerPlace,
} from './plannerCuration';

describe('planner curation helpers', () => {
  it('adds, de-duplicates and removes locally curated planner places', () => {
    const added = addCuratedPlannerPlace({}, 'picnic', 'osm-community:node-1');
    const duplicated = addCuratedPlannerPlace(added, 'picnic', 'osm-community:node-1');

    expect(curatedFeatureIds(duplicated, 'picnic')).toEqual(['osm-community:node-1']);
    expect(isCuratedForNeed(duplicated, 'picnic', 'osm-community:node-1')).toBe(true);

    const removed = removeCuratedPlannerPlace(duplicated, 'picnic', 'osm-community:node-1');
    expect(curatedFeatureIds(removed, 'picnic')).toEqual([]);
  });

  it('cleans empty and duplicated curation entries before shipping', () => {
    expect(
      cleanPlannerCurationState({
        picnic: ['osm-community:node-1', 'osm-community:node-1', ''],
        parking: [],
      }),
    ).toEqual({ picnic: ['osm-community:node-1'] });
  });

  it('distinguishes an explicitly empty curated need from an uncurated need', () => {
    expect(hasCuratedNeed({ trails: [] }, 'trails')).toBe(true);
    expect(hasCuratedNeed({ trails: [] }, 'picnic')).toBe(false);
  });

  it('keeps bundled curation when merging stale local drafts', () => {
    expect(
      mergePlannerCurationState(
        { parking: ['osm-community:way-1', 'osm-community:way-2'] },
        { parking: ['osm-community:way-2', 'osm-community:way-3'] },
      ),
    ).toEqual({ parking: ['osm-community:way-1', 'osm-community:way-2', 'osm-community:way-3'] });
  });
});
