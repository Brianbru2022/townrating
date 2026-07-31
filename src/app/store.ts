import { create } from 'zustand';
import type { HeritageFeature, HistoricMapLayer, ProjectPackage } from '../domain/models';
import { alloaPackage } from '../data/alloa';
import { withLocalMapReviews } from '../data/localMapReviews';
import { hasHistoricTimelineDate } from '../domain/timeline';

export type AppMode = 'explore' | 'sources' | 'methodology' | 'data-review';
interface ExplorerState {
  package: ProjectPackage;
  mode: AppMode;
  selectedFeature?: HeritageFeature;
  selectedYear: number;
  query: string;
  visibleTypes: string[];
  possible: boolean;
  settlementAge: boolean;
  showAreaPolygons: boolean;
  excludeUndated: boolean;
  demolished: boolean;
  activeMap?: HistoricMapLayer;
  showHesDesignations: boolean;
  showPublicArt: boolean;
  showPlaquesAndMemorials: boolean;
  showCurrentContext: boolean;
  showOsmFood: boolean;
  showOsmPicnic: boolean;
  showOsmArt: boolean;
  showOsmMemorials: boolean;
  showOsmHistoricPlaces: boolean;
  showOsmLeisure: boolean;
  showOsmVisitor: boolean;
  showOsmAmenities: boolean;
  showOsmParking: boolean;
  showOsmNature: boolean;
  showHistoricLegend: boolean;
  showOsmLegend: boolean;
  archaeologyOnly: boolean;
  communityLayersOnly: boolean;
  setPackage(projectPackage: ProjectPackage): void;
  setMode(mode: AppMode): void;
  setYear(year: number): void;
  selectFeature(feature?: HeritageFeature): void;
  setQuery(query: string): void;
  toggleType(type: string): void;
  setPossible(value: boolean): void;
  setSettlementAge(value: boolean): void;
  setShowAreaPolygons(value: boolean): void;
  setExcludeUndated(value: boolean): void;
  setDemolished(value: boolean): void;
  setActiveMap(map?: HistoricMapLayer): void;
  setShowHesDesignations(value: boolean): void;
  setShowPublicArt(value: boolean): void;
  setShowPlaquesAndMemorials(value: boolean): void;
  setShowCurrentContext(value: boolean): void;
  setShowOsmFood(value: boolean): void;
  setShowOsmPicnic(value: boolean): void;
  setShowOsmArt(value: boolean): void;
  setShowOsmMemorials(value: boolean): void;
  setShowOsmHistoricPlaces(value: boolean): void;
  setShowOsmLeisure(value: boolean): void;
  setShowOsmVisitor(value: boolean): void;
  setShowOsmAmenities(value: boolean): void;
  setShowOsmParking(value: boolean): void;
  setShowOsmNature(value: boolean): void;
  setShowHistoricLegend(value: boolean): void;
  setShowOsmLegend(value: boolean): void;
  setArchaeologyOnly(value: boolean): void;
  setCommunityLayersOnly(value: boolean): void;
}
export const useExplorerStore = create<ExplorerState>((set) => ({
  package: withLocalMapReviews(alloaPackage),
  mode: 'explore',
  selectedYear: 1900,
  query: '',
  visibleTypes: [],
  possible: true,
  settlementAge: true,
  showAreaPolygons: true,
  excludeUndated: false,
  demolished: false,
  showHesDesignations: false,
  showPublicArt: false,
  showPlaquesAndMemorials: false,
  showCurrentContext: false,
  showOsmFood: false,
  showOsmPicnic: false,
  showOsmArt: false,
  showOsmMemorials: false,
  showOsmHistoricPlaces: false,
  showOsmLeisure: false,
  showOsmVisitor: false,
  showOsmAmenities: false,
  showOsmParking: false,
  showOsmNature: false,
  showHistoricLegend: true,
  showOsmLegend: false,
  archaeologyOnly: false,
  communityLayersOnly: false,
  setPackage: (projectPackage) => {
    const packageWithReviews = withLocalMapReviews(projectPackage);
    set({
      package: packageWithReviews,
      selectedFeature: undefined,
      activeMap: undefined,
      showHesDesignations: false,
      showPublicArt: false,
      showPlaquesAndMemorials: false,
      showCurrentContext: false,
      showOsmFood: false,
      showOsmPicnic: false,
      showOsmArt: false,
      showOsmMemorials: false,
      showOsmHistoricPlaces: false,
      showOsmLeisure: false,
      showOsmVisitor: false,
      showOsmAmenities: false,
      showOsmParking: false,
      showOsmNature: false,
      showHistoricLegend: true,
      showOsmLegend: false,
      archaeologyOnly: false,
      communityLayersOnly: false,
      showAreaPolygons: true,
      query: '',
      visibleTypes: [],
      selectedYear: packageWithReviews.project.timelineEnd ?? new Date().getFullYear(),
    });
  },
  setMode: (mode) => set({ mode }),
  setYear: (selectedYear) => set({ selectedYear }),
  selectFeature: (selectedFeature) => set({ selectedFeature }),
  setQuery: (query) => set({ query }),
  toggleType: (type) =>
    set((state) => ({
      visibleTypes: state.visibleTypes.includes(type)
        ? state.visibleTypes.filter((item) => item !== type)
        : [...state.visibleTypes, type],
    })),
  setPossible: (possible) => set({ possible }),
  setSettlementAge: (settlementAge) => set({ settlementAge }),
  setShowAreaPolygons: (showAreaPolygons) => set({ showAreaPolygons }),
  setExcludeUndated: (excludeUndated) =>
    set((state) => ({
      excludeUndated,
      selectedFeature:
        excludeUndated && state.selectedFeature && !hasHistoricTimelineDate(state.selectedFeature)
          ? undefined
          : state.selectedFeature,
    })),
  setDemolished: (demolished) => set({ demolished }),
  setActiveMap: (activeMap) => set({ activeMap }),
  setShowHesDesignations: (showHesDesignations) => set({ showHesDesignations }),
  setShowPublicArt: (showPublicArt) => set({ showPublicArt }),
  setShowPlaquesAndMemorials: (showPlaquesAndMemorials) => set({ showPlaquesAndMemorials }),
  setShowCurrentContext: (showCurrentContext) => set({ showCurrentContext }),
  setShowOsmFood: (showOsmFood) => set({ showOsmFood }),
  setShowOsmPicnic: (showOsmPicnic) => set({ showOsmPicnic }),
  setShowOsmArt: (showOsmArt) => set({ showOsmArt }),
  setShowOsmMemorials: (showOsmMemorials) => set({ showOsmMemorials }),
  setShowOsmHistoricPlaces: (showOsmHistoricPlaces) => set({ showOsmHistoricPlaces }),
  setShowOsmLeisure: (showOsmLeisure) => set({ showOsmLeisure }),
  setShowOsmVisitor: (showOsmVisitor) => set({ showOsmVisitor }),
  setShowOsmAmenities: (showOsmAmenities) => set({ showOsmAmenities }),
  setShowOsmParking: (showOsmParking) => set({ showOsmParking }),
  setShowOsmNature: (showOsmNature) => set({ showOsmNature }),
  setShowHistoricLegend: (showHistoricLegend) => set({ showHistoricLegend }),
  setShowOsmLegend: (showOsmLegend) => set({ showOsmLegend }),
  setArchaeologyOnly: (archaeologyOnly) => set({ archaeologyOnly }),
  setCommunityLayersOnly: (communityLayersOnly) =>
    set(
      communityLayersOnly
        ? {
            communityLayersOnly,
            showPublicArt: true,
            showPlaquesAndMemorials: true,
            showOsmFood: true,
            showOsmPicnic: true,
            showOsmArt: true,
            showOsmMemorials: true,
            showOsmHistoricPlaces: true,
            showOsmLeisure: true,
            showOsmVisitor: true,
            showOsmAmenities: true,
            showOsmParking: true,
            showOsmNature: true,
          }
        : { communityLayersOnly },
    ),
}));
