import { useEffect, useState } from 'react';
import { AttractionGuide } from './AttractionGuide';
import { AttractionScorePair } from './AttractionScorePair';
import { DogAccessSection, DogPawBadge } from './DogAccess';
import { useExplorerStore } from '../app/store';
import {
  addCuratedPlannerPlace,
  cleanPlannerCurationState,
  curatablePlannerNeeds,
  curatedFeatureIds,
  hasCuratedNeed,
  isCuratedForNeed,
  mergePlannerCurationState,
  type PlannerCurationDraft,
  plannerCurationStorageKey,
  removeCuratedPlannerPlace,
  type PlannerCurationState,
} from '../domain/plannerCuration';
import { publishedPlannerCurationForProject } from '../data/visitorPlannerCuration';
import { dateWording } from '../domain/timeline';
import {
  currentPlaceInfo,
  osmDetailLabel,
  visitorDetails,
  visitorFacts,
  visitorInterestLabel,
  visitorNeedDisplayLimit,
  visitorNeedPlaces,
  visitorPitch,
  visitorPlaceType,
  type VisitorNeed,
} from '../domain/visitorExperience';
import { publicVisitorUrl } from '../domain/editorialResearch';
import {
  foodRecommendation,
  formatVisitScore,
  trailRecommendation,
  visitRecommendation,
  type VisitPlace,
} from '../domain/visiting';
import type { HeritageFeature } from '../domain/models';

type DetailsTab = 'visit' | 'evidence';
type PlannerIconKind =
  'star' | 'cup' | 'walk' | 'route' | 'camera' | 'tree' | 'picnic' | 'parking' | 'toilet';

const plannerCategories: Array<{
  id: VisitorNeed;
  label: string;
  icon: PlannerIconKind;
  title: string;
  emptyText: string;
}> = [
  {
    id: 'see',
    label: 'See',
    icon: 'star',
    title: 'Things to see',
    emptyText: 'No visitor attractions have been curated for this town yet.',
  },
  {
    id: 'eat',
    label: 'Eat',
    icon: 'cup',
    title: 'Cafes & food',
    emptyText: 'No cafes or food stops are mapped inside the town boundary yet.',
  },
  {
    id: 'trails',
    label: 'Trails',
    icon: 'route',
    title: 'Town trails',
    emptyText:
      'No verified town, heritage or treasure trail is currently curated for this town.',
  },
  {
    id: 'picnic',
    label: 'Picnic',
    icon: 'picnic',
    title: 'Picnic areas',
    emptyText:
      'No picnic tables, benches or outdoor seating are mapped inside the town boundary yet.',
  },
  {
    id: 'parking',
    label: 'Parking',
    icon: 'parking',
    title: 'Parking',
    emptyText: 'No parking places are mapped inside the town boundary yet.',
  },
  {
    id: 'toilets',
    label: 'Toilets',
    icon: 'toilet',
    title: 'Toilets',
    emptyText: 'No public toilets are mapped inside the town boundary yet.',
  },
];

interface LoadedPlannerCuration {
  state: PlannerCurationState;
  hasLocalDraft: boolean;
}

interface PlannerBadge {
  label: string;
  className: string;
}

interface PlannerBadgeOptions {
  includePriceBand?: boolean;
  includeAdmission?: boolean;
}

function plannerBadgeClass(label: string): string {
  if (/^£+$/u.test(label)) return 'planner-badge badge-price-band';
  const normalised = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  if (normalised === 'dog-friendly') return 'planner-badge badge-dog-friendly';
  if (normalised === 'free') return 'planner-badge badge-free';
  if (normalised === 'pay') return 'planner-badge badge-pay';
  if (normalised === 'check-signs') return 'planner-badge badge-check-signs';
  if (normalised === 'nts') return 'planner-badge badge-nts';
  if (normalised === 'hes') return 'planner-badge badge-hes';
  return `planner-badge badge-organisation badge-${normalised}`;
}

function plannerBadgesForPlace(
  place?: VisitPlace,
  { includePriceBand = true, includeAdmission = true }: PlannerBadgeOptions = {},
): PlannerBadge[] {
  if (!place) return [];
  const priceBadge = includeAdmission
    ? place.parkingPriceStatus === 'unknown'
      ? 'Check signs'
      : place.freeAdmission
      ? 'Free'
      : place.admission
        ? 'Pay'
        : undefined
    : undefined;
  const priceBandBadge = includePriceBand ? place.priceBand : undefined;
  const seenLabels = new Set<string>();
  return [priceBadge, priceBandBadge, ...(place.organisationPills ?? [])]
    .filter((label): label is string => Boolean(label))
    .filter((label) => {
      const key = label.trim().toLocaleLowerCase('en-GB');
      if (seenLabels.has(key)) return false;
      seenLabels.add(key);
      return true;
    })
    .map((label) => ({ label, className: plannerBadgeClass(label) }));
}

function parkingPriceClass(place: VisitPlace): string {
  if (place.freeAdmission) return 'parking-price-free';
  if (place.admission) return 'parking-price-paid';
  if (place.parkingPriceStatus === 'unknown') return 'parking-price-unknown';
  return '';
}

function visitFactLines(text: string, splitSentences = false): string[] {
  const sentenceAwareText = splitSentences
    ? text.replace(/\.\s+(?=[A-Z])/g, '.|')
    : text.replace(/\.\s+(Closed\b)/g, '.|$1');
  return sentenceAwareText
    .split(/[;|]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function VisitFactText({
  text,
  splitSentences = false,
}: {
  text: string;
  splitSentences?: boolean;
}) {
  const lines = visitFactLines(text, splitSentences);
  if (lines.length <= 1) return <>{text}</>;
  return (
    <ul className="visit-fact-lines">
      {lines.map((line) => (
        <li key={line}>
          <span>{line}</span>
        </li>
      ))}
    </ul>
  );
}

function selectedPlaceWhyGo(
  place: VisitPlace | undefined,
  feature: HeritageFeature | undefined,
  townName: string,
): string {
  if (!place || !feature) return feature ? visitorPitch(feature) : '';
  if (visitorPlaceType(feature) === 'Parking' && feature.shortDescription) {
    return feature.shortDescription;
  }
  const normalisedName = place.name.toLocaleLowerCase();
  if (normalisedName.includes('camera obscura')) {
    return `Climb up to Kirrie Hill for one of ${townName}'s most memorable moments: J M Barrie's unusual hilltop Camera Obscura, broad Angus views and an easy family pause around the pavilion and Neverland Playpark. It gives the town's storybook side a proper sense of place.`;
  }
  if (normalisedName.includes("j m barrie's birthplace")) {
    return `Start here for the heart of ${townName}'s Peter Pan story. The birthplace gives the town's literary connection a real setting, then the nearby statues and town-centre wander make the story feel woven into the streets.`;
  }
  if (normalisedName.includes('bon scott')) {
    return `A quick but memorable stop for music fans, the Bon Scott statue gives ${townName} a different kind of fame from its Peter Pan story and makes the town-centre wander feel more distinctive.`;
  }
  if (normalisedName.includes('peter pan')) {
    return `A small, easy landmark that turns ${townName}'s J M Barrie connection into something visible in the town centre. It is best enjoyed as part of a gentle wander between the main Barrie stops.`;
  }
  if (normalisedName.includes('gateway to the glens')) {
    return `Use this as a local-history anchor before heading back into the streets or up towards the hill. It helps connect ${townName}'s town story with the wider Angus Glens setting.`;
  }
  if (normalisedName.includes('police museum')) {
    return `A characterful specialist stop for visitors who enjoy small local museums. It adds an unexpected layer to a ${townName} wander without needing to turn the visit into a long museum day.`;
  }
  if (normalisedName.includes('kirriemuir den')) {
    return `A gentler green pause between the town-centre sights, useful if you want a bit of fresh air or are visiting with children. It broadens ${townName} beyond its monuments and museums.`;
  }
  if (normalisedName.includes('kirrie hill')) {
    return `Head up for the outlook: this is where ${townName} opens towards the Angus landscape. It works especially well alongside the Camera Obscura and the family stops around the hill.`;
  }
  if (normalisedName.includes('cemetery') || normalisedName.includes('grave')) {
    return `A quieter, reflective stop for visitors following the J M Barrie thread. Go respectfully and treat it as a brief pause rather than a conventional attraction.`;
  }
  if (normalisedName.includes('neverland')) {
    return `A playful family stop that keeps ${townName}'s Peter Pan story alive beyond the museum and statues. It works best as part of the hilltop Camera Obscura cluster.`;
  }
  if (place.reason) {
    return place.reason;
  }
  return visitorPitch(feature);
}

function loadPlannerCuration(projectId: string, includeLocalDraft: boolean): LoadedPlannerCuration {
  const bundled = publishedPlannerCurationForProject(projectId);
  if (!includeLocalDraft || typeof window === 'undefined') {
    return { state: bundled, hasLocalDraft: false };
  }
  try {
    const raw = window.localStorage.getItem(plannerCurationStorageKey(projectId));
    if (!raw) return { state: bundled, hasLocalDraft: false };
    const parsed = JSON.parse(raw) as PlannerCurationDraft | PlannerCurationState;
    if ('curation' in parsed) {
      return {
        state: mergePlannerCurationState(bundled, cleanPlannerCurationState(parsed.curation)),
        hasLocalDraft: true,
      };
    }
    return {
      state: mergePlannerCurationState(bundled, cleanPlannerCurationState(parsed)),
      hasLocalDraft: true,
    };
  } catch {
    return { state: bundled, hasLocalDraft: false };
  }
}

function savePlannerCuration(
  projectId: string,
  projectName: string,
  state: PlannerCurationState,
): void {
  if (typeof window === 'undefined') return;
  const draft: PlannerCurationDraft = {
    schemaVersion: 1,
    projectId,
    projectName,
    updatedAt: new Date().toISOString(),
    curation: cleanPlannerCurationState(state),
  };
  window.localStorage.setItem(plannerCurationStorageKey(projectId), JSON.stringify(draft));
}

function downloadPlannerCuration(
  projectId: string,
  projectName: string,
  state: PlannerCurationState,
): void {
  const draft: PlannerCurationDraft = {
    schemaVersion: 1,
    projectId,
    projectName,
    updatedAt: new Date().toISOString(),
    curation: cleanPlannerCurationState(state),
  };
  const href = URL.createObjectURL(
    new Blob([`${JSON.stringify(draft, null, 2)}\n`], { type: 'application/json' }),
  );
  const link = document.createElement('a');
  link.href = href;
  link.download = `${projectId}-visitor-planner-curation.json`;
  link.click();
  URL.revokeObjectURL(href);
}

function plannerCurationIdsForNeed(
  state: PlannerCurationState,
  need: VisitorNeed,
): string[] | undefined {
  return hasCuratedNeed(state, need) ? curatedFeatureIds(state, need) : undefined;
}

function PlannerIcon({ kind }: { kind: PlannerIconKind }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2.2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    focusable: false,
    'aria-hidden': true,
  };
  if (kind === 'cup') {
    return (
      <svg {...common}>
        <path d="M5 8h10v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z" />
        <path d="M15 9h2.2a2.3 2.3 0 0 1 0 4.6H15" />
        <path d="M7 3v2" />
        <path d="M11 3v2" />
        <path d="M5 21h12" />
      </svg>
    );
  }
  if (kind === 'walk') {
    return (
      <svg {...common}>
        <path d="M13 4.5a1.8 1.8 0 1 1-3.6 0 1.8 1.8 0 0 1 3.6 0z" />
        <path d="M10.8 7.5 8.6 12l3.4 2 1.2 5" />
        <path d="M9 12l-2.6 7" />
        <path d="m12 8.8 2.2 2.2 2.8-.8" />
      </svg>
    );
  }
  if (kind === 'camera') {
    return (
      <svg {...common}>
        <path d="M4 8.5h3l1.5-2h7l1.5 2h3v10H4z" />
        <circle cx="12" cy="13.5" r="3.2" />
      </svg>
    );
  }
  if (kind === 'route') {
    return (
      <svg {...common}>
        <path d="M5 18.5c3.8 0 3.8-4 7-4s3.2 4 7 4" />
        <path d="M5 5.5c3.8 0 3.8 4 7 4s3.2-4 7-4" />
        <circle cx="5" cy="18.5" r="1.5" />
        <circle cx="19" cy="5.5" r="1.5" />
      </svg>
    );
  }
  if (kind === 'tree') {
    return (
      <svg {...common}>
        <path d="M12 20v-5" />
        <path d="M8.2 15.5h7.6" />
        <path d="M7.8 15.5 12 4l4.2 11.5z" />
      </svg>
    );
  }
  if (kind === 'picnic') {
    return (
      <svg {...common}>
        <path d="M5 10h14" />
        <path d="M8 10 5.5 19" />
        <path d="M16 10l2.5 9" />
        <path d="M7 15h10" />
        <path d="M10 6h4" />
        <path d="M12 6v4" />
      </svg>
    );
  }
  if (kind === 'parking') {
    return (
      <svg {...common}>
        <path d="M7.5 20V4h5.4a4.3 4.3 0 0 1 0 8.6H7.5" />
        <path d="M7.5 12.6h5.2" />
      </svg>
    );
  }
  if (kind === 'toilet') {
    return (
      <svg {...common}>
        <path d="M8.5 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
        <path d="M6 21v-6H4.5l1.2-6h5.6l1.2 6H11v6" />
        <path d="M15.5 4v17" />
        <path d="M18.8 8v13" />
        <path d="M15.5 8h3.3" />
      </svg>
    );
  }
  return (
    <svg {...common} fill="currentColor" strokeWidth={1.6}>
      <path d="m12 3.4 2.5 5.1 5.6.8-4 3.9.9 5.5-5-2.7-5 2.7.9-5.5-4-3.9 5.6-.8z" />
    </svg>
  );
}

export function FeatureDetails() {
  const [activeTab, setActiveTab] = useState<DetailsTab>('visit');
  const [plannerNeed, setPlannerNeed] = useState<VisitorNeed>('see');
  const [plannerCuration, setPlannerCuration] = useState<PlannerCurationState>({});
  const [hasLocalPlannerDraft, setHasLocalPlannerDraft] = useState(false);
  const pkg = useExplorerStore((state) => state.package);
  const feature = useExplorerStore((state) => state.selectedFeature);
  const select = useExplorerStore((state) => state.selectFeature);
  const setHoveredFeature = useExplorerStore((state) => state.setHoveredFeature);
  const setActivePlannerNeed = useExplorerStore((state) => state.setActivePlannerNeed);
  const setShowOsmPoints = useExplorerStore((state) => state.setShowOsmPoints);
  const adminMode = useExplorerStore((state) => state.adminMode);
  const publicPlannerCuration = publishedPlannerCurationForProject(pkg.project.id);
  const visiblePlannerCuration = adminMode ? plannerCuration : publicPlannerCuration;
  const activePlannerCategory =
    plannerCategories.find((category) => category.id === plannerNeed) ?? plannerCategories[0];
  const activePlannerPlaces = visitorNeedPlaces(pkg, plannerNeed, visitorNeedDisplayLimit(plannerNeed), {
    curatedFeatureIds: plannerCurationIdsForNeed(visiblePlannerCuration, plannerNeed),
  });
  const featuresById = new Map(pkg.features.map((item) => [item.id, item]));

  function selectPlanPlace(place: VisitPlace) {
    setHoveredFeature(undefined);
    select(featuresById.get(place.id));
  }

  function choosePlannerNeed(need: VisitorNeed) {
    setPlannerNeed(need);
    setActivePlannerNeed(need);
    setShowOsmPoints(true);
  }

  function backToPlanner() {
    setHoveredFeature(undefined);
    select(undefined);
  }

  useEffect(() => {
    setActiveTab('visit');
  }, [feature?.id]);

  useEffect(() => {
    const loaded = loadPlannerCuration(pkg.project.id, adminMode);
    setPlannerCuration(loaded.state);
    setHasLocalPlannerDraft(loaded.hasLocalDraft);
  }, [adminMode, pkg.project.id]);

  function updatePlannerCuration(next: PlannerCurationState) {
    const cleaned = cleanPlannerCurationState(next);
    setPlannerCuration(cleaned);
    setHasLocalPlannerDraft(true);
    savePlannerCuration(pkg.project.id, pkg.project.name, cleaned);
  }

  function toggleCuratedPlannerPlace(need: VisitorNeed, featureId: string) {
    const next = isCuratedForNeed(plannerCuration, need, featureId)
      ? removeCuratedPlannerPlace(plannerCuration, need, featureId)
      : addCuratedPlannerPlace(plannerCuration, need, featureId);
    updatePlannerCuration(next);
  }

  if (!feature)
    return (
      <aside className="details visit-planner" aria-label="Town trip planner">
        <div className="planner-masthead">
          <p className="eyebrow">Trip planner</p>
          <h2>{pkg.project.locality} in one visit</h2>
          <p className="planner-intro">
            Pick what you need, then hover a place to see it marked on the map.
          </p>
          {pkg.project.townGuide?.currentAdvisory && (
            <aside className="planner-advisory" aria-label="Current visitor update">
              <div>
                <strong>{pkg.project.townGuide.currentAdvisory.title}</strong>
                <span>{pkg.project.townGuide.currentAdvisory.summary}</span>
              </div>
              <a
                href={pkg.project.townGuide.currentAdvisory.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                {pkg.project.townGuide.currentAdvisory.linkLabel}
              </a>
            </aside>
          )}
          <div
            className="planner-category-grid"
            role="tablist"
            aria-label="Visitor place categories"
          >
            {plannerCategories.map((category) => {
              const count = visitorNeedPlaces(pkg, category.id, visitorNeedDisplayLimit(category.id), {
                curatedFeatureIds: plannerCurationIdsForNeed(visiblePlannerCuration, category.id),
              }).length;
              return (
                <button
                  key={category.id}
                  type="button"
                  role="tab"
                  aria-selected={plannerNeed === category.id}
                  className={
                    plannerNeed === category.id
                      ? `planner-category active ${category.id}`
                      : `planner-category ${category.id}`
                  }
                  onClick={() => choosePlannerNeed(category.id)}
                >
                  <span className="planner-category-icon" aria-hidden="true">
                    <PlannerIcon kind={category.icon} />
                  </span>
                  <span>{category.label}</span>
                  <strong>{count}</strong>
                </button>
              );
            })}
          </div>
        </div>
        <div className="planner-scroll-region" aria-label="Planner results">
          <PlannerSection
            title={activePlannerCategory.title}
            places={activePlannerPlaces}
            emptyText={activePlannerCategory.emptyText}
            category={plannerNeed}
            showScore={plannerNeed === 'see' || plannerNeed === 'eat' || plannerNeed === 'trails'}
            onSelect={selectPlanPlace}
            onHover={setHoveredFeature}
          />
        </div>
      </aside>
    );

  const currentInfo = currentPlaceInfo(feature);
  const isCurrentPlace = Boolean(currentInfo.osmSource);
  const placeType = visitorPlaceType(feature);
  const isParkingPlace = placeType === 'Parking';
  const selectedPlannerPlace = activePlannerPlaces.find((place) => place.id === feature.id);
  const website =
    publicVisitorUrl(
      selectedPlannerPlace?.externalUrl,
      currentInfo.currentDetails.find((detail) => detail.key === 'website')?.value,
      currentInfo.osmDetails.find((detail) => detail.key === 'website')?.value,
    );
  const shownVisitorDetails = visitorDetails(feature).filter(
    (detail) =>
      !(detail.key === 'description' && detail.value === feature.shortDescription) &&
      detail.key !== 'website' &&
      detail.key !== 'contact:website',
  );
  const repeatedPlannerFactLabels = new Set([
    'Good for',
    'Time to spend',
    'Opening',
    'Opening times',
    'Price guide',
    'Price',
    'Prices',
  ]);
  const allFacts = visitorFacts(feature).filter(
    (fact) => !selectedPlannerPlace || !repeatedPlannerFactLabels.has(fact.label),
  );
  const historicDateFact = allFacts.find((fact) => fact.label === 'Historic date');
  const facts = allFacts.filter((fact) => fact.label !== 'Historic date');
  const showVisitorDetails = shownVisitorDetails.length > 0 && !selectedPlannerPlace;
  const isFoodPlannerPlace = Boolean(selectedPlannerPlace && plannerNeed === 'eat');
  const isAttractionPlannerPlace = Boolean(selectedPlannerPlace && plannerNeed === 'see');
  const selectedAttractionGuide = isAttractionPlannerPlace
    ? selectedPlannerPlace?.attractionGuide
    : undefined;
  const selectedAttractionRecommendation = isAttractionPlannerPlace
    ? visitRecommendation(selectedPlannerPlace?.visitorScore)
    : undefined;
  const selectedFoodRecommendation = isFoodPlannerPlace
    ? foodRecommendation(selectedPlannerPlace?.visitorScore)
    : undefined;
  const selectedPlannerRecommendation =
    selectedAttractionRecommendation ?? selectedFoodRecommendation;
  const isPracticalPlannerPlace = Boolean(
    selectedPlannerPlace &&
    (plannerNeed === 'parking' ||
      plannerNeed === 'toilets' ||
      plannerNeed === 'picnic' ||
      plannerNeed === 'trails'),
  );
  const whyGo = isParkingPlace
    ? feature.shortDescription
    : selectedPlaceWhyGo(selectedPlannerPlace, feature, pkg.project.locality);
  const detailFactsHeading = isParkingPlace
    ? 'Parking details'
    : isFoodPlannerPlace
      ? 'Food details'
      : isAttractionPlannerPlace
        ? 'Useful to know'
        : plannerNeed === 'toilets'
          ? 'Toilet details'
          : plannerNeed === 'picnic'
            ? 'Picnic details'
            : 'Good to know';
  const visitPlanHeading = isFoodPlannerPlace ? 'Plan your meal' : 'Plan your visit';
  const selectedPlannerPills = plannerBadgesForPlace(selectedPlannerPlace, {
    includePriceBand: false,
    includeAdmission: plannerNeed !== 'eat',
  });
  const visitorActionLabel =
    plannerNeed === 'trails'
      ? website?.startsWith('/trails/')
        ? 'Download trail'
        : 'Open trail'
      : 'Open website';
  const hasSelectedPlannerVisitInfo = Boolean(
    selectedPlannerPlace?.timeToSpend ||
    selectedPlannerPlace?.openingTimes ||
    selectedPlannerPlace?.admission ||
    selectedPlannerPlace?.priceBand ||
    selectedPlannerPills.length > 0,
  );

  return (
    <aside className="details place-details">
      <button className="icon" onClick={backToPlanner} aria-label="Close details">
        ×
      </button>
      <button type="button" className="back-to-planner-button" onClick={backToPlanner}>
        Back to list
      </button>
      <div className="place-detail-hero">
        <p className="eyebrow">{placeType}</p>
        <h2>{selectedPlannerPlace?.name ?? feature.name}</h2>
        {historicDateFact && (
          <p className="heritage-pin-date">
            <span>Historic date</span>
            <strong>{historicDateFact.value}</strong>
          </p>
        )}
        {isAttractionPlannerPlace && selectedPlannerPlace?.visitorScore !== undefined ? (
          <AttractionScorePair
            visitorScore={selectedPlannerPlace.visitorScore}
            dogAccess={selectedPlannerPlace.dogAccess}
          />
        ) : isFoodPlannerPlace &&
          selectedPlannerPlace?.visitorScore !== undefined &&
          selectedPlannerRecommendation ? (
          <div
            className={`home-place-rating eat ${selectedPlannerRecommendation.className}`}
          >
            <strong>{formatVisitScore(selectedPlannerPlace.visitorScore)}</strong>
            <span>{selectedPlannerRecommendation.label}</span>
          </div>
        ) : (
          <span className="visitor-pill">{visitorInterestLabel(feature)}</span>
        )}
        {(isAttractionPlannerPlace || isFoodPlannerPlace) && selectedPlannerPlace?.tagline && (
          <span
            className={`detail-highlight-pill ${isFoodPlannerPlace ? 'eat' : 'see'} ${selectedPlannerRecommendation?.className ?? ''}`}
          >
            {selectedPlannerPlace.tagline}
          </span>
        )}
        <button
          type="button"
          className={activeTab === 'evidence' ? 'source-icon-button active' : 'source-icon-button'}
          aria-label={activeTab === 'evidence' ? 'Hide source notes' : 'Show source notes'}
          title={activeTab === 'evidence' ? 'Back to visit view' : 'Source notes'}
          onClick={() => setActiveTab((tab) => (tab === 'evidence' ? 'visit' : 'evidence'))}
        >
          i
        </button>
      </div>
      {activeTab === 'visit' ? (
        <>
          {isPracticalPlannerPlace && whyGo ? (
            <p className="practical-detail-summary">{whyGo}</p>
          ) : whyGo && !selectedAttractionGuide ? (
            <section className="visit-section">
              <h3>Why go</h3>
              <p>{whyGo}</p>
            </section>
          ) : null}
          {hasSelectedPlannerVisitInfo && (
            <section className="visit-section planner-detail-visit">
              <h3>{visitPlanHeading}</h3>
              {selectedPlannerPills.length > 0 && (
                <div className="planner-detail-pills" aria-label="Visitor badges">
                  {selectedPlannerPills.map((pill) => (
                    <span
                      key={pill.label}
                      className={`${pill.className}${isParkingPlace ? ' parking-detail-badge' : ''}`}
                      aria-label={pill.label}
                      title={pill.label}
                    >
                      {pill.label}
                    </span>
                  ))}
                </div>
              )}
              <dl className="planner-detail-facts">
                {selectedPlannerPlace?.timeToSpend && !isFoodPlannerPlace && (
                  <div className="planner-detail-fact planner-detail-fact--time">
                    <dt>Time to allow</dt>
                    <dd>{selectedPlannerPlace.timeToSpend}</dd>
                  </div>
                )}
                {selectedPlannerPlace?.openingTimes && (
                  <div className="planner-detail-fact planner-detail-fact--opening">
                    <dt>{plannerNeed === 'eat' ? 'When to go' : 'Opening times'}</dt>
                    <dd>
                      <VisitFactText text={selectedPlannerPlace.openingTimes} splitSentences />
                    </dd>
                  </div>
                )}
                {selectedPlannerPlace?.admission && (
                  <div className="planner-detail-fact planner-detail-fact--prices">
                    <dt>Prices</dt>
                    <dd>
                      <VisitFactText text={selectedPlannerPlace.admission} />
                    </dd>
                  </div>
                )}
                {!selectedPlannerPlace?.admission && selectedPlannerPlace?.priceBand && (
                  <div className="planner-detail-fact planner-detail-fact--price-guide">
                    <dt>Typical spend</dt>
                    <dd>
                      <span>{selectedPlannerPlace.priceBand}</span>
                    </dd>
                  </div>
                )}
              </dl>
            </section>
          )}
          {isAttractionPlannerPlace && (
            <AttractionGuide guide={selectedAttractionGuide} />
          )}
          {(isAttractionPlannerPlace || isFoodPlannerPlace) && (
            <DogAccessSection info={selectedPlannerPlace?.dogAccess} />
          )}
          {facts.length > 0 && (
            <section className="visit-section">
              <h3>{detailFactsHeading}</h3>
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
          {showVisitorDetails && (
            <section className="visit-section visitor-info">
              <h3>Visit details</h3>
              <dl className="osm-detail-list">
                {shownVisitorDetails.map((detail) => (
                  <div key={detail.key}>
                    <dt>{osmDetailLabel(detail.key)}</dt>
                    <dd>{detail.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
          {website && (
            <div className="visitor-actions">
              <a href={website} target="_blank" rel="noreferrer">
                {visitorActionLabel}
              </a>
            </div>
          )}
          {import.meta.env.DEV && adminMode && isCurrentPlace && (
            <PlannerCurationControls
              projectId={pkg.project.id}
              projectName={pkg.project.name}
              featureId={feature.id}
              curation={plannerCuration}
              hasLocalDraft={hasLocalPlannerDraft}
              onToggle={toggleCuratedPlannerPlace}
              onDownload={() =>
                downloadPlannerCuration(pkg.project.id, pkg.project.name, plannerCuration)
              }
            />
          )}
          {isCurrentPlace &&
            !showVisitorDetails &&
            !hasSelectedPlannerVisitInfo &&
            facts.length === 0 && (
              <p className="source-notes">
                No opening hours or visitor notes are mapped for this place yet.
              </p>
            )}
        </>
      ) : (
        <EvidenceDetails isCurrentPlace={isCurrentPlace} />
      )}
    </aside>
  );
}

function PlannerSection({
  title,
  places,
  emptyText,
  category,
  showScore,
  onSelect,
  onHover,
}: {
  title: string;
  places: VisitPlace[];
  emptyText: string;
  category: VisitorNeed;
  showScore?: boolean;
  onSelect(place: VisitPlace): void;
  onHover(featureId?: string, source?: 'visitor-list'): void;
}) {
  const showPlannerCardDescription = true;
  return (
    <section className="planner-section">
      <h3>{title}</h3>
      {places.length ? (
        <ol>
          {places.map((place, index) => {
            const recommendation = showScore
              ? category === 'trails'
                ? trailRecommendation(place.visitorScore)
                : category === 'eat'
                  ? foodRecommendation(place.visitorScore)
                  : visitRecommendation(place.visitorScore)
              : undefined;
            const scoreClass = recommendation?.className ?? '';
            const placePills = plannerBadgesForPlace(place, {
              includeAdmission: category !== 'eat',
            });
            const parkingClass = category === 'parking' ? parkingPriceClass(place) : '';
            return (
              <li
                key={place.id}
                className={`planner-item ${category} ${scoreClass} ${parkingClass}`}
                onMouseEnter={() => onHover(place.id, 'visitor-list')}
                onMouseLeave={() => onHover(undefined)}
              >
                <button
                  type="button"
                  className={`planner-card ${category} ${scoreClass} ${parkingClass}`}
                  onClick={() => onSelect(place)}
                  onFocus={() => onHover(place.id, 'visitor-list')}
                  onBlur={() => onHover(undefined)}
                >
                  <span className="planner-rank" aria-hidden="true">
                    {place.rank ?? index + 1}
                  </span>
                  <span className="planner-card-heading">
                    <strong>{place.name}</strong>
                    {showScore && place.visitorScore !== undefined && (
                      <em className="planner-score">{formatVisitScore(place.visitorScore)}</em>
                    )}
                  </span>
                  {(recommendation || placePills.length > 0 || place.dogAccess !== undefined) && (
                    <span className="planner-card-badge-row">
                      {recommendation && (
                        <span className={`planner-recommendation ${scoreClass}`}>
                          {recommendation.label}
                        </span>
                      )}
                      {placePills.length > 0 && (
                        <span className="planner-card-pills" aria-label="Visitor badges">
                          {placePills.map((pill) => (
                            <em key={pill.label} className={pill.className} title={pill.label}>
                              {pill.label}
                            </em>
                          ))}
                        </span>
                      )}
                      <DogPawBadge info={place.dogAccess} />
                      {place.tagline && (
                        <span className={`planner-tagline ${category} ${scoreClass}`}>
                          {place.tagline}
                        </span>
                      )}
                    </span>
                  )}
                  <span className="planner-card-action" aria-hidden="true">
                    Details
                  </span>
                  {showPlannerCardDescription && place.reason && <small>{place.reason}</small>}
                </button>
              </li>
            );
          })}
        </ol>
      ) : (
        <p>{emptyText}</p>
      )}
    </section>
  );
}

function PlannerCurationControls({
  projectId,
  projectName,
  featureId,
  curation,
  hasLocalDraft,
  onToggle,
  onDownload,
}: {
  projectId: string;
  projectName: string;
  featureId: string;
  curation: PlannerCurationState;
  hasLocalDraft: boolean;
  onToggle(need: VisitorNeed, featureId: string): void;
  onDownload(): void;
}) {
  return (
    <section
      className="visit-section planner-curation-controls"
      aria-label="Admin planner curation"
    >
      <h3>Admin curation</h3>
      <p>
        Add this OSM pin to the curated visitor lists for {projectName}. Draft changes are saved
        locally until you export and promote them into the bundled app library.
      </p>
      <div className="planner-curation-chips">
        {curatablePlannerNeeds.map((need) => {
          const active = isCuratedForNeed(curation, need.id, featureId);
          return (
            <button
              key={need.id}
              type="button"
              className={active ? `active ${need.id}` : need.id}
              aria-pressed={active}
              onClick={() => onToggle(need.id, featureId)}
            >
              {active ? 'Remove from' : 'Add to'} {need.label}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className="planner-curation-download"
        onClick={onDownload}
        disabled={!hasLocalDraft && !Object.keys(curation).length}
      >
        Download {projectId} curation JSON
      </button>
    </section>
  );
}

function EvidenceDetails({ isCurrentPlace }: { isCurrentPlace: boolean }) {
  const feature = useExplorerStore((state) => state.selectedFeature);
  if (!feature) return null;
  const currentInfo = currentPlaceInfo(feature);

  return (
    <>
      {isCurrentPlace ? (
        <>
          {feature.evidenceScope === 'related_context' && (
            <p className="notice">
              This place is included as visitor context for the town guide. It is not counted in the
              historic heat score.
            </p>
          )}
          <dl className="current-place-meta source-summary">
            <dt>Kind</dt>
            <dd>{visitorPlaceType(feature)}</dd>
            <dt>Mapped as</dt>
            <dd>{feature.locationType.replaceAll('_', ' ')} point</dd>
            <dt>Listed by</dt>
            <dd>{currentInfo.curatedPlaceSource ? 'Reviewed visitor source' : 'OpenStreetMap'}</dd>
          </dl>
        </>
      ) : (
        <>
          <p className="date source-date">
            <span>Historic age note</span>
            {dateWording(feature)}
          </p>
          <dl className="source-summary">
            <dt>Protected as</dt>
            <dd>{feature.designationCategory ?? feature.designationType ?? 'Not designated'}</dd>
            <dt>Date note</dt>
            <dd>{feature.dateBasis.replaceAll('_', ' ')}</dd>
            <dt>Confidence</dt>
            <dd>{feature.dateConfidence}</dd>
            {feature.datePrecision && (
              <>
                <dt>Date precision</dt>
                <dd>{feature.datePrecision.replaceAll('_', ' ')}</dd>
              </>
            )}
            <dt>Mapped as</dt>
            <dd>{feature.locationType.replaceAll('_', ' ')} point</dd>
            <dt>Status</dt>
            <dd>{feature.reviewed ? 'Reviewed' : 'Unreviewed'}</dd>
          </dl>
        </>
      )}
      {feature.fullDescription && (
        <section className="evidence-section">
          <h3>Extra note</h3>
          <p>{feature.fullDescription}</p>
        </section>
      )}
      <h3>Where this came from</h3>
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
            !source.notes.startsWith('Current-place curation') &&
            !source.notes.startsWith('Current-context curation') && (
              <p className="source-notes">{source.notes}</p>
            )}
        </div>
      ))}
    </>
  );
}
