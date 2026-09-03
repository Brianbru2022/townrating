import packageJson from '../../data/projects/sawtry.json';
import type { ProjectPackage } from '../domain/models';

export const sawtryPackage = packageJson as unknown as ProjectPackage;
