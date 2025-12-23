import * as vscode from 'vscode';
import { GitLabPlatformManager } from '../platform/gitlab_platform';
import { createFakePartial } from '../test_utils/create_fake_partial';
import { QuickChat } from '../quick_chat/quick_chat';
import { insertQuickChatSnippetCommand } from '../quick_chat/utils';
import {
  getLocalFeatureFlagService,
  LocalFeatureFlagService,
} from '../feature_flags/local_feature_flag_service';
import { LanguageServerFeatureStateProvider } from '../language_server/language_server_feature_state_provider';
import { activateChat } from './gitlab_chat';
import { GitLabChatController } from './gitlab_chat_controller';
import { isDuoChatAvailable } from './utils/chat_availability_utils';
import { AIContextManager } from './ai_context_manager';
import { ChatStateManager, ChatState } from './chat_state_manager';

jest.mock('vscode');
jest.mock('./utils/chat_availability_utils');
jest.mock('../quick_chat/quick_chat');
jest.mock('../feature_flags/local_feature_flag_service');
jest.mock('./chat_state_manager');

describe('activateChat', () => {
  let context: vscode.ExtensionContext;
  let gitlabPlatformManager: GitLabPlatformManager;
  const aiContextManager = createFakePartial<AIContextManager>({});
  const isLanguageServerEnabledMock = jest.fn().mockReturnValue(false);
  const mockChatStateManagerOnChange = jest.fn();
  const mockProjectPlatform = {
    project: { namespaceWithPath: 'group/project' },
  };
  let triggerChatStateManagerChange: (params: ChatState) => void;

  jest.mocked(ChatStateManager).mockImplementation(() =>
    createFakePartial<ChatStateManager>({
      onChange: mockChatStateManagerOnChange,
    }),
  );

  beforeEach(() => {
    gitlabPlatformManager = createFakePartial<GitLabPlatformManager>({
      onAccountChange: jest.fn(handler => handler()),
      getForActiveProject: jest.fn().mockResolvedValue(mockProjectPlatform),
    });
    context = {
      subscriptions: [],
      extensionUri: vscode.Uri.file('/foo/bar'),
    } as Partial<vscode.ExtensionContext> as vscode.ExtensionContext;

    vscode.window.registerWebviewViewProvider = jest.fn();

    vscode.commands.registerCommand = jest
      .fn()
      .mockReturnValueOnce('command1')
      .mockReturnValueOnce('command2')
      .mockReturnValueOnce('command3')
      .mockReturnValueOnce('command4')
      .mockReturnValueOnce('command5')
      .mockReturnValueOnce('command6')
      .mockReturnValueOnce('command7')
      .mockReturnValueOnce('command8')
      .mockReturnValueOnce('command9')
      .mockReturnValueOnce('command10');

    jest
      .mocked(getLocalFeatureFlagService)
      .mockReturnValue(
        createFakePartial<LocalFeatureFlagService>({ isEnabled: isLanguageServerEnabledMock }),
      );

    mockChatStateManagerOnChange.mockImplementation(_callback => {
      triggerChatStateManagerChange = _callback;
    });
  });

  it('registers view provider', async () => {
    await activateChat(context, gitlabPlatformManager, aiContextManager);

    expect(vscode.window.registerWebviewViewProvider).toHaveBeenCalledWith(
      'gl.chatView',
      expect.any(GitLabChatController),
    );
  });

  it('registers commands', async () => {
    await activateChat(context, gitlabPlatformManager, aiContextManager);

    expect(vscode.commands.registerCommand).toHaveBeenNthCalledWith(
      1,
      'gl.openChat',
      expect.any(Function),
    );
    expect(vscode.commands.registerCommand).toHaveBeenNthCalledWith(
      2,
      'gl.explainSelectedCode',
      expect.any(Function),
    );
    expect(vscode.commands.registerCommand).toHaveBeenNthCalledWith(
      3,
      'gl.generateTests',
      expect.any(Function),
    );
    expect(vscode.commands.registerCommand).toHaveBeenNthCalledWith(
      4,
      'gl.refactorCode',
      expect.any(Function),
    );
    expect(vscode.commands.registerCommand).toHaveBeenNthCalledWith(
      5,
      'gl.fixCode',
      expect.any(Function),
    );
    expect(vscode.commands.registerCommand).toHaveBeenNthCalledWith(
      6,
      'gl.newChatConversation',
      expect.any(Function),
    );
    expect(vscode.commands.registerCommand).toHaveBeenNthCalledWith(
      7,
      'gl.copyCodeSnippetFromQuickChat',
      expect.any(Function),
    );
    expect(vscode.commands.registerCommand).toHaveBeenNthCalledWith(
      8,
      'gl.insertCodeSnippetFromQuickChat',
      insertQuickChatSnippetCommand,
    );
    expect(vscode.commands.registerCommand).toHaveBeenNthCalledWith(
      9,
      'gl.closeChat',
      expect.any(Function),
    );

    expect(vscode.commands.registerCommand).toHaveBeenNthCalledWith(
      10,
      'gl.focusChat',
      expect.any(Function),
    );
    expect(context.subscriptions[2]).toEqual('command1');
    expect(context.subscriptions[3]).toEqual('command2');
    expect(context.subscriptions[4]).toEqual('command3');
    expect(context.subscriptions[5]).toEqual('command4');
    expect(context.subscriptions[6]).toEqual('command5');
    expect(context.subscriptions[7]).toEqual('command6');
    expect(context.subscriptions[8]).toEqual('command7');
    expect(context.subscriptions[9]).toEqual('command8');
    expect(context.subscriptions[10]).toEqual('command9');
    expect(context.subscriptions[11]).toEqual('command10');
  });

  describe('Chat state', () => {
    describe('when Language Server is enabled ', () => {
      beforeEach(async () => {
        isLanguageServerEnabledMock.mockReturnValue(true);
        const languageServerFeatureStateProvider =
          createFakePartial<LanguageServerFeatureStateProvider>({});
        await activateChat(
          context,
          gitlabPlatformManager,
          aiContextManager,
          languageServerFeatureStateProvider,
        );
      });

      it('should create "ChatStateManager" to handle chat availability', () => {
        expect(ChatStateManager).toHaveBeenCalled();
      });

      describe('Quick chat', () => {
        it('creates quick chat when chat is available', async () => {
          triggerChatStateManagerChange(
            createFakePartial<ChatState>({
              chatAvailable: true,
            }),
          );

          await activateChat(context, gitlabPlatformManager, aiContextManager);

          // Verify QuickChat was created
          expect(QuickChat).toHaveBeenCalled();
        });

        it('disposes quick chat when chat becomes unavailable', async () => {
          const mockQuickChat = createFakePartial<QuickChat>({
            dispose: jest.fn(),
          });
          jest.mocked(QuickChat).mockReturnValue(mockQuickChat);
          // First make chat available
          triggerChatStateManagerChange(
            createFakePartial<ChatState>({
              chatAvailable: true,
            }),
          );

          await activateChat(context, gitlabPlatformManager, aiContextManager);

          // Then simulate chat state change
          triggerChatStateManagerChange(
            createFakePartial<ChatState>({
              chatAvailable: false,
            }),
          );

          // Verify
          expect(mockQuickChat.dispose).toHaveBeenCalled();
        });

        it('does not create quick chat if chat is unavailable', async () => {
          triggerChatStateManagerChange(
            createFakePartial<ChatState>({
              chatAvailable: false,
            }),
          );

          await activateChat(context, gitlabPlatformManager, aiContextManager);

          expect(QuickChat).not.toHaveBeenCalled();
        });
      });
    });

    describe('when Language Server is disabled', () => {
      beforeEach(async () => {
        isLanguageServerEnabledMock.mockReturnValue(false);
        await activateChat(context, gitlabPlatformManager, aiContextManager);
      });

      it('should not create "ChatStateManager"', () => {
        expect(ChatStateManager).not.toHaveBeenCalled();
      });

      it('should listen to the account changes', async () => {
        jest.mocked(isDuoChatAvailable).mockResolvedValueOnce(true);

        await activateChat(context, gitlabPlatformManager, aiContextManager);
        expect(gitlabPlatformManager.onAccountChange).toHaveBeenCalled();
      });
    });

    describe('Quick chat', () => {
      it('creates quick chat when chat is available', async () => {
        jest.mocked(isDuoChatAvailable).mockResolvedValueOnce(true);

        await activateChat(context, gitlabPlatformManager, aiContextManager);

        // Verify QuickChat was created and subscribed
        expect(context.subscriptions).toContainEqual(
          expect.objectContaining({
            dispose: expect.any(Function),
          }),
        );
      });

      it('disposes quick chat when chat becomes unavailable', async () => {
        const mockQuickChat = createFakePartial<QuickChat>({
          dispose: jest.fn(),
        });
        jest.mocked(QuickChat).mockReturnValue(mockQuickChat);
        // First make chat available
        jest.mocked(isDuoChatAvailable).mockResolvedValueOnce(true);
        await activateChat(context, gitlabPlatformManager, aiContextManager);

        // Then simulate account change making chat unavailable
        jest.mocked(isDuoChatAvailable).mockResolvedValueOnce(false);
        await jest.mocked(gitlabPlatformManager.onAccountChange).mock.calls[0][0]();

        // Verify
        expect(mockQuickChat.dispose).toHaveBeenCalled();
      });

      it('does not create quick chat if chat is unavailable', async () => {
        jest.mocked(isDuoChatAvailable).mockResolvedValueOnce(false);

        await activateChat(context, gitlabPlatformManager, aiContextManager);

        expect(QuickChat).not.toHaveBeenCalled();
      });
    });
  });

  describe('gitlab:chatAvailable', () => {
    it.each([
      [true, true],
      [false, false],
    ])('is %s when isDuoChatAvailable is %s', async (available, expected) => {
      // first set the opposite value
      jest.mocked(isDuoChatAvailable).mockResolvedValueOnce(!available);
      await activateChat(context, gitlabPlatformManager, aiContextManager);

      // then execute the test
      jest.mocked(vscode.commands.executeCommand).mockClear();
      jest.mocked(isDuoChatAvailable).mockResolvedValueOnce(available);

      await jest.mocked(gitlabPlatformManager.onAccountChange).mock.calls[0][0]();
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'setContext',
        'gitlab:chatAvailable',
        expected,
      );
    });
  });
});
