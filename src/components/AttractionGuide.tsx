import type { AttractionGuide as AttractionGuideData } from '../domain/models';
import { publicVisitorUrl } from '../domain/editorialResearch';
import { foodRecommendation, formatVisitScore } from '../domain/visiting';

interface AttractionGuideProps {
  guide?: AttractionGuideData;
}

function FacilityIcon({ kind }: { kind: 'parking' | 'toilets' | 'picnic' | 'food' }) {
  if (kind === 'parking') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 20V4h6a5 5 0 0 1 0 10H9M9 6v6h4a3 3 0 0 0 0-6z" />
      </svg>
    );
  }
  if (kind === 'toilets') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="8" cy="5" r="2" />
        <circle cx="16" cy="5" r="2" />
        <path d="M5 10h6v4H9v6H7v-6H5zM13 10h6v5h-2v5h-2v-5h-2z" />
      </svg>
    );
  }
  if (kind === 'food') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 3v8a3 3 0 0 0 3 3V3M5 8h6M8 14v7M16 3v18M16 3c3 2 4 5 3 9h-3" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 11h16M7 8v3M17 8v3M6 11l-2 9M18 11l2 9M5 16h14" />
    </svg>
  );
}

function TrailIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="6" cy="17" r="2" />
      <circle cx="18" cy="6" r="2" />
      <path d="M7.5 15.7c1.8-2.9 4.2-1.1 5.3-3.6.8-1.8-.3-3.1 3.2-4.8M17 13v6M14 16h6" />
    </svg>
  );
}

export function AttractionGuide({ guide }: AttractionGuideProps) {
  const food = guide?.food?.slice(0, 5) ?? [];
  const trails = guide?.trails?.slice(0, 6) ?? [];
  const thingsToDo = guide?.thingsToDo?.slice(0, 5) ?? [];
  const motifs = guide?.motifs?.slice(0, 4) ?? [];
  const bestFor = guide?.bestFor?.slice(0, 4) ?? [];
  const hasOverview = Boolean(guide?.headline || guide?.intro || motifs.length || bestFor.length);
  const hasFacilities = Boolean(
    guide?.parking || guide?.toilets || guide?.picnic || guide?.foodNote || food.length,
  );
  if (
    !hasOverview &&
    !hasFacilities &&
    food.length === 0 &&
    trails.length === 0 &&
    thingsToDo.length === 0
  ) {
    return null;
  }

  return (
    <div className="attraction-guide">
      {hasOverview && (
        <section className="visit-section attraction-overview">
          <p className="eyebrow">Visitor guide</p>
          {guide?.headline && <h3>{guide.headline}</h3>}
          {guide?.intro && <p className="attraction-overview-intro">{guide.intro}</p>}
          {motifs.length > 0 && (
            <div className="attraction-overview-motifs" aria-label="What makes this place special">
              {motifs.map((motif) => (
                <span key={motif}>{motif}</span>
              ))}
            </div>
          )}
          {bestFor.length > 0 && (
            <div className="attraction-overview-best-for">
              <strong>Best for</strong>
              <div>
                {bestFor.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
      {hasFacilities && (
        <section className="visit-section attraction-facilities">
          <p className="eyebrow">At the attraction</p>
          <h3>Visitor facilities</h3>
          <div className="attraction-facility-list">
            {guide?.parking && (
              <div className="attraction-facility">
                <span className="attraction-facility-icon" aria-hidden="true">
                  <FacilityIcon kind="parking" />
                </span>
                <div>
                  <strong>Parking</strong>
                  <p>{guide.parking}</p>
                </div>
              </div>
            )}
            {guide?.toilets && (
              <div className="attraction-facility">
                <span className="attraction-facility-icon" aria-hidden="true">
                  <FacilityIcon kind="toilets" />
                </span>
                <div>
                  <strong>Toilets</strong>
                  <p>{guide.toilets}</p>
                </div>
              </div>
            )}
            {guide?.picnic && (
              <div className="attraction-facility">
                <span className="attraction-facility-icon" aria-hidden="true">
                  <FacilityIcon kind="picnic" />
                </span>
                <div>
                  <strong>Picnic</strong>
                  <p>{guide.picnic}</p>
                </div>
              </div>
            )}
            {(guide?.foodNote || food.length > 0) && (
              <div className="attraction-facility">
                <span className="attraction-facility-icon" aria-hidden="true">
                  <FacilityIcon kind="food" />
                </span>
                <div>
                  <strong>Cafe and food</strong>
                  <p>
                    {food.length > 0
                      ? `${food.length} curated on-site food ${food.length === 1 ? 'option is' : 'options are'} listed below.`
                      : guide?.foodNote}
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {food.length > 0 && (
        <section className="visit-section attraction-food">
          <p className="eyebrow">Food and drink</p>
          <h3>Eat here</h3>
          <ol className="attraction-food-list">
            {food.map((option) => {
              const recommendation = foodRecommendation(option.visitorScore);
              return (
                <li key={option.name} className={recommendation?.className}>
                  <div className="attraction-food-heading">
                    <strong>{option.name}</strong>
                    <span className="attraction-food-score">
                      {formatVisitScore(option.visitorScore)}
                    </span>
                  </div>
                  <div className="attraction-food-pills">
                    {recommendation && <span>{recommendation.label}</span>}
                    {option.priceBand && <span>{option.priceBand}</span>}
                  </div>
                  {option.summary && <p>{option.summary}</p>}
                  {option.openingTimes && (
                    <p className="attraction-food-opening">
                      <strong>Opening times</strong> {option.openingTimes}
                    </p>
                  )}
                  {publicVisitorUrl(option.externalUrl) && (
                    <a href={publicVisitorUrl(option.externalUrl)} target="_blank" rel="noreferrer">
                      Food details
                    </a>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {trails.length > 0 && (
        <section className="visit-section attraction-trails">
          <p className="eyebrow">Explore on foot</p>
          <h3>Walks and trails</h3>
          <ol className="attraction-trail-list">
            {trails.map((trail) => {
              const details = [trail.routeType, trail.distance, trail.duration, trail.difficulty].filter(
                (detail): detail is string => Boolean(detail),
              );
              return (
                <li key={trail.name}>
                  <span className="attraction-trail-icon" aria-hidden="true">
                    <TrailIcon />
                  </span>
                  <div className="attraction-trail-body">
                    <strong>{trail.name}</strong>
                    {details.length > 0 && (
                      <div className="attraction-trail-meta" aria-label="Trail details">
                        {details.map((detail) => (
                          <span key={detail}>{detail}</span>
                        ))}
                      </div>
                    )}
                    {trail.summary && <p>{trail.summary}</p>}
                    {publicVisitorUrl(trail.externalUrl) && (
                      <a href={publicVisitorUrl(trail.externalUrl)} target="_blank" rel="noreferrer">
                        Trail details <span aria-hidden="true">↗</span>
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {thingsToDo.length > 0 && (
        <section className="visit-section attraction-things-to-do">
          <p className="eyebrow">Make the most of your visit</p>
          <h3>Top things to see and do</h3>
          <ol>
            {thingsToDo.map((activity, index) => (
              <li key={activity.name}>
                <span aria-hidden="true">{index + 1}</span>
                <div>
                  <strong>{activity.name}</strong>
                  {activity.summary && <p>{activity.summary}</p>}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
