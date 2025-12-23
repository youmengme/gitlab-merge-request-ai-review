import * as vscode from 'vscode';
import { InstanceFeatureFlagService } from './feature_flags/instance_feature_flag_service';
import {
  COMMAND_CODE_SUGGESTION_ACCEPTED,
  codeSuggestionAccepted,
} from './code_suggestions/commands/code_suggestion_accepted';
import {
  COMMAND_TOGGLE_CODE_SUGGESTIONS_FOR_LANGUAGE,
  toggleCodeSuggestionsForLanguage,
} from './code_suggestions/commands/toggle_language';
import { createShowOutputCommand } from './show_output_command';
import { activateChat } from './chat/gitlab_chat';
import { setupTelemetry } from './snowplow/setup_telemetry';
import { DependencyContainer } from './dependency_container';
import { setupVersionCheck } from './gitlab/check_version';
import { AIContextManager } from './chat/ai_context_manager';
import { USER_COMMANDS } from './command_names';
import { LanguageServerFeatureStateProvider } from './language_server/language_server_feature_state_provider';
import { diagnosticsCommand } from './diagnostics/diagnostics_command';
import { DiagnosticsService } from './diagnostics/diagnostics_service';
import { DiagnosticsDocumentProvider } from './diagnostics/diagnostics_document_provider';
import { duoTutorial } from './code_suggestions/commands/duo_tutorial';

export const activateCommon = async (
  context: vscode.ExtensionContext,
  container: DependencyContainer,
  outputChannel: vscode.OutputChannel,
  aiContextManager: AIContextManager,
  diagnosticsService: DiagnosticsService,
  languageServerFeatureStateProvider?: LanguageServerFeatureStateProvider,
) => {
  setupTelemetry(context, container.gitLabTelemetryEnvironment);
  const featureFlagService = new InstanceFeatureFlagService(container.gitLabPlatformManager);
  // FIXME: we probably don't have to call this because at the time we activate the service there are no accounts yet, the account service will be initializing a bit later
  await featureFlagService.init();

  context.subscriptions.push(
    setupVersionCheck(container.gitLabPlatformManager, context),
    featureFlagService,
  );
  vscode.workspace.registerTextDocumentContentProvider(
    'gitlab-diagnostics',
    new DiagnosticsDocumentProvider(diagnosticsService),
  );

  const commands = {
    [USER_COMMANDS.SHOW_LOGS]: createShowOutputCommand(outputChannel),
    [USER_COMMANDS.SHOW_DIAGNOSTICS]: diagnosticsCommand,
    [COMMAND_CODE_SUGGESTION_ACCEPTED]: codeSuggestionAccepted,
    [COMMAND_TOGGLE_CODE_SUGGESTIONS_FOR_LANGUAGE]: toggleCodeSuggestionsForLanguage,
    [USER_COMMANDS.DUO_TUTORIAL]: duoTutorial,
    [USER_COMMANDS.SHOW_DIAGNOSTICS_FROM_SIDE_PANEL]: diagnosticsCommand,
  };
  Object.entries(commands).forEach(([cmdName, cmd]) => {
    context.subscriptions.push(vscode.commands.registerCommand(cmdName, cmd));
  });

  await activateChat(
    context,
    container.gitLabPlatformManager,
    aiContextManager,
    languageServerFeatureStateProvider,
  );
};
