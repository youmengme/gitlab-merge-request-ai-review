import { cleanBuild } from './utils/common_jobs.mjs';
import { ENVIRONMENTS } from './constants.mjs';

function main() {
  Object.values(ENVIRONMENTS).forEach(async env => {
    await cleanBuild(env);
  });
}

main();
