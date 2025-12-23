import vscode from 'vscode';
import { install as installSourceMapSupport } from 'source-map-support';
import { ServiceCollection, createInstanceDescriptor } from '@gitlab/needle';
import { BaseLanguageClient } from 'vscode-languageclient';
import { initializeLogging } from '../common/log';
import { handleError } from '../common/errors/handle_error';
import { doNotAwait } from '../common/utils/do_not_await';
import { GITLAB_DEBUG_MODE } from '../common/utils/extension_configuration';
import {
  FeatureFlag,
  getLocalFeatureFlagService,
} from '../common/feature_flags/local_feature_flag_service';
import { activateCommon } from '../common/main';
import { wrapCommandWithCatch } from '../common/utils/wrap_command_with_catch';
import { LanguageServerManager } from '../common/language_server/language_server_manager';
import { CodeSuggestions } from '../common/code_suggestions/code_suggestions';
import { setupWebviews } from '../common/webview';
import {
  WebviewMessageRegistry,
  WebviewMessageRegistryImpl,
} from '../common/webview/message_handlers/webview_message_registry';
import { runExtensionConfigurationMigrations } from '../common/utils/extension_configuration_migrations/migrations';
import { DefaultAIContextManager, AIContextManager } from '../common/chat/ai_context_manager';
import {
  LanguageServerFeatureStateKey,
  LanguageServerFeatureStateProvider,
  LanguageServerFeatureStateProviderImpl,
} from '../common/language_server/language_server_feature_state_provider';
import {
  RepositoryClientImpl,
  RepositoryClient,
} from '../common/language_server/repository_client';
import { DefaultDiagnosticsService } from '../common/diagnostics/diagnostics_service';
import { DefaultExtensionStateService } from '../common/state/extension_state_service';
import {
  VersionDetailsStateKey,
  VersionDiagnosticsRenderer,
} from '../common/diagnostics/version_diagnostics/version_diagnostics_renderer';
import { VersionStateProvider } from '../common/state/version_state_provider';
import { GitLabInstanceVersionProvider } from '../common/state/gitlab_instance_version_provider';
import { FeatureStateDiagnosticsRenderer } from '../common/diagnostics/feature_state_diagnostics/feature_state_diagnostics_renderer';
import { extensionConfigurationService } from '../common/utils/extension_configuration_service';
import {
  SettingsDetailsStateKey,
  SettingsStateProvider,
} from '../common/state/settings_state_provider';
import { UserFriendlyError } from '../common/errors/user_friendly_error';
import { SHOW_KNOWLEDGE_GRAPH_WEBVIEW_COMMAND } from '../common/webview/knowldege_graph/knowledge_graph_webview';
import {
  LanguageClientWrapper,
  LanguageClientWrapperImpl,
  BaseLanguageClientId,
} from '../common/language_server/language_client_wrapper';
import {
  GitLabPlatformManagerForCodeSuggestions,
  GitLabPlatformManagerForCodeSuggestionsImpl,
} from '../common/code_suggestions/gitlab_platform_manager_for_code_suggestions';
import { GitLabTelemetryEnvironmentId } from '../common/platform/gitlab_telemetry_environment';
import { LSGitProviderId } from '../common/git/ls_git_provider';
import { TerminalManager, TerminalManagerImpl } from '../common/duo_workflow/terminal_manager';
import { FileSnapshotProvider, FileSnapshotProviderImpl } from '../common/language_server/file_snapshot_provider';
import { GitLabPlatformManagerForChat } from '../common/chat/get_platform_manager_for_chat';
import { aiReviewMRCommand } from './ai_code_review/commands/review_mr_command';
import { DesktopSettingsStateDiagnosticsRenderer } from './diagnostics/settings_diagnostics_renderer';
import * as openers from './commands/openers';
import * as tokenInput from './accounts/remove_account';
import { accountService } from './accounts/account_service';
import { ExtensionState, setExtensionStateSingleton } from './extension_state';
import { initializeNetworkAgent } from './fetch';
import { setupCodeSuggestionsPromo } from './code_suggestions_promo';
import { createSnippet } from './commands/create_snippet';
import { insertSnippet } from './commands/insert_snippet';
import { validateCiConfig, showMergedCiConfig } from './commands/ci_config_lint_commands';
import { issuableController } from './issuable_controller';
// import { currentBranchDataProvider } from './tree_view/current_branch_data_provider';
import { ReviewFileSystem } from './review/review_file_system';
import { GqlSecurityFinding } from './gitlab/security_findings/api/get_security_finding_report';
import { ProjectInRepository } from './gitlab/new_project';
import {
  REVIEW_URI_SCHEME,
  REMOTE_URI_SCHEME,
  MERGED_YAML_URI_SCHEME,
  JOB_LOG_URI_SCHEME,
} from './constants';
import { USER_COMMANDS, PROGRAMMATIC_COMMANDS } from './command_names';
import { CiCompletionProvider } from './ci/ci_completion_provider';
import { gitExtensionWrapper } from './git/git_extension_wrapper';
import {
  toggleResolved,
  deleteComment,
  editComment as startEdit,
  cancelEdit,
  submitEdit,
  createComment,
  cancelFailedComment,
  retryFailedComment,
} from './commands/mr_discussion_commands';
import { hasCommentsDecorationProvider } from './review/has_comments_decoration_provider';
import { changeTypeDecorationProvider } from './review/change_type_decoration_provider';
import { checkoutMrBranch } from './commands/checkout_mr_branch';
import { openInGitLab, copyLinkToClipboard } from './commands/open_in_gitlab';
import { cloneWiki } from './commands/clone_wiki';
import { createSnippetPatch } from './commands/create_snippet_patch';
import { downloadArtifacts } from './commands/download_artifact';
import { applySnippetPatch } from './commands/apply_snippet_patch';
import { openMrFile } from './commands/open_mr_file';
import { GitLabRemoteFileSystem } from './remotefs/gitlab_remote_file_system';
import { openRepository } from './commands/open_repository';
import { contextUtils } from './utils/context_utils';
import { currentBranchRefresher } from './current_branch_refresher';
import { statusBar } from './status_bar';
import {
  registerRepositoryRootProvider,
  runWithValidProject,
  runWithValidProjectFile,
} from './commands/run_with_valid_project';
import { triggerPipelineAction } from './commands/trigger_pipeline_action';
import { setSidebarViewState, SidebarViewState } from './tree_view/sidebar_view_state';
import {
  getProjectRepository,
  setGlobalProjectRepository,
  GitLabProjectRepositoryImpl,
} from './gitlab/gitlab_project_repository';
import {
  assignProject,
  clearSelectedProjects,
  selectProjectCommand,
  selectProjectForRepository,
} from './gitlab/select_project';
import { lsClearSelectedProjects, lsSelectProjectCommand } from './gitlab/ls_select_project';
import { MultipleProjectsItem } from './tree_view/items/multiple_projects_item';
import { NoProjectItem } from './tree_view/items/no_project_item';
import { ProjectItemModel } from './tree_view/items/project_item_model';
import { selectedProjectStore } from './gitlab/selected_project_store';
import {
  showIssueSearchInput,
  showMergeRequestSearchInput,
  showAdvancedSearchInput,
} from './search_input';
import { gitlabUriHandler } from './gitlab_uri_handler';
import { AuthenticateCommand } from './accounts/authenticate_command';
import { GitLabAuthenticationProvider } from './accounts/oauth/gitlab_authentication_provider';
import { setupYamlSupport } from './yaml_support';
import { cancelJob, executeJob, retryJob } from './commands/job_actions';
import { MergedYamlContentProvider } from './ci/merged_yaml_content_provider';
import { cancelPipeline, retryPipeline } from './commands/pipeline_actions';
import { openTraceArtifact } from './commands/open_trace_artifact';
import { JobLogContentProvider } from './ci/job_log_content_provider';
import { saveRawJobTrace } from './ci/save_raw_job_trace';
import { JobLogFoldingProvider } from './ci/job_log_folding_provider';
import { scrollToBottom } from './ci/scroll_to_bottom_command';
import { pendingWebviewController } from './ci/pending_job_webview_controller';
import { securityFindingWebviewController } from './ci/security_finding_controller';
import { JobItemModel } from './tree_view/items/job_item_model';
import { desktopLanguageClientFactory } from './language_server/desktop_language_client_factory';
import { createDependencyContainer } from './dependency_container_desktop';
import { validateAccounts } from './commands/validate_accounts';
import { publishToGitlab } from './commands/publish_to_gitlab';
import { ProtectedBranchManager } from './gitlab/protected_branch_manager';
// import { RemoteSecurityScansDataProvider } from './tree_view/remote_security_scans_data_provider';
import {
  getWorkspaceAccountManager,
  initWorkspaceAccountManager,
  WorkspaceAccountManager,
} from './accounts/workspace_account_manager';
import { createSelectWorkspaceAccountCommand } from './accounts/select_workspace_account_command';
import { AccountStatusBarItem } from './accounts/account_status_bar_item';
import { createDeselectWorkspaceAccountCommand } from './accounts/deselect_workspace_account_command';
import { AccountPreselectionService } from './accounts/account_preselection_service';
import { TokenRefreshService } from './accounts/token_refresh_service';
import { tokenExchangeService } from './gitlab/token_exchange_service';
import {
  openMcpUserConfigCommand,
  openMcpWorkspaceConfigCommand,
} from './mcp/open_mcp_config_command';
import { logNetworkConfiguration } from './gitlab/http/log_network_options';
import { IssuableDataProviderFactory } from './tree_view/issuable_data_provider_factory';
import { getClientContext } from './language_server/get_client_context';
import { openFlowBuilderCommand } from './commands/open_flow_builder';
import { MrItemModel } from './tree_view/items/mr_item_model';
import { AIReviewFilesDataProvider } from './tree_view/ai_review_files_data_provider';

const registerCommands = (
  context: vscode.ExtensionContext,
  languageServerManager: LanguageServerManager | undefined,
  workspaceAccountManager: WorkspaceAccountManager,
  dependencyContainer: ReturnType<typeof createDependencyContainer>,
  aiContextManager: AIContextManager,
  repositoryClient?: RepositoryClient,
) => {
  const authenticateCommand = new AuthenticateCommand(gitExtensionWrapper, accountService);

  // Check if we should use Language Server repositories
  const useLanguageServerRepos = getLocalFeatureFlagService().isEnabled(FeatureFlag.LsRepositories);

  const commands = {
    [USER_COMMANDS.SHOW_ISSUES_ASSIGNED_TO_ME]: runWithValidProject(openers.showIssues),
    [USER_COMMANDS.SHOW_MERGE_REQUESTS_ASSIGNED_TO_ME]: runWithValidProject(
      openers.showMergeRequests,
    ),
    [USER_COMMANDS.AUTHENTICATE]: authenticateCommand.run,
    [USER_COMMANDS.REMOVE_ACCOUNT]: tokenInput.removeAccount,
    [USER_COMMANDS.VALIDATE_ACCOUNTS]: validateAccounts,
    [USER_COMMANDS.SELECT_WORKSPACE_ACCOUNT]:
      createSelectWorkspaceAccountCommand(workspaceAccountManager),
    [USER_COMMANDS.DESELECT_WORKSPACE_ACCOUNT]:
      createDeselectWorkspaceAccountCommand(workspaceAccountManager),
    [USER_COMMANDS.OPEN_ACTIVE_FILE]: runWithValidProjectFile(openers.openActiveFile),
    [USER_COMMANDS.COPY_LINK_TO_ACTIVE_FILE]: runWithValidProjectFile(openers.copyLinkToActiveFile),
    [USER_COMMANDS.OPEN_CURRENT_MERGE_REQUEST]: runWithValidProject(
      openers.openCurrentMergeRequest,
    ),
    [USER_COMMANDS.OPEN_CREATE_NEW_ISSUE]: runWithValidProject(openers.openCreateNewIssue),
    [USER_COMMANDS.OPEN_CREATE_NEW_MR]: runWithValidProject(openers.openCreateNewMr),
    [USER_COMMANDS.OPEN_PROJECT_PAGE]: runWithValidProject(openers.openProjectPage),
    [USER_COMMANDS.PIPELINE_ACTIONS]: runWithValidProject(triggerPipelineAction),
    [USER_COMMANDS.ISSUE_SEARCH]: runWithValidProject(showIssueSearchInput),
    [USER_COMMANDS.MERGE_REQUEST_SEARCH]: runWithValidProject(showMergeRequestSearchInput),
    [USER_COMMANDS.ADVANCED_SEARCH]: runWithValidProject(showAdvancedSearchInput),
    [USER_COMMANDS.COMPARE_CURRENT_BRANCH]: runWithValidProject(openers.compareCurrentBranch),
    [USER_COMMANDS.CREATE_SNIPPET]: runWithValidProject(createSnippet),
    [USER_COMMANDS.INSERT_SNIPPET]: runWithValidProject(insertSnippet),
    [USER_COMMANDS.VALIDATE_CI_CONFIG]: runWithValidProject(validateCiConfig),
    [USER_COMMANDS.SHOW_MERGED_CI_CONFIG]: runWithValidProject(showMergedCiConfig),
    [PROGRAMMATIC_COMMANDS.SHOW_RICH_CONTENT]: issuableController.open.bind(issuableController),
    [USER_COMMANDS.RESOLVE_THREAD]: toggleResolved,
    [USER_COMMANDS.UNRESOLVE_THREAD]: toggleResolved,
    [USER_COMMANDS.DELETE_COMMENT]: deleteComment,
    [USER_COMMANDS.START_EDITING_COMMENT]: startEdit,
    [USER_COMMANDS.CANCEL_EDITING_COMMENT]: cancelEdit,
    [USER_COMMANDS.SUBMIT_COMMENT_EDIT]: submitEdit,
    [USER_COMMANDS.CREATE_COMMENT]: createComment,
    [USER_COMMANDS.CHECKOUT_MR_BRANCH]: checkoutMrBranch,
    [USER_COMMANDS.OPEN_IN_GITLAB]: openInGitLab,
    [USER_COMMANDS.COPY_LINK_TO_CLIPBOARD]: copyLinkToClipboard,
    [USER_COMMANDS.CLONE_WIKI]: cloneWiki,
    [USER_COMMANDS.CREATE_SNIPPET_PATCH]: runWithValidProject(createSnippetPatch),
    [USER_COMMANDS.APPLY_SNIPPET_PATCH]: runWithValidProject(applySnippetPatch),
    [USER_COMMANDS.CANCEL_FAILED_COMMENT]: cancelFailedComment,
    [USER_COMMANDS.RETRY_FAILED_COMMENT]: retryFailedComment,
    [USER_COMMANDS.OPEN_REPOSITORY]: openRepository,
    [USER_COMMANDS.SIDEBAR_VIEW_AS_LIST]: () => setSidebarViewState(SidebarViewState.ListView),
    [USER_COMMANDS.SIDEBAR_VIEW_AS_TREE]: () => setSidebarViewState(SidebarViewState.TreeView),
    [USER_COMMANDS.REFRESH_SIDEBAR]: async () => {
      await accountService.reloadCache();
      await getProjectRepository().reload();
      await currentBranchRefresher.refresh(true);
    },
    [USER_COMMANDS.OPEN_MR_FILE]: openMrFile,
    [USER_COMMANDS.SELECT_PROJECT_FOR_REPOSITORY]: selectProjectForRepository,

    [USER_COMMANDS.SELECT_PROJECT]:
      useLanguageServerRepos && repositoryClient
        ? (item: MultipleProjectsItem | NoProjectItem) =>
          lsSelectProjectCommand(
            item,
            repositoryClient,
            item instanceof MultipleProjectsItem ? item.repositoryState : undefined,
          )
        : selectProjectCommand,
    [USER_COMMANDS.ASSIGN_PROJECT]: assignProject,
    [USER_COMMANDS.CLEAR_SELECTED_PROJECT]:
      useLanguageServerRepos && repositoryClient
        ? (item: ProjectItemModel) => lsClearSelectedProjects(item, repositoryClient)
        : clearSelectedProjects,
    [USER_COMMANDS.DOWNLOAD_ARTIFACTS]: downloadArtifacts,
    [USER_COMMANDS.OPEN_TRACE_ARTIFACT]: openTraceArtifact,
    [USER_COMMANDS.WAIT_FOR_PENDING_JOB]: async (item: JobItemModel) => {
      await pendingWebviewController.waitForPendingJob(item);
    },
    [USER_COMMANDS.VIEW_SECURITY_FINDING]: async (
      item: GqlSecurityFinding,
      projectInRepository: ProjectInRepository,
    ) => {
      await securityFindingWebviewController.open(item, projectInRepository);
    },
    [USER_COMMANDS.PUBLISH_TO_GITLAB]: publishToGitlab,
    [USER_COMMANDS.SAVE_RAW_JOB_TRACE]: saveRawJobTrace,
    [USER_COMMANDS.SCROLL_TO_BOTTOM]: scrollToBottom,
    [USER_COMMANDS.EXECUTE_JOB]: executeJob,
    [USER_COMMANDS.RETRY_JOB]: retryJob,
    [USER_COMMANDS.CANCEL_JOB]: cancelJob,
    [USER_COMMANDS.RETRY_FAILED_PIPELINE_JOBS]: retryPipeline,
    [USER_COMMANDS.CANCEL_PIPELINE]: cancelPipeline,
    // this command is not exposed in the browser version
    // TODO implement this command for the browser version
    [USER_COMMANDS.RESTART_LANGUAGE_SERVER]: async () => {
      if (!languageServerManager) {
        return;
      }
      await languageServerManager.restartLanguageServer();
    },
    [PROGRAMMATIC_COMMANDS.SHOW_ERROR_MESSAGE]: openers.showErrorMessage,
    [USER_COMMANDS.MCP_OPEN_USER_CONFIG]: openMcpUserConfigCommand,
    [USER_COMMANDS.MCP_OPEN_WORKSPACE_CONFIG]: openMcpWorkspaceConfigCommand,
    [USER_COMMANDS.SHOW_KNOWLEDGE_GRAPH]: async () => {
      await vscode.commands.executeCommand(SHOW_KNOWLEDGE_GRAPH_WEBVIEW_COMMAND);
    },
    [USER_COMMANDS.OPEN_FLOW_BUILDER]: openFlowBuilderCommand,
    [USER_COMMANDS.AI_REVIEW_MR]: async (mrItem?: MrItemModel) => {
      const platformManagerForChat = new GitLabPlatformManagerForChat(
        dependencyContainer.gitLabPlatformManager,
      );
      await aiReviewMRCommand(platformManagerForChat, aiContextManager, mrItem);
    },
  };

  Object.keys(commands).forEach(cmd => {
    context.subscriptions.push(
      vscode.commands.registerCommand(cmd, wrapCommandWithCatch(commands[cmd])),
    );
  });
};

const registerCiCompletion = (context: vscode.ExtensionContext) => {
  const subscription = vscode.languages.registerCompletionItemProvider(
    { pattern: '**/*.gitlab-ci*.{yml,yaml}' },
    new CiCompletionProvider(),
    '$',
    '{',
  );

  context.subscriptions.push(subscription);
};

const activateDebugMode = () => {
  const installSourceMapsIfDebug = () => {
    if (extensionConfigurationService.getConfiguration().debug) installSourceMapSupport();
  };
  installSourceMapsIfDebug();
  vscode.workspace.onDidChangeConfiguration(e => {
    if (e.affectsConfiguration(GITLAB_DEBUG_MODE)) installSourceMapsIfDebug();
  });
};

let languageServerManager: LanguageServerManager | undefined;
/**
 * @param {vscode.ExtensionContext} context
 */
export const activate = async (context: vscode.ExtensionContext) => {
  const outputChannel = vscode.window.createOutputChannel('GitLab Workflow');
  initializeLogging(line => outputChannel.appendLine(line));

  await runExtensionConfigurationMigrations();

  activateDebugMode();
  initializeNetworkAgent();
  await logNetworkConfiguration();

  contextUtils.init(context);

  vscode.workspace.registerFileSystemProvider(
    REVIEW_URI_SCHEME,
    new ReviewFileSystem(),
    ReviewFileSystem.OPTIONS,
  );
  vscode.workspace.registerTextDocumentContentProvider(
    MERGED_YAML_URI_SCHEME,
    new MergedYamlContentProvider(),
  );
  const jobLogContentProvider = new JobLogContentProvider(context);
  vscode.workspace.registerTextDocumentContentProvider(JOB_LOG_URI_SCHEME, jobLogContentProvider);
  vscode.languages.registerFoldingRangeProvider(
    { scheme: JOB_LOG_URI_SCHEME },
    new JobLogFoldingProvider(),
  );
  vscode.workspace.registerFileSystemProvider(
    REMOTE_URI_SCHEME,
    new GitLabRemoteFileSystem(),
    GitLabRemoteFileSystem.OPTIONS,
  );
  const dependencyContainer = createDependencyContainer();
  const extensionStateService = new DefaultExtensionStateService();
  const diagnosticsService = new DefaultDiagnosticsService(extensionStateService);

  issuableController.init(context);
  await accountService.init(context).catch(e => {
    handleError(e);
    throw e;
  });

  initWorkspaceAccountManager(context, accountService);
  context.subscriptions.push(new TokenRefreshService(accountService, tokenExchangeService));
  const projectRepository = new GitLabProjectRepositoryImpl(
    accountService,
    gitExtensionWrapper,
    selectedProjectStore,
    getWorkspaceAccountManager(),
  );
  setGlobalProjectRepository(projectRepository);
  context.subscriptions.push(new AccountStatusBarItem(getWorkspaceAccountManager()));
  context.subscriptions.push(
    new AccountPreselectionService(getWorkspaceAccountManager(), gitExtensionWrapper),
  );
  selectedProjectStore.init(context);
  registerCiCompletion(context);
  setupYamlSupport(context);
  setupCodeSuggestionsPromo(context);
  vscode.window.registerUriHandler(gitlabUriHandler);
  context.subscriptions.push(gitExtensionWrapper);

  statusBar.init();
  context.subscriptions.push(statusBar);

  context.subscriptions.push(jobLogContentProvider);
  context.subscriptions.push(
    new ProtectedBranchManager(gitExtensionWrapper, getProjectRepository()),
  );

  vscode.window.registerFileDecorationProvider(hasCommentsDecorationProvider);
  vscode.window.registerFileDecorationProvider(changeTypeDecorationProvider);
  vscode.authentication.registerAuthenticationProvider(
    'gitlab',
    'GitLab',
    new GitLabAuthenticationProvider(),
  );

  const extensionState = new ExtensionState(getWorkspaceAccountManager());
  setExtensionStateSingleton(extensionState);
  await extensionState.init();

  currentBranchRefresher.init();
  context.subscriptions.push(currentBranchRefresher);

  let repositoryClient: RepositoryClient | undefined;
  // 已移除 currentBranchInfo 和 remoteSecurityScanning 视图
  // vscode.window.registerTreeDataProvider('currentBranchInfo', currentBranchDataProvider);
  registerRepositoryRootProvider(
    issuableController,
    pendingWebviewController,
    securityFindingWebviewController,
  );

  // if (getLocalFeatureFlagService().isEnabled(FeatureFlag.RemoteSecurityScans)) {
  //   const remoteSecurityScansDataProvider = new RemoteSecurityScansDataProvider();
  //   vscode.window.registerTreeDataProvider(
  //     'remoteSecurityScanning',
  //     remoteSecurityScansDataProvider,
  //   );
  //   context.subscriptions.push(remoteSecurityScansDataProvider);
  // }

  const languageServerFeatureStateProvider = new LanguageServerFeatureStateProviderImpl();
  // context manager without LS is the default
  let aiContextManager = new DefaultAIContextManager();

  if (getLocalFeatureFlagService().isEnabled(FeatureFlag.LanguageServer)) {
    try {
      const webviewMessageRegistry = new WebviewMessageRegistryImpl();

      // Create DI container factory function for LanguageServerManager
      const createLanguageClientWrapper = (client: BaseLanguageClient) => {
        const terminalManager = new TerminalManagerImpl();
        const suggestionsManager = new GitLabPlatformManagerForCodeSuggestionsImpl(
          dependencyContainer.gitLabPlatformManager,
        );
        const fileSnapshotProvider = new FileSnapshotProviderImpl();

        repositoryClient = new RepositoryClientImpl();
        context.subscriptions.push(
          vscode.workspace.registerTextDocumentContentProvider(
            FileSnapshotProviderImpl.SCHEME,
            fileSnapshotProvider,
          ),
        );

        // Create DI container for LanguageClientWrapper
        const diServiceCollection = new ServiceCollection();

        // Register all dependencies as instances
        diServiceCollection.add(
          createInstanceDescriptor({
            instance: client,
            aliases: [BaseLanguageClientId],
          }),
          createInstanceDescriptor({
            instance: suggestionsManager,
            aliases: [GitLabPlatformManagerForCodeSuggestions],
          }),
          createInstanceDescriptor({
            instance: dependencyContainer.gitLabTelemetryEnvironment,
            aliases: [GitLabTelemetryEnvironmentId],
          }),
          createInstanceDescriptor({
            instance: dependencyContainer.lsGitProvider,
            aliases: [LSGitProviderId],
          }),
          createInstanceDescriptor({
            instance: webviewMessageRegistry,
            aliases: [WebviewMessageRegistry],
          }),
          createInstanceDescriptor({
            instance: languageServerFeatureStateProvider,
            aliases: [LanguageServerFeatureStateProvider],
          }),
          createInstanceDescriptor({
            instance: terminalManager,
            aliases: [TerminalManager],
          }),
          createInstanceDescriptor({
            instance: fileSnapshotProvider,
            aliases: [FileSnapshotProvider],
          }),
          createInstanceDescriptor({
            instance: repositoryClient,
            aliases: [RepositoryClient],
          }),
        );

        // Register the LanguageClientWrapper class
        diServiceCollection.addClass(LanguageClientWrapperImpl);

        // Build the container and get the wrapper instance
        const diContainer = diServiceCollection.build();
        const wrapper = diContainer.getRequiredService(LanguageClientWrapper);

        // Add suggestionsManager to subscriptions since it's no longer handled by the manager
        context.subscriptions.push(suggestionsManager);

        return wrapper;
      };

      languageServerManager = new LanguageServerManager(
        context,
        desktopLanguageClientFactory,
        dependencyContainer,
        webviewMessageRegistry,
        languageServerFeatureStateProvider,
        getClientContext(),
      );

      // Set the wrapper factory function
      languageServerManager.createLanguageClientWrapper = createLanguageClientWrapper;

      await languageServerManager.startLanguageServer();
      aiContextManager = new DefaultAIContextManager(languageServerManager);

      context.subscriptions.push(
        await setupWebviews(languageServerManager, webviewMessageRegistry, aiContextManager),
      );
    } catch (e) {
      handleError(new UserFriendlyError('GitLab Language Server failed to start', e));
    }
  } else {
    const codeSuggestions = new CodeSuggestions(context, dependencyContainer.gitLabPlatformManager);
    await codeSuggestions.init();
    context.subscriptions.push(codeSuggestions);
  }

  const issuableDataProvider = IssuableDataProviderFactory.create(
    extensionState,
    accountService,
    repositoryClient,
  );
  vscode.window.registerTreeDataProvider('issuesAndMrs', issuableDataProvider);

  // 注册 AI Code Review Files 视图
  const aiReviewFilesDataProvider = new AIReviewFilesDataProvider();
  vscode.window.registerTreeDataProvider('aiCodeReviewFiles', aiReviewFilesDataProvider);
  context.subscriptions.push(aiReviewFilesDataProvider);

  const glVersionProvider = new GitLabInstanceVersionProvider(
    dependencyContainer.gitLabPlatformManager,
  );

  extensionStateService.addStateProvider(
    VersionDetailsStateKey,
    new VersionStateProvider(
      context.extension.packageJSON.version,
      languageServerManager,
      glVersionProvider,
    ),
  );
  diagnosticsService.addRenderer(new VersionDiagnosticsRenderer());

  extensionStateService.addStateProvider(
    LanguageServerFeatureStateKey,
    languageServerFeatureStateProvider,
  );
  diagnosticsService.addRenderer(new FeatureStateDiagnosticsRenderer());

  extensionStateService.addStateProvider(
    SettingsDetailsStateKey,
    new SettingsStateProvider(extensionConfigurationService),
  );
  diagnosticsService.addRenderer(new DesktopSettingsStateDiagnosticsRenderer());

  registerCommands(
    context,
    languageServerManager,
    getWorkspaceAccountManager(),
    dependencyContainer,
    aiContextManager,
    repositoryClient,
  );

  // we don't want to hold the extension startup by waiting on VS Code and GitLab API
  doNotAwait(
    Promise.all([
      vscode.commands.executeCommand(USER_COMMANDS.VALIDATE_ACCOUNTS, true),
      setSidebarViewState(SidebarViewState.ListView),
      gitExtensionWrapper.init(),
      projectRepository.init(),
      currentBranchRefresher.refresh(),
      pendingWebviewController.init(context),
      securityFindingWebviewController.init(context),
      activateCommon(
        context,
        dependencyContainer,
        outputChannel,
        aiContextManager,
        diagnosticsService,
        languageServerFeatureStateProvider,
      ),
    ]).catch(e => handleError(e)),
  );
};

export async function deactivate(): Promise<void> {
  if (languageServerManager) {
    await languageServerManager.stopLanguageServer();
  }
}
