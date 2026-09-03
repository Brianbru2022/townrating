import packageJson from '../../data/projects/peterborough.json';
import type { ProjectPackage } from '../domain/models';

export const peterboroughPackage = packageJson as unknown as ProjectPackage;
