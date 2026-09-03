import packageJson from '../../data/projects/callander.json';
import type { ProjectPackage } from '../domain/models';

export const callanderPackage = packageJson as unknown as ProjectPackage;
