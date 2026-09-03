import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { booleanPointInPolygon, point } from '@turf/turf';
import type {
  Confidence,
  DateBasis,
  FeatureType,
  HeritageFeature,
  ProjectPackage,
  Reliability,
  SourceRecord,
  TouristAppealRating,
} from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';

const importRoot = resolve(process.argv[2] ?? 'tmp/towns-zip-import-20260804-190634');
const reviewedAt = new Date().toISOString();
const reviewedDate = reviewedAt.slice(0, 10);
const preserveBespokeProjectIds = new Set(['quarriers-village-scotland']);

interface ImportSummary {
  upgraded: string[];
  added: string[];
  skippedNewVisitorOnly: string[];
  skippedOutOfBoundary: string[];
}

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asArray(value: unknown): JsonRecord[] {
  return Array.isArray(value)
    ? value.flatMap((item) => {
        const record = asRecord(item);
        return record ? [record] : [];
      })
    : [];
}

function slugify(value: string): string {
  return value
    .toLocaleLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function projectIdFromPackTown(town: JsonRecord): string {
  const id = asString(town.id);
  if (!id) throw new Error('Visitor data pack has no town.id.');
  return id.replaceAll('_', '-');
}

function projectPathFor(projectId: string): string {
  if (projectId === 'kincardine-on-forth-scotland') {
    return resolve('data/projects/kincardine.json');
  }
  return resolve('data/projects', `${projectId.replace(/-scotland$/, '')}.json`);
}

function moduleNameFor(projectId: string): string {
  const base = projectId.replace(/-scotland$/, '');
  return base.replace(/-([a-z])/g, (_, letter: string) => letter.toLocaleUpperCase());
}

function featureId(projectId: string, group: string, item: JsonRecord): string {
  return `curated-${group}:${projectId.replace(/-scotland$/, '')}-${slugify(
    asString(item.id) ?? asString(item.name) ?? group,
  )}`;
}

function coordinates(item: JsonRecord): [number, number] | undefined {
  const coord = asRecord(item.coordinates);
  const lat = asNumber(coord?.lat) ?? asNumber(item.lat);
  const lon = asNumber(coord?.lon) ?? asNumber(item.lon);
  if (lat !== undefined && lon !== undefined) return [lon, lat];
  return undefined;
}

function addressText(value: unknown): string | undefined {
  const record = asRecord(value);
  if (!record) return asString(value);
  return [
    asString(record.line1),
    asString(record.line2),
    asString(record.town),
    asString(record.postcode),
    asString(record.country),
  ]
    .filter(Boolean)
    .join(', ');
}

function sourceUrl(item: JsonRecord, sourceIndex: Map<string, JsonRecord>): string | undefined {
  const direct =
    asString(item.official_website) ??
    asString(item.website) ??
    asString(item.source) ??
    asString(asRecord(item.osm)?.url);
  if (direct) return direct;
  const sources = Array.isArray(item.sources) ? item.sources : [];
  for (const sourceId of sources) {
    const source = sourceIndex.get(String(sourceId));
    const url = asString(source?.url) ?? asString(source?.sourceUrl);
    if (url) return url;
  }
  return undefined;
}

function sourceName(item: JsonRecord, fallback: string): string {
  return asString(item.source_name) ?? asString(item.sourceName) ?? fallback;
}

function noteValue(value: unknown): string | undefined {
  const text = asString(value);
  return text?.replaceAll(';', ',').replaceAll(/\s+/g, ' ').trim();
}

function joinValues(values: Array<string | undefined>): string {
  return values.filter(Boolean).join('; ');
}

function formatOpening(value: unknown): string | undefined {
  const text = asString(value);
  if (text) return text;
  const record = asRecord(value);
  if (!record) return undefined;
  const parts: string[] = [];
  const status = asString(record.status_text);
  if (status) parts.push(status);
  const days = asRecord(record.days_and_times);
  if (days) {
    const dayParts = Object.entries(days).map(([day, time]) => {
      const timeRecord = asRecord(time);
      if (timeRecord) {
        return `${day}: ${Object.entries(timeRecord)
          .map(([subDay, subTime]) => `${subDay} ${String(subTime)}`)
          .join(', ')}`;
      }
      return `${day}: ${String(time)}`;
    });
    parts.push(dayParts.join('; '));
  }
  const daysText = asString(record.days);
  const timesText = asString(record.times);
  if (daysText || timesText) parts.push([daysText, timesText].filter(Boolean).join(' '));
  const kitchen = asString(record.kitchen_hours);
  if (kitchen) parts.push(`Kitchen ${kitchen}`);
  const season = asString(record.season);
  if (season) parts.push(season);
  const closed = Array.isArray(record.closed_days) ? record.closed_days.map(String).join(', ') : undefined;
  if (closed) parts.push(`Closed ${closed}`);
  const lastAdmission = asString(record.last_admission);
  if (lastAdmission) parts.push(`Last admission ${lastAdmission}`);
  const note =
    asString(record.holiday_note) ??
    asString(record.safety_note) ??
    asString(record.instruction_conflict);
  if (note) parts.push(note);
  return parts.join('. ');
}

function formatPrice(value: unknown): string | undefined {
  const text = asString(value);
  if (text) return text;
  const record = asRecord(value);
  if (!record) return undefined;
  const currency = asString(record.currency) === 'GBP' ? '£' : '';
  const labels: Record<string, string> = {
    adult: 'Adult',
    concession: 'concession',
    child: 'child',
    family: 'family',
    one_adult_family: 'one-adult family',
    young_scot: 'Young Scot',
    guided_tour_price: 'guided tour',
    self_guided_adult: 'self-guided adult',
    self_guided_child: 'self-guided child',
    recreational_one_hour_adult: 'one-hour adult',
    recreational_one_hour_child: 'one-hour child',
  };
  const prices = Object.entries(labels)
    .flatMap(([key, label]) => {
      const amount = asNumber(record[key]);
      if (amount === undefined) return [];
      return amount === 0 ? `${label} free` : `${label} ${currency}${amount}`;
    })
    .join('; ');
  const freeCategories = Array.isArray(record.free_categories)
    ? `Free for ${record.free_categories.map(String).join(', ')}`
    : undefined;
  const variable = asString(record.tuition_and_course_prices);
  return [prices, freeCategories, variable].filter(Boolean).join('; ') || undefined;
}

function visitMinutes(item: JsonRecord): string | undefined {
  const direct = asString(item.visit_minutes);
  if (direct) return `${direct.replace('-', '–')} minutes`;
  const range = asRecord(item.normal_visit_duration_minutes);
  const min = asNumber(range?.minimum);
  const max = asNumber(range?.maximum);
  if (min !== undefined && max !== undefined) return `${min}–${max} minutes`;
  return undefined;
}

function score(item: JsonRecord): number | undefined {
  return asNumber(item.score) ?? asNumber(asRecord(item.rating)?.score);
}

function label(item: JsonRecord): string | undefined {
  return asString(item.label) ?? asString(asRecord(item.rating)?.label);
}

function tagline(item: JsonRecord): string | undefined {
  const bestFor = Array.isArray(item.best_for) ? item.best_for.map(String) : [];
  const firstBest = bestFor.find((entry) => /^best\b/i.test(entry)) ?? bestFor[0];
  if (firstBest) {
    return firstBest
      .replace(/^best overall$/i, 'Best all-round')
      .replace(/^best coffee and cake$/i, 'Best coffee & cake')
      .replace(/\boption$/i, '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (letter) => letter.toLocaleUpperCase());
  }
  const category = asString(item.category) ?? asString(item.type);
  return category
    ?.replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toLocaleUpperCase())
    .replace(/\bAnd\b/g, 'and');
}

function admission(item: JsonRecord): string | undefined {
  return (
    formatPrice(item.pricing) ??
    asString(item.admission) ??
    asString(item.entry) ??
    asString(item.tariff) ??
    asString(item.charges)
  );
}

function isFreeAdmission(item: JsonRecord): boolean | undefined {
  const price = admission(item);
  if (!price) return undefined;
  const pricing = asRecord(item.pricing);
  const paidValues = pricing
    ? Object.entries(pricing).some(([key, value]) => key !== 'currency' && asNumber(value) && asNumber(value)! > 0)
    : false;
  if (paidValues) return false;
  return /\bfree\b|^no charge\b|no payment required/i.test(price);
}

function recommendationSummary(town: JsonRecord, attractions: JsonRecord[]): string {
  const rating = asRecord(town.overall_rating);
  const summary = asString(rating?.summary);
  if (summary) return summary;
  const topNames = attractions
    .slice(0, 3)
    .map((item) => asString(item.name))
    .filter(Boolean);
  return topNames.length
    ? `${asString(town.name)} has visitor appeal led by ${topNames.join(', ')}.`
    : `${asString(town.name)} has a curated visitor appeal score from the supplied data pack.`;
}

function townGuideFor(town: JsonRecord, attractions: JsonRecord[], cafes: JsonRecord[]) {
  const name = asString(town.name) ?? 'This town';
  const strengths = Array.isArray(town.strengths) ? town.strengths.map(String) : [];
  const bestFor = Array.isArray(town.best_for)
    ? town.best_for.map(String)
    : strengths.slice(0, 5).map((entry) => entry.replace(/\.$/, ''));
  const topAttractions = attractions
    .slice(0, 3)
    .map((item) => asString(item.name))
    .filter(Boolean) as string[];
  const topCafe = cafes
    .slice(0, 1)
    .map((item) => asString(item.name))
    .filter(Boolean)[0];
  return {
    characterTag:
      asString(town.character_tag) ??
      asString(town.characterTag) ??
      undefined,
    headline:
      topAttractions.length > 1
        ? `${topAttractions[0]}, ${topAttractions[1]} and an easy town visit`
        : `${name} in one easy visitor stop`,
    intro: recommendationSummary(town, attractions),
    bestFor: bestFor.length ? bestFor.slice(0, 5) : ['A compact visitor stop'],
    perfectFor: [
      asString(town.suggested_visit_length) ?? 'A short town visit',
      topCafe ? `A food stop at ${topCafe}` : undefined,
      topAttractions[0] ? `Starting with ${topAttractions[0]}` : undefined,
    ].filter(Boolean) as string[],
    suggestedFirstVisit: topAttractions[0]
      ? {
          title: topAttractions[0],
          summary: `Start with ${topAttractions[0]}${topAttractions[1] ? `, then add ${topAttractions[1]}` : ''}.`,
        }
      : undefined,
    dontMiss: topAttractions,
    suggestedTime: asString(town.suggested_visit_length) ?? 'Allow a short visit',
    visitorMood:
      asString(town.journey_verdict) ??
      `Good for visitors looking for a curated stop in ${name}.`,
    sourceUrls: [],
    lastReviewedAt: reviewedDate,
  };
}

function touristRating(town: JsonRecord): { rating: TouristAppealRating; label: string; summary: string } {
  const overall = asRecord(town.overall_rating);
  const stars = Math.max(0, Math.min(3, Math.round(asNumber(overall?.stars) ?? 0))) as TouristAppealRating;
  return {
    rating: stars,
    label: asString(overall?.label) ?? (stars >= 3 ? 'Exceptional' : stars === 2 ? 'Worth a detour' : stars === 1 ? 'Worth a look' : 'Not a tourist town'),
    summary: asString(overall?.summary) ?? asString(overall?.star_verdict) ?? '',
  };
}

function sourceIndex(pack: JsonRecord): Map<string, JsonRecord> {
  const index = new Map<string, JsonRecord>();
  const sources = Array.isArray(pack.sources) ? pack.sources : [];
  for (const source of sources) {
    const record = asRecord(source);
    const id = asString(record?.id);
    if (id && record) index.set(id, record);
  }
  return index;
}

function addCurationSource(
  feature: HeritageFeature,
  source: SourceRecord,
  tags: string[],
  description?: string,
): void {
  feature.shortDescription = description ?? feature.shortDescription;
  feature.tags = [...new Set([...feature.tags, ...tags])];
  feature.reviewed = true;
  feature.updatedAt = reviewedAt;
  feature.sourceRecords = [
    ...feature.sourceRecords.filter(
      (record) =>
        !(
          record.sourceName === source.sourceName &&
          record.sourceRecordId === source.sourceRecordId
        ),
    ),
    source,
  ];
}

function currentPlaceSource(
  projectId: string,
  group: string,
  item: JsonRecord,
  noteFields: Record<string, string | undefined>,
  url?: string,
): SourceRecord {
  const notes = joinValues(
    Object.entries(noteFields).flatMap(([key, value]) =>
      value ? [`${key}=${noteValue(value)}`] : [],
    ),
  );
  return {
    sourceName: 'Visitor data pack current place curation',
    sourceOrganisation: 'Townscape Guides curation',
    sourceRecordId: `${projectId}:${group}:${asString(item.id) ?? slugify(asString(item.name) ?? group)}`,
    sourceUrl: url,
    accessedAt: reviewedDate,
    reliability: 'secondary',
    notes: `Current-place curation: ${notes}.`,
  };
}

function createFeature(
  pkg: ProjectPackage,
  id: string,
  item: JsonRecord,
  group: string,
  tags: string[],
  source: SourceRecord,
  description?: string,
): HeritageFeature | undefined {
  const coord = coordinates(item);
  if (!coord) return undefined;
  const feature: HeritageFeature = {
    id,
    projectId: pkg.project.id,
    name: asString(item.name) ?? id,
    alternativeNames: [],
    countryCode: pkg.project.countryCode,
    region: pkg.project.region,
    locality: pkg.project.locality,
    address: addressText(item.address),
    featureType:
      group === 'eat'
        ? asString(asRecord(item.osm)?.raw_tags && asRecord(asRecord(item.osm)?.raw_tags)?.amenity) ?? 'cafe'
        : group === 'parking'
          ? 'parking'
          : group === 'trail'
            ? 'walking_route'
            : ((asString(item.type) ?? asString(item.category) ?? 'other') as FeatureType),
    geometry: { type: 'Point', coordinates: coord },
    locationType: 'representative_point',
    dateBasis: 'unknown',
    dateConfidence: 'unknown',
    locationConfidence: 'medium',
    significance: group === 'attraction' ? 'local' : undefined,
    shortDescription: description,
    sourceRecords: [source],
    licence: 'Visitor curation from supplied local data pack; preserve linked source attribution.',
    tags,
    createdAt: reviewedAt,
    updatedAt: reviewedAt,
    reviewed: true,
  };
  return feature;
}

function hasCurrentDetail(feature: HeritageFeature, pattern: RegExp): boolean {
  return feature.sourceRecords.some((source) => pattern.test(source.notes ?? ''));
}

function featureCompatibleWithGroup(
  feature: HeritageFeature,
  group: 'attraction' | 'eat' | 'parking' | 'trail',
): boolean {
  if (group === 'parking') {
    return (
      feature.featureType === 'parking' ||
      feature.tags.includes('service-context-parking') ||
      hasCurrentDetail(feature, /amenity=parking\b/i)
    );
  }
  if (group === 'eat') {
    return (
      ['cafe', 'restaurant'].includes(String(feature.featureType)) ||
      feature.tags.includes('service-context-food') ||
      hasCurrentDetail(feature, /amenity=(cafe|restaurant)\b/i)
    );
  }
  if (group === 'trail') {
    return (
      feature.tags.includes('service-context-trail') ||
      feature.tags.includes('service-context-visitor') ||
      /walk|trail|route|road/i.test(`${feature.featureType} ${feature.name}`)
    );
  }
  return !feature.tags.includes('service-context-parking') && !feature.tags.includes('service-context-food');
}

function findExistingFeature(
  pkg: ProjectPackage,
  item: JsonRecord,
  group: 'attraction' | 'eat' | 'parking' | 'trail',
): HeritageFeature | undefined {
  const osm = asRecord(item.osm);
  const osmType = asString(osm?.type);
  const osmId = asNumber(osm?.id);
  if (osmType && osmId !== undefined) {
    const sourceId = `${osmType}/${osmId}`;
    const bySource = pkg.features.find((feature) =>
      feature.sourceRecords.some((source) => source.sourceRecordId === sourceId),
    );
    if (bySource) return bySource;
    const byId = pkg.features.find((feature) => feature.id === `osm-community:${osmType}-${osmId}`);
    if (byId) return byId;
  }
  const name = asString(item.name)?.toLocaleLowerCase();
  if (!name) return undefined;
  const normalisedName = slugify(name);
  const candidates = pkg.features.filter((feature) => featureCompatibleWithGroup(feature, group));
  const scored = candidates.flatMap((feature) => {
    const featureName = slugify(feature.name);
    let matchScore = 0;
    if (feature.name.toLocaleLowerCase() === name) matchScore = 100;
    else if (
      normalisedName.length > 10 &&
      featureName.length > 10 &&
      (featureName.includes(normalisedName) || normalisedName.includes(featureName))
    ) {
      matchScore = feature.tags.includes('service-context-visitor') ? 80 : 60;
    }
    return matchScore ? [{ feature, matchScore }] : [];
  });
  return scored.sort((left, right) => right.matchScore - left.matchScore)[0]?.feature;
}

function upsertCuratedFeature(
  pkg: ProjectPackage,
  item: JsonRecord,
  group: 'attraction' | 'eat' | 'parking' | 'trail',
  source: SourceRecord,
  tags: string[],
  description?: string,
): HeritageFeature | undefined {
  const existing = findExistingFeature(pkg, item, group);
  if (existing) {
    if (
      existing.geometry?.type !== 'Point' ||
      !booleanPointInPolygon(point(existing.geometry.coordinates), pkg.project.boundary)
    ) {
      return undefined;
    }
    addCurationSource(existing, source, tags, description);
    return existing;
  }
  const created = createFeature(pkg, featureId(pkg.project.id, group, item), item, group, tags, source, description);
  if (!created) return undefined;
  if (
    created.geometry?.type === 'Point' &&
    !booleanPointInPolygon(point(created.geometry.coordinates), pkg.project.boundary)
  ) {
    return undefined;
  }
  pkg.features.push(created);
  return created;
}

function packAttractions(pack: JsonRecord): JsonRecord[] {
  return asArray(pack.attractions).filter((item) => asString(item.name));
}

function packCafes(pack: JsonRecord): JsonRecord[] {
  return [...asArray(pack.cafes_and_lunch), ...asArray(pack.cafes)].filter((item) =>
    asString(item.name),
  );
}

function packParking(pack: JsonRecord): JsonRecord[] {
  return [...asArray(pack.parking_facilities), ...asArray(pack.parking)].filter((item) =>
    asString(item.name),
  );
}

function packTrails(pack: JsonRecord): JsonRecord[] {
  return asArray(pack.trails).filter((item) => asString(item.name));
}

function uniqueItems(items: JsonRecord[]): JsonRecord[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = slugify(asString(item.id) ?? asString(item.name) ?? '');
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function updateProjectFromPack(pkg: ProjectPackage, pack: JsonRecord, summary: ImportSummary): void {
  const town = asRecord(pack.town);
  if (!town) throw new Error(`Pack for ${pkg.project.id} has no town object.`);
  const attractions = uniqueItems(packAttractions(pack));
  const cafes = uniqueItems(packCafes(pack));
  const parking = uniqueItems(packParking(pack)).filter(
    (item) => !/customer|private|permit/i.test([asString(item.access), asString(item.visitor_note), asString(item.name)].filter(Boolean).join(' ')),
  );
  const trails = uniqueItems(packTrails(pack));
  const sources = sourceIndex(pack);

  pkg.project.touristAppeal = touristRating(town);
  pkg.project.townGuide = {
    ...townGuideFor(town, attractions, cafes),
    sourceUrls: [...new Set([...(pkg.project.townGuide?.sourceUrls ?? []), ...[...sources.values()].flatMap((source) => asString(source.url) ?? asString(source.sourceUrl) ?? [])])],
  };

  const visitorHighlights = [];
  for (const item of attractions) {
    const url = sourceUrl(item, sources);
    const itemScore = score(item);
    const reason = asString(item.assessment) ?? asString(item.why) ?? asString(item.notes) ?? '';
    const source = currentPlaceSource(pkg.project.id, 'attraction', item, {
      tourism: 'attraction',
      visit_score: itemScore === undefined ? undefined : String(itemScore),
      rating: itemScore === undefined ? undefined : String(itemScore),
      recommendation: label(item),
      tagline: tagline(item),
      opening_hours: formatOpening(item.opening),
      entrance_fee: admission(item),
      price_band: asString(item.price_band),
      time_to_spend: visitMinutes(item),
      description: reason,
      website: url,
    }, url);
    const feature = upsertCuratedFeature(
      pkg,
      item,
      'attraction',
      source,
      ['current-context', 'service-context-visitor', `${pkg.project.id}-visitor-pack`],
      reason,
    );
    if (!feature) {
      summary.skippedOutOfBoundary.push(`${pkg.project.locality}: ${asString(item.name) ?? 'unnamed attraction'}`);
      continue;
    }
    visitorHighlights.push({
      rank: asNumber(item.rank) ?? visitorHighlights.length + 1,
      featureId: feature.id,
      name: asString(item.name) ?? feature.name,
      reason,
      tagline: tagline(item),
      visitorScore: itemScore,
      openingTimes: formatOpening(item.opening),
      admission: admission(item),
      freeAdmission: isFreeAdmission(item),
      organisationPills: pillOrganisations(item),
      sourceName: sourceName(item, 'Visitor data pack'),
      sourceUrl: url ?? pkg.project.townGuide?.sourceUrls[0] ?? '',
      verifiedInBoundaryAt: reviewedDate,
    });
  }
  pkg.project.visitorHighlights = visitorHighlights.sort(
    (left, right) => left.rank - right.rank || left.name.localeCompare(right.name),
  );

  const curation = plannerCuration.projects[pkg.project.id] ?? {};
  const eatIds: string[] = [];
  for (const item of cafes) {
    const url = sourceUrl(item, sources);
    const details = asRecord(item.service);
    const dogPolicy = asString(details?.dog_policy);
    const description = asString(item.assessment) ?? asString(item.notes) ?? '';
    const source = currentPlaceSource(pkg.project.id, 'eat', item, {
      amenity: /restaurant|hotel/i.test(asString(item.name) ?? '') ? 'restaurant' : 'cafe',
      visit_score: score(item) === undefined ? undefined : String(score(item)),
      rating: score(item) === undefined ? undefined : String(score(item)),
      recommendation: label(item),
      price_band: asString(item.price_band),
      opening_hours: formatOpening(item.opening),
      description,
      dog_friendly: dogPolicy && !/assistance/i.test(dogPolicy) ? dogPolicy : undefined,
      cuisine: asString(item.food_style) ?? asString(item.category),
      website: url,
    }, url);
    const feature = upsertCuratedFeature(
      pkg,
      item,
      'eat',
      source,
      ['current-context', 'service-context-food', `${pkg.project.id}-visitor-pack`],
      description,
    );
    if (feature) eatIds.push(feature.id);
  }
  if (cafes.length) curation.eat = eatIds;

  const parkingIds: string[] = [];
  for (const item of parking) {
    const url = sourceUrl(item, sources);
    const free = isParkingFree(item);
    const source = currentPlaceSource(pkg.project.id, 'parking', item, {
      amenity: 'parking',
      parking: asString(item.parking_type) ?? asString(item.type),
      access: asString(item.access),
      capacity: valueString(item.capacity_total ?? item.capacity),
      'capacity:disabled': valueString(item.capacity_disabled ?? item.accessible_bays),
      'capacity:charging': valueString(item.capacity_ev),
      price_display: free === undefined ? asString(item.tariff) ?? asString(item.charges) : free ? 'Free' : asString(item.tariff) ?? asString(item.charges) ?? 'Pay',
      payment_required: free === undefined ? valueString(item.payment_required) : free ? 'no' : 'yes',
      maxstay: valueString(item.max_stay_minutes ?? item.max_stay_note),
      payment: Array.isArray(item.payment_options) ? item.payment_options.map(String).join(', ') : asString(item.payment),
      description: asString(item.visitor_note) ?? parkingBestFor(item),
      website: url,
    }, url);
    const feature = upsertCuratedFeature(
      pkg,
      item,
      'parking',
      source,
      ['current-context', 'service-context-parking', `${pkg.project.id}-visitor-pack`],
      asString(item.visitor_note) ?? parkingBestFor(item),
    );
    if (feature) parkingIds.push(feature.id);
  }
  curation.parking = parkingIds;

  const trailIds: string[] = [];
  for (const item of trails) {
    const url = sourceUrl(item, sources);
    const description =
      asString(item.why) ??
      [
        asNumber(item.distance_km) ? `${item.distance_km} km` : undefined,
        asString(item.difficulty),
        asString(item.duration),
      ]
        .filter(Boolean)
        .join(' · ');
    const source = currentPlaceSource(pkg.project.id, 'trail', item, {
      route: 'walking_trail',
      trail_type: asString(item.difficulty),
      visit_score: score(item) === undefined ? undefined : String(score(item)),
      rating: score(item) === undefined ? undefined : String(score(item)),
      recommendation: trailLabel(score(item)),
      distance: asNumber(item.distance_km) ? `${item.distance_km} km` : undefined,
      time_to_spend: asString(item.duration),
      description,
      website: url,
    }, url);
    const feature = upsertCuratedFeature(
      pkg,
      item,
      'trail',
      source,
      ['current-context', 'curated-trail', 'service-context-trail', `${pkg.project.id}-visitor-pack`],
      description,
    );
    if (feature) trailIds.push(feature.id);
  }
  if (trails.length) curation.trails = trailIds;
  plannerCuration.projects[pkg.project.id] = curation;

  pkg.validation = validateFeatures(pkg.project, pkg.features);
}

function pillOrganisations(item: JsonRecord): string[] | undefined {
  const values: string[] = [];
  const operator = asString(asRecord(item.osm)?.raw_tags && asRecord(asRecord(item.osm)?.raw_tags)?.operator);
  const website = [asString(item.official_website), asString(item.source)].filter(Boolean).join(' ');
  if (/national trust for scotland|nts\.org/i.test(`${operator} ${website}`)) values.push('NTS');
  if (/historicenvironment|historic environment scotland/i.test(`${operator} ${website}`)) values.push('HES');
  const price = admission(item);
  if (price && /\bfree\b|self-guided adult free|adult free/i.test(price)) values.push('Free');
  return values.length ? [...new Set(values)] : undefined;
}

function trailLabel(value?: number): string | undefined {
  if (value === undefined) return undefined;
  if (value >= 90) return 'Highly recommended';
  if (value >= 80) return 'Recommended';
  return 'Interesting trail';
}

function valueString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  return String(value);
}

function isParkingFree(item: JsonRecord): boolean | undefined {
  const values = [
    valueString(item.fee),
    valueString(item.payment_required),
    asString(item.tariff),
    asString(item.charges),
    asString(item.payment),
  ]
    .filter(Boolean)
    .join(' ');
  if (!values) return undefined;
  if (/pay|£|tariff|ringgo/i.test(values)) return false;
  if (/\bfree\b|no payment|required=no|^false\b/i.test(values)) return true;
  return undefined;
}

function parkingBestFor(item: JsonRecord): string | undefined {
  const bestFor = Array.isArray(item.best_for) ? item.best_for.map(String).join(', ') : undefined;
  return bestFor ? `Best for ${bestFor}.` : undefined;
}

function sourceRecords(records: unknown): SourceRecord[] {
  return asArray(records).map((record, index) => ({
    sourceName: asString(record.sourceName) ?? asString(record.name) ?? `Imported source ${index + 1}`,
    sourceOrganisation:
      asString(record.sourceOrganisation) ?? asString(record.organisation) ?? 'Supplied data pack',
    sourceRecordId: asString(record.sourceRecordId) ?? asString(record.id),
    sourceUrl: asString(record.sourceUrl) ?? asString(record.url),
    accessedAt: asString(record.accessedAt) ?? reviewedDate,
    licence: asString(record.licence),
    quotedDateText: asString(record.quotedDateText),
    notes: asString(record.notes),
    reliability: reliability(record.reliability),
  }));
}

function reliability(value: unknown): Reliability {
  const text = asString(value);
  if (
    text &&
    [
      'official_statutory',
      'official_non_statutory',
      'academic',
      'local_authority',
      'archival',
      'secondary',
      'discovery_only',
    ].includes(text)
  ) {
    return text as Reliability;
  }
  if (/official|partnership|local_authority/i.test(text ?? '')) return 'official_non_statutory';
  return 'secondary';
}

function dateBasis(value: unknown): DateBasis {
  const text = asString(value);
  if (
    text &&
    [
      'documented_construction',
      'documented_date_range',
      'present_by',
      'first_mapped',
      'estimated_from_authoritative_source',
      'estimated_from_map_comparison',
      'unknown',
    ].includes(text)
  ) {
    return text as DateBasis;
  }
  if (/documented/i.test(text ?? '')) return 'documented_date_range';
  return 'unknown';
}

function confidence(value: unknown): Confidence {
  const text = asString(value)?.toLocaleLowerCase();
  if (text === 'high' || text === 'medium' || text === 'low' || text === 'unknown') return text;
  return 'medium';
}

function projectBoundary(project: JsonRecord, records: HeritageFeature[], visitorCoords: [number, number][]) {
  const centreRecord = asRecord(project.suggestedCentre);
  const centre: [number, number] = [
    asNumber(centreRecord?.longitude) ?? visitorCoords[0]?.[0] ?? -4,
    asNumber(centreRecord?.latitude) ?? visitorCoords[0]?.[1] ?? 56,
  ];
  const coords = [
    centre,
    ...records.flatMap((feature) =>
      feature.geometry?.type === 'Point' ? [feature.geometry.coordinates as [number, number]] : [],
    ),
    ...visitorCoords,
  ];
  const lons = coords.map(([lon]) => lon);
  const lats = coords.map(([, lat]) => lat);
  const minLon = Math.min(...lons) - 0.01;
  const maxLon = Math.max(...lons) + 0.01;
  const minLat = Math.min(...lats) - 0.006;
  const maxLat = Math.max(...lats) + 0.006;
  return {
    centre,
    boundary: {
      type: 'Feature' as const,
      properties: {
        sourceDataset: 'Supplied Townscape Guides data pack',
        boundaryWarning: asString(project.boundaryWarning) ?? 'Curated visitor study boundary.',
      },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [
          [
            [minLon, minLat],
            [maxLon, minLat],
            [maxLon, maxLat],
            [minLon, maxLat],
            [minLon, minLat],
          ],
        ],
      },
    },
  };
}

function packageFromFullPack(fullPack: JsonRecord, visitorPack: JsonRecord): ProjectPackage {
  const project = asRecord(fullPack.project);
  const town = asRecord(visitorPack.town);
  if (!project || !town) throw new Error('Full pack is missing project or visitor town data.');
  const projectId = asString(project.id) ?? projectIdFromPackTown(town);
  const records = asArray(fullPack.records).map((record) => {
    const coordFeature = asRecord(record.geometry);
    const feature: HeritageFeature = {
      id: asString(record.id) ?? `imported:${slugify(asString(record.name) ?? 'feature')}`,
      projectId,
      name: asString(record.name) ?? 'Imported feature',
      alternativeNames: [],
      countryCode: 'GB-SCT',
      region: asString(project.localAuthority) ?? asString(town.council_area),
      locality: asString(town.name) ?? asString(project.name),
      featureType: (asString(record.featureType) ?? 'other') as FeatureType,
      geometry:
        coordFeature?.type === 'Point'
          ? (coordFeature as unknown as HeritageFeature['geometry'])
          : null,
      locationType: 'representative_point',
      documentedDateText: asString(record.documentedDateText),
      earliestPossibleYear: asNumber(record.earliestPossibleYear),
      latestPossibleYear: asNumber(record.latestPossibleYear),
      dateBasis: dateBasis(record.dateBasis),
      dateConfidence: confidence(record.dateConfidence),
      locationConfidence: 'medium',
      shortDescription: asString(record.shortDescription),
      sourceRecords: sourceRecords(record.sourceRecords),
      licence: 'Imported from supplied Townscape Guides town data pack; preserve linked source attribution.',
      tags: ['full-heritage-pack', `${projectId}-full-pack`],
      createdAt: reviewedAt,
      updatedAt: reviewedAt,
      reviewed: true,
    };
    return feature;
  });
  const visitorCoords = [
    ...packAttractions(visitorPack),
    ...packCafes(visitorPack),
    ...packParking(visitorPack),
    ...packTrails(visitorPack),
  ].flatMap((item) => {
    const coord = coordinates(item);
    return coord ? [coord] : [];
  });
  const boundary = projectBoundary(project, records, visitorCoords);
  const pkg: ProjectPackage = {
    project: {
      id: projectId,
      name: asString(town.name) ?? asString(project.name) ?? projectId,
      countryCode: 'GB-SCT',
      country: 'Scotland',
      region: asString(project.localAuthority) ?? asString(town.council_area),
      locality: asString(town.name) ?? asString(project.name) ?? projectId,
      centre: boundary.centre,
      boundary: boundary.boundary,
      boundarySource: `${asString(project.coverageDescription) ?? asString(town.boundary_rule) ?? 'Supplied visitor data pack extent'} This is a curated visitor study boundary, not an administrative boundary.`,
      boundaryConfidence: 'medium',
      sourceLanguage: 'en',
      preferredBasemap: 'openstreetmap',
      createdAt: reviewedAt,
      timelineStart: 1000,
      timelineEnd: 2026,
      methodology: defaultMethodology(),
      researchNotes: asString(town.boundary_rule) ?? asString(project.coverageDescription),
      touristAppeal: touristRating(town),
      townGuide: townGuideFor(town, packAttractions(visitorPack), packCafes(visitorPack)),
    },
    features: records,
    sources: [
      {
        id: 'supplied-town-data-pack',
        name: 'Supplied Townscape Guides town data pack',
        organisation: 'Townscape Guides curation',
        coverage: asString(project.coverageDescription) ?? asString(town.boundary_rule) ?? '',
        accessMethod: 'User-supplied JSON pack imported locally.',
        reliability: 'secondary',
        limitations:
          'Curated visitor study data. The boundary is for app use and is not an administrative or statistical boundary.',
      },
    ],
    historicMaps: [],
    settlementPolygons: [],
    validation: [],
    curationMetadata: {
      importedPacks: [
        {
          datasetId: asString(fullPack.datasetId) ?? projectId,
          title: asString(fullPack.title) ?? `${asString(town.name)} supplied heritage pack`,
          importedAt: reviewedAt,
        },
      ],
    },
  };
  updateProjectFromPack(pkg, visitorPack, {
    upgraded: [],
    added: [],
    skippedNewVisitorOnly: [],
    skippedOutOfBoundary: [],
  });
  pkg.validation = validateFeatures(pkg.project, pkg.features);
  return pkg;
}

function defaultMethodology(): ProjectPackage['project']['methodology'] {
  return {
    age: {
      before_1700: 1,
      '1700_1799': 0.9,
      '1800_1849': 0.8,
      '1850_1899': 0.65,
      '1900_1918': 0.5,
      '1919_1945': 0.4,
      '1946_1960': 0.25,
      after_1960: 0.15,
      unknown: 0.2,
    },
    significance: {
      highest_national: 1,
      national: 0.85,
      regional: 0.65,
      local: 0.45,
      recognised: 0.3,
    },
    confidence: { high: 1, medium: 0.75, low: 0.5, unknown: 0.35 },
    survival: {
      substantially_intact: 1,
      altered_recognisable: 0.75,
      heavily_altered: 0.45,
      site_only_or_demolished: 0.2,
      unknown: 0.6,
    },
  };
}

const plannerCurationPath = resolve('data/visitor-planner-curation.json');
const plannerCuration = JSON.parse(await readFile(plannerCurationPath, 'utf8')) as {
  schemaVersion: 1;
  description: string;
  projects: Record<string, Record<string, string[]>>;
};

async function discoverVisitorPacks(root: string): Promise<Map<string, string>> {
  const paths: string[] = [];
  async function walk(dir: string): Promise<void> {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (/visitor_data_pack_2026-08-04.*\.json$/i.test(entry.name)) paths.push(full);
    }
  }
  await walk(root);
  const packs = new Map<string, string>();
  for (const path of paths.sort()) {
    const pack = JSON.parse(await readFile(path, 'utf8')) as JsonRecord;
    const town = asRecord(pack.town);
    if (!town) continue;
    const projectId = projectIdFromPackTown(town);
    if (!packs.has(projectId) || !basename(path).includes('(1)')) packs.set(projectId, path);
  }
  return packs;
}

async function findFullPack(root: string, projectId: string): Promise<string | undefined> {
  const search = projectId.replace(/-scotland$/, '').replaceAll('-', '_');
  const matches: string[] = [];
  async function walk(dir: string): Promise<void> {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.name.includes('full_heritage_pack') && entry.name.endsWith('.json')) {
        const normalised = entry.name.toLocaleLowerCase();
        if (normalised.includes(search.toLocaleLowerCase())) matches.push(full);
      }
    }
  }
  await walk(root);
  return matches[0];
}

function moduleFile(projectId: string, jsonBaseName: string): string {
  const exportName = `${moduleNameFor(projectId)}Package`;
  return `import packageJson from '../../data/projects/${jsonBaseName}.json';\nimport type { ProjectPackage } from '../domain/models';\n\nexport const ${exportName} = packageJson as unknown as ProjectPackage;\n`;
}

async function main(): Promise<void> {
  const summary: ImportSummary = {
    upgraded: [],
    added: [],
    skippedNewVisitorOnly: [],
    skippedOutOfBoundary: [],
  };
  const packs = await discoverVisitorPacks(importRoot);
  for (const [projectId, packPath] of packs) {
    const pack = JSON.parse(await readFile(packPath, 'utf8')) as JsonRecord;
    if (preserveBespokeProjectIds.has(projectId)) continue;
    const projectPath = projectPathFor(projectId);
    let pkg: ProjectPackage | undefined;
    try {
      pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
      updateProjectFromPack(pkg, pack, summary);
      await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
      summary.upgraded.push(projectId);
      continue;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    const fullPackPath = await findFullPack(importRoot, projectId);
    if (!fullPackPath) {
      const town = asRecord(pack.town);
      summary.skippedNewVisitorOnly.push(`${asString(town?.name) ?? projectId} (${projectId})`);
      continue;
    }
    const fullPack = JSON.parse(await readFile(fullPackPath, 'utf8')) as JsonRecord;
    pkg = packageFromFullPack(fullPack, pack);
    await mkdir(dirname(projectPath), { recursive: true });
    await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
    const jsonBaseName = basename(projectPath, '.json');
    await writeFile(resolve('src/data', `${moduleNameFor(projectId)}.ts`), moduleFile(projectId, jsonBaseName), 'utf8');
    summary.added.push(projectId);
  }
  await writeFile(plannerCurationPath, `${JSON.stringify(plannerCuration, null, 2)}\n`, 'utf8');
  await writeFile(
    resolve('data/review/towns-zip-import-summary-2026-08-04.json'),
    `${JSON.stringify(summary, null, 2)}\n`,
    'utf8',
  );
  console.log(JSON.stringify(summary, null, 2));
}

await main();
