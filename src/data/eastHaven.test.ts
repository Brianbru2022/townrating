import audit from '../../data/review/east-haven-full-visitor-audit-2026-08-30.json';
import project from '../../data/projects/east-haven.json';
import { describe, expect, it } from 'vitest';
import { homeTownOverviews } from '../map/homeOverview';
import { visitorNeedPlaces } from '../domain/visitorExperience';
import { publishedPlannerCurationForProject } from './visitorPlannerCuration';

describe('East Haven full visitor audit',()=>{
  it('publishes the independently worthwhile village in the 60–69 band',()=>{
    expect(project.project.touristAppeal?.score).toBe(68);
    expect(project.project.touristAppeal?.methodVersion).toBe('2026-08-30-strict-settlement-full-audit-v3');
    expect(homeTownOverviews([project as any])).toHaveLength(1);
    expect(project.project.touristAppeal?.summary).toContain('lack of café');
  });
  it('retains every local heritage record and maps only dated records',()=>{
    const heritage=project.features.filter(f=>f.id.startsWith('hes-')||f.id.startsWith('nrhe:'));
    const visible=heritage.filter(f=>!f.tags.includes('map-hidden'));
    expect(heritage).toHaveLength(16); expect(visible).toHaveLength(8);
    expect(visible.every(f=>f.documentedDateText&&f.earliestPossibleYear!=null&&f.latestPossibleYear!=null&&!f.name.includes(f.documentedDateText))).toBe(true);
    expect(audit.heritage).toMatchObject({totalRecordsRetained:16,visibleDatedHeritagePins:8,visibleUndatedHeritagePins:0,mapHiddenRecords:8});
  });
  it('publishes verified coastal and practical categories without inventing food',()=>{
    expect(audit.publication).toEqual({see:2,eat:0,trails:1,picnic:1,parking:1,toilets:1});
    expect(publishedPlannerCurationForProject(project.project.id)).toMatchObject({eat:[],trails:['curated-trails:east-haven-coastal-path'],picnic:['curated-picnic:east-haven-beach'],parking:['curated-parking:east-haven-beach'],toilets:['curated-toilets:east-haven-beach']});
    expect(visitorNeedPlaces(project as any,'trails',10,{curatedFeatureIds:['curated-trails:east-haven-coastal-path']})).toHaveLength(1);
    expect(audit.practicalAudit.parking).toContain('no count is invented');
    expect(audit.namedTrailSearch.retained).toEqual(['curated-trails:east-haven-coastal-path']);
  });
});
