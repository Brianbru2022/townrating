import { describe, expect, it } from 'vitest';
import pkg from '../../data/projects/bridge-of-dun.json';
import planner from '../../data/cairn-o-mount-visitor-planner-curation.json';
import dog from '../../data/cairn-o-mount-dog-access-curation.json';
import report from '../../data/review/bridge-of-dun-full-visitor-audit-2026-08-30.json';
import { visitorNeedPlaces } from '../domain/visitorExperience';
import { topVisitPlaces } from '../domain/visiting';
import { attractionPublicationIssues } from '../domain/visitorPublication';
import { homeTownOverviews } from '../map/homeOverview';

describe('Bridge of Dun full visitor audit', () => {
  const curation = (planner as any).projects['bridge-of-dun-scotland'];

  it('keeps the settlement selectable but off the home town map', () => {
    expect((pkg.project as any).touristAppeal).toMatchObject({ score:36, rating:0, label:'Minor Interest' });
    expect(homeTownOverviews([pkg as any])).toHaveLength(0);
    expect(report.publishOnTownMap).toBe(false);
  });

  it('publishes attraction-led visitor information without transferring it to the town score', () => {
    for (const highlight of (pkg.project as any).visitorHighlights) {
      expect(attractionPublicationIssues({ ...highlight, dogAccess:(dog as any).projects['bridge-of-dun-scotland'].attraction[highlight.featureId] })).toEqual([]);
    }
    expect(topVisitPlaces(pkg as any, 20).map((item) => item.name)).toEqual(['Caledonian Railway at Bridge of Dun']);
    expect(visitorNeedPlaces(pkg as any,'eat',20,{curatedFeatureIds:curation.eat})).toHaveLength(1);
    expect(visitorNeedPlaces(pkg as any,'trails',20,{curatedFeatureIds:curation.trails})).toHaveLength(1);
    expect(visitorNeedPlaces(pkg as any,'picnic',20,{curatedFeatureIds:curation.picnic})).toHaveLength(1);
    expect(visitorNeedPlaces(pkg as any,'parking',20,{curatedFeatureIds:curation.parking})).toHaveLength(1);
    expect(visitorNeedPlaces(pkg as any,'toilets',20,{curatedFeatureIds:curation.toilets})).toHaveLength(1);
    expect(report.publication).toEqual({see:1,eat:1,trails:1,picnic:1,parking:1,toilets:1});
  });

  it('restores both statutory HES records with construction periods and clean map names', () => {
    const statutory = (pkg.features as any[]).filter((feature) => feature.tags.includes('hes-listed-building'));
    expect(statutory).toHaveLength(2);
    expect(statutory.every((feature) => !feature.tags.includes('map-hidden'))).toBe(true);
    expect(statutory.every((feature) => feature.documentedDateText && feature.earliestPossibleYear != null && feature.latestPossibleYear != null)).toBe(true);
    expect(statutory.find((feature) => feature.id === 'hes-listed-building:LB4677')?.documentedDateText).toBe('1785–1787');
    expect(statutory.find((feature) => feature.id === 'hes-listed-building:LB6387')?.documentedDateText).toBe('designed 1935; K6 production from 1936');
    expect(statutory.every((feature) => !feature.name.includes(feature.documentedDateText))).toBe(true);
    expect(report.heritage).toMatchObject({visibleDatedStatutoryPins:2,visibleUndatedStatutoryPins:0,hiddenStatutoryPins:0});
  });

  it('records trail and practical limitations explicitly', () => {
    expect(report.namedTrailSearch.TreasureTrails).toContain('No dedicated Bridge of Dun product');
    expect(report.practicalAudit.parking).toContain('capacity is not published');
    expect(report.exclusions).toContain('House of Dun: beyond the strict settlement boundary and separately assessed');
  });
});
