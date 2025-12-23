import vscode from 'vscode';
import { WebviewMessageRegistry } from '../message_handlers';
import { AGENTIC_CHAT_WEBVIEW_ID } from '../../constants';
import { USER_COMMANDS } from '../../command_names';
import { LSDuoChatWebviewController } from '../duo_chat/duo_chat_controller';

export const registerDuoAgenticChatCommands = async (
  webviewMessageRegistry: WebviewMessageRegistry,
  chatController: LSDuoChatWebviewController,
) => {
  const sendNewViewPrompt = async (view: string) => {
    await chatController.show();

    await webviewMessageRegistry.sendNotification(AGENTIC_CHAT_WEBVIEW_ID, 'switchView', {
      view,
    });
  };

  return vscode.Disposable.from(
    vscode.commands.registerCommand(USER_COMMANDS.AGENTIC_CHAT_NEW_CONVERSATION, () => {
      return sendNewViewPrompt('newConversation');
    }),
    vscode.commands.registerCommand(USER_COMMANDS.AGENTIC_CHAT_HISTORY, () => {
      return sendNewViewPrompt('history');
    }),
  );
};
