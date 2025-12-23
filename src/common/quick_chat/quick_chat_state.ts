import vscode from 'vscode';
import { and, assign, createActor, fromPromise, raise, setup } from 'xstate';
import { isEmpty, isNil } from 'lodash';
import { log } from '../log';
import { GitLabChatApi, GitLabGID } from '../chat/gitlab_chat_api';
import { SPECIAL_MESSAGES } from '../chat/constants';
import { doNotAwait } from '../utils/do_not_await';
import { QuickChatCommentThreadService } from './comment_thread_service';
import { QUICK_CHAT_OPEN_TRIGGER } from './constants';
import { COMMENT_CONTROLLER_ID } from './utils';
import { QuickChatGutterIcon } from './quick_chat_gutter_icon';

export interface QuickChatOpenOptionsBase {
  trigger: QUICK_CHAT_OPEN_TRIGGER;
  message?: string;
}

export interface QuickChatOpenOptionsWithSelection extends QuickChatOpenOptionsBase {
  document: vscode.TextDocument;
  range: vscode.Range | vscode.Selection;
}

export interface QuickChatOpenOptionsWithoutSelection extends QuickChatOpenOptionsBase {
  document?: never;
  range?: never;
}

export type QuickChatOpenOptions =
  | QuickChatOpenOptionsWithSelection
  | QuickChatOpenOptionsWithoutSelection;

export type SendMessageInput = {
  reply: vscode.CommentReply;
  openOptions?: QuickChatOpenOptions;
};

export const QUICK_CHAT_PROMPT = 'Ask a question or give an instruction...';
// Currently, there is no way to define the type of states in xState.
// Using enum to ensure we don't accidentally use a string that is not defined in the enum.
export enum QuickChatState {
  NO_QUICK_CHAT = 'noQuickChat',
  CLEARING_PREV_CHAT = 'clearingPreviousChat',
  PENDING_USER_INPUT = 'pendingUserInput',
  CREATING_COMMENT_THREAD = 'creatingCommentThread',
  SENDING_REQUEST = 'sendingRequest',
  SPECIAL_COMMAND_CLEAR = 'executeClearCommand',
  SPECIAL_COMMAND_RESET = 'executeResetCommand',
  STREAMING_RESPONSE = 'streamingResponse',
  DISPLAYING_FULL_RESPONSE = 'displayingFullResponse',
  ERROR = 'errorState',
  // threadCollapsibleState child states
  THREAD_EXPANDED = 'threadExpanded',
  THREAD_COLLAPSED = 'threadCollapsed',
  // documentState child states
  IN_CURRENT_DOC = 'inCurrentDocument', // Quick Chat is in the current active document
  IN_DIFF_DOC = 'inDifferentDocument', // Quick Chat is in a document different from the active one
}

export type ProcessRequestInput = {
  message: string;
  openOptions?: QuickChatOpenOptions;
};

export type QuickChatEvent =
  | {
      type: 'triggerQuickChat';
      openOptions?: QuickChatOpenOptions;
    } // opens Quick Chat via shortcut, button, etc.
  | { type: 'preparingRequest' } // preparing request to API
  | { type: 'sendMessage'; input: SendMessageInput } // sends a message
  | { type: 'streamingResponse' } // response is received from API
  | { type: 'requestComplete' } // request is complete
  | { type: 'collapseChat'; origin: 'command' | 'non-command' } // collapses chat thread
  | { type: 'expandChat'; origin: 'command' | 'non-command' }
  | { type: 'errorOccurred'; error: Error }
  | { type: 'executeSpecialCommand'; command: string } // sends a special command (/reset, /clear)
  | { type: 'updateAiActionThreadId'; aiActionThreadId: GitLabGID | undefined }
  | { type: 'validateMessage' }
  | { type: 'setDocument'; documentPath: vscode.Uri | undefined }; // returns to the document with the Quick Chat

type QuickChatStateContext = {
  prompt: string;
  message: string | undefined;
  openOptions: QuickChatOpenOptions | undefined;
  commentThreadService: QuickChatCommentThreadService;
  api: GitLabChatApi;
  thread: vscode.CommentThread | null;
  gutterIcon: QuickChatGutterIcon;
  aiActionThreadId: GitLabGID | undefined;
  error: unknown;
  activeDocumentPath: vscode.Uri | undefined;
};

export const QuickChatStateMachine = (
  qcThreadService: QuickChatCommentThreadService,
  qcGutterIcon: QuickChatGutterIcon,
  qcApi: GitLabChatApi,
  sendMessageCallback: (input: SendMessageInput) => Promise<void>,
) =>
  setup({
    types: {
      events: {} as QuickChatEvent,
      context: {} as QuickChatStateContext,
    },
    guards: {
      hasValidMessage: ({ context }) => {
        return !isEmpty(context.message?.trim());
      },
      hasThread: ({ context }) => {
        return !isNil(context.thread);
      },
      isThreadExpanded: ({ context }) => {
        return context.thread?.collapsibleState === vscode.CommentThreadCollapsibleState.Expanded;
      },
      shouldExecuteSpecialComment: ({ event }, params: { targetCommand: string }) => {
        return event.type === 'executeSpecialCommand' && event.command === params.targetCommand;
      },
      threadInActiveDoc: ({ context }, params: { documentPath: vscode.Uri | undefined }) => {
        return (
          context.thread?.uri === params.documentPath ||
          // If we are in comment input, thread is in active doc
          params.documentPath?.authority === COMMENT_CONTROLLER_ID
        );
      },
    },
    actors: {
      getUserInput: fromPromise(
        async ({ input }: { input: { prompt: string; message: string | undefined } }) => {
          let { message } = input;

          if (!message) {
            const title = 'GitLab Duo Quick Chat';
            message = await vscode.window.showInputBox({ placeHolder: input.prompt, title });
          }
          return message;
        },
      ),

      sendMessage: fromPromise(
        async ({ input }: { input: { context: QuickChatStateContext; event: unknown } }) => {
          const { context, event } = input;

          let callbackParams: SendMessageInput;

          // this event is sent by user sending message in a Quick Chat thread
          if (isSendMessageEvent(event)) {
            callbackParams = event.input;
          } else {
            // this is triggered when sendMessage is triggered by state machine
            if (!context.message || !context.thread) {
              throw new Error('missing thread or message');
            }
            callbackParams = {
              reply: {
                text: context.message,
                thread: context.thread,
              },
              openOptions: context.openOptions,
            };
          }
          await sendMessageCallback(callbackParams);
        },
      ),
      clearQuickChat: fromPromise(
        async ({
          input,
        }: {
          input: {
            commentThreadService: QuickChatCommentThreadService;
            api: GitLabChatApi;
            aiActionThreadId?: GitLabGID;
          };
        }) => {
          const { commentThreadService, api, aiActionThreadId } = input;
          await commentThreadService.setLoadingContext(false);
          commentThreadService.clearComments();
          doNotAwait(api.clearChat(aiActionThreadId));
          // FIXME: ensure input is focused once we have added this capability: https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/issues/1595
        },
      ),
      resetQuickChat: fromPromise(
        async ({
          input,
        }: {
          input: {
            commentThreadService: QuickChatCommentThreadService;
            api: GitLabChatApi;
            aiActionThreadId?: GitLabGID;
          };
        }) => {
          const { commentThreadService, api, aiActionThreadId } = input;
          await commentThreadService.setLoadingContext(false);
          commentThreadService.addResetComment();
          await api.resetChat(aiActionThreadId);
          // FIXME: ensure input is focused once we have added this capability: https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/issues/1595
        },
      ),
      createCommentThread: fromPromise(async ({ input }: { input: QuickChatStateContext }) => {
        const { prompt, commentThreadService, gutterIcon } = input;

        const { activeTextEditor } = vscode.window;
        if (!activeTextEditor) {
          throw new Error('No active text editor');
        }
        const range =
          input.openOptions?.range ??
          new vscode.Range(activeTextEditor.selection.start, activeTextEditor.selection.end);

        const document = input.openOptions?.document ?? activeTextEditor.document;

        const thread = commentThreadService.createCommentThread(document.uri, range, prompt);
        if (activeTextEditor) {
          gutterIcon.toggleGutterIcon(thread);
          await vscode.commands.executeCommand('setContext', 'gitlab:quickChatOpen', true);
        }

        return thread;
      }),
    },
    actions: {
      logWithTitle: (_, params: { message: string }) => {
        log.debug(`[QuickChatStateMachine]: ${params.message}`);
      },
    },
  }).createMachine({
    id: 'quickChatStateMachine',
    type: 'parallel',
    context: {
      prompt: QUICK_CHAT_PROMPT,
      message: undefined,
      openOptions: undefined,
      commentThreadService: qcThreadService,
      gutterIcon: qcGutterIcon,
      api: qcApi,
      thread: null,
      aiActionThreadId: undefined,
      error: undefined,
      activeDocumentPath: undefined,
    },
    states: {
      threadCollapsibleState: {
        initial: QuickChatState.NO_QUICK_CHAT,
        states: {
          [QuickChatState.NO_QUICK_CHAT]: {
            always: [
              {
                guard: ({ context }) =>
                  context.thread?.collapsibleState ===
                  vscode.CommentThreadCollapsibleState.Expanded,
                target: QuickChatState.THREAD_EXPANDED,
              },
            ],
          },
          [QuickChatState.THREAD_EXPANDED]: {
            description: 'Quick Chat thread is expanded',
            entry: ({ context }) => {
              if (context.thread) context.gutterIcon.toggleGutterIcon(context.thread);
            },
            on: {
              collapseChat: {
                target: QuickChatState.THREAD_COLLAPSED,
              },
            },
          },
          [QuickChatState.THREAD_COLLAPSED]: {
            description: 'Quick Chat thread is collapsed',
            entry: [
              ({ context, event }) => {
                if (event.type === 'collapseChat' && event.origin === 'command') {
                  context.commentThreadService.hideThread();
                }
                if (context.thread) context.gutterIcon.toggleGutterIcon(context.thread);
              },
            ],
            on: {
              expandChat: {
                target: QuickChatState.THREAD_EXPANDED,
              },
            },
          },
        },
      },
      documentState: {
        initial: QuickChatState.NO_QUICK_CHAT,
        states: {
          [QuickChatState.NO_QUICK_CHAT]: {
            on: {
              setDocument: {
                guard: ({ context }) => context.thread !== null,
                actions: assign({
                  activeDocumentPath: ({ event }) => event.documentPath,
                }),
                target: QuickChatState.IN_CURRENT_DOC,
              },
            },
          },
          [QuickChatState.IN_CURRENT_DOC]: {
            on: {
              setDocument: [
                {
                  guard: {
                    type: 'threadInActiveDoc',
                    params: ({ event }) => ({
                      documentPath: event.documentPath,
                    }),
                  },
                },
                {
                  target: QuickChatState.IN_DIFF_DOC,
                  actions: assign({
                    activeDocumentPath: ({ event }) => event.documentPath,
                  }),
                },
              ],
            },
          },
          [QuickChatState.IN_DIFF_DOC]: {
            // Be aware that when focused in the output panel, documentState may be in a "inDifferentDocument" state even if
            // document with a thread is active in the editor.
            on: {
              setDocument: [
                {
                  guard: {
                    type: 'threadInActiveDoc',
                    params: ({ event }) => ({
                      documentPath: event.documentPath,
                    }),
                  },
                  target: QuickChatState.IN_CURRENT_DOC,
                  actions: assign({
                    activeDocumentPath: ({ event }) => event.documentPath,
                  }),
                },
              ],
            },
          },
        },
      },
      quickChatFlow: {
        initial: QuickChatState.NO_QUICK_CHAT,
        states: {
          [QuickChatState.NO_QUICK_CHAT]: {
            description: 'no quick chat is created',
            on: {
              triggerQuickChat: {
                target: QuickChatState.PENDING_USER_INPUT,
                actions: assign({
                  openOptions: ({ event }) => event.openOptions,
                }),
              },
            },
          },
          [QuickChatState.PENDING_USER_INPUT]: {
            description: 'waiting for user input',
            invoke: [
              {
                src: 'getUserInput',
                input: ({ context }) => ({
                  prompt: context.prompt,
                  message: context.openOptions?.message,
                }),
                onDone: {
                  actions: [
                    assign({ message: ({ event }) => event.output }),
                    raise({ type: 'validateMessage' }),
                  ],
                },
                onError: {
                  target: QuickChatState.ERROR,
                  actions: assign({
                    error: ({ event }) => event.error,
                  }),
                },
              },
            ],
            on: {
              validateMessage: [
                {
                  guard: and(['hasValidMessage', 'hasThread']),
                  target: QuickChatState.CLEARING_PREV_CHAT,
                },
                {
                  guard: 'hasValidMessage',
                  target: QuickChatState.CREATING_COMMENT_THREAD,
                },
                {
                  guard: and(['hasThread']),
                  target: QuickChatState.DISPLAYING_FULL_RESPONSE,
                },
                {
                  target: QuickChatState.NO_QUICK_CHAT,
                },
              ],
            },
          },
          [QuickChatState.CLEARING_PREV_CHAT]: {
            description: 'clears the previous chat thread',

            invoke: [
              {
                src: 'clearQuickChat',
                input: ({ context }) => ({
                  commentThreadService: context.commentThreadService,
                  api: context.api,
                  aiActionThreadId: context.aiActionThreadId,
                }),
                onDone: {
                  target: QuickChatState.CREATING_COMMENT_THREAD,
                  actions: assign({ aiActionThreadId: undefined }),
                },
                onError: {
                  target: QuickChatState.ERROR,
                  actions: assign({
                    error: ({ event }) => event.error,
                  }),
                },
              },
            ],
          },
          [QuickChatState.CREATING_COMMENT_THREAD]: {
            description: 'creates a comment thread',
            invoke: [
              {
                src: 'createCommentThread',
                input: ({ context }) => {
                  return context;
                },
                onDone: {
                  target: QuickChatState.SENDING_REQUEST,
                  actions: [
                    assign({
                      thread: ({ event }) => event.output,
                    }),
                    raise(({ event }) => ({ type: 'setDocument', documentPath: event.output.uri })),
                  ],
                },
                onError: {
                  target: QuickChatState.ERROR,
                  actions: assign({
                    error: ({ event }) => event.error,
                  }),
                },
              },
            ],
          },
          [QuickChatState.SPECIAL_COMMAND_CLEAR]: {
            description: 'executes special command "/clear"',
            entry: {
              type: 'logWithTitle',
              params: { message: 'executing special command "/clear"' },
            },
            invoke: {
              src: 'clearQuickChat',
              input: ({ context }) => ({
                commentThreadService: context.commentThreadService,
                api: context.api,
                aiActionThreadId: context.aiActionThreadId,
              }),
              onDone: {
                target: QuickChatState.DISPLAYING_FULL_RESPONSE,
                actions: assign({ aiActionThreadId: undefined }),
              },
            },
          },
          [QuickChatState.SPECIAL_COMMAND_RESET]: {
            description: 'executes special command "/reset"',
            entry: {
              type: 'logWithTitle',
              params: { message: 'executing special command "/reset"' },
            },
            invoke: {
              src: 'resetQuickChat',
              input: ({ context }) => ({
                commentThreadService: context.commentThreadService,
                api: context.api,
                aiActionThreadId: context.aiActionThreadId,
              }),
              onDone: {
                target: QuickChatState.DISPLAYING_FULL_RESPONSE,
                actions: assign({ aiActionThreadId: undefined }),
              },
            },
          },

          [QuickChatState.SENDING_REQUEST]: {
            invoke: {
              src: 'sendMessage',
              input: ({ context, event }) => {
                return {
                  context,
                  event,
                };
              },
              onError: {
                target: QuickChatState.ERROR,
                actions: assign({
                  error: ({ event }) => event.error,
                }),
              },
            },
            on: {
              triggerQuickChat: {
                actions: assign({
                  openOptions: ({ event }) => event.openOptions,
                }),
                target: QuickChatState.PENDING_USER_INPUT,
              },
              streamingResponse: {
                target: QuickChatState.STREAMING_RESPONSE,
              },
              errorOccurred: {
                target: QuickChatState.ERROR,
              },
              updateAiActionThreadId: {
                actions: assign({
                  aiActionThreadId: ({ event }) => event.aiActionThreadId,
                }),
              },
              executeSpecialCommand: [
                {
                  target: QuickChatState.SPECIAL_COMMAND_CLEAR,
                  guard: {
                    type: 'shouldExecuteSpecialComment',
                    params: { targetCommand: SPECIAL_MESSAGES.CLEAR },
                  },
                },
                {
                  target: QuickChatState.SPECIAL_COMMAND_RESET,
                  guard: {
                    type: 'shouldExecuteSpecialComment',
                    params: { targetCommand: SPECIAL_MESSAGES.RESET },
                  },
                },
              ],
            },
          },
          [QuickChatState.STREAMING_RESPONSE]: {
            description: 'response is being received',
            on: {
              triggerQuickChat: {
                actions: assign({
                  openOptions: ({ event }) => event.openOptions,
                }),
                target: QuickChatState.PENDING_USER_INPUT,
              },
              requestComplete: {
                target: QuickChatState.DISPLAYING_FULL_RESPONSE,
              },
              errorOccurred: {
                target: QuickChatState.ERROR,
              },
              updateAiActionThreadId: {
                actions: assign({
                  aiActionThreadId: ({ event }) => event.aiActionThreadId,
                }),
              },
            },
          },
          [QuickChatState.DISPLAYING_FULL_RESPONSE]: {
            description: 'displays the response',
            on: {
              sendMessage: {
                target: QuickChatState.SENDING_REQUEST,
              },
              triggerQuickChat: {
                actions: assign({
                  openOptions: ({ event }) => event.openOptions,
                }),
                target: QuickChatState.PENDING_USER_INPUT,
              },
              updateAiActionThreadId: {
                actions: assign({
                  aiActionThreadId: ({ event }) => event.aiActionThreadId,
                }),
              },
              executeSpecialCommand: [
                {
                  target: QuickChatState.SPECIAL_COMMAND_CLEAR,
                  guard: {
                    type: 'shouldExecuteSpecialComment',
                    params: { targetCommand: SPECIAL_MESSAGES.CLEAR },
                  },
                },
                {
                  target: QuickChatState.SPECIAL_COMMAND_RESET,
                  guard: {
                    type: 'shouldExecuteSpecialComment',
                    params: { targetCommand: SPECIAL_MESSAGES.RESET },
                  },
                },
              ],
            },
          },

          [QuickChatState.ERROR]: {
            entry: ({ event }) => {
              if (event.type !== 'errorOccurred') return;
              log.error(`[QuickChatStateMachine]: ${event.error}`);
              assign({ error: event.error });
            },
            exit: assign({ error: undefined }),
            on: {
              sendMessage: { target: QuickChatState.SENDING_REQUEST },
              triggerQuickChat: {
                actions: assign({
                  openOptions: ({ event }) => event.openOptions,
                }),
                target: QuickChatState.PENDING_USER_INPUT,
              },
            },
          },
        },
      },
    },
  });

export const createQuickChatMachine = (
  qcThreadService: QuickChatCommentThreadService,
  qcDecoration: QuickChatGutterIcon,
  qcApi: GitLabChatApi,
  sendMessageCallback: (input: SendMessageInput) => Promise<void>,
) => createActor(QuickChatStateMachine(qcThreadService, qcDecoration, qcApi, sendMessageCallback));

function isSendMessageEvent(obj: unknown): obj is { type: 'sendMessage'; input: SendMessageInput } {
  if (!obj || typeof obj !== 'object' || !('type' in obj)) {
    return false;
  }
  const event = obj as Record<string, unknown>;

  return 'input' in event && event.input !== undefined;
}
