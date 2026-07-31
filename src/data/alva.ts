import packageJson from '../../data/projects/alva.json';
import type { ProjectPackage } from '../domain/models';

export const alvaPackage = packageJson as unknown as ProjectPackage;
