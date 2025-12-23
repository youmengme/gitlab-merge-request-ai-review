import vscode from 'vscode';
import { WebviewMessageRegistry } from '../message_handlers';
import { DUO_CHAT_WEBVIEW_ID } from '../../constants';
import { getActiveFileContext, GitLabChatFileContext } from '../../chat/gitlab_chat_file_context';
import {
  getTerminalAIContext,
  TerminalAIContextItem,
} from '../../chat/gitlab_chat_terminal_context';
import { createFakePartial } from '../../test_utils/create_fake_partial';
import { USER_COMMANDS } from '../../command_names';
import { AIContextManager } from '../../chat/ai_context_manager';
import { registerDuoChatCommands } from './duo_chat_commands';
import { LSDuoChatWebviewController } from './duo_chat_controller';

jest.mock('../../chat/gitlab_chat_file_context');
jest.mock('../../chat/gitlab_chat_terminal_context');

describe('registerDuoChatCommands', () => {
  let webviewMessageRegistry: WebviewMessageRegistry;
  let sendNotificationMock: jest.Mock;
  let activeFileContext: GitLabChatFileContext;
  let chatController: LSDuoChatWebviewController;
  let aiContextManager: AIContextManager;

  beforeEach(() => {
    sendNotificationMock = jest.fn();

    webviewMessageRegistry = createFakePartial<WebviewMessageRegistry>({
      sendNotification: sendNotificationMock,
    });

    chatController = createFakePartial<LSDuoChatWebviewController>({
      show: jest.fn(),
      hide: jest.fn(),
    });

    aiContextManager = createFakePartial<AIContextManager>({
      add: jest.fn(),
    });

    jest
      .mocked(vscode.commands.registerCommand)
      .mockReturnValue(createFakePartial<vscode.Disposable>({}));

    activeFileContext = createFakePartial<GitLabChatFileContext>({ fileName: 'test.js' });
    jest.mocked(getActiveFileContext).mockReturnValue(activeFileContext);
    jest.mocked(getTerminalAIContext).mockResolvedValue(undefined);
  });

  it('registers all Duo chat commands', async () => {
    const commands = [
      USER_COMMANDS.EXPLAIN_SELECTED_CODE,
      USER_COMMANDS.EXPLAIN_SELECTED_TERMINAL_OUTPUT,
      USER_COMMANDS.GENERATE_TESTS,
      USER_COMMANDS.REFACTOR_CODE,
      USER_COMMANDS.FIX_CODE,
      USER_COMMANDS.NEW_CHAT_CONVERSATION,
      USER_COMMANDS.CLOSE_CHAT,
    ];

    await registerDuoChatCommands(webviewMessageRegistry, chatController, aiContextManager);

    commands.forEach(command => {
      expect(vscode.commands.registerCommand).toHaveBeenCalledWith(command, expect.any(Function));
    });
  });

  it('returns a disposable when registering Duo chat commands', async () => {
    const spy = jest.spyOn(vscode.Disposable, 'from');
    await registerDuoChatCommands(webviewMessageRegistry, chatController, aiContextManager);
    const callArgs = spy.mock.calls[0];
    expect(callArgs).toHaveLength(8);
    expect(spy).toHaveBeenCalled();
  });

  describe('Running command', () => {
    const testCases = [
      { commandIndex: 0, promptType: 'explainCode', description: 'Explain selected code' },
      // { commandIndex: 1, promptType: 'explainTerminalOutput' tested separately below
      { commandIndex: 2, promptType: 'generateTests', description: 'Generate tests' },
      { commandIndex: 3, promptType: 'refactorCode', description: 'Refactor code' },
      { commandIndex: 4, promptType: 'fixCode', description: 'Fix code' },
      { commandIndex: 5, promptType: 'newConversation', description: 'New chat conversation' },
      { commandIndex: 6, promptType: 'focusChat', description: 'Focus chat' },
    ];

    test.each(testCases)(
      'sends correct notification when "$description" command is executed',
      async ({ commandIndex, promptType }) => {
        await registerDuoChatCommands(webviewMessageRegistry, chatController, aiContextManager);
        const callCommand = jest.mocked(vscode.commands.registerCommand).mock.calls[
          commandIndex
        ][1];

        await callCommand();

        let context = {};

        if (promptType !== 'focusChat') {
          context = { fileContext: activeFileContext };
          expect(chatController.show).toHaveBeenCalled();
        }

        expect(sendNotificationMock).toHaveBeenCalledWith(DUO_CHAT_WEBVIEW_ID, 'newPrompt', {
          prompt: promptType,
          aiContextItems: undefined,
          ...context,
        });
      },
    );

    it('Calls controller when "Close chat" command is executed', async () => {
      await registerDuoChatCommands(webviewMessageRegistry, chatController, aiContextManager);
      const closeChatCommand = jest.mocked(vscode.commands.registerCommand).mock.calls[7][1];
      await closeChatCommand();
      expect(chatController.hide).toHaveBeenCalled();
    });
  });

  describe('Explain terminal output command', () => {
    let mockTerminalContext: TerminalAIContextItem;
    let explainTerminalCommand: () => Promise<void>;

    beforeEach(async () => {
      mockTerminalContext = createFakePartial<TerminalAIContextItem>({
        id: 'test-uuid',
        category: 'terminal',
        content: 'terminal output',
        metadata: {
          enabled: true,
          subType: 'snippet',
          subTypeLabel: 'Selected terminal output',
          icon: 'terminal',
          title: 'Selected command:',
          secondaryText: '',
        },
      });

      await registerDuoChatCommands(webviewMessageRegistry, chatController, aiContextManager);
      explainTerminalCommand = jest
        .mocked(vscode.commands.registerCommand)
        .mock.calls.find(call => call[0] === USER_COMMANDS.EXPLAIN_SELECTED_TERMINAL_OUTPUT)
        ?.at(1);
    });

    it('does nothing when no terminal context is available', async () => {
      jest.mocked(getTerminalAIContext).mockResolvedValue(undefined);

      await explainTerminalCommand();

      expect(getTerminalAIContext).toHaveBeenCalled();
      expect(chatController.show).not.toHaveBeenCalled();
      expect(sendNotificationMock).not.toHaveBeenCalled();
      expect(aiContextManager.add).not.toHaveBeenCalled();
    });

    it('adds context and sends prompt when terminal context is available', async () => {
      jest.mocked(getTerminalAIContext).mockResolvedValue(mockTerminalContext);

      await explainTerminalCommand();

      expect(getTerminalAIContext).toHaveBeenCalled();
      expect(aiContextManager.add).toHaveBeenCalledWith(mockTerminalContext);
      expect(chatController.show).toHaveBeenCalled();
      expect(sendNotificationMock).toHaveBeenCalledWith(DUO_CHAT_WEBVIEW_ID, 'newPrompt', {
        prompt: 'explainTerminalOutput',
        fileContext: activeFileContext,
      });
    });
  });
});
