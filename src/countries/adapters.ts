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
const englandSources: DataSourceDefinition[] = [
  {
    id: 'historic-england-nhle',
    name: 'National Heritage List for England',
    organisation: 'Historic England',
    coverage: 'England',
    accessMethod: 'local national dataset import',
    reliability: 'official_statutory',
    sourceUrl: 'https://historicengland.org.uk/listing/the-list/data-downloads/',
  },
  {
    id: 'ons-built-up-areas-2024',
    name: 'Built-up Areas (December 2024)',
    organisation: 'Office for National Statistics',
    coverage: 'England and Wales',
    accessMethod: 'ArcGIS Feature Service',
    reliability: 'official_statutory',
    sourceUrl:
      'https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/main_ONS_BUA_2024_EW_V2/FeatureServer',
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
export const englandAdapter: CountryAdapter = {
  countryCode: 'GB-ENG',
  countryName: 'England',
  availableSources: englandSources,
  discoverSources: async () => englandSources,
  normaliseRecord: normalise,
  dateTerminology: { present_by: 'Present by' },
  designationTerminology: {
    highest_national: 'Grade I / scheduled monument',
    national: 'Grade II*',
  },
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
  if (countryCode === 'GB-SCT') return scotlandAdapter;
  if (countryCode === 'GB-ENG') return englandAdapter;
  return genericAdapter;
}
