import packageJson from '../../data/projects/strathyre.json';
import type { ProjectPackage } from '../domain/models';

export const strathyrePackage = packageJson as unknown as ProjectPackage;
