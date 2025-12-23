import vscode, { CommentOptions } from 'vscode';
import { Cable } from '@anycable/core';
import { createMockTextDocument } from '../__mocks__/mock_text_document';
import { SPECIAL_MESSAGES } from '../chat/constants';
import { createFakePartial } from '../test_utils/create_fake_partial';
import { ConversationType, GitLabChatApi } from '../chat/gitlab_chat_api';
import { asMutable } from '../test_utils/types';
import { createFakeWorkspaceConfiguration } from '../test_utils/vscode_fakes';
import { QuickChat } from './quick_chat';
import {
  COMMAND_CLOSE_QUICK_CHAT,
  COMMAND_OPEN_QUICK_CHAT,
  COMMAND_OPEN_QUICK_CHAT_WITH_SHORTCUT,
  COMMAND_QUICK_CHAT_MESSAGE_TELEMETRY,
  COMMAND_QUICK_CHAT_OPEN_TELEMETRY,
  COMMAND_SEND_QUICK_CHAT,
  COMMAND_SEND_QUICK_CHAT_DUPLICATE,
  COMMAND_SHOW_AND_SEND_QUICK_CHAT_WITH_CONTEXT,
  QUICK_CHAT_OPEN_TRIGGER,
} from './constants';
import * as utils from './utils';
import { QuickChatCommentThreadService } from './comment_thread_service';
import { QuickChatHint } from './quick_chat_hint';
import { QuickChatResponseProcessor } from './response_processor';
import { FixWithDuoQuickChatActionProvider } from './code_actions/fix_with_duo_quick_chat_action_provider';
import { QuickChatGutterIcon } from './quick_chat_gutter_icon';
import { QuickChatOpenOptionsWithSelection, QuickChatState } from './quick_chat_state';

jest.mock('../chat/gitlab_chat_api');
jest.mock('./comment_thread_service');
jest.mock('./quick_chat_gutter_icon');
jest.mock('./quick_chat_hint');
jest.mock('./response_processor');

const mockCommentController = createFakePartial<vscode.CommentController>({
  createCommentThread: jest.fn(),
  options: createFakePartial<CommentOptions>({}),
  dispose: jest.fn(),
});

jest.mock('./utils', () => {
  const originalModule = jest.requireActual('./utils');
  const mockModule = jest.createMockFromModule<typeof originalModule>('./utils');

  return {
    ...mockModule,
    MarkdownProcessorPipeline: jest.fn().mockImplementation(() => ({
      process: jest.fn(md => md),
    })),
    generateThreadLabel: jest.fn(() => 'Duo Quick Chat'),
    openAndShowDocument: jest.fn().mockResolvedValue(createFakePartial<vscode.TextEditor>({})),
  };
});

const mockDebug = jest.fn();

jest.mock('../log', () => {
  const originalModule = jest.requireActual('../log');
  const mockModule = jest.createMockFromModule<typeof originalModule>('../log');

  return {
    ...mockModule,
    log: {
      debug: jest.fn().mockImplementation(msg => mockDebug(msg)),
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    },
  };
});

const mockStateMachine = {
  start: jest.fn(),
  send: jest.fn(),
  subscribe: jest.fn(),
  stop: jest.fn(),
  getSnapshot: jest.fn(),
};

jest.mock('./quick_chat_state', () => {
  const originalModule = jest.requireActual('./quick_chat_state');
  const mockModule = jest.createMockFromModule<typeof originalModule>('./quick_chat_state');
  return {
    ...mockModule,
    createQuickChatMachine: jest.fn().mockImplementation(() => mockStateMachine),
  };
});

describe('QuickChat', () => {
  let quickChat: QuickChat;
  let mockApi: GitLabChatApi;
  let mockConfig: vscode.WorkspaceConfiguration;
  let mockThread: vscode.CommentThread;
  let mockUri: vscode.Uri;
  let mockCommentThreadService: QuickChatCommentThreadService;
  let mockHint: QuickChatHint;
  let mockGutterIcon: QuickChatGutterIcon;
  let mockResponseProcessor: QuickChatResponseProcessor;

  beforeEach(() => {
    mockUri = vscode.Uri.file('/path/to/file.ts');

    mockApi = createFakePartial<GitLabChatApi>({
      clearChat: jest.fn().mockResolvedValue({}),
      resetChat: jest.fn().mockResolvedValue({}),
      subscribeToUpdates: jest.fn(),
      processNewUserPrompt: jest.fn(),
    });

    (GitLabChatApi as jest.MockedClass<typeof GitLabChatApi>).mockImplementation(() => mockApi);

    mockConfig = createFakeWorkspaceConfiguration({
      keybindingHints: { enabled: true },
    });
    jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue(mockConfig);

    mockThread = createFakePartial<vscode.CommentThread>({
      uri: mockUri,
      comments: [],
      range: new vscode.Range(0, 0, 0, 0),
    });
    const mockExtensionContext = createFakePartial<vscode.ExtensionContext>({
      extensionUri: vscode.Uri.file('/path/to/extension'),
    });
    mockCommentThreadService = new QuickChatCommentThreadService();
    mockHint = new QuickChatHint();
    jest.mocked(QuickChatHint).mockReturnValue(mockHint);
    mockGutterIcon = new QuickChatGutterIcon(mockExtensionContext);
    const mockMardownProcessorPipeline = createFakePartial<utils.MarkdownProcessorPipeline>({});
    mockResponseProcessor = new QuickChatResponseProcessor(mockMardownProcessorPipeline);

    jest.mocked(vscode.comments.createCommentController).mockReturnValue(mockCommentController);

    quickChat = new QuickChat(
      mockApi,
      mockCommentThreadService,
      mockGutterIcon,
      mockResponseProcessor,
    );
  });

  const triggerTextEditorSelectionChange = (e: vscode.TextEditorSelectionChangeEvent) => {
    jest
      .mocked(vscode.window.onDidChangeTextEditorSelection)
      .mock.calls.forEach(([listener]) => listener(e));
  };

  async function showChatWithEditor(userInput = 'Test question') {
    const cursorPosition = new vscode.Position(1, 11);
    const mockRange = new vscode.Range(new vscode.Position(1, 0), cursorPosition);
    const mockDocument = createMockTextDocument({
      uri: mockUri,
      content: 'full document content\nsecond line\nthird line',
    });
    const mockEditor = createFakePartial<vscode.TextEditor>({
      document: mockDocument,
      selection: {
        ...mockRange,
        active: cursorPosition,
      },
      setDecorations: jest.fn(),
    });
    asMutable(vscode.window).activeTextEditor = mockEditor;
    asMutable(vscode.workspace).asRelativePath = jest.fn().mockReturnValue(mockUri.path);

    jest.mocked(mockCommentThreadService.createCommentThread).mockReturnValue(mockThread);

    jest.spyOn(vscode.window, 'showInputBox').mockResolvedValue(userInput);

    await quickChat.triggerNewChat();

    return { mockRange, mockEditor };
  }

  it('registers commands', () => {
    expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
      COMMAND_OPEN_QUICK_CHAT,
      expect.any(Function),
    );
    expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
      COMMAND_SEND_QUICK_CHAT,
      expect.any(Function),
    );
    expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
      COMMAND_SEND_QUICK_CHAT_DUPLICATE,
      expect.any(Function),
    );
    expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
      COMMAND_OPEN_QUICK_CHAT_WITH_SHORTCUT,
      expect.any(Function),
    );
    expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
      COMMAND_CLOSE_QUICK_CHAT,
      expect.any(Function),
    );
    expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
      COMMAND_SHOW_AND_SEND_QUICK_CHAT_WITH_CONTEXT,
      expect.any(Function),
    );
    expect(vscode.commands.registerCommand).toHaveBeenCalledTimes(6);
  });

  it('disposes commands', () => {
    const disposeHandler = jest.fn();
    jest.mocked(vscode.commands.registerCommand).mockReturnValue({ dispose: disposeHandler });
    quickChat = new QuickChat(
      mockApi,
      mockCommentThreadService,
      mockGutterIcon,
      mockResponseProcessor,
    );
    quickChat.dispose();
    expect(disposeHandler).toHaveBeenCalledTimes(6);
  });

  describe('triggerNewChat', () => {
    beforeEach(() => {
      jest.spyOn(quickChat, 'triggerNewChat');
    });

    describe('with no open options', () => {
      it('when an editor is active', async () => {
        await showChatWithEditor();
        expect(quickChat.triggerNewChat).toHaveBeenCalled();
        expect(mockStateMachine.send).toHaveBeenCalledWith({
          type: 'triggerQuickChat',
          openOptions: undefined,
        });
      });

      it('does nothing when no editor is active', async () => {
        asMutable(vscode.window).activeTextEditor = undefined;

        expect(quickChat.triggerNewChat).not.toHaveBeenCalled();
      });

      it('tracks telemetry event for chat open', async () => {
        await showChatWithEditor();

        expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
          COMMAND_QUICK_CHAT_OPEN_TELEMETRY,
          { trigger: QUICK_CHAT_OPEN_TRIGGER.CLICK },
        );
      });

      it('tracks telemetry event for code action chat open', async () => {
        const openOptions = {
          trigger: QUICK_CHAT_OPEN_TRIGGER.CODE_ACTION_FIX_WITH_DUO,
          document: createMockTextDocument(),
          range: new vscode.Range(0, 0, 1, 0),
        };

        await quickChat.triggerNewChat(openOptions);

        expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
          COMMAND_QUICK_CHAT_OPEN_TELEMETRY,
          { trigger: QUICK_CHAT_OPEN_TRIGGER.CODE_ACTION_FIX_WITH_DUO },
        );
      });
    });
  });

  describe('sendMessageCallback', () => {
    let mockReply: vscode.CommentReply;
    let updateHandler: jest.Mock;

    describe('with no open options', () => {
      beforeEach(() => {
        mockReply = createFakePartial<vscode.CommentReply>({
          thread: mockThread,
          text: 'Test question',
        });
        jest.mocked(mockStateMachine.getSnapshot).mockReturnValue({
          context: {},
        });
        updateHandler = jest.fn();
        jest.mocked(mockApi.subscribeToUpdates).mockImplementation(handler => {
          updateHandler.mockImplementation(handler);
          return Promise.resolve({} as Cable);
        });

        return showChatWithEditor();
      });

      it('passes the conversationType as DUO_QUICK_CHAT', async () => {
        await quickChat.handleSendMessage({ reply: mockReply });

        expect(mockApi.processNewUserPrompt).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(String),
          expect.any(Object),
          undefined,
          ConversationType.DUO_QUICK_CHAT,
          undefined,
        );
      });

      it('opens and shows the document before sending the question', async () => {
        await quickChat.handleSendMessage({ reply: mockReply });

        expect(utils.openAndShowDocument).toHaveBeenCalledWith(mockReply.thread.uri);
      });

      it('build context from active editor document and selection', async () => {
        await quickChat.handleSendMessage({ reply: mockReply });

        expect(mockApi.processNewUserPrompt).toHaveBeenCalledWith(
          'Test question',
          expect.any(String),
          expect.objectContaining({
            fileName: '/path/to/file.ts',
            selectedText: 'second line',
          }),
          undefined,
          ConversationType.DUO_QUICK_CHAT,
          undefined,
        );
      });

      it('tracks telemetry for sending messages', async () => {
        const userInput = 'Test message';
        mockReply.text = userInput;

        await quickChat.handleSendMessage({ reply: mockReply });

        expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
          COMMAND_QUICK_CHAT_MESSAGE_TELEMETRY,
          { message: userInput },
        );
      });

      describe('when response contains threadId', () => {
        const mockThreadId = 'gid://gitlab/FooThread/123';

        beforeEach(() => {
          jest.mocked(mockApi.processNewUserPrompt).mockResolvedValue({
            aiAction: { requestId: 'req-123', errors: [], threadId: mockThreadId },
          });
          jest.mocked(mockStateMachine.getSnapshot).mockReturnValue({
            context: {
              aiActionThreadId: mockThreadId,
            },
          });
        });

        it('stores the threadId when API response includes one for subsequent messages', async () => {
          await quickChat.handleSendMessage({ reply: mockReply });
          jest.mocked(mockApi.processNewUserPrompt).mockClear();

          await quickChat.handleSendMessage({ reply: mockReply });

          expect(mockApi.processNewUserPrompt).toHaveBeenCalledWith(
            'Test question',
            expect.any(String),
            expect.objectContaining({
              fileName: '/path/to/file.ts',
              selectedText: 'second line',
            }),
            undefined,
            ConversationType.DUO_QUICK_CHAT,
            mockThreadId,
          );
        });

        it('"/clear" sends event to state machine', async () => {
          await quickChat.handleSendMessage({ reply: mockReply });

          mockReply.text = SPECIAL_MESSAGES.CLEAR;
          await quickChat.handleSendMessage({ reply: mockReply });

          expect(mockStateMachine.send).toHaveBeenCalledWith({
            type: 'executeSpecialCommand',
            command: SPECIAL_MESSAGES.CLEAR,
          });
        });

        it('"/reset" sends event to state machine', async () => {
          await quickChat.handleSendMessage({ reply: mockReply });

          mockReply.text = SPECIAL_MESSAGES.RESET;
          await quickChat.handleSendMessage({ reply: mockReply });

          expect(mockStateMachine.send).toHaveBeenCalledWith({
            type: 'executeSpecialCommand',
            command: SPECIAL_MESSAGES.RESET,
          });
        });
      });
    });

    describe('with open options', () => {
      let customDocument: vscode.TextDocument;
      let customRange: vscode.Range;
      let openOptions: QuickChatOpenOptionsWithSelection;

      beforeEach(async () => {
        customDocument = createMockTextDocument({
          uri: vscode.Uri.file('/custom/file.ts'),
          content: 'custom document content\ncustom second line\ncustom third line',
        });
        customRange = new vscode.Range(2, 0, 2, 12);

        openOptions = {
          trigger: QUICK_CHAT_OPEN_TRIGGER.CLICK,
          document: customDocument,
          range: customRange,
        };

        jest.mocked(mockStateMachine.getSnapshot).mockReturnValue({
          context: {},
        });

        mockReply = createFakePartial<vscode.CommentReply>({
          thread: mockThread,
          text: 'Test question',
        });

        await showChatWithEditor();
        asMutable(vscode.workspace).asRelativePath = jest
          .fn()
          .mockReturnValue(customDocument.uri.path);
        jest.clearAllMocks();
      });

      it('builds file context from provided document and range', async () => {
        await quickChat.handleSendMessage({ reply: mockReply, openOptions });

        expect(mockApi.processNewUserPrompt).toHaveBeenCalledWith(
          'Test question',
          expect.any(String),
          expect.objectContaining({
            fileName: '/custom/file.ts',
            selectedText: 'custom third',
          }),
          undefined,
          ConversationType.DUO_QUICK_CHAT,
          undefined,
        );
      });
    });

    describe('with no open options or active editor document', () => {
      it('sends undefined file context', async () => {
        asMutable(vscode.window).activeTextEditor = undefined;
        await quickChat.handleSendMessage({
          reply: mockReply,
          openOptions: {
            trigger: QUICK_CHAT_OPEN_TRIGGER.CLICK,
          },
        });

        const expectedContext = undefined;
        expect(mockApi.processNewUserPrompt).toHaveBeenCalledWith(
          'Test question',
          expect.any(String),
          expectedContext,
          undefined,
          ConversationType.DUO_QUICK_CHAT,
          undefined,
        );
      });
    });
  });

  describe('Quick Actions', () => {
    it('registers a completion item provider for quick actions', () => {
      expect(vscode.languages.registerCompletionItemProvider).toHaveBeenCalledWith(
        { scheme: 'comment', pattern: '**' },
        { provideCompletionItems: utils.provideCompletionItems },
        '/',
      );
    });
  });

  describe('Code Actions', () => {
    it('registers a provider for code actions', () => {
      expect(vscode.languages.registerCodeActionsProvider).toHaveBeenCalledWith(
        { scheme: 'file' }, // register for all languages
        expect.any(FixWithDuoQuickChatActionProvider),
        { providedCodeActionKinds: FixWithDuoQuickChatActionProvider.providedCodeActionKinds },
      );
    });
  });

  describe('thread label update', () => {
    const mockSelection = createFakePartial<vscode.Selection>({
      active: new vscode.Position(0, 0),
      start: new vscode.Position(0, 0),
      end: new vscode.Position(0, 0),
    });

    const mockChangeEvent = createFakePartial<vscode.TextEditorSelectionChangeEvent>({
      textEditor: {
        document: {
          lineAt: jest.fn(),
          uri: {
            scheme: 'file',
            authority: 'other',
          },
        },
        selection: mockSelection,
        setDecorations: jest.fn(),
      },
    });

    const originalLabel = 'Original label';

    beforeEach(async () => {
      jest.mocked(mockStateMachine.getSnapshot).mockReturnValue({
        context: {},
        value: {
          threadCollapsibleState: QuickChatState.THREAD_EXPANDED,
        },
      });
      mockThread = createFakePartial<vscode.CommentThread>({
        label: originalLabel,
        range: new vscode.Range(0, 0, 0, 0),
        uri: vscode.Uri.file('/test/file.ts'),
      });

      await showChatWithEditor();
      jest.useFakeTimers();
    });

    it('should update the thread label on selection change', async () => {
      await triggerTextEditorSelectionChange(mockChangeEvent);

      jest.runAllTimers();

      expect(mockCommentThreadService.updateThreadSelection).toHaveBeenCalledWith(
        mockChangeEvent.textEditor.document.uri,
        mockChangeEvent.textEditor,
      );
      expect(mockHint.updateHint).toHaveBeenCalledWith(mockChangeEvent);
    });
  });

  describe('keybinding hints', () => {
    let mockEditor: vscode.TextEditor;
    const cursorLineRange = new vscode.Range(0, 0, 3, 5);

    beforeEach(() => {
      mockEditor = createFakePartial<vscode.TextEditor>({
        selection: createFakePartial<vscode.Selection>({ active: new vscode.Position(0, 0) }),
        document: createFakePartial<vscode.TextDocument>({
          lineAt: jest.fn().mockReturnValue({ isEmptyOrWhitespace: true, range: cursorLineRange }),
          uri: vscode.Uri.file('/test/file.ts'), // Default to a file URI
        }),
        setDecorations: jest.fn(),
      });
      jest.useFakeTimers();
    });

    const triggerSelectionChange = () =>
      triggerTextEditorSelectionChange({
        textEditor: mockEditor,
      } as vscode.TextEditorSelectionChangeEvent);

    it('shows hint when enabled and on empty line with correct range', async () => {
      const expectedPosition = new vscode.Position(2, 5);
      mockEditor.selection.active = expectedPosition;
      await triggerSelectionChange();

      jest.runAllTimers();
      expect(mockHint.updateHint).toHaveBeenCalledWith({ textEditor: mockEditor });
    });
  });

  describe('gutter icon', () => {
    it('removes gutter icon when thread is collapsed', async () => {
      const { mockEditor } = await showChatWithEditor();
      mockThread.collapsibleState = vscode.CommentThreadCollapsibleState.Collapsed;
      jest.mocked(mockStateMachine.getSnapshot).mockReturnValue({
        context: {
          thread: mockThread,
        },
        value: {
          threadCollapsibleState: QuickChatState.THREAD_EXPANDED,
        },
      });

      jest
        .mocked(vscode.window.onDidChangeTextEditorVisibleRanges)
        .mock.calls.forEach(([listener]) =>
          listener(
            createFakePartial<vscode.TextEditorVisibleRangesChangeEvent>({
              textEditor: mockEditor,
            }),
          ),
        );

      expect(mockGutterIcon.toggleGutterIcon).toHaveBeenCalledWith(mockThread);
    });
  });

  describe('document changes', () => {
    beforeEach(async () => {
      mockThread = createFakePartial<vscode.CommentThread>({
        uri: vscode.Uri.file('/test.ts'),
        range: new vscode.Range(0, 0, 5, 10),
      });

      await showChatWithEditor();
    });

    it('updates thread position when text changes', () => {
      jest.mocked(mockCommentThreadService.getThread).mockReturnValue(mockThread);
      const change = {
        range: new vscode.Range(2, 0, 2, 0),
        text: 'new line\n',
      };

      jest.mocked(vscode.workspace.onDidChangeTextDocument).mock.calls.forEach(([listener]) =>
        listener(
          createFakePartial<vscode.TextDocumentChangeEvent>({
            document: createFakePartial<vscode.TextDocument>({ uri: mockThread.uri }),
            contentChanges: [change],
          }),
        ),
      );

      expect(mockCommentThreadService.updateThreadRange).toHaveBeenCalledWith(change);
    });
  });
});
