import { useEffect, useState, type CSSProperties } from 'react';
import { useExplorerStore } from '../app/store';
import { publishedProjectPackages } from '../data/publishedProjects';
import type { TownProject } from '../domain/models';
import { sortPublishedPackages } from '../domain/projects';
import {
  touristAppealIndicator,
  touristAppealLabel,
  touristAppealSummary,
  townScoreBand,
} from '../domain/tourism';
import { visitorNeedPlaces } from '../domain/visitorExperience';
import { townCharacterTag } from '../domain/townCharacter';

const hesDesignationsLayerId = 'hes-listed-buildings-by-category';
const unspecifiedCounty = 'Unspecified county';

function townSelectorLabel(project: TownProject): string {
  const label = touristAppealLabel(project);
  const score = project.touristAppeal?.score;
  return score === undefined ? label : `${label} · ${score}%`;
}

function TownAccentIllustration({
  locality,
  visualIdentity,
}: {
  locality: string;
  visualIdentity?: TownProject['visualIdentity'];
}) {
  if (visualIdentity?.badgeImage) {
    return (
      <figure className="town-badge-card">
        <img src={visualIdentity.badgeImage} alt={visualIdentity.badgeAlt} />
      </figure>
    );
  }

  const label = `${locality} visitor illustration`;
  return (
    <div className="town-accent-illustration generic" role="img" aria-label={label}>
      <span className="town-accent-sky" />
      <span className="town-accent-land" />
      <span className="town-accent-road" />
      <span className="town-accent-pin" />
    </div>
  );
}

function TownGuideHero({
  locality,
  visualIdentity,
  score,
  indicator,
  ratingLabel,
  dogOwnerScore,
  dogAccessRating,
  characterTag,
}: {
  locality: string;
  visualIdentity?: TownProject['visualIdentity'];
  score?: number;
  indicator?: string;
  ratingLabel?: string;
  dogOwnerScore?: number;
  dogAccessRating?: NonNullable<TownProject['touristAppeal']>['dogAccessRating'];
  characterTag: string;
}) {
  const image = visualIdentity?.heroImage ?? visualIdentity?.badgeImage;
  const ratings = (
    <TownGuideRatings
      score={score}
      indicator={indicator}
      ratingLabel={ratingLabel}
      dogOwnerScore={dogOwnerScore}
      dogAccessRating={dogAccessRating}
    />
  );
  if (!image) {
    return (
      <figure className="town-guide-hero town-guide-hero--fallback">
        <div className="town-guide-hero-media">
          <TownAccentIllustration locality={locality} visualIdentity={visualIdentity} />
        </div>
        <figcaption className="town-guide-hero-copy">
          <p className="eyebrow">Visitor guide</p>
          <h1>{locality}</h1>
          <p className="town-guide-character">{characterTag}</p>
          {ratings}
        </figcaption>
      </figure>
    );
  }
  return (
    <figure className="town-guide-hero">
      <div className="town-guide-hero-media">
        <img
          src={image}
          alt={visualIdentity?.heroAlt ?? visualIdentity?.badgeAlt ?? ''}
          style={
            visualIdentity?.heroObjectPosition
              ? ({ objectPosition: visualIdentity.heroObjectPosition } as CSSProperties)
              : undefined
          }
        />
      </div>
      <figcaption className="town-guide-hero-copy">
        <p className="eyebrow">Visitor guide</p>
        <h1>{locality}</h1>
        <p className="town-guide-character">{characterTag}</p>
        {ratings}
      </figcaption>
    </figure>
  );
}

function TownGuideRatings({
  score,
  indicator,
  ratingLabel,
  dogOwnerScore,
  dogAccessRating,
}: {
  score?: number;
  indicator?: string;
  ratingLabel?: string;
  dogOwnerScore?: number;
  dogAccessRating?: NonNullable<TownProject['touristAppeal']>['dogAccessRating'];
}) {
  if (score === undefined && dogOwnerScore === undefined) return null;
  const dogBand = dogOwnerScore === undefined ? undefined : townScoreBand(dogOwnerScore);
  return (
    <div className="town-guide-ratings" aria-label="Town ratings">
      {score !== undefined && (
        <div className="town-guide-rating-row town-guide-rating-row--town">
          <span className="town-guide-rating-audience">Town</span>
          <strong>{score}%</strong>
          {indicator && <b aria-hidden="true">{indicator}</b>}
          {ratingLabel && <span className="town-guide-rating-band">{ratingLabel}</span>}
        </div>
      )}
      {dogOwnerScore !== undefined && dogBand && (
        <div className="town-guide-rating-row town-guide-rating-row--dog">
          <span className="town-guide-rating-audience">With a dog</span>
          <strong>{dogOwnerScore}%</strong>
          {dogBand.indicator && <b aria-hidden="true">{dogBand.indicator}</b>}
          <span className="town-guide-rating-band">{dogBand.label}</span>
          {dogAccessRating !== undefined && (
            <span
              className="town-guide-dog-paws"
              aria-label={`Dog access: ${dogAccessRating} out of 3 paws`}
              title={`Dog access: ${dogAccessRating} out of 3 paws`}
            >
              {Array.from({ length: 3 }, (_, paw) => (
                <i
                  className={paw < dogAccessRating ? 'filled' : undefined}
                  key={paw}
                  aria-hidden="true"
                >
                  🐾
                </i>
              ))}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function TownMotifStrip({ motifs }: { motifs?: string[] }) {
  if (!motifs?.length) return null;
  return (
    <div className="town-motif-strip" aria-label="Town character">
      {motifs.slice(0, 4).map((motif) => (
        <span className={`town-motif town-motif--${motifKind(motif)}`} key={motif}>
          <span className="town-motif-icon" aria-hidden="true" />
          <span>{motif}</span>
        </span>
      ))}
    </div>
  );
}

type TownMotifKind =
  | 'art'
  | 'boat'
  | 'bridge'
  | 'food'
  | 'glens'
  | 'heritage'
  | 'hill'
  | 'industry'
  | 'music'
  | 'park'
  | 'place'
  | 'route'
  | 'sport'
  | 'story'
  | 'textile'
  | 'water';

function motifKind(motif: string): TownMotifKind {
  const normalised = motif.toLocaleLowerCase();
  if (normalised.includes('story') || normalised.includes('literary')) return 'story';
  if (normalised.includes('music') || normalised.includes('scott')) return 'music';
  if (normalised.includes('textile') || normalised.includes('weav')) return 'textile';
  if (normalised.includes('bridge')) return 'bridge';
  if (normalised.includes('boat') || normalised.includes('ferry') || normalised.includes('harbour'))
    return 'boat';
  if (
    normalised.includes('waterfall') ||
    normalised.includes('river') ||
    normalised.includes('pool') ||
    normalised.includes('waterfront')
  )
    return 'water';
  if (normalised.includes('park') || normalised.includes('garden')) return 'park';
  if (normalised.includes('football') || normalised.includes('sport')) return 'sport';
  if (
    normalised.includes('brewing') ||
    normalised.includes('glass') ||
    normalised.includes('industrial')
  )
    return 'industry';
  if (normalised.includes('art') || normalised.includes('statue')) return 'art';
  if (normalised.includes('cafe') || normalised.includes('food')) return 'food';
  if (
    normalised.includes('cycle') ||
    normalised.includes('route') ||
    normalised.includes('walk') ||
    normalised.includes('avenue')
  )
    return 'route';
  if (
    normalised.includes('keep') ||
    normalised.includes('village') ||
    normalised.includes('zion') ||
    normalised.includes('faith')
  )
    return 'heritage';
  if (
    normalised.includes('hill') ||
    normalised.includes('view') ||
    normalised.includes('crag') ||
    normalised.includes('ochil') ||
    normalised.includes('scenery') ||
    normalised.includes('coastal')
  )
    return 'hill';
  if (normalised.includes('glen')) return 'glens';
  return 'place';
}

export function Sidebar() {
  const adminToolsAvailable = import.meta.env.DEV;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [guideMenuOpen, setGuideMenuOpen] = useState(false);
  const [townSearch, setTownSearch] = useState('');
  const pkg = useExplorerStore((state) => state.package);
  const possible = useExplorerStore((state) => state.possible);
  const setPossible = useExplorerStore((state) => state.setPossible);
  const settlementAge = useExplorerStore((state) => state.settlementAge);
  const setSettlementAge = useExplorerStore((state) => state.setSettlementAge);
  const showAreaPolygons = useExplorerStore((state) => state.showAreaPolygons);
  const setShowAreaPolygons = useExplorerStore((state) => state.setShowAreaPolygons);
  const excludeUndated = useExplorerStore((state) => state.excludeUndated);
  const setExcludeUndated = useExplorerStore((state) => state.setExcludeUndated);
  const demolished = useExplorerStore((state) => state.demolished);
  const setDemolished = useExplorerStore((state) => state.setDemolished);
  const showHesDesignations = useExplorerStore((state) => state.showHesDesignations);
  const setShowHesDesignations = useExplorerStore((state) => state.setShowHesDesignations);
  const showPublicArt = useExplorerStore((state) => state.showPublicArt);
  const setShowPublicArt = useExplorerStore((state) => state.setShowPublicArt);
  const showPlaquesAndMemorials = useExplorerStore((state) => state.showPlaquesAndMemorials);
  const setShowPlaquesAndMemorials = useExplorerStore((state) => state.setShowPlaquesAndMemorials);
  const showCurrentContext = useExplorerStore((state) => state.showCurrentContext);
  const setShowCurrentContext = useExplorerStore((state) => state.setShowCurrentContext);
  const showOsmFood = useExplorerStore((state) => state.showOsmFood);
  const setShowOsmFood = useExplorerStore((state) => state.setShowOsmFood);
  const showOsmPicnic = useExplorerStore((state) => state.showOsmPicnic);
  const setShowOsmPicnic = useExplorerStore((state) => state.setShowOsmPicnic);
  const showOsmArt = useExplorerStore((state) => state.showOsmArt);
  const setShowOsmArt = useExplorerStore((state) => state.setShowOsmArt);
  const showOsmMemorials = useExplorerStore((state) => state.showOsmMemorials);
  const setShowOsmMemorials = useExplorerStore((state) => state.setShowOsmMemorials);
  const showOsmHistoricPlaces = useExplorerStore((state) => state.showOsmHistoricPlaces);
  const setShowOsmHistoricPlaces = useExplorerStore((state) => state.setShowOsmHistoricPlaces);
  const showOsmLeisure = useExplorerStore((state) => state.showOsmLeisure);
  const setShowOsmLeisure = useExplorerStore((state) => state.setShowOsmLeisure);
  const showOsmVisitor = useExplorerStore((state) => state.showOsmVisitor);
  const setShowOsmVisitor = useExplorerStore((state) => state.setShowOsmVisitor);
  const showOsmAmenities = useExplorerStore((state) => state.showOsmAmenities);
  const setShowOsmAmenities = useExplorerStore((state) => state.setShowOsmAmenities);
  const showOsmParking = useExplorerStore((state) => state.showOsmParking);
  const setShowOsmParking = useExplorerStore((state) => state.setShowOsmParking);
  const showOsmNature = useExplorerStore((state) => state.showOsmNature);
  const setShowOsmNature = useExplorerStore((state) => state.setShowOsmNature);
  const showHistoricLegend = useExplorerStore((state) => state.showHistoricLegend);
  const setShowHistoricLegend = useExplorerStore((state) => state.setShowHistoricLegend);
  const showOsmLegend = useExplorerStore((state) => state.showOsmLegend);
  const setShowOsmLegend = useExplorerStore((state) => state.setShowOsmLegend);
  const archaeologyOnly = useExplorerStore((state) => state.archaeologyOnly);
  const setArchaeologyOnly = useExplorerStore((state) => state.setArchaeologyOnly);
  const communityLayersOnly = useExplorerStore((state) => state.communityLayersOnly);
  const setCommunityLayersOnly = useExplorerStore((state) => state.setCommunityLayersOnly);
  const setPackage = useExplorerStore((state) => state.setPackage);
  const setMode = useExplorerStore((state) => state.setMode);
  const adminMode = useExplorerStore((state) => state.adminMode);
  const setAdminMode = useExplorerStore((state) => state.setAdminMode);
  const hasHesDesignations = pkg.historicMaps.some((map) => map.id === hesDesignationsLayerId);
  const publishedPackages = sortPublishedPackages(publishedProjectPackages);
  const countries = [
    ...new Set(publishedPackages.map((projectPackage) => projectPackage.project.country)),
  ];
  const counties = [
    ...new Set(
      publishedPackages
        .filter((projectPackage) => projectPackage.project.country === pkg.project.country)
        .map((projectPackage) => projectPackage.project.region ?? unspecifiedCounty),
    ),
  ];
  const townsInCounty = publishedPackages.filter(
    (projectPackage) =>
      projectPackage.project.country === pkg.project.country &&
      (projectPackage.project.region ?? unspecifiedCounty) ===
        (pkg.project.region ?? unspecifiedCounty),
  );
  const townSearchQuery = townSearch.trim().toLocaleLowerCase();
  const matchingTowns = publishedPackages.filter((projectPackage) =>
    projectPackage.project.locality.toLocaleLowerCase().includes(townSearchQuery),
  );
  const townOptions = townSearchQuery ? matchingTowns : townsInCounty;
  const activeTouristAppeal = pkg.project.touristAppeal;
  const activeVisualIdentity = pkg.project.visualIdentity;
  const townIdentityStyle = activeVisualIdentity
    ? ({
        '--town-identity-primary': activeVisualIdentity.primaryColour,
        '--town-identity-accent': activeVisualIdentity.accentColour,
        '--town-identity-bg': activeVisualIdentity.backgroundColour,
      } as CSSProperties)
    : undefined;
  const activeGuide = pkg.project.townGuide;
  const guideIntro =
    activeGuide?.intro ??
    touristAppealSummary(pkg.project) ??
    'No visitor guide has been written yet.';
  const perfectFor = activeGuide?.perfectFor ?? [];
  const firstStop = visitorNeedPlaces(pkg, 'see', 1)[0];
  const firstStopFeature = firstStop
    ? pkg.features.find((feature) => feature.id === firstStop.id)
    : undefined;
  const selectFeature = useExplorerStore((state) => state.selectFeature);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSettingsOpen(false);
        setGuideMenuOpen(false);
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, []);

  function selectPackage(id: string) {
    const next = publishedPackages.find((candidate) => candidate.project.id === id);
    if (next) setPackage(next);
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-heading">
        <div className="sidebar-guide-label">
          <span aria-hidden="true" />
          <strong>Destination guide</strong>
        </div>
        <div className="sidebar-heading-actions">
          <button
            className="home-return-button"
            type="button"
            aria-label="Back to Home"
            onClick={() => setMode('home')}
          >
            Home
          </button>
          <div className="guide-actions-menu">
            <button
              className="guide-menu-button"
              type="button"
              aria-label="Guide options"
              aria-expanded={guideMenuOpen}
              title="Guide options"
              onClick={() => setGuideMenuOpen((open) => !open)}
            >
              <span aria-hidden="true" />
            </button>
            {guideMenuOpen && (
              <div className="guide-menu-popover" role="menu" aria-label="Guide options">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setSettingsOpen(true);
                    setGuideMenuOpen(false);
                  }}
                >
                  Explorer settings
                </button>
                {adminToolsAvailable && (
                  <button
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={adminMode}
                    className={adminMode ? 'active' : undefined}
                    onClick={() => {
                      setAdminMode(!adminMode);
                      setGuideMenuOpen(false);
                    }}
                  >
                    {adminMode ? 'Admin mode on' : 'Admin mode'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <section
        className="town-visit-hero"
        aria-label="Town visitor snapshot"
        style={townIdentityStyle}
      >
        <TownGuideHero
          locality={pkg.project.locality}
          visualIdentity={pkg.project.visualIdentity}
          score={activeTouristAppeal?.score}
          indicator={touristAppealIndicator(pkg.project)}
          ratingLabel={activeTouristAppeal?.label}
          dogOwnerScore={activeTouristAppeal?.dogOwnerScore}
          dogAccessRating={activeTouristAppeal?.dogAccessRating}
          characterTag={townCharacterTag(pkg)}
        />
        <TownMotifStrip motifs={activeVisualIdentity?.motifs} />
        <div className="town-guide-body">
          {activeGuide?.headline && <h2>{activeGuide.headline}</h2>}
          <p className="town-guide-intro">{guideIntro}</p>
          {activeTouristAppeal?.dogAccessSummary && (
            <p className="town-dog-summary">
              <strong>With a dog:</strong> {activeTouristAppeal.dogAccessSummary}
            </p>
          )}
          {(activeGuide?.bestFor.length || activeGuide?.suggestedTime) && (
            <div className="town-guide-facts" aria-label="Visitor guide quick facts">
              {activeGuide?.suggestedTime && (
                <span>
                  <strong>Time</strong>
                  {activeGuide.suggestedTime}
                </span>
              )}
              {activeGuide?.bestFor.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          )}
        </div>
        <section className="town-first-stop">
          <p className="eyebrow">Start here</p>
          {firstStop ? (
            <>
              <h2>{firstStop.name}</h2>
              {firstStop.reason && <p>{firstStop.reason}</p>}
              {firstStopFeature && (
                <button
                  className="town-first-stop-action"
                  type="button"
                  onClick={() => selectFeature(firstStopFeature)}
                >
                  Open details
                </button>
              )}
            </>
          ) : (
            <p>No first-stop recommendation has been curated yet.</p>
          )}
        </section>
        {activeGuide?.visitorMood && (
          <section className="town-guide-why" aria-label="Why this town">
            <p className="eyebrow">Why this town</p>
            <p className="town-guide-mood">{activeGuide.visitorMood}</p>
          </section>
        )}
        {perfectFor.length > 0 && (
          <section className="town-guide-perfect" aria-label="Perfect for">
            <p className="eyebrow">Perfect for</p>
            <div>
              {perfectFor.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </section>
        )}
        {activeGuide?.suggestedFirstVisit && (
          <section className="town-guide-suggested" aria-label="Suggested first visit">
            <p className="eyebrow">Suggested first visit</p>
            <h2>{activeGuide.suggestedFirstVisit.title}</h2>
            <p>{activeGuide.suggestedFirstVisit.summary}</p>
          </section>
        )}
      </section>

      <details className="town-picker" aria-label="Choose a town">
        <summary>Change town</summary>
        <div className="town-picker-grid">
          <label>
            Country
            <select
              value={pkg.project.country}
              aria-label="Country"
              onChange={(event) => {
                const next = publishedPackages.find(
                  (candidate) => candidate.project.country === event.target.value,
                );
                if (next) {
                  setTownSearch('');
                  setPackage(next);
                }
              }}
            >
              {countries.map((country) => (
                <option value={country} key={country}>
                  {country}
                </option>
              ))}
            </select>
          </label>
          <label>
            County
            <select
              value={pkg.project.region ?? unspecifiedCounty}
              aria-label="County"
              onChange={(event) => {
                const next = publishedPackages.find(
                  (candidate) =>
                    candidate.project.country === pkg.project.country &&
                    (candidate.project.region ?? unspecifiedCounty) === event.target.value,
                );
                if (next) {
                  setTownSearch('');
                  setPackage(next);
                }
              }}
            >
              {counties.map((county) => (
                <option value={county} key={county}>
                  {county}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Find a town
          <input
            type="search"
            value={townSearch}
            aria-label="Search towns"
            onChange={(event) => setTownSearch(event.target.value)}
            placeholder="Start typing a town name..."
          />
        </label>
        <label>
          Explore town
          <select
            value={
              townOptions.some((projectPackage) => projectPackage.project.id === pkg.project.id)
                ? pkg.project.id
                : ''
            }
            aria-label="Town"
            onChange={(event) => selectPackage(event.target.value)}
          >
            {!townOptions.some(
              (projectPackage) => projectPackage.project.id === pkg.project.id,
            ) && (
              <option value="" disabled>
                {matchingTowns.length ? 'Choose a town' : 'No matching towns'}
              </option>
            )}
            {townOptions.map((projectPackage) => (
              <option value={projectPackage.project.id} key={projectPackage.project.id}>
                {townSelectorLabel(projectPackage.project)}
              </option>
            ))}
          </select>
        </label>
      </details>
      {settingsOpen && (
        <>
          <button
            type="button"
            className="settings-backdrop"
            aria-label="Close explorer settings"
            onClick={() => setSettingsOpen(false)}
          />
          <section
            className="settings-popover"
            aria-label="Explorer settings"
            role="dialog"
            aria-modal="true"
          >
            <div className="settings-popover-heading">
              <h2>Explorer settings</h2>
              <button
                type="button"
                className="icon"
                aria-label="Close settings"
                onClick={() => setSettingsOpen(false)}
              >
                ×
              </button>
            </div>
            {adminToolsAvailable && (
              <fieldset>
                <legend>Admin tools</legend>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={adminMode}
                    onChange={(event) => setAdminMode(event.target.checked)}
                  />
                  Enable planner curation
                </label>
                <p className="settings-help">
                  Admin mode turns on all OSM visitor icon categories and the map legend. Untick
                  individual categories below to hide the ones you do not want to curate.
                </p>
              </fieldset>
            )}
            <fieldset>
              <legend>Timeline visibility</legend>
              <label className="check">
                <input
                  type="checkbox"
                  checked={possible}
                  onChange={(event) => setPossible(event.target.checked)}
                />
                Include possibly present
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={excludeUndated}
                  onChange={(event) => setExcludeUndated(event.target.checked)}
                />
                Show only entries with established dates
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={demolished}
                  onChange={(event) => setDemolished(event.target.checked)}
                />
                Show demolished features
              </label>
            </fieldset>
            <fieldset>
              <legend>Evidence layers</legend>
              <label className="check">
                <input
                  type="checkbox"
                  checked={settlementAge}
                  onChange={(event) => setSettlementAge(event.target.checked)}
                />
                Show settlement-age evidence
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={showAreaPolygons}
                  onChange={(event) => setShowAreaPolygons(event.target.checked)}
                />
                Show heritage area polygons
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={showCurrentContext}
                  onChange={(event) => setShowCurrentContext(event.target.checked)}
                />
                Show current parks &amp; open spaces
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={archaeologyOnly}
                  onChange={(event) => setArchaeologyOnly(event.target.checked)}
                />
                Archaeology evidence only
              </label>
            </fieldset>
            <fieldset>
              <legend>Map key</legend>
              <label className="check">
                <input
                  type="checkbox"
                  checked={showHistoricLegend}
                  onChange={(event) => setShowHistoricLegend(event.target.checked)}
                />
                Show historic-date colours
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={showOsmLegend}
                  onChange={(event) => setShowOsmLegend(event.target.checked)}
                />
                Show OSM category icons
              </label>
            </fieldset>
            <fieldset>
              <legend>Community layers</legend>
              <label className="check">
                <input
                  type="checkbox"
                  checked={communityLayersOnly}
                  onChange={(event) => setCommunityLayersOnly(event.target.checked)}
                />
                Only community layers
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={showPublicArt}
                  onChange={(event) => setShowPublicArt(event.target.checked)}
                />
                Show public art
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={showPlaquesAndMemorials}
                  onChange={(event) => setShowPlaquesAndMemorials(event.target.checked)}
                />
                Show plaques &amp; memorials
              </label>
            </fieldset>
            <fieldset>
              <legend>Current OSM places</legend>
              <p className="settings-help">
                Optional present-day OSM places with their own map icons. They are not historic
                evidence.
              </p>
              <label className="check">
                <input
                  type="checkbox"
                  checked={showOsmFood}
                  onChange={(event) => setShowOsmFood(event.target.checked)}
                />
                Food &amp; drink
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={showOsmPicnic}
                  onChange={(event) => setShowOsmPicnic(event.target.checked)}
                />
                Picnic &amp; rest
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={showOsmArt}
                  onChange={(event) => setShowOsmArt(event.target.checked)}
                />
                Art &amp; culture
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={showOsmMemorials}
                  onChange={(event) => setShowOsmMemorials(event.target.checked)}
                />
                Memorials &amp; plaques
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={showOsmHistoricPlaces}
                  onChange={(event) => setShowOsmHistoricPlaces(event.target.checked)}
                />
                Historic places
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={showOsmLeisure}
                  onChange={(event) => setShowOsmLeisure(event.target.checked)}
                />
                Leisure
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={showOsmVisitor}
                  onChange={(event) => setShowOsmVisitor(event.target.checked)}
                />
                Visitor information
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={showOsmAmenities}
                  onChange={(event) => setShowOsmAmenities(event.target.checked)}
                />
                Amenities
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={showOsmParking}
                  onChange={(event) => setShowOsmParking(event.target.checked)}
                />
                Parking
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={showOsmNature}
                  onChange={(event) => setShowOsmNature(event.target.checked)}
                />
                Natural sights
              </label>
            </fieldset>
            {hasHesDesignations && (
              <fieldset>
                <legend>Live cross-check</legend>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={showHesDesignations}
                    onChange={(event) => setShowHesDesignations(event.target.checked)}
                  />
                  Show current HES designations (external symbols)
                </label>
              </fieldset>
            )}
          </section>
        </>
      )}
    </aside>
  );
}
