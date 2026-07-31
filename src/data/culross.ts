import packageJson from '../../data/projects/culross.json';
import type { ProjectPackage } from '../domain/models';

export const culrossPackage = packageJson as unknown as ProjectPackage;
