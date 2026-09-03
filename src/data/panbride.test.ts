import audit from '../../data/review/panbride-full-visitor-audit-2026-08-30.json';
import project from '../../data/projects/panbride.json';
import { describe,expect,it } from 'vitest';
import { homeTownOverviews } from '../map/homeOverview';
import { visitorNeedPlaces } from '../domain/visitorExperience';
import { publishedPlannerCurationForProject } from './visitorPlannerCuration';

describe('Panbride full visitor audit',()=>{
 it('keeps the hamlet selector-only despite two nearby visitor assets',()=>{expect(project.project.touristAppeal?.score).toBe(54);expect(homeTownOverviews([project as any])).toHaveLength(0);expect(project.project.touristAppeal?.summary).toContain('without a café');});
 it('retains every heritage record and maps only locally relevant dated records',()=>{const h=project.features.filter(f=>f.id.startsWith('hes-')||f.id.startsWith('nrhe:'));const v=h.filter(f=>!f.tags.includes('map-hidden'));expect(h).toHaveLength(20);expect(v).toHaveLength(11);expect(v.every(f=>f.documentedDateText&&f.earliestPossibleYear!=null&&f.latestPossibleYear!=null&&!f.name.includes(f.documentedDateText))).toBe(true);expect(audit.heritage).toMatchObject({totalRecordsRetained:20,visibleDatedHeritagePins:11,visibleUndatedHeritagePins:0,mapHiddenRecords:9});});
 it('publishes the verified sights and council trail without inventing practical facilities',()=>{expect(audit.publication).toEqual({see:2,eat:0,trails:1,picnic:0,parking:0,toilets:0});expect(visitorNeedPlaces(project as any,'see',10,{curatedFeatureIds:project.project.visitorHighlights.map(x=>x.featureId)})).toHaveLength(2);expect(publishedPlannerCurationForProject(project.project.id)).toEqual({eat:[],trails:['curated-trails:craigmill-den-panbride'],picnic:[],parking:[],toilets:[]});expect(visitorNeedPlaces(project as any,'trails',10,{curatedFeatureIds:['curated-trails:craigmill-den-panbride']})).toHaveLength(1);});
});
