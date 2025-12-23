const assert = require('assert');
const { EOL } = require('os');
const sinon = require('sinon');
const vscode = require('vscode');
const { http, HttpResponse } = require('msw');
const { USER_COMMANDS } = require('../../src/desktop/command_names');
const { fromMergedYamlUri } = require('../../src/desktop/ci/merged_yaml_uri');
const validCiLintResponse = require('./fixtures/rest/ci_lint_valid.json');
const invalidCiLintResponse = require('./fixtures/rest/ci_lint_invalid.json');
const { getServer } = require('./test_infrastructure/mock_server');
const { API_URL_PREFIX } = require('./test_infrastructure/constants');
const {
  createAndOpenFile,
  closeAndDeleteFile,
  getRepositoryRoot,
  insertTextIntoActiveEditor,
} = require('./test_infrastructure/helpers');

describe('CI Lint commands', async () => {
  let server;
  let testFileUri;
  const VALID_CI_CONFIG = [`test:`, `  stage: test`, `  script:`, `    - echo 1`].join([EOL]);
  const INVALID_CI_CONFIG = [`test:`, `  stage: test`, `  scccript:`, `    - echo 1`].join([EOL]);
  const sandbox = sinon.createSandbox();

  before(async () => {
    server = getServer([
      http.post(`${API_URL_PREFIX}/projects/278964/ci/lint`, async ({ request }) => {
        const body = await request.json();
        switch (body.content) {
          case VALID_CI_CONFIG:
            return HttpResponse.json(validCiLintResponse, { status: 200 });
          case INVALID_CI_CONFIG:
            return HttpResponse.json(invalidCiLintResponse, { status: 200 });
          default:
            return HttpResponse.text('No response for the config', { status: 500 });
        }
      }),
    ]);
  });

  beforeEach(async () => {
    server.resetHandlers();
    testFileUri = vscode.Uri.file(`${getRepositoryRoot()}/.gitlab-ci.yml`);
    await createAndOpenFile(testFileUri);
  });

  afterEach(async () => {
    sandbox.restore();
    await closeAndDeleteFile(testFileUri);
  });

  after(async () => {
    server.close();
  });

  describe('validateCiConfig', () => {
    it('shows info message for valid config', async () => {
      const informationMessageMock = sandbox
        .mock(vscode.window)
        .expects('showInformationMessage')
        .withArgs('GitLab Workflow: Your CI configuration is valid.')
        .resolves();
      await insertTextIntoActiveEditor(VALID_CI_CONFIG);

      await vscode.commands.executeCommand(USER_COMMANDS.VALIDATE_CI_CONFIG);

      informationMessageMock.verify();
    });

    it('shows error message for invalid config', async () => {
      const errorMessages = [];
      sandbox.stub(vscode.window, 'showErrorMessage').callsFake(async msg => {
        errorMessages.push(msg);
      });
      await insertTextIntoActiveEditor(INVALID_CI_CONFIG);

      await vscode.commands.executeCommand(USER_COMMANDS.VALIDATE_CI_CONFIG);

      assert.deepStrictEqual(errorMessages, [
        'GitLab Workflow: Invalid CI configuration.',
        'jobs:test config contains unknown keys: scccript',
      ]);
    });
  });

  describe('showMergedCiConfig', () => {
    it('opens a TextDocument', async () => {
      let openedUri;

      sandbox.stub(vscode.workspace, 'openTextDocument').callsFake(async msg => {
        openedUri = msg;
      });

      await insertTextIntoActiveEditor(VALID_CI_CONFIG);

      await vscode.commands.executeCommand(USER_COMMANDS.SHOW_MERGED_CI_CONFIG);

      const params = fromMergedYamlUri(openedUri);
      assert.strictEqual(params.initial, '# Merged YAML');
    });

    it('shows error message for invalid config', async () => {
      const errorMessages = [];
      sandbox.stub(vscode.window, 'showErrorMessage').callsFake(async msg => {
        errorMessages.push(msg);
      });
      await insertTextIntoActiveEditor(INVALID_CI_CONFIG);

      await vscode.commands.executeCommand(USER_COMMANDS.SHOW_MERGED_CI_CONFIG);

      assert.deepStrictEqual(errorMessages.length, 1);
    });
  });
});
