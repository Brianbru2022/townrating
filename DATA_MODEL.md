# Data model

`TownProject`, `HeritageFeature`, `SourceRecord`, `HistoricMapLayer`, `SettlementAgePolygon`, `ScoringMethodology`, and `ValidationResult` live in `src/domain/models.ts`. Dates are ranges with an explicit basis and confidence; a first-mapped date never becomes a construction date. Every published feature requires provenance and review state.
