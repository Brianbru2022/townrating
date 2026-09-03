import {
  dogPawRatingLabel,
  type DogAccessInfo,
  type DogFriendlyRating,
} from '../domain/dogAccess';

function PawScale({
  rating,
  status,
}: {
  rating: DogFriendlyRating;
  status: DogAccessInfo['status'];
}) {
  if (rating === 0) {
    if (status === 'unconfirmed') {
      return (
        <span className="dog-paw-scale dog-paw-scale--unknown" aria-hidden="true">
          <span className="dog-paw-unknown">?</span>
        </span>
      );
    }
    return (
      <span className="dog-paw-scale dog-paw-scale--0" aria-hidden="true">
        <span className="dog-paw-zero-icon">🐾</span>
        <span className="dog-paw-zero-label">No dogs</span>
      </span>
    );
  }

  return (
    <span className={`dog-paw-scale dog-paw-scale--${rating}`} aria-hidden="true">
      {Array.from({ length: rating }, (_, paw) => (
        <span key={paw} className="filled">
          🐾
        </span>
      ))}
    </span>
  );
}

export function DogPawBadge({
  info,
  hideZero = false,
}: {
  info?: DogAccessInfo;
  hideZero?: boolean;
}) {
  if (!info || (hideZero && info.rating === 0)) return null;
  const label = dogPawRatingLabel(info);
  return (
    <span
      className={`dog-paw-badge dog-paw-badge--${info.rating} dog-paw-badge--${info.status}`}
      aria-label={label}
      title={label}
    >
      <PawScale rating={info.rating} status={info.status} />
    </span>
  );
}

export function DogAccessSection({ info }: { info?: DogAccessInfo }) {
  if (!info) return null;
  return (
    <section className={`dog-access-section dog-access-section--${info.status}`}>
      <div className="dog-access-heading">
        <div>
          <p className="eyebrow">Dog access</p>
          <h3>Visiting with a dog</h3>
        </div>
        <span className="dog-access-rating" aria-label={dogPawRatingLabel(info)}>
          <PawScale rating={info.rating} status={info.status} />
          <strong>
            {info.status === 'unconfirmed'
              ? 'Unknown'
              : info.rating === 0
                ? 'Not allowed'
                : `${info.rating}/3`}
          </strong>
        </span>
      </div>
      <p className="dog-access-label">{info.label}</p>
      <p>{info.summary}</p>
      {info.sourceUrl && (
        <a href={info.sourceUrl} target="_blank" rel="noreferrer">
          {info.sourceName ?? 'Check dog-access information'}
        </a>
      )}
    </section>
  );
}
