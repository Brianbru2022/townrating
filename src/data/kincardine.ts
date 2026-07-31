import packageJson from '../../data/projects/kincardine.json';
import type { ProjectPackage } from '../domain/models';

export const kincardinePackage = packageJson as unknown as ProjectPackage;
