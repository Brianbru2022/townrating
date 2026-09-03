import desboroughData from '../../data/projects/desborough-england.json';
import type { ProjectPackage } from '../domain/models';

export const desboroughPackage = desboroughData as unknown as ProjectPackage;
