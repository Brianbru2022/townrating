import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { HeritageFeature, ProjectPackage, SourceRecord } from '../src/domain/models';
import { extractHistoricEnglandDate } from '../src/domain/historicDateExtraction';
import { validateFeatures } from '../src/domain/validation';

const reviewedAt = new Date().toISOString();
const reviewDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());
const projectDirectory = resolve('data/projects');
const cachePath = resolve('data/reference/scotland-hes/hes-scheduled-monument-descriptions.json');
const reportPath = resolve(`data/review/scotland-scheduled-monument-date-enrichment-${reviewDate}.json`);

interface CachedDescription {
  url: string;
  description: string;
  fetchedAt: string;
}

type MutableFeature = HeritageFeature & Record<string, unknown>;
type MutablePackage = ProjectPackage & { features: MutableFeature[] };

function decodeHtml(value: string): string {
  return value
    .replaceAll(/<[^>]+>/g, ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&ndash;', '–')
    .replaceAll('&mdash;', '—')
    .replaceAll(/\s+/g, ' ')
    .trim();
}

function descriptionFromHtml(html: string): string | undefined {
  const section = /<section id="description"[\s\S]*?<h1>Description<\/h1>([\s\S]*?)<\/section>/i.exec(html)?.[1];
  return section ? decodeHtml(section) || undefined : undefined;
}

function normaliseOrdinalCenturies(value: string): string {
  const ordinals: Record<string, string> = {
    fifth: '5th', sixth: '6th', seventh: '7th', eighth: '8th', ninth: '9th',
    tenth: '10th', eleventh: '11th', twelfth: '12th', thirteenth: '13th',
    fourteenth: '14th', fifteenth: '15th', sixteenth: '16th', seventeenth: '17th',
    eighteenth: '18th', nineteenth: '19th', twentieth: '20th',
  };
  return value.replace(
    /\b(fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|thirteenth|fourteenth|fifteenth|sixteenth|seventeenth|eighteenth|nineteenth|twentieth)\s+century\b/gi,
    (match, ordinal: string) => `${ordinals[ordinal.toLowerCase()] ?? ordinal} century`,
  );
}

function archaeologicalPeriod(description: string) {
  const periods: Array<[RegExp, string, number, number, HeritageFeature['dateConfidence']]> = [
    [/\bMesolithic\b/i, 'Mesolithic', -10000, -4001, 'medium'],
    [/\bNeolithic\b/i, 'Neolithic', -4000, -2501, 'medium'],
    [/\bBronze Age\b/i, 'Bronze Age', -2500, -801, 'medium'],
    [/\bIron Age\b/i, 'Iron Age', -800, 42, 'medium'],
    [/\bPictish\b/i, 'Pictish period', 300, 899, 'medium'],
    [/\bearly Christian\b/i, 'Early Christian period', 400, 1099, 'medium'],
    [/\blate medieval\b/i, 'Late medieval period', 1250, 1539, 'medium'],
    [/\bmedieval\b/i, 'Medieval period', 1066, 1539, 'medium'],
    [/\bpost-medieval\b/i, 'Post-medieval period', 1540, 1899, 'low'],
    [/\bprehistoric\b/i, 'Prehistoric period', -10000, 42, 'low'],
  ];
  for (const [pattern, evidenceText, earliestPossibleYear, latestPossibleYear, dateConfidence] of periods) {
    if (!pattern.test(description.slice(0, 1_200))) continue;
    return {
      evidenceText,
      earliestPossibleYear,
      latestPossibleYear,
      datePrecision: 'archaeological period',
      dateBasis: 'estimated_from_authoritative_source' as const,
      dateConfidence,
    };
  }
  return undefined;
}

function isScheduledFeature(feature: HeritageFeature): boolean {
  return feature.id.startsWith('hes-scheduled-monument:') || feature.tags.some((tag) =>
    tag === 'hes-scheduled-monument' || tag === 'scheduled_monument');
}

function extractDate(description: string) {
  const normalised = normaliseOrdinalCenturies(description);
  return extractHistoricEnglandDate(normalised) ?? archaeologicalPeriod(normalised);
}

interface ContextualScheduledDate {
  evidenceText: string;
  earliestPossibleYear: number;
  latestPossibleYear: number;
  datePrecision: string;
  dateBasis: HeritageFeature['dateBasis'];
  dateConfidence: HeritageFeature['dateConfidence'];
  sourceUrl: string;
  sourceName: string;
  sourceOrganisation: string;
}

const contextualScheduledDates: Record<string, ContextualScheduledDate> = {
  SM3746: { evidenceText: 'Glass cone circa 1825', earliestPossibleYear: 1820, latestPossibleYear: 1830, datePrecision: 'approximate year', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'high', sourceUrl: 'https://www.trove.scot/place/47210', sourceName: 'Alloa Glass Works national record', sourceOrganisation: 'Historic Environment Scotland / Trove' },
  SM626: { evidenceText: 'Romanesque medieval church, rebuilt in the 16th century', earliestPossibleYear: 1100, latestPossibleYear: 1599, datePrecision: 'multi-period documented range', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'high', sourceUrl: 'https://www.trove.scot/place/47057', sourceName: 'Tullibody Old Church national record', sourceOrganisation: 'Historic Environment Scotland / Trove' },
  SM4163: { evidenceText: 'Late 17th or early 18th-century windmill; converted to a dovecot in the early 19th century', earliestPossibleYear: 1667, latestPossibleYear: 1832, datePrecision: 'multi-period documented range', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'medium', sourceUrl: 'https://www.trove.scot/place/47208', sourceName: 'New Sauchie Windmill national record', sourceOrganisation: 'Historic Environment Scotland / Trove' },
  SM1904: { evidenceText: 'Medieval castle and earthwork', earliestPossibleYear: 1100, latestPossibleYear: 1599, datePrecision: 'archaeological period', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'medium', sourceUrl: 'https://www.trove.scot/place/47768', sourceName: 'Bathgate Castle national record', sourceOrganisation: 'Historic Environment Scotland / Trove' },
  SM2643: { evidenceText: 'Medieval motte', earliestPossibleYear: 1100, latestPossibleYear: 1599, datePrecision: 'archaeological period', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'medium', sourceUrl: 'https://www.trove.scot/place/48647', sourceName: 'Gillespie Moat national record', sourceOrganisation: 'Historic Environment Scotland / Trove' },
  SM2875: { evidenceText: 'Iron Age promontory fort', earliestPossibleYear: -800, latestPossibleYear: 42, datePrecision: 'archaeological period', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'medium', sourceUrl: 'https://marine.gov.scot/sites/default/files/chapter_17_-_archaeology_and_cultural_heritage.pdf', sourceName: 'Archaeology and cultural heritage assessment', sourceOrganisation: 'Scottish Government Marine Directorate' },
  SM90263: { evidenceText: 'West Port building contract dated 1589', earliestPossibleYear: 1589, latestPossibleYear: 1589, datePrecision: 'exact documented year', dateBasis: 'documented_construction', dateConfidence: 'high', sourceUrl: 'https://collections.st-andrews.ac.uk/item/st-andrews-west-port-building-contract/2038409', sourceName: 'St Andrews West Port building contract', sourceOrganisation: 'University of St Andrews Special Collections' },
  SM6: { evidenceText: 'Early Bronze Age, probably c.2000–800 BC', earliestPossibleYear: -2000, latestPossibleYear: -800, datePrecision: 'archaeological period', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'medium', sourceUrl: 'https://portal.historicenvironment.scot/designation/SM6', sourceName: 'Auld Kirk ring-cairn designation', sourceOrganisation: 'Historic Environment Scotland' },
  SM50: { evidenceText: 'Later Neolithic or early Bronze Age', earliestPossibleYear: -3000, latestPossibleYear: -1500, datePrecision: 'broad archaeological period', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'medium', sourceUrl: 'https://portal.historicenvironment.scot/designation/SM50', sourceName: 'Tuach Hill designation', sourceOrganisation: 'Historic Environment Scotland' },
  SM1907: { evidenceText: 'Possible Late Neolithic or Bronze Age ring cairn; Iron Age settlement occupied in the 2nd century AD', earliestPossibleYear: -3000, latestPossibleYear: 199, datePrecision: 'multiple archaeological phases', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'high', sourceUrl: 'https://portal.historicenvironment.scot/designation/SM1907', sourceName: 'Mote Hill designation', sourceOrganisation: 'Historic Environment Scotland' },
  SM4545: { evidenceText: 'Neolithic or early Bronze Age, about 2000–1500 BC', earliestPossibleYear: -2000, latestPossibleYear: -1500, datePrecision: 'archaeological date range', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'high', sourceUrl: 'https://portal.historicenvironment.scot/designation/SM4545', sourceName: 'Fordhouse barrow designation', sourceOrganisation: 'Historic Environment Scotland' },
  SM6041: { evidenceText: 'Cursus about 4000–2000 BC; settlement about 2000 BC–AD 500', earliestPossibleYear: -4000, latestPossibleYear: 500, datePrecision: 'multiple archaeological phases', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'high', sourceUrl: 'https://portal.historicenvironment.scot/designation/SM6041', sourceName: 'Balneaves Cottage cursus designation', sourceOrganisation: 'Historic Environment Scotland' },
  SM6080: { evidenceText: 'Later prehistoric, around 500 BC', earliestPossibleYear: -600, latestPossibleYear: -400, datePrecision: 'approximate archaeological date', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'high', sourceUrl: 'https://portal.historicenvironment.scot/designation/SM6080', sourceName: 'Aboyne Castle roundhouses designation', sourceOrganisation: 'Historic Environment Scotland' },
  SM6369: { evidenceText: 'Probably early medieval; possibly prehistoric in origin', earliestPossibleYear: -800, latestPossibleYear: 1100, datePrecision: 'uncertain archaeological period', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'medium', sourceUrl: 'https://portal.historicenvironment.scot/designation/SM6369', sourceName: 'Danes Dike designation', sourceOrganisation: 'Historic Environment Scotland' },
  SM6641: { evidenceText: 'Later Iron Age, probably around 250 BC–AD 400', earliestPossibleYear: -250, latestPossibleYear: 400, datePrecision: 'archaeological date range', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'high', sourceUrl: 'https://portal.historicenvironment.scot/designation/SM6641', sourceName: 'Arbroath Eastern Cemetery souterrain designation', sourceOrganisation: 'Historic Environment Scotland' },
  SM6914: { evidenceText: 'Later Neolithic or Bronze Age', earliestPossibleYear: -3000, latestPossibleYear: -800, datePrecision: 'broad archaeological period', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'medium', sourceUrl: 'https://portal.historicenvironment.scot/designation/SM6914', sourceName: 'Hawk Hill cairn designation', sourceOrganisation: 'Historic Environment Scotland' },
  SM7648: { evidenceText: 'Prehistoric crannog; monastic cell recorded 1234 and chapel works recorded 1508', earliestPossibleYear: -800, latestPossibleYear: 1508, datePrecision: 'multiple archaeological phases', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'high', sourceUrl: 'https://portal.historicenvironment.scot/designation/SM7648', sourceName: "Queen Margaret's Inch designation", sourceOrganisation: 'Historic Environment Scotland' },
  SM8582: { evidenceText: 'Prehistoric roundhouses and field system; associated kiln probably post-medieval', earliestPossibleYear: -4000, latestPossibleYear: 1750, datePrecision: 'multiple archaeological phases', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'medium', sourceUrl: 'https://portal.historicenvironment.scot/designation/SM8582', sourceName: 'Newton of Drummy designation', sourceOrganisation: 'Historic Environment Scotland' },
  SM90299: { evidenceText: 'Iron Age, first and second centuries AD', earliestPossibleYear: 1, latestPossibleYear: 200, datePrecision: 'two-century range', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'high', sourceUrl: 'https://www.historicenvironment.scot/visit/all/tealing-earth-house/', sourceName: 'Tealing Earth House visitor history', sourceOrganisation: 'Historic Environment Scotland' },
  SM10980: { evidenceText: 'Later prehistoric period', earliestPossibleYear: -800, latestPossibleYear: 400, datePrecision: 'broad archaeological period', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'medium', sourceUrl: 'https://portal.historicenvironment.scot/designation/SM10980', sourceName: 'Aboyne Castle settlement designation', sourceOrganisation: 'Historic Environment Scotland' },
  SM13358: { evidenceText: 'Probably in use between about 1200 BC and AD 1100', earliestPossibleYear: -1200, latestPossibleYear: 1100, datePrecision: 'broad archaeological range', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'high', sourceUrl: 'https://portal.historicenvironment.scot/designation/SM13358', sourceName: 'Kier Wood fort designation', sourceOrganisation: 'Historic Environment Scotland' },
};

function scheduledReference(feature: HeritageFeature): string | undefined {
  return feature.id.match(/SM\d+/i)?.[0]?.toUpperCase() ?? feature.sourceRecords
    .map((source) => source.sourceRecordId?.match(/SM\d+/i)?.[0]?.toUpperCase())
    .find(Boolean);
}

async function fetchDescription(reference: string): Promise<CachedDescription | undefined> {
  const url = `https://portal.historicenvironment.scot/designation/${reference}`;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Townscape Guides Angus HES audit/1.0' },
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) continue;
      const description = descriptionFromHtml(await response.text());
      if (description) return { url: response.url, description, fetchedAt: reviewedAt };
    } catch {
      // Retry transient official-portal failures; unresolved records remain hidden.
    }
  }
  return undefined;
}

const packages: Array<{ path: string; pkg: MutablePackage }> = [];
for (const file of await readdir(projectDirectory)) {
  if (!file.endsWith('.json') || file.endsWith('.template.json')) continue;
  const path = resolve(projectDirectory, file);
  const pkg = JSON.parse(await readFile(path, 'utf8')) as MutablePackage;
  if (pkg.project.countryCode === 'GB-SCT' && pkg.project.country === 'Scotland') packages.push({ path, pkg });
}

let cache: Record<string, CachedDescription> = {};
try { cache = JSON.parse(await readFile(cachePath, 'utf8')); } catch { /* first run */ }
const references = [...new Set(packages.flatMap(({ pkg }) => pkg.features
  .filter(isScheduledFeature)
  .map(scheduledReference)
  .filter((reference): reference is string => Boolean(reference))))].sort();

for (let index = 0; index < references.length; index += 6) {
  const batch = references.slice(index, index + 6);
  const results = await Promise.all(batch.map(async (reference) =>
    [reference, cache[reference] ?? await fetchDescription(reference)] as const));
  for (const [reference, result] of results) if (result) cache[reference] = result;
  console.log(`Checked official HES scheduled-monument descriptions ${Math.min(index + batch.length, references.length)}/${references.length}.`);
}
await mkdir(resolve('data/reference/scotland-hes'), { recursive: true });
await writeFile(cachePath, `${JSON.stringify(cache, null, 2)}\n`, 'utf8');

const datedReferences = new Set<string>();
const unresolvedReferences = new Set<string>();
let updatedFeatures = 0;
for (const item of packages) {
  for (const feature of item.pkg.features) {
    if (!isScheduledFeature(feature)) continue;
    const reference = scheduledReference(feature);
    if (!reference) continue;
    const description = cache[reference]?.description;
    const contextualDate = contextualScheduledDates[reference];
    const extracted = contextualDate ?? (description ? extractDate(description) : undefined);
    const alreadyDated = Boolean(
      feature.documentedDateText?.trim() && feature.earliestPossibleYear != null &&
      feature.latestPossibleYear != null && feature.dateBasis !== 'unknown',
    );
    if (!extracted && !alreadyDated) {
      unresolvedReferences.add(reference);
      feature.tags = [...new Set([...feature.tags, 'map-hidden', 'heritage-record-retained'])];
      continue;
    }
    const date = extracted ?? {
      evidenceText: feature.documentedDateText!,
      earliestPossibleYear: feature.earliestPossibleYear!,
      latestPossibleYear: feature.latestPossibleYear!,
      datePrecision: feature.datePrecision ?? 'documented period',
      dateBasis: feature.dateBasis,
      dateConfidence: feature.dateConfidence,
    };
    const source: SourceRecord | undefined = cache[reference] || contextualDate ? {
      sourceName: contextualDate?.sourceName ?? 'Historic Environment Scotland scheduled-monument description',
      sourceOrganisation: contextualDate?.sourceOrganisation ?? 'Historic Environment Scotland',
      sourceRecordId: reference,
      sourceUrl: contextualDate?.sourceUrl ?? cache[reference].url,
      accessedAt: reviewedAt,
      reliability: 'official_statutory',
      licence: 'Open Government Licence v3.0; retain Historic Environment Scotland attribution.',
      quotedDateText: date.evidenceText,
      notes: contextualDate
        ? 'A linked authoritative national, archival or government record supplies the material period missing from the terse designation page. Administrative designation and amendment dates were excluded.'
        : 'The construction or archaeological period comes from the official HES monument description. Administrative designation and amendment dates were excluded.',
    } : undefined;
    Object.assign(feature, {
      documentedDateText: date.evidenceText,
      earliestPossibleYear: date.earliestPossibleYear,
      latestPossibleYear: date.latestPossibleYear,
      datePrecision: date.datePrecision,
      dateBasis: date.dateBasis,
      dateConfidence: date.dateConfidence,
      fullDescription: feature.fullDescription ?? description,
      sourceRecords: source
        ? [...feature.sourceRecords.filter((item) => item.sourceName !== source.sourceName), source]
        : feature.sourceRecords,
      tags: [...new Set([
        ...feature.tags.filter((tag) => tag !== 'map-hidden'),
        'hes-scheduled-monument', 'hes-scheduled-date-reviewed', 'date-reviewed', 'heritage-record-retained',
      ])],
      reviewed: true,
      updatedAt: reviewedAt,
    });
    datedReferences.add(reference);
    updatedFeatures += 1;
  }
  try {
    item.pkg.validation = validateFeatures(item.pkg.project, item.pkg.features);
  } catch (error) {
    const invalidPoints = item.pkg.features
      .filter((feature) => feature.geometry?.type === 'Point')
      .filter((feature) => !Array.isArray(feature.geometry.coordinates)
        || feature.geometry.coordinates.length < 2
        || feature.geometry.coordinates.some((coordinate) => typeof coordinate !== 'number' || !Number.isFinite(coordinate)))
      .map((feature) => ({ id: feature.id, coordinates: feature.geometry.coordinates }));
    throw new Error(`${item.pkg.project.id}: feature validation threw before completion; invalid points=${JSON.stringify(invalidPoints)}`, { cause: error });
  }
  const errors = item.pkg.validation.filter((entry) => entry.severity === 'error');
  if (errors.length) throw new Error(`${item.pkg.project.name}: ${errors.map((entry) => entry.message).join('; ')}`);
  await writeFile(item.path, `${JSON.stringify(item.pkg, null, 2)}\n`, 'utf8');
}

for (const reference of datedReferences) unresolvedReferences.delete(reference);
const report = {
  reviewedAt,
  scope: 'Every Scotland project package and both current and legacy scheduled-monument tag generations.',
  source: 'Official Historic Environment Scotland scheduled-monument designation descriptions',
  sourceMode: 'local project identities and coordinates first; official HES web descriptions only for missing material dates',
  uniqueScheduledMonuments: references.length,
  officialDescriptionsCached: references.filter((reference) => Boolean(cache[reference]?.description)).length,
  datedScheduledMonuments: datedReferences.size,
  updatedProjectFeatures: updatedFeatures,
  unresolvedScheduledMonuments: [...unresolvedReferences].sort(),
  policy: 'Every scheduled record remains in the project library. Only records with a defensible construction or archaeological period are exposed as heat pins; designation dates are never substituted.',
};
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(report, null, 2));
