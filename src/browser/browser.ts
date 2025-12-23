import * as vscode from 'vscode';
import { BaseLanguageClient } from 'vscode-languageclient/browser';
import { createInstanceDescriptor, ServiceCollection } from '@gitlab/needle';
import { initializeLogging } from '../common/log';
import { activateCommon } from '../common/main';
import { LanguageServerManager } from '../common/language_server/language_server_manager';
import {
  WebviewMessageRegistry,
  WebviewMessageRegistryImpl,
} from '../common/webview/message_handlers/webview_message_registry';
import { WEB_IDE_EXTENSION_ID, WebIDEExtension } from '../common/platform/web_ide';
import { runExtensionConfigurationMigrations } from '../common/utils/extension_configuration_migrations/migrations';
import { AIContextManagerWebIde } from '../common/chat/ai_context_manager_web_ide';
import {
  LanguageServerFeatureStateKey,
  LanguageServerFeatureStateProvider,
  LanguageServerFeatureStateProviderImpl,
} from '../common/language_server/language_server_feature_state_provider';
import { DefaultDiagnosticsService } from '../common/diagnostics/diagnostics_service';
import { DefaultExtensionStateService } from '../common/state/extension_state_service';
import { VersionStateProvider } from '../common/state/version_state_provider';
import {
  VersionDetailsStateKey,
  VersionDiagnosticsRenderer,
} from '../common/diagnostics/version_diagnostics/version_diagnostics_renderer';
import { GitLabInstanceVersionProvider } from '../common/state/gitlab_instance_version_provider';
import { FeatureStateDiagnosticsRenderer } from '../common/diagnostics/feature_state_diagnostics/feature_state_diagnostics_renderer';
import {
  SettingsDetailsStateKey,
  SettingsStateProvider,
} from '../common/state/settings_state_provider';
import { extensionConfigurationService } from '../common/utils/extension_configuration_service';
import {
  GitLabPlatformManagerForCodeSuggestions,
  GitLabPlatformManagerForCodeSuggestionsImpl,
} from '../common/code_suggestions/gitlab_platform_manager_for_code_suggestions';
import {
  BaseLanguageClientId,
  LanguageClientWrapper,
  LanguageClientWrapperImpl,
} from '../common/language_server/language_client_wrapper';
import { GitLabTelemetryEnvironmentId } from '../common/platform/gitlab_telemetry_environment';
import { DefaultLSGitProvider, LSGitProviderId } from '../common/git/ls_git_provider';
import { TerminalManager, TerminalManagerImpl } from '../common/duo_workflow/terminal_manager';
import {
  FileSnapshotProvider,
  FileSnapshotProviderImpl,
} from '../common/language_server/file_snapshot_provider';
import {
  RepositoryClient,
  RepositoryClientImpl,
} from '../common/language_server/repository_client';
import { browserLanguageClientFactory } from './language_server/browser_language_client_factory';
import { createDependencyContainer } from './dependency_container_browser';
import { SettingsStateDiagnosticsRenderer } from './diagnostics/settings_diagnostics_renderer';
import { getClientContext } from './language_server/get_client_context';

export const activate = async (context: vscode.ExtensionContext) => {
  const webIdeExtension =
    vscode.extensions.getExtension<WebIDEExtension>(WEB_IDE_EXTENSION_ID)?.exports;

  if (!webIdeExtension) {
    throw new Error(`Failed to load extension export from ${WEB_IDE_EXTENSION_ID}.`);
  }

  const outputChannel = vscode.window.createOutputChannel('GitLab Workflow');
  initializeLogging(line => outputChannel.appendLine(line));

  await runExtensionConfigurationMigrations();
  const dependencyContainer = await createDependencyContainer(webIdeExtension);

  // browser always has account linked and repo opened.
  await vscode.commands.executeCommand('setContext', 'gitlab:noAccount', false);
  await vscode.commands.executeCommand('setContext', 'gitlab:validState', true);

  // TODO: integrate language server into web IDE duo chat
  const aiContextManager = new AIContextManagerWebIde();
  const languageServerFeatureStateProvider = new LanguageServerFeatureStateProviderImpl();
  const extensionStateService = new DefaultExtensionStateService();
  const diagnosticsService = new DefaultDiagnosticsService(extensionStateService);

  const webviewMessageRegistry = new WebviewMessageRegistryImpl();
  const languageServerManager = new LanguageServerManager(
    context,
    browserLanguageClientFactory,
    dependencyContainer,
    webviewMessageRegistry,
    languageServerFeatureStateProvider,
    getClientContext(),
  );
  languageServerManager.createLanguageClientWrapper = (client: BaseLanguageClient) => {
    const suggestionsManager = new GitLabPlatformManagerForCodeSuggestionsImpl(
      dependencyContainer.gitLabPlatformManager,
    );
    const terminalManager = new TerminalManagerImpl();
    const fileSnapshotProvider = new FileSnapshotProviderImpl();
    const repositoryClient: RepositoryClient = new RepositoryClientImpl();

    // Create DI container for LanguageClientWrapper
    const diServiceCollection = new ServiceCollection();

    context.subscriptions.push(
      vscode.workspace.registerTextDocumentContentProvider(
        FileSnapshotProviderImpl.SCHEME,
        fileSnapshotProvider,
      ),
    );

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
        instance: languageServerFeatureStateProvider,
        aliases: [LanguageServerFeatureStateProvider],
      }),
      createInstanceDescriptor({
        instance: new DefaultLSGitProvider(),
        aliases: [LSGitProviderId],
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
        instance: webviewMessageRegistry,
        aliases: [WebviewMessageRegistry],
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

    wrapper.setCustomPlatformConfig({
      // https://gitlab.com/gitlab-org/editor-extensions/gitlab-lsp/-/blob/bfd233a951b3f4064b69af0cc823560c09ac5cff/packages/lib_config/src/config_service.ts#L125
      webIdeCurrentRef: webIdeExtension.currentRef,

      webIdeProjectPath: webIdeExtension.projectPath,
    });

    // Add suggestionsManager to subscriptions since it's no longer handled by the manager
    context.subscriptions.push(suggestionsManager);

    return wrapper;
  };

  await languageServerManager.startLanguageServer();

  const glStateProvider = new GitLabInstanceVersionProvider(
    dependencyContainer.gitLabPlatformManager,
  );

  extensionStateService.addStateProvider(
    VersionDetailsStateKey,
    new VersionStateProvider(
      context.extension.packageJSON.version,
      languageServerManager,
      glStateProvider,
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
  diagnosticsService.addRenderer(new SettingsStateDiagnosticsRenderer());

  await activateCommon(
    context,
    dependencyContainer,
    outputChannel,
    aiContextManager,
    diagnosticsService,
    languageServerFeatureStateProvider,
  );
};
