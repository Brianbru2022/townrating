import packageJson from '../../data/projects/gourock.json';
import type { ProjectPackage } from '../domain/models';

export const gourockPackage = packageJson as unknown as ProjectPackage;
