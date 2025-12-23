import vscode from 'vscode';
import { waitFor } from 'xstate';
import { GitLabChatApi, GitLabGID } from '../chat/gitlab_chat_api';
import { createFakePartial } from '../test_utils/create_fake_partial';
import { asMutable } from '../test_utils/types';
import { createMockTextDocument } from '../__mocks__/mock_text_document';
import { SPECIAL_MESSAGES } from '../chat/constants';
import { CommentThreadCollapsibleState } from '../../__mocks__/vscode';
import { QuickChatCommentThreadService } from './comment_thread_service';
import {
  createQuickChatMachine,
  QUICK_CHAT_PROMPT,
  QuickChatOpenOptions,
  QuickChatState,
} from './quick_chat_state';
import { QUICK_CHAT_OPEN_TRIGGER } from './constants';
import { QuickChatGutterIcon } from './quick_chat_gutter_icon';

const mockAiActionThreadId: GitLabGID = `gid://gitlab/test/123`;
const mockUri = vscode.Uri.file('/path/to/file.ts');

/**
 * To test State Machine state transitions, follow this pattern to ensure the state machine reaches the desired state:
 *
 * await waitFor(
 *   stateMachine,
 *   state => state.value.quickChatFlow === WANTED_STATE)
 *
 * Without this, test will not wait for machine to reach desired state and may produce false negative results.
 */

describe('QuickChatStateMachine', () => {
  let mockApi: GitLabChatApi;
  let commentThreadService: QuickChatCommentThreadService;
  let gutterIcon: QuickChatGutterIcon;
  const mocksendMessageCallback: jest.Mock = jest.fn();
  let stateMachine: ReturnType<typeof createQuickChatMachine>;
  let mockThread: vscode.CommentThread;
  let mockRange: vscode.Range;

  beforeEach(async () => {
    mockApi = createFakePartial<GitLabChatApi>({
      clearChat: jest.fn().mockResolvedValue({}),
      resetChat: jest.fn().mockResolvedValue({}),
      subscribeToUpdates: jest.fn(),
      processNewUserPrompt: jest.fn(),
    });

    const mockExtensionContext = createFakePartial<vscode.ExtensionContext>({
      extensionUri: vscode.Uri.file('/path/to/extension'),
    });
    commentThreadService = new QuickChatCommentThreadService();
    gutterIcon = new QuickChatGutterIcon(mockExtensionContext);

    stateMachine = createQuickChatMachine(
      commentThreadService,
      gutterIcon,
      mockApi,
      mocksendMessageCallback,
    );
    await setupEditor();
    stateMachine.start();
  });

  async function setupEditor(userInput = 'Test question') {
    // set up editor environment for simulating triggerQuickChat
    const cursorPosition = new vscode.Position(1, 11);
    mockRange = new vscode.Range(new vscode.Position(1, 0), cursorPosition);
    const mockDocument = createMockTextDocument({
      uri: mockUri,
      content: 'full document content\nsecond line\nthird line',
    });
    mockThread = createFakePartial<vscode.CommentThread>({
      uri: mockUri,
      comments: [],
      range: new vscode.Range(0, 0, 0, 0),
      collapsibleState: CommentThreadCollapsibleState.Expanded,
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

    jest.spyOn(commentThreadService, 'createCommentThread').mockReturnValue(mockThread);
    jest.spyOn(vscode.window, 'showInputBox').mockResolvedValue(userInput);
  }

  async function mimickRequestComplete(openOptions?: QuickChatOpenOptions) {
    stateMachine.send({ type: 'triggerQuickChat', openOptions });
    await waitFor(
      stateMachine,
      state => state.value.quickChatFlow === QuickChatState.SENDING_REQUEST,
    );
    // mimick getting aiActionThreadId after sending a request
    stateMachine.send({
      type: 'updateAiActionThreadId',
      aiActionThreadId: mockAiActionThreadId,
    });
    stateMachine.send({ type: 'streamingResponse' });
    await waitFor(
      stateMachine,
      state => state.value.quickChatFlow === QuickChatState.STREAMING_RESPONSE,
    );
    stateMachine.send({ type: 'requestComplete' });
    await waitFor(
      stateMachine,
      state => state.value.quickChatFlow === QuickChatState.DISPLAYING_FULL_RESPONSE,
    );
  }

  it('should initialize with default state', () => {
    expect(stateMachine.getSnapshot().value.quickChatFlow).toBe(QuickChatState.NO_QUICK_CHAT);
    expect(stateMachine.getSnapshot().value.documentState).toBe(QuickChatState.NO_QUICK_CHAT);
    expect(stateMachine.getSnapshot().value.threadCollapsibleState).toBe(
      QuickChatState.NO_QUICK_CHAT,
    );
  });

  it('should initialize with default state', () => {
    expect(stateMachine.getSnapshot().context).toEqual({
      prompt: QUICK_CHAT_PROMPT,
      message: undefined,
      openOptions: undefined,
      commentThreadService,
      gutterIcon,
      api: mockApi,
      thread: null,
      aiActionThreadId: undefined,
      error: undefined,
      activeDocumentPath: undefined,
    });
  });

  describe('threadCollapsibleState', () => {
    beforeEach(async () => {
      stateMachine.send({ type: 'triggerQuickChat' });
      jest.spyOn(commentThreadService, 'hideThread');
      jest.spyOn(gutterIcon, 'toggleGutterIcon');

      await waitFor(
        stateMachine,
        state => state.value.quickChatFlow === QuickChatState.SENDING_REQUEST,
      );
      await waitFor(
        stateMachine,
        state => state.value.threadCollapsibleState === QuickChatState.THREAD_EXPANDED,
      );
      expect(stateMachine.getSnapshot().value.threadCollapsibleState).toBe(
        QuickChatState.THREAD_EXPANDED,
      );
    });
    describe('should transition to "threadCollapsed"', () => {
      it('by command', async () => {
        // event is sent when collapsing chat by running a command
        stateMachine.send({ type: 'collapseChat', origin: 'command' });
        await waitFor(
          stateMachine,
          state => state.value.threadCollapsibleState === QuickChatState.THREAD_COLLAPSED,
        );

        expect(commentThreadService.hideThread).toHaveBeenCalled();
        expect(gutterIcon.toggleGutterIcon).toHaveBeenCalled();
        expect(stateMachine.getSnapshot().value.threadCollapsibleState).toBe(
          QuickChatState.THREAD_COLLAPSED,
        );
      });

      it('by non-command', async () => {
        // event is sent when collapsing chat by running a command
        stateMachine.send({ type: 'collapseChat', origin: 'non-command' });
        await waitFor(
          stateMachine,
          state => state.value.threadCollapsibleState === QuickChatState.THREAD_COLLAPSED,
        );

        expect(commentThreadService.hideThread).not.toHaveBeenCalled();
        expect(gutterIcon.toggleGutterIcon).toHaveBeenCalled();
        expect(stateMachine.getSnapshot().value.threadCollapsibleState).toBe(
          QuickChatState.THREAD_COLLAPSED,
        );
      });
    });

    describe('should transition to "threadExpanded"', () => {
      it('by non-command', async () => {
        // collapse the chat first
        stateMachine.send({ type: 'collapseChat', origin: 'non-command' });
        await waitFor(
          stateMachine,
          state => state.value.threadCollapsibleState === QuickChatState.THREAD_COLLAPSED,
        );
        // expand the chat
        stateMachine.send({ type: 'expandChat', origin: 'non-command' });

        expect(gutterIcon.toggleGutterIcon).toHaveBeenCalled();
        expect(stateMachine.getSnapshot().value.threadCollapsibleState).toBe(
          QuickChatState.THREAD_EXPANDED,
        );
      });
    });
  });

  describe('documentState', () => {
    it('should transition to "inCurrentDocument" when document is set and thread exists', async () => {
      stateMachine.send({ type: 'triggerQuickChat' });
      await waitFor(
        stateMachine,
        state => state.value.quickChatFlow === QuickChatState.SENDING_REQUEST,
      );

      stateMachine.send({ type: 'setDocument', documentPath: mockUri });

      expect(stateMachine.getSnapshot().value.documentState).toBe(QuickChatState.IN_CURRENT_DOC);
      expect(stateMachine.getSnapshot().context.activeDocumentPath).toEqual(mockUri);
    });

    it('should transition to "inDifferentDocument" when document changes', async () => {
      stateMachine.send({ type: 'triggerQuickChat' });
      await waitFor(
        stateMachine,
        state => state.value.quickChatFlow === QuickChatState.SENDING_REQUEST,
      );

      // Set initial document (thread document)
      stateMachine.send({ type: 'setDocument', documentPath: mockUri });

      // Change to different document
      const differentUri = vscode.Uri.file('/path/to/different-file.ts');
      stateMachine.send({ type: 'setDocument', documentPath: differentUri });

      expect(stateMachine.getSnapshot().value.documentState).toBe(QuickChatState.IN_DIFF_DOC);
      expect(stateMachine.getSnapshot().context.activeDocumentPath).toEqual(differentUri);
    });

    it('should transition back to "inCurrentDocument" when returning to thread document', async () => {
      stateMachine.send({ type: 'triggerQuickChat' });

      await waitFor(
        stateMachine,
        state => state.value.quickChatFlow === QuickChatState.SENDING_REQUEST,
      );

      // Set initial document (thread document)
      stateMachine.send({ type: 'setDocument', documentPath: mockUri });

      // Change to different document
      const differentUri = vscode.Uri.file('/path/to/different-file.ts');
      stateMachine.send({ type: 'setDocument', documentPath: differentUri });

      // Return to thread document
      stateMachine.send({ type: 'setDocument', documentPath: mockUri });

      expect(stateMachine.getSnapshot().value.documentState).toBe(QuickChatState.IN_CURRENT_DOC);
      expect(stateMachine.getSnapshot().context.activeDocumentPath).toEqual(mockUri);
    });
  });

  describe('quickChatFlow', () => {
    describe('triggerQuickChat', () => {
      describe('with openOptions', () => {
        let customMessage: string;
        let customDocument: vscode.TextDocument;
        let customRange: vscode.Range;
        let openOptions: QuickChatOpenOptions;
        beforeEach(() => {
          customMessage = 'How do I computer?';
          customDocument = createMockTextDocument({
            uri: vscode.Uri.file('/custom/path/file.ts'),
            content: 'custom document content\ncustom second line\ncustom third line',
          });
          customRange = new vscode.Range(2, 0, 2, 12);

          openOptions = {
            trigger: QUICK_CHAT_OPEN_TRIGGER.CLICK,
            message: customMessage,
            document: customDocument,
            range: customRange,
          };

          // Setup active editor for tests that don't use the context
          const mockEditor = createFakePartial<vscode.TextEditor>({
            document: createFakePartial<vscode.TextDocument>({
              uri: vscode.Uri.file('/active/editor/file.ts'),
            }),
            selection: new vscode.Range(0, 0, 0, 0),
            setDecorations: jest.fn(),
          });
          asMutable(vscode.window).activeTextEditor = mockEditor;
          asMutable(vscode.workspace).asRelativePath = jest
            .fn()
            .mockReturnValue(customDocument.uri.path);
          jest.clearAllMocks();
        });

        it('uses document and range from open options when provided', async () => {
          stateMachine.send({ type: 'triggerQuickChat', openOptions });

          await waitFor(
            stateMachine,
            state => state.value.quickChatFlow === QuickChatState.SENDING_REQUEST,
          );
          expect(commentThreadService.createCommentThread).toHaveBeenCalledWith(
            customDocument.uri,
            customRange,
            'Ask a question or give an instruction...',
          );
        });

        it('passes open options to send method', async () => {
          stateMachine.send({ type: 'triggerQuickChat', openOptions });
          await waitFor(
            stateMachine,
            state => state.value.quickChatFlow === QuickChatState.SENDING_REQUEST,
          );

          expect(commentThreadService.createCommentThread).toHaveBeenCalledWith(
            customDocument.uri,
            customRange,
            'Ask a question or give an instruction...',
          );

          expect(mocksendMessageCallback).toHaveBeenCalledWith({
            reply: {
              text: customMessage,
              thread: mockThread,
            },
            openOptions,
          });
        });

        it('uses provided message instead of prompting user', async () => {
          jest.spyOn(vscode.window, 'showInputBox').mockResolvedValue('Test with custom context');

          stateMachine.send({ type: 'triggerQuickChat', openOptions });
          await waitFor(
            stateMachine,
            state => state.value.quickChatFlow === QuickChatState.SENDING_REQUEST,
          );

          expect(vscode.window.showInputBox).not.toHaveBeenCalled();
          expect(mocksendMessageCallback).toHaveBeenCalledWith({
            reply: {
              text: customMessage,
              thread: mockThread,
            },
            openOptions,
          });
        });

        it('sendMessage event sent by user uses user input message', async () => {
          await mimickRequestComplete();

          // user sends new message in a thread
          stateMachine.send({
            type: 'sendMessage',
            input: {
              reply: {
                text: 'user message',
                thread: mockThread,
              },
            },
          });
          expect(mocksendMessageCallback).toHaveBeenCalledWith({
            reply: {
              text: 'user message',
              thread: mockThread,
            },
          });
        });

        describe('re-triggered with no openOptions clears "context.openOptions"', () => {
          it(`from ${QuickChatState.SENDING_REQUEST}`, async () => {
            // call triggerQuickChat with openOptions
            stateMachine.send({ type: 'triggerQuickChat', openOptions });

            // process until QuickChatState.SENDING_REQUEST
            await waitFor(
              stateMachine,
              state => state.value.quickChatFlow === QuickChatState.SENDING_REQUEST,
            );

            // re-trigger with no openOptions
            stateMachine.send({ type: 'triggerQuickChat' });
            expect(stateMachine.getSnapshot().context.openOptions).toBe(undefined);
          });
          it(`from ${QuickChatState.STREAMING_RESPONSE}`, async () => {
            // call triggerQuickChat with openOptions
            stateMachine.send({ type: 'triggerQuickChat', openOptions });

            // process until QuickChatState.STREAMING_RESPONSE
            await waitFor(
              stateMachine,
              state => state.value.quickChatFlow === QuickChatState.SENDING_REQUEST,
            );
            stateMachine.send({
              type: 'updateAiActionThreadId',
              aiActionThreadId: mockAiActionThreadId,
            });
            stateMachine.send({ type: 'streamingResponse' });

            await waitFor(
              stateMachine,
              state => state.value.quickChatFlow === QuickChatState.STREAMING_RESPONSE,
            );

            // re-trigger with no openOptions
            stateMachine.send({ type: 'triggerQuickChat' });
            expect(stateMachine.getSnapshot().context.openOptions).toBe(undefined);
          });

          it(`from ${QuickChatState.DISPLAYING_FULL_RESPONSE}`, async () => {
            // process until QuickChatState.DISPLAYING_FULL_RESPONSE with openOptions
            await mimickRequestComplete(openOptions);

            // re-trigger with no openOptions
            stateMachine.send({ type: 'triggerQuickChat' });
            expect(stateMachine.getSnapshot().context.openOptions).toBe(undefined);
          });
        });
      });

      describe('with no openOptions', () => {
        it('creates a new comment thread when an editor is active', async () => {
          jest.spyOn(vscode.window, 'showInputBox').mockResolvedValue('testing message');
          stateMachine.send({ type: 'triggerQuickChat' });

          await waitFor(
            stateMachine,
            state => state.value.quickChatFlow === QuickChatState.SENDING_REQUEST,
          );

          expect(commentThreadService.createCommentThread).toHaveBeenCalledWith(
            mockUri,
            mockRange,
            'Ask a question or give an instruction...',
          );
        });

        it('does nothing when no editor is active', async () => {
          asMutable(vscode.window).activeTextEditor = undefined;
          stateMachine.send({ type: 'triggerQuickChat' });
          await waitFor(stateMachine, state => state.value.quickChatFlow === QuickChatState.ERROR);

          expect(commentThreadService.createCommentThread).not.toHaveBeenCalled();
        });

        it('sends user input when provided through input box', async () => {
          jest.spyOn(vscode.window, 'showInputBox').mockResolvedValue('new message');
          stateMachine.send({ type: 'triggerQuickChat' });
          expect(stateMachine.getSnapshot().value.quickChatFlow).toBe('pendingUserInput');
          await waitFor(
            stateMachine,
            state => state.value.quickChatFlow === QuickChatState.PENDING_USER_INPUT,
          );
          await waitFor(
            stateMachine,
            state => state.value.quickChatFlow === QuickChatState.CREATING_COMMENT_THREAD,
          );
          await waitFor(
            stateMachine,
            state => state.value.quickChatFlow === QuickChatState.SENDING_REQUEST,
          );
          expect(mocksendMessageCallback).toHaveBeenCalledWith({
            reply: {
              text: 'new message',
              thread: mockThread,
            },
          });
          expect(stateMachine.getSnapshot().value.documentState).toBe(
            QuickChatState.IN_CURRENT_DOC,
          );
        });
        it('sendMessage event sent by user uses user input message', async () => {
          await mimickRequestComplete();

          // user sends new message in a thread
          stateMachine.send({
            type: 'sendMessage',
            input: {
              reply: {
                text: 'user message',
                thread: mockThread,
              },
            },
          });
          expect(mocksendMessageCallback).toHaveBeenCalledWith({
            reply: {
              text: 'user message',
              thread: mockThread,
            },
          });
        });

        describe('re-triggered with openOptions sets "context.openOptions"', () => {
          const openOptions = {
            trigger: QUICK_CHAT_OPEN_TRIGGER.CLICK,
            message: 'How do I computer?',
            document: createMockTextDocument({
              uri: vscode.Uri.file('/custom/path/file.ts'),
              content: 'custom document content\ncustom second line\ncustom third line',
            }),
            range: new vscode.Range(2, 0, 2, 12),
          };

          it(`from ${QuickChatState.SENDING_REQUEST}`, async () => {
            // call triggerQuickChat with no openOptions
            stateMachine.send({ type: 'triggerQuickChat' });

            // process until QuickChatState.SENDING_REQUEST
            await waitFor(
              stateMachine,
              state => state.value.quickChatFlow === QuickChatState.SENDING_REQUEST,
            );

            // re-trigger with openOptions
            stateMachine.send({ type: 'triggerQuickChat', openOptions });
            expect(stateMachine.getSnapshot().context.openOptions).toBe(openOptions);
          });
          it(`from ${QuickChatState.STREAMING_RESPONSE}`, async () => {
            // call triggerQuickChat with no openOptions
            stateMachine.send({ type: 'triggerQuickChat' });

            // process until QuickChatState.STREAMING_RESPONSE
            await waitFor(
              stateMachine,
              state => state.value.quickChatFlow === QuickChatState.SENDING_REQUEST,
            );
            stateMachine.send({
              type: 'updateAiActionThreadId',
              aiActionThreadId: mockAiActionThreadId,
            });
            stateMachine.send({ type: 'streamingResponse' });
            await waitFor(
              stateMachine,
              state => state.value.quickChatFlow === QuickChatState.STREAMING_RESPONSE,
            );

            // re-trigger with openOptions
            stateMachine.send({ type: 'triggerQuickChat', openOptions });
            expect(stateMachine.getSnapshot().context.openOptions).toBe(openOptions);
          });

          it(`from ${QuickChatState.DISPLAYING_FULL_RESPONSE}`, async () => {
            // process until QuickChatState.DISPLAYING_FULL_RESPONSE with no openOptions
            await mimickRequestComplete();
            // re-trigger with openOptions
            stateMachine.send({ type: 'triggerQuickChat', openOptions });
            expect(stateMachine.getSnapshot().context.openOptions).toBe(openOptions);
          });
        });
      });
    });

    it('sendingRequest succesfully transition into displayingFullResponse', async () => {
      await mimickRequestComplete();
      expect(stateMachine.getSnapshot().value.quickChatFlow).toBe(
        QuickChatState.DISPLAYING_FULL_RESPONSE,
      );
    });

    it('sending request transition into error state', async () => {
      jest.spyOn(vscode.window, 'showInputBox').mockResolvedValue('testing message');
      mocksendMessageCallback.mockRejectedValue('random error');
      stateMachine.send({ type: 'triggerQuickChat' });
      await waitFor(
        stateMachine,
        state => state.value.quickChatFlow === QuickChatState.SENDING_REQUEST,
      );
      await waitFor(stateMachine, state => state.value.quickChatFlow === QuickChatState.ERROR);
      expect(stateMachine.getSnapshot().value.quickChatFlow).toBe(QuickChatState.ERROR);
    });

    describe('validateMessage event', () => {
      it('transitions to "creatingCommentThread" when valid', async () => {
        jest.spyOn(vscode.window, 'showInputBox').mockResolvedValue('valid message');
        stateMachine.send({ type: 'triggerQuickChat' });
        await waitFor(
          stateMachine,
          state => state.value.quickChatFlow === QuickChatState.PENDING_USER_INPUT,
        );
        await waitFor(
          stateMachine,
          state => state.value.quickChatFlow === QuickChatState.CREATING_COMMENT_THREAD,
        );
        expect(stateMachine.getSnapshot().context.message).toBe('valid message');
      });

      it('transitions to "noQuickChat" when message is empty', async () => {
        jest.spyOn(vscode.window, 'showInputBox').mockResolvedValue('');
        stateMachine.send({ type: 'triggerQuickChat' });
        await waitFor(
          stateMachine,
          state => state.value.quickChatFlow === QuickChatState.PENDING_USER_INPUT,
        );
        await waitFor(
          stateMachine,
          state => state.value.quickChatFlow === QuickChatState.NO_QUICK_CHAT,
        );
        expect(stateMachine.getSnapshot().value.quickChatFlow).toBe(QuickChatState.NO_QUICK_CHAT);
      });

      it('transitions to "clearingPreviousChat" when thread and valid message exist', async () => {
        stateMachine.send({ type: 'triggerQuickChat' });
        await waitFor(
          stateMachine,
          state => state.value.quickChatFlow === QuickChatState.SENDING_REQUEST,
        );

        // mimick getting aiActionThreadId after sending a request
        stateMachine.send({
          type: 'updateAiActionThreadId',
          aiActionThreadId: mockAiActionThreadId,
        });
        const { aiActionThreadId } = stateMachine.getSnapshot().context;

        stateMachine.send({ type: 'triggerQuickChat' });
        jest.spyOn(vscode.window, 'showInputBox').mockResolvedValue('new message');
        await waitFor(
          stateMachine,
          state => state.value.quickChatFlow === QuickChatState.PENDING_USER_INPUT,
        );
        await waitFor(
          stateMachine,
          state => state.value.quickChatFlow === QuickChatState.CLEARING_PREV_CHAT,
        );
        await waitFor(
          stateMachine,
          state => state.value.quickChatFlow === QuickChatState.CREATING_COMMENT_THREAD,
        );
        expect(mockApi.clearChat).toHaveBeenCalledWith(aiActionThreadId);
      });

      it('transitions to "displayingFullResponse" when thread exists but message is invalid', async () => {
        stateMachine.send({ type: 'triggerQuickChat' });
        // wait for stateMachine to reach "sendingRequest"
        await waitFor(
          stateMachine,
          state => state.value.quickChatFlow === QuickChatState.SENDING_REQUEST,
        );

        jest.spyOn(vscode.window, 'showInputBox').mockResolvedValue(undefined);
        stateMachine.send({ type: 'triggerQuickChat' });

        await waitFor(
          stateMachine,
          state => state.value.quickChatFlow === QuickChatState.DISPLAYING_FULL_RESPONSE,
        );

        // ensure this is the last state the state machine reached
        expect(stateMachine.getSnapshot().value.quickChatFlow).toBe(
          QuickChatState.DISPLAYING_FULL_RESPONSE,
        );
      });
    });

    describe('special commands', () => {
      it.each`
        triggeredState
        ${QuickChatState.SENDING_REQUEST}
        ${QuickChatState.DISPLAYING_FULL_RESPONSE}
      `('"/clear" can be triggered from "$triggeredState"', async ({ triggerState }) => {
        stateMachine.send({ type: 'triggerQuickChat' });
        // wait for stateMachine to reach "sendingRequest"
        await waitFor(
          stateMachine,
          state => state.value.quickChatFlow === QuickChatState.SENDING_REQUEST,
        );

        // mimick getting aiActionThreadId after sending a request
        stateMachine.send({
          type: 'updateAiActionThreadId',
          aiActionThreadId: mockAiActionThreadId,
        });

        if (triggerState === QuickChatState.DISPLAYING_FULL_RESPONSE) {
          stateMachine.send({ type: 'streamingResponse' });
          stateMachine.send({ type: 'requestComplete' });
          await waitFor(
            stateMachine,
            state => state.value.quickChatFlow === QuickChatState.DISPLAYING_FULL_RESPONSE,
          );
        }
        stateMachine.send({ type: 'executeSpecialCommand', command: SPECIAL_MESSAGES.CLEAR });
        await waitFor(
          stateMachine,
          state => state.value.quickChatFlow === QuickChatState.SPECIAL_COMMAND_CLEAR,
        );
        await waitFor(
          stateMachine,
          state => state.value.quickChatFlow === QuickChatState.DISPLAYING_FULL_RESPONSE,
        );
        // ensure this is the last state the state machine reached
        expect(stateMachine.getSnapshot().value.quickChatFlow).toBe(
          QuickChatState.DISPLAYING_FULL_RESPONSE,
        );
        expect(mockApi.clearChat).toHaveBeenCalledWith(mockAiActionThreadId);
        // clears the aiActionThreadId after clearing the chat
        const { aiActionThreadId } = stateMachine.getSnapshot().context;
        expect(aiActionThreadId).toBe(undefined);
      });

      it.each`
        triggeredState
        ${QuickChatState.SENDING_REQUEST}
        ${QuickChatState.DISPLAYING_FULL_RESPONSE}
      `('"/reset" can be triggered from "$triggeredState"', async ({ triggerState }) => {
        stateMachine.send({ type: 'triggerQuickChat' });
        // wait for stateMachine to reach "sendingRequest"
        await waitFor(
          stateMachine,
          state => state.value.quickChatFlow === QuickChatState.SENDING_REQUEST,
        );

        // mimick getting aiActionThreadId after sending a request
        stateMachine.send({
          type: 'updateAiActionThreadId',
          aiActionThreadId: mockAiActionThreadId,
        });

        if (triggerState === QuickChatState.DISPLAYING_FULL_RESPONSE) {
          stateMachine.send({ type: 'streamingResponse' });
          stateMachine.send({ type: 'requestComplete' });
          await waitFor(
            stateMachine,
            state => state.value.quickChatFlow === QuickChatState.DISPLAYING_FULL_RESPONSE,
          );
        }
        stateMachine.send({ type: 'executeSpecialCommand', command: SPECIAL_MESSAGES.RESET });
        await waitFor(
          stateMachine,
          state => state.value.quickChatFlow === QuickChatState.SPECIAL_COMMAND_RESET,
        );
        await waitFor(
          stateMachine,
          state => state.value.quickChatFlow === QuickChatState.DISPLAYING_FULL_RESPONSE,
        );
        // ensure this is the last state the state machine reached
        expect(stateMachine.getSnapshot().value.quickChatFlow).toBe(
          QuickChatState.DISPLAYING_FULL_RESPONSE,
        );

        expect(mockApi.resetChat).toHaveBeenCalledWith(mockAiActionThreadId);
        // clears the aiActionThreadId after reseting the chat
        const { aiActionThreadId } = stateMachine.getSnapshot().context;
        expect(aiActionThreadId).toBe(undefined);
      });
    });

    describe('updateAiActionThreadId', () => {
      it('sets context value "aiActionThreadId"', async () => {
        stateMachine.send({ type: 'triggerQuickChat' });
        await waitFor(
          stateMachine,
          state => state.value.quickChatFlow === QuickChatState.SENDING_REQUEST,
        );

        // mimick getting aiActionThreadId after sending a request
        stateMachine.send({
          type: 'updateAiActionThreadId',
          aiActionThreadId: mockAiActionThreadId,
        });

        let { aiActionThreadId } = stateMachine.getSnapshot().context;

        expect(mockAiActionThreadId).toEqual(aiActionThreadId);

        // simulate reseting aiActionthreadId
        stateMachine.send({
          type: 'updateAiActionThreadId',
          aiActionThreadId: undefined,
        });

        aiActionThreadId = stateMachine.getSnapshot().context.aiActionThreadId;

        expect(aiActionThreadId).toEqual(undefined);
      });

      it('does not set context value "aiActionThreadId"', async () => {
        stateMachine.send({ type: 'triggerQuickChat' });
        await waitFor(
          stateMachine,
          state => state.value.quickChatFlow === QuickChatState.PENDING_USER_INPUT,
        );

        // mimick getting aiActionThreadId after sending a request
        stateMachine.send({
          type: 'updateAiActionThreadId',
          aiActionThreadId: mockAiActionThreadId,
        });

        const { aiActionThreadId } = stateMachine.getSnapshot().context;

        // aiActionThreadId should not be set since we are in unavailable state for "updateAiActionThreadId"
        expect(aiActionThreadId).toEqual(undefined);
      });
    });

    describe('state "clearingPreviousChat"', () => {
      it('clears "aiActionThreadId" from context', async () => {
        await mimickRequestComplete();
        expect(stateMachine.getSnapshot().context.aiActionThreadId).toEqual(mockAiActionThreadId);
        stateMachine.send({ type: 'triggerQuickChat' });

        // wait for the state transition after "clearingPreviousChat" to ensure "clearingPreviousChat" invoke function has completed
        await waitFor(
          stateMachine,
          state => state.value.quickChatFlow === QuickChatState.CREATING_COMMENT_THREAD,
        );
        expect(stateMachine.getSnapshot().context.aiActionThreadId).toEqual(undefined);
      });
    });
  });
});
