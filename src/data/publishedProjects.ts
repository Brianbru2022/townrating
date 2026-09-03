import type { ProjectPackage } from '../domain/models';
import { withDefaultTownRatingPolicy } from '../domain/townRating';
import { aberdeenNorthPackages } from './aberdeenNorth';
import { aberfoylePackage } from './aberfoyle';
import { alloaPackage } from './alloa';
import { alvaPackage } from './alva';
import { bathgatePackage } from './bathgate';
import { biggarPackage } from './biggar';
import { bridgeOfEarnPackage } from './bridgeOfEarn';
import { broxburnUphallPackage } from './broxburnUphall';
import { callanderPackage } from './callander';
import { cairnOMountPackages } from './cairnOMount';
import { culrossPackage } from './culross';
import { dunningPackage } from './dunning';
import { eastNeukPackages } from './eastNeuk';
import { eastNeukInlandPackages } from './eastNeukInland';
import { gourockPackage } from './gourock';
import { kincardinePackage } from './kincardine';
import { killinPackage } from './killin';
import { kirknewtonPackage } from './kirknewton';
import { linlithgowPackage } from './linlithgow';
import { livingstonPackage } from './livingston';
import { quarriersVillagePackage } from './quarriersVillage';
import { southQueensferryPackage } from './southQueensferry';
import { stAndrewsCoastPackages } from './stAndrewsCoast';
import { strathyrePackage } from './strathyre';
import { stonehavenCoastPackages } from './stonehavenCoast';
import { tillicoultryPackage } from './tillicoultry';
import { torphichenPackage } from './torphichen';
import { whitburnPackage } from './whitburn';
import { publishedPlannerCurationForProject } from './visitorPlannerCuration';

// Register every reviewed locality here so it remains available in the regional selector.
// Home town discovery independently filters this catalogue to settlement scores of 60+.
const rawPublishedProjectPackages: ProjectPackage[] = [
  ...aberdeenNorthPackages,
  aberfoylePackage,
  alloaPackage,
  alvaPackage,
  bathgatePackage,
  biggarPackage,
  bridgeOfEarnPackage,
  broxburnUphallPackage,
  callanderPackage,
  ...cairnOMountPackages,
  culrossPackage,
  dunningPackage,
  ...eastNeukPackages,
  ...eastNeukInlandPackages,
  gourockPackage,
  killinPackage,
  kincardinePackage,
  kirknewtonPackage,
  linlithgowPackage,
  livingstonPackage,
  quarriersVillagePackage,
  southQueensferryPackage,
  ...stAndrewsCoastPackages,
  ...stonehavenCoastPackages,
  strathyrePackage,
  tillicoultryPackage,
  torphichenPackage,
  whitburnPackage,
];

export const publishedProjectPackages: ProjectPackage[] = rawPublishedProjectPackages.map((pkg) =>
  withDefaultTownRatingPolicy(pkg, publishedPlannerCurationForProject(pkg.project.id)),
);
