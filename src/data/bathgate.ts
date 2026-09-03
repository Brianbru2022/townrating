import packageJson from '../../data/projects/bathgate.json';
import type { ProjectPackage } from '../domain/models';

export const bathgatePackage = packageJson as unknown as ProjectPackage;
