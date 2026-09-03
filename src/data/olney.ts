import olneyData from '../../data/projects/olney-england.json';
import type { ProjectPackage } from '../domain/models';

export const olneyPackage = olneyData as unknown as ProjectPackage;
