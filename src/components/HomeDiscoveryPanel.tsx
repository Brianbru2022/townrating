import { useEffect, useMemo, useState } from 'react';
import { AttractionGuide } from './AttractionGuide';
import { AttractionScorePair } from './AttractionScorePair';
import { DogAccessSection, DogPawBadge } from './DogAccess';
import type { HeritageFeature } from '../domain/models';
import {
  visitorFacts,
  visitorPlaceType,
} from '../domain/visitorExperience';
import { formatVisitScore } from '../domain/visiting';
import {
  homePoiRecommendation,
  sortHomeDiscoveryPois,
  type HomeDiscoveryMode,
  type HomePoiOverview,
} from '../map/homeOverview';

interface HomeDiscoveryPanelProps {
  mode: Exclude<HomeDiscoveryMode, 'towns'>;
  pois: HomePoiOverview[];
  selectedPoi?: HomePoiOverview;
  selectedFeature?: HeritageFeature;
  onSelect(poi: HomePoiOverview): void;
  onHover(poiId?: string): void;
  onCloseDetails(): void;
  onOpenTown(projectId: string): void;
}

interface DiscoveryBadge {
  label: string;
  className: string;
}

function badgeClass(label: string): string {
  if (/^£+$/u.test(label)) return 'planner-badge badge-price-band';
  const normalised = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  if (normalised === 'dog-friendly') return 'planner-badge badge-dog-friendly';
  if (normalised === 'free') return 'planner-badge badge-free';
  if (normalised === 'pay') return 'planner-badge badge-pay';
  if (normalised === 'nts') return 'planner-badge badge-nts';
  if (normalised === 'hes') return 'planner-badge badge-hes';
  return `planner-badge badge-organisation badge-${normalised}`;
}

function visitorBadges(poi: HomePoiOverview): DiscoveryBadge[] {
  const price =
    poi.kind === 'eat'
      ? undefined
      : poi.freeAdmission
        ? 'Free'
        : poi.admission
          ? 'Pay'
          : undefined;
  const organisationPills = (poi.organisationPills ?? []).filter(
    (label) => !(poi.freeAdmission && /^free(?: entry)?$/i.test(label)),
  );
  const values = [
    price,
    poi.priceBand,
    ...organisationPills,
  ];
  return [...new Set(values.filter((value): value is string => Boolean(value)))].map((label) => ({
    label,
    className: badgeClass(label),
  }));
}

function factLines(text: string): string[] {
  return text
    .replace(/\.\s+(?=[A-Z])/g, '.|')
    .split(/[;|]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function DiscoveryIcon({ kind }: { kind: HomePoiOverview['kind'] }) {
  if (kind === 'eat') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 8h10v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z" />
        <path d="M15 9h2.2a2.3 2.3 0 0 1 0 4.6H15" />
        <path d="M7 3v2M11 3v2M5 21h12" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="filled">
      <path d="m12 3.4 2.5 5.1 5.6.8-4 3.9.9 5.5-5-2.7-5 2.7.9-5.5-4-3.9 5.6-.8z" />
    </svg>
  );
}

export function HomeDiscoveryPanel({
  mode,
  pois,
  selectedPoi,
  selectedFeature,
  onSelect,
  onHover,
  onCloseDetails,
  onOpenTown,
}: HomeDiscoveryPanelProps) {
  const [showSources, setShowSources] = useState(false);
  const sortedPois = useMemo(() => sortHomeDiscoveryPois(pois), [pois]);

  useEffect(() => {
    setShowSources(false);
  }, [selectedPoi?.id]);

  if (selectedPoi && selectedFeature) {
    const recommendation = homePoiRecommendation(selectedPoi);
    const badges = visitorBadges(selectedPoi);
    const locationLabel =
      selectedPoi.discoveryScope === 'standalone'
        ? `Standalone stop near ${selectedPoi.townName}`
        : selectedPoi.townName;
    const hiddenFactLabels = new Set([
      'Opening',
      'Opening times',
      'Time to spend',
      'Price',
      'Prices',
      'Price guide',
      ...(selectedPoi.kind === 'attraction' && selectedPoi.discoveryScope === 'standalone'
        ? ['Good for', 'Historic date', 'Toilets']
        : []),
    ]);
    const facts = visitorFacts(selectedFeature).filter(
      (fact) => !hiddenFactLabels.has(fact.label),
    );
    const hasVisitPlan = Boolean(
      selectedPoi.timeToSpend ||
        selectedPoi.openingTimes ||
        selectedPoi.admission ||
        selectedPoi.priceBand ||
        badges.length,
    );

    return (
      <aside className="home-discovery-panel home-discovery-details" aria-label="Home place details">
        <div className="home-discovery-panel-scroll">
          <button type="button" className="back-to-planner-button" onClick={onCloseDetails}>
            Back to results
          </button>
          <div className={`place-detail-hero home-place-hero ${selectedPoi.kind}`}>
            <span className="home-place-icon" aria-hidden="true">
              <DiscoveryIcon kind={selectedPoi.kind} />
            </span>
            <p className="eyebrow">{visitorPlaceType(selectedFeature)}</p>
            <h2>{selectedPoi.name}</h2>
            <p className="home-place-location">{locationLabel}</p>
            {selectedPoi.kind === 'attraction' && selectedPoi.visitorScore !== undefined ? (
              <AttractionScorePair
                visitorScore={selectedPoi.visitorScore}
                dogAccess={selectedPoi.dogAccess}
              />
            ) : selectedPoi.visitorScore !== undefined && recommendation ? (
              <div className={`home-place-rating ${selectedPoi.kind} ${recommendation.className}`}>
                <strong>{formatVisitScore(selectedPoi.visitorScore)}</strong>
                <span>{recommendation.label}</span>
              </div>
            ) : null}
            {selectedPoi.tagline && (
              <span
                className={`detail-highlight-pill ${selectedPoi.kind === 'eat' ? 'eat' : 'see'} ${recommendation?.className ?? ''}`}
              >
                {selectedPoi.tagline}
              </span>
            )}
            <button
              type="button"
              className={showSources ? 'source-icon-button active' : 'source-icon-button'}
              aria-label={showSources ? 'Hide source notes' : 'Show source notes'}
              onClick={() => setShowSources((visible) => !visible)}
            >
              i
            </button>
          </div>

          {showSources ? (
            <section className="home-source-section">
              <h3>Where this came from</h3>
              {selectedFeature.sourceRecords.map((source) => (
                <div className="source" key={`${source.sourceName}-${source.sourceRecordId ?? ''}`}>
                  <strong>{source.sourceOrganisation}</strong>
                  <br />
                  {source.sourceUrl ? (
                    <a href={source.sourceUrl} target="_blank" rel="noreferrer">
                      {source.sourceName}
                    </a>
                  ) : (
                    source.sourceName
                  )}
                  <br />
                  <small>
                    {source.reliability.replaceAll('_', ' ')} · accessed{' '}
                    {new Date(source.accessedAt).toLocaleDateString()}
                  </small>
                </div>
              ))}
            </section>
          ) : (
            <>
              {selectedPoi.reason && !(selectedPoi.kind === 'attraction' && selectedPoi.attractionGuide) && (
                <section className="visit-section home-why-go">
                  <h3>Why go</h3>
                  <p>{selectedPoi.reason}</p>
                </section>
              )}
              {hasVisitPlan && (
                <section className="visit-section planner-detail-visit home-visit-plan">
                  <h3>{selectedPoi.kind === 'eat' ? 'Plan your meal' : 'Plan your visit'}</h3>
                  {badges.length > 0 && (
                    <div className="planner-detail-pills" aria-label="Visitor badges">
                      {badges.map((badge) => (
                        <span key={badge.label} className={badge.className}>
                          {badge.label}
                        </span>
                      ))}
                    </div>
                  )}
                  <dl className="planner-detail-facts">
                    {selectedPoi.timeToSpend && selectedPoi.kind === 'attraction' && (
                      <div className="planner-detail-fact planner-detail-fact--time">
                        <dt>Time to allow</dt>
                        <dd>{selectedPoi.timeToSpend}</dd>
                      </div>
                    )}
                    {selectedPoi.openingTimes && (
                      <div className="planner-detail-fact planner-detail-fact--opening">
                        <dt>{selectedPoi.kind === 'eat' ? 'When to go' : 'Opening times'}</dt>
                        <dd>
                          <ul className="visit-fact-lines">
                            {factLines(selectedPoi.openingTimes).map((line) => (
                              <li key={line}>
                                <span>{line}</span>
                              </li>
                            ))}
                          </ul>
                        </dd>
                      </div>
                    )}
                    {selectedPoi.admission && (
                      <div className="planner-detail-fact planner-detail-fact--prices">
                        <dt>Prices</dt>
                        <dd>{selectedPoi.admission}</dd>
                      </div>
                    )}
                    {!selectedPoi.admission && selectedPoi.priceBand && (
                      <div className="planner-detail-fact planner-detail-fact--price-guide">
                        <dt>Typical spend</dt>
                        <dd>
                          <span>{selectedPoi.priceBand}</span>
                        </dd>
                      </div>
                    )}
                  </dl>
                </section>
              )}
              {selectedPoi.kind === 'attraction' && (
                <AttractionGuide guide={selectedPoi.attractionGuide} />
              )}
              <DogAccessSection info={selectedPoi.dogAccess} />
              {facts.length > 0 && (
                <section className="visit-section">
                  <h3>{selectedPoi.kind === 'eat' ? 'Food details' : 'Good to know'}</h3>
                  <dl className="quick-facts">
                    {facts.map((fact) => (
                      <div key={`${fact.label}-${fact.value}`}>
                        <dt>{fact.label}</dt>
                        <dd>{fact.value}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              )}
              <div className="home-discovery-actions">
                {selectedPoi.externalUrl && (
                  <a href={selectedPoi.externalUrl} target="_blank" rel="noreferrer">
                    Open website
                  </a>
                )}
                <button type="button" onClick={() => onOpenTown(selectedPoi.projectId)}>
                  {selectedPoi.discoveryScope === 'standalone'
                    ? `Nearby ${selectedPoi.townName} guide`
                    : `Open ${selectedPoi.townName} guide`}
                </button>
              </div>
            </>
          )}
        </div>
      </aside>
    );
  }

  const title = mode === 'attraction' ? 'Places worth seeing' : 'Top food stops';
  const emptyText =
    mode === 'attraction'
      ? 'No recommended attractions are visible here. Move or zoom the map to explore another area.'
      : 'No highly rated food stops are visible here. Move or zoom the map to explore another area.';

  return (
    <aside className="home-discovery-panel" aria-label="Home discovery results">
      <div className="home-discovery-panel-heading">
        <p className="eyebrow">Discover</p>
        <h2>{title}</h2>
        <p>Curated recommendations in the current map view.</p>
      </div>
      <div className="home-discovery-panel-scroll">
        <section className="home-discovery-results">
          <div className="home-discovery-results-title">
            <h3>Best in this area</h3>
            <span>{sortedPois.length}</span>
          </div>
          {sortedPois.length ? (
            <ol>
              {sortedPois.map((poi, index) => {
                const recommendation = homePoiRecommendation(poi);
                const badges = visitorBadges(poi);
                return (
                  <li
                    key={poi.id}
                    className={`${poi.kind} ${recommendation?.className ?? ''}`}
                    onMouseEnter={() => onHover(poi.id)}
                    onMouseLeave={() => onHover(undefined)}
                  >
                    <button
                      type="button"
                      onClick={() => onSelect(poi)}
                      onFocus={() => onHover(poi.id)}
                      onBlur={() => onHover(undefined)}
                    >
                      <span className="home-result-rank" aria-hidden="true">
                        {index + 1}
                      </span>
                      <span className="home-result-copy">
                        <strong>{poi.name}</strong>
                        <span className="home-result-location">
                          {poi.discoveryScope === 'standalone'
                            ? `Near ${poi.townName}`
                            : poi.townName}
                        </span>
                        <span className="home-result-badges">
                          {recommendation && (
                            <span className={`planner-recommendation ${recommendation.className}`}>
                              {recommendation.label}
                            </span>
                          )}
                          {badges.slice(0, 3).map((badge) => (
                            <span key={badge.label} className={badge.className}>
                              {badge.label}
                            </span>
                          ))}
                          <DogPawBadge info={poi.dogAccess} />
                        </span>
                      </span>
                      {poi.visitorScore !== undefined && (
                        <em>{formatVisitScore(poi.visitorScore)}</em>
                      )}
                      <span className="home-result-action" aria-hidden="true">
                        ›
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="home-discovery-empty">{emptyText}</p>
          )}
        </section>
      </div>
    </aside>
  );
}
