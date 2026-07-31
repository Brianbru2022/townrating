import packageJson from '../../data/projects/tillicoultry.json';
import type { ProjectPackage } from '../domain/models';

export const tillicoultryPackage = packageJson as unknown as ProjectPackage;
