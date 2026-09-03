import stamfordData from '../../data/projects/stamford-england.json';
import type { ProjectPackage } from '../domain/models';

export const stamfordPackage = stamfordData as unknown as ProjectPackage;
