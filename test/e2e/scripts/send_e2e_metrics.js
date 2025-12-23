import { exit } from 'process';
import fs from 'fs';
import { InfluxDB, Point, HttpError, RequestTimedOutError } from '@influxdata/influxdb-client';
import { MERGED_RESULTS_FILEPATH } from '../wdio.conf.js';

const INFLUXDB_CONFIG = {
  token: process.env.EXTENSIONS_E2E_TEST_INFLUXDB_TOKEN,
  url: 'https://influxdb.quality.gitlab.net',
  org: 'gitlab-qa',
  bucket: 'extensions-e2e-test-results',
};

if (!INFLUXDB_CONFIG.token) {
  console.error(
    'Error: InfluxDB token is not set. Please set the EXTENSIONS_E2E_TEST_INFLUXDB_TOKEN environment variable.',
  );
  exit(1);
}

const client = new InfluxDB({ url: INFLUXDB_CONFIG.url, token: INFLUXDB_CONFIG.token });
const writeClient = client.getWriteApi(INFLUXDB_CONFIG.org, INFLUXDB_CONFIG.bucket, 'ns');

// Read the merged test results JSON file
if (!fs.existsSync(MERGED_RESULTS_FILEPATH)) {
  console.error(`Error: File ${MERGED_RESULTS_FILEPATH} does not exist.`);
  exit(1);
}

let suites;
try {
  const jsonData = JSON.parse(fs.readFileSync(MERGED_RESULTS_FILEPATH, 'utf8'));
  ({ suites = [] } = jsonData);
} catch (error) {
  console.error(`Error parsing JSON file ${MERGED_RESULTS_FILEPATH}: ${error.message}`);
  exit(1);
}

console.log(`Found ${suites.length} test suites which have test results.`);

const isMergeRequest = process.env.CI_MERGE_REQUEST_IID ? 'true' : 'false';

// Iterate through each test suite
suites.forEach(suite => {
  console.log(`Writing ${suite.tests.length} tests to InfluxDB for suite: "${suite.name}"`);

  suite.tests.forEach(test => {
    const point = new Point('test-results-vscode')
      .tag('suite', suite.name)
      .tag('name', test.name)
      .tag('result', test.state)
      .tag('job_name', 'test-e2e')
      .tag('merge_request', isMergeRequest)
      .tag('stage', 'create')
      .tag('product_group', 'editor_extensions')
      .intField('run_time', test.duration)
      .stringField('id', `${suite.name}_${test.name}`.replace(/ /g, '_'))
      .stringField('environment', 'gitlab.com')
      .stringField('job_url', process.env.CI_JOB_URL)
      .stringField('pipeline_url', process.env.CI_PIPELINE_URL)
      .stringField('pipeline_id', process.env.CI_PIPELINE_ID)
      .stringField('job_id', process.env.CI_JOB_ID)
      .stringField('failure_exception', test.error ? test.error.message : '')
      .timestamp(new Date(test.start));

    writeClient.writePoint(point);
  });
});

try {
  // Flushes pending writes to the server
  await writeClient.close();
} catch (error) {
  console.error('Error while writing to InfluxDB:');

  if (error instanceof HttpError) {
    console.error(`HTTP Error (${error.statusCode}): ${error.statusMessage}`);
  } else if (error instanceof RequestTimedOutError) {
    console.error(`Timeout Error: ${error.message}`);
  } else {
    console.error(`Unexpected Error: ${error.message}`);
    console.error(`Stack trace: ${error.stack}`);
  }
  exit(1);
}

console.log('Write to InfluxDB completed successfully.');
