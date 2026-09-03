import type { ProjectPackage } from '../domain/models';
import abercrombie from '../../data/projects/abercrombie-fife.json';
import ardross from '../../data/projects/ardross-fife.json';
import arncroach from '../../data/projects/arncroach.json';
import balchrystie from '../../data/projects/balchrystie.json';
import carnbee from '../../data/projects/carnbee.json';
import colinsburgh from '../../data/projects/colinsburgh.json';
import kingsmuir from '../../data/projects/kingsmuir-fife.json';
import largoward from '../../data/projects/largoward.json';
import lathones from '../../data/projects/lathones.json';
import lochty from '../../data/projects/lochty-fife.json';
import pitcorthie from '../../data/projects/pitcorthie-kilrenny.json';
import pitkierie from '../../data/projects/pitkierie.json';
import radernie from '../../data/projects/radernie.json';

export const eastNeukInlandPackages = [
  pitcorthie,
  pitkierie,
  ardross,
  balchrystie,
  abercrombie,
  arncroach,
  carnbee,
  colinsburgh,
  kingsmuir,
  lochty,
  radernie,
  lathones,
  largoward,
] as unknown as ProjectPackage[];
