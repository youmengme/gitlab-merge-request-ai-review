const assert = require('assert');
const sinon = require('sinon');
const vscode = require('vscode');
const {
  getActiveProject,
  getActiveProjectOrSelectOne,
} = require('../../src/desktop/commands/run_with_valid_project');
const { getProjectRepository } = require('../../src/desktop/gitlab/gitlab_project_repository');
const { job, projectInRepository } = require('../../src/desktop/test_utils/entities');
const { WEBVIEW_PENDING_JOB } = require('../../src/desktop/constants');
const { pendingWebviewController } = require('../../src/desktop/ci/pending_job_webview_controller');
const { JobItemModel } = require('../../src/desktop/tree_view/items/job_item_model');
const {
  createAndOpenFile,
  closeAndDeleteFile,
  getRepositoryRoot,
  waitForActiveTabChange,
} = require('./test_infrastructure/helpers');

describe('run_with_valid_project', () => {
  describe('getting repositories', () => {
    const sandbox = sinon.createSandbox();

    describe('one repository, no open files', () => {
      it('getActiveRepository returns the open repository', () => {
        const result = getActiveProject();
        assert.strictEqual(result.pointer.repository.rootFsPath, getRepositoryRoot());
      });

      it('getActiveRepositoryOrSelectOne returns the open repository', async () => {
        const result = await getActiveProjectOrSelectOne();
        assert.strictEqual(result.pointer.repository.rootFsPath, getRepositoryRoot());
      });
    });

    describe('multiple repositories in single-folder workspace', () => {
      beforeEach(() => {
        const originalProjects = getProjectRepository().getDefaultAndSelectedProjects();
        sandbox
          .stub(getProjectRepository(), 'getDefaultAndSelectedProjects')
          .returns([...originalProjects, projectInRepository]);
      });

      afterEach(() => {
        sandbox.restore();
      });

      it('getActiveRepository returns root repository', () => {
        const result = getActiveProject();
        assert.strictEqual(result.pointer.repository.rootFsPath, getRepositoryRoot());
      });

      it('getActiveRepositoryOrSelectOne returns root repository', async () => {
        const result = await getActiveProjectOrSelectOne();
        assert.strictEqual(result.pointer.repository.rootFsPath, getRepositoryRoot());
      });

      describe('with open editor', () => {
        let testFileUri;
        beforeEach(async () => {
          testFileUri = vscode.Uri.file(`${getRepositoryRoot()}/newfile.js`);
          await createAndOpenFile(testFileUri);
        });

        afterEach(async () => {
          await closeAndDeleteFile(testFileUri);
        });

        it('getActiveRepository returns repository for the open file', () => {
          const result = getActiveProject();
          assert.strictEqual(result.pointer.repository.rootFsPath, getRepositoryRoot());
        });

        it('getActiveRepositoryOrSelectOne returns repository for the open file', async () => {
          const result = await getActiveProjectOrSelectOne();
          assert.strictEqual(result.pointer.repository.rootFsPath, getRepositoryRoot());
        });
      });

      describe('with open webview', () => {
        let panel = null;
        afterEach(() => {
          if (panel) panel.dispose();
          panel = null;
        });

        it('getActiveRepository returns repository for Pending Job', async () => {
          const project = getProjectRepository().getDefaultAndSelectedProjects()[0];
          const pendingJobModel = new JobItemModel(project, {
            ...job,
            status: 'pending',
            started_at: undefined,
          });

          const promise = waitForActiveTabChange();
          panel = await pendingWebviewController.waitForPendingJob(pendingJobModel);
          await promise;

          assert.strictEqual(
            vscode.window.tabGroups.activeTabGroup.activeTab.input.viewType,
            `mainThreadWebview-${WEBVIEW_PENDING_JOB}`,
          );

          const result = getActiveProject();
          assert.strictEqual(
            result.pointer.repository.rootFsPath,
            project.pointer.repository.rootFsPath,
          );
        });
      });
    });
  });
});
