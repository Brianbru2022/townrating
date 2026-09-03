import packageJson from '../../data/projects/kirriemuir.json';
import type { ProjectPackage } from '../domain/models';

export const kirriemuirPackage = packageJson as unknown as ProjectPackage;
