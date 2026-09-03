import { afterEach, describe, expect, it } from 'vitest';
import { defaultCurrentOsmVisibility, useExplorerStore } from './store';

function resetMapAdminState() {
  useExplorerStore.setState({
    adminMode: false,
    showOsmPoints: false,
    showOsmLegend: false,
    ...defaultCurrentOsmVisibility,
  });
}

describe('explorer store admin mode', () => {
  afterEach(resetMapAdminState);

  it('turns on all OSM visitor icon categories and the OSM legend', () => {
    useExplorerStore.setState({
      showOsmPoints: false,
      showOsmLegend: false,
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
    });

    useExplorerStore.getState().setAdminMode(true);

    expect(useExplorerStore.getState()).toMatchObject({
      adminMode: true,
      showOsmPoints: true,
      showOsmLegend: true,
      ...defaultCurrentOsmVisibility,
    });
  });

  it('lets admins turn individual OSM icon categories off after enabling admin mode', () => {
    useExplorerStore.getState().setAdminMode(true);

    useExplorerStore.getState().setShowOsmFood(false);

    expect(useExplorerStore.getState()).toMatchObject({
      adminMode: true,
      showOsmFood: false,
      showOsmParking: true,
      showOsmLegend: true,
    });
  });

  it('turns raw OSM visitor pins and the OSM legend off again when admin mode is disabled', () => {
    useExplorerStore.getState().setAdminMode(true);

    useExplorerStore.getState().setAdminMode(false);

    expect(useExplorerStore.getState()).toMatchObject({
      adminMode: false,
      showOsmPoints: false,
      showOsmLegend: false,
    });
  });

  it('keeps all raw OSM visitor pins available across town changes while admin mode is on', () => {
    const projectPackage = useExplorerStore.getState().package;
    useExplorerStore.getState().setAdminMode(true);

    useExplorerStore.getState().setPackage(projectPackage);

    expect(useExplorerStore.getState()).toMatchObject({
      adminMode: true,
      showOsmPoints: true,
      showOsmLegend: true,
      ...defaultCurrentOsmVisibility,
    });
  });
});
