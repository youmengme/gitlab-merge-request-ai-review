const vscode = require('vscode');
const { USER_COMMANDS } = require('../../../src/desktop/command_names');
const {
  ExtensionState,
  setExtensionStateSingleton,
} = require('../../../src/desktop/extension_state');
const { gitExtensionWrapper } = require('../../../src/desktop/git/git_extension_wrapper');
const {
  getProjectRepository,
  setGlobalProjectRepository,
  GitLabProjectRepositoryImpl,
} = require('../../../src/desktop/gitlab/gitlab_project_repository');
const { selectedProjectStore } = require('../../../src/desktop/gitlab/selected_project_store');
const { accountService } = require('../../../src/desktop/accounts/account_service');
const { issuableController } = require('../../../src/desktop/issuable_controller');
const {
  registerRepositoryRootProvider,
} = require('../../../src/desktop/commands/run_with_valid_project');
const {
  pendingWebviewController,
} = require('../../../src/desktop/ci/pending_job_webview_controller');
const {
  initWorkspaceAccountManager,
  getWorkspaceAccountManager,
} = require('../../../src/desktop/accounts/workspace_account_manager');
const {
  getLocalFeatureFlagService,
} = require('../../../src/common/feature_flags/local_feature_flag_service');
const { GITLAB_URL } = require('./constants');
const { InMemoryMemento } = require('./in_memory_memento');
const { getServer } = require('./mock_server');

const rejectAfter = (reason, durationInMs) =>
  new Promise((res, rej) => {
    setTimeout(() => rej(new Error(reason)), durationInMs);
  });

const ensureProject = async () => {
  await gitExtensionWrapper.init();
  await getProjectRepository().init();
  const projects = getProjectRepository().getDefaultAndSelectedProjects();
  if (projects.length > 0) return undefined;
  const createPromiseThatResolvesWhenRepoCountChanges = () =>
    new Promise(resolve => {
      const sub = getProjectRepository().onProjectChange(() => {
        sub.dispose();
        resolve(undefined);
      });
    });
  return createPromiseThatResolvesWhenRepoCountChanges();
};

const initializeTestEnvironment = async testRoot => {
  const extensionContext = {
    globalState: new InMemoryMemento(),
    secrets: new InMemoryMemento(),
    extensionPath: `${testRoot}/../..`,
    extensionUri: vscode.Uri.file(`${testRoot}/../..`),
    extensionMode: 3,
  };
  process.env.GITLAB_WORKFLOW_INSTANCE_URL = GITLAB_URL;
  process.env.GITLAB_WORKFLOW_TOKEN = 'abcd-secret';
  accountService.init(extensionContext);
  initWorkspaceAccountManager(extensionContext, accountService);

  const extensionState = new ExtensionState(getWorkspaceAccountManager());
  setExtensionStateSingleton(extensionState);
  await extensionState.init();
  registerRepositoryRootProvider(issuableController, pendingWebviewController);
  pendingWebviewController.init(extensionContext);
  issuableController.init(extensionContext);
  selectedProjectStore.init(extensionContext);
  setGlobalProjectRepository(
    new GitLabProjectRepositoryImpl(
      accountService,
      gitExtensionWrapper,
      selectedProjectStore,
      getWorkspaceAccountManager(),
      getLocalFeatureFlagService(),
    ),
  );
  const ext = vscode.extensions.getExtension('gitlab.gitlab-workflow');
  // run the extension activation and project load with a mock server
  const server = getServer();
  await ext.activate();
  await Promise.race([ensureProject(), rejectAfter('No project after 5s', 5000)]);
  await vscode.commands.executeCommand(USER_COMMANDS.REFRESH_SIDEBAR);
  server.close();
};

module.exports = { initializeTestEnvironment };
