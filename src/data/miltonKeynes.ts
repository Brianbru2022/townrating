import miltonKeynesData from '../../data/projects/milton-keynes-england.json';
import type { ProjectPackage } from '../domain/models';

export const miltonKeynesPackage = miltonKeynesData as unknown as ProjectPackage;
