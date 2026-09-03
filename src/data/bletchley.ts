import bletchleyData from '../../data/projects/bletchley-england.json';
import type { ProjectPackage } from '../domain/models';

export const bletchleyPackage = bletchleyData as unknown as ProjectPackage;
