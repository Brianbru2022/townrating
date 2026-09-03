import oakhamData from '../../data/projects/oakham-england.json';
import type { ProjectPackage } from '../domain/models';

export const oakhamPackage = oakhamData as unknown as ProjectPackage;
