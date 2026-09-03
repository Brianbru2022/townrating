import packageJson from '../../data/projects/livingston.json';
import type { ProjectPackage } from '../domain/models';

export const livingstonPackage = packageJson as unknown as ProjectPackage;
