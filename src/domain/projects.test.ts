import { describe, expect, it } from 'vitest';
import { sortPublishedProjects } from './projects';
import type { TownProject } from './models';

function project(country: string, region: string, locality: string): TownProject {
  return { country, region, locality, name: `${locality} Historic Explorer` } as TownProject;
}

describe('published project ordering', () => {
  it('sorts countries, regions and towns alphabetically', () => {
    const sorted = sortPublishedProjects([
      project('Scotland', 'Fife', 'Cupar'),
      project('England', 'Yorkshire', 'York'),
      project('Scotland', 'Clackmannanshire', 'Alloa'),
      project('Scotland', 'Fife', 'Anstruther'),
    ]);

    expect(sorted.map((item) => `${item.country}/${item.region}/${item.locality}`)).toEqual([
      'England/Yorkshire/York',
      'Scotland/Clackmannanshire/Alloa',
      'Scotland/Fife/Anstruther',
      'Scotland/Fife/Cupar',
    ]);
  });
});
