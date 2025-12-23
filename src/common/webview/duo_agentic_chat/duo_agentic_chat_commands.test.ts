import vscode from 'vscode';
import { WebviewMessageRegistry } from '../message_handlers';
import { AGENTIC_CHAT_WEBVIEW_ID } from '../../constants';
import { createFakePartial } from '../../test_utils/create_fake_partial';
import { USER_COMMANDS } from '../../command_names';
import { LSDuoChatWebviewController } from '../duo_chat/duo_chat_controller';
import { registerDuoAgenticChatCommands } from './duo_agentic_chat_commands';

describe('registerDuoAgenticChatCommands', () => {
  let webviewMessageRegistry: WebviewMessageRegistry;
  let sendNotificationMock: jest.Mock;
  let chatController: LSDuoChatWebviewController;

  const testCases = [
    {
      commandIndex: 0,
      view: 'newConversation',
      description: 'Agentic chat new conversation',
    },
    {
      commandIndex: 1,
      view: 'history',
      description: 'Agentic chat history',
    },
  ];

  beforeEach(() => {
    sendNotificationMock = jest.fn();

    webviewMessageRegistry = createFakePartial<WebviewMessageRegistry>({
      sendNotification: sendNotificationMock,
    });

    chatController = createFakePartial<LSDuoChatWebviewController>({
      show: jest.fn(),
    });

    jest
      .mocked(vscode.commands.registerCommand)
      .mockReturnValue(createFakePartial<vscode.Disposable>({}));
  });

  it('registers all Duo agentic chat commands', async () => {
    const commands = [
      USER_COMMANDS.AGENTIC_CHAT_NEW_CONVERSATION,
      USER_COMMANDS.AGENTIC_CHAT_HISTORY,
    ];

    await registerDuoAgenticChatCommands(webviewMessageRegistry, chatController);

    commands.forEach(command => {
      expect(vscode.commands.registerCommand).toHaveBeenCalledWith(command, expect.any(Function));
    });
  });

  it('returns a disposable when registering Duo Agentic Chat commands', async () => {
    const spy = jest.spyOn(vscode.Disposable, 'from');
    await registerDuoAgenticChatCommands(webviewMessageRegistry, chatController);
    const callArgs = spy.mock.calls[0];
    expect(callArgs).toHaveLength(2);
    expect(spy).toHaveBeenCalled();
  });

  describe('Running commands', () => {
    test.each(testCases)(
      'sends correct notification when "$description" command is executed',
      async ({ commandIndex, view }) => {
        await registerDuoAgenticChatCommands(webviewMessageRegistry, chatController);
        const callCommand = jest.mocked(vscode.commands.registerCommand).mock.calls[
          commandIndex
        ][1];

        await callCommand();

        expect(chatController.show).toHaveBeenCalled();
        expect(sendNotificationMock).toHaveBeenCalledWith(AGENTIC_CHAT_WEBVIEW_ID, 'switchView', {
          view,
        });
      },
    );

    describe('Multiple executions', () => {
      test.each(testCases)(
        'handles multiple executions of the "$description" command',
        async ({ commandIndex, view }) => {
          await registerDuoAgenticChatCommands(webviewMessageRegistry, chatController);
          const callCommand = jest.mocked(vscode.commands.registerCommand).mock.calls[
            commandIndex
          ][1];

          await callCommand();
          await callCommand();
          await callCommand();

          expect(chatController.show).toHaveBeenCalledTimes(3);
          expect(sendNotificationMock).toHaveBeenCalledTimes(3);
          expect(sendNotificationMock).toHaveBeenCalledWith(AGENTIC_CHAT_WEBVIEW_ID, 'switchView', {
            view,
          });
        },
      );
    });
  });

  describe('Error handling', () => {
    test.each(testCases)(
      'handles controller.show() errors gracefully for the "$description" command',
      async ({ commandIndex }) => {
        const showError = new Error('Failed to show chat');
        jest.mocked(chatController.show).mockRejectedValue(showError);

        await registerDuoAgenticChatCommands(webviewMessageRegistry, chatController);
        const callCommand = jest.mocked(vscode.commands.registerCommand).mock.calls[
          commandIndex
        ][1];

        await expect(callCommand()).rejects.toThrow('Failed to show chat');
        expect(sendNotificationMock).not.toHaveBeenCalled();
      },
    );

    test.each(testCases)(
      'handles sendNotification errors gracefully for the "$description" command',
      async ({ commandIndex }) => {
        const notificationError = new Error('Failed to send notification');
        sendNotificationMock.mockRejectedValue(notificationError);

        await registerDuoAgenticChatCommands(webviewMessageRegistry, chatController);
        const callCommand = jest.mocked(vscode.commands.registerCommand).mock.calls[
          commandIndex
        ][1];

        await expect(callCommand()).rejects.toThrow('Failed to send notification');
        expect(chatController.show).toHaveBeenCalled();
      },
    );
  });
});
