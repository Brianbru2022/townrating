import { useEffect, useRef, useState } from 'react';
import maplibregl, { type Map } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useExplorerStore, type PlannerMapNeed } from '../app/store';
import { historicCharacterScore } from '../domain/scoring';
import { featureTimelineState, hasHistoricTimelineDate } from '../domain/timeline';
import {
  isArchaeologyEvidenceFeature,
  isMapCatalogueRecord,
  isPublicTownFeature,
} from '../domain/presentation';
import type {
  HeritageFeature,
  ProjectPackage,
  ScoringMethodology,
  SettlementAgePolygon,
} from '../domain/models';
import type { FeatureCollection, LineString, MultiPolygon, Point, Polygon } from 'geojson';
import { freeMapAttribution, freeMapStyle, freeMapStyleLabels } from './styles';
import { historicHeatmapMaxZoom, historicHeatmapPaint } from './heatmapStyle';
import { visitorHighlightGeoJson } from './visitorHighlights';
import {
  foodRecommendation,
  foodRecommendationColour,
  isMappableVisitFeature,
  visitRecommendation,
  visitRecommendationColour,
} from '../domain/visiting';
import { parkingPriceStatus, visitorNeedPlaces } from '../domain/visitorExperience';
import { publishedPlannerCurationForProject } from '../data/visitorPlannerCuration';
import { curatedFeatureIds } from '../domain/plannerCuration';
const hesDesignationsLayerId = 'hes-listed-buildings-by-category';
// A clear blue keeps records with no usable historic evidence year distinct
// from both the dated-century palette and the OSM raster's dark POI symbols.
const historicUndatedDotColour = '#4f9bb5';

function historicDotColour(feature: HeritageFeature): string {
  const century = historicEvidenceCentury(feature);
  if (century === undefined) return historicUndatedDotColour;
  if (century < 1000) return '#5d3f7f';
  if (century < 1200) return '#76365c';
  if (century < 1400) return '#913a4b';
  if (century < 1600) return '#b54d35';
  if (century < 1800) return '#d36b2d';
  if (century < 1900) return '#df9638';
  return '#e5ba57';
}
type OsmCommunityCategory =
  | 'food'
  | 'picnic'
  | 'art'
  | 'memorial'
  | 'historic'
  | 'leisure'
  | 'visitor'
  | 'amenities'
  | 'parking'
  | 'nature';
interface OsmCommunityMarker {
  category: OsmCommunityCategory;
  variant: string;
  colour: string;
}

interface OsmCommunityPlaceProperties {
  id: string;
  name: string;
  markerIcon: string;
  markerCategory: OsmCommunityCategory;
  markerColour: string;
  markerInk: string;
  markerImage: string;
  recommendationClass?: string;
}

type OsmCommunityPlaceCollection = FeatureCollection<Point, OsmCommunityPlaceProperties>;

function osmCommunityCategory(feature: HeritageFeature): OsmCommunityCategory | undefined {
  // A current OSM feature can be merged into an authoritative historic record
  // (for example Alloa War Memorial into HES LB20989). Keep one data record,
  // but still allow its verified OSM category icon to be displayed.
  if (!isOsmCommunityPlace(feature) && !hasOsmCommunitySource(feature)) return undefined;
  const amenity = osmTagValue(feature, 'amenity');
  const shop = osmTagValue(feature, 'shop');
  const leisure = osmTagValue(feature, 'leisure');
  const tourism = osmTagValue(feature, 'tourism');
  const historic = osmTagValue(feature, 'historic');
  const manMade = osmTagValue(feature, 'man_made');
  const natural = osmTagValue(feature, 'natural');
  const waterway = osmTagValue(feature, 'waterway');
  if (
    ['cafe', 'ice_cream', 'restaurant'].includes(amenity ?? '') ||
    ['bakery', 'coffee'].includes(shop ?? '')
  )
    return 'food';
  if (
    ['outdoor_seating', 'picnic_table'].includes(leisure ?? '') ||
    ['bench', 'bbq', 'fountain'].includes(amenity ?? '') ||
    tourism === 'picnic_site'
  )
    return 'picnic';
  if (['artwork', 'museum', 'gallery'].includes(tourism ?? '')) return 'art';
  if (historic === 'memorial') return 'memorial';
  if (
    [
      'archaeological_site',
      'wayside_shrine',
      'monument',
      'castle',
      'fort',
      'city_gate',
      'manor',
    ].includes(historic ?? '') ||
    ['obelisk', 'tower', 'lighthouse', 'windmill'].includes(manMade ?? '')
  )
    return 'historic';
  if (['amusement_arcade', 'playground', 'miniature_golf', 'beach_resort'].includes(leisure ?? ''))
    return 'leisure';
  if (amenity === 'parking' || osmTagValue(feature, 'parking') === 'street_side') return 'parking';
  if (['toilets', 'drinking_water'].includes(amenity ?? '')) return 'amenities';
  if (
    tourism === 'information' ||
    ['guidepost', 'board', 'map', 'office', 'terminal', 'audioguide'].includes(
      osmTagValue(feature, 'information') ?? '',
    ) ||
    tourism === 'viewpoint' ||
    ['gift', 'souvenir'].includes(shop ?? '')
  )
    return 'visitor';
  if (
    ['cave_entrance', 'volcano'].includes(natural ?? '') ||
    waterway === 'waterfall' ||
    ['wildlife_hide', 'bird_hide'].includes(leisure ?? '')
  )
    return 'nature';
  for (const category of [
    'food',
    'picnic',
    'art',
    'memorial',
    'historic',
    'leisure',
    'visitor',
    'amenities',
    'parking',
    'nature',
  ] as const)
    if (feature.tags.includes(`osm-community-${category}`)) return category;
  return undefined;
}

function isOsmCommunityPlace(feature: HeritageFeature): boolean {
  return feature.tags.includes('osm-community-place');
}

function hasOsmCommunitySource(feature: HeritageFeature): boolean {
  return feature.sourceRecords.some(
    (source) => source.sourceName === 'OpenStreetMap current community places',
  );
}

function historicEvidenceCentury(feature: HeritageFeature): number | undefined {
  // `present_by` records commonly carry only a latest possible year. That is
  // still a dated historic-evidence point and must not fall into the
  // undated/grey class.
  const evidenceYear = feature.earliestPossibleYear ?? feature.latestPossibleYear;
  return evidenceYear === undefined ? undefined : Math.floor(evidenceYear / 100) * 100;
}

function osmTagValue(feature: HeritageFeature, key: string): string | undefined {
  const notes = feature.sourceRecords.find(
    (source) => source.sourceName === 'OpenStreetMap current community places',
  )?.notes;
  // Source notes end with a sentence full stop. Trim that formatting marker so
  // a final tag such as `tourism=artwork.` still selects its OSM category.
  return new RegExp(`(?:^|[:;]\\s*)${key}=([^;]+)`)
    .exec(notes ?? '')?.[1]
    .trim()
    .replace(/\.$/, '');
}

function osmCommunityMarker(feature: HeritageFeature): OsmCommunityMarker | undefined {
  const category = osmCommunityCategory(feature);
  if (!category) return undefined;
  const amenity = osmTagValue(feature, 'amenity');
  const leisure = osmTagValue(feature, 'leisure');
  const tourism = osmTagValue(feature, 'tourism');
  const historic = osmTagValue(feature, 'historic');
  const memorial = osmTagValue(feature, 'memorial');
  const artworkType = osmTagValue(feature, 'artwork_type');
  const castleType = osmTagValue(feature, 'castle_type');
  const manMade = osmTagValue(feature, 'man_made');
  const shop = osmTagValue(feature, 'shop');
  if (category === 'food') {
    if (amenity === 'ice_cream') return { category, variant: 'ice-cream', colour: '#bd5d7c' };
    if (amenity === 'restaurant') return { category, variant: 'restaurant', colour: '#a3443c' };
    if (shop === 'bakery') return { category, variant: 'bakery', colour: '#c47b32' };
    if (shop === 'coffee') return { category, variant: 'coffee-shop', colour: '#603e2f' };
    return { category, variant: 'cafe', colour: '#9c4a20' };
  }
  if (category === 'picnic') {
    const variants: Record<string, Pick<OsmCommunityMarker, 'variant' | 'colour'>> = {
      outdoor_seating: { variant: 'outdoor-seating', colour: '#3b7b58' },
      bench: { variant: 'bench', colour: '#8a6c34' },
      picnic_site: { variant: 'picnic-site', colour: '#5e7c2b' },
      picnic_table: { variant: 'picnic-table', colour: '#2d8279' },
      bbq: { variant: 'barbecue', colour: '#b25928' },
      fountain: { variant: 'fountain', colour: '#3587c5' },
    };
    const key = leisure ?? amenity ?? tourism;
    return { category, ...(variants[key ?? ''] ?? { variant: 'picnic', colour: '#397a56' }) };
  }
  if (category === 'leisure') {
    const variants: Record<string, Pick<OsmCommunityMarker, 'variant' | 'colour'>> = {
      playground: { variant: 'playground', colour: '#137b92' },
      amusement_arcade: { variant: 'arcade', colour: '#8b3f8e' },
      miniature_golf: { variant: 'mini-golf', colour: '#229670' },
      beach_resort: { variant: 'beach', colour: '#247db4' },
    };
    return { category, ...(variants[leisure ?? ''] ?? { variant: 'leisure', colour: '#137b92' }) };
  }
  if (category === 'amenities') {
    const variants: Record<string, Pick<OsmCommunityMarker, 'variant' | 'colour'>> = {
      toilets: { variant: 'toilets', colour: '#397f8c' },
      drinking_water: { variant: 'drinking-water', colour: '#237eb4' },
    };
    return { category, ...(variants[amenity ?? ''] ?? { variant: 'amenity', colour: '#397f8c' }) };
  }
  if (category === 'visitor') {
    const variants: Record<string, Pick<OsmCommunityMarker, 'variant' | 'colour'>> = {
      information: { variant: 'information', colour: '#50679c' },
      viewpoint: { variant: 'viewpoint', colour: '#61744a' },
      gift: { variant: 'gift', colour: '#9a5b62' },
      souvenir: { variant: 'gift', colour: '#9a5b62' },
    };
    const information = osmTagValue(feature, 'information');
    if (tourism === 'information') {
      const informationVariants: Record<string, Pick<OsmCommunityMarker, 'variant' | 'colour'>> = {
        guidepost: { variant: 'guidepost', colour: '#687542' },
        board: { variant: 'information-board', colour: '#b0752e' },
        map: { variant: 'map-board', colour: '#3f7d72' },
        office: { variant: 'tourist-information', colour: '#50679c' },
        terminal: { variant: 'information-terminal', colour: '#725492' },
        audioguide: { variant: 'audio-guide', colour: '#9a5b62' },
      };
      return { category, ...(informationVariants[information ?? ''] ?? variants.information) };
    }
    const key = amenity ?? tourism ?? osmTagValue(feature, 'parking') ?? shop;
    return { category, ...(variants[key ?? ''] ?? { variant: 'visitor', colour: '#50679c' }) };
  }
  if (category === 'parking') {
    const priceStatus = parkingPriceStatus(feature);
    if (priceStatus === 'paid')
      return { category, variant: 'parking-paid', colour: '#b53f38' };
    return { category, variant: 'parking-free', colour: '#2d748c' };
  }
  if (category === 'nature') {
    const natural = osmTagValue(feature, 'natural');
    const waterway = osmTagValue(feature, 'waterway');
    if (natural === 'cave_entrance') return { category, variant: 'cave', colour: '#755e4e' };
    if (waterway === 'waterfall') return { category, variant: 'waterfall', colour: '#287fb1' };
    if (natural === 'volcano') return { category, variant: 'volcano', colour: '#a64b32' };
    if (['wildlife_hide', 'bird_hide'].includes(leisure ?? ''))
      return { category, variant: 'bird-hide', colour: '#597a4c' };
    return { category, variant: 'nature', colour: '#5a8161' };
  }
  if (category === 'art' && tourism === 'artwork')
    return artworkType === 'statue'
      ? { category, variant: 'statue', colour: '#6c4c33' }
      : { category, variant: 'artwork', colour: '#87579f' };
  if (category === 'art' && tourism === 'museum')
    return { category, variant: 'museum', colour: '#416f8e' };
  if (category === 'art' && tourism === 'gallery')
    return { category, variant: 'gallery', colour: '#a65982' };
  if (category === 'memorial' && historic === 'memorial') {
    const variants: Record<string, Pick<OsmCommunityMarker, 'variant' | 'colour'>> = {
      plaque: { variant: 'plaque', colour: '#245b93' },
      blue_plaque: { variant: 'blue-plaque', colour: '#1261a0' },
      statue: { variant: 'memorial-statue', colour: '#6c4c33' },
      stone: { variant: 'memorial-stone', colour: '#6f7074' },
      bust: { variant: 'bust', colour: '#5d4466' },
    };
    return {
      category,
      ...(variants[memorial ?? ''] ?? { variant: 'memorial', colour: '#4b5795' }),
    };
  }
  if (category === 'historic' && historic === 'archaeological_site')
    return { category, variant: 'archaeology', colour: '#803f26' };
  if (historic === 'wayside_shrine') return { category, variant: 'shrine', colour: '#957321' };
  if (historic === 'monument') return { category, variant: 'monument', colour: '#674f83' };
  if (historic === 'fort') return { category, variant: 'fort', colour: '#70403b' };
  if (historic === 'city_gate') return { category, variant: 'city-gate', colour: '#766331' };
  if (historic === 'manor') return { category, variant: 'manor', colour: '#81562e' };
  if (manMade === 'obelisk') return { category, variant: 'obelisk', colour: '#596f7e' };
  if (manMade === 'tower') {
    const towerType = osmTagValue(feature, 'tower:type');
    if (towerType === 'observation')
      return { category, variant: 'observation-tower', colour: '#4b7884' };
    if (towerType === 'bell' || towerType === 'bell_tower')
      return { category, variant: 'bell-tower', colour: '#a8732d' };
    return { category, variant: 'tower', colour: '#596f7e' };
  }
  if (manMade === 'lighthouse') return { category, variant: 'lighthouse', colour: '#2e6f9a' };
  if (manMade === 'windmill') return { category, variant: 'windmill', colour: '#8a6435' };
  if (historic === 'castle')
    return castleType === 'palace' || castleType === 'stately'
      ? { category, variant: 'palace', colour: '#795685' }
      : { category, variant: 'castle', colour: '#634e76' };
  return { category, variant: 'historic-place', colour: '#4b5795' };
}

function plannerNeedCommunityMarker(need: PlannerMapNeed): OsmCommunityMarker | undefined {
  if (need === 'see') return { category: 'art', variant: 'artwork', colour: '#c98722' };
  if (need === 'eat') return { category: 'food', variant: 'cafe', colour: '#8a5635' };
  if (need === 'trails') return { category: 'visitor', variant: 'map-board', colour: '#6c5b9d' };
  if (need === 'picnic') return { category: 'picnic', variant: 'picnic', colour: '#b67a24' };
  if (need === 'parking') return { category: 'parking', variant: 'parking', colour: '#2d748c' };
  if (need === 'toilets') return { category: 'amenities', variant: 'toilets', colour: '#2d8f96' };
  if (need === 'walk') return { category: 'nature', variant: 'nature', colour: '#57825e' };
  if (need === 'parks') return { category: 'nature', variant: 'nature', colour: '#57825e' };
  if (need === 'photo') return { category: 'visitor', variant: 'viewpoint', colour: '#a34868' };
  return undefined;
}

function plannerNeedCommunityMarkerForFeature(
  feature: HeritageFeature,
  need?: PlannerMapNeed,
): OsmCommunityMarker | undefined {
  if (!need) return undefined;
  if (need === 'parking') {
    const priceStatus = parkingPriceStatus(feature);
    if (priceStatus === 'paid')
      return { category: 'parking', variant: 'parking-paid', colour: '#b53f38' };
    return { category: 'parking', variant: 'parking-free', colour: '#2d748c' };
  }
  return plannerNeedCommunityMarker(need);
}

const defaultPlannerCommunityMarkers = [
  'see',
  'eat',
  'trails',
  'picnic',
  'parking',
  'toilets',
  'walk',
  'parks',
  'photo',
]
  .map((need) => plannerNeedCommunityMarker(need as PlannerMapNeed))
  .filter((marker): marker is OsmCommunityMarker => Boolean(marker));
defaultPlannerCommunityMarkers.push(
  { category: 'parking', variant: 'parking-free', colour: '#2d748c' },
  { category: 'parking', variant: 'parking-paid', colour: '#b53f38' },
);

function communityMarkerImage(
  category: OsmCommunityCategory,
  colour: string,
  variant: string,
  ink = '#fff',
): ImageData {
  const size = 48;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is unavailable for map icon rendering.');
  context.fillStyle = colour;
  context.beginPath();
  if (category === 'food') context.arc(24, 24, 21, 0, Math.PI * 2);
  else if (category === 'picnic') context.roundRect(4, 4, 40, 40, 9);
  else if (category === 'art') {
    context.moveTo(24, 2);
    context.lineTo(46, 24);
    context.lineTo(24, 46);
    context.lineTo(2, 24);
    context.closePath();
  } else if (category === 'memorial' || category === 'amenities') {
    context.arc(24, 24, 21, 0, Math.PI * 2);
  } else if (category === 'historic' || category === 'nature') {
    context.moveTo(24, 2);
    context.lineTo(42, 13);
    context.lineTo(42, 35);
    context.lineTo(24, 46);
    context.lineTo(6, 35);
    context.lineTo(6, 13);
    context.closePath();
  } else {
    context.beginPath();
    context.roundRect(4, 4, 40, 40, 9);
  }
  context.fill();
  context.lineWidth = 3;
  context.strokeStyle = ink;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  if (category === 'food') {
    context.strokeRect(13, 17, 18, 13);
    context.beginPath();
    context.arc(32, 22, 5, -Math.PI / 2, Math.PI / 2);
    context.moveTo(16, 34);
    context.lineTo(31, 34);
    context.moveTo(18, 13);
    context.quadraticCurveTo(16, 9, 18, 7);
    context.moveTo(25, 13);
    context.quadraticCurveTo(23, 9, 25, 7);
    context.stroke();
  } else if (category === 'picnic') {
    context.beginPath();
    context.moveTo(12, 20);
    context.lineTo(36, 20);
    context.moveTo(16, 20);
    context.lineTo(11, 34);
    context.moveTo(32, 20);
    context.lineTo(37, 34);
    context.moveTo(12, 27);
    context.lineTo(36, 27);
    context.stroke();
  } else if (category === 'art') {
    context.beginPath();
    context.moveTo(24, 11);
    context.lineTo(27, 21);
    context.lineTo(37, 24);
    context.lineTo(27, 27);
    context.lineTo(24, 37);
    context.lineTo(21, 27);
    context.lineTo(11, 24);
    context.lineTo(21, 21);
    context.stroke();
  } else if (category === 'memorial') {
    context.beginPath();
    context.roundRect(15, 11, 18, 24, 3);
    context.moveTo(19, 18);
    context.lineTo(29, 18);
    context.moveTo(19, 25);
    context.lineTo(29, 25);
    context.stroke();
  } else if (category === 'historic') {
    context.beginPath();
    context.rect(13, 21, 22, 14);
    context.moveTo(17, 21);
    context.lineTo(17, 15);
    context.lineTo(22, 15);
    context.lineTo(22, 21);
    context.moveTo(27, 21);
    context.lineTo(27, 15);
    context.lineTo(32, 15);
    context.lineTo(32, 21);
    context.moveTo(21, 35);
    context.arc(24, 35, 3, Math.PI, 0);
    context.stroke();
  } else if (category === 'leisure') {
    context.beginPath();
    context.arc(18, 18, 4, 0, Math.PI * 2);
    context.moveTo(21, 21);
    context.lineTo(33, 33);
    context.moveTo(26, 24);
    context.lineTo(34, 16);
    context.stroke();
  } else if (category === 'visitor') {
    // Visitor places are commonly wayfinding boards rather than abstract
    // information points. Draw the OSM subtype so a map board or guidepost is
    // recognisable at a glance instead of looking like a blue square.
    if (variant === 'guidepost') {
      context.beginPath();
      context.moveTo(24, 9);
      context.lineTo(24, 38);
      context.moveTo(24, 14);
      context.lineTo(11, 20);
      context.lineTo(24, 24);
      context.moveTo(24, 17);
      context.lineTo(37, 12);
      context.lineTo(24, 27);
      context.stroke();
    } else {
      context.beginPath();
      context.roundRect(11, 9, 26, 20, 3);
      context.moveTo(24, 29);
      context.lineTo(24, 38);
      context.moveTo(17, 38);
      context.lineTo(31, 38);
      if (variant === 'map-board') {
        context.moveTo(16, 14);
        context.lineTo(22, 18);
        context.lineTo(28, 14);
        context.lineTo(33, 19);
        context.moveTo(22, 12);
        context.lineTo(22, 25);
        context.moveTo(28, 12);
        context.lineTo(28, 25);
      } else {
        context.moveTo(24, 17);
        context.lineTo(24, 24);
      }
      context.stroke();
      if (variant !== 'map-board') {
        context.beginPath();
        context.arc(24, 14, 1.8, 0, Math.PI * 2);
        context.fillStyle = ink;
        context.fill();
      }
    }
  } else if (category === 'amenities') {
    context.beginPath();
    context.moveTo(24, 10);
    context.bezierCurveTo(17, 19, 16, 24, 16, 28);
    context.arc(24, 28, 8, 0, Math.PI);
    context.bezierCurveTo(32, 24, 31, 19, 24, 10);
    context.stroke();
  } else if (category === 'parking') {
    context.fillStyle = ink;
    context.font = '700 27px system-ui, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(variant === 'parking' ? 'P' : 'P', 24, 24);
  } else {
    context.beginPath();
    context.moveTo(11, 33);
    context.lineTo(21, 17);
    context.lineTo(27, 25);
    context.lineTo(33, 15);
    context.lineTo(39, 33);
    context.moveTo(9, 34);
    context.lineTo(40, 34);
    context.stroke();
  }
  return context.getImageData(0, 0, size, size);
}

function communityMarkerImageId(marker: OsmCommunityMarker, colourKey = 'category'): string {
  return `osm-community-${marker.category}-${marker.variant}-${colourKey}-icon`;
}

function ensureCommunityMarkerImages(map: Map, data: OsmCommunityPlaceCollection): void {
  for (const feature of data.features) {
    const { markerCategory, markerColour, markerInk, markerIcon, markerImage } = feature.properties;
    if (map.hasImage(markerImage)) continue;
    map.addImage(
      markerImage,
      communityMarkerImage(markerCategory, markerColour, markerIcon, markerInk),
      { pixelRatio: 2 },
    );
  }
}

function recommendationMarkerInk(
  need: PlannerMapNeed | undefined,
  recommendationClass?: string,
): string {
  if (need === 'see' && recommendationClass === 'score-exceptional') return '#604800';
  if (need === 'see' && recommendationClass === 'score-high') return '#684b00';
  return '#fffdf8';
}

function isCuratedHesDesignation(feature: HeritageFeature): boolean {
  return feature.id.startsWith('hes-');
}

function matchesFeatureQuery(feature: HeritageFeature, query: string): boolean {
  const searchable = `${feature.name} ${(feature.alternativeNames ?? []).join(' ')} ${feature.featureType} ${(feature.tags ?? []).join(' ')}`;
  return searchable.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
}

function isPublicArtFeature(feature: HeritageFeature): boolean {
  return feature.tags.includes('public-art') || /public.?art/i.test(feature.featureType);
}

function isPlaqueOrMemorialFeature(feature: HeritageFeature): boolean {
  return (
    feature.tags.includes('plaque') ||
    feature.tags.includes('community-memorial') ||
    feature.featureType === 'plaque' ||
    /plaque|memorial|gravestone/i.test(feature.featureType) ||
    feature.featureType === 'memorial' ||
    feature.featureType === 'war_memorial'
  );
}

function isCurrentContextFeature(feature: HeritageFeature): boolean {
  return feature.tags.includes('current-context');
}

function matchesCommunityLayers(
  feature: HeritageFeature,
  showPublicArt: boolean,
  showPlaquesAndMemorials: boolean,
): boolean {
  const isPublicArt = isPublicArtFeature(feature);
  const isPlaqueOrMemorial = isPlaqueOrMemorialFeature(feature);
  return (!isPublicArt || showPublicArt) && (!isPlaqueOrMemorial || showPlaquesAndMemorials);
}

function isVisibleFeature(
  feature: HeritageFeature,
  year: number,
  includePossible: boolean,
  excludeUndated: boolean,
  query: string,
  includeDemolished: boolean,
  hideCuratedHesDesignations: boolean,
  showPublicArt: boolean,
  showPlaquesAndMemorials: boolean,
  showCurrentContext: boolean,
  archaeologyOnly: boolean,
  communityLayersOnly: boolean,
): boolean {
  const state = featureTimelineState(feature, year);
  const isPresentDayCommunityLayer =
    (showPublicArt && isPublicArtFeature(feature)) ||
    (showPlaquesAndMemorials && isPlaqueOrMemorialFeature(feature));
  const isPresentDayContextLayer = showCurrentContext && isCurrentContextFeature(feature);
  return (
    !isOsmCommunityPlace(feature) &&
    matchesFeatureQuery(feature, query) &&
    matchesCommunityLayers(feature, showPublicArt, showPlaquesAndMemorials) &&
    (!communityLayersOnly || isPresentDayCommunityLayer) &&
    isPublicTownFeature(feature) &&
    !isMapCatalogueRecord(feature) &&
    (!archaeologyOnly || isArchaeologyEvidenceFeature(feature)) &&
    (!hideCuratedHesDesignations || !isCuratedHesDesignation(feature)) &&
    (!excludeUndated || hasHistoricTimelineDate(feature)) &&
    (includeDemolished || feature.survival !== 'site_only_or_demolished') &&
    (isPresentDayCommunityLayer ||
      isPresentDayContextLayer ||
      state === 'definite' ||
      (includePossible && state === 'possible'))
  );
}

function mapOsmCommunityPlaces(
  pkg: ProjectPackage,
  showFood: boolean,
  showPicnic: boolean,
  showArt: boolean,
  showMemorials: boolean,
  showHistoricPlaces: boolean,
  showLeisure: boolean,
  showVisitor: boolean,
  showAmenities: boolean,
  showParking: boolean,
  showNature: boolean,
  curatedIds?: string[],
  fallbackNeed?: PlannerMapNeed,
): OsmCommunityPlaceCollection {
  const visibleCategories: Record<OsmCommunityCategory, boolean> = {
    food: showFood,
    picnic: showPicnic,
    art: showArt,
    memorial: showMemorials,
    historic: showHistoricPlaces,
    leisure: showLeisure,
    visitor: showVisitor,
    amenities: showAmenities,
    parking: showParking,
    nature: showNature,
  };
  const curatedIdSet = curatedIds ? new Set(curatedIds) : undefined;
  const scoreByFeatureId = new globalThis.Map<string, number | undefined>();
  if (fallbackNeed === 'see' || fallbackNeed === 'eat') {
    for (const place of visitorNeedPlaces(pkg, fallbackNeed, Number.MAX_SAFE_INTEGER, {
      curatedFeatureIds: curatedIds,
    })) {
      scoreByFeatureId.set(place.id, place.visitorScore);
    }
  }
  return {
    type: 'FeatureCollection' as const,
    features: pkg.features
      .filter((feature): feature is HeritageFeature & { geometry: Point } => {
        const marker =
          osmCommunityMarker(feature) ?? plannerNeedCommunityMarkerForFeature(feature, fallbackNeed);
        const category = marker?.category;
        return (
          (!curatedIdSet || curatedIdSet.has(feature.id)) &&
          isMappableVisitFeature(pkg, feature) &&
          Boolean(category && visibleCategories[category])
        );
      })
      .map((feature) => {
        const marker =
          osmCommunityMarker(feature) ?? plannerNeedCommunityMarkerForFeature(feature, fallbackNeed);
        if (!marker) return undefined;
        const score = scoreByFeatureId.get(feature.id);
        const recommendation =
          fallbackNeed === 'eat'
            ? foodRecommendation(score)
            : fallbackNeed === 'see'
              ? visitRecommendation(score)
              : undefined;
        const markerColour =
          (fallbackNeed === 'eat'
            ? foodRecommendationColour(recommendation)
            : visitRecommendationColour(recommendation)) ?? marker.colour;
        const markerInk = recommendationMarkerInk(fallbackNeed, recommendation?.className);
        return {
          type: 'Feature' as const,
          geometry: feature.geometry,
          properties: {
            id: feature.id,
            name: feature.name,
            markerIcon: marker.variant,
            markerCategory: marker.category,
            markerColour,
            markerInk,
            markerImage: communityMarkerImageId(marker, recommendation?.className),
            recommendationClass: recommendation?.className,
          },
        };
      })
      .filter((feature): feature is NonNullable<typeof feature> => Boolean(feature)),
  };
}

function plannerOsmCategoryVisibility(need: PlannerMapNeed): Record<OsmCommunityCategory, boolean> {
  const off = {
    food: false,
    picnic: false,
    art: false,
    memorial: false,
    historic: false,
    leisure: false,
    visitor: false,
    amenities: false,
    parking: false,
    nature: false,
  };
  if (need === 'eat') return { ...off, food: true };
  if (need === 'walk') {
    return { ...off, visitor: true, nature: true };
  }
  if (need === 'trails') {
    return { ...off, historic: true, visitor: true, nature: true };
  }
  if (need === 'parks') {
    return { ...off, leisure: true, nature: true };
  }
  if (need === 'picnic') return { ...off, picnic: true };
  if (need === 'photo') {
    return { ...off, art: true, memorial: true, historic: true, visitor: true, nature: true };
  }
  if (need === 'parking') return { ...off, parking: true };
  if (need === 'toilets') return { ...off, amenities: true };
  return {
    ...off,
    art: true,
    memorial: true,
    historic: true,
    leisure: true,
    visitor: true,
    nature: true,
  };
}

function allOsmCategoryVisibility(): Record<OsmCommunityCategory, boolean> {
  return {
    food: true,
    picnic: true,
    art: true,
    memorial: true,
    historic: true,
    leisure: true,
    visitor: true,
    amenities: true,
    parking: true,
    nature: true,
  };
}

function plannerMapCuratedFeatureIds(
  pkg: ProjectPackage,
  need: PlannerMapNeed,
): string[] {
  const bundledIds = curatedFeatureIds(publishedPlannerCurationForProject(pkg.project.id), need);
  if (need === 'see' || need === 'eat') {
    return visitorNeedPlaces(pkg, need, Number.MAX_SAFE_INTEGER, {
      ...(bundledIds.length ? { curatedFeatureIds: bundledIds } : {}),
    }).map((place) => place.id);
  }
  if (bundledIds.length) return bundledIds;
  return [];
}

function plannerHoverIconMarkup(need: PlannerMapNeed): string {
  if (need === 'eat') {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h10v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z"/><path d="M15 9h2.2a2.3 2.3 0 0 1 0 4.6H15"/><path d="M7 3v2"/><path d="M11 3v2"/><path d="M5 21h12"/></svg>`;
  }
  if (need === 'walk') {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 4.5a1.8 1.8 0 1 1-3.6 0 1.8 1.8 0 0 1 3.6 0z"/><path d="M10.8 7.5 8.6 12l3.4 2 1.2 5"/><path d="M9 12l-2.6 7"/><path d="m12 8.8 2.2 2.2 2.8-.8"/></svg>`;
  }
  if (need === 'trails') {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 18.5c3.8 0 3.8-4 7-4s3.2 4 7 4"/><path d="M5 5.5c3.8 0 3.8 4 7 4s3.2-4 7-4"/><circle cx="5" cy="18.5" r="1.5"/><circle cx="19" cy="5.5" r="1.5"/></svg>`;
  }
  if (need === 'parks') {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20v-5"/><path d="M8.2 15.5h7.6"/><path d="M7.8 15.5 12 4l4.2 11.5z"/></svg>`;
  }
  if (need === 'picnic') {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 10h14"/><path d="M8 10 5.5 19"/><path d="M16 10l2.5 9"/><path d="M7 15h10"/><path d="M10 6h4"/><path d="M12 6v4"/></svg>`;
  }
  if (need === 'photo') {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8.5h3l1.5-2h7l1.5 2h3v10H4z"/><circle cx="12" cy="13.5" r="3.2"/></svg>`;
  }
  if (need === 'parking') {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 20V4h5.4a4.3 4.3 0 0 1 0 8.6H7.5"/><path d="M7.5 12.6h5.2"/></svg>`;
  }
  if (need === 'toilets') {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/><path d="M6 21v-6H4.5l1.2-6h5.6l1.2 6H11v6"/><path d="M15.5 4v17"/><path d="M18.8 8v13"/><path d="M15.5 8h3.3"/></svg>`;
  }
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3.4 2.5 5.1 5.6.8-4 3.9.9 5.5-5-2.7-5 2.7.9-5.5-4-3.9 5.6-.8z"/></svg>`;
}

function mapFeatures(
  features: HeritageFeature[],
  year: number,
  includePossible: boolean,
  excludeUndated: boolean,
  query: string,
  includeDemolished: boolean,
  hideCuratedHesDesignations: boolean,
  showPublicArt: boolean,
  showPlaquesAndMemorials: boolean,
  showCurrentContext: boolean,
  archaeologyOnly: boolean,
  communityLayersOnly: boolean,
  methodology: ScoringMethodology,
) {
  return {
    type: 'FeatureCollection' as const,
    features: features
      .filter((feature): feature is HeritageFeature & { geometry: Point } => {
        return (
          feature.geometry?.type === 'Point' &&
          hasHistoricTimelineDate(feature) &&
          isVisibleFeature(
            feature,
            year,
            includePossible,
            excludeUndated,
            query,
            includeDemolished,
            hideCuratedHesDesignations,
            showPublicArt,
            showPlaquesAndMemorials,
            showCurrentContext,
            archaeologyOnly,
            communityLayersOnly,
          )
        );
      })
      .flatMap((feature) => {
        const locations = [feature.geometry, ...(feature.additionalPointLocations ?? [])];
        // Several HES point locations can belong to one statutory designation
        // (for example the separate wings of a hospital). Render each official
        // location while keeping one inspector record and one total heat score.
        return locations.map((geometry) => ({
          type: 'Feature' as const,
          geometry,
          properties: {
            id: feature.id,
            name: feature.name,
            state: featureTimelineState(feature, year),
            score: historicCharacterScore(feature, methodology) / locations.length,
            earliestEvidenceCentury: historicEvidenceCentury(feature),
            historicDotColour: historicDotColour(feature),
          },
        }));
      }),
  };
}

function mapPolygons(
  features: HeritageFeature[],
  year: number,
  includePossible: boolean,
  excludeUndated: boolean,
  query: string,
  includeDemolished: boolean,
  hideCuratedHesDesignations: boolean,
  showPublicArt: boolean,
  showPlaquesAndMemorials: boolean,
  showCurrentContext: boolean,
  archaeologyOnly: boolean,
  communityLayersOnly: boolean,
) {
  return {
    type: 'FeatureCollection' as const,
    features: features
      .filter((feature): feature is HeritageFeature & { geometry: Polygon | MultiPolygon } => {
        return (
          (feature.geometry?.type === 'Polygon' || feature.geometry?.type === 'MultiPolygon') &&
          isVisibleFeature(
            feature,
            year,
            includePossible,
            excludeUndated,
            query,
            includeDemolished,
            hideCuratedHesDesignations,
            showPublicArt,
            showPlaquesAndMemorials,
            showCurrentContext,
            archaeologyOnly,
            communityLayersOnly,
          )
        );
      })
      .map((feature) => ({
        type: 'Feature' as const,
        geometry: feature.geometry,
        properties: {
          id: feature.id,
          name: feature.name,
          state: featureTimelineState(feature, year),
          designationType: feature.designationType,
        },
      })),
  };
}

function mapLines(
  features: HeritageFeature[],
  year: number,
  includePossible: boolean,
  excludeUndated: boolean,
  query: string,
  includeDemolished: boolean,
  hideCuratedHesDesignations: boolean,
  showPublicArt: boolean,
  showPlaquesAndMemorials: boolean,
  showCurrentContext: boolean,
  archaeologyOnly: boolean,
  communityLayersOnly: boolean,
) {
  return {
    type: 'FeatureCollection' as const,
    features: features
      .filter((feature): feature is HeritageFeature & { geometry: LineString } => {
        return (
          feature.geometry?.type === 'LineString' &&
          isVisibleFeature(
            feature,
            year,
            includePossible,
            excludeUndated,
            query,
            includeDemolished,
            hideCuratedHesDesignations,
            showPublicArt,
            showPlaquesAndMemorials,
            showCurrentContext,
            archaeologyOnly,
            communityLayersOnly,
          )
        );
      })
      .map((feature) => ({
        type: 'Feature' as const,
        geometry: feature.geometry,
        properties: {
          id: feature.id,
          name: feature.name,
          state: featureTimelineState(feature, year),
        },
      })),
  };
}

function mapSettlementAge(polygons: SettlementAgePolygon[], year: number) {
  return {
    type: 'FeatureCollection' as const,
    features: polygons
      .filter((polygon) => !polygon.earliestEvidenceYear || polygon.earliestEvidenceYear <= year)
      .map((polygon) => ({
        type: 'Feature' as const,
        geometry: polygon.geometry,
        properties: { id: polygon.id, category: polygon.category, confidence: polygon.confidence },
      })),
  };
}

function mapVisitorHighlights(pkg: ProjectPackage) {
  return visitorHighlightGeoJson(pkg);
}

function resolvedTileUrl(tileUrl: string): string | undefined {
  const localTileServer = import.meta.env.VITE_HISTORIC_TILE_SERVER_URL;
  if (tileUrl.includes('{VITE_HISTORIC_TILE_SERVER_URL}') && !localTileServer) return undefined;
  return tileUrl.replace('{VITE_HISTORIC_TILE_SERVER_URL}', localTileServer ?? '');
}

export function MapCanvas() {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const hoverMarkerRef = useRef<maplibregl.Marker | null>(null);
  const hoverMarkerElementRef = useRef<HTMLDivElement | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [overlayError, setOverlayError] = useState<string | null>(null);
  const [mapOptionsOpen, setMapOptionsOpen] = useState(false);
  const pkg = useExplorerStore((state) => state.package);
  const year = useExplorerStore((state) => state.selectedYear);
  const possible = useExplorerStore((state) => state.possible);
  const excludeUndated = useExplorerStore((state) => state.excludeUndated);
  const query = useExplorerStore((state) => state.query);
  const demolished = useExplorerStore((state) => state.demolished);
  const showHistoricHeatmap = useExplorerStore((state) => state.showHistoricHeatmap);
  const setShowHistoricHeatmap = useExplorerStore((state) => state.setShowHistoricHeatmap);
  const showHistoricPlaces = useExplorerStore((state) => state.showHistoricPlaces);
  const setShowHistoricPlaces = useExplorerStore((state) => state.setShowHistoricPlaces);
  const showOsmPoints = useExplorerStore((state) => state.showOsmPoints);
  const setShowOsmPoints = useExplorerStore((state) => state.setShowOsmPoints);
  const showHistoryTimeline = useExplorerStore((state) => state.showHistoryTimeline);
  const setShowHistoryTimeline = useExplorerStore((state) => state.setShowHistoryTimeline);
  const showHesDesignations = useExplorerStore((state) => state.showHesDesignations);
  const showPublicArt = useExplorerStore((state) => state.showPublicArt);
  const showPlaquesAndMemorials = useExplorerStore((state) => state.showPlaquesAndMemorials);
  const showCurrentContext = useExplorerStore((state) => state.showCurrentContext);
  const showOsmFood = useExplorerStore((state) => state.showOsmFood);
  const showOsmPicnic = useExplorerStore((state) => state.showOsmPicnic);
  const showOsmArt = useExplorerStore((state) => state.showOsmArt);
  const showOsmMemorials = useExplorerStore((state) => state.showOsmMemorials);
  const showOsmHistoricPlaces = useExplorerStore((state) => state.showOsmHistoricPlaces);
  const showOsmLeisure = useExplorerStore((state) => state.showOsmLeisure);
  const showOsmVisitor = useExplorerStore((state) => state.showOsmVisitor);
  const showOsmAmenities = useExplorerStore((state) => state.showOsmAmenities);
  const showOsmParking = useExplorerStore((state) => state.showOsmParking);
  const showOsmNature = useExplorerStore((state) => state.showOsmNature);
  const activePlannerNeed = useExplorerStore((state) => state.activePlannerNeed);
  const adminMode = useExplorerStore((state) => state.adminMode);
  const exploreMapStyle = useExplorerStore((state) => state.exploreMapStyle);
  const setExploreMapStyle = useExplorerStore((state) => state.setExploreMapStyle);
  const showHistoricLegend = useExplorerStore((state) => state.showHistoricLegend);
  const showOsmLegend = useExplorerStore((state) => state.showOsmLegend);
  const archaeologyOnly = useExplorerStore((state) => state.archaeologyOnly);
  const communityLayersOnly = useExplorerStore((state) => state.communityLayersOnly);
  const settlementAge = useExplorerStore((state) => state.settlementAge);
  const showAreaPolygons = useExplorerStore((state) => state.showAreaPolygons);
  const select = useExplorerStore((state) => state.selectFeature);
  const setHoveredFeature = useExplorerStore((state) => state.setHoveredFeature);
  const hoveredFeatureId = useExplorerStore((state) => state.hoveredFeatureId);
  const hoveredFeatureSource = useExplorerStore((state) => state.hoveredFeatureSource);
  const activeMap = useExplorerStore((state) => state.activeMap);
  const visibleData = mapFeatures(
    pkg.features,
    year,
    possible,
    excludeUndated,
    query,
    demolished,
    showHesDesignations,
    showPublicArt,
    showPlaquesAndMemorials,
    showCurrentContext,
    archaeologyOnly,
    communityLayersOnly,
    pkg.project.methodology,
  );
  const visiblePolygons = mapPolygons(
    pkg.features,
    year,
    possible,
    excludeUndated,
    query,
    demolished,
    showHesDesignations,
    showPublicArt,
    showPlaquesAndMemorials,
    showCurrentContext,
    archaeologyOnly,
    communityLayersOnly,
  );
  const visibleLines = mapLines(
    pkg.features,
    year,
    possible,
    excludeUndated,
    query,
    demolished,
    showHesDesignations,
    showPublicArt,
    showPlaquesAndMemorials,
    showCurrentContext,
    archaeologyOnly,
    communityLayersOnly,
  );
  const visibleSettlementAge = communityLayersOnly
    ? mapSettlementAge([], year)
    : mapSettlementAge(pkg.settlementPolygons, year);
  const plannerOsmVisibility = adminMode
    ? allOsmCategoryVisibility()
    : plannerOsmCategoryVisibility(activePlannerNeed);
  const activePlannerCuratedIds = adminMode
    ? undefined
    : plannerMapCuratedFeatureIds(pkg, activePlannerNeed);
  const visibleOsmCommunityPlaces = mapOsmCommunityPlaces(
    pkg,
    showOsmFood && plannerOsmVisibility.food,
    showOsmPicnic && plannerOsmVisibility.picnic,
    showOsmArt && plannerOsmVisibility.art,
    showOsmMemorials && plannerOsmVisibility.memorial,
    showOsmHistoricPlaces && plannerOsmVisibility.historic,
    showOsmLeisure && plannerOsmVisibility.leisure,
    showOsmVisitor && plannerOsmVisibility.visitor,
    showOsmAmenities && plannerOsmVisibility.amenities,
    showOsmParking && plannerOsmVisibility.parking,
    showOsmNature && plannerOsmVisibility.nature,
    activePlannerCuratedIds,
    adminMode ? undefined : activePlannerNeed,
  );
  const hoveredOsmCommunityPlace = visibleOsmCommunityPlaces.features.find(
    (feature) => feature.properties.id === hoveredFeatureId,
  );
  const activePlannerPlaces = visitorNeedPlaces(
    pkg,
    activePlannerNeed,
    Number.MAX_SAFE_INTEGER,
    { curatedFeatureIds: activePlannerCuratedIds },
  );
  const hoveredPlannerPlace = activePlannerPlaces.find((place) => place.id === hoveredFeatureId);
  const hoveredPlannerRecommendation =
    activePlannerNeed === 'eat'
      ? foodRecommendation(hoveredPlannerPlace?.visitorScore)
      : activePlannerNeed === 'see'
        ? visitRecommendation(hoveredPlannerPlace?.visitorScore)
        : undefined;
  const hoveredPlannerMarkerColour =
    (activePlannerNeed === 'eat'
      ? foodRecommendationColour(hoveredPlannerRecommendation)
      : activePlannerNeed === 'see'
        ? visitRecommendationColour(hoveredPlannerRecommendation)
        : undefined) ?? hoveredOsmCommunityPlace?.properties.markerColour;
  const hoveredPlannerMarkerInk = hoveredPlannerRecommendation
    ? recommendationMarkerInk(activePlannerNeed, hoveredPlannerRecommendation.className)
    : hoveredOsmCommunityPlace?.properties.markerInk;
  const visibleVisitorHighlights = mapVisitorHighlights(pkg);
  const visibleDataRef = useRef(visibleData);
  const visiblePolygonsRef = useRef(visiblePolygons);
  const visibleLinesRef = useRef(visibleLines);
  const visibleSettlementAgeRef = useRef(visibleSettlementAge);
  const visibleOsmCommunityPlacesRef = useRef(visibleOsmCommunityPlaces);
  const showHistoricHeatmapRef = useRef(showHistoricHeatmap);
  const showHistoricPlacesRef = useRef(showHistoricPlaces);
  const showOsmPointsRef = useRef(showOsmPoints);
  const settlementAgeRef = useRef(settlementAge);
  const showAreaPolygonsRef = useRef(showAreaPolygons);
  const featuresRef = useRef(pkg.features);
  const selectRef = useRef(select);
  const setHoveredFeatureRef = useRef(setHoveredFeature);
  visibleDataRef.current = visibleData;
  visiblePolygonsRef.current = visiblePolygons;
  visibleLinesRef.current = visibleLines;
  visibleSettlementAgeRef.current = visibleSettlementAge;
  visibleOsmCommunityPlacesRef.current = visibleOsmCommunityPlaces;
  showHistoricHeatmapRef.current = showHistoricHeatmap;
  showHistoricPlacesRef.current = showHistoricPlaces;
  showOsmPointsRef.current = showOsmPoints;
  settlementAgeRef.current = settlementAge;
  showAreaPolygonsRef.current = showAreaPolygons;
  featuresRef.current = pkg.features;
  selectRef.current = select;
  setHoveredFeatureRef.current = setHoveredFeature;
  useEffect(() => {
    if (!container.current || mapRef.current) return;
    const mapContainer = container.current;
    const map = new maplibregl.Map({
      container: mapContainer,
      style: import.meta.env.VITE_MAP_STYLE_URL || freeMapStyle(exploreMapStyle),
      center: pkg.project.centre,
      zoom: 13,
      attributionControl: false,
    });
    (mapContainer as HTMLDivElement & { __exploreMap?: Map }).__exploreMap = map;
    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-right');
    map.on('error', (event) => {
      const sourceId = (event as unknown as { sourceId?: string }).sourceId;
      if (sourceId === 'historic-overlay') {
        setOverlayError(
          'The selected historic map could not be loaded. Try another layer or refresh the map.',
        );
      }
      if (sourceId === 'hes-designations-overlay') {
        setOverlayError(
          'The live HES designations overlay could not be loaded. Try again shortly.',
        );
      }
    });
    map.on('load', () => {
      map.addSource('project-boundary', {
        type: 'geojson',
        data: pkg.project.townStudyArea?.visitorBoundary ?? pkg.project.boundary,
      });
      map.addLayer({
        id: 'project-boundary-fill',
        type: 'fill',
        source: 'project-boundary',
        paint: { 'fill-color': '#2f7778', 'fill-opacity': 0.045 },
      });
      for (const feature of pkg.features) {
        const marker = osmCommunityMarker(feature);
        if (!marker) continue;
        const imageId = `osm-community-${marker.category}-${marker.variant}-icon`;
        if (!map.hasImage(imageId))
          map.addImage(
            imageId,
            communityMarkerImage(marker.category, marker.colour, marker.variant),
            { pixelRatio: 2 },
          );
      }
      for (const marker of defaultPlannerCommunityMarkers) {
        const imageId = `osm-community-${marker.category}-${marker.variant}-icon`;
        if (!map.hasImage(imageId))
          map.addImage(
            imageId,
            communityMarkerImage(marker.category, marker.colour, marker.variant),
            { pixelRatio: 2 },
          );
      }
      ensureCommunityMarkerImages(map, visibleOsmCommunityPlacesRef.current);
      map.addSource('osm-community-places', {
        type: 'geojson',
        data: visibleOsmCommunityPlacesRef.current,
      });
      map.addLayer({
        id: 'project-boundary-line',
        type: 'line',
        source: 'project-boundary',
        paint: {
          'line-color': '#1d696c',
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1, 15, 1.45],
          'line-opacity': 0.64,
        },
      });
      map.addSource('settlement-age', { type: 'geojson', data: visibleSettlementAgeRef.current });
      map.addLayer({
        id: 'settlement-age-fill',
        type: 'fill',
        source: 'settlement-age',
        layout: { visibility: settlementAgeRef.current ? 'visible' : 'none' },
        paint: {
          'fill-color': [
            'match',
            ['get', 'category'],
            'developed_by_1700',
            '#7a3e2c',
            'developed_by_1800',
            '#a65f38',
            'developed_by_1850',
            '#c9904b',
            'developed_by_1900',
            '#d4b86c',
            '#93a58d',
          ],
          'fill-opacity': 0.24,
        },
      });
      map.addLayer({
        id: 'settlement-age-line',
        type: 'line',
        source: 'settlement-age',
        layout: { visibility: settlementAgeRef.current ? 'visible' : 'none' },
        paint: { 'line-color': '#5c513c', 'line-width': 1.5, 'line-opacity': 0.8 },
      });
      map.addSource('heritage-features', {
        type: 'geojson',
        data: visibleDataRef.current,
      });
      map.addLayer({
        id: 'historic-character-heatmap',
        type: 'heatmap',
        source: 'heritage-features',
        maxzoom: historicHeatmapMaxZoom,
        layout: { visibility: showHistoricHeatmapRef.current ? 'visible' : 'none' },
        paint: historicHeatmapPaint(),
      });
      map.addLayer({
        id: 'heritage-features',
        type: 'circle',
        source: 'heritage-features',
        // Keep the heat layer useful at overview scale, but expose individual
        // source-backed features at a normal town-scale zoom without bringing
        // back the numbered cluster markers.
        minzoom: 13,
        layout: { visibility: showHistoricPlacesRef.current ? 'visible' : 'none' },
        paint: {
          'circle-radius': 6,
          'circle-color': ['get', 'historicDotColour'],
          'circle-opacity': ['match', ['get', 'state'], 'definite', 0.95, 0.65],
          'circle-stroke-width': 1,
          'circle-stroke-color': '#fff',
        },
      });
      map.addSource('heritage-polygons', {
        type: 'geojson',
        data: visiblePolygonsRef.current,
      });
      map.addLayer(
        {
          id: 'heritage-polygons-fill',
          type: 'fill',
          source: 'heritage-polygons',
          layout: {
            visibility:
              showHistoricPlacesRef.current && showAreaPolygonsRef.current ? 'visible' : 'none',
          },
          paint: {
            'fill-color': ['match', ['get', 'state'], 'definite', '#176b87', '#4e8fa8'],
            'fill-opacity': 0.22,
          },
        },
        'heritage-features',
      );
      map.addLayer(
        {
          id: 'heritage-polygons-line',
          type: 'line',
          source: 'heritage-polygons',
          layout: {
            visibility:
              showHistoricPlacesRef.current && showAreaPolygonsRef.current ? 'visible' : 'none',
          },
          paint: { 'line-color': '#12536b', 'line-width': 2 },
        },
        'heritage-features',
      );
      map.addSource('heritage-lines', { type: 'geojson', data: visibleLinesRef.current });
      map.addLayer({
        id: 'heritage-lines',
        type: 'line',
        source: 'heritage-lines',
        layout: { visibility: showHistoricPlacesRef.current ? 'visible' : 'none' },
        paint: {
          'line-color': ['match', ['get', 'state'], 'definite', '#714b22', '#a87931'],
          'line-width': 5,
          'line-opacity': 0.82,
        },
      });
      // This optional present-day layer stays above the historic heat map and
      // feature circles, so its category-specific symbols remain legible.
      map.addLayer({
        id: 'osm-community-places',
        type: 'symbol',
        source: 'osm-community-places',
        minzoom: 13,
        layout: {
          visibility: showOsmPointsRef.current ? 'visible' : 'none',
          'icon-image': ['get', 'markerImage'],
          // Keep public POI icons quiet; right-panel hover/focus provides the
          // larger pulsing marker when a visitor is actively inspecting a place.
          'icon-size': 0.55,
          // Current-place icons must not disappear behind base-map labels or
          // one another. Their smaller size limits visual crowding instead.
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
      });
      map.on('click', 'heritage-features', (event) => {
        const id = event.features?.[0]?.properties?.id;
        selectRef.current(featuresRef.current.find((feature) => feature.id === id));
      });
      map.on('click', 'osm-community-places', (event) => {
        const id = event.features?.[0]?.properties?.id;
        selectRef.current(featuresRef.current.find((feature) => feature.id === id));
      });
      for (const layerId of ['heritage-features', 'osm-community-places']) {
        map.on('mousemove', layerId, (event) => {
          const id = event.features?.[0]?.properties?.id;
          if (typeof id === 'string') setHoveredFeatureRef.current(id, 'map');
        });
        map.on('mouseenter', layerId, () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', layerId, () => {
          map.getCanvas().style.cursor = '';
          setHoveredFeatureRef.current(undefined);
        });
      }
      // Evidence/designation fills are intentionally non-interactive, so they
      // never replace a point selection where the two overlap.
      map.on('click', 'heritage-lines', (event) => {
        const id = event.features?.[0]?.properties?.id;
        selectRef.current(featuresRef.current.find((feature) => feature.id === id));
      });
      setMapReady(true);
    });
    mapRef.current = map;
    return () => {
      hoverMarkerRef.current?.remove();
      hoverMarkerRef.current = null;
      hoverMarkerElementRef.current = null;
      delete (mapContainer as HTMLDivElement & { __exploreMap?: Map }).__exploreMap;
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, [exploreMapStyle, pkg.project, pkg.features]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (hoveredFeatureSource !== 'visitor-list') {
      hoverMarkerRef.current?.remove();
      return;
    }
    const visitorHighlight = visibleVisitorHighlights.features.find(
      (highlight) => highlight.properties.id === hoveredFeatureId,
    );
    const feature = pkg.features.find(
      (candidate): candidate is HeritageFeature & { geometry: Point } =>
        candidate.id === hoveredFeatureId && candidate.geometry?.type === 'Point',
    );
    const coordinates = visitorHighlight?.geometry.coordinates ?? feature?.geometry.coordinates;
    if (!coordinates) {
      hoverMarkerRef.current?.remove();
      return;
    }

    if (!hoverMarkerElementRef.current) {
      hoverMarkerElementRef.current = document.createElement('div');
    }
    const element = hoverMarkerElementRef.current;
    element.className = 'map-hover-marker';
    let bounceElement = element.firstElementChild as HTMLDivElement | null;
    if (!bounceElement) {
      bounceElement = document.createElement('div');
      element.append(bounceElement);
    }
    bounceElement.className = `map-hover-bounce map-hover-bounce--visitor map-hover-bounce--${activePlannerNeed}`;
    bounceElement.dataset.category = activePlannerNeed;
    bounceElement.innerHTML = plannerHoverIconMarkup(activePlannerNeed);
    if (hoveredPlannerMarkerColour) {
      bounceElement.style.setProperty('--hover-marker-colour', hoveredPlannerMarkerColour);
    } else {
      bounceElement.style.removeProperty('--hover-marker-colour');
    }
    if (hoveredPlannerMarkerInk) {
      bounceElement.style.setProperty('--hover-marker-ink', hoveredPlannerMarkerInk);
    } else {
      bounceElement.style.removeProperty('--hover-marker-ink');
    }

    if (!hoverMarkerRef.current) {
      hoverMarkerRef.current = new maplibregl.Marker({
        element,
        anchor: 'center',
        offset: [0, 0],
      });
    }
    hoverMarkerRef.current.setLngLat(coordinates as [number, number]).addTo(map);
  }, [
    activePlannerNeed,
    hoveredFeatureId,
    hoveredFeatureSource,
    hoveredPlannerMarkerColour,
    hoveredPlannerMarkerInk,
    visibleVisitorHighlights,
    pkg.features,
    mapReady,
  ]);
  useEffect(() => {
    const map = mapRef.current;
    const source = map?.getSource('heritage-features') as maplibregl.GeoJSONSource | undefined;
    if (source) source.setData(visibleData);
  }, [visibleData]);
  useEffect(() => {
    const map = mapRef.current;
    const source = map?.getSource('osm-community-places') as maplibregl.GeoJSONSource | undefined;
    if (map) ensureCommunityMarkerImages(map, visibleOsmCommunityPlaces);
    if (source) source.setData(visibleOsmCommunityPlaces);
  }, [visibleOsmCommunityPlaces]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (map.getLayer('osm-community-places'))
      map.setLayoutProperty(
        'osm-community-places',
        'visibility',
        showOsmPoints ? 'visible' : 'none',
      );
  }, [showOsmPoints, mapReady]);
  useEffect(() => {
    const map = mapRef.current;
    const source = map?.getSource('heritage-polygons') as maplibregl.GeoJSONSource | undefined;
    if (source) source.setData(visiblePolygons);
  }, [visiblePolygons]);
  useEffect(() => {
    const map = mapRef.current;
    const source = map?.getSource('heritage-lines') as maplibregl.GeoJSONSource | undefined;
    if (source) source.setData(visibleLines);
  }, [visibleLines]);
  useEffect(() => {
    const map = mapRef.current;
    const source = map?.getSource('settlement-age') as maplibregl.GeoJSONSource | undefined;
    if (source) source.setData(visibleSettlementAge);
  }, [visibleSettlementAge]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const boundarySource = map.getSource('project-boundary') as
      maplibregl.GeoJSONSource | undefined;
    boundarySource?.setData(
      pkg.project.townStudyArea?.visitorBoundary ?? pkg.project.boundary,
    );
    map.flyTo({ center: pkg.project.centre, zoom: 13, essential: true });
  }, [
    pkg.project.id,
    pkg.project.centre,
    pkg.project.boundary,
    pkg.project.townStudyArea?.visitorBoundary,
    mapReady,
  ]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const layer of ['settlement-age-fill', 'settlement-age-line']) {
      if (map.getLayer(layer))
        map.setLayoutProperty(layer, 'visibility', settlementAge ? 'visible' : 'none');
    }
  }, [settlementAge, mapReady]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (map.getLayer('historic-character-heatmap'))
      map.setLayoutProperty(
        'historic-character-heatmap',
        'visibility',
        showHistoricHeatmap ? 'visible' : 'none',
      );
  }, [showHistoricHeatmap, mapReady]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (map.getLayer('heritage-features'))
      map.setLayoutProperty(
        'heritage-features',
        'visibility',
        showHistoricPlaces ? 'visible' : 'none',
      );
    if (map.getLayer('heritage-lines'))
      map.setLayoutProperty(
        'heritage-lines',
        'visibility',
        showHistoricPlaces ? 'visible' : 'none',
      );
    for (const layer of ['heritage-polygons-fill', 'heritage-polygons-line']) {
      if (map.getLayer(layer))
        map.setLayoutProperty(
          layer,
          'visibility',
          showHistoricPlaces && showAreaPolygons ? 'visible' : 'none',
        );
    }
  }, [showHistoricPlaces, showAreaPolygons, mapReady]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const applyLayer = () => {
      setOverlayError(null);
      if (map.getLayer('historic-overlay')) map.removeLayer('historic-overlay');
      if (map.getSource('historic-overlay')) map.removeSource('historic-overlay');
      const tileUrl = activeMap?.tileUrl && resolvedTileUrl(activeMap.tileUrl);
      if (activeMap?.id === hesDesignationsLayerId) return;
      if (
        activeMap?.layerType !== 'xyz' &&
        activeMap?.layerType !== 'wms' &&
        activeMap?.layerType !== 'georeferenced_raster_tiles'
      )
        return;
      if (!tileUrl) {
        setOverlayError('This historic map package is not installed on the local tile server.');
        return;
      }
      map.addSource('historic-overlay', { type: 'raster', tiles: [tileUrl], tileSize: 256 });
      map.addLayer({
        id: 'historic-overlay',
        type: 'raster',
        source: 'historic-overlay',
        paint: { 'raster-opacity': activeMap.opacity },
      });
    };
    applyLayer();
  }, [activeMap, mapReady]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (map.getLayer('hes-designations-overlay')) map.removeLayer('hes-designations-overlay');
    if (map.getSource('hes-designations-overlay')) map.removeSource('hes-designations-overlay');
    if (!showHesDesignations || communityLayersOnly) return;

    const hesLayer = pkg.historicMaps.find((mapLayer) => mapLayer.id === hesDesignationsLayerId);
    const tileUrl = hesLayer?.tileUrl && resolvedTileUrl(hesLayer.tileUrl);
    if (!tileUrl) {
      return;
    }
    setOverlayError(null);
    map.addSource('hes-designations-overlay', { type: 'raster', tiles: [tileUrl], tileSize: 256 });
    map.addLayer(
      {
        id: 'hes-designations-overlay',
        type: 'raster',
        source: 'hes-designations-overlay',
        paint: { 'raster-opacity': hesLayer.opacity },
      },
      'historic-character-heatmap',
    );
  }, [pkg.historicMaps, showHesDesignations, communityLayersOnly, mapReady]);
  return (
    <div className="map-wrap">
      <div ref={container} className="map" aria-label="Historic map" />
      <div className="map-options">
        <button
          type="button"
          className="map-options-trigger"
          aria-expanded={mapOptionsOpen}
          onClick={() => setMapOptionsOpen((open) => !open)}
        >
          Map options
        </button>
        {mapOptionsOpen && (
          <div className="map-layer-controls" aria-label="Map layer controls">
            <label className="map-style-control">
              <span>Map style</span>
              <select
                value={exploreMapStyle}
                aria-label="Map style"
                onChange={(event) => setExploreMapStyle(event.target.value as typeof exploreMapStyle)}
              >
                {Object.entries(freeMapStyleLabels).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="map-layer-switch">
              <input
                type="checkbox"
                checked={showHistoricHeatmap}
                onChange={(event) => setShowHistoricHeatmap(event.target.checked)}
              />
              <span aria-hidden="true" />
              <strong>Heritage glow</strong>
            </label>
            <label className="map-layer-switch">
              <input
                type="checkbox"
                checked={showHistoricPlaces}
                onChange={(event) => setShowHistoricPlaces(event.target.checked)}
              />
              <span aria-hidden="true" />
              <strong>Heritage pins</strong>
            </label>
            <label className="map-layer-switch">
              <input
                type="checkbox"
                checked={showOsmPoints}
                onChange={(event) => setShowOsmPoints(event.target.checked)}
              />
              <span aria-hidden="true" />
              <strong>Visitor pins</strong>
            </label>
            <label className="map-layer-switch">
              <input
                type="checkbox"
                checked={showHistoryTimeline}
                onChange={(event) => setShowHistoryTimeline(event.target.checked)}
              />
              <span aria-hidden="true" />
              <strong>Timeline</strong>
            </label>
          </div>
        )}
      </div>
      <div className="attribution">
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
          {import.meta.env.VITE_MAP_ATTRIBUTION || freeMapAttribution(exploreMapStyle)}
        </a>
      </div>
      {((showHistoricLegend && showHistoricPlaces) ||
        showHesDesignations ||
        (showOsmLegend && showOsmPoints)) && (
        <aside className="map-legend" aria-label="Map key">
          {showHistoricLegend && showHistoricPlaces && (
            <section>
              <h2>Historic dots</h2>
              <p>Earliest evidence century</p>
              <ul className="legend-list historic-legend-list">
                <li>
                  <span className="legend-dot age-pre1000" />
                  Before 1000
                </li>
                <li>
                  <span className="legend-dot age-1000" />
                  1000–1199
                </li>
                <li>
                  <span className="legend-dot age-1200" />
                  1200–1399
                </li>
                <li>
                  <span className="legend-dot age-1400" />
                  1400–1599
                </li>
                <li>
                  <span className="legend-dot age-1600" />
                  1600–1799
                </li>
                <li>
                  <span className="legend-dot age-1800" />
                  1800–1899
                </li>
                <li>
                  <span className="legend-dot age-1900" />
                  1900 onwards
                </li>
                <li>
                  <span className="legend-dot age-unknown" />
                  No numeric evidence year
                </li>
              </ul>
            </section>
          )}
          {showHesDesignations && (
            <section className="hes-legend-section">
              <h2>Live HES designations</h2>
              <p>
                <span className="hes-legend-dot" aria-hidden="true" /> Dark and category symbols are
                from the current HES statutory overlay, not the historic-dot scale.
              </p>
              <p>Turn off “Show current HES designations” in Settings to hide them.</p>
            </section>
          )}
          {showOsmLegend && showOsmPoints && (
            <section
              className={
                showHistoricLegend || showHesDesignations ? 'osm-legend-section' : undefined
              }
            >
              <h2>Current OSM places</h2>
              <p>Optional present-day context</p>
              <ul className="legend-list osm-legend-list">
                <li>
                  <span className="osm-legend-icon food" aria-hidden="true">
                    ☕
                  </span>
                  Food &amp; drink
                </li>
                <li>
                  <span className="osm-legend-icon picnic" aria-hidden="true">
                    ▰
                  </span>
                  Picnic &amp; rest
                </li>
                <li>
                  <span className="osm-legend-icon art" aria-hidden="true">
                    ✦
                  </span>
                  Art &amp; culture
                </li>
                <li>
                  <span className="osm-legend-icon memorial" aria-hidden="true">
                    ▤
                  </span>
                  Memorials &amp; plaques
                </li>
                <li>
                  <span className="osm-legend-icon historic" aria-hidden="true">
                    ⌂
                  </span>
                  Historic places
                </li>
                <li>
                  <span className="osm-legend-icon leisure" aria-hidden="true">
                    ◉
                  </span>
                  Leisure
                </li>
                <li>
                  <span className="osm-legend-icon visitor" aria-hidden="true">
                    ▣
                  </span>
                  Visitor information
                </li>
                <li>
                  <span className="osm-legend-icon amenities" aria-hidden="true">
                    ●
                  </span>
                  Amenities
                </li>
                <li>
                  <span className="osm-legend-icon parking" aria-hidden="true">
                    P
                  </span>
                  Parking
                </li>
                <li>
                  <span className="osm-legend-icon nature" aria-hidden="true">
                    △
                  </span>
                  Natural sights
                </li>
              </ul>
            </section>
          )}
        </aside>
      )}
      {overlayError && (
        <p className="map-overlay-error" role="status">
          {overlayError}
        </p>
      )}
    </div>
  );
}
