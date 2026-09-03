import wellingboroughData from '../../data/projects/wellingborough-england.json';
import type { ProjectPackage } from '../domain/models';

export const wellingboroughPackage = wellingboroughData as unknown as ProjectPackage;
