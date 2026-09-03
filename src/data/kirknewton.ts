import packageJson from '../../data/projects/kirknewton.json';
import type { ProjectPackage } from '../domain/models';

export const kirknewtonPackage = packageJson as unknown as ProjectPackage;
