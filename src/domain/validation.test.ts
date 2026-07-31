import { describe, expect, it } from 'vitest';
import { alloaPackage } from '../data/alloa';
import { validateFeatures } from './validation';
describe('validation', () =>
  it('allows an empty project', () =>
    expect(validateFeatures(alloaPackage.project, [])).toEqual([])));

describe('record identity', () =>
  it('rejects duplicate feature IDs', () => {
    const feature = alloaPackage.features[0];
    expect(validateFeatures(alloaPackage.project, [feature, { ...feature }])).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'id', severity: 'error' })]),
    );
  }));

describe('source-aware duplicate checks', () =>
  it('keeps distinct official records sharing one representative point', () => {
    const feature = alloaPackage.features.find((item) => item.id === 'nrhe:339179');
    const related = alloaPackage.features.find((item) => item.id === 'nrhe:339180');
    expect(feature).toBeDefined();
    expect(related).toBeDefined();
    expect(validateFeatures(alloaPackage.project, [feature!, related!])).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ message: 'Possible duplicate record.' })]),
    );
  }));
