import vscode, { QuickPickItem } from 'vscode';
import { CONFIG_NAMESPACE } from '../constants';
import { getDuoCodeSuggestionsConfiguration } from '../utils/extension_configuration';
import { VisibleCodeSuggestionsState } from '../code_suggestions/code_suggestions_state_manager';
import { USER_COMMANDS } from '../command_names';
import {
  CODE_SUGGESTIONS_ENABLED,
  CODE_SUGGESTIONS_DISABLED,
  CODE_SUGGESTIONS_DESCRIPTION,
  DUO_UNAVAILABLE,
  DUO_CHAT_ENABLED,
  DUO_CHAT_DISABLED,
  ENABLE_CODE_SUGGESTIONS,
  DISABLE_CODE_SUGGESTIONS,
  NOT_AUTHENTICATED,
  DUO_STATUS_ZERO_PROBLEMS_DETECTED,
} from './constants';

export const generateQuickPickItem = (
  label: string,
  description?: string,
): vscode.QuickPickItem => ({
  label,
  description,
});

const getCurrentFileLanguage = (): string | undefined => {
  const activeEditor = vscode.window.activeTextEditor;
  return activeEditor ? activeEditor.document.languageId : undefined;
};

const isLanguageEnabled = (language: string) => {
  const { enabledSupportedLanguages, additionalLanguages } = getDuoCodeSuggestionsConfiguration();
  return enabledSupportedLanguages[language] || additionalLanguages.includes(language);
};

export const generateCodeSuggestionsStatusItem = (
  globallyEnabled: boolean,
): vscode.QuickPickItem => {
  let isEnabled = globallyEnabled;
  const language = getCurrentFileLanguage();
  if (language) {
    isEnabled = globallyEnabled && isLanguageEnabled(language);
  }
  const label = isEnabled ? CODE_SUGGESTIONS_ENABLED : CODE_SUGGESTIONS_DISABLED;
  return generateQuickPickItem(label, CODE_SUGGESTIONS_DESCRIPTION);
};

const authenticateUser = () => vscode.commands.executeCommand(USER_COMMANDS.AUTHENTICATE);

export const generateDuoUnavailableStatusItem = (
  state: VisibleCodeSuggestionsState,
): [QuickPickItem, () => void] => {
  switch (state) {
    case VisibleCodeSuggestionsState.NO_ACCOUNT:
      return [generateQuickPickItem(DUO_UNAVAILABLE, NOT_AUTHENTICATED), () => authenticateUser()];
    default:
      return [generateQuickPickItem(DUO_UNAVAILABLE), () => {}];
  }
};

export const generateDuoChatStatusItem = (): vscode.QuickPickItem => {
  const workspaceConfig = vscode.workspace.getConfiguration(CONFIG_NAMESPACE);
  const label = workspaceConfig?.duoChat?.enabled ? DUO_CHAT_ENABLED : DUO_CHAT_DISABLED;
  return generateQuickPickItem(label);
};

export const generateCodeSuggestionsToggleItem = (enabled: boolean): vscode.QuickPickItem => {
  const label = enabled ? DISABLE_CODE_SUGGESTIONS : ENABLE_CODE_SUGGESTIONS;
  return generateQuickPickItem(label);
};

export const generateCodeSuggestionsLangToggleItem = (
  globallyEnabled: boolean,
): vscode.QuickPickItem | undefined => {
  let quickPickItem;
  const language = getCurrentFileLanguage();

  if (globallyEnabled && language) {
    const action = isLanguageEnabled(language) ? DISABLE_CODE_SUGGESTIONS : ENABLE_CODE_SUGGESTIONS;
    const label = `${action} for ${language}`;

    quickPickItem = generateQuickPickItem(label);
  }

  return quickPickItem;
};

export const generateDuoDiagnosticsStatusItem = (state: string): vscode.QuickPickItem => {
  if (state === VisibleCodeSuggestionsState.NO_LICENSE) {
    const label = '$(error) Status: 1 problem detected, contact your GitLab administrator.';
    const description = 'Duo license not assigned.';
    return generateQuickPickItem(label, description);
  }

  if (
    state === VisibleCodeSuggestionsState.ERROR ||
    state === VisibleCodeSuggestionsState.SUGGESTIONS_API_ERROR
  ) {
    const label = '$(error) Status: Code Suggestion requests to API are failing.';
    const description = 'See logs for more details.';

    return generateQuickPickItem(label, description);
  }

  return generateQuickPickItem(DUO_STATUS_ZERO_PROBLEMS_DETECTED);
};
