import { describe, expect, it } from 'vitest';
import { adapterFor, englandAdapter, genericAdapter, scotlandAdapter } from './adapters';

describe('country adapters', () => {
  it('selects the England and Scotland source adapters', () => {
    expect(adapterFor('GB-ENG')).toBe(englandAdapter);
    expect(adapterFor('GB-SCT')).toBe(scotlandAdapter);
    expect(adapterFor('GB-WLS')).toBe(genericAdapter);
    expect(englandAdapter.availableSources.map((source) => source.id)).toEqual([
      'historic-england-nhle',
      'ons-built-up-areas-2024',
    ]);
  });
});
