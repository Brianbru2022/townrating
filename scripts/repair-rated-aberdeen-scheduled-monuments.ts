import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { booleanIntersects, pointOnFeature } from '@turf/turf';
import type { Feature, Geometry, Point, Polygon, MultiPolygon } from 'geojson';
import type { HeritageFeature, ProjectPackage, SourceRecord } from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';
import { localHesDatasetFiles } from './lib/reference-data';

const reviewedAt = '2026-08-28T12:00:00Z';
const projectFiles = [
  'monymusk.json',
  'kemnay.json',
  'kintore.json',
  'bridge-of-don-aberdeen.json',
  'old-aberdeen.json',
  'aberdeen.json',
  'torry-aberdeen.json',
  'cove-bay.json',
  'peterculter.json',
];

type MutableFeature = HeritageFeature & Record<string, any>;
type MutablePackage = ProjectPackage & { features: MutableFeature[] };
type ScheduledRecord = Feature<Polygon | MultiPolygon, Record<string, any>>;

interface DateEvidence {
  text: string;
  earliest: number;
  latest: number;
  precision: string;
  basis: 'documented_construction' | 'documented_date_range' | 'estimated_from_authoritative_source';
  confidence: 'high' | 'medium' | 'low';
  sourceUrl?: string;
  sourceName?: string;
  sourceOrganisation?: string;
  notes?: string;
}

const dates: Record<string, DateEvidence> = {
  SM12008: {
    text: 'Late Neolithic or Bronze Age; likely constructed in the 3rd millennium BC',
    earliest: -3000,
    latest: -2001,
    precision: 'millennium',
    basis: 'estimated_from_authoritative_source',
    confidence: 'medium',
  },
  SM12465: {
    text: 'Probable Iron Age, late 1st millennium BC to early 1st millennium AD',
    earliest: -1000,
    latest: 199,
    precision: 'broad archaeological period',
    basis: 'estimated_from_authoritative_source',
    confidence: 'medium',
  },
  SM50: {
    text: 'Later Neolithic to early Bronze Age ceremonial and burial monument',
    earliest: -3000,
    latest: -1500,
    precision: 'broad archaeological period',
    basis: 'estimated_from_authoritative_source',
    confidence: 'medium',
  },
  SM76: {
    text: 'Pictish Class I symbol stone, broadly AD 300–899; re-erected on its present base in 1854',
    earliest: 300,
    latest: 899,
    precision: 'broad archaeological period',
    basis: 'estimated_from_authoritative_source',
    confidence: 'medium',
    sourceUrl: 'https://www.trove.scot/place/18592',
    sourceName: 'Kintore churchyard symbol stone place record',
    sourceOrganisation: 'Historic Environment Scotland (Trove)',
    notes: 'The HES place record classifies the stone as Pictish and records its re-erection on a dated base in 1854; the broad Pictish range is retained rather than treating 1854 as its creation date.',
  },
  SM3958: {
    text: 'Neolithic long cairn',
    earliest: -4100,
    latest: -2500,
    precision: 'broad archaeological period',
    basis: 'estimated_from_authoritative_source',
    confidence: 'medium',
    sourceUrl: 'https://www.trove.scot/designation/SM3958',
    sourceName: 'Midmill long cairn designation and related place record',
    sourceOrganisation: 'Historic Environment Scotland (Trove)',
  },
  SM7674: {
    text: 'Canal authorised in 1796 and opened in 1805',
    earliest: 1796,
    latest: 1805,
    precision: 'construction range',
    basis: 'documented_date_range',
    confidence: 'high',
  },
  SM4055: {
    text: 'Bronze Age cemetery cairn, probably early 2nd millennium BC',
    earliest: -2000,
    latest: -1800,
    precision: 'part of millennium',
    basis: 'estimated_from_authoritative_source',
    confidence: 'medium',
    sourceUrl: 'https://her.aberdeenshire.gov.uk/Monument/MAB25990/',
    sourceName: 'Tullos Cairn historic environment record',
    sourceOrganisation: 'Aberdeenshire Council Archaeology Service',
  },
  SM10400: {
    text: 'Church founded 1189–1199; 13th-century fabric with 18th-century rebuilding',
    earliest: 1189,
    latest: 1799,
    precision: 'multi-period',
    basis: 'documented_date_range',
    confidence: 'high',
  },
};

function refs(feature: HeritageFeature): string[] {
  return [...new Set([
    ...[...feature.id.matchAll(/SM\d+/gi)].map((match) => match[0].toUpperCase()),
    ...feature.sourceRecords.flatMap((source) => [
      ...String(source.sourceRecordId ?? '').matchAll(/SM\d+/gi),
      ...String(source.sourceUrl ?? '').matchAll(/SM\d+/gi),
    ]).map((match) => match[0].toUpperCase()),
  ])];
}

function officialSource(record: ScheduledRecord, evidence: DateEvidence): SourceRecord {
  const reference = String(record.properties.DES_REF).toUpperCase();
  return {
    sourceName: 'Historic Environment Scotland scheduled-monument designation and spatial record',
    sourceOrganisation: 'Historic Environment Scotland',
    sourceRecordId: reference,
    sourceUrl: `https://portal.historicenvironment.scot/designation/${reference}`,
    accessedAt: reviewedAt,
    licence: 'Open Government Licence v3.0; retain Historic Environment Scotland attribution.',
    reliability: 'official_statutory',
    quotedDateText: evidence.text,
    notes: 'Statutory identity and legally defined boundary were checked against the complete local HES Scheduled Monuments dataset. The monument period comes from the official description or the cited national/local historic-environment record; the scheduling date is not used as the monument date.',
  };
}

function supportingSource(reference: string, evidence: DateEvidence): SourceRecord[] {
  if (!evidence.sourceUrl) return [];
  return [{
    sourceName: evidence.sourceName!,
    sourceOrganisation: evidence.sourceOrganisation!,
    sourceRecordId: `${reference}-date-evidence`,
    sourceUrl: evidence.sourceUrl,
    accessedAt: reviewedAt,
    reliability: evidence.sourceOrganisation?.includes('Council') ? 'local_authority' : 'official_statutory',
    quotedDateText: evidence.text,
    notes: evidence.notes,
  }];
}

const files = await localHesDatasetFiles('scheduledMonuments');
if (!files) throw new Error('The local HES Scheduled Monuments dataset is required.');
Object.assign(globalThis, { self: globalThis });
const { default: shp } = await import('shpjs');
const parsed: any = await shp({
  shp: await readFile(files.shp),
  dbf: await readFile(files.dbf),
  prj: await readFile(files.prj, 'utf8'),
  cpg: await readFile(files.cpg, 'utf8'),
} as any);
const records = (Array.isArray(parsed) ? parsed : [parsed])
  .flatMap((collection: any) => collection.features)
  .filter((feature: Feature<Geometry>): feature is ScheduledRecord =>
    ['Polygon', 'MultiPolygon'].includes(feature.geometry.type) && /^SM\d+$/i.test(String(feature.properties?.DES_REF ?? '')),
  );

const report: Array<Record<string, unknown>> = [];
for (const file of projectFiles) {
  const path = resolve('data/projects', file);
  const pkg = JSON.parse(await readFile(path, 'utf8')) as MutablePackage;
  const expected = records.filter((record) => booleanIntersects(record, pkg.project.boundary));

  // A feature carrying only a listed-building source is not a scheduled monument.
  for (const feature of pkg.features) {
    feature.alternativeNames ??= [];
    feature.tags ??= [];
    if (feature.tags.includes('hes-scheduled-monument') && refs(feature).length === 0) {
      feature.tags = feature.tags.filter((tag: string) => tag !== 'hes-scheduled-monument');
    }
  }

  const restored: string[] = [];
  for (const record of expected) {
    const reference = String(record.properties.DES_REF).toUpperCase();
    const evidence = dates[reference];
    const existing = pkg.features.find((feature) => refs(feature).includes(reference));
    if (existing) {
      if (!existing.documentedDateText?.trim() || existing.earliestPossibleYear == null || existing.latestPossibleYear == null || existing.dateBasis === 'unknown') {
        if (!evidence) throw new Error(`${file}: ${reference} has no construction-period evidence.`);
        Object.assign(existing, {
          documentedDateText: evidence.text,
          earliestPossibleYear: evidence.earliest,
          latestPossibleYear: evidence.latest,
          datePrecision: evidence.precision,
          dateBasis: evidence.basis,
          dateConfidence: evidence.confidence,
        });
      }
      existing.tags = [...new Set([...existing.tags, 'hes-scheduled-monument', 'hes-date-reviewed', 'date-reviewed', 'town-selection-inside-locality'])];
      existing.sourceRecords = [
        ...existing.sourceRecords.filter((source) => source.sourceRecordId?.toUpperCase() !== reference),
        officialSource(record, evidence ?? {
          text: existing.documentedDateText!, earliest: existing.earliestPossibleYear!, latest: existing.latestPossibleYear!,
          precision: existing.datePrecision ?? 'documented period', basis: existing.dateBasis as DateEvidence['basis'], confidence: existing.dateConfidence as DateEvidence['confidence'],
        }),
        ...(evidence ? supportingSource(reference, evidence) : []),
      ];
      existing.updatedAt = reviewedAt;
      continue;
    }
    if (!evidence) throw new Error(`${file}: ${reference} is missing and has no construction-period evidence.`);
    const point = pointOnFeature(record).geometry as Point;
    pkg.features.push({
      id: `hes-scheduled-monument:${reference}`,
      projectId: pkg.project.id,
      name: record.properties.DES_TITLE ?? reference,
      alternativeNames: [],
      countryCode: pkg.project.countryCode,
      region: pkg.project.region,
      locality: pkg.project.locality,
      featureType: 'scheduled_monument',
      geometry: point,
      designationType: record.properties.DES_TYPE ?? 'Scheduled Monument',
      designationCategory: record.properties.CATEGORY,
      statutoryStatus: 'Scheduled Monument',
      significance: 'highest_national',
      documentedDateText: evidence.text,
      earliestPossibleYear: evidence.earliest,
      latestPossibleYear: evidence.latest,
      datePrecision: evidence.precision,
      dateBasis: evidence.basis,
      dateConfidence: evidence.confidence,
      survival: 'unknown',
      locationType: 'site_centroid',
      locationConfidence: record.properties.PRECISION === 'Within 1m' ? 'high' : 'medium',
      shortDescription: record.properties.DES_TITLE,
      sourceRecords: [officialSource(record, evidence), ...supportingSource(reference, evidence)],
      tags: ['hes-scheduled-monument', 'hes-date-reviewed', 'date-reviewed', 'town-selection-inside-locality'],
      createdAt: reviewedAt,
      updatedAt: reviewedAt,
      reviewed: true,
      evidenceScope: 'parish_evidence',
      reviewNotes: 'Restored from the complete local HES Scheduled Monuments dataset. The pin is a representative point within the legally defined polygon; its date is the monument construction/use period, not its scheduling date.',
    } as MutableFeature);
    restored.push(reference);
  }

  const expectedRefs = expected.map((record) => String(record.properties.DES_REF).toUpperCase()).sort();
  const represented = new Set(pkg.features.flatMap(refs));
  const missing = expectedRefs.filter((reference) => !represented.has(reference));
  const visible = pkg.features.filter((feature) => feature.tags.includes('hes-scheduled-monument') && !feature.tags.includes('map-hidden'));
  const undated = visible.filter((feature) => !feature.documentedDateText?.trim() || feature.earliestPossibleYear == null || feature.latestPossibleYear == null || feature.dateBasis === 'unknown');
  if (missing.length || undated.length) throw new Error(`${file}: missing ${missing.join(', ') || 'none'}; undated ${undated.map((item) => item.id).join(', ') || 'none'}`);
  pkg.validation = validateFeatures(pkg.project, pkg.features);
  const errors = pkg.validation.filter((entry) => entry.severity === 'error');
  if (errors.length) throw new Error(`${file}: ${errors.map((entry) => entry.message).join('; ')}`);
  await writeFile(path, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
  report.push({ file, expectedScheduledMonuments: expectedRefs, visibleScheduledPins: visible.length, restored, missing, undated: [] });
}

await writeFile(resolve('data/review/aberdeen-rated-towns-scheduled-monuments-2026-08-28.json'), `${JSON.stringify({ reviewedAt, projects: report }, null, 2)}\n`, 'utf8');
console.log(report.map((item) => `${item.file}: ${item.visibleScheduledPins} scheduled, restored ${(item.restored as string[]).length}`).join('\n'));
