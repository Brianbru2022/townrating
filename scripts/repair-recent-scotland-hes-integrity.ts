import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Feature, MultiPolygon, Point, Polygon } from 'geojson';
import type { HeritageFeature, ProjectPackage, SourceRecord } from '../src/domain/models';
import { extractHistoricEnglandDate } from '../src/domain/historicDateExtraction';
import { validateFeatures } from '../src/domain/validation';
import { localHesListedBuildingFiles } from './lib/reference-data';

const reviewedAt = new Date().toISOString();
const reviewDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/London',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());
const projectsDirectory = resolve('data/projects');
const localDescriptionPath = resolve('data/reference/scotland-hes/hes-listed-building-descriptions.json');
const localDescriptionManifestPath = resolve('data/reference/scotland-hes/hes-listed-building-descriptions-manifest.json');
const legacyCachePath = resolve('data/cache/hes-designation-descriptions.json');
const argumentsPassed = process.argv.slice(2);
const allowNetwork = argumentsPassed.includes('--allow-network');
const requestedFiles = new Set(argumentsPassed.filter((item) => !item.startsWith('--')).map((item) => item.replace(/^.*[\\/]/, '')));
const explicitReport = argumentsPassed.find((item) => item.startsWith('--report='))?.slice('--report='.length);
const reportPath = resolve(explicitReport ?? (requestedFiles.size
  ? `data/review/selected-scotland-hes-integrity-audit-${reviewDate}.json`
  : `data/review/scotland-wide-hes-integrity-audit-${reviewDate}.json`));
const unresolvedReportPath = resolve(explicitReport
  ? explicitReport.replace(/\.json$/i, '-unresolved-dates.json')
  : `data/review/scotland-wide-hes-unresolved-dates-${reviewDate}.json`);
type AreaGeometry = Polygon | MultiPolygon;
type MutableFeature = HeritageFeature & Record<string, any>;
type MutablePackage = ProjectPackage & { features: MutableFeature[] };
interface HESAttributes {
  ENT_REF?: number | string;
  ENT_TITLE?: string;
  DES_REF?: string;
  DES_TITLE?: string;
  DES_TYPE?: string;
  CATEGORY?: string;
  LINK?: string;
  PRECISION?: string;
  ACCURACY?: string;
  DESIGNATED?: string | Date | null;
}
type HESPoint = Feature<Point, HESAttributes>;
type ShapeCollection = { features: Array<Feature> };
interface CachedDescription { url: string; description: string; fetchedAt: string }
interface TargetProject { fileName: string; filePath: string; pkg: MutablePackage }

function isScottishProject(pkg: ProjectPackage): boolean {
  return pkg.project.countryCode === 'GB-SCT' && pkg.project.country === 'Scotland';
}

function pointInRing(point: [number, number], ring: number[][]): boolean {
  let inside = false;
  for (let current = 0, previous = ring.length - 1; current < ring.length; previous = current++) {
    const [xi, yi] = ring[current];
    const [xj, yj] = ring[previous];
    const crosses = yi > point[1] !== yj > point[1] &&
      point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

function pointInPolygon(point: [number, number], polygon: number[][][]): boolean {
  if (!polygon.length || !pointInRing(point, polygon[0])) return false;
  return !polygon.slice(1).some((hole) => pointInRing(point, hole));
}

function pointInArea(point: [number, number], geometry: AreaGeometry): boolean {
  return geometry.type === 'Polygon'
    ? pointInPolygon(point, geometry.coordinates)
    : geometry.coordinates.some((polygon) => pointInPolygon(point, polygon));
}

function referencesForFeature(feature: HeritageFeature): string[] {
  const idReferences = [...feature.id.matchAll(/LB\d+/gi)].map((match) => match[0].toUpperCase());
  return [...new Set([
    ...idReferences,
    ...feature.sourceRecords
      .flatMap((source) => [
        ...String(source.sourceRecordId ?? '').matchAll(/LB\d+/gi),
        ...String(source.sourceUrl ?? '').matchAll(/LB\d+/gi),
      ])
      .map((match) => match[0].toUpperCase()),
  ])];
}

function referenceForFeature(feature: HeritageFeature): string | undefined {
  return referencesForFeature(feature)[0];
}

function decodeHtml(value: string): string {
  return value
    .replaceAll(/<[^>]+>/g, ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&ndash;', '–')
    .replaceAll('&mdash;', '—')
    .replaceAll(/ /g, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim();
}

function descriptionFromHtml(html: string): string | undefined {
  const section = /<section id="description"[\s\S]*?<h1>Description<\/h1>([\s\S]*?)<\/section>/i.exec(html)?.[1];
  return section ? decodeHtml(section) || undefined : undefined;
}

function expandShortYear(start: number, raw?: string): number {
  if (!raw) return start;
  if (raw.length >= 3) return Number(raw);
  const power = 10 ** raw.length;
  let value = Math.floor(start / power) * power + Number(raw);
  if (value < start) value += power;
  return value;
}

function extractHesDate(description: string) {
  const normalisedDescription = description.replace(/\b(\d{1,2})\s+(st|nd|rd|th)\b/gi, '$1$2');
  const established = extractHistoricEnglandDate(normalisedDescription);
  if (established) return established;
  const opening = normalisedDescription.slice(0, 320);
  // Scottish designation descriptions commonly open with an architect followed
  // immediately by the construction year, without words such as "built" or
  // "dated" (for example "William Ramage 1861-3"). The description section is
  // isolated from administrative designation metadata before this fallback.
  const standalone = /(?:(circa|c\.?|about|probably)\s+)?((?:1[0-9]|20)\d{2})(?:\s*[-–]\s*(\d{1,4}))?/i.exec(opening);
  if (!standalone) {
    const century = /(?:(early|mid|late)\s+)?(\d{1,2})(?:st|nd|rd|th)\.?(?:\s+|-)cent(?:ury)?\.?/i.exec(opening)
      ?? /\b(early|mid|late)\s+(\d{1,2})(?:st|nd|rd|th)\b/i.exec(opening);
    if (!century) {
      const victorian = /(?:(early|mid|late)\s+)?Victorian/i.exec(opening);
      if (victorian) {
        const ranges: Record<string, [number, number]> = { early: [1837, 1859], mid: [1850, 1875], late: [1875, 1901] };
        const [earliestPossibleYear, latestPossibleYear] = ranges[victorian[1]?.toLowerCase()] ?? [1837, 1901];
        return { evidenceText: victorian[0].trim(), earliestPossibleYear, latestPossibleYear, datePrecision: victorian[1] ? 'part of period' : 'period', dateBasis: 'documented_date_range' as const, dateConfidence: 'high' as const };
      }
      const splitYear = /\b(1[5-9])(?:\s*[A-Z.]{1,3}){0,4}\s*(\d{2})\b/.exec(opening);
      if (splitYear) {
        const year = Number(`${splitYear[1]}${splitYear[2]}`);
        return { evidenceText: splitYear[0].trim(), earliestPossibleYear: year, latestPossibleYear: year, datePrecision: 'exact year', dateBasis: 'documented_construction' as const, dateConfidence: 'high' as const };
      }
      const inscribedSplitYear = /\b(1[5-9])[A-Z0-9]{1,6}?(\d{2})\b/i.exec(opening);
      if (inscribedSplitYear) {
        const year = Number(`${inscribedSplitYear[1]}${inscribedSplitYear[2]}`);
        return { evidenceText: inscribedSplitYear[0].trim(), earliestPossibleYear: year, latestPossibleYear: year, datePrecision: 'inscribed year', dateBasis: 'documented_construction' as const, dateConfidence: 'high' as const };
      }
      const parenthesisedYear = /\b(1[5-9])\((\d)\)(\d)\b/.exec(opening);
      if (parenthesisedYear) {
        const year = Number(`${parenthesisedYear[1]}${parenthesisedYear[2]}${parenthesisedYear[3]}`);
        return { evidenceText: parenthesisedYear[0].trim(), earliestPossibleYear: year, latestPossibleYear: year, datePrecision: 'exact year', dateBasis: 'documented_construction' as const, dateConfidence: 'high' as const };
      }
      const roman = [...opening.matchAll(/\bM{0,4}(?:CM|CD|D?C{0,3})(?:XC|XL|L?X{0,3})(?:IX|IV|V?I{0,3})\b/g)]
        .find((match) => match[0].length >= 5);
      if (roman?.[0] && roman[0].length >= 5) {
        const values: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
        const letters = roman[0].split('');
        const year = letters.reduce((total, letter, index) => total + (values[letter] < (values[letters[index + 1]] ?? 0) ? -values[letter] : values[letter]), 0);
        if (year >= 1000 && year <= 2100) return { evidenceText: roman[0], earliestPossibleYear: year, latestPossibleYear: year, datePrecision: 'exact year', dateBasis: 'documented_construction' as const, dateConfidence: 'high' as const };
      }
      return undefined;
    }
    const centuryStart = (Number(century[2]) - 1) * 100;
    const qualifier = century[1]?.toLowerCase();
    const ranges: Record<string, [number, number]> = {
      early: [centuryStart, centuryStart + 32],
      mid: [centuryStart + 33, centuryStart + 66],
      late: [centuryStart + 67, centuryStart + 99],
    };
    const [earliestPossibleYear, latestPossibleYear] = qualifier ? ranges[qualifier] : [centuryStart, centuryStart + 99];
    return {
      evidenceText: century[0].trim(),
      earliestPossibleYear,
      latestPossibleYear,
      datePrecision: qualifier ? 'part of century' : 'century',
      dateBasis: 'documented_date_range' as const,
      dateConfidence: qualifier ? 'high' as const : 'medium' as const,
    };
  }
  const start = Number(standalone[2]);
  const end = expandShortYear(start, standalone[3]);
  const qualified = Boolean(standalone[1]);
  return {
    evidenceText: standalone[0].trim(),
    earliestPossibleYear: start,
    latestPossibleYear: end,
    datePrecision: end === start ? (qualified ? 'approximate year' : 'exact year') : 'year range',
    dateBasis: qualified ? 'estimated_from_authoritative_source' as const : end === start ? 'documented_construction' as const : 'documented_date_range' as const,
    dateConfidence: qualified ? 'medium' as const : 'high' as const,
  };
}

function marchStoneDate() {
  return {
    evidenceText: 'Present numbered march-stone series, circa 1790–1810',
    earliestPossibleYear: 1790,
    latestPossibleYear: 1810,
    datePrecision: 'estimated date range',
    dateBasis: 'estimated_from_authoritative_source' as const,
    dateConfidence: 'medium' as const,
  };
}

function isAberdeenMarchStone(point: HESPoint): boolean {
  return /MARCH STONE|BOUNDARY MARKER/i.test(`${point.properties.DES_TITLE ?? ''} ${point.properties.ENT_TITLE ?? ''}`);
}

function marchStoneSource(): SourceRecord {
  return {
    sourceName: 'Aberdeen Burgh march stones: Council minute and planning evidence',
    sourceOrganisation: 'Aberdeen City Archives and Aberdeen City Council',
    sourceRecordId: 'CA/1/1/68/4; 200366-DPP',
    sourceUrl: 'https://archives.aberdeencity.gov.uk/calmview/Record.aspx?id=CA%2F1%2F1%2F68%2F4&src=CalmView.Catalog',
    accessedAt: reviewedAt,
    reliability: 'archival',
    quotedDateText: '22 July 1800 council minute records the numbering and erection of stones 49–64; council planning evidence dates the present replacement series broadly to 1790–1810.',
    notes: 'The range describes the present numbered Aberdeen march-stone series. It is deliberately not reduced to a false exact year for every surviving stone.',
  };
}

interface ContextualDate {
  evidenceText: string;
  earliestPossibleYear: number;
  latestPossibleYear: number;
  datePrecision: string;
  dateBasis: 'documented_construction' | 'documented_date_range' | 'present_by' | 'first_mapped' | 'estimated_from_authoritative_source';
  dateConfidence: 'high' | 'medium' | 'low';
  relatedReference?: string;
  sourceUrl?: string;
  sourceName?: string;
  sourceOrganisation?: string;
  reliability?: SourceRecord['reliability'];
}

const contextualDates: Record<string, ContextualDate> = {
  LB20051: { evidenceText: 'Mid 18th century; in its present location from the mid 18th century', earliestPossibleYear: 1733, latestPossibleYear: 1766, datePrecision: 'part of century', dateBasis: 'documented_date_range', dateConfidence: 'high', sourceUrl: 'https://emuseum.aberdeencity.gov.uk/objects/110936/the-lang-stane', sourceName: 'The Lang Stane collection record', sourceOrganisation: 'Aberdeen Archives, Gallery & Museums' },
  LB20420: { evidenceText: 'Gatepiers associated with 4–5 Mackie Place, circa 1810', earliestPossibleYear: 1805, latestPossibleYear: 1815, datePrecision: 'approximate year', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'medium', relatedReference: 'LB20419' },
  LB15629: { evidenceText: 'Spark Terrace cottage group, early 19th century', earliestPossibleYear: 1800, latestPossibleYear: 1832, datePrecision: 'part of century', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'medium', relatedReference: 'LB15628' },
  LB36314: { evidenceText: 'Built circa 1800 (HES text has the evident transcription “c.800”)', earliestPossibleYear: 1795, latestPossibleYear: 1805, datePrecision: 'approximate year', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'medium' },
  LB36315: { evidenceText: 'Gatepiers and boundary wall associated with Kintore Lodge, circa 1800', earliestPossibleYear: 1795, latestPossibleYear: 1805, datePrecision: 'approximate year', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'medium', relatedReference: 'LB36314' },
  LB20179: { evidenceText: 'Boundary wall associated with St Katherine’s Manse, circa 1800', earliestPossibleYear: 1795, latestPossibleYear: 1805, datePrecision: 'approximate year', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'medium', relatedReference: 'LB20178' },
  LB20189: { evidenceText: 'Boundary wall associated with Rayne Manse, early 19th century', earliestPossibleYear: 1800, latestPossibleYear: 1832, datePrecision: 'part of century', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'medium', relatedReference: 'LB20188' },
  LB20191: { evidenceText: 'Boundary wall associated with Tillydrone House, early 19th century', earliestPossibleYear: 1800, latestPossibleYear: 1832, datePrecision: 'part of century', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'medium', relatedReference: 'LB20190' },
  LB20199: { evidenceText: 'Boundary wall at 18 The Chanonry, estimated 17th to early 19th century from the adjoining HES Chanonry group', earliestPossibleYear: 1600, latestPossibleYear: 1832, datePrecision: 'broad contextual range', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'low', relatedReference: 'LB20200' },
  LB20201: { evidenceText: 'Boundary wall associated with the 17th-century Chaplain’s Chambers', earliestPossibleYear: 1600, latestPossibleYear: 1699, datePrecision: 'century', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'medium', relatedReference: 'LB20200' },
  LB20218: { evidenceText: 'Boundary wall associated with 41 College Bounds, present before 1821', earliestPossibleYear: 1800, latestPossibleYear: 1820, datePrecision: 'present-by range', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'medium', relatedReference: 'LB20217' },
  LB20237: { evidenceText: 'Boundary wall to 50 College Bounds, late 18th century', earliestPossibleYear: 1767, latestPossibleYear: 1799, datePrecision: 'part of century', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'medium', relatedReference: 'LB20236' },
  LB20278: { evidenceText: '29 Don Street, estimated 18th to early 19th century from the adjoining HES Don Street group and its reused older fabric', earliestPossibleYear: 1700, latestPossibleYear: 1832, datePrecision: 'broad contextual range', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'low', relatedReference: 'LB20279' },
  LB16272: { evidenceText: 'Medieval church and churchyard; church documented in a grant of 1204–1211', earliestPossibleYear: 1204, latestPossibleYear: 1211, datePrecision: 'documented date range', dateBasis: 'documented_date_range', dateConfidence: 'high', sourceUrl: 'https://www.trove.scot/place/18526', sourceName: 'Old Kinnernie, St Mary’s Church and Churchyard', sourceOrganisation: 'Historic Environment Scotland / Scotland’s National Collection' },
  LB36136: { evidenceText: 'Sea-wall fabric of various periods associated with a harbour documented by 1580 and rebuilt through 1866–77', earliestPossibleYear: 1580, latestPossibleYear: 1877, datePrecision: 'broad documented range', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'low', relatedReference: 'LB36137' },
  LB36151: { evidenceText: 'Boundary wall of various periods in the 18th–19th-century Shore Street group', earliestPossibleYear: 1700, latestPossibleYear: 1899, datePrecision: 'broad contextual range', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'low', relatedReference: 'LB36150' },
  LB36192: { evidenceText: 'Churchyard walls and tombs of various periods around the 16th-century St Nicholas church tower', earliestPossibleYear: 1500, latestPossibleYear: 1899, datePrecision: 'broad contextual range', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'low', relatedReference: 'LB36191' },
  LB36195: { evidenceText: 'Old harbour fragment within fabric of various dates; Anstruther harbour documented by 1580', earliestPossibleYear: 1580, latestPossibleYear: 1899, datePrecision: 'broad documented range', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'low', relatedReference: 'LB36137' },
  LB36196: { evidenceText: 'Sea wall and watchtower of various dates within the 17th–19th-century Anstruther Wester harbour group', earliestPossibleYear: 1600, latestPossibleYear: 1899, datePrecision: 'broad contextual range', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'low', relatedReference: 'LB36197' },
  LB23246: { evidenceText: 'ANN DOM MDCCC–XXVI (1826)', earliestPossibleYear: 1826, latestPossibleYear: 1826, datePrecision: 'exact inscribed year', dateBasis: 'documented_construction', dateConfidence: 'high' },
  LB23421: { evidenceText: 'Garden walls and former lifeboat shed, conservatively assigned to the 19th-century harbour context', earliestPossibleYear: 1800, latestPossibleYear: 1899, datePrecision: 'century', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'low', relatedReference: 'LB23420' },
  LB24063: { evidenceText: 'Garden walls associated with Balgownie House, possibly 18th century with mid-19th-century addition', earliestPossibleYear: 1700, latestPossibleYear: 1866, datePrecision: 'broad contextual range', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'medium', relatedReference: 'LB24062' },
  LB24067: { evidenceText: 'Boundary walls and gates associated with Culross Park House, circa 1840 and later 19th century', earliestPossibleYear: 1835, latestPossibleYear: 1899, datePrecision: 'documented contextual range', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'medium', relatedReference: 'LB24066' },
  LB24058: { evidenceText: 'Historic Kirk Street wall incorporating blocked openings of former houses, 17th–19th-century town context', earliestPossibleYear: 1600, latestPossibleYear: 1899, datePrecision: 'broad contextual range', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'low', relatedReference: 'LB24056' },
  LB3348: { evidenceText: 'Remains incorporated into the Dunimarle Castle group before the 1840 rebuilding', earliestPossibleYear: 1700, latestPossibleYear: 1840, datePrecision: 'present-by contextual range', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'medium', relatedReference: 'LB3349' },
  LB23988: { evidenceText: 'Tron remains depicted on the 1860 Ordnance Survey map; possibly a reconstruction on the medieval tron site', earliestPossibleYear: 1860, latestPossibleYear: 1860, datePrecision: 'first mapped year', dateBasis: 'first_mapped', dateConfidence: 'high', sourceUrl: 'https://portal.historicenvironment.scot/designation/LB23988', sourceName: 'Culross, Sandhaven, The Tron designation', sourceOrganisation: 'Historic Environment Scotland' },
  LB24060: { evidenceText: 'Historic causeway walls include multiple lintels inscribed 1807', earliestPossibleYear: 1700, latestPossibleYear: 1807, datePrecision: 'broad range ending at inscribed year', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'medium' },
  LB6020: { evidenceText: 'Truncated 17-- lintel inscription; assigned only to the 18th century supported by the official description', earliestPossibleYear: 1700, latestPossibleYear: 1799, datePrecision: 'century from incomplete inscription', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'low' },
  LB8554: { evidenceText: 'St Margaret’s in the early-19th-century Main Street group', earliestPossibleYear: 1800, latestPossibleYear: 1832, datePrecision: 'part of century', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'low', relatedReference: 'LB8553' },
  LB36874: { evidenceText: 'Former bank office in the early-to-mid-19th-century Glengate group', earliestPossibleYear: 1800, latestPossibleYear: 1866, datePrecision: 'broad contextual range', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'low', relatedReference: 'LB36875' },
  LB36904: { evidenceText: 'Early medieval Pictish cross-slabs, conservatively 7th–9th century', earliestPossibleYear: 600, latestPossibleYear: 899, datePrecision: 'broad archaeological period', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'medium', sourceUrl: 'https://portal.historicenvironment.scot/designation/LB36904', sourceName: 'Kirriemuir Cemetery Pictish stones designation', sourceOrganisation: 'Historic Environment Scotland' },
  LB37467: { evidenceText: 'Kirkgate walls enclosing the palace and church approach, conservatively 16th–19th century', earliestPossibleYear: 1500, latestPossibleYear: 1899, datePrecision: 'broad contextual range', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'low', sourceUrl: 'https://portal.historicenvironment.scot/designation/LB37467', sourceName: 'Kirkgate walls designation', sourceOrganisation: 'Historic Environment Scotland' },
  LB37486: { evidenceText: 'Cottage-ornée lodge, gatepiers and walls, mid-to-late 19th century', earliestPossibleYear: 1850, latestPossibleYear: 1899, datePrecision: 'part of century', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'medium', sourceUrl: 'https://portal.historicenvironment.scot/designation/LB37486', sourceName: 'Nether Parkley Lodge designation', sourceOrganisation: 'Historic Environment Scotland' },
  LB7408: { evidenceText: 'Double cottage in the probably 19th-century Livingston Village group', earliestPossibleYear: 1800, latestPossibleYear: 1899, datePrecision: 'century', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'low', relatedReference: 'LB7407' },
  LB39969: { evidenceText: 'Outbuildings associated with the 18th-to-early-19th-century East Shore group', earliestPossibleYear: 1700, latestPossibleYear: 1832, datePrecision: 'broad contextual range', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'low', relatedReference: 'LB39970' },
  LB39982: { evidenceText: 'Much-altered Water Wynd house in the 18th–19th-century shore group', earliestPossibleYear: 1700, latestPossibleYear: 1899, datePrecision: 'broad contextual range', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'low', relatedReference: 'LB39983' },
  LB47794: { evidenceText: 'Official provost lamp marking the last Provost of Queensferry; present by abolition of the burgh in 1975', earliestPossibleYear: 1900, latestPossibleYear: 1975, datePrecision: 'present-by range', dateBasis: 'present_by', dateConfidence: 'medium', sourceUrl: 'https://portal.historicenvironment.scot/designation/LB47794', sourceName: 'Queensferry Provost Lamp designation', sourceOrganisation: 'Historic Environment Scotland' },
  LB40964: { evidenceText: 'Clapper bridge of uncertain date, conservatively assigned to the pre-20th-century vernacular landscape', earliestPossibleYear: 1600, latestPossibleYear: 1899, datePrecision: 'broad uncertain range', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'low', sourceUrl: 'https://portal.historicenvironment.scot/designation/LB40964', sourceName: 'Clapper Bridge designation', sourceOrganisation: 'Historic Environment Scotland' },
  LB11239: { evidenceText: 'Inscribed IY IS I7 72 (1772)', earliestPossibleYear: 1772, latestPossibleYear: 1772, datePrecision: 'exact inscribed year', dateBasis: 'documented_construction', dateConfidence: 'high', sourceUrl: 'https://portal.historicenvironment.scot/designation/LB11239', sourceName: 'Milton of Finavon Mill designation', sourceOrganisation: 'Historic Environment Scotland' },
  LB11264: { evidenceText: 'Foundation inscription records David Clark laying the foundation stone in January 1647', earliestPossibleYear: 1647, latestPossibleYear: 1647, datePrecision: 'exact inscribed year', dateBasis: 'documented_construction', dateConfidence: 'high', sourceUrl: 'https://portal.historicenvironment.scot/designation/LB11264', sourceName: 'Bridge of Margie designation', sourceOrganisation: 'Historic Environment Scotland', reliability: 'official_statutory' },
  LB11673: { evidenceText: 'Parts of the walled garden are said to have been built by the Nameless Highlanders after the 1745 rising', earliestPossibleYear: 1745, latestPossibleYear: 1799, datePrecision: 'later 18th-century documented range', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'medium', sourceUrl: 'https://her.aberdeenshire.gov.uk/Monument/MAB33104', sourceName: 'Kinnordy House Walled Garden monument record', sourceOrganisation: 'Aberdeenshire Council Historic Environment Record', reliability: 'local_authority' },
  LB15936: { evidenceText: 'Manse offices associated with the 1803 parish church and present on the first Ordnance Survey historic mapping', earliestPossibleYear: 1803, latestPossibleYear: 1870, datePrecision: 'present-by contextual range', dateBasis: 'present_by', dateConfidence: 'low', sourceUrl: 'https://her.aberdeenshire.gov.uk/Monument/MAB9870', sourceName: 'Old Manse of Towie Steading building record', sourceOrganisation: 'Aberdeenshire Council Historic Environment Record', reliability: 'local_authority' },
  LB17747: { evidenceText: 'Railway bridge on the Dubton–Montrose branch, which opened on 1 February 1848', earliestPossibleYear: 1848, latestPossibleYear: 1848, datePrecision: 'associated railway opening year', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'medium', sourceUrl: 'https://www.railscot.co.uk/locations/D/Dubton/', sourceName: 'Dubton railway chronology', sourceOrganisation: 'RAILSCOT', reliability: 'secondary' },
  LB17810: { evidenceText: 'Former watermill built in the mid-19th century, with later 19th-century alterations', earliestPossibleYear: 1833, latestPossibleYear: 1866, datePrecision: 'part of century', dateBasis: 'documented_date_range', dateConfidence: 'high', sourceUrl: 'https://her.aberdeenshire.gov.uk/Monument/MAB39288/', sourceName: 'East Mill, Newtonmill building record', sourceOrganisation: 'Aberdeenshire Council Historic Environment Record', reliability: 'local_authority' },
  LB4681: { evidenceText: 'Walled garden and sundial within the 18th-century Langley Park House landscape; no closer material date is documented', earliestPossibleYear: 1700, latestPossibleYear: 1899, datePrecision: 'broad contextual range', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'low', sourceUrl: 'https://www.trove.scot/place/195925', sourceName: 'Langley Park House national record', sourceOrganisation: 'Historic Environment Scotland / Trove', reliability: 'official_non_statutory' },
  LB4685: { evidenceText: 'Bridge over the North British Arbroath and Montrose Railway, opened through the Pugeston area in 1881', earliestPossibleYear: 1881, latestPossibleYear: 1881, datePrecision: 'associated railway opening year', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'medium', sourceUrl: 'https://www.railscot.co.uk/locations/D/Dubton/', sourceName: 'Dubton railway chronology', sourceOrganisation: 'RAILSCOT', reliability: 'secondary' },
  LB49887: { evidenceText: 'Kennedy well stand pumps produced in the later 19th century by Glenfield and Kennedy of Kilmarnock', earliestPossibleYear: 1867, latestPossibleYear: 1899, datePrecision: 'part of century', dateBasis: 'documented_date_range', dateConfidence: 'high', sourceUrl: 'https://portal.historicenvironment.scot/designation/LB49887', sourceName: 'Tannadice Kennedy well stand pumps designation', sourceOrganisation: 'Historic Environment Scotland', reliability: 'official_statutory' },
  LB10773: { evidenceText: 'Rear shed within the earlier-19th-century Fernlea group', earliestPossibleYear: 1800, latestPossibleYear: 1832, datePrecision: 'part of century', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'medium', relatedReference: 'LB10772' },
  LB18423: { evidenceText: 'Stable group associated with Panbride House, dated 1856', earliestPossibleYear: 1856, latestPossibleYear: 1856, datePrecision: 'associated group year', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'medium', relatedReference: 'LB18422' },
  LB25826: { evidenceText: 'Earlier 19th century; the continuous Gray Street group is shown by 1835', earliestPossibleYear: 1800, latestPossibleYear: 1835, datePrecision: 'present-by contextual range', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'medium', relatedReference: 'LB25825' },
  LB31587: { evidenceText: 'Early 19th century Sunnyside cottage group', earliestPossibleYear: 1800, latestPossibleYear: 1832, datePrecision: 'part of century', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'medium', relatedReference: 'LB31586' },
  LB31597: { evidenceText: 'Circa 1850 Sunnyside cottage group', earliestPossibleYear: 1845, latestPossibleYear: 1855, datePrecision: 'approximate year', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'medium', relatedReference: 'LB31596' },
  LB31599: { evidenceText: 'Early 19th century Sunnyside cottage group', earliestPossibleYear: 1800, latestPossibleYear: 1832, datePrecision: 'part of century', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'medium', relatedReference: 'LB31598' },
  LB31600: { evidenceText: 'Early 19th century Sunnyside cottage group', earliestPossibleYear: 1800, latestPossibleYear: 1832, datePrecision: 'part of century', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'medium', relatedReference: 'LB31598' },
  LB40762: { evidenceText: 'Late 18th to mid-19th century within the contiguous North Street group', earliestPossibleYear: 1767, latestPossibleYear: 1866, datePrecision: 'broad contextual range', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'low', relatedReference: 'LB40761' },
  LB40763: { evidenceText: 'Late 18th to mid-19th century within the contiguous North Street group', earliestPossibleYear: 1767, latestPossibleYear: 1866, datePrecision: 'broad contextual range', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'low', relatedReference: 'LB40764' },
  LB40852: { evidenceText: 'Early 19th century within the contiguous South Street group', earliestPossibleYear: 1800, latestPossibleYear: 1832, datePrecision: 'part of century', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'medium', relatedReference: 'LB40851' },
  LB41928: { evidenceText: 'Early 19th century within the contiguous Westwood group', earliestPossibleYear: 1800, latestPossibleYear: 1832, datePrecision: 'part of century', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'medium', relatedReference: 'LB41927' },
  LB31608: { evidenceText: 'T. R. Soutar, 1920–21; unveiled 11 September 1921', earliestPossibleYear: 1920, latestPossibleYear: 1921, datePrecision: 'documented year range', dateBasis: 'documented_date_range', dateConfidence: 'high', sourceUrl: 'https://portal.historicenvironment.scot/designation/LB31608', sourceName: 'Balmashanner Hill War Memorial designation', sourceOrganisation: 'Historic Environment Scotland' },
  LB40635: { evidenceText: '20th century; described by HES as modern and present by listing in 1978', earliestPossibleYear: 1900, latestPossibleYear: 1978, datePrecision: 'present-by broad range', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'low', sourceUrl: 'https://portal.historicenvironment.scot/designation/LB40635', sourceName: '123 and 125 South Street designation', sourceOrganisation: 'Historic Environment Scotland' },
  LB40935: { evidenceText: 'K6 kiosk design of 1935, produced 1936–68', earliestPossibleYear: 1936, latestPossibleYear: 1968, datePrecision: 'production period', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'medium', sourceUrl: 'https://portal.historicenvironment.scot/designation/LB49068', sourceName: 'Historic Environment Scotland K6 kiosk type description', sourceOrganisation: 'Historic Environment Scotland' },
  LB4771: { evidenceText: 'Churchyard walls of various rebuilding dates around the medieval St Vigeans church and burial ground', earliestPossibleYear: 1100, latestPossibleYear: 1899, datePrecision: 'broad contextual range', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'low', sourceUrl: 'https://www.trove.scot/place/35559', sourceName: 'St Vigeans Parish Church and Churchyard national record', sourceOrganisation: 'Historic Environment Scotland / Trove' },
};

function contextualSource(reference: string, date: ContextualDate): SourceRecord {
  const related = date.relatedReference;
  return {
    sourceName: date.sourceName ?? `Related HES designation ${related}`,
    sourceOrganisation: date.sourceOrganisation ?? 'Historic Environment Scotland',
    sourceRecordId: related ?? `${reference}-context-date`,
    sourceUrl: date.sourceUrl ?? `https://portal.historicenvironment.scot/designation/${related}`,
    accessedAt: reviewedAt,
    reliability: date.reliability ?? (date.sourceOrganisation?.includes('Aberdeen') ? 'local_authority' : 'official_statutory'),
    quotedDateText: date.evidenceText,
    notes: related
      ? `The separately designated ancillary element has no date in its own short HES description. Its date is conservatively tied to the named associated building or immediately adjoining HES group; confidence is recorded explicitly.`
      : 'Independent authoritative record used to resolve a missing or evidently truncated construction period in the short HES designation description.',
  };
}

function designationReference(point: HESPoint): string {
  return String(point.properties.DES_REF ?? point.properties.ENT_REF).toUpperCase();
}

function officialSource(point: HESPoint, dateText?: string): SourceRecord {
  const reference = designationReference(point);
  return {
    sourceName: 'Historic Environment Scotland designation and listed-building spatial record',
    sourceOrganisation: 'Historic Environment Scotland',
    sourceRecordId: reference,
    sourceUrl: `https://portal.historicenvironment.scot/designation/${reference}`,
    accessedAt: reviewedAt,
    licence: 'Open Government Licence v3.0; retain Historic Environment Scotland attribution.',
    reliability: 'official_statutory',
    quotedDateText: dateText,
    notes: 'Statutory identity and location checked against the HES spatial dataset; construction date or period checked against the official designation description. The administrative designation date is not used as the building date.',
  };
}

function mergeSourceRecords(existing: SourceRecord[], incoming: SourceRecord): SourceRecord[] {
  return [
    ...existing.filter((source) => !(
      source.sourceOrganisation === 'Historic Environment Scotland' &&
      source.sourceRecordId?.toUpperCase() === incoming.sourceRecordId?.toUpperCase()
    )),
    incoming,
  ];
}

async function loadHesPoints(): Promise<HESPoint[]> {
  const files = await localHesListedBuildingFiles();
  if (!files) throw new Error('The local HES Listed Buildings shapefile is required for this repair.');
  Object.assign(globalThis, { self: globalThis });
  const { default: shp } = await import('shpjs');
  const bundle = {
    shp: await readFile(files.shp),
    dbf: await readFile(files.dbf),
    prj: await readFile(files.prj, 'utf8'),
    cpg: await readFile(files.cpg, 'utf8'),
  };
  const parsed = (await shp(bundle as unknown as Buffer)) as ShapeCollection | ShapeCollection[];
  return (Array.isArray(parsed) ? parsed : [parsed])
    .flatMap((collection) => collection.features)
    .filter((feature): feature is HESPoint => feature.geometry.type === 'Point' && /^LB\d+$/i.test(String(feature.properties?.DES_REF ?? '')));
}

async function loadTargets(): Promise<TargetProject[]> {
  const fileNames = (await readdir(projectsDirectory)).filter((name) => name.endsWith('.json'));
  const targets: TargetProject[] = [];
  for (const fileName of fileNames) {
    const filePath = resolve(projectsDirectory, fileName);
    const pkg = JSON.parse(await readFile(filePath, 'utf8')) as MutablePackage;
    if (
      isScottishProject(pkg) &&
      pkg.project.boundary &&
      (!requestedFiles.size || requestedFiles.has(fileName))
    ) targets.push({ fileName, filePath, pkg });
  }
  return targets;
}

async function readLocalDescriptions(): Promise<{ descriptions: Record<string, CachedDescription>; migratedLegacyCache: boolean }> {
  try {
    return { descriptions: JSON.parse(await readFile(localDescriptionPath, 'utf8')), migratedLegacyCache: false };
  } catch {
    try {
      return { descriptions: JSON.parse(await readFile(legacyCachePath, 'utf8')), migratedLegacyCache: true };
    } catch {
      return { descriptions: {}, migratedLegacyCache: false };
    }
  }
}

async function fetchDescription(reference: string, cache: Record<string, CachedDescription>): Promise<CachedDescription | undefined> {
  if (cache[reference]?.description) return cache[reference];
  if (!allowNetwork) return undefined;
  const url = `https://portal.historicenvironment.scot/designation/${reference}`;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Townscape Guides HES integrity audit/1.0' },
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) continue;
      const description = descriptionFromHtml(await response.text());
      if (!description) continue;
      return { url, description, fetchedAt: reviewedAt };
    } catch {
      // A later attempt may recover a transient HES portal failure.
    }
  }
  return undefined;
}

const targets = await loadTargets();
const hesPoints = await loadHesPoints();
const pointsByReference = new Map<string, HESPoint[]>();
const referencesByEntity = new Map<string, Set<string>>();
for (const point of hesPoints) {
  const reference = designationReference(point);
  pointsByReference.set(reference, [...(pointsByReference.get(reference) ?? []), point]);
  const entity = String(point.properties.ENT_REF ?? '').trim();
  if (entity) referencesByEntity.set(entity, new Set([...(referencesByEntity.get(entity) ?? []), reference]));
}

// A town guide must be complete against its own strict visitor boundary. Assigning a
// designation exclusively to the nearest overlapping project made the selected guide's
// heat map incomplete (for example Aberdeen/Torry and Old Aberdeen/Bridge of Don).
// A shared statutory record may therefore be represented in more than one guide; only
// the selected guide's features are rendered at a time.
const expectedByTarget = new Map<TargetProject, string[]>();
for (const target of targets) {
  expectedByTarget.set(target, [...pointsByReference]
    .filter(([, points]) => points.some((point) => pointInArea(
      point.geometry.coordinates as [number, number],
      target.pkg.project.boundary.geometry as AreaGeometry,
    )))
    .map(([reference]) => reference)
    .sort());
}

const localDescriptions = await readLocalDescriptions();
const cache = localDescriptions.descriptions;
const references = [...new Set([...expectedByTarget.values()].flat())].sort();
await mkdir(resolve('data/reference/scotland-hes'), { recursive: true });
for (let index = 0; index < references.length; index += 32) {
  const batch = references.slice(index, index + 32);
  const fetched = await Promise.all(batch.map(async (reference) => [reference, await fetchDescription(reference, cache)] as const));
  for (const [reference, result] of fetched) if (result) cache[reference] = result;
  console.log(`${allowNetwork ? 'Checked' : 'Loaded local'} HES descriptions ${Math.min(index + batch.length, references.length)}/${references.length}.`);
}
const serialisedDescriptions = `${JSON.stringify(cache, null, 2)}\n`;
await writeFile(localDescriptionPath, serialisedDescriptions, 'utf8');
await writeFile(localDescriptionManifestPath, `${JSON.stringify({
  generatedAt: reviewedAt,
  sourceOrganisation: 'Historic Environment Scotland',
  sourceKind: 'Local snapshot of official designation descriptions',
  records: Object.keys(cache).length,
  sha256: createHash('sha256').update(serialisedDescriptions).digest('hex'),
  networkUsedDuringThisRun: allowNetwork,
  migratedFromLegacyCache: localDescriptions.migratedLegacyCache,
  note: 'The HES spatial shapefile does not include construction descriptions. This checked-in local snapshot supplies those official descriptions; network retrieval is disabled unless --allow-network is passed explicitly.',
}, null, 2)}\n`, 'utf8');

function entitySiblingDate(point: HESPoint, ownReference: string) {
  const entity = String(point.properties.ENT_REF ?? '').trim();
  if (!entity) return undefined;
  for (const siblingReference of referencesByEntity.get(entity) ?? []) {
    if (siblingReference === ownReference) continue;
    const description = cache[siblingReference]?.description;
    const extracted = description ? extractHesDate(description) : undefined;
    if (extracted) return { ...extracted, siblingReference, entity };
  }
  return undefined;
}

const projectReports: Array<Record<string, unknown>> = [];
for (const target of targets) {
  const expected = expectedByTarget.get(target) ?? [];
  const expectedSet = new Set(expected);
  const restored: string[] = [];
  const duplicatesRemoved: string[] = [];
  const unparsed: string[] = [];

  // Remove only generated direct HES records now assigned to a neighbouring place.
  target.pkg.features = target.pkg.features.filter((feature) => {
    const featureReferences = referencesForFeature(feature);
    return !feature.id.startsWith('hes-listed-building:') || featureReferences.length === 0 || featureReferences.some((reference) => expectedSet.has(reference));
  });

  for (const reference of expected) {
    const points = pointsByReference.get(reference)!;
    const point = points[0];
    const matches = target.pkg.features.filter((feature) => referencesForFeature(feature).includes(reference));
    const primary = matches.find((feature) => !feature.id.startsWith('hes-listed-building:')) ?? matches[0];
    const description = cache[reference]?.description;
    const directDate = description ? extractHesDate(description) : undefined;
    const siblingDate = directDate ? undefined : entitySiblingDate(point, reference);
    const contextualDate = contextualDates[reference];
    const extracted = directDate ?? siblingDate ?? (isAberdeenMarchStone(point) ? marchStoneDate() : undefined) ?? contextualDate;
    const dateIsComplete = primary?.documentedDateText?.trim() && primary.earliestPossibleYear != null && primary.latestPossibleYear != null && primary.dateBasis !== 'unknown';
    const hasConstructionDate = Boolean(extracted || dateIsComplete);
    if (!extracted && !dateIsComplete) unparsed.push(reference);
    const official = officialSource(point, extracted?.evidenceText ?? primary?.documentedDateText);
    const common: Partial<MutableFeature> = {
      geometry: point.geometry,
      additionalPointLocations: points.slice(1).map((item) => item.geometry),
      designationType: point.properties.DES_TYPE ?? 'Listed Building',
      designationCategory: point.properties.CATEGORY ? `Category ${point.properties.CATEGORY}` : undefined,
      statutoryStatus: 'Listed Building',
      locationType: 'representative_point',
      locationConfidence: point.properties.PRECISION === 'Within 10m' ? 'high' : 'medium',
      updatedAt: reviewedAt,
    };
    if (primary) {
      const supportingSources = [
        official,
        ...(isAberdeenMarchStone(point) ? [marchStoneSource()] : []),
        ...(siblingDate ? [officialSource(pointsByReference.get(siblingDate.siblingReference)![0], siblingDate.evidenceText)] : []),
        ...(contextualDate ? [contextualSource(reference, contextualDate)] : []),
      ];
      Object.assign(primary, common, {
        name: primary.name || point.properties.ENT_TITLE || point.properties.DES_TITLE || reference,
        shortDescription: primary.shortDescription ?? point.properties.DES_TITLE,
        fullDescription: primary.fullDescription ?? description,
        sourceRecords: supportingSources.reduce(mergeSourceRecords, primary.sourceRecords),
        tags: [...new Set([
          ...primary.tags.filter((tag) => !['map-hidden', 'hes-date-reviewed', 'date-reviewed'].includes(tag)),
          'hes-listed-building',
          'town-selection-inside-locality',
          ...(hasConstructionDate ? ['hes-date-reviewed', 'date-reviewed'] : ['map-hidden']),
        ])],
        reviewed: true,
        ...(extracted && !dateIsComplete ? {
          documentedDateText: extracted.evidenceText,
          earliestPossibleYear: extracted.earliestPossibleYear,
          latestPossibleYear: extracted.latestPossibleYear,
          datePrecision: extracted.datePrecision,
          dateBasis: extracted.dateBasis,
          dateConfidence: extracted.dateConfidence,
        } : {}),
      });
      for (const duplicate of matches) {
        if (duplicate.id === primary.id || !duplicate.id.startsWith('hes-listed-building:')) continue;
        primary.sourceRecords = duplicate.sourceRecords.reduce(mergeSourceRecords, primary.sourceRecords);
        target.pkg.features = target.pkg.features.filter((feature) => feature.id !== duplicate.id);
        duplicatesRemoved.push(duplicate.id);
      }
    } else {
      const feature: MutableFeature = {
        id: `hes-listed-building:${reference}`,
        projectId: target.pkg.project.id,
        name: point.properties.ENT_TITLE || point.properties.DES_TITLE || reference,
        alternativeNames: [...new Set(points.map((item) => item.properties.DES_TITLE).filter((name): name is string => Boolean(name) && name !== point.properties.ENT_TITLE))],
        countryCode: target.pkg.project.countryCode,
        region: target.pkg.project.region,
        locality: target.pkg.project.locality,
        featureType: 'other',
        significance: point.properties.CATEGORY === 'A' ? 'highest_national' : 'national',
        ...common,
        dateBasis: extracted?.dateBasis ?? 'unknown',
        dateConfidence: extracted?.dateConfidence ?? 'unknown',
        documentedDateText: extracted?.evidenceText,
        earliestPossibleYear: extracted?.earliestPossibleYear,
        latestPossibleYear: extracted?.latestPossibleYear,
        datePrecision: extracted?.datePrecision,
        survival: 'unknown',
        shortDescription: point.properties.DES_TITLE,
        fullDescription: description,
        sourceRecords: [
          official,
          ...(isAberdeenMarchStone(point) ? [marchStoneSource()] : []),
          ...(siblingDate ? [officialSource(pointsByReference.get(siblingDate.siblingReference)![0], siblingDate.evidenceText)] : []),
          ...(contextualDate ? [contextualSource(reference, contextualDate)] : []),
        ],
        tags: [
          'hes-listed-building',
          'town-selection-inside-locality',
          ...(hasConstructionDate ? ['hes-date-reviewed', 'date-reviewed'] : ['map-hidden']),
        ],
        createdAt: reviewedAt,
        updatedAt: reviewedAt,
        reviewed: true,
        evidenceScope: 'parish_evidence',
        reviewNotes: siblingDate
          ? `Restored non-destructively from the local HES statutory spatial register. This ancillary designation shares HES entity ${siblingDate.entity} with ${siblingDate.siblingReference}; the group date comes from that sibling designation's official description. The designation date is provenance only.`
          : 'Restored non-destructively from the local HES statutory spatial register. Construction date or period comes from the official HES designation description or an explicitly cited authoritative series source; the designation date is provenance only.',
      } as MutableFeature;
      target.pkg.features.push(feature);
      restored.push(reference);
    }
  }

  const allHes = target.pkg.features.filter((feature) => feature.tags.includes('hes-listed-building'));
  const visibleHes = allHes.filter((feature) => !feature.tags.includes('map-hidden'));
  const representedReferences = new Set(allHes.flatMap(referencesForFeature));
  const missingDesignations = expected.filter((reference) => !representedReferences.has(reference));
  const undated = allHes.filter((feature) => !feature.documentedDateText?.trim() || feature.earliestPossibleYear == null || feature.latestPossibleYear == null || feature.dateBasis === 'unknown');
  const undatedVisible = undated.filter((feature) => !feature.tags.includes('map-hidden'));
  target.pkg.validation = validateFeatures(target.pkg.project, target.pkg.features);
  const errors = target.pkg.validation.filter((entry) => entry.severity === 'error');
  if (errors.length) throw new Error(`${target.fileName}: ${errors.map((entry) => entry.message).join('; ')}`);
  await writeFile(target.filePath, `${JSON.stringify(target.pkg, null, 2)}\n`, 'utf8');
  projectReports.push({
    file: target.fileName,
    projectId: target.pkg.project.id,
    expectedHesDesignations: expected.length,
    representedHesDesignations: expected.length - missingDesignations.length,
    visibleHesPins: visibleHes.length,
    restored: restored.length,
    duplicatesRemoved: duplicatesRemoved.length,
    dated: allHes.length - undated.length,
    undated: undated.map((feature) => referenceForFeature(feature) ?? feature.id),
    undatedVisible: undatedVisible.map((feature) => referenceForFeature(feature) ?? feature.id),
    missingDesignations,
    unparsedOfficialDescriptions: unparsed,
  });
}

const undatedTotal = projectReports.reduce((total, item) => total + (item.undatedVisible as string[]).length, 0);
const missingTotal = projectReports.reduce((total, item) => total + (item.missingDesignations as string[]).length, 0);
const repairGeneratedPinsPresent = targets.reduce((total, target) => total + target.pkg.features.filter(
  (feature) => feature.createdAt === reviewedAt && feature.id.startsWith('hes-listed-building:'),
).length, 0);
const restoredDuringAudit = projectReports.reduce((total, item) => total + Number(item.restored), 0);
const visiblePinTotal = projectReports.reduce((total, item) => total + Number(item.visibleHesPins), 0);
const report = {
  reviewedAt,
  scope: requestedFiles.size
    ? `Selected Scotland projects (${[...requestedFiles].join(', ')}), each independently reconciled against every HES Listed Building in its strict visitor boundary.`
    : 'Every Scotland project in the bundled town library, each independently reconciled against every HES Listed Building in its strict visitor boundary.',
  projects: projectReports.length,
  statutoryDesignationsAssigned: references.length,
  restoredPins: restoredDuringAudit,
  repairGeneratedPinsPresent,
  visibleHesPins: visiblePinTotal,
  duplicateDirectPinsRemoved: projectReports.reduce((total, item) => total + Number(item.duplicatesRemoved), 0),
  undatedVisiblePins: undatedTotal,
  missingStatutoryDesignations: missingTotal,
  sourceMode: allowNetwork ? 'local-first-with-explicit-network-fallback' : 'local-only',
  localDescriptionSnapshot: localDescriptionPath,
  localDescriptionsAvailable: references.filter((reference) => Boolean(cache[reference]?.description)).length,
  localDescriptionsMissing: references.filter((reference) => !cache[reference]?.description),
  datePolicy: 'Construction year or material period from the official HES designation description. Administrative designation dates remain source provenance and never become the heatmap date.',
  mapPolicy: 'Dates remain in the heritage data for timeline and heat scoring but the map date-label layer is removed.',
  projectsDetail: projectReports,
};
await mkdir(resolve('data/review'), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
await writeFile(unresolvedReportPath, `${JSON.stringify({
  reviewedAt,
  sourceMode: report.sourceMode,
  unresolved: [...new Set(projectReports.flatMap((item) => item.unparsedOfficialDescriptions as string[]))].sort(),
  policy: 'Use official internet evidence only for references listed here after the local HES spatial data and local official-description snapshot have both been exhausted.',
}, null, 2)}\n`, 'utf8');
console.log(`Scotland-wide HES integrity audit: ${projectReports.length} projects, ${references.length} statutory designations, ${visiblePinTotal} visible HES pins, ${report.restoredPins} pins restored, ${missingTotal} designations missing, ${undatedTotal} visible pins still undated.`);
if (undatedTotal || missingTotal) process.exitCode = 2;
