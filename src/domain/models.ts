import type { Feature, Geometry, MultiPolygon, Point, Polygon } from 'geojson';

export type Reliability =
  | 'official_statutory'
  | 'official_non_statutory'
  | 'academic'
  | 'local_authority'
  | 'archival'
  | 'secondary'
  | 'discovery_only';
export type Confidence = 'high' | 'medium' | 'low' | 'unknown';
export type DateBasis =
  | 'documented_construction'
  | 'documented_date_range'
  | 'present_by'
  | 'first_mapped'
  | 'estimated_from_authoritative_source'
  | 'estimated_from_map_comparison'
  | 'unknown';
export type EvidenceScope = 'parish_evidence' | 'related_context' | 'out_of_scope';
export type Significance = 'highest_national' | 'national' | 'regional' | 'local' | 'recognised';
export type TouristAppealRating = 0 | 1 | 2 | 3;
export interface TouristAppeal {
  /** Canonical settlement tourism score. Public badges are derived from this 0-100 value. */
  score?: number;
  /** Town appeal for dog owners on the same 0-100 scale; it must never exceed score. */
  dogOwnerScore?: number;
  /** Dog access may reduce dogOwnerScore by up to three points, but must never increase it. */
  dogAccessScoreAdjustment?: number;
  rating: TouristAppealRating;
  label: string;
  summary?: string;
  /** Dog-access quality only; this paw scale is separate from destination appeal. */
  dogAccessRating?: TouristAppealRating;
  dogAccessSummary?: string;
  methodVersion?: string;
  reviewedAt?: string;
  sourceUrls?: string[];
}
export interface TownVisualIdentity {
  theme: string;
  badgeImage: string;
  badgeAlt: string;
  heroImage?: string;
  heroAlt?: string;
  heroObjectPosition?: string;
  motifs?: string[];
  primaryColour: string;
  accentColour: string;
  backgroundColour: string;
}
export interface TownGuide {
  /** A concise editorial description shown directly beneath the town name. */
  characterTag?: string;
  headline: string;
  intro: string;
  bestFor: string[];
  perfectFor?: string[];
  suggestedFirstVisit?: {
    title: string;
    summary: string;
  };
  dontMiss: string[];
  suggestedTime: string;
  visitorMood: string;
  currentAdvisory?: {
    title: string;
    summary: string;
    sourceUrl: string;
    linkLabel: string;
  };
  sourceUrls: string[];
  lastReviewedAt: string;
}
export interface AttractionGuideFoodOption {
  name: string;
  visitorScore: number;
  summary?: string;
  openingTimes?: string;
  priceBand?: string;
  externalUrl?: string;
}
export interface AttractionGuideActivity {
  name: string;
  summary?: string;
}
export interface AttractionGuideTrail {
  name: string;
  summary?: string;
  routeType?: string;
  distance?: string;
  duration?: string;
  difficulty?: string;
  /** Official or responsible-body route information for planning the walk. */
  externalUrl: string;
}
export interface AttractionGuide {
  /** Text-free editorial artwork used by standalone attraction guides on Home. */
  heroImage?: string;
  heroAlt?: string;
  heroObjectPosition?: string;
  /** Visitor-first copy for the standalone attraction guide pane. */
  headline?: string;
  intro?: string;
  motifs?: string[];
  bestFor?: string[];
  /** Confirmed parking provision at the attraction itself. */
  parking?: string;
  /** Confirmed toilets at the attraction itself, not nearby town facilities. */
  toilets?: string;
  /** Confirmed picnic provision at the attraction itself. */
  picnic?: string;
  /** Visitor-facing food status when no individually scored on-site option is listed. */
  foodNote?: string;
  /** Curated, scored food options available at the attraction itself. */
  food?: AttractionGuideFoodOption[];
  /** Named, source-backed walks available at or directly from the attraction. */
  trails?: AttractionGuideTrail[];
  /** The strongest on-site things to see or do, in visitor priority order. */
  thingsToDo?: AttractionGuideActivity[];
}
export type AttractionVisitability =
  | 'full_visitor_experience'
  | 'substantial_visible_remains'
  | 'fragmentary_remains'
  | 'earthworks_or_site'
  | 'no_visible_remains'
  | 'not_applicable';

export interface AttractionEditorialAssessment {
  experienceDepth: number;
  distinctiveness: number;
  presentation: number;
  journeyWorth: number;
  accessAndReliability: number;
  evidenceConfidence: number;
  visitability: AttractionVisitability;
}

export interface FoodEditorialAssessment {
  foodAndDrinkQuality: number;
  daytimeRelevance: number;
  distinctiveness: number;
  consistency: number;
  visitorFit: number;
  evidenceConfidence: number;
}

export interface EditorialRecordReview {
  status: 'editorially_researched';
  category: 'attraction' | 'food' | 'trail';
  /** Allows scores to be recalculated when the editorial method changes. */
  methodVersion: string;
  reviewedAt: string;
  /** Concise explanation of why the saved score is justified for visitors. */
  scoreRationale: string;
  /** Opened sources used for the assessment, not search-result snippets. */
  evidenceUrls: string[];
  /** Required for historic sites whose name does not establish what survives. */
  visitability?: AttractionVisitability;
  attractionAssessment?: AttractionEditorialAssessment;
  foodAssessment?: FoodEditorialAssessment;
}
export interface VisitorHighlight {
  rank: number;
  featureId: string;
  name: string;
  reason: string;
  tagline?: string;
  visitorScore?: number;
  timeToSpend?: string;
  openingTimes?: string;
  admission?: string;
  freeAdmission?: boolean;
  organisationPills?: string[];
  attractionGuide?: AttractionGuide;
  /** Explicitly remove an otherwise qualifying place from the national discovery map. */
  homeMapEligible?: boolean;
  /** Public planning page. Evidence/register URLs remain in sourceUrl/source records. */
  visitorWebsiteUrl?: string;
  /** Saved editorial sign-off for the public score and recommendation. */
  editorialReview?: EditorialRecordReview;
  sourceName: string;
  sourceUrl: string;
  verifiedInBoundaryAt: string;
}
export type FeatureType =
  | 'castle'
  | 'tower'
  | 'palace'
  | 'country_house'
  | 'manor_house'
  | 'church'
  | 'chapel'
  | 'cathedral'
  | 'monastery'
  | 'abbey'
  | 'burial_ground'
  | 'civic_building'
  | 'school'
  | 'hospital'
  | 'house'
  | 'tenement'
  | 'commercial_building'
  | 'market'
  | 'harbour'
  | 'dock'
  | 'canal'
  | 'railway'
  | 'bridge'
  | 'road'
  | 'street'
  | 'square'
  | 'park'
  | 'garden'
  | 'designed_landscape'
  | 'brewery'
  | 'distillery'
  | 'mill'
  | 'mine'
  | 'quarry'
  | 'foundry'
  | 'factory'
  | 'warehouse'
  | 'military_site'
  | 'archaeological_site'
  | 'public_art'
  | 'plaque'
  | 'monument'
  | 'memorial'
  | 'demolished_site'
  | 'other';

export interface SourceRecord {
  sourceName: string;
  sourceOrganisation: string;
  sourceRecordId?: string;
  sourceUrl?: string;
  accessedAt: string;
  licence?: string;
  quotedDateText?: string;
  notes?: string;
  reliability: Reliability;
}

export interface HeritageFeature {
  id: string;
  projectId: string;
  name: string;
  alternativeNames: string[];
  countryCode: string;
  region?: string;
  locality?: string;
  address?: string;
  featureType: FeatureType | string;
  designationType?: string;
  designationCategory?: string;
  significance?: Significance;
  statutoryStatus?: string;
  geometry?: Geometry | null;
  /** Additional official point locations for one designation; these share the same record and are not duplicates. */
  additionalPointLocations?: Point[];
  locationType:
    | 'exact'
    | 'building_centroid'
    | 'site_centroid'
    | 'representative_point'
    | 'approximate'
    | 'unknown'
    | string;
  documentedDateText?: string;
  earliestPossibleYear?: number;
  latestPossibleYear?: number;
  /** How precisely the cited date can be interpreted (for example, exact year or century range). */
  datePrecision?: string;
  dateBasis: DateBasis;
  dateConfidence: Confidence;
  locationConfidence: Confidence;
  survival?:
    | 'substantially_intact'
    | 'altered_recognisable'
    | 'heavily_altered'
    | 'site_only_or_demolished'
    | 'unknown';
  shortDescription?: string;
  fullDescription?: string;
  /** Normalised key=value facts for researched current visitor places. */
  details?: string;
  sourceRecords: SourceRecord[];
  licence?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  reviewed: boolean;
  reviewNotes?: string;
  evidenceScope?: EvidenceScope;
  /** Optional visitor guide for a specific attraction, including on-site facilities. */
  attractionGuide?: AttractionGuide;
  /** Explicitly remove an otherwise qualifying place from the national discovery map. */
  homeMapEligible?: boolean;
  /** Public planning page; evidence and map URLs stay in sourceRecords. */
  visitorWebsiteUrl?: string;
  /** Saved editorial sign-off for public scores on feature-backed cards. */
  editorialReview?: EditorialRecordReview;
}

export interface HistoricMapLayer {
  id: string;
  projectId: string;
  title: string;
  displayDate: string;
  surveyStartYear?: number;
  surveyEndYear?: number;
  revisionYear?: number;
  publicationYear?: number;
  sourceInstitution: string;
  sourceUrl?: string;
  licence?: string;
  attribution: string;
  notes?: string;
  layerType: 'xyz' | 'wmts' | 'wms' | 'georeferenced_raster_tiles' | 'cog' | 'four_corner_image';
  tileUrl?: string;
  wmsParameters?: Record<string, string>;
  localPath?: string;
  bounds?: [number, number, number, number];
  opacity: number;
  minZoom?: number;
  maxZoom?: number;
  georeferencingMethod?: string;
  georeferencingAccuracy?: Confidence;
  controlPointCount?: number;
  residualError?: number;
}

export interface SettlementAgePolygon {
  id: string;
  projectId: string;
  geometry: Polygon | MultiPolygon;
  earliestEvidenceYear?: number;
  latestEvidenceYear?: number;
  category:
    | 'developed_by_1700'
    | 'developed_by_1800'
    | 'developed_by_1850'
    | 'developed_by_1900'
    | 'developed_by_1930'
    | 'developed_by_1960'
    | 'post_1960'
    | 'uncertain';
  evidenceMapIds: string[];
  evidenceDescription: string;
  confidence: Exclude<Confidence, 'unknown'>;
  digitisationMethod: string;
  sourceRecords: SourceRecord[];
  reviewed: boolean;
}

export interface DataSourceDefinition {
  id: string;
  name: string;
  organisation: string;
  coverage: string;
  accessMethod: string;
  licence?: string;
  sourceUrl?: string;
  reliability: Reliability;
  limitations?: string;
}

export interface TownProject {
  id: string;
  name: string;
  countryCode: string;
  country: string;
  region?: string;
  locality: string;
  centre: [number, number];
  boundary: Feature<Polygon | MultiPolygon>;
  boundarySource: string;
  boundaryConfidence: Confidence;
  sourceLanguage: string;
  preferredBasemap: string;
  createdAt: string;
  timelineStart?: number;
  timelineEnd?: number;
  methodology: ScoringMethodology;
  researchNotes?: string;
  touristAppeal?: TouristAppeal;
  visualIdentity?: TownVisualIdentity;
  townGuide?: TownGuide;
  visitorHighlights?: VisitorHighlight[];
  /**
   * A modern statistical locality used only to make a transparent town-level
   * statutory-register extract. It never replaces the project's study boundary.
   */
  townStudyArea?: TownStudyArea;
}

export interface TownStudyArea {
  localityName: string;
  localityCode?: string;
  sourceName: string;
  sourceUrl: string;
  sourceVersion: string;
  bufferMetres: number;
  localityBoundary: Feature<Polygon | MultiPolygon>;
  bufferedBoundary: Feature<Polygon | MultiPolygon>;
  /**
   * Optional visitor-facing boundary for directly adjoining places that are
   * experienced as part of the town but fall beyond the statistical locality.
   * The original locality boundary remains unchanged for provenance.
   */
  visitorBoundary?: Feature<Polygon | MultiPolygon>;
  notes: string;
}

export interface ScoringMethodology {
  age: Record<string, number>;
  significance: Record<Significance, number>;
  confidence: Record<Confidence, number>;
  survival: Record<NonNullable<HeritageFeature['survival']>, number>;
}

export interface ValidationResult {
  recordId: string;
  severity: 'error' | 'warning';
  field?: string;
  message: string;
}

export interface ImportedPackMetadata {
  datasetId: string;
  title: string;
  importedAt: string;
  historicMapCatalogue?: Array<Record<string, unknown>>;
  settlementEvidence?: Array<Record<string, unknown>>;
  methodology?: Record<string, unknown>;
  licensingAndAttribution?: Record<string, unknown>;
}
export interface ProjectPackage {
  project: TownProject;
  features: HeritageFeature[];
  sources: DataSourceDefinition[];
  historicMaps: HistoricMapLayer[];
  settlementPolygons: SettlementAgePolygon[];
  validation: ValidationResult[];
  curationMetadata?: { importedPacks: ImportedPackMetadata[] };
}
