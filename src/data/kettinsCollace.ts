import type { ProjectPackage } from '../domain/models';
import couparAngus from '../../data/projects/coupar-angus.json';
import kettins from '../../data/projects/kettins.json';
import markethill from '../../data/projects/markethill-kettins.json';
import hallyburtonHouse from '../../data/projects/hallyburton-house.json';
import leys from '../../data/projects/leys-kettins.json';
import pitcur from '../../data/projects/pitcur.json';
import campmuir from '../../data/projects/campmuir.json';
import woodside from '../../data/projects/woodside-burrelton.json';
import burrelton from '../../data/projects/burrelton.json';
import saucher from '../../data/projects/saucher.json';
import collace from '../../data/projects/collace.json';
import kirktonOfCollace from '../../data/projects/kirkton-of-collace.json';
import bandirran from '../../data/projects/bandirran.json';
import abernyte from '../../data/projects/abernyte.json';
import rossiePriory from '../../data/projects/rossie-priory.json';
import knapp from '../../data/projects/knapp.json';
import littleton from '../../data/projects/littleton-inchture.json';
import lundie from '../../data/projects/lundie.json';

/** Sequential Kettins-parish and neighbouring Perthshire micro-locality audit. */
export const kettinsCollacePackages = [
  couparAngus, kettins, markethill, hallyburtonHouse, leys, pitcur, campmuir,
  woodside, burrelton, saucher, collace, kirktonOfCollace, bandirran, abernyte,
  rossiePriory, knapp, littleton, lundie,
] as unknown as ProjectPackage[];
