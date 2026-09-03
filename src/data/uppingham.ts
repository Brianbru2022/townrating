import uppinghamData from '../../data/projects/uppingham-england.json';
import type { ProjectPackage } from '../domain/models';

export const uppinghamPackage = uppinghamData as unknown as ProjectPackage;
