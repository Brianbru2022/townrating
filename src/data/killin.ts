import packageJson from '../../data/projects/killin.json';
import type { ProjectPackage } from '../domain/models';

export const killinPackage = packageJson as unknown as ProjectPackage;
