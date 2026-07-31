import { dateWording } from '../domain/timeline';
import { useExplorerStore } from '../app/store';
import type { SourceRecord } from '../domain/models';

interface OsmDetail {
  key: string;
  value: string;
}

const osmLabels: Record<string, string> = {
  description: 'Description',
  opening_hours: 'Opening hours',
  'opening_hours:description': 'Opening-hours note',
  operator: 'Operator',
  wheelchair: 'Accessibility',
  toilets: 'Toilets',
  cuisine: 'Cuisine',
  rating: 'Rating',
  rating_count: 'Rating count',
  rating_provider: 'Rating source',
};

function currentPlaceDetails(source?: SourceRecord): OsmDetail[] {
  const notes = source?.notes;
  if (!notes?.startsWith('Current OSM') && !notes?.startsWith('Current-place curation')) return [];
  const colon = notes.indexOf(':');
  if (colon === -1) return [];
  return notes
    .slice(colon + 1)
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

function safeExternalUrl(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function currentPlaceType(osmDetails: OsmDetail[], tags: string[]): string {
  const tag = (key: string) => osmDetails.find((detail) => detail.key === key)?.value;
  const amenity = tag('amenity');
  if (amenity === 'cafe') return 'Café';
  if (amenity === 'ice_cream') return 'Ice-cream shop';
  if (amenity === 'restaurant') return 'Restaurant';
  if (amenity === 'parking') return 'Parking';
  if (amenity === 'toilets') return 'Public toilets';
  if (amenity === 'drinking_water') return 'Drinking water';
  const category = tags.find((item) => item.startsWith('osm-community-') && item !== 'osm-community-place');
  return category?.replace('osm-community-', '').replaceAll('_', ' ') ?? 'Current place';
}

export function FeatureDetails() {
  const feature = useExplorerStore((state) => state.selectedFeature);
  const select = useExplorerStore((state) => state.selectFeature);
  if (!feature)
    return (
      <aside className="details empty">
        <h2>Feature details</h2>
        <p>Select a mapped historic feature to inspect its source-backed record.</p>
      </aside>
    );
  const osmSource = feature.sourceRecords.find(
    (source) => source.sourceName === 'OpenStreetMap current community places',
  );
  const curatedPlaceSource = feature.sourceRecords.find((source) => source.notes?.startsWith('Current-place curation'));
  const currentPlaceSource = curatedPlaceSource ?? osmSource;
  const currentDetails = currentPlaceDetails(currentPlaceSource);
  const currentOsmDetails = currentPlaceDetails(osmSource);
  const currentDetail = (key: string) => currentDetails.find((detail) => detail.key === key)?.value;
  const osmWebsite = safeExternalUrl(currentDetail('website') ?? currentOsmDetails.find((detail) => detail.key === 'website')?.value);
  const shownCurrentDetails = currentDetails.filter(
    (detail) => detail.key in osmLabels && !(detail.key === 'description' && detail.value === feature.shortDescription),
  );
  const isCurrentPlace = Boolean(osmSource);
  return (
    <aside className="details">
      <button className="icon" onClick={() => select(undefined)} aria-label="Close details">
        ×
      </button>
      <p className="eyebrow">{isCurrentPlace ? 'Current place' : feature.featureType}</p>
      <h2>{feature.name}</h2>
      {feature.evidenceScope === 'related_context' && (
        <p className="notice">
          Related context — excluded from parish statistics and heat scoring.
        </p>
      )}
      {isCurrentPlace ? (
        <dl className="current-place-meta">
          <dt>Place type</dt>
          <dd>{currentPlaceType(currentOsmDetails, feature.tags)}</dd>
          <dt>Location</dt>
          <dd>
            {feature.locationType.replaceAll('_', ' ')} ({feature.locationConfidence})
          </dd>
          <dt>Information</dt>
          <dd>{curatedPlaceSource ? 'Source reviewed' : 'OpenStreetMap mapped'}</dd>
        </dl>
      ) : (
        <>
          <p className="date">
            <span>Historic date</span>
            {dateWording(feature)}
          </p>
          <dl>
            <dt>Designation</dt>
            <dd>{feature.designationCategory ?? feature.designationType ?? 'Not designated'}</dd>
            <dt>Date basis</dt>
            <dd>{feature.dateBasis.replaceAll('_', ' ')}</dd>
            <dt>Date confidence</dt>
            <dd>{feature.dateConfidence}</dd>
            {feature.datePrecision && (
              <>
                <dt>Date precision</dt>
                <dd>{feature.datePrecision.replaceAll('_', ' ')}</dd>
              </>
            )}
            <dt>Location</dt>
            <dd>
              {feature.locationType.replaceAll('_', ' ')} ({feature.locationConfidence})
            </dd>
            <dt>Review status</dt>
            <dd>{feature.reviewed ? 'Reviewed' : 'Unreviewed'}</dd>
          </dl>
        </>
      )}
      {feature.shortDescription && <p>{feature.shortDescription}</p>}
      {currentPlaceSource && (
        <section className="osm-details">
          <h3>{curatedPlaceSource ? 'Curated current-place details' : 'Current OSM details'}</h3>
          <p>
            {curatedPlaceSource ? 'Source-reviewed information. ' : 'Present-day mapped information only; it may be incomplete or out of date. '}
            {curatedPlaceSource?.sourceUrl ? (
              <a href={curatedPlaceSource.sourceUrl} target="_blank" rel="noreferrer">
                View the reviewed source
              </a>
            ) : null}
            {!curatedPlaceSource && osmSource?.sourceUrl && (
              <a href={osmSource.sourceUrl} target="_blank" rel="noreferrer">
                View this place in OpenStreetMap
              </a>
            )}
          </p>
          {shownCurrentDetails.length > 0 && (
            <dl className="osm-detail-list">
              {shownCurrentDetails.map((detail) => (
                <div key={detail.key}>
                  <dt>{osmLabels[detail.key]}</dt>
                  <dd>{detail.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {osmWebsite && (
            <p>
              <a href={osmWebsite} target="_blank" rel="noreferrer">
                Visit the place website
              </a>
            </p>
          )}
          {currentDetails.length === 0 && (
            <p className="source-notes">No opening hours or description have been mapped for this place yet.</p>
          )}
        </section>
      )}
      <h3>Sources</h3>
      {feature.sourceRecords.map((source) => (
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
          {source.notes &&
            !source.notes.startsWith('Current OSM') &&
            !source.notes.startsWith('Current-place curation') && <p className="source-notes">{source.notes}</p>}
        </div>
      ))}
    </aside>
  );
}
