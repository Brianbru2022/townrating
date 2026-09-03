import rushdenData from '../../data/projects/rushden-england.json';
import type { ProjectPackage } from '../domain/models';

export const rushdenPackage = rushdenData as unknown as ProjectPackage;
