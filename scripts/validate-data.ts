import { publishedProjectPackages } from '../src/data/publishedProjects';
import { validateFeatures } from '../src/domain/validation';

const results = publishedProjectPackages.map((projectPackage) => {
  const validation = validateFeatures(projectPackage.project, projectPackage.features);
  return {
    project: projectPackage.project.id,
    records: projectPackage.features.length,
    validation,
  };
});
console.log(JSON.stringify(results, null, 2));
if (results.some((result) => result.validation.some((item) => item.severity === 'error')))
  process.exitCode = 1;
