import { booleanPointInPolygon, point } from '@turf/turf';
import type { FeatureCollection, Point } from 'geojson';
import type {
  AttractionGuide,
  HeritageFeature,
  ProjectPackage,
  TouristAppealRating,
} from '../domain/models';
import { publicVisitorUrl, publishedAttractionScore } from '../domain/editorialResearch';
import { isDogFriendly, type DogAccessInfo } from '../domain/dogAccess';
import { legacyTownScore, touristAppealStars, townScoreBand } from '../domain/tourism';
import {
  currentPlaceInfo,
  isPublishableFeatureVisitPlace,
  visitPlaceFromFeature,
  visitorPitch,
} from '../domain/visitorExperience';
import {
  foodRecommendation,
  attractionGuideForHighlight,
  topVisitPlaces,
  visitRecommendation,
  type VisitPlace,
  type VisitRecommendation,
} from '../domain/visiting';
import { publishedPlannerCurationForProject } from '../data/visitorPlannerCuration';
import type { PlannerCurationState } from '../domain/plannerCuration';
import { attractionVisitPlan } from '../domain/attractionVisit';
import { publishedDogAccessForPlace } from '../data/dogAccessCuration';
import { isPublishableAttraction } from '../domain/visitorPublication';

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
const ratingStyles: Record<
  Exclude<TouristAppealRating, 0>,
  { ratingClass: string; ratingColour: string }
> = {
  1: { ratingClass: 'rating-1', ratingColour: '#8d3150' },
  2: { ratingClass: 'rating-2', ratingColour: '#0c7180' },
  3: { ratingClass: 'rating-3', ratingColour: '#b27713' },
};
const notableStyle = { ratingClass: 'rating-notable', ratingColour: '#5f7f58' };

export interface HomeTownOverview {
  id: string;
  name: string;
  label: string;
  /** Legacy star-count field retained for marker styling and old consumers. */
  rating: TouristAppealRating;
  score: number;
  stars: string;
  ratingClass: string;
  ratingColour: string;
  featureCount: number;
  centre: [number, number];
  collisionPriority: number;
}

export type HomePoiKind = 'attraction' | 'eat';

export interface HomePoiOverview {
  id: string;
  featureId: string;
  projectId: string;
  townName: string;
  name: string;
  kind: HomePoiKind;
  discoveryScope: 'town' | 'standalone';
  coordinates: [number, number];
  reason?: string;
  visitorScore?: number;
  /** Map-facing band; numerical scores remain available to cards and detail views. */
  starRating: 0 | 1 | 2 | 3;
  tagline?: string;
  timeToSpend?: string;
  openingTimes?: string;
  admission?: string;
  priceBand?: string;
  freeAdmission?: boolean;
  dogFriendly?: boolean;
  dogAccess?: DogAccessInfo;
  organisationPills?: string[];
  externalUrl?: string;
  attractionGuide?: AttractionGuide;
  homeMapEligible: boolean;
}

export type HomeDiscoveryMode = 'towns' | 'attraction' | 'eat';
export type HomeDiscoveryScope = 'all' | 'standalone';

export interface HomeRatingRange {
  min: number;
  max: number;
}

const regionalDiscoveryZoom = 8.5;
const minimumHomeScores: Record<
  HomePoiKind,
  { national: number; regional: number }
> = {
  attraction: { national: 85, regional: 75 },
  eat: { national: 80, regional: 70 },
};

export interface HomeLabelCandidate extends HomeTownOverview {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VisibleHomeLabel extends HomeLabelCandidate {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface HomeLabelViewport {
  width: number;
  height: number;
}

export function homeTownOverviews(packages: readonly ProjectPackage[]): HomeTownOverview[] {
  return packages
    .filter(
      (projectPackage) => {
        const appeal = projectPackage.project.touristAppeal;
        return Boolean(appeal && (appeal.score !== undefined ? appeal.score >= 60 : appeal.rating > 0));
      },
    )
    .sort(
      (a, b) =>
        (b.project.touristAppeal?.score ?? legacyTownScore(b.project.touristAppeal?.rating ?? 0)) -
          (a.project.touristAppeal?.score ?? legacyTownScore(a.project.touristAppeal?.rating ?? 0)) ||
        b.features.length - a.features.length ||
        collator.compare(a.project.locality, b.project.locality),
    )
    .map((projectPackage, index) => {
      const appeal = projectPackage.project.touristAppeal!;
      const score = appeal.score ?? legacyTownScore(appeal.rating);
      const band = appeal.score !== undefined ? townScoreBand(score) : undefined;
      const rating = band?.rating ?? appeal.rating;
      const stars = band?.indicator ?? touristAppealStars(rating);
      return {
        id: projectPackage.project.id,
        name: projectPackage.project.locality,
        label: `${projectPackage.project.locality} ${stars}`,
        rating,
        score,
        stars,
        ...(score >= 60 && score < 70 ? notableStyle : ratingStyles[rating as Exclude<TouristAppealRating, 0>]),
        featureCount: projectPackage.features.length,
        centre: projectPackage.project.centre,
        collisionPriority: index,
      };
    });
}

export function homeTownOverviewGeoJson(
  packages: readonly ProjectPackage[],
): FeatureCollection<Point, HomeTownOverview> {
  return {
    type: 'FeatureCollection',
    features: homeTownOverviews(packages).map((town) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: town.centre,
      },
      properties: town,
    })),
  };
}

function pointFeatureForPlace(
  projectPackage: ProjectPackage,
  place: VisitPlace,
): (HeritageFeature & { geometry: Point }) | undefined {
  const feature = projectPackage.features.find(
    (candidate): candidate is HeritageFeature & { geometry: Point } =>
      candidate.id === place.id && candidate.geometry?.type === 'Point',
  );
  return feature;
}

function pointFeature(
  feature: HeritageFeature,
): (HeritageFeature & { geometry: Point }) | undefined {
  return feature.geometry?.type === 'Point'
    ? (feature as HeritageFeature & { geometry: Point })
    : undefined;
}

function homePoiFeatureVisible(feature: HeritageFeature): boolean {
  return feature.evidenceScope !== 'out_of_scope' && !feature.tags.includes('map-hidden');
}

function featureInProjectBoundary(
  projectPackage: ProjectPackage,
  feature: HeritageFeature & { geometry: Point },
): boolean {
  const activeVisitorBoundary =
    projectPackage.project.townStudyArea?.visitorBoundary ?? projectPackage.project.boundary;
  return booleanPointInPolygon(point(feature.geometry.coordinates), activeVisitorBoundary);
}

function hasAnyTag(feature: HeritageFeature, tags: readonly string[]): boolean {
  return tags.some((tag) => feature.tags.includes(tag));
}

function isFoodDiscoveryFeature(feature: HeritageFeature): boolean {
  const currentDetails = currentPlaceInfo(feature).currentDetails;
  const detail = (key: string) => currentDetails.find((item) => item.key === key)?.value;
  const amenity = detail('amenity');
  const shop = detail('shop');
  return (
    hasAnyTag(feature, ['service-context-food', 'osm-community-food']) ||
    ['cafe', 'ice_cream', 'restaurant'].includes(amenity ?? '') ||
    ['bakery', 'coffee'].includes(shop ?? '')
  );
}

function homePoiFromFeature(
  projectPackage: ProjectPackage,
  feature: HeritageFeature & { geometry: Point },
  kind: HomePoiKind,
  options: {
    name?: string;
    reason?: string;
    visitorScore?: number;
    tagline?: string;
    place?: VisitPlace;
    homeMapEligible?: boolean;
  } = {},
): HomePoiOverview {
  const inBoundary = featureInProjectBoundary(projectPackage, feature);
  const explicitlyStandalone = feature.tags.includes('home-standalone-place');
  const place = options.place;
  const visitorScore = options.visitorScore ?? place?.visitorScore;
  return {
    id: `${projectPackage.project.id}:${feature.id}`,
    featureId: feature.id,
    projectId: projectPackage.project.id,
    townName: projectPackage.project.locality,
    name: options.name ?? feature.name,
    kind,
    discoveryScope: explicitlyStandalone || !inBoundary ? 'standalone' : 'town',
    coordinates: feature.geometry.coordinates as [number, number],
    reason: options.reason ?? feature.shortDescription ?? visitorPitch(feature),
    visitorScore,
    starRating: homePoiStarRating(kind, visitorScore),
    tagline: options.tagline ?? place?.tagline,
    timeToSpend: place?.timeToSpend,
    openingTimes: place?.openingTimes,
    admission: place?.admission,
    priceBand: place?.priceBand,
    freeAdmission: place?.freeAdmission,
    dogFriendly: place?.dogFriendly,
    dogAccess: place?.dogAccess,
    organisationPills: place?.organisationPills,
    externalUrl: place?.externalUrl,
    attractionGuide: place?.attractionGuide ?? feature.attractionGuide,
    homeMapEligible: options.homeMapEligible ?? feature.homeMapEligible !== false,
  };
}

export function homePoiMinimumScore(kind: HomePoiKind, zoom: number): number {
  const threshold = minimumHomeScores[kind];
  return zoom >= regionalDiscoveryZoom ? threshold.regional : threshold.national;
}

export function homePoiPermanentLabelLimit(zoom: number): number {
  if (zoom < 8.5) return 6;
  if (zoom < 10) return 10;
  return 16;
}

export function homePoiVisibleAtZoom(poi: HomePoiOverview, zoom: number): boolean {
  return (
    poi.homeMapEligible &&
    poi.visitorScore !== undefined &&
    poi.visitorScore >= homePoiMinimumScore(poi.kind, zoom)
  );
}

export function homePoiMatchesDiscoveryScope(
  poi: HomePoiOverview,
  scope: HomeDiscoveryScope,
): boolean {
  return scope === 'all' || poi.discoveryScope === 'standalone';
}

export function homeTownMatchesRatingRange(
  town: HomeTownOverview,
  range: HomeRatingRange,
): boolean {
  return town.rating >= range.min && town.rating <= range.max;
}

export function homePoiStarRating(
  kind: HomePoiKind,
  score: number | undefined,
): 0 | 1 | 2 | 3 {
  if (score === undefined) return 0;
  if (score >= 90) return 3;
  if (kind === 'eat') return score >= 80 ? 2 : score >= 60 ? 1 : 0;
  return score >= 75 ? 2 : score >= 45 ? 1 : 0;
}

export function homePoiMatchesRatingRange(
  poi: HomePoiOverview,
  range: HomeRatingRange,
): boolean {
  return (
    poi.homeMapEligible &&
    poi.starRating >= range.min &&
    poi.starRating <= range.max
  );
}

export function homePoiRecommendation(poi: HomePoiOverview): VisitRecommendation | undefined {
  return poi.kind === 'eat'
    ? foodRecommendation(poi.visitorScore)
    : visitRecommendation(poi.visitorScore);
}

export function sortHomeDiscoveryPois(
  pois: readonly HomePoiOverview[],
): HomePoiOverview[] {
  return [...pois].sort(
    (left, right) =>
      (right.visitorScore ?? -1) - (left.visitorScore ?? -1) ||
      Number(right.discoveryScope === 'standalone') -
        Number(left.discoveryScope === 'standalone') ||
      collator.compare(left.name, right.name),
  );
}

export function homePoiOverviews(
  packages: readonly ProjectPackage[],
  kind: HomePoiKind,
  limitPerTown = 5,
  plannerCurationForProject: (projectId: string) => PlannerCurationState =
    publishedPlannerCurationForProject,
): HomePoiOverview[] {
  const overviews: HomePoiOverview[] = [];
  for (const projectPackage of packages) {
    const byFeatureId = new Map<string, HomePoiOverview>();
    if (kind === 'attraction') {
      for (const highlight of [...(projectPackage.project.visitorHighlights ?? [])].sort(
        (left, right) => left.rank - right.rank || left.name.localeCompare(right.name),
      )) {
        if (byFeatureId.size >= limitPerTown) break;
        const matchedFeature = projectPackage.features.find(
          (candidate) => candidate.id === highlight.featureId,
        );
        const feature = matchedFeature ? pointFeature(matchedFeature) : undefined;
        if (!feature || !homePoiFeatureVisible(feature) || byFeatureId.has(feature.id)) continue;
        const featurePlace = visitPlaceFromFeature(feature);
        const visitorScore = publishedAttractionScore(highlight, feature);
        if (visitorScore === undefined) continue;
        const visitorPlan = attractionVisitPlan(feature, visitorScore);
        const dogAccess = publishedDogAccessForPlace(
          projectPackage.project.id,
          'attraction',
          feature.id,
        );
        const place: VisitPlace = {
          id: feature.id,
          name: highlight.name,
          reason: highlight.reason,
          tagline: highlight.tagline,
          visitorScore,
          timeToSpend: highlight.timeToSpend ?? featurePlace.timeToSpend ?? visitorPlan.timeToSpend,
          openingTimes: highlight.openingTimes ?? featurePlace.openingTimes ?? visitorPlan.openingTimes,
          admission: highlight.admission ?? featurePlace.admission ?? visitorPlan.admission,
          freeAdmission: highlight.freeAdmission
            ?? ((highlight.admission ?? featurePlace.admission ?? visitorPlan.admission)
              ? (highlight.admission ?? featurePlace.admission ?? visitorPlan.admission) === 'Free'
              : undefined),
          dogFriendly: isDogFriendly(dogAccess),
          dogAccess,
          organisationPills: highlight.organisationPills,
          externalUrl: publicVisitorUrl(highlight.visitorWebsiteUrl, highlight.sourceUrl),
          attractionGuide: attractionGuideForHighlight(highlight, feature, visitorScore),
        };
        if (!isPublishableAttraction(place)) continue;
        byFeatureId.set(
          feature.id,
          homePoiFromFeature(projectPackage, feature, kind, {
            name: highlight.name,
            reason: highlight.reason,
            visitorScore,
            place,
            homeMapEligible: highlight.homeMapEligible,
          }),
        );
      }
      if (!byFeatureId.size) {
        for (const place of topVisitPlaces(projectPackage, limitPerTown)) {
          const feature = pointFeatureForPlace(projectPackage, place);
          if (!feature || !homePoiFeatureVisible(feature)) continue;
          const featurePlace = visitPlaceFromFeature(feature);
          if (featurePlace.visitorScore === undefined) continue;
          byFeatureId.set(
            feature.id,
            homePoiFromFeature(projectPackage, feature, kind, {
              name: place.name,
              reason: place.reason,
              visitorScore: featurePlace.visitorScore,
              tagline: place.tagline,
              place: { ...place, ...featurePlace },
            }),
          );
        }
      }
      const standaloneFeatures = projectPackage.features
        .map(pointFeature)
        .filter(
          (feature): feature is HeritageFeature & { geometry: Point } =>
            Boolean(
              feature &&
                homePoiFeatureVisible(feature) &&
                feature.tags.includes('home-standalone-place') &&
                !isFoodDiscoveryFeature(feature) &&
                !byFeatureId.has(feature.id),
            ),
        )
        .sort(
          (left, right) =>
            (visitPlaceFromFeature(right).visitorScore ?? 0) -
              (visitPlaceFromFeature(left).visitorScore ?? 0) ||
            left.name.localeCompare(right.name),
        );
      for (const feature of standaloneFeatures) {
        if (byFeatureId.size >= limitPerTown) break;
        const place = visitPlaceFromFeature(feature);
        if (!isPublishableFeatureVisitPlace(feature, place, 'attraction')) continue;
        byFeatureId.set(
          feature.id,
          homePoiFromFeature(projectPackage, feature, kind, {
            visitorScore: place.visitorScore,
            place,
          }),
        );
      }
    } else {
      const curatedFoodIds = new Set(
        plannerCurationForProject(projectPackage.project.id).eat ?? [],
      );
      const foodFeatures = projectPackage.features
        .map(pointFeature)
        .filter(
          (feature): feature is HeritageFeature & { geometry: Point } =>
            Boolean(
              feature &&
                homePoiFeatureVisible(feature) &&
                isFoodDiscoveryFeature(feature) &&
                (curatedFoodIds.has(feature.id) || feature.tags.includes('home-standalone-place')),
            ),
        )
        .sort(
          (left, right) =>
            (visitPlaceFromFeature(right).visitorScore ?? 0) -
              (visitPlaceFromFeature(left).visitorScore ?? 0) ||
            left.name.localeCompare(right.name),
        );
      for (const feature of foodFeatures) {
        if (byFeatureId.size >= limitPerTown) break;
        const place = visitPlaceFromFeature(feature);
        if (!isPublishableFeatureVisitPlace(feature, place, 'eat')) continue;
        byFeatureId.set(
          feature.id,
          homePoiFromFeature(projectPackage, feature, kind, {
            visitorScore: place.visitorScore,
            place,
          }),
        );
      }
    }
    overviews.push(...byFeatureId.values());
  }
  return overviews;
}

function labelBounds(candidate: HomeLabelCandidate): VisibleHomeLabel {
  const left = candidate.x - candidate.width / 2;
  const right = candidate.x + candidate.width / 2;
  const bottom = candidate.y - 8;
  const top = bottom - candidate.height;
  return { ...candidate, left, top, right, bottom };
}

function overlaps(left: VisibleHomeLabel, right: VisibleHomeLabel, gap: number): boolean {
  return !(
    left.right + gap <= right.left ||
    left.left >= right.right + gap ||
    left.bottom + gap <= right.top ||
    left.top >= right.bottom + gap
  );
}

function intersectsViewport(label: VisibleHomeLabel, viewport?: HomeLabelViewport): boolean {
  if (!viewport) return true;
  return (
    label.right >= 0 &&
    label.left <= viewport.width &&
    label.bottom >= 0 &&
    label.top <= viewport.height
  );
}

export function selectVisibleHomeLabels(
  candidates: readonly HomeLabelCandidate[],
  viewport?: HomeLabelViewport,
  gap = 8,
): VisibleHomeLabel[] {
  const visible: VisibleHomeLabel[] = [];
  for (const candidate of [...candidates].sort(
    (left, right) =>
      left.collisionPriority - right.collisionPriority || collator.compare(left.name, right.name),
  )) {
    const next = labelBounds(candidate);
    if (!intersectsViewport(next, viewport)) continue;
    if (visible.some((existing) => overlaps(existing, next, gap))) continue;
    visible.push(next);
  }
  return visible;
}
