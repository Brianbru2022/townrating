import { describe, expect, it } from 'vitest';
import { appBrandName, appMetaDescription } from './brand';

describe('app brand', () => {
  it('uses the wider Townscape Guides identity', () => {
    expect(appBrandName).toBe('Townscape Guides');
    expect(appMetaDescription).toContain('towns');
    expect(appMetaDescription).toContain('food stops');
  });
});
