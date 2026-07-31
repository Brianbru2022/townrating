import { describe, expect, it } from 'vitest';
import { adapterFor, scotlandAdapter } from './adapters';
describe('country adapters', () => {
  it('selects Scotland without hardcoding map components', () =>
    expect(adapterFor('GB-SCT')).toBe(scotlandAdapter));
  it('uses generic for another country', () => expect(adapterFor('IE').countryCode).toBe('*'));
});
