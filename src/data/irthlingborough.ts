import irthlingboroughData from '../../data/projects/irthlingborough-england.json';
import type { ProjectPackage } from '../domain/models';

export const irthlingboroughPackage = irthlingboroughData as unknown as ProjectPackage;
