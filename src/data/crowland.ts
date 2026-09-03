import crowlandData from '../../data/projects/crowland-england.json';
import type { ProjectPackage } from '../domain/models';

export const crowlandPackage = crowlandData as unknown as ProjectPackage;
