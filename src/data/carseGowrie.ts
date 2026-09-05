import type { ProjectPackage } from '../domain/models';
import elcho from '../../data/projects/elcho-perthshire.json';
import ballindean from '../../data/projects/ballindean.json';

/** Individually researched Carse of Gowrie locality packages, added sequentially. */
export const carseGowriePackages = [elcho, ballindean] as unknown as ProjectPackage[];
