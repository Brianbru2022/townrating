import type { HeritageFeature, ProjectPackage, SourceRecord } from './models';
import { publishedDogAccessForPlace } from '../data/dogAccessCuration';
import { isDogFriendly as hasPositiveDogRating } from './dogAccess';
import { dateWording } from './timeline';
import {
  isMappableVisitFeature,
  isMappableVisitorHighlightFeature,
  topVisitPlaces,
  type VisitPlace,
} from './visiting';
import { attractionVisitPlan, recommendedAttractionDuration } from './attractionVisit';
import {
  publicVisitorUrl,
  publishedFeatureAttractionScore,
  publishedFoodScore,
  publishedTrailScore,
} from './editorialResearch';
import { isPublishableAttraction, isPublishableFood } from './visitorPublication';

export interface OsmDetail {
  key: string;
  value: string;
}

export interface CurrentPlaceInfo {
  osmSource?: SourceRecord;
  curatedPlaceSource?: SourceRecord;
  currentPlaceSource?: SourceRecord;
  currentDetails: OsmDetail[];
  osmDetails: OsmDetail[];
}

export interface VisitorFact {
  label: string;
  value: string;
}

export type VisitorNeed =
  'see' | 'eat' | 'walk' | 'trails' | 'parks' | 'picnic' | 'parking' | 'toilets' | 'photo';

const visitorDiscoveryLimit = 20;

export function visitorNeedDisplayLimit(need: VisitorNeed): number {
  return need === 'see' || need === 'eat' ? visitorDiscoveryLimit : Number.MAX_SAFE_INTEGER;
}

export interface VisitorNeedOptions {
  curatedFeatureIds?: string[];
}

function detailValue(details: OsmDetail[], ...keys: string[]): string | undefined {
  return keys.map((key) => details.find((item) => item.key === key)?.value).find(Boolean);
}

const osmDetailLabels: Record<string, string> = {
  access: 'Access',
  booking: 'Booking',
  capacity: 'Spaces',
  'capacity:charging': 'EV charging spaces',
  'capacity:disabled': 'Accessible spaces',
  'capacity:parent': 'Parent-and-child spaces',
  charge: 'Price',
  confidence: 'Confidence',
  description: 'Description',
  email: 'Email',
  entrance_fee: 'Entry price',
  fee: 'Pricing',
  maxstay: 'Maximum stay',
  parkopedia_capacity: 'Parkopedia spaces',
  height_restriction: 'Height restriction',
  payment_methods: 'Payment methods',
  ev_charging_price: 'EV charging price',
  ev_payment_methods: 'EV payment methods',
  payment_required: 'Payment required',
  price_display: 'Price',
  opening_hours: 'Opening hours',
  'opening_hours:description': 'Opening-hours note',
  operator: 'Operator',
  parking: 'Parking type',
  phone: 'Phone',
  reservation: 'Booking',
  supervised: 'Supervised',
  wheelchair: 'Accessibility',
  toilets: 'Toilets',
  cuisine: 'Cuisine',
  website: 'Website',
  rating: 'Rating',
  rating_count: 'Rating count',
  rating_provider: 'Rating source',
  accessibility: 'Access',
  app: 'App',
  app_note: 'How the app works',
  offline_after_download: 'Offline use',
  best_for: 'Best for',
  distance: 'Distance',
  trail_type: 'Trail type',
  time_to_spend: 'Time to spend',
};

const paymentLabels: Record<string, string> = {
  'payment:app': 'app',
  'payment:cards': 'cards',
  'payment:cash': 'cash',
  'payment:coins': 'coins',
  'payment:contactless': 'contactless',
  'payment:contactless_cards': 'contactless cards',
  'payment:credit_cards': 'credit cards',
  'payment:debit_cards': 'debit cards',
  'payment:mobile_pay': 'mobile pay',
  'payment:notes': 'notes',
};

const friendlyFeatureTypes: Record<string, string> = {
  abbey: 'Abbey',
  archaeological_site: 'Ancient site',
  bridge: 'Bridge',
  burial_ground: 'Burial ground',
  canal: 'Canal',
  castle: 'Castle',
  cathedral: 'Cathedral',
  chapel: 'Chapel',
  church: 'Church or chapel',
  civic_building: 'Civic building',
  commercial_building: 'Historic building',
  country_house: 'Country house',
  designed_landscape: 'Designed landscape',
  dock: 'Harbour or dock',
  garden: 'Garden',
  harbour: 'Harbour',
  market: 'Market place',
  memorial: 'Memorial',
  mill: 'Mill',
  monastery: 'Monastery',
  monument: 'Monument',
  palace: 'Palace',
  park: 'Park',
  plaque: 'Plaque',
  public_art: 'Public art',
  square: 'Square',
  tower: 'Tower',
  walking_route: 'Walking route',
};

const genericPracticalNames = /\b(bench|layby|school|primary|parking)\b/i;

function titleCase(value: string): string {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toLocaleUpperCase());
}

function hasAnyTag(feature: HeritageFeature, tags: readonly string[]): boolean {
  return tags.some((tag) => feature.tags.includes(tag));
}

function sourceIsCurrentPlace(source?: SourceRecord): boolean {
  return Boolean(
    source?.sourceName === 'OpenStreetMap current community places' ||
    source?.notes?.startsWith('Current OSM') ||
    source?.notes?.startsWith('Current-place curation') ||
    source?.notes?.startsWith('Current-context curation') ||
    source?.notes?.startsWith('Current daytime food curation'),
  );
}

export function currentPlaceDetailsFromSource(source?: SourceRecord): OsmDetail[] {
  const notes = source?.notes;
  if (!sourceIsCurrentPlace(source) || !notes) return [];
  const detailText = notes.replace(
    /^(?:Current OSM(?: [^:]+)?|Current-place curation|Current-context curation|Current daytime food curation)\s*:\s*/i,
    '',
  );
  return detailText
    .replace(/\.$/, '')
    .split(';')
    .map((entry) => {
      const separator = entry.indexOf('=');
      if (separator === -1) return undefined;
      return {
        key: entry.slice(0, separator).trim(),
        value: entry.slice(separator + 1).trim(),
      };
    })
    .filter((entry): entry is OsmDetail => Boolean(entry?.key && entry.value));
}

function currentPlaceDetailsFromSources(sources: SourceRecord[]): OsmDetail[] {
  const detailsByKey = new Map<string, OsmDetail>();
  for (const source of sources) {
    for (const detail of currentPlaceDetailsFromSource(source)) {
      detailsByKey.set(detail.key, detail);
    }
  }
  return [...detailsByKey.values()];
}

function currentPlaceDetailsFromFeature(feature: HeritageFeature): OsmDetail[] {
  if (!feature.tags.includes('current-context') || !feature.details?.trim()) return [];
  return feature.details
    .replace(/\.$/, '')
    .split(';')
    .map((entry) => {
      const separator = entry.indexOf('=');
      if (separator === -1) return undefined;
      return {
        key: entry.slice(0, separator).trim(),
        value: entry.slice(separator + 1).trim(),
      };
    })
    .filter((entry): entry is OsmDetail => Boolean(entry?.key && entry.value));
}

export function currentPlaceInfo(feature: HeritageFeature): CurrentPlaceInfo {
  const osmSource = feature.sourceRecords.find(
    (source) => source.sourceName === 'OpenStreetMap current community places',
  );
  const curatedPlaceSource = [...feature.sourceRecords]
    .reverse()
    .find(
      (source) =>
        source.notes?.startsWith('Current-place curation') ||
        source.notes?.startsWith('Current-context curation'),
    );
  const currentPlaceSource = curatedPlaceSource ?? osmSource;
  const detailsByKey = new Map<string, OsmDetail>();
  for (const detail of currentPlaceDetailsFromSources(feature.sourceRecords)) {
    detailsByKey.set(detail.key, detail);
  }
  // Researched audit scripts store visitor facts on the feature itself. Treat
  // these as current context too, with explicit feature details taking
  // precedence over older imported source-note values.
  for (const detail of currentPlaceDetailsFromFeature(feature)) {
    detailsByKey.set(detail.key, detail);
  }
  return {
    osmSource,
    curatedPlaceSource,
    currentPlaceSource,
    currentDetails: [...detailsByKey.values()],
    osmDetails: currentPlaceDetailsFromSource(osmSource),
  };
}

export function osmTagValue(feature: HeritageFeature, key: string): string | undefined {
  return currentPlaceInfo(feature).currentDetails
    .find((detail) => detail.key === key)
    ?.value.replace(/\.$/, '');
}

export function safeExternalUrl(value?: string): string | undefined {
  if (!value) return undefined;
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function osmDetailLabel(key: string): string {
  if (key in paymentLabels) return `Payment - ${paymentLabels[key]}`;
  if (key.startsWith('payment:')) return `Payment - ${titleCase(key.slice('payment:'.length))}`;
  if (key.startsWith('contact:')) return titleCase(key.slice('contact:'.length));
  return osmDetailLabels[key] ?? titleCase(key);
}

function formatOsmValue(value: string): string {
  if (value === 'yes') return 'Yes';
  if (value === 'no') return 'No';
  if (value === 'limited') return 'Limited';
  if (value === 'public') return 'Public';
  if (value === 'customers') return 'Customers only';
  return value.replaceAll('_', ' ');
}

function paymentSummary(details: OsmDetail[]): string | undefined {
  const accepted = details
    .filter((detail) => detail.key.startsWith('payment:') && detail.value === 'yes')
    .map((detail) => paymentLabels[detail.key] ?? titleCase(detail.key.slice('payment:'.length)));
  if (accepted.length) return accepted.join(', ');
  const unavailable = details
    .filter((detail) => detail.key.startsWith('payment:') && detail.value === 'no')
    .map((detail) => paymentLabels[detail.key] ?? titleCase(detail.key.slice('payment:'.length)));
  if (unavailable.length) return `Not ${unavailable.join(', ')}`;
  return undefined;
}

const parkingQuickFactKeys = new Set([
  'access',
  'covered',
  'parking',
  'capacity',
  'capacity:disabled',
  'capacity:charging',
  'charge',
  'fee',
  'price_display',
  'payment_required',
  'payment_methods',
  'ev_charging_price',
  'ev_payment_methods',
  'maxstay',
  'parkopedia_capacity',
  'height_restriction',
  'live_availability',
  'confidence',
]);

function parkingTypeLabel(details: OsmDetail[]): string {
  const parkingType = detailValue(details, 'parking');
  const covered = detailValue(details, 'covered');
  if (covered === 'yes') return 'Covered parking';
  if (parkingType === 'multi-storey') return 'Multi-storey car park';
  if (parkingType === 'underground') return 'Underground car park';
  if (parkingType === 'street_side') return 'On-street parking';
  if (parkingType === 'surface') return 'Open surface car park';
  if (parkingType) return `${formatOsmValue(parkingType)} parking`;
  return 'Open car park';
}

export function visitorPlaceType(feature: HeritageFeature): string {
  const visitorType = detailValue(currentPlaceInfo(feature).currentDetails, 'visitor_place_type');
  if (visitorType) return visitorType;
  const amenity = osmTagValue(feature, 'amenity');
  const shop = osmTagValue(feature, 'shop');
  const leisure = osmTagValue(feature, 'leisure');
  const tourism = osmTagValue(feature, 'tourism');
  const historic = osmTagValue(feature, 'historic');
  const information = osmTagValue(feature, 'information');
  const natural = osmTagValue(feature, 'natural');
  const waterway = osmTagValue(feature, 'waterway');

  if (tourism === 'picnic_site' || feature.featureType === 'picnic_site') return 'Picnic area';
  if (leisure === 'picnic_table') return 'Picnic table';
  if (leisure === 'outdoor_seating') return 'Outdoor seating';
  if (amenity === 'bench') return 'Bench';
  if (amenity === 'bbq') return 'Barbecue spot';
  if (amenity === 'cafe') return 'Cafe';
  if (amenity === 'ice_cream') return 'Ice-cream stop';
  if (amenity === 'restaurant') return 'Restaurant';
  if (amenity === 'toilets' || feature.featureType === 'toilets') return 'Public toilets';
  if (amenity === 'drinking_water') return 'Drinking water';
  if (amenity === 'parking') return 'Parking';
  if (shop === 'bakery') return 'Bakery';
  if (shop === 'coffee') return 'Coffee shop';
  if (tourism === 'museum') return 'Museum';
  if (tourism === 'gallery') return 'Gallery';
  if (tourism === 'artwork') return 'Public art';
  if (tourism === 'viewpoint') return 'Viewpoint';
  if (tourism === 'information')
    return information ? titleCase(information) : 'Visitor information';
  if (leisure === 'park') return 'Park';
  if (leisure === 'playground') return 'Playground';
  if (waterway === 'waterfall') return 'Waterfall';
  if (natural === 'cave_entrance') return 'Cave entrance';
  if (historic === 'memorial') return 'Memorial';
  if (historic === 'archaeological_site') return 'Ancient site';
  return friendlyFeatureTypes[feature.featureType] ?? titleCase(feature.featureType);
}

export function isFoodAndDrinkFeature(pkg: ProjectPackage, feature: HeritageFeature): boolean {
  if (!isMappableVisitFeature(pkg, feature)) return false;
  return hasFoodAndDrinkSemantics(feature);
}

function hasFoodAndDrinkSemantics(feature: HeritageFeature): boolean {
  const amenity = osmTagValue(feature, 'amenity');
  const shop = osmTagValue(feature, 'shop');
  return (
    hasAnyTag(feature, ['service-context-food', 'osm-community-food']) ||
    ['cafe', 'ice_cream', 'restaurant'].includes(amenity ?? '') ||
    ['bakery', 'coffee'].includes(shop ?? '')
  );
}

function foodPlaceFromFeature(pkg: ProjectPackage, feature: HeritageFeature): VisitPlace | undefined {
  const score = foodAndDrinkScore(feature);
  if (score === undefined) return undefined;
  const dogAccess = publishedDogAccessForPlace(pkg.project.id, 'eat', feature.id);
  const place: VisitPlace = {
    id: feature.id,
    name: feature.name,
    reason: placeReason(feature),
    tagline: visitorDescriptionParts(feature).tagline,
    summary: feature.shortDescription,
    visitorScore: score,
    openingTimes: openingTimes(feature),
    priceBand: priceBand(feature),
    dogFriendly: dogAccess ? hasPositiveDogRating(dogAccess) : undefined,
    dogAccess,
    externalUrl: externalUrlForFeature(feature),
  };
  return isPublishableFood({ ...place, foodStyle: foodStyle(feature) }) ? place : undefined;
}

export function isPracticalStopFeature(pkg: ProjectPackage, feature: HeritageFeature): boolean {
  if (!isMappableVisitFeature(pkg, feature)) return false;
  const amenity = osmTagValue(feature, 'amenity');
  const tourism = osmTagValue(feature, 'tourism');
  const information = osmTagValue(feature, 'information');
  return (
    hasAnyTag(feature, [
      'service-context-parking',
      'service-context-toilets',
      'osm-community-amenities',
      'osm-community-parking',
      'osm-community-visitor',
    ]) ||
    ['toilets', 'drinking_water', 'parking'].includes(amenity ?? '') ||
    tourism === 'information' ||
    Boolean(information)
  );
}

function curatedVisitScore(feature: HeritageFeature): number | undefined {
  const value = Number(
    detailValue(currentPlaceInfo(feature).currentDetails, 'visit_score', 'trail_score'),
  );
  return Number.isFinite(value) ? value : undefined;
}

function priceBand(feature: HeritageFeature): string | undefined {
  return detailValue(currentPlaceInfo(feature).currentDetails, 'price_band');
}

function foodStyle(feature: HeritageFeature): string | undefined {
  return detailValue(currentPlaceInfo(feature).currentDetails, 'cuisine', 'food_style')
    ?.replaceAll('_', ' ');
}

function admissionPrice(feature: HeritageFeature): string | undefined {
  return detailValue(currentPlaceInfo(feature).currentDetails, 'entrance_fee', 'charge', 'fee');
}

function hasFreeAdmission(feature: HeritageFeature): boolean | undefined {
  const price = admissionPrice(feature);
  if (!price) return undefined;
  return /^free\b|^no$/i.test(price);
}

export type ParkingPriceStatus = 'free' | 'paid' | 'unknown';

export function parkingPriceStatus(feature: HeritageFeature): ParkingPriceStatus {
  if (visitorPlaceType(feature) !== 'Parking') return 'unknown';
  const priceKeys = new Set([
    'price_display',
    'parking_fee',
    'parking:fee',
    'charge',
    'fee',
    'entrance_fee',
    'payment_required',
  ]);
  const prices = currentPlaceInfo(feature).currentDetails
    .filter((detail) => priceKeys.has(detail.key))
    .map((detail) => detail.value.trim());
  if (!prices.length) return 'unknown';
  if (
    prices.some(
      (price) =>
        /£(?!0(?:\D|$))|\$|€|\bper\b|\bhour\b|\bminute\b|\btariff\b/i.test(price) ||
        /^(yes|paid|pay)$/i.test(price),
    )
  ) {
    return 'paid';
  }
  if (
    prices.some(
      (price) =>
        /^(no|free|none|£0(?:\.00)?|0)$/i.test(price) ||
        /no payment required|\bfree\b/i.test(price),
    )
  ) {
    return 'free';
  }
  return 'unknown';
}

function openingTimes(feature: HeritageFeature): string | undefined {
  return detailValue(
    currentPlaceInfo(feature).currentDetails,
    'opening_hours:description',
    'opening_hours',
  );
}

function isDogFriendly(feature: HeritageFeature): boolean {
  const details = currentPlaceInfo(feature).currentDetails;
  const explicitValue = detailValue(details, 'dog', 'dogs', 'dog_friendly');
  if (explicitValue && /^(yes|true|friendly|allowed)$/i.test(explicitValue)) return true;
  return /dog friendly|dogs welcome|dog-friendly/i.test(
    [
      feature.shortDescription,
      detailValue(details, 'description'),
      feature.reviewNotes,
      ...feature.sourceRecords.map((source) => source.notes),
    ]
      .filter(Boolean)
      .join(' '),
  );
}

function sentenceCase(text: string): string {
  return text ? `${text.charAt(0).toLocaleUpperCase()}${text.slice(1)}` : text;
}

const curatedFoodTaglines: Array<{
  name: RegExp;
  tagline: string;
  removeFromDescription?: RegExp;
  description?: string;
}> = [
  {
    name: /garden cafe at pathhead farm/i,
    tagline: 'Best all-round',
    removeFromDescription: /^Best all-round option:\s*/i,
  },
  {
    name: /88 degrees coffee house|88°/i,
    tagline: 'Best coffee & cake',
    removeFromDescription: /^Best dedicated town-centre coffee shop,\s*with\s*/i,
  },
  {
    name: /airlie arms/i,
    tagline: 'Full-menu choice',
    removeFromDescription: /^The most dependable full-menu option in the centre,\s*/i,
  },
  {
    name: /three bellies brae/i,
    tagline: 'Pub lunch',
    removeFromDescription:
      /^A characterful traditional bar and lunch stop rather than a coffee shop,\s*/i,
  },
  {
    name: /saucy asian/i,
    tagline: 'Asian street food',
    removeFromDescription: /^The most distinctive food option in town:\s*/i,
  },
  {
    name: /lee's takeaway|lees takeaway/i,
    tagline: 'Budget breakfast',
    removeFromDescription:
      /^A modest, inexpensive breakfast and lunch cafe and takeaway with limited seating,\s*/i,
  },
  {
    name: /cafe obscura/i,
    tagline: 'Hilltop cafe',
    removeFromDescription:
      /^Worth choosing for its unusual hilltop setting rather than menu depth\.\s*/i,
    description:
      'Coffee, tea, filled rolls, scones, cakes, cold drinks and ice cream beside the Camera Obscura and Kirrie Hill.',
  },
  {
    name: /longer table/i,
    tagline: 'Community coffee',
    description:
      'Tea, barista-style coffee and cake in a community coffee room and refill-shop setting.',
  },
];

function compactParsedTagline(tagline: string): string {
  return tagline
    .replace(/\s+option$/i, '')
    .replace(/^The most distinctive food option in town$/i, 'Distinctive food')
    .replace(
      /^Worth choosing for its unusual hilltop setting rather than menu depth$/i,
      'Hilltop cafe',
    )
    .trim();
}

export function visitorDescriptionParts(feature: HeritageFeature): {
  tagline?: string;
  description?: string;
} {
  const details = currentPlaceInfo(feature).currentDetails;
  const explicitTagline = detailValue(details, 'tagline', 'highlight_pill');
  const description = detailValue(details, 'description') ?? feature.shortDescription;
  if (!description) return explicitTagline ? { tagline: explicitTagline } : {};
  if (explicitTagline) return { tagline: explicitTagline, description };
  const curatedFoodTagline = curatedFoodTaglines.find((item) => item.name.test(feature.name));
  if (curatedFoodTagline) {
    const cleaned = curatedFoodTagline.removeFromDescription
      ? description.replace(curatedFoodTagline.removeFromDescription, '').trim()
      : description;
    return {
      tagline: curatedFoodTagline.tagline,
      description: curatedFoodTagline.description ?? sentenceCase(cleaned),
    };
  }
  const match = /^([^:.!?]{4,72})(?::\s+|\.\s+)(.+)$/u.exec(description);
  if (!match) return { description };
  const [, tagline, body] = match;
  return {
    tagline: compactParsedTagline(tagline.trim()),
    description: sentenceCase(body.trim()),
  };
}

export function foodAndDrinkScore(feature: HeritageFeature): number | undefined {
  return publishedFoodScore(
    feature,
    curatedVisitScore(feature),
    visitorDescriptionParts(feature).description ?? feature.shortDescription,
  );
}

function practicalPriority(feature: HeritageFeature): number {
  const amenity = osmTagValue(feature, 'amenity');
  const tourism = osmTagValue(feature, 'tourism');
  const information = osmTagValue(feature, 'information');
  if (amenity === 'toilets') return 90;
  if (amenity === 'drinking_water') return 78;
  if (tourism === 'information' || information) return 70;
  if (amenity === 'parking') return genericPracticalNames.test(feature.name) ? 50 : 62;
  if (hasAnyTag(feature, ['osm-community-parking', 'service-context-parking'])) return 56;
  return 45;
}

function placeReason(feature: HeritageFeature): string {
  const details = currentPlaceInfo(feature).currentDetails;
  const detail = (key: string) => details.find((item) => item.key === key)?.value;
  const type = visitorPlaceType(feature);
  const opening = detail('opening_hours') ?? detail('opening_hours:description');
  const cuisine = detail('cuisine');
  const { description } = visitorDescriptionParts(feature);
  if (isTrailFeature(feature)) {
    return (
      description ??
      feature.shortDescription ??
      `${feature.name} is a downloadable self-guided trail.`
    );
  }
  if (type === 'Parking' && feature.shortDescription) return feature.shortDescription;
  if (type === 'Public toilets' && feature.shortDescription) return feature.shortDescription;
  if (visitorInterestLabel(feature) === 'Food & drink' && description) return description;
  if (opening) return `${type} with mapped opening information.`;
  if (cuisine) return `${type} with ${cuisine.replaceAll('_', ' ')} noted.`;
  if (type === 'Parking') return 'Useful when planning where to leave the car.';
  if (type === 'Public toilets') return 'Useful comfort stop while exploring.';
  if (type === 'Drinking water') return 'Useful water stop while walking.';
  if (['Picnic area', 'Picnic table', 'Outdoor seating', 'Bench', 'Barbecue spot'].includes(type))
    return `${type} for a slower pause between sights.`;
  return `${type} inside the town boundary.`;
}

function uniqueByName(features: HeritageFeature[]): HeritageFeature[] {
  const byName = new Map<string, HeritageFeature>();
  for (const feature of features) {
    const key = feature.name.toLocaleLowerCase();
    if (!byName.has(key)) byName.set(key, feature);
  }
  return [...byName.values()];
}

export function topFoodAndDrink(pkg: ProjectPackage, limit = 3): VisitPlace[] {
  const usedNames = new Set<string>();
  const usedTaglines = new Set<string>();
  return pkg.features
    .filter((feature) => isFoodAndDrinkFeature(pkg, feature))
    .map((feature) => ({ feature, place: foodPlaceFromFeature(pkg, feature) }))
    .filter((candidate): candidate is { feature: HeritageFeature; place: VisitPlace } =>
      candidate.place !== undefined)
    .sort(
      (left, right) =>
        (right.place.visitorScore ?? 0) - (left.place.visitorScore ?? 0) ||
        left.feature.name.localeCompare(right.feature.name),
    )
    .filter(({ feature }) => {
      const nameKey = feature.name.toLocaleLowerCase('en-GB');
      if (usedNames.has(nameKey)) return false;
      usedNames.add(nameKey);
      return true;
    })
    .map(({ place }) => place)
    .filter((place) => {
      const taglineKey = place.tagline?.trim().toLocaleLowerCase('en-GB');
      if (!taglineKey || usedTaglines.has(taglineKey)) return false;
      usedTaglines.add(taglineKey);
      return true;
    })
    .slice(0, limit);
}

export function practicalStops(pkg: ProjectPackage, limit = 5): VisitPlace[] {
  return uniqueByName(pkg.features.filter((feature) => isPracticalStopFeature(pkg, feature)))
    .sort(
      (left, right) =>
        practicalPriority(right) - practicalPriority(left) || left.name.localeCompare(right.name),
    )
    .slice(0, limit)
    .map((feature) => ({
      id: feature.id,
      name: feature.name,
      reason: placeReason(feature),
      summary: feature.shortDescription,
    }));
}

export function visitPlaceFromFeature(feature: HeritageFeature): VisitPlace {
  const parkingStatus = parkingPriceStatus(feature);
  const admission = admissionPrice(feature);
  const placeType = visitorPlaceType(feature);
  const parkingPricing = placeType === 'Parking'
    ? visitorFacts(feature).find((fact) => fact.label === 'Pricing')?.value
    : undefined;
  const isStandaloneAttraction =
    (feature.tags.includes('home-standalone-place') || Boolean(feature.attractionGuide)) &&
    !['Cafe', 'Restaurant', 'Parking', 'Public toilets', 'Picnic site'].includes(placeType);
  const rawVisitorScore = curatedVisitScore(feature);
  const visitorCopy = visitorDescriptionParts(feature).description ?? feature.shortDescription;
  const visitorScore = visitorInterestLabel(feature) === 'Food & drink'
    ? publishedFoodScore(feature, rawVisitorScore, visitorCopy)
    : isTrailFeature(feature)
      ? publishedTrailScore(feature, rawVisitorScore)
      : isStandaloneAttraction
        ? publishedFeatureAttractionScore(feature, rawVisitorScore, visitorCopy)
        : undefined;
  const visitPlan = isStandaloneAttraction
    ? attractionVisitPlan(feature, visitorScore)
    : undefined;
  const trailTimeToSpend = isTrailFeature(feature)
    ? visitorFacts(feature).find((fact) => fact.label === 'Time to spend')?.value
    : undefined;
  const dogAccess =
    publishedDogAccessForPlace(feature.projectId, 'eat', feature.id) ??
    publishedDogAccessForPlace(feature.projectId, 'attraction', feature.id);
  const legacyDogFriendly = isDogFriendly(feature);
  return {
    id: feature.id,
    name: feature.name,
    reason: placeReason(feature),
    tagline: visitorDescriptionParts(feature).tagline,
    summary: feature.shortDescription,
    externalUrl: externalUrlForFeature(feature),
    visitorScore,
    timeToSpend: visitPlan?.timeToSpend ?? trailTimeToSpend,
    openingTimes: openingTimes(feature) ?? visitPlan?.openingTimes,
    admission:
      parkingStatus === 'paid'
        ? (parkingPricing ?? admission ?? 'Pay')
        : (admission ?? visitPlan?.admission),
    priceBand: priceBand(feature),
    freeAdmission:
      placeType === 'Parking' ? parkingStatus === 'free' : hasFreeAdmission(feature),
    parkingPriceStatus:
      visitorPlaceType(feature) === 'Parking' ? parkingStatus : undefined,
    dogFriendly: dogAccess ? hasPositiveDogRating(dogAccess) : legacyDogFriendly,
    dogAccess,
    attractionGuide: visitPlan
      ? {
          ...feature.attractionGuide,
          parking: feature.attractionGuide?.parking ?? visitPlan.parking,
          toilets: feature.attractionGuide?.toilets ?? visitPlan.toilets,
          picnic: feature.attractionGuide?.picnic ?? visitPlan.picnic,
          foodNote:
            feature.attractionGuide?.foodNote ??
            (feature.attractionGuide?.food?.length ? undefined : visitPlan.foodNote),
        }
      : feature.attractionGuide,
  };
}

export function isPublishableFeatureVisitPlace(
  feature: HeritageFeature,
  place: VisitPlace,
  kind: 'attraction' | 'eat',
): boolean {
  return kind === 'eat'
    ? isPublishableFood({ ...place, foodStyle: foodStyle(feature) })
    : isPublishableAttraction(place);
}

function externalUrlForFeature(feature: HeritageFeature): string | undefined {
  const info = currentPlaceInfo(feature);
  return publicVisitorUrl(
    feature.visitorWebsiteUrl,
    info.currentDetails.find((detail) => detail.key === 'website')?.value,
    info.currentDetails.find((detail) => detail.key === 'external_url')?.value,
    info.osmDetails.find((detail) => detail.key === 'website')?.value,
    info.osmDetails.find((detail) => detail.key === 'external_url')?.value,
  );
}

function isParkingFeature(feature: HeritageFeature): boolean {
  if (visitorPlaceType(feature) !== 'Parking' || osmTagValue(feature, 'access') === 'customers') {
    return false;
  }
  if (!/^parking$/i.test(feature.name)) return true;
  const details = currentPlaceInfo(feature).currentDetails;
  return Boolean(
    detailValue(
      details,
      'access',
      'capacity',
      'capacity:disabled',
      'capacity:charging',
      'fee',
      'price_display',
      'payment_required',
      'maxstay',
    ),
  );
}

function isToiletFeature(feature: HeritageFeature): boolean {
  return visitorPlaceType(feature) === 'Public toilets';
}

function isParkPlayOrRestFeature(feature: HeritageFeature): boolean {
  const type = visitorPlaceType(feature);
  const leisure = osmTagValue(feature, 'leisure');
  return (
    type === 'Park' ||
    type === 'Playground' ||
    leisure === 'park' ||
    leisure === 'playground' ||
    hasAnyTag(feature, ['service-context-park', 'service-context-leisure', 'osm-current-park'])
  );
}

function isPicnicFeature(feature: HeritageFeature, includeRestStops = false): boolean {
  const type = visitorPlaceType(feature);
  const amenity = osmTagValue(feature, 'amenity');
  const leisure = osmTagValue(feature, 'leisure');
  const tourism = osmTagValue(feature, 'tourism');
  const isCorePicnicPlace =
    ['Picnic area', 'Picnic table', 'Barbecue spot'].includes(type) ||
    tourism === 'picnic_site' ||
    leisure === 'picnic_table' ||
    amenity === 'bbq';
  if (isCorePicnicPlace) return true;
  if (!includeRestStops) return false;
  return (
    ['Outdoor seating', 'Bench'].includes(type) ||
    leisure === 'outdoor_seating' ||
    amenity === 'bench' ||
    hasAnyTag(feature, ['service-context-picnic', 'osm-community-picnic'])
  );
}

function isWalkingFeature(feature: HeritageFeature): boolean {
  const type = visitorPlaceType(feature);
  const tourism = osmTagValue(feature, 'tourism');
  const route = osmTagValue(feature, 'route');
  const highway = osmTagValue(feature, 'highway');
  const waterway = osmTagValue(feature, 'waterway');
  const natural = osmTagValue(feature, 'natural');
  const nameLooksWalkable =
    /\b(walk|trail|path|way|glen|viewpoint|loch|river|burn|waterfall)\b/i.test(feature.name);
  if (isParkPlayOrRestFeature(feature) || isParkingFeature(feature) || isToiletFeature(feature)) {
    return false;
  }
  if (isTrailFeature(feature)) return false;
  return (
    type === 'Viewpoint' ||
    waterway === 'waterfall' ||
    natural === 'cave_entrance' ||
    route === 'hiking' ||
    route === 'foot' ||
    ['footway', 'path', 'bridleway', 'cycleway'].includes(highway ?? '') ||
    tourism === 'viewpoint' ||
    (hasAnyTag(feature, ['osm-community-nature', 'service-context-walk']) && nameLooksWalkable)
  );
}

function isTrailFeature(feature: HeritageFeature): boolean {
  const externalUrl = externalUrlForFeature(feature);
  if (!externalUrl) return false;
  if (
    hasAnyTag(feature, [
      'visitor-context-trail',
      'service-context-trail',
      'service-context-trails',
    ])
  ) {
    return true;
  }
  const details = [
    feature.name,
    feature.shortDescription,
    feature.fullDescription,
    feature.reviewNotes,
    ...feature.tags,
    ...feature.sourceRecords.flatMap((source) => [
      source.sourceName,
      source.sourceOrganisation,
      source.notes,
      source.sourceUrl,
    ]),
  ]
    .filter(Boolean)
    .join(' ');
  return /\b(town trails?|treasure trails?|heritage trails?|history trails?|historic trails?|walking tours?|audio trails?|trail routes?|trail maps?|itinerar(?:y|ies))\b/i.test(
    details,
  );
}

function needPriority(feature: HeritageFeature, need: VisitorNeed): number {
  const type = visitorPlaceType(feature);
  const tourism = osmTagValue(feature, 'tourism');
  const waterway = osmTagValue(feature, 'waterway');
  if (need === 'parking') return isParkingFeature(feature) ? practicalPriority(feature) : 0;
  if (need === 'toilets') return isToiletFeature(feature) ? 100 : 0;
  if (need === 'photo') {
    if (type === 'Viewpoint' || waterway === 'waterfall') return 100;
    if (['Public art', 'Museum', 'Gallery'].includes(type)) return 72;
    if (hasAnyTag(feature, ['service-context-heritage', 'osm-community-historic'])) return 62;
    return 0;
  }
  if (need === 'parks') {
    if (!isParkPlayOrRestFeature(feature)) return 0;
    if (type === 'Park') return 96;
    if (type === 'Playground') return 88;
    return 70;
  }
  if (need === 'picnic') {
    if (!isPicnicFeature(feature)) return 0;
    if (tourism === 'picnic_site') return 96;
    if (type === 'Picnic table') return 90;
    if (type === 'Outdoor seating') return 84;
    if (type === 'Barbecue spot') return 80;
    return 70;
  }
  if (need === 'trails') return isTrailFeature(feature) ? 100 : 0;
  if (need === 'walk') return isWalkingFeature(feature) ? (type === 'Viewpoint' ? 96 : 78) : 0;
  return 0;
}

function placesForNeed(pkg: ProjectPackage, need: VisitorNeed, limit: number): VisitPlace[] {
  const features = uniqueByName(
    pkg.features.filter(
      (feature) => isMappableVisitFeature(pkg, feature) && needPriority(feature, need) > 0,
    ),
  );

  if (need === 'trails') {
    return features
      .map(visitPlaceFromFeature)
      .sort(
        (left, right) =>
          (right.visitorScore ?? Number.NEGATIVE_INFINITY) -
            (left.visitorScore ?? Number.NEGATIVE_INFINITY) ||
          left.name.localeCompare(right.name),
      )
      .slice(0, limit);
  }

  return features
    .sort(
      (left, right) =>
        needPriority(right, need) - needPriority(left, need) || left.name.localeCompare(right.name),
    )
    .slice(0, limit)
    .map(visitPlaceFromFeature);
}

function curatedFeatureMatchesNeed(
  pkg: ProjectPackage,
  feature: HeritageFeature,
  need: VisitorNeed,
): boolean {
  // An explicitly curated connected trailhead or practical stop may sit just
  // outside the settlement polygon. It must be marked related_context; normal
  // parish/out-of-scope records remain excluded so nearby attractions cannot
  // inflate a town audit by accident.
  if (!isMappableVisitorHighlightFeature(pkg, feature)) return false;
  if (need === 'eat') return hasFoodAndDrinkSemantics(feature);
  if (need === 'see') return true;
  if (need === 'picnic') return isPicnicFeature(feature, true);
  return needPriority(feature, need) > 0;
}

function curatedPlacesForNeed(
  pkg: ProjectPackage,
  need: VisitorNeed,
  curatedFeatureIds: string[],
  limit: number,
): VisitPlace[] {
  const curatedIds = new Set(curatedFeatureIds);
  if (need === 'see') {
    return topVisitPlaces(pkg, Number.MAX_SAFE_INTEGER)
      .filter((place) => curatedIds.has(place.id))
      .slice(0, limit);
  }
  if (need === 'eat') {
    const featuresById = new Map(pkg.features.map((feature) => [feature.id, feature]));
    return curatedFeatureIds
      .map((featureId) => featuresById.get(featureId))
      .filter((feature): feature is HeritageFeature =>
        Boolean(feature && curatedFeatureMatchesNeed(pkg, feature, need)))
      .map((feature) => foodPlaceFromFeature(pkg, feature))
      .filter((place): place is VisitPlace => place !== undefined)
      .filter((place) => curatedIds.has(place.id))
      .sort(
        (left, right) =>
          (right.visitorScore ?? Number.NEGATIVE_INFINITY) -
            (left.visitorScore ?? Number.NEGATIVE_INFINITY) ||
          left.name.localeCompare(right.name),
      )
      .slice(0, limit);
  }
  const featuresById = new Map(pkg.features.map((feature) => [feature.id, feature]));
  const places = curatedFeatureIds
    .map((featureId) => featuresById.get(featureId))
    .filter((feature): feature is HeritageFeature =>
      Boolean(feature && curatedFeatureMatchesNeed(pkg, feature, need)),
    )
    .map(visitPlaceFromFeature);

  if (need === 'trails') {
    places.sort(
      (left, right) =>
        (right.visitorScore ?? Number.NEGATIVE_INFINITY) -
          (left.visitorScore ?? Number.NEGATIVE_INFINITY) ||
        left.name.localeCompare(right.name),
    );
  }

  return places.slice(0, limit);
}

export function visitorNeedPlaces(
  pkg: ProjectPackage,
  need: VisitorNeed,
  limit = 5,
  options: VisitorNeedOptions = {},
): VisitPlace[] {
  if (options.curatedFeatureIds) {
    return curatedPlacesForNeed(pkg, need, options.curatedFeatureIds, limit);
  }
  if (need === 'see') return topVisitPlaces(pkg, limit);
  if (need === 'eat') return topFoodAndDrink(pkg, limit);
  return placesForNeed(pkg, need, limit);
}

export function visitorInterestLabel(feature: HeritageFeature): string {
  if (hasAnyTag(feature, ['service-context-food', 'osm-community-food'])) return 'Food & drink';
  if (hasAnyTag(feature, ['service-context-picnic', 'osm-community-picnic']))
    return 'Picnic & rest';
  if (
    hasAnyTag(feature, [
      'service-context-parking',
      'service-context-toilets',
      'osm-community-amenities',
      'osm-community-parking',
    ])
  )
    return 'Practical stop';
  if (hasAnyTag(feature, ['service-context-heritage', 'service-context-visitor']))
    return 'Visitor highlight';
  if (hasAnyTag(feature, ['osm-community-art', 'osm-community-historic', 'osm-community-nature']))
    return 'Quick visitor stop';
  if (feature.featureType === 'archaeological_site' && feature.dateConfidence === 'low')
    return 'Specialist interest';
  return feature.significance === 'highest_national' || feature.significance === 'national'
    ? 'Historic highlight'
    : 'Historic place';
}

function isCurrentVisitorContext(feature: HeritageFeature): boolean {
  return [
    'service-context-food',
    'osm-community-food',
    'service-context-picnic',
    'osm-community-picnic',
    'service-context-parking',
    'service-context-toilets',
    'osm-community-amenities',
    'osm-community-parking',
    'service-context-walk',
    'service-context-park',
    'osm-community-leisure',
  ].some((tag) => feature.tags.includes(tag));
}

export function visitorPitch(feature: HeritageFeature): string {
  const info = currentPlaceInfo(feature);
  const details = info.currentDetails;
  const description = details.find((detail) => detail.key === 'description')?.value;
  const type = visitorPlaceType(feature);
  const interest = visitorInterestLabel(feature);
  const isCurrent = Boolean(info.osmSource);
  if (isCurrent) {
    if (type === 'Parking') {
      return 'A practical place to check before you arrive, especially if you are using the town as a short walking stop. Availability and restrictions can change, so check signs when you park.';
    }
    if (type === 'Public toilets') {
      return 'A useful comfort stop to know about before you start exploring the town centre or nearby sights. Opening and accessibility details may change locally.';
    }
    if (type === 'Drinking water') {
      return 'A handy water stop for a walk around town. Check locally before relying on it for a longer route.';
    }
    if (
      ['Picnic area', 'Picnic table', 'Outdoor seating', 'Bench', 'Barbecue spot'].includes(type)
    ) {
      return `${feature.name} is a handy ${type.toLocaleLowerCase()} for a low-key pause between the main stops.`;
    }
    if (interest === 'Food & drink') {
      return (
        description ??
        `A handy ${type.toLocaleLowerCase()} for building a more relaxed stop around the main sights.`
      );
    }
    if (description) return description;
    if (
      info.curatedPlaceSource ||
      interest === 'Visitor highlight' ||
      interest === 'Quick visitor stop'
    ) {
      return `${feature.name} makes an easy ${type.toLocaleLowerCase()} stop while exploring the town.`;
    }
    return `${feature.name} can help with practical planning during a town visit.`;
  }
  if (description) return description;
  if (feature.shortDescription) return feature.shortDescription;
  return `${feature.name} is a source-backed historic place in the town record. More provenance is available in Source notes.`;
}

export function visitorFacts(feature: HeritageFeature): VisitorFact[] {
  const info = currentPlaceInfo(feature);
  const details = info.currentDetails;
  const detail = (key: string) => detailValue(details, key);
  const type = visitorPlaceType(feature);
  const interest = visitorInterestLabel(feature);
  if (type === 'Parking') {
    const facts: VisitorFact[] = [{ label: 'Parking type', value: parkingTypeLabel(details) }];
    const access = detail('access');
    if (access) facts.push({ label: 'Access', value: formatOsmValue(access) });
    const spaces = detail('capacity');
    if (spaces) facts.push({ label: 'Spaces', value: spaces });
    const accessibleSpaces = detail('capacity:disabled');
    if (accessibleSpaces) facts.push({ label: 'Accessible spaces', value: accessibleSpaces });
    const evSpaces = detail('capacity:charging');
    if (evSpaces) facts.push({ label: 'EV charging spaces', value: evSpaces });
    const parkopediaSpaces = detail('parkopedia_capacity');
    if (parkopediaSpaces && parkopediaSpaces !== spaces) {
      facts.push({ label: 'Parkopedia spaces', value: parkopediaSpaces });
    }
    const opening = detail('opening_hours:description') ?? detail('opening_hours');
    if (opening) facts.push({ label: 'Hours', value: opening });
    const heightRestriction = detail('height_restriction');
    if (heightRestriction) {
      facts.push({ label: 'Height restriction', value: heightRestriction });
    }
    const priceDisplay = detail('price_display');
    const pricing = priceDisplay ?? detailValue(details, 'charge', 'fee');
    if (pricing) {
      facts.push({
        label: 'Pricing',
        value: pricing === 'no' ? 'Free' : formatOsmValue(pricing),
      });
    }
    const maxStay = detail('maxstay');
    if (maxStay) facts.push({ label: 'Max stay', value: maxStay });
    const payment = detail('payment_methods') ?? paymentSummary(details);
    const paymentRequired = detail('payment_required');
    if (payment) facts.push({ label: 'Payment', value: payment });
    else if (paymentRequired === 'no')
      facts.push({ label: 'Payment', value: 'No payment required' });
    const evPrice = detail('ev_charging_price');
    if (evPrice) facts.push({ label: 'EV charging price', value: evPrice });
    const evPayment = detail('ev_payment_methods');
    if (evPayment) facts.push({ label: 'EV payment', value: evPayment });
    return facts;
  }
  if (isTrailFeature(feature)) {
    const facts: VisitorFact[] = [
      { label: 'Trail type', value: detail('trail_type') ?? 'Self-guided trail' },
    ];
    const bestFor = detail('best_for');
    if (bestFor) facts.push({ label: 'Best for', value: bestFor });
    const distance = detail('distance');
    if (distance) facts.push({ label: 'Distance', value: distance });
    facts.push({ label: 'Time to spend', value: detail('time_to_spend') ?? 'Allow 1-2 hours' });
    const access = detail('accessibility');
    if (access) facts.push({ label: 'Access', value: access });
    const price = detailValue(details, 'entrance_fee', 'charge', 'fee');
    if (price) facts.push({ label: 'Price', value: formatOsmValue(price) });
    const app = detail('app');
    if (app) facts.push({ label: 'App', value: app });
    const appNote = detail('app_note');
    if (appNote) facts.push({ label: 'How the app works', value: appNote });
    if (detail('offline_after_download') === 'yes') {
      facts.push({ label: 'Offline use', value: 'Works offline after download' });
    }
    return facts;
  }
  const facts: VisitorFact[] = [
    { label: 'Place type', value: type },
    {
      label: 'Good for',
      value:
        interest === 'Practical stop'
          ? 'Planning a smoother visit'
          : interest === 'Food & drink'
            ? 'A food or coffee stop while exploring'
            : 'A quick look while exploring the town',
    },
  ];
  if (interest !== 'Food & drink' && interest !== 'Practical stop') {
    facts.push({
      label: 'Time to spend',
      value: recommendedAttractionDuration(feature, curatedVisitScore(feature)),
    });
  }
  if (
    !info.osmSource &&
    detail('display_context') !== 'visitor' &&
    !isCurrentVisitorContext(feature)
  ) {
    facts.push({ label: 'Historic date', value: dateWording(feature) });
  }

  const opening = detail('opening_hours') ?? detail('opening_hours:description');
  if (opening) facts.push({ label: 'Opening times', value: opening });
  const foodPriceBand = detail('price_band');
  if (foodPriceBand) facts.push({ label: 'Price guide', value: foodPriceBand });
  const price =
    type === 'Parking' ? undefined : detailValue(details, 'entrance_fee', 'charge', 'fee');
  if (price) facts.push({ label: 'Price', value: formatOsmValue(price) });
  const booking = detailValue(details, 'booking', 'reservation');
  if (booking) facts.push({ label: 'Booking', value: formatOsmValue(booking) });
  const wheelchair = detail('wheelchair');
  if (wheelchair) facts.push({ label: 'Accessibility', value: formatOsmValue(wheelchair) });
  const toilets = detail('toilets');
  if (toilets) facts.push({ label: 'Toilets', value: formatOsmValue(toilets) });
  const cuisine = detail('cuisine');
  if (cuisine) facts.push({ label: 'Food style', value: cuisine.replaceAll('_', ' ') });
  if (feature.address) facts.push({ label: 'Address', value: feature.address });
  return facts;
}

export function visitorDetails(feature: HeritageFeature): OsmDetail[] {
  const details = currentPlaceInfo(feature).currentDetails;
  const isParking = visitorPlaceType(feature) === 'Parking';
  return details.filter(
    (detail) =>
      detail.key !== 'description' &&
      !(isParking && parkingQuickFactKeys.has(detail.key)) &&
      (detail.key in osmDetailLabels ||
        detail.key.startsWith('payment:') ||
        detail.key.startsWith('contact:')),
  );
}
