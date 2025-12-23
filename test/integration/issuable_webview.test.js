const assert = require('assert');
const sinon = require('sinon');
const { graphql, HttpResponse } = require('msw');
const { issuableController } = require('../../src/desktop/issuable_controller');
const openIssueResponse = require('./fixtures/rest/open_issue.json');
const { projectWithIssueDiscussions, note2 } = require('./fixtures/graphql/discussions');

const { getServer, createJsonEndpoint } = require('./test_infrastructure/mock_server');
const { getRepositoryRoot } = require('./test_infrastructure/helpers');
const { WebviewMock } = require('./test_infrastructure/webview_mock');

describe('GitLab Issuable webview', () => {
  let server;
  let webviewMock;
  const sandbox = sinon.createSandbox();

  before(async () => {
    server = getServer([
      graphql.query('GetIssueDiscussions', ({ variables }) => {
        if (variables.namespaceWithPath === 'gitlab-org/gitlab')
          return HttpResponse.json({ data: projectWithIssueDiscussions });
        return HttpResponse.json({ data: { project: null } });
      }),
      graphql.mutation('CreateNote', ({ variables }) => {
        const { issuableId, body } = variables;
        if (issuableId === 'gid://gitlab/Issue/35284557' && body === 'Hello')
          return HttpResponse.json({
            data: {
              createNote: {
                errors: [],
                note: note2,
              },
            },
          });
        if (issuableId === 'gid://gitlab/Issue/35284557' && body === '/assign @testuser')
          return HttpResponse.json({
            data: {
              createNote: {
                errors: ['Commands only Added @testuser as assignee'],
              },
            },
          });
        return new HttpResponse(null, { status: 500 });
      }),
      createJsonEndpoint(
        `/projects/${openIssueResponse.project_id}/issues/${openIssueResponse.iid}/resource_label_events`,
        [],
      ),
    ]);
  });

  beforeEach(async () => {
    server.resetHandlers();
    webviewMock = new WebviewMock(sandbox);
    webviewMock.mockNextWebView();

    await issuableController.open(openIssueResponse, getRepositoryRoot());
  });

  afterEach(async () => {
    await webviewMock.webview.dispose();
    sandbox.restore();
  });

  after(async () => {
    server.close();
  });

  it('sends a message', async () => {
    webviewMock.postMessage({
      command: 'saveNote',
      note: 'Hello',
    });
    const sentMessage = await webviewMock.waitForMessage(m => m.type === 'noteSaved');
    assert.strictEqual(sentMessage.type, 'noteSaved');
    assert.strictEqual(sentMessage.status, undefined);
  });

  it('sends a message for slash-commands', async () => {
    webviewMock.postMessage({
      command: 'saveNote',
      note: '/assign @testuser',
    });
    const sentMessage = await webviewMock.waitForMessage(m => m.type === 'noteSaved');
    assert.strictEqual(sentMessage.type, 'noteSaved');
    assert.strictEqual(sentMessage.status, undefined);
  });

  it('adds the correct panel icon', () => {
    const { dark, light } = webviewMock.webview.iconPath;
    assert.match(dark.path, /src\/assets\/images\/dark\/issues.svg$/);
    assert.match(light.path, /src\/assets\/images\/light\/issues.svg$/);
  });

  it('substitutes the resource URLs in the HTML markup', () => {
    const resources = ['webviews/issuable/assets/app\\.js', 'webviews/issuable/assets/index\\.css'];
    resources.forEach(r => {
      assert.match(webviewMock.webview.webview.html, new RegExp(r, 'gm'));
    });
  });

  it('adds nonce to all script tags', () => {
    const allScriptTags = webviewMock.webview.webview.html.match(/<script/).length;
    const scriptTagsWithNonce =
      webviewMock.webview.webview.html.match(/<script nonce="\w+"/).length;
    assert.strictEqual(
      allScriptTags,
      scriptTagsWithNonce,
      'There are script tags without nonce in the index.html.',
    );
  });

  it('reveals existing panel instead of creating a new one', async () => {
    const revealSpy = sandbox.spy(webviewMock.webview, 'reveal');
    const samePanel = await issuableController.open(openIssueResponse, getRepositoryRoot());
    assert(revealSpy.called);
    assert.strictEqual(samePanel, webviewMock.webview);
  });

  it('creates a new panel if the previous one got disposed', async () => {
    const oldView = webviewMock.webview;

    webviewMock.webview.dispose();
    webviewMock = new WebviewMock(sandbox);
    webviewMock.mockNextWebView();
    const newPanel = await issuableController.open(openIssueResponse, getRepositoryRoot());

    assert.notStrictEqual(newPanel, oldView);
  });
});
