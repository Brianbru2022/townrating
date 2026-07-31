import packageJson from '../../data/projects/alloa.json';
import type { ProjectPackage } from '../domain/models';

// Populate data/projects/alloa.json with reviewed source-backed records, then rebuild/seed.
export const alloaPackage = packageJson as unknown as ProjectPackage;
