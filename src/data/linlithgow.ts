import packageJson from '../../data/projects/linlithgow.json';
import type { ProjectPackage } from '../domain/models';

export const linlithgowPackage = packageJson as unknown as ProjectPackage;
