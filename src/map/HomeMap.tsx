import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import maplibregl, { type Map as MapLibreMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useExplorerStore } from '../app/store';
import { HomeDiscoveryPanel } from '../components/HomeDiscoveryPanel';
import { StandaloneAttractionGuide } from '../components/StandaloneAttractionGuide';
import { publishedProjectPackages } from '../data/publishedProjects';
import type { HeritageFeature } from '../domain/models';
import {
  homePoiOverviews,
  homePoiMatchesDiscoveryScope,
  homePoiMatchesRatingRange,
  homePoiPermanentLabelLimit,
  homePoiRecommendation,
  homeTownMatchesRatingRange,
  homeTownOverviews,
  selectVisibleHomeLabels,
  sortHomeDiscoveryPois,
  type HomeDiscoveryMode,
  type HomeDiscoveryScope,
  type HomePoiOverview,
  type HomeRatingRange,
  type HomeTownOverview,
} from './homeOverview';
import { homeLabelFreeAttribution, homeLabelFreeMapStyle } from './styles';

interface HomeMapElement extends HTMLDivElement {
  __homeMap?: MapLibreMap;
}

interface HomeTownMarker {
  town: HomeTownOverview;
  marker: maplibregl.Marker;
  element: HTMLButtonElement;
}

interface HomePoiMarker {
  poi: HomePoiOverview;
  marker: maplibregl.Marker;
  element: HTMLButtonElement;
  rankElement: HTMLSpanElement;
  nameElement: HTMLSpanElement;
}

interface HomeRatingFilterConfig {
  min: number;
  max: number;
  step: number;
  label: string;
}

const homeRatingFilterConfigs: Record<HomeDiscoveryMode, HomeRatingFilterConfig> = {
  towns: { min: 0, max: 3, step: 1, label: 'Town rating' },
  attraction: { min: 1, max: 3, step: 1, label: 'Point of interest rating' },
  eat: { min: 1, max: 3, step: 1, label: 'Point of interest rating' },
};

const defaultHomeRatingRanges: Record<HomeDiscoveryMode, HomeRatingRange> = {
  towns: { min: 0, max: 3 },
  attraction: { min: 1, max: 3 },
  eat: { min: 1, max: 3 },
};

function appendHomePoiRank(element: HTMLElement): HTMLSpanElement {
  const visual = document.createElement('span');
  visual.className = 'home-poi-marker-visual';
  visual.setAttribute('aria-hidden', 'true');
  const rank = document.createElement('span');
  rank.className = 'home-poi-marker-rank';
  visual.append(rank);
  element.append(visual);
  return rank;
}

function samePoiList(left: HomePoiOverview[], right: HomePoiOverview[]): boolean {
  return left.length === right.length && left.every((poi, index) => poi.id === right[index]?.id);
}

function boxesOverlap(
  left: { x: number; y: number },
  right: { x: number; y: number },
  size = 38,
): boolean {
  return Math.abs(left.x - right.x) < size && Math.abs(left.y - right.y) < size;
}

function rectanglesOverlap(left: DOMRect, right: DOMRect, padding = 4): boolean {
  return !(
    left.right + padding <= right.left ||
    left.left >= right.right + padding ||
    left.bottom + padding <= right.top ||
    left.top >= right.bottom + padding
  );
}

function attachMarkerActivation(element: HTMLButtonElement, activate: () => void): void {
  element.addEventListener('pointerup', activate);
  element.addEventListener('click', (event) => {
    if (event.detail === 0) activate();
  });
}

export function HomeMap() {
  const container = useRef<HomeMapElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const townMarkersRef = useRef(new globalThis.Map<string, HomeTownMarker>());
  const poiMarkersRef = useRef(new globalThis.Map<string, HomePoiMarker>());
  const updateMapContentRef = useRef<() => void>(() => {});
  const updateMarkerInteractionRef = useRef<() => void>(() => {});
  const [discoveryMode, setDiscoveryMode] = useState<HomeDiscoveryMode>('towns');
  const [discoveryScope, setDiscoveryScope] = useState<HomeDiscoveryScope>('all');
  const [ratingRanges, setRatingRanges] = useState(defaultHomeRatingRanges);
  const [visibleHomePois, setVisibleHomePois] = useState<HomePoiOverview[]>([]);
  const [selectedPoiId, setSelectedPoiId] = useState<string>();
  const [hoveredPoiId, setHoveredPoiId] = useState<string>();
  const discoveryModeRef = useRef(discoveryMode);
  const discoveryScopeRef = useRef(discoveryScope);
  const ratingRangesRef = useRef(ratingRanges);
  const selectedPoiIdRef = useRef(selectedPoiId);
  const hoveredPoiIdRef = useRef(hoveredPoiId);
  const [mapReady, setMapReady] = useState(false);
  const setPackage = useExplorerStore((state) => state.setPackage);
  const setMode = useExplorerStore((state) => state.setMode);
  const overviewTowns = useMemo(() => homeTownOverviews(publishedProjectPackages), []);
  const homePois = useMemo(
    () => [
      ...homePoiOverviews(publishedProjectPackages, 'attraction', 50),
      ...homePoiOverviews(publishedProjectPackages, 'eat', 50),
    ],
    [],
  );
  const packagesById = useMemo(
    () =>
      new globalThis.Map(
        publishedProjectPackages.map((projectPackage) => [
          projectPackage.project.id,
          projectPackage,
        ]),
      ),
    [],
  );
  const featuresByPoiId = useMemo(() => {
    const result = new globalThis.Map<string, HeritageFeature>();
    for (const poi of homePois) {
      const feature = packagesById
        .get(poi.projectId)
        ?.features.find((candidate) => candidate.id === poi.featureId);
      if (feature) result.set(poi.id, feature);
    }
    return result;
  }, [homePois, packagesById]);
  const selectedPoi = homePois.find((poi) => poi.id === selectedPoiId);
  const selectedFeature = selectedPoiId ? featuresByPoiId.get(selectedPoiId) : undefined;
  const showStandaloneAttractionGuide = Boolean(
    selectedPoi?.kind === 'attraction' &&
    selectedPoi.discoveryScope === 'standalone' &&
    selectedPoi.attractionGuide?.heroImage,
  );

  discoveryModeRef.current = discoveryMode;
  discoveryScopeRef.current = discoveryScope;
  ratingRangesRef.current = ratingRanges;
  selectedPoiIdRef.current = selectedPoiId;
  hoveredPoiIdRef.current = hoveredPoiId;

  const openTown = useCallback(
    (id: string): void => {
      const next = packagesById.get(id);
      if (!next) return;
      setPackage(next);
      setMode('explore');
    },
    [packagesById, setMode, setPackage],
  );

  function chooseDiscoveryMode(nextMode: HomeDiscoveryMode): void {
    setDiscoveryMode(nextMode);
    setSelectedPoiId(undefined);
    setHoveredPoiId(undefined);
    window.setTimeout(() => {
      const map = mapRef.current;
      if (!map) return;
      map.resize();
      const coordinates =
        nextMode === 'towns'
          ? overviewTowns
              .filter((town) =>
                homeTownMatchesRatingRange(town, ratingRangesRef.current.towns),
              )
              .map((town) => town.centre)
          : homePois
              .filter(
                (poi) =>
                  poi.kind === nextMode &&
                  homePoiMatchesDiscoveryScope(poi, discoveryScopeRef.current) &&
                  homePoiMatchesRatingRange(poi, ratingRangesRef.current[nextMode]),
              )
              .map((poi) => poi.coordinates);
      if (!coordinates.length) return;
      const bounds = new maplibregl.LngLatBounds();
      for (const point of coordinates) bounds.extend(point);
      map.fitBounds(bounds, { padding: 72, maxZoom: 8.5, duration: 320 });
    }, 0);
  }

  function chooseDiscoveryScope(nextScope: HomeDiscoveryScope): void {
    setDiscoveryScope(nextScope);
    setSelectedPoiId(undefined);
    setHoveredPoiId(undefined);
  }

  function changeRatingRange(nextRange: HomeRatingRange): void {
    setRatingRanges((current) => ({ ...current, [discoveryMode]: nextRange }));
    setSelectedPoiId(undefined);
    setHoveredPoiId(undefined);
  }

  function selectHomePoi(poi: HomePoiOverview): void {
    setSelectedPoiId(poi.id);
    setHoveredPoiId(undefined);
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({
      center: poi.coordinates,
      zoom: Math.max(map.getZoom(), 9),
      duration: 420,
    });
  }

  useEffect(() => {
    updateMapContentRef.current();
    const map = mapRef.current;
    if (!map) return;
    const resizeTimer = window.setTimeout(() => {
      map.resize();
      updateMapContentRef.current();
    }, 0);
    return () => window.clearTimeout(resizeTimer);
  }, [discoveryMode, discoveryScope, ratingRanges, selectedPoiId]);

  useEffect(() => {
    updateMarkerInteractionRef.current();
  }, [hoveredPoiId]);

  useEffect(() => {
    if (!container.current || mapRef.current) return;
    const mapElement = container.current;
    const townMarkers = townMarkersRef.current;
    const poiMarkers = poiMarkersRef.current;
    const map = new maplibregl.Map({
      container: mapElement,
      style: homeLabelFreeMapStyle,
      center: [-3.6, 56.1],
      zoom: 7,
      attributionControl: false,
    });

    const createTownMarker = (town: HomeTownOverview): HomeTownMarker => {
      const element = document.createElement('button');
      element.type = 'button';
      element.className = `home-town-label ${town.ratingClass}`;
      element.dataset.projectId = town.id;
      element.dataset.rating = String(town.score);
      element.dataset.longitude = String(town.centre[0]);
      element.dataset.latitude = String(town.centre[1]);
      element.style.zIndex = String(1000 - town.collisionPriority);
      element.setAttribute('aria-label', `Open ${town.name}, tourism score ${town.score} out of 100`);
      const stars = document.createElement('span');
      stars.className = 'home-town-stars';
      stars.setAttribute('aria-hidden', 'true');
      stars.textContent = town.stars;
      const name = document.createElement('span');
      name.className = 'home-town-name';
      name.textContent = town.name;
      element.append(name, stars);
      attachMarkerActivation(element, () => openTown(town.id));
      const marker = new maplibregl.Marker({
        anchor: 'bottom',
        element,
        offset: [0, -8],
        subpixelPositioning: true,
      })
        .setLngLat(town.centre)
        .addTo(map);
      return { town, marker, element };
    };

    const createPoiMarker = (poi: HomePoiOverview): HomePoiMarker => {
      const recommendation = homePoiRecommendation(poi);
      const element = document.createElement('button');
      element.type = 'button';
      element.className = `home-poi-marker ${poi.kind} ${recommendation?.className ?? ''}`;
      element.dataset.projectId = poi.projectId;
      element.dataset.poiId = poi.id;
      element.dataset.kind = poi.kind;
      element.dataset.scope = poi.discoveryScope;
      element.dataset.rating = String(poi.starRating);
      const scopeText = poi.discoveryScope === 'standalone' ? `near ${poi.townName}` : poi.townName;
      const starText = `${poi.starRating} ${poi.starRating === 1 ? 'star' : 'stars'}`;
      element.title = `${poi.name}, ${scopeText}, ${starText}`;
      element.setAttribute('aria-label', `${poi.name}, ${scopeText}, ${starText}`);
      const rankElement = appendHomePoiRank(element);
      const nameElement = document.createElement('span');
      nameElement.className = 'home-poi-marker-name';
      nameElement.setAttribute('aria-hidden', 'true');
      nameElement.textContent = poi.name;
      element.append(nameElement);
      attachMarkerActivation(element, () => selectHomePoi(poi));
      const marker = new maplibregl.Marker({
        anchor: 'center',
        element,
        subpixelPositioning: true,
      })
        .setLngLat(poi.coordinates)
        .addTo(map);
      return { poi, marker, element, rankElement, nameElement };
    };

    const clearTownMarkers = () => {
      for (const { marker } of townMarkers.values()) marker.remove();
      townMarkers.clear();
    };

    const clearPoiMarkers = () => {
      for (const { marker } of poiMarkers.values()) marker.remove();
      poiMarkers.clear();
    };

    const syncTownMarkers = (towns: readonly HomeTownOverview[]) => {
      const nextIds = new Set(towns.map((town) => town.id));
      for (const [id, homeMarker] of townMarkers) {
        if (nextIds.has(id)) continue;
        homeMarker.marker.remove();
        townMarkers.delete(id);
      }
      for (const town of towns) {
        if (!townMarkers.has(town.id)) townMarkers.set(town.id, createTownMarker(town));
      }
    };

    const syncPoiMarkers = (pois: readonly HomePoiOverview[]) => {
      const nextIds = new Set(pois.map((poi) => poi.id));
      for (const [id, homeMarker] of poiMarkers) {
        if (nextIds.has(id)) continue;
        homeMarker.marker.remove();
        poiMarkers.delete(id);
      }
      for (const poi of pois) {
        if (!poiMarkers.has(poi.id)) poiMarkers.set(poi.id, createPoiMarker(poi));
      }
    };

    const updateMarkerInteraction = () => {
      const selectedId = selectedPoiIdRef.current;
      const hoveredId = hoveredPoiIdRef.current;
      for (const { poi, element } of poiMarkers.values()) {
        element.classList.toggle('selected', poi.id === selectedId);
        element.classList.toggle('hovered', poi.id === hoveredId);
      }
    };
    updateMarkerInteractionRef.current = updateMarkerInteraction;

    const updateMapContent = () => {
      const mode = discoveryModeRef.current;
      const scope = discoveryScopeRef.current;
      const selectedId = selectedPoiIdRef.current;
      const hoveredId = hoveredPoiIdRef.current;
      const ratingRange = ratingRangesRef.current[mode];
      const mapBounds = map.getBounds();

      if (mode === 'towns') {
        clearPoiMarkers();
        const candidates = overviewTowns
          .filter((town) => homeTownMatchesRatingRange(town, ratingRange))
          .map((town) => {
          const position = map.project(town.centre);
          const fontSize = town.rating === 3 ? 15 : town.rating === 2 ? 13 : 11;
          const horizontalPadding = town.rating === 3 ? 14 : 8;
          const width = Math.min(
            230,
            Math.ceil(
              (town.name.length + town.stars.length * 0.9) * fontSize * 0.62 +
                horizontalPadding +
                3,
            ),
          );
          return {
            ...town,
            x: position.x,
            y: position.y,
            width,
            height: Math.ceil(fontSize * 1.1 + (town.rating === 3 ? 8 : 4)),
          };
        });
        const visibleTowns = selectVisibleHomeLabels(candidates, {
          width: mapElement.clientWidth,
          height: mapElement.clientHeight,
        });
        syncTownMarkers(visibleTowns);
        for (const { element } of townMarkers.values()) {
          element.setAttribute('aria-hidden', 'false');
          element.tabIndex = 0;
        }
        setVisibleHomePois((current) => (current.length ? [] : current));
        return;
      }

      clearTownMarkers();

      const qualified = sortHomeDiscoveryPois(
        homePois.filter(
          (poi) =>
            poi.kind === mode &&
            homePoiMatchesDiscoveryScope(poi, scope) &&
            homePoiMatchesRatingRange(poi, ratingRange) &&
            mapBounds.contains(poi.coordinates),
        ),
      );
      const visiblePois: HomePoiOverview[] = [];
      const occupiedByCell = new globalThis.Map<string, Array<{ x: number; y: number }>>();
      const cellSize = 38;
      for (const poi of qualified) {
        const position = map.project(poi.coordinates);
        if (
          position.x < -cellSize ||
          position.y < -cellSize ||
          position.x > mapElement.clientWidth + cellSize ||
          position.y > mapElement.clientHeight + cellSize
        ) {
          continue;
        }
        const cellX = Math.floor(position.x / cellSize);
        const cellY = Math.floor(position.y / cellSize);
        let overlaps = false;
        for (let xOffset = -1; xOffset <= 1 && !overlaps; xOffset += 1) {
          for (let yOffset = -1; yOffset <= 1; yOffset += 1) {
            const occupied = occupiedByCell.get(`${cellX + xOffset}:${cellY + yOffset}`);
            if (occupied?.some((existing) => boxesOverlap(existing, position, cellSize))) {
              overlaps = true;
              break;
            }
          }
        }
        if (overlaps) continue;
        const key = `${cellX}:${cellY}`;
        const occupied = occupiedByCell.get(key);
        if (occupied) occupied.push(position);
        else occupiedByCell.set(key, [position]);
        visiblePois.push(poi);
      }
      syncPoiMarkers(visiblePois);
      setVisibleHomePois((current) => (samePoiList(current, visiblePois) ? current : visiblePois));
      const rankById = new globalThis.Map(
        visiblePois.map((poi, index) => [poi.id, index + 1] as const),
      );

      for (const { poi, element, rankElement } of poiMarkers.values()) {
        const rank = rankById.get(poi.id);
        rankElement.textContent = rank === undefined ? '' : String(rank);
        if (rank === undefined) delete element.dataset.rank;
        else element.dataset.rank = String(rank);
        element.classList.toggle('selected', poi.id === selectedId);
        element.classList.toggle('hovered', poi.id === hoveredId);
        element.setAttribute('aria-hidden', 'false');
        element.tabIndex = 0;
      }

      const visibleMarkers = visiblePois
        .map((poi) => poiMarkers.get(poi.id))
        .filter((homeMarker): homeMarker is HomePoiMarker => Boolean(homeMarker));
      for (const { nameElement } of visibleMarkers) {
        nameElement.style.visibility = 'hidden';
      }
      const markerRects = visibleMarkers.map(({ poi, element }) => ({
        id: poi.id,
        bounds: element.getBoundingClientRect(),
      }));
      const acceptedLabelRects: DOMRect[] = [];
      const mapRect = mapElement.getBoundingClientRect();
      const permanentLabelLimit = homePoiPermanentLabelLimit(map.getZoom());
      for (const { poi, nameElement } of visibleMarkers) {
        const labelRect = nameElement.getBoundingClientRect();
        const forced = poi.id === selectedId || poi.id === hoveredId;
        const insideMap =
          labelRect.left >= mapRect.left + 6 &&
          labelRect.right <= mapRect.right - 6 &&
          labelRect.bottom <= mapRect.bottom - 6;
        const overlapsLabel = acceptedLabelRects.some((bounds) =>
          rectanglesOverlap(bounds, labelRect),
        );
        const overlapsMarker = markerRects.some(
          ({ id, bounds }) => id !== poi.id && rectanglesOverlap(bounds, labelRect, 2),
        );
        const withinPermanentLimit = acceptedLabelRects.length < permanentLabelLimit;
        const visible =
          forced ||
          (withinPermanentLimit && insideMap && !overlapsLabel && !overlapsMarker);
        nameElement.style.visibility = visible ? 'visible' : 'hidden';
        if (visible && !forced) acceptedLabelRects.push(labelRect);
      }
    };
    updateMapContentRef.current = updateMapContent;

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-right');
    if (import.meta.env.DEV) mapElement.__homeMap = map;
    map.on('load', () => {
      if (overviewTowns.length) {
        const bounds = new maplibregl.LngLatBounds();
        for (const town of overviewTowns) bounds.extend(town.centre);
        map.fitBounds(bounds, { padding: 72, maxZoom: 8.5, duration: 0 });
      }
      updateMapContent();
      setMapReady(true);
    });
    map.on('moveend', updateMapContent);
    map.on('resize', updateMapContent);
    mapRef.current = map;
    return () => {
      clearTownMarkers();
      clearPoiMarkers();
      updateMapContentRef.current = () => {};
      updateMarkerInteractionRef.current = () => {};
      delete mapElement.__homeMap;
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, [homePois, openTown, overviewTowns]);

  if (!overviewTowns.length && !homePois.length) {
    return (
      <main className="home home-empty">
        <p>No visitor destinations are published yet.</p>
      </main>
    );
  }

  const discoveryActive = discoveryMode !== 'towns';
  const mapTitle =
    discoveryMode === 'towns'
      ? ['Visitor towns', 'Pick a town to explore']
      : discoveryMode === 'attraction'
        ? ['Recommended attractions', 'Curated places worth planning around']
        : ['Top food stops', 'The strongest curated cafes and restaurants'];

  return (
    <main
      className={
        showStandaloneAttractionGuide
          ? 'home home-with-discovery home-with-standalone-guide'
          : discoveryActive
            ? 'home home-with-discovery'
            : 'home'
      }
    >
      {showStandaloneAttractionGuide && selectedPoi && (
        <StandaloneAttractionGuide poi={selectedPoi} />
      )}
      <div className="home-map-wrap">
        <div
          ref={container}
          className="map home-map"
          aria-label="Visitor discovery map"
          data-ready={mapReady ? 'true' : 'false'}
        />
        <div className="home-map-guide">
          <div className="home-map-title" aria-live="polite">
            <strong>{mapTitle[0]}</strong>
            <span>{mapTitle[1]}</span>
          </div>
          <div className="home-discovery-switches">
            <div className="home-discovery-modes" role="tablist" aria-label="Home discovery modes">
              <HomeModeButton
                mode="towns"
                label="Towns"
                activeMode={discoveryMode}
                onSelect={chooseDiscoveryMode}
              />
              <HomeModeButton
                mode="attraction"
                label="See"
                activeMode={discoveryMode}
                onSelect={chooseDiscoveryMode}
              />
              <HomeModeButton
                mode="eat"
                label="Eat"
                activeMode={discoveryMode}
                onSelect={chooseDiscoveryMode}
              />
            </div>
            {discoveryMode !== 'towns' && (
              <HomeRatingRangeControl
                mode={discoveryMode}
                range={ratingRanges[discoveryMode]}
                onChange={changeRatingRange}
              />
            )}
            {discoveryActive && (
              <HomeScopeControl scope={discoveryScope} onSelect={chooseDiscoveryScope} />
            )}
          </div>
        </div>
        <div className="attribution">
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
            {homeLabelFreeAttribution}
          </a>
        </div>
      </div>
      {discoveryMode !== 'towns' && (
        <HomeDiscoveryPanel
          mode={discoveryMode}
          pois={visibleHomePois}
          selectedPoi={selectedPoi}
          selectedFeature={selectedFeature}
          onSelect={selectHomePoi}
          onHover={setHoveredPoiId}
          onCloseDetails={() => setSelectedPoiId(undefined)}
          onOpenTown={openTown}
        />
      )}
    </main>
  );
}

function HomeRatingRangeControl({
  mode,
  range,
  onChange,
}: {
  mode: HomeDiscoveryMode;
  range: HomeRatingRange;
  onChange(range: HomeRatingRange): void;
}) {
  const config = homeRatingFilterConfigs[mode];
  const denominator = config.max - config.min;
  const start = ((range.min - config.min) / denominator) * 100;
  const end = ((range.max - config.min) / denominator) * 100;
  const valueText = `${range.min} to ${range.max} stars`;
  const rangeStyle = {
    '--range-start': `${start}%`,
    '--range-end': `${end}%`,
  } as CSSProperties;

  return (
    <div
      className={`home-rating-range ${mode}`}
      role="group"
      aria-label={`${config.label} range`}
      style={rangeStyle}
    >
      <div className="home-rating-range-heading">
        <span>{config.label}</span>
        <output aria-live="polite">{valueText}</output>
      </div>
      <div className="home-rating-range-track">
        <input
          type="range"
          min={config.min}
          max={config.max}
          step={config.step}
          value={range.min}
          aria-label={`Minimum ${config.label.toLowerCase()}`}
          onChange={(event) =>
            onChange({ min: Math.min(Number(event.target.value), range.max), max: range.max })
          }
        />
        <input
          type="range"
          min={config.min}
          max={config.max}
          step={config.step}
          value={range.max}
          aria-label={`Maximum ${config.label.toLowerCase()}`}
          onChange={(event) =>
            onChange({ min: range.min, max: Math.max(Number(event.target.value), range.min) })
          }
        />
      </div>
    </div>
  );
}

function HomeScopeControl({
  scope,
  onSelect,
}: {
  scope: HomeDiscoveryScope;
  onSelect(scope: HomeDiscoveryScope): void;
}) {
  return (
    <div className="home-discovery-scope" role="group" aria-label="Places to show">
      <span>Show</span>
      <button
        type="button"
        className={scope === 'all' ? 'active' : undefined}
        aria-pressed={scope === 'all'}
        onClick={() => onSelect('all')}
      >
        All places
      </button>
      <button
        type="button"
        className={scope === 'standalone' ? 'active' : undefined}
        aria-pressed={scope === 'standalone'}
        onClick={() => onSelect('standalone')}
      >
        Outside towns
      </button>
    </div>
  );
}

function HomeModeButton({
  mode,
  label,
  activeMode,
  onSelect,
}: {
  mode: HomeDiscoveryMode;
  label: string;
  activeMode: HomeDiscoveryMode;
  onSelect(mode: HomeDiscoveryMode): void;
}) {
  const isActive = mode === activeMode;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      className={isActive ? `active ${mode}` : mode}
      onClick={() => onSelect(mode)}
    >
      <span className="home-mode-icon" aria-hidden="true">
        {mode === 'towns' ? (
          <svg viewBox="0 0 24 24">
            <path d="M4 19V9l5-4 5 4v10M14 12l3-2 3 2v7M7 19v-5h4v5" />
          </svg>
        ) : mode === 'eat' ? (
          <svg viewBox="0 0 24 24">
            <path d="M5 8h10v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4zM15 9h2.2a2.3 2.3 0 0 1 0 4.6H15M7 3v2M11 3v2M5 21h12" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="filled">
            <path d="m12 3.4 2.5 5.1 5.6.8-4 3.9.9 5.5-5-2.7-5 2.7.9-5.5-4-3.9 5.6-.8z" />
          </svg>
        )}
      </span>
      <strong>{label}</strong>
    </button>
  );
}
