import { dogOwnerAttractionScore, type DogAccessInfo } from '../domain/dogAccess';
import { formatVisitScore, visitRecommendation } from '../domain/visiting';
import { DogPawBadge } from './DogAccess';

interface AttractionScorePairProps {
  visitorScore: number;
  dogAccess?: DogAccessInfo;
}

export function AttractionScorePair({ visitorScore, dogAccess }: AttractionScorePairProps) {
  const dogOwnerScore = dogOwnerAttractionScore(visitorScore, dogAccess);
  const visitorRecommendation = visitRecommendation(visitorScore);
  const dogOwnerRecommendation = visitRecommendation(dogOwnerScore);

  if (!visitorRecommendation || !dogOwnerRecommendation) return null;

  return (
    <div className="attraction-score-pair" aria-label="Attraction ratings">
      <div className={`attraction-score-row visitor ${visitorRecommendation.className}`}>
        <span className="attraction-score-label">Visitor</span>
        <strong>{formatVisitScore(visitorScore)}</strong>
        <span className="attraction-score-result">
          <span className="attraction-score-band">{visitorRecommendation.label}</span>
        </span>
      </div>
      <div className={`attraction-score-row dog ${dogOwnerRecommendation.className}`}>
        <span className="attraction-score-label">With a dog</span>
        <strong>{formatVisitScore(dogOwnerScore)}</strong>
        <span className="attraction-score-result">
          <span className="attraction-score-band">{dogOwnerRecommendation.label}</span>
          <DogPawBadge info={dogAccess} />
        </span>
      </div>
    </div>
  );
}
