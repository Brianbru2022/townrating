import { describe, expect, it } from 'vitest';
import { publishedProjectPackages } from '../data/publishedProjects';
import { townCharacterTag } from './townCharacter';

function packageFor(locality: string) {
  const pkg = publishedProjectPackages.find((candidate) => candidate.project.locality === locality);
  if (!pkg) throw new Error(`Missing published package for ${locality}`);
  return pkg;
}

describe('town character tags', () => {
  it.each([
    ['Gourock', 'Victorian Clyde ferry town'],
    ['South Queensferry', 'Historic Forth bridge and harbour town'],
    ['Kirriemuir', 'Literary and music heritage town'],
    ['Lincoln', 'Cathedral city with Roman roots'],
    ['Cleethorpes', 'Traditional seaside resort'],
    ['Milton Keynes', 'Modernist green city'],
    ['Conwy', 'Medieval walled castle town'],
    ['Daventry', 'Historic market and coaching town'],
  ])('gives %s its researched character', (locality, expected) => {
    expect(townCharacterTag(packageFor(locality))).toBe(expected);
  });

  it('covers every published town with concise visitor-facing copy', () => {
    for (const pkg of publishedProjectPackages) {
      const tag = townCharacterTag(pkg);
      expect(tag, pkg.project.id).toBeTruthy();
      expect(tag.length, pkg.project.id).toBeLessThanOrEqual(55);
      expect(tag, pkg.project.id).not.toMatch(/local heritage, daytime stops|practical local guide/i);
    }
  });

  it('prefers an explicitly researched town-guide tag', () => {
    const source = packageFor('Daventry');
    const pkg = {
      ...source,
      project: {
        ...source.project,
        townGuide: {
          ...source.project.townGuide!,
          characterTag: 'Independent editorial description',
        },
      },
    };

    expect(townCharacterTag(pkg)).toBe('Independent editorial description');
  });

  it('uses a named landmark to distinguish a smaller village', () => {
    expect(townCharacterTag(packageFor('Church Brampton'))).toBe(
      'Northamptonshire church-and-cross village',
    );
  });
});
