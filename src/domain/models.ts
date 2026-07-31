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
  sourceRecords: SourceRecord[];
  licence?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  reviewed: boolean;
  reviewNotes?: string;
  evidenceScope?: EvidenceScope;
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
