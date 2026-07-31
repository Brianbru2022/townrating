import packageJson from '../../data/projects/biggar.json';
import type { ProjectPackage } from '../domain/models';

export const biggarPackage = packageJson as unknown as ProjectPackage;
