import corbyData from '../../data/projects/corby-england.json';
import type { ProjectPackage } from '../domain/models';

export const corbyPackage = corbyData as unknown as ProjectPackage;
