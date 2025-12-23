import vscode from 'vscode';
import { WebviewMessageRegistry } from '../message_handlers';
import { DUO_CHAT_WEBVIEW_ID } from '../../constants';
import { getActiveFileContext } from '../../chat/gitlab_chat_file_context';
import { USER_COMMANDS } from '../../command_names';
import { getTerminalAIContext } from '../../chat/gitlab_chat_terminal_context';
import { AIContextManager } from '../../chat/ai_context_manager';
import { LSDuoChatWebviewController } from './duo_chat_controller';

type promptType =
  | 'refactorCode'
  | 'newConversation'
  | 'generateTests'
  | 'fixCode'
  | 'explainCode'
  | 'explainTerminalOutput';

export const registerDuoChatCommands = async (
  webviewMessageRegistry: WebviewMessageRegistry,
  chatController: LSDuoChatWebviewController,
  aiContextManager: AIContextManager,
) => {
  const sendNewPromptWithFileContext = async (promptType: promptType) => {
    await chatController.show();

    await webviewMessageRegistry.sendNotification(DUO_CHAT_WEBVIEW_ID, 'newPrompt', {
      prompt: promptType,
      fileContext: getActiveFileContext(),
    });
  };

  return vscode.Disposable.from(
    vscode.commands.registerCommand(USER_COMMANDS.EXPLAIN_SELECTED_CODE, () =>
      sendNewPromptWithFileContext('explainCode'),
    ),
    vscode.commands.registerCommand(USER_COMMANDS.EXPLAIN_SELECTED_TERMINAL_OUTPUT, async () => {
      const contextItem = await getTerminalAIContext();
      if (!contextItem) {
        return;
      }

      await aiContextManager.add(contextItem);
      await sendNewPromptWithFileContext('explainTerminalOutput');
    }),
    vscode.commands.registerCommand(USER_COMMANDS.GENERATE_TESTS, () =>
      sendNewPromptWithFileContext('generateTests'),
    ),
    vscode.commands.registerCommand(USER_COMMANDS.REFACTOR_CODE, () =>
      sendNewPromptWithFileContext('refactorCode'),
    ),
    vscode.commands.registerCommand(USER_COMMANDS.FIX_CODE, () =>
      sendNewPromptWithFileContext('fixCode'),
    ),
    vscode.commands.registerCommand(USER_COMMANDS.NEW_CHAT_CONVERSATION, () =>
      sendNewPromptWithFileContext('newConversation'),
    ),
    vscode.commands.registerCommand(USER_COMMANDS.FOCUS_CHAT, () =>
      webviewMessageRegistry.sendNotification(DUO_CHAT_WEBVIEW_ID, 'newPrompt', {
        prompt: 'focusChat',
      }),
    ),
    vscode.commands.registerCommand(USER_COMMANDS.CLOSE_CHAT, async () => {
      await chatController.hide();
    }),
  );
};
