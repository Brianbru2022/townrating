import { describe, expect, it } from 'vitest';
import { publishedProjectPackages } from './publishedProjects';

describe('local historic map publication guard', () => {
  it('does not publish quota-dependent MapTiler overlay URLs', () => {
    const tileUrls = publishedProjectPackages.flatMap((projectPackage) =>
      projectPackage.historicMaps.map((map) => map.tileUrl).filter(Boolean),
    );
    expect(tileUrls).not.toContainEqual(expect.stringContaining('api.maptiler.com'));
    expect(tileUrls).not.toContainEqual(expect.stringContaining('VITE_NLS_MAPTILER_API_KEY'));
  });

  it('does not publish the watermarked NLS/MapTiler fallback', () => {
    const maps = publishedProjectPackages
      .flatMap((projectPackage) => projectPackage.historicMaps)
      .filter((map) => map.id === 'nls-os-1920s-public-api');
    expect(maps).toHaveLength(0);
  });
});
