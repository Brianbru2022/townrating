import buckinghamData from '../../data/projects/buckingham-england.json';
import type { ProjectPackage } from '../domain/models';

export const buckinghamPackage = buckinghamData as unknown as ProjectPackage;
