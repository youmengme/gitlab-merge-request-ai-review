const assert = require('assert');
const sinon = require('sinon');
const vscode = require('vscode');
const simpleGit = require('simple-git');
const { graphql, HttpResponse } = require('msw');
const { USER_COMMANDS } = require('../../src/desktop/command_names');
const {
  snippetsResponse,
  snippetWithOneBlobResponse,
  snippetWithTwoBlobsResponse,
} = require('./fixtures/graphql/snippets');
const { getServer } = require('./test_infrastructure/mock_server');
const { REMOTE } = require('./test_infrastructure/constants');
const {
  createAndOpenFile,
  closeAndDeleteFile,
  simulateQuickPickChoice,
  getRepositoryRoot,
  updateRepositoryStatus,
} = require('./test_infrastructure/helpers');

describe('Insert snippet', async () => {
  let server;
  let testFileUri;
  const sandbox = sinon.createSandbox();

  before(async () => {
    server = getServer([
      graphql.query('GetSnippetContent', ({ variables }) => {
        if (variables.snippetId === 'gid://gitlab/ProjectSnippet/111')
          return HttpResponse.json({ data: snippetWithOneBlobResponse });
        if (variables.snippetId === 'gid://gitlab/ProjectSnippet/222')
          return HttpResponse.json({ data: snippetWithTwoBlobsResponse });
        return HttpResponse.json({ data: { project: null } });
      }),
      graphql.query('GetSnippets', ({ variables }) => {
        if (variables.namespaceWithPath === 'gitlab-org/gitlab')
          return HttpResponse.json({ data: snippetsResponse });
        return HttpResponse.json({ data: { project: null } });
      }),
    ]);
  });

  beforeEach(async () => {
    server.resetHandlers();
    testFileUri = vscode.Uri.file(`${getRepositoryRoot()}/newfile.js`);
    await createAndOpenFile(testFileUri);
  });

  afterEach(async () => {
    const git = simpleGit(getRepositoryRoot());
    await git.removeRemote(REMOTE.NAME);
    await git.addRemote(REMOTE.NAME, REMOTE.URL);
    await updateRepositoryStatus();
    sandbox.restore();
    await closeAndDeleteFile(testFileUri);
  });

  after(async () => {
    server.close();
  });

  it('inserts snippet when there is only one blob', async () => {
    simulateQuickPickChoice(sandbox, 0);
    await vscode.commands.executeCommand(USER_COMMANDS.INSERT_SNIPPET);

    assert.strictEqual(vscode.window.activeTextEditor.document.getText(), 'snippet content');
  });

  it('inserts snippet when there are multiple blobs', async () => {
    simulateQuickPickChoice(sandbox, 1);
    await vscode.commands.executeCommand(USER_COMMANDS.INSERT_SNIPPET);

    assert.strictEqual(vscode.window.activeTextEditor.document.getText(), 'second blob content');
  });
});
