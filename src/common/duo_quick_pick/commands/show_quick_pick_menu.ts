import vscode from 'vscode';
import { CONFIG_NAMESPACE } from '../../constants';
import { USER_COMMANDS, VS_COMMANDS } from '../../command_names';
import { COMMAND_OPEN_GITLAB_CHAT } from '../../chat/commands/open_gitlab_chat';
import {
  generateCodeSuggestionsStatusItem,
  generateDuoChatStatusItem,
  generateCodeSuggestionsToggleItem,
  generateCodeSuggestionsLangToggleItem,
  generateQuickPickItem,
  generateDuoUnavailableStatusItem,
  generateDuoDiagnosticsStatusItem,
} from '../utils';
import {
  CODE_SUGGESTIONS_DISABLED_NOTIFICATION,
  NO_ACTIVE_EDITOR_NOTIFICATION,
  DUO_CHAT_DISABLED_NOTIFICATION,
  DUO_SETTINGS,
  GITLAB_WORKFLOW_SETTINGS_ANCHOR,
  DOCUMENTATION,
  DOCUMENTATION_URL,
  GITLAB_FORUM,
  GITLAB_FORUM_DESCRIPTION,
  GITLAB_FORUM_URL,
} from '../constants';
import { CodeSuggestionsStateManager } from '../../code_suggestions/code_suggestions_state_manager';
import { COMMAND_TOGGLE_CODE_SUGGESTIONS } from '../../code_suggestions/commands/toggle';
import { COMMAND_TOGGLE_CODE_SUGGESTIONS_FOR_LANGUAGE } from '../../code_suggestions/commands/toggle_language';

export const SHOW_QUICK_PICK_MENU = 'gl.showDuoQuickPickMenu';

const focusActiveEditor = (codeSuggestionsEnabled: boolean) => {
  if (!codeSuggestionsEnabled)
    return vscode.window.showInformationMessage(CODE_SUGGESTIONS_DISABLED_NOTIFICATION);

  const activeEditor = vscode.window.activeTextEditor;
  if (!activeEditor) return vscode.window.showInformationMessage(NO_ACTIVE_EDITOR_NOTIFICATION);

  return vscode.window.showTextDocument(activeEditor.document);
};

const openDuoChat = () => {
  const workspaceConfig = vscode.workspace.getConfiguration(CONFIG_NAMESPACE);
  const duoChatEnabled = workspaceConfig?.duoChat?.enabled;
  if (!duoChatEnabled) return vscode.window.showInformationMessage(DUO_CHAT_DISABLED_NOTIFICATION);

  return vscode.commands.executeCommand(COMMAND_OPEN_GITLAB_CHAT);
};

const toggleCodeSuggestions = () => vscode.commands.executeCommand(COMMAND_TOGGLE_CODE_SUGGESTIONS);
const toggleCodeSuggestionsForLanguage = () =>
  vscode.commands.executeCommand(COMMAND_TOGGLE_CODE_SUGGESTIONS_FOR_LANGUAGE);
const openDuoSettings = () =>
  vscode.commands.executeCommand(VS_COMMANDS.OPEN_SETTINGS, GITLAB_WORKFLOW_SETTINGS_ANCHOR);
const openDocumentation = () => vscode.env.openExternal(vscode.Uri.parse(DOCUMENTATION_URL));
const openGitLabForum = () => vscode.env.openExternal(vscode.Uri.parse(GITLAB_FORUM_URL));
const showExtensionLogs = () => vscode.commands.executeCommand(USER_COMMANDS.SHOW_LOGS);

export const showDuoQuickPickMenu = async ({
  stateManager,
}: {
  stateManager: CodeSuggestionsStateManager;
}) => {
  const statusItems: vscode.QuickPickItem[] = [];
  const toggleItems: vscode.QuickPickItem[] = [];
  const codeSuggestionsEnabled = !stateManager.isDisabledByUser();
  const isMissingAccount = stateManager.isMissingAccount();
  const codeSuggestionsStatusItem = generateCodeSuggestionsStatusItem(codeSuggestionsEnabled);
  const duoChatStatusItem = generateDuoChatStatusItem();
  const [duoUnavaiableStatusItem, duoUnavailableAction] = generateDuoUnavailableStatusItem(
    stateManager.getVisibleState(),
  );
  const codeSuggestionsToggleItem = generateCodeSuggestionsToggleItem(codeSuggestionsEnabled);
  const codeSuggestionsLanguageToggleItem =
    generateCodeSuggestionsLangToggleItem(codeSuggestionsEnabled);
  const duoDiagnosticsStatusItem = generateDuoDiagnosticsStatusItem(stateManager.getVisibleState());
  if (!isMissingAccount) {
    statusItems.push(codeSuggestionsStatusItem, duoChatStatusItem);
    toggleItems.push(
      ...[
        ...(codeSuggestionsLanguageToggleItem ? [codeSuggestionsLanguageToggleItem] : []),
        codeSuggestionsToggleItem,
      ],
    );
  } else {
    statusItems.push(duoUnavaiableStatusItem);
  }
  const separatorItem = { label: '', kind: vscode.QuickPickItemKind.Separator };
  const duoSettingsItem = generateQuickPickItem(DUO_SETTINGS);
  const documentationItem = generateQuickPickItem(DOCUMENTATION);
  const gitlabForumItem = generateQuickPickItem(GITLAB_FORUM, GITLAB_FORUM_DESCRIPTION);
  const quickPick = vscode.window.createQuickPick();
  const quickPickItems = [
    duoDiagnosticsStatusItem,
    separatorItem,
    ...statusItems,
    separatorItem,
    ...toggleItems,
    separatorItem,
    duoSettingsItem,
    documentationItem,
    gitlabForumItem,
  ];

  quickPick.items = quickPickItems;

  quickPick.onDidChangeSelection(async selection => {
    switch (selection[0]) {
      case duoDiagnosticsStatusItem:
        await showExtensionLogs();
        break;
      case codeSuggestionsStatusItem:
        await focusActiveEditor(codeSuggestionsEnabled);
        break;
      case duoChatStatusItem:
        await openDuoChat();
        break;
      case codeSuggestionsToggleItem:
        await toggleCodeSuggestions();
        break;
      case duoUnavaiableStatusItem:
        await duoUnavailableAction();
        break;
      case codeSuggestionsLanguageToggleItem:
        await toggleCodeSuggestionsForLanguage();
        break;
      case duoSettingsItem:
        await openDuoSettings();
        break;
      case documentationItem:
        await openDocumentation();
        break;
      case gitlabForumItem:
        await openGitLabForum();
        break;
      default:
        break;
    }

    quickPick.hide();
  });

  quickPick.onDidHide(() => quickPick.dispose());
  quickPick.show();
};
