import type { DataSourceDefinition, HeritageFeature, TownProject } from '../domain/models';

export interface CountryAdapter {
  countryCode: string;
  countryName: string;
  availableSources: DataSourceDefinition[];
  discoverSources(project: TownProject): Promise<DataSourceDefinition[]>;
  normaliseRecord(record: unknown, projectId: string): HeritageFeature;
  dateTerminology: Record<string, string>;
  designationTerminology: Record<string, string>;
}

const baseSources: DataSourceDefinition[] = [
  {
    id: 'hes',
    name: 'Historic Environment Scotland',
    organisation: 'Historic Environment Scotland',
    coverage: 'Scotland',
    accessMethod: 'documented manual/API import',
    reliability: 'official_statutory',
    sourceUrl: 'https://www.historicenvironment.scot/',
  },
  {
    id: 'canmore',
    name: 'Canmore / NRHE',
    organisation: 'Historic Environment Scotland',
    coverage: 'Scotland',
    accessMethod: 'documented manual/API import',
    reliability: 'official_non_statutory',
    sourceUrl: 'https://canmore.org.uk/',
  },
  {
    id: 'nls',
    name: 'National Library of Scotland maps',
    organisation: 'National Library of Scotland',
    coverage: 'Scotland',
    accessMethod: 'WMS/WMTS where licensed',
    reliability: 'archival',
    sourceUrl: 'https://maps.nls.uk/',
  },
];
function normalise(record: unknown, projectId: string): HeritageFeature {
  return { ...(record as Omit<HeritageFeature, 'projectId'>), projectId };
}
export const scotlandAdapter: CountryAdapter = {
  countryCode: 'GB-SCT',
  countryName: 'Scotland',
  availableSources: baseSources,
  discoverSources: async () => baseSources,
  normaliseRecord: normalise,
  dateTerminology: { present_by: 'Present by' },
  designationTerminology: { highest_national: 'Category A' },
};
export const genericAdapter: CountryAdapter = {
  countryCode: '*',
  countryName: 'Generic international',
  availableSources: [],
  discoverSources: async () => [],
  normaliseRecord: normalise,
  dateTerminology: { present_by: 'Present by' },
  designationTerminology: {},
};
export function adapterFor(countryCode: string): CountryAdapter {
  return countryCode === 'GB-SCT' ? scotlandAdapter : genericAdapter;
}
