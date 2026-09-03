import packageJson from '../../data/projects/whitburn.json';
import type { ProjectPackage } from '../domain/models';

export const whitburnPackage = packageJson as unknown as ProjectPackage;
