import packageJson from '../../data/projects/oundle.json';
import type { ProjectPackage } from '../domain/models';

export const oundlePackage = packageJson as unknown as ProjectPackage;
