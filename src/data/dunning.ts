import packageJson from '../../data/projects/dunning.json';
import type { ProjectPackage } from '../domain/models';

export const dunningPackage = packageJson as unknown as ProjectPackage;
