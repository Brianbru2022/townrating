import northamptonData from '../../data/projects/northampton-england.json';
import type { ProjectPackage } from '../domain/models';

export const northamptonPackage = northamptonData as unknown as ProjectPackage;
