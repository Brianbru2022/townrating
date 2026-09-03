import ketteringData from '../../data/projects/kettering-england.json';
import type { ProjectPackage } from '../domain/models';

export const ketteringPackage = ketteringData as unknown as ProjectPackage;
