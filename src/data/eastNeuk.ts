import type { ProjectPackage } from '../domain/models';
import anstruther from '../../data/projects/anstruther.json';
import cellardyke from '../../data/projects/cellardyke.json';
import crail from '../../data/projects/crail.json';
import earlsferry from '../../data/projects/earlsferry.json';
import elie from '../../data/projects/elie.json';
import kilconquhar from '../../data/projects/kilconquhar.json';
import kilrenny from '../../data/projects/kilrenny.json';
import pittenweem from '../../data/projects/pittenweem.json';
import stMonans from '../../data/projects/st-monans.json';

export const eastNeukPackages = [
  anstruther,
  cellardyke,
  crail,
  earlsferry,
  elie,
  kilconquhar,
  kilrenny,
  pittenweem,
  stMonans,
] as unknown as ProjectPackage[];
