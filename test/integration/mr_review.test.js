const assert = require('assert');
const sinon = require('sinon');
const vscode = require('vscode');
const { graphql, HttpResponse } = require('msw');

const { IssuableDataProvider } = require('../../src/desktop/tree_view/issuable_data_provider');
const { MrItemModel } = require('../../src/desktop/tree_view/items/mr_item_model');
const { submitEdit, createComment } = require('../../src/desktop/commands/mr_discussion_commands');
const { toReviewUri } = require('../../src/desktop/review/review_uri');
const { getProjectRepository } = require('../../src/desktop/gitlab/gitlab_project_repository');
const { ReviewFileSystem } = require('../../src/desktop/review/review_file_system');
const { getExtensionStateSingleton } = require('../../src/desktop/extension_state');
const openMergeRequestResponse = require('./fixtures/rest/open_mr.json');
const versionsResponse = require('./fixtures/rest/versions.json');
const versionResponse = require('./fixtures/rest/mr_version.json');
const diffNote = require('./fixtures/rest/diff_note.json');
const {
  projectWithMrDiscussions,
  noteOnDiff,
  discussionOnDiff,
} = require('./fixtures/graphql/discussions');
const mrPermissionsResponse = require('./fixtures/graphql/mr_permissions.json');
const {
  getServer,
  createJsonEndpoint,
  createQueryTextEndpoint,
} = require('./test_infrastructure/mock_server');
const { getRepositoryRoot } = require('./test_infrastructure/helpers');

describe('MR Review', () => {
  let server;
  let dataProvider;
  let mrItemModel;

  before(async () => {
    server = getServer([
      createJsonEndpoint('/projects/278964/merge_requests/33824/versions', versionsResponse),
      createJsonEndpoint('/projects/278964/merge_requests/33824/notes/469379582', diffNote), // TODO remove
      createJsonEndpoint(
        '/projects/278964/merge_requests/33824/versions/127919672',
        versionResponse,
      ),
      createQueryTextEndpoint(`/projects/278964/repository/files/src%2Ftest.js/raw`, {
        '?ref=1f0fa02de1f6b913d674a8be10899fb8540237a9': 'Old Version',
        '?ref=b6d6f6fd17b52b8cf4e961218c572805e9aa7463': 'New Version',
      }),
      graphql.query('GetMrDiscussions', ({ variables }) => {
        if (variables.namespaceWithPath === 'gitlab-org/gitlab' && variables.iid === '33824')
          return HttpResponse.json({ data: projectWithMrDiscussions });
        return HttpResponse.json({ data: { project: null } });
      }),
      graphql.query('GetMrPermissions', ({ variables }) => {
        if (variables.namespaceWithPath === 'gitlab-org/gitlab' && variables.iid === '33824')
          return HttpResponse.json({ data: mrPermissionsResponse });
        return HttpResponse.json({ data: { project: null } });
      }),
      graphql.mutation('CreateDiffNote', ({ variables }) => {
        if (
          variables.issuableId === `gid://gitlab/MergeRequest/${openMergeRequestResponse.id}` &&
          variables.body === 'new comment'
        )
          return HttpResponse.json({
            data: { createDiffNote: { note: { discussion: discussionOnDiff } } },
          });
        return new HttpResponse(null, { status: 500 });
      }),
    ]);
  });

  beforeEach(async () => {
    server.resetHandlers();
    dataProvider = new IssuableDataProvider(getExtensionStateSingleton());
    mrItemModel = new MrItemModel(
      openMergeRequestResponse,
      getProjectRepository().getProjectOrFail(getRepositoryRoot()),
    );
  });

  after(async () => {
    server.close();
  });

  const getTreeItem = model => dataProvider.getTreeItem(model);

  it('shows MR item with changed files', async () => {
    const mrItem = getTreeItem(mrItemModel);
    assert.strictEqual(mrItem.label, '!33824 · Web IDE - remove unused actions (mappings)');

    const mrContent = await dataProvider.getChildren(mrItemModel);
    assert.strictEqual(getTreeItem(mrContent[0]).label, 'Overview');

    const mrFiles = mrContent.slice(1);
    assert.deepStrictEqual(
      mrFiles.map(f => getTreeItem(f).resourceUri.path),
      [
        '/.deleted.yml',
        '/README1.md',
        '/new_file.ts',
        '/src/test.js',
        '/src/assets/insert-multi-file-snippet.gif',
        '/Screenshot.png',
      ],
    );

    assert.deepStrictEqual(
      mrFiles.map(f => getTreeItem(f).description),
      ['', '', '', 'src', 'src/assets', ''],
    );
  });

  describe('discussions', () => {
    const sandbox = sinon.createSandbox();
    let thread;
    let commentController;

    beforeEach(() => {
      thread = {};
      /* We fake createCommentController implementation to check
      that when we initialize an MR review, we create a correct comment controller
      we save the created thread for later use in assertions */
      commentController = {
        createCommentThread: (uri, range, comments) => {
          thread = { uri, range, comments };
          return thread;
        },
        dispose: () => {},
      };
      sandbox.stub(vscode.comments, 'createCommentController').returns(commentController);
    });
    afterEach(() => {
      sandbox.restore();
    });

    it('loads MR discussions', async () => {
      const mrItem = getTreeItem(mrItemModel);
      assert.strictEqual(mrItem.label, '!33824 · Web IDE - remove unused actions (mappings)');

      await dataProvider.getChildren(mrItemModel);

      const { uri, range, comments } = thread;
      assert.strictEqual(uri.path, `/${noteOnDiff.position.oldPath}`);
      assert.strictEqual(range.start.line, noteOnDiff.position.oldLine - 1);
      assert.strictEqual(comments[0].body.value, noteOnDiff.body);
    });

    it('editing comment fails if the comment body has changed on the GitLab instance', async () => {
      await dataProvider.getChildren(mrItemModel);
      const [firstComment] = thread.comments;
      firstComment.gqlNote.body =
        'this body simulates that our version of the note body is out of sync with the GitLab instance';
      firstComment.body = 'user wants to change the body to this';

      await assert.rejects(
        submitEdit(firstComment),
        /This comment changed after you last viewed it, and can't be edited/,
      );
    });
  });

  describe('clicking on a changed file', () => {
    let mrFiles;

    const getItem = filePath => mrFiles.filter(f => f.resourceUri.path === filePath).pop();

    const getDiffArgs = item => {
      assert.strictEqual(item.command.command, 'vscode.diff');
      return item.command.arguments;
    };

    before(async () => {
      assert.strictEqual(
        getTreeItem(mrItemModel).label,
        '!33824 · Web IDE - remove unused actions (mappings)',
      );

      const mrContent = await dataProvider.getChildren(mrItemModel);
      assert.strictEqual(mrContent[0].label, 'Overview');

      mrFiles = mrContent.slice(1);
    });

    it('should show the correct diff title', () => {
      const item = getItem('/README1.md');
      const [, , diffTitle] = getDiffArgs(item);
      assert.strictEqual(diffTitle, 'README1.md (!33824)');
    });

    describe('Api content provider', () => {
      let fileSystem;

      before(() => {
        fileSystem = new ReviewFileSystem();
      });

      it('should fetch base content for a diff URI', async () => {
        const item = getItem('/src/test.js');
        const [baseUri] = getDiffArgs(item);
        const content = await fileSystem.readFile(baseUri);
        assert.strictEqual(content.toString(), 'Old Version');
      });

      it('should fetch head content for a diff URI', async () => {
        const item = getItem('/src/test.js');
        const [, headUri] = getDiffArgs(item);
        const content = await fileSystem.readFile(headUri);
        assert.strictEqual(content.toString(), 'New Version');
      });

      it('should show empty file when asked to fetch base content for added file', async () => {
        const item = getItem('/new_file.ts');
        const [baseUri] = getDiffArgs(item);
        const content = await fileSystem.readFile(baseUri);
        assert.strictEqual(content.length, 0);
      });

      it('should show empty file when asked to fetch head content for deleted file', async () => {
        const item = getItem('/.deleted.yml');
        const [, headUri] = getDiffArgs(item);
        const content = await fileSystem.readFile(headUri);
        assert.strictEqual(content.length, 0);
      });
    });

    describe('Creating a new diff comment thread', () => {
      it('should create a new comment', async () => {
        // This URI represents old version of `src/test.js` file (versionResponse fixture) in the test MR (openMergeRequestResponse fixture)
        const uri = toReviewUri({
          path: `src/test.js`,
          commit: versionResponse.base_commit_sha, // base sha === old version of the file
          mrId: openMergeRequestResponse.id,
          projectId: openMergeRequestResponse.project_id,
          repositoryRoot: getRepositoryRoot(),
        });

        const thread = {
          uri,
          range: new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0)),
          comments: [],
        };

        await createComment({ text: 'new comment', thread });

        assert.strictEqual(thread.comments.length, 1); // comment has been added
      });
    });
  });
});
