import packageJson from '../../data/projects/torphichen.json';
import type { ProjectPackage } from '../domain/models';

export const torphichenPackage = packageJson as unknown as ProjectPackage;
