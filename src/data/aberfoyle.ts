import packageJson from '../../data/projects/aberfoyle.json';
import type { ProjectPackage } from '../domain/models';

export const aberfoylePackage = packageJson as unknown as ProjectPackage;
