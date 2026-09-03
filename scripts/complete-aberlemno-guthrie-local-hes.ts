import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { booleanIntersects, centroid } from '@turf/turf';
import type { Feature, Geometry, Polygon, MultiPolygon } from 'geojson';
import type { DataSourceDefinition, HeritageFeature, ProjectPackage } from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';
import { localHesDatasetFiles } from './lib/reference-data';

const reviewedAt = '2026-08-30T09:30:00.000Z';
const defaultStems = [
  'careston-castle', 'aldbar-castle', 'netherton-melgund', 'mains-of-melgund',
  'aberlemno', 'pitkennedy', 'turin-angus', 'rescobie', 'reswallie',
  'burnside-rescobie', 'balgavies', 'milldens', 'middle-drums', 'dubton-guthrie',
  'glasterlaw', 'guthrie-angus', 'kinnell-angus',
];
const requestedStems = process.argv.slice(2).filter((item) => !item.startsWith('--'));
const stems = requestedStems.length ? requestedStems : defaultStems;
const reportSlug = process.argv.find((item) => item.startsWith('--report-slug='))?.split('=', 2)[1] ?? 'aberlemno-guthrie';

interface ShapeCollection { features: Array<Feature<Geometry, Record<string, unknown>>> }

const files = await localHesDatasetFiles('scheduledMonuments');
if (!files) throw new Error('Local HES Scheduled Monuments shapefile is required.');
Object.assign(globalThis, { self: globalThis });
const { default: shp } = await import('shpjs');
const parsed = await shp({
  shp: await readFile(files.shp), dbf: await readFile(files.dbf),
  prj: await readFile(files.prj, 'utf8'), cpg: await readFile(files.cpg, 'utf8'),
} as unknown as Buffer) as ShapeCollection | ShapeCollection[];
const scheduled = (Array.isArray(parsed) ? parsed : [parsed]).flatMap((item) => item.features)
  .filter((item): item is Feature<Polygon | MultiPolygon, Record<string, unknown>> =>
    (item.geometry.type === 'Polygon' || item.geometry.type === 'MultiPolygon') && Boolean(item.properties?.DES_REF));

const source: DataSourceDefinition = {
  id: 'hes-scheduled-monuments-local',
  name: 'Historic Environment Scotland Scheduled Monuments spatial data',
  organisation: 'Historic Environment Scotland',
  coverage: 'Scheduled monuments intersecting the strict editorial boundary',
  accessMethod: 'Developer-supplied local HES Shapefile; exact boundary intersection',
  sourceUrl: 'https://inspire.hes.scot/AtomService/DATA/sam_scotland.zip',
  licence: 'Open Government Licence v3.0; retain Historic Environment Scotland attribution.',
  reliability: 'official_statutory',
  limitations: 'The spatial layer supplies designation and location, not a historic construction period. Undated records remain in the catalogue but are hidden from the heat map.',
};

const report: Array<Record<string, unknown>> = [];
for (const stem of stems) {
  const path = resolve(`data/projects/${stem}.json`);
  const pkg = JSON.parse(await readFile(path, 'utf8')) as ProjectPackage;
  const matches = scheduled.filter((item) => booleanIntersects(item, pkg.project.boundary));
  let added = 0;
  for (const item of matches) {
    const reference = String(item.properties.DES_REF);
    const id = `hes-scheduled-monument:${reference}`;
    if (pkg.features.some((feature) => feature.id === id || feature.sourceRecords.some((record) => record.sourceRecordId === reference))) continue;
    const feature: HeritageFeature = {
      id, projectId: pkg.project.id,
      name: String(item.properties.DES_TITLE ?? `HES scheduled monument ${reference}`),
      alternativeNames: [], countryCode: pkg.project.countryCode, region: pkg.project.region,
      locality: pkg.project.locality, featureType: 'archaeological_site',
      designationType: String(item.properties.DES_TYPE ?? 'Scheduled Monument'),
      statutoryStatus: 'Scheduled Monument', significance: 'highest_national',
      geometry: centroid(item).geometry, locationType: 'site_centroid', locationConfidence: 'medium',
      dateBasis: 'unknown', dateConfidence: 'unknown', survival: 'unknown',
      shortDescription: String(item.properties.DES_TITLE ?? 'Official HES scheduled-monument record.'),
      sourceRecords: [{
        sourceName: 'HES Scheduled Monuments spatial data', sourceOrganisation: 'Historic Environment Scotland',
        sourceRecordId: reference,
        sourceUrl: String(item.properties.LINK ?? `https://portal.historicenvironment.scot/designation/${reference}`),
        accessedAt: reviewedAt, licence: source.licence,
        notes: 'Official statutory record and geometry; administrative designation dates are not used as historic dates.',
        reliability: 'official_statutory',
      }],
      licence: source.licence,
      tags: ['hes-scheduled-monument', 'heritage-record-retained', 'map-hidden', 'town-selection-inside-locality'],
      createdAt: reviewedAt, updatedAt: reviewedAt, reviewed: false, evidenceScope: 'parish_evidence',
      reviewNotes: 'Retained from the local HES statutory layer. Hidden until a defensible historic period is documented.',
    };
    pkg.features.push(feature); added += 1;
  }

  let hiddenUndated = 0;
  for (const feature of pkg.features) {
    const heritage = feature.tags.some((tag) => tag === 'hes-listed-building' || tag === 'hes-scheduled-monument' || tag === 'nrhe');
    const dated = Boolean(feature.documentedDateText?.trim()) && feature.earliestPossibleYear != null && feature.latestPossibleYear != null && feature.dateBasis !== 'unknown';
    if (!heritage || dated) continue;
    feature.tags = [...new Set([...feature.tags, 'heritage-record-retained', 'map-hidden'])];
    feature.updatedAt = reviewedAt;
    hiddenUndated += 1;
  }
  pkg.sources = [source, ...pkg.sources.filter((item) => item.id !== source.id)];
  pkg.validation = validateFeatures(pkg.project, pkg.features);
  const errors = pkg.validation.filter((item) => item.severity === 'error');
  if (errors.length) throw new Error(`${stem}: ${errors.map((item) => item.message).join('; ')}`);
  await writeFile(path, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
  report.push({ projectId: pkg.project.id, listedBuildings: pkg.features.filter((item) => item.tags.includes('hes-listed-building')).length, nrhe: pkg.features.filter((item) => item.tags.includes('nrhe')).length, scheduledMonuments: matches.length, scheduledAdded: added, hiddenUndated });
}

await writeFile(resolve(`data/review/${reportSlug}-local-hes-completeness-${reviewedAt.slice(0, 10)}.json`), `${JSON.stringify({
  reviewedAt, sourceMode: 'local-only', projects: report,
  datePolicy: 'Construction or material-period evidence only. HES designation, amendment and database dates are never used as historic dates.',
  mapPolicy: 'Undated HES and NRHE records remain intact in the catalogue and are hidden from the heat map until dated.',
}, null, 2)}\n`, 'utf8');
console.log(`Completed local HES coverage for ${report.length} projects; ${report.reduce((sum, item) => sum + Number(item.scheduledAdded), 0)} scheduled monuments added.`);
