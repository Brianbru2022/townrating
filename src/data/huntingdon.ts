import huntingdonData from '../../data/projects/huntingdon-england.json';
import type { ProjectPackage } from '../domain/models';

export const huntingdonPackage = huntingdonData as unknown as ProjectPackage;
