import packageJson from '../../data/projects/thrapston.json';
import type { ProjectPackage } from '../domain/models';

export const thrapstonPackage = packageJson as unknown as ProjectPackage;
