import type { CSSProperties } from 'react';
import { homePoiRecommendation, type HomePoiOverview } from '../map/homeOverview';
import { AttractionScorePair } from './AttractionScorePair';

interface StandaloneAttractionGuideProps {
  poi: HomePoiOverview;
}

export function StandaloneAttractionGuide({ poi }: StandaloneAttractionGuideProps) {
  const guide = poi.attractionGuide;
  const recommendation = homePoiRecommendation(poi);
  if (poi.kind !== 'attraction' || poi.discoveryScope !== 'standalone' || !guide?.heroImage) {
    return null;
  }

  const experiences = guide.thingsToDo?.slice(0, 3) ?? [];
  const heroStyle = guide.heroObjectPosition
    ? ({ objectPosition: guide.heroObjectPosition } as CSSProperties)
    : undefined;

  return (
    <aside
      className={`standalone-attraction-guide ${recommendation?.className ?? ''}`}
      aria-label={`${poi.name} attraction guide`}
    >
      <div className="standalone-attraction-guide-label">
        <span aria-hidden="true" />
        <strong>Attraction guide</strong>
      </div>

      <section className="standalone-attraction-cover">
        <figure className="standalone-attraction-hero">
          <div className="standalone-attraction-hero-media">
            <img src={guide.heroImage} alt={guide.heroAlt ?? ''} style={heroStyle} />
          </div>
          <figcaption>
            <p className="eyebrow">Worth discovering</p>
            <h1>{poi.name}</h1>
            {poi.visitorScore !== undefined && recommendation && (
              <AttractionScorePair visitorScore={poi.visitorScore} dogAccess={poi.dogAccess} />
            )}
          </figcaption>
        </figure>

        {guide.motifs && guide.motifs.length > 0 && (
          <div className="standalone-attraction-motifs" aria-label="Attraction character">
            {guide.motifs.slice(0, 4).map((motif) => (
              <span key={motif}>
                <i aria-hidden="true" />
                {motif}
              </span>
            ))}
          </div>
        )}

        <div className="standalone-attraction-copy">
          <p className="standalone-attraction-location">Near {poi.townName}</p>
          {guide.headline && <h2>{guide.headline}</h2>}
          <p>{guide.intro ?? poi.reason}</p>
        </div>

        {guide.bestFor && guide.bestFor.length > 0 && (
          <div className="standalone-attraction-best-for" aria-label="Best for">
            <p className="eyebrow">Best for</p>
            <div>
              {guide.bestFor.slice(0, 4).map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </div>
        )}

        {experiences.length > 0 && (
          <section className="standalone-attraction-highlights">
            <p className="eyebrow">Don't miss</p>
            <ol>
              {experiences.map((experience) => (
                <li key={experience.name}>{experience.name}</li>
              ))}
            </ol>
          </section>
        )}
      </section>
    </aside>
  );
}
