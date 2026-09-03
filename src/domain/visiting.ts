import { booleanPointInPolygon, point } from '@turf/turf';
import { publishedDogAccessForPlace } from '../data/dogAccessCuration';
import { isDogFriendly, type DogAccessInfo } from './dogAccess';
import { attractionVisitPlan } from './attractionVisit';
import { publicVisitorUrl, publishedAttractionScore } from './editorialResearch';
import { isPublishableAttraction } from './visitorPublication';
import type { ParkingPriceStatus } from './visitorExperience';
import type {
  AttractionGuide,
  HeritageFeature,
  ProjectPackage,
  VisitorHighlight,
} from './models';

export interface VisitPlace {
  id: string;
  name: string;
  summary?: string;
  rank?: number;
  reason?: string;
  tagline?: string;
  externalUrl?: string;
  visitorScore?: number;
  timeToSpend?: string;
  openingTimes?: string;
  admission?: string;
  priceBand?: string;
  freeAdmission?: boolean;
  parkingPriceStatus?: ParkingPriceStatus;
  dogFriendly?: boolean;
  dogAccess?: DogAccessInfo;
  organisationPills?: string[];
  attractionGuide?: AttractionGuide;
}

export interface VisitRecommendation {
  label: string;
  meaning: string;
  className: string;
}

const attractionTypeLabels: Readonly<Record<string, string>> = {
  archaeological_site: 'Archaeology',
  bridge: 'Engineering landmark',
  burial_ground: 'Historic burial place',
  canal: 'Canal heritage',
  castle: 'Historic stronghold',
  cathedral: 'Cathedral architecture',
  chapel: 'Historic chapel',
  church: 'Church architecture',
  civic_building: 'Civic heritage',
  commercial_building: 'Historic interiors',
  designed_landscape: 'Designed landscape',
  dock: 'Maritime heritage',
  factory: 'Industrial heritage',
  foundry: 'Industrial heritage',
  garden: 'Historic garden',
  harbour: 'Waterfront setting',
  market: 'Market-town character',
  memorial: 'Remembrance landmark',
  mill: 'Industrial heritage',
  monastery: 'Religious heritage',
  monument: 'Historic landmark',
  palace: 'Royal heritage',
  park: 'Green space',
  public_art: 'Public art',
  railway: 'Railway heritage',
  square: 'Historic townscape',
  street: 'Historic townscape',
  tower: 'Historic tower',
  warehouse: 'Industrial heritage',
};

function attractionBestFor(featureType: string): string[] {
  if (['bridge', 'canal', 'dock', 'harbour'].includes(featureType)) {
    return ['Views and photography', 'Outdoor exploring'];
  }
  if (['garden', 'park', 'designed_landscape'].includes(featureType)) {
    return ['Fresh air', 'A relaxed pause'];
  }
  if (['public_art', 'memorial', 'monument'].includes(featureType)) {
    return ['A quick landmark stop', 'Local stories'];
  }
  if (
    [
      'archaeological_site',
      'burial_ground',
      'castle',
      'cathedral',
      'chapel',
      'church',
      'monastery',
      'palace',
      'tower',
    ].includes(featureType)
  ) {
    return ['Architecture and history', 'A closer look'];
  }
  if (['factory', 'foundry', 'mill', 'railway', 'warehouse'].includes(featureType)) {
    return ['Industrial heritage', 'Local history'];
  }
  return ['Local character', 'A worthwhile stop'];
}

/**
 * Wrap older curated highlights in the current attraction-guide presentation without
 * inventing facilities or activities. Explicit researched guide fields always win.
 */
export function attractionGuideForHighlight(
  highlight: VisitorHighlight,
  feature: HeritageFeature,
  visitorScore = publishedAttractionScore(highlight, feature),
): AttractionGuide {
  const explicit = highlight.attractionGuide ?? feature.attractionGuide;
  const visitorPlan = attractionVisitPlan(
    feature,
    visitorScore,
  );
  const generatedMotifs = [highlight.tagline, attractionTypeLabels[feature.featureType]].filter(
    (value, index, values): value is string => Boolean(value) && values.indexOf(value) === index,
  );
  return {
    headline: explicit?.headline ?? highlight.tagline,
    intro: explicit?.intro ?? highlight.reason,
    motifs: explicit?.motifs ?? generatedMotifs,
    bestFor: explicit?.bestFor ?? attractionBestFor(feature.featureType),
    ...explicit,
    parking: explicit?.parking ?? visitorPlan.parking,
    toilets: explicit?.toilets ?? visitorPlan.toilets,
    picnic: explicit?.picnic ?? visitorPlan.picnic,
    foodNote:
      explicit?.foodNote ?? (explicit?.food?.length ? undefined : visitorPlan.foodNote),
  };
}

export const visitRecommendationColours: Readonly<Record<string, string>> = {
  'score-exceptional': '#f6d85f',
  'score-high': '#f1c840',
  'score-recommended': '#0c7180',
  'score-look': '#5f7f58',
  'score-interest': '#7b6688',
  'score-low': '#77817e',
};

export const foodRecommendationColours: Readonly<Record<string, string>> = {
  'score-exceptional': '#d1537b',
  'score-high': '#b85c86',
  'score-recommended': '#0c7180',
  'score-look': '#5f7f58',
  'score-interest': '#7b6688',
  'score-low': '#77817e',
};

export function visitRecommendationColour(
  recommendation?: Pick<VisitRecommendation, 'className'>,
): string | undefined {
  return recommendation ? visitRecommendationColours[recommendation.className] : undefined;
}

export function foodRecommendationColour(
  recommendation?: Pick<VisitRecommendation, 'className'>,
): string | undefined {
  return recommendation ? foodRecommendationColours[recommendation.className] : undefined;
}

export function formatVisitScore(score: number): string {
  return String(score);
}

export function visitRecommendation(score?: number): VisitRecommendation | undefined {
  if (score === undefined) return undefined;
  if (score >= 90) {
    return {
      label: 'Exceptional',
      meaning: "One of the country's outstanding attractions; worth a special journey.",
      className: 'score-exceptional',
    };
  }
  if (score >= 85) {
    return {
      label: 'Highly recommended',
      meaning: 'A major reason to visit the destination; worth a substantial detour.',
      className: 'score-high',
    };
  }
  if (score >= 75) {
    return {
      label: 'Recommended',
      meaning: 'Definitely worth including when visiting the town or area.',
      className: 'score-recommended',
    };
  }
  if (score >= 45) {
    return {
      label: 'Worth a look',
      meaning: 'A worthwhile local attraction, especially if nearby.',
      className: 'score-look',
    };
  }
  if (score >= 35) {
    return {
      label: 'Point of interest',
      meaning: 'Genuine visitor interest, but normally a brief or specialist stop.',
      className: 'score-interest',
    };
  }
  return {
    label: 'Not normally listed',
    meaning: 'Too minor to recommend as a standalone attraction.',
    className: 'score-low',
  };
}

export function foodRecommendation(score?: number): VisitRecommendation | undefined {
  if (score === undefined || score < 60) return undefined;
  if (score >= 90) {
    return {
      label: 'Destination dining',
      meaning: 'A standout food experience worth planning around.',
      className: 'score-exceptional',
    };
  }
  if (score >= 80) {
    return {
      label: 'Top food stop',
      meaning: 'One of the strongest places to eat or drink in this destination.',
      className: 'score-high',
    };
  }
  if (score >= 70) {
    return {
      label: 'Great choice',
      meaning: 'A strong cafe or food stop to build into the visit.',
      className: 'score-recommended',
    };
  }
  if (score >= 60) {
    return {
      label: 'Good local option',
      meaning: 'A solid place for coffee, lunch or a simple meal while visiting.',
      className: 'score-look',
    };
  }
  return undefined;
}

export function trailRecommendation(score?: number): VisitRecommendation | undefined {
  if (score === undefined) return undefined;
  if (score >= 90) {
    return {
      label: 'Highly recommended',
      meaning: 'One of the strongest self-guided trails for this destination.',
      className: 'score-high',
    };
  }
  if (score >= 80) {
    return {
      label: 'Recommended',
      meaning: 'A good trail to include if you want a more structured visit.',
      className: 'score-recommended',
    };
  }
  return {
    label: 'Interesting trail',
    meaning: 'A worthwhile extra trail for visitors who want more local detail.',
    className: 'score-interest',
  };
}

export function isMappableVisitFeature(pkg: ProjectPackage, feature: HeritageFeature): boolean {
  const activeVisitorBoundary =
    pkg.project.townStudyArea?.visitorBoundary ?? pkg.project.boundary;
  return (
    feature.geometry?.type === 'Point' &&
    feature.evidenceScope !== 'out_of_scope' &&
    !feature.tags.includes('map-hidden') &&
    booleanPointInPolygon(point(feature.geometry.coordinates), activeVisitorBoundary)
  );
}

export function isMappableVisitorHighlightFeature(
  pkg: ProjectPackage,
  feature: HeritageFeature,
): boolean {
  if (isMappableVisitFeature(pkg, feature)) return true;
  return (
    feature.geometry?.type === 'Point' &&
    feature.evidenceScope === 'related_context' &&
    !feature.tags.includes('map-hidden')
  );
}

export function topVisitPlaces(pkg: ProjectPackage, limit = 5): VisitPlace[] {
  if (!pkg.project.touristAppeal) return [];
  const featuresById = new Map(pkg.features.map((feature) => [feature.id, feature]));
  const placesById = new Map<string, VisitPlace>();
  const usedTaglines = new Set<string>();
  const curatedHighlights = [...(pkg.project.visitorHighlights ?? [])].sort(
    (left, right) => left.rank - right.rank || left.name.localeCompare(right.name),
  );
  if (pkg.project.touristAppeal.rating === 0 && curatedHighlights.length === 0) return [];
  for (const highlight of curatedHighlights) {
    const feature = featuresById.get(highlight.featureId);
    if (!feature || !isMappableVisitorHighlightFeature(pkg, feature)) continue;
    const dogAccess = publishedDogAccessForPlace(
      pkg.project.id,
      'attraction',
      feature.id,
    );
    const visitorScore = publishedAttractionScore(highlight, feature);
    const visitorPlan = attractionVisitPlan(feature, visitorScore);
    const place: VisitPlace = {
      id: feature.id,
      name: highlight.name,
      summary: feature.shortDescription,
      rank: highlight.rank,
      reason: highlight.reason,
      tagline: highlight.tagline,
      visitorScore,
      timeToSpend: highlight.timeToSpend ?? visitorPlan.timeToSpend,
      openingTimes: highlight.openingTimes ?? visitorPlan.openingTimes,
      admission: highlight.admission ?? visitorPlan.admission,
      freeAdmission: highlight.freeAdmission
        ?? ((highlight.admission ?? visitorPlan.admission)
          ? (highlight.admission ?? visitorPlan.admission) === 'Free'
          : undefined),
      dogFriendly: isDogFriendly(dogAccess),
      dogAccess,
      organisationPills: highlight.organisationPills,
      externalUrl: publicVisitorUrl(highlight.visitorWebsiteUrl, highlight.sourceUrl),
      attractionGuide: attractionGuideForHighlight(highlight, feature, visitorScore),
    };
    if (!isPublishableAttraction(place)) continue;
    const taglineKey = place.tagline?.trim().toLocaleLowerCase('en-GB');
    if (!taglineKey || usedTaglines.has(taglineKey)) continue;
    usedTaglines.add(taglineKey);
    placesById.set(feature.id, place);
  }
  return [...placesById.values()].slice(0, limit);
}
