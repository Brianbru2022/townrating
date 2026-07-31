import { alloaPackage } from '../src/data/alloa';
import { validateFeatures } from '../src/domain/validation';

const validation = validateFeatures(alloaPackage.project, alloaPackage.features);
if (validation.some((item) => item.severity === 'error'))
  throw new Error('Seed data has validation errors.');
console.log(
  `Seed package ${alloaPackage.project.id} is valid. Load it with the SQL seed workflow in docker/init-db.sql.`,
);
