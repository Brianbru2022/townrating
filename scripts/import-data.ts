import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const [file, organisation, url, licence] = process.argv.slice(2);
if (!file || !organisation || !url || !licence) {
  console.error('Usage: npm run import-data -- <geojson> <organisation> <source-url> <licence>');
  process.exit(1);
}
const parsed = JSON.parse(await readFile(resolve(file), 'utf8')) as {
  type?: string;
  features?: unknown[];
};
if (parsed.type !== 'FeatureCollection')
  throw new Error(
    'Only GeoJSON FeatureCollection is supported by this starter importer. Use GDAL to convert other supported curation formats first.',
  );
console.log(
  JSON.stringify(
    {
      source: { organisation, url, licence },
      importedFeatures: parsed.features?.length ?? 0,
      next: 'Map fields to HeritageFeature and run validate-data before seeding.',
    },
    null,
    2,
  ),
);
