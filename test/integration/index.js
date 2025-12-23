const path = require('path');
const Mocha = require('mocha');
// glob is available in the VS Code runtime
const { glob } = require('glob');
const { initializeTestEnvironment } = require('./test_infrastructure/initialize_test_environment');
const { validateTestEnvironment } = require('./test_infrastructure/validate_test_environment');

const getAllTestFiles = testsRoot => glob.glob('**/**.test.js', { cwd: testsRoot });

async function run(testsRoot) {
  require('source-map-support').install(); // eslint-disable-line global-require

  try {
    validateTestEnvironment();

    // Create the mocha test
    const mocha = new Mocha();
    mocha.timeout(3000);
    mocha.color(true);

    const files = await getAllTestFiles(testsRoot);

    // Add files to the test suite
    files.forEach(f => mocha.addFile(path.resolve(testsRoot, f)));

    // Initialize VS Code environment for integration tests
    await initializeTestEnvironment(testsRoot);

    // Run the mocha test
    await new Promise((res, rej) =>
      // eslint-disable-next-line no-promise-executor-return
      mocha.run(failures => {
        if (failures) {
          rej(failures);
        } else {
          res();
        }
      }),
    );
  } catch (e) {
    // temporary fix for https://github.com/microsoft/vscode/issues/123882
    console.error(e);
    throw e;
  }
}

module.exports = { run };
