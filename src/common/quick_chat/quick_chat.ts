import vscode, { CommentThreadCollapsibleState } from 'vscode';
import { v4 as uuidv4 } from 'uuid';
import { debounce } from 'lodash';
import { AiCompletionResponseMessageType } from '../api/graphql/ai_completion_response_channel';
import { AiActionResponseType, ConversationType, GitLabChatApi } from '../chat/gitlab_chat_api';
import {
  getActiveFileContext,
  getFileContext,
  GitLabChatFileContext,
} from '../chat/gitlab_chat_file_context';
import { SPECIAL_MESSAGES } from '../chat/constants';
import { doNotAwait } from '../utils/do_not_await';
import {
  FeatureFlag,
  getLocalFeatureFlagService,
} from '../feature_flags/local_feature_flag_service';
import { openAndShowDocument, provideCompletionItems, subscribeToStateChanges } from './utils';
import {
  COMMAND_QUICK_CHAT_OPEN_TELEMETRY,
  COMMAND_QUICK_CHAT_MESSAGE_TELEMETRY,
  QUICK_CHAT_OPEN_TRIGGER,
  COMMAND_OPEN_QUICK_CHAT,
  COMMAND_SEND_QUICK_CHAT,
  COMMAND_SEND_QUICK_CHAT_DUPLICATE,
  COMMAND_OPEN_QUICK_CHAT_WITH_SHORTCUT,
  COMMAND_CLOSE_QUICK_CHAT,
  COMMAND_SHOW_AND_SEND_QUICK_CHAT_WITH_CONTEXT,
} from './constants';
import { FixWithDuoQuickChatActionProvider } from './code_actions/fix_with_duo_quick_chat_action_provider';
import { QuickChatHint } from './quick_chat_hint';
import { QuickChatResponseProcessor } from './response_processor';
import { QuickChatCommentThreadService } from './comment_thread_service';
import {
  createQuickChatMachine,
  QuickChatOpenOptions,
  QuickChatState,
  SendMessageInput,
} from './quick_chat_state';
import { QuickChatGutterIcon } from './quick_chat_gutter_icon';

interface QuickChatMessageSentOptions {
  message: string;
}

export class QuickChat {
  #api: GitLabChatApi;

  #commentThreadService: QuickChatCommentThreadService;

  #hint?: QuickChatHint;

  #gutterIcon: QuickChatGutterIcon;

  #responseProcessor: QuickChatResponseProcessor;

  #disposables: vscode.Disposable[] = [];

  #stateMachine: ReturnType<typeof createQuickChatMachine>;

  constructor(
    api: GitLabChatApi,
    commentThreadService: QuickChatCommentThreadService,
    gutterIcon: QuickChatGutterIcon,
    responseProcessor: QuickChatResponseProcessor,
  ) {
    this.#api = api;

    this.#commentThreadService = commentThreadService;
    this.#gutterIcon = gutterIcon;
    this.#hint = new QuickChatHint();
    this.#responseProcessor = responseProcessor;

    const handleSelectionChangeDebounced = debounce(
      (event: vscode.TextEditorSelectionChangeEvent) => {
        this.#commentThreadService.updateThreadSelection(
          event.textEditor.document.uri,
          event.textEditor,
        );
        this.#hint?.updateHint(event);
      },
      100,
    );

    this.#stateMachine = createQuickChatMachine(
      this.#commentThreadService,
      this.#gutterIcon,
      this.#api,
      this.handleSendMessage.bind(this),
    );

    this.#stateMachine.start();

    subscribeToStateChanges({
      actorTitle: 'QuickChatStateMachine',
      actor: this.#stateMachine,
      callback: undefined,
    });

    this.#disposables.push(
      this.#commentThreadService,
      this.#hint,
      this.#gutterIcon,

      // Registers a completion item provider for quick actions (e.g. /tests)
      vscode.languages.registerCompletionItemProvider(
        { scheme: 'comment', pattern: '**' },
        { provideCompletionItems },
        '/',
      ),

      vscode.languages.registerCodeActionsProvider(
        { scheme: 'file' }, // register for all languages
        new FixWithDuoQuickChatActionProvider(),
        { providedCodeActionKinds: FixWithDuoQuickChatActionProvider.providedCodeActionKinds },
      ),

      vscode.window.onDidChangeTextEditorSelection(handleSelectionChangeDebounced),

      vscode.workspace.onDidChangeConfiguration(() => {
        this.#hint?.onConfigChange();
      }),

      vscode.window.onDidChangeTextEditorVisibleRanges(async event => {
        const { thread } = this.#stateMachine.getSnapshot().context;

        if (thread && event.textEditor.document.uri === thread.uri) {
          this.#gutterIcon.toggleGutterIcon(thread);
        }
        if (
          !this.#isCollapseStateSync(
            this.#stateMachine.getSnapshot().value.threadCollapsibleState,
            thread?.collapsibleState,
          )
        )
          this.#stateMachine.send({
            type:
              thread?.collapsibleState === CommentThreadCollapsibleState.Expanded
                ? 'expandChat'
                : 'collapseChat',
            origin: 'non-command',
          });
        await this.#createOrDestroyHint();
      }),

      vscode.window.onDidChangeActiveTextEditor(async event => {
        this.#stateMachine.send({
          type: 'setDocument',
          documentPath: event?.document.uri,
        });
        await this.#createOrDestroyHint();
      }),

      vscode.workspace.onDidChangeTextDocument(event => {
        const thread = this.#commentThreadService.getThread();
        if (event.document.uri !== thread?.uri) return;
        this.#commentThreadService.updateThreadRange(event.contentChanges[0]);
        this.#gutterIcon.toggleGutterIcon(thread);
      }),
      vscode.commands.registerCommand(COMMAND_OPEN_QUICK_CHAT, async () => {
        this.triggerNewChat();
      }),
      vscode.commands.registerCommand(COMMAND_SEND_QUICK_CHAT, (reply: vscode.CommentReply) =>
        this.#stateMachine.send({ type: 'sendMessage', input: { reply } }),
      ),
      vscode.commands.registerCommand(
        COMMAND_SEND_QUICK_CHAT_DUPLICATE,
        (reply: vscode.CommentReply) =>
          this.#stateMachine.send({ type: 'sendMessage', input: { reply } }),
      ),
      vscode.commands.registerCommand(COMMAND_OPEN_QUICK_CHAT_WITH_SHORTCUT, async () => {
        await this.triggerNewChat({ trigger: QUICK_CHAT_OPEN_TRIGGER.SHORTCUT });
      }),
      vscode.commands.registerCommand(
        COMMAND_SHOW_AND_SEND_QUICK_CHAT_WITH_CONTEXT,
        async (openOptions: QuickChatOpenOptions) => {
          await this.triggerNewChat(openOptions);
        },
      ),
      vscode.commands.registerCommand(COMMAND_CLOSE_QUICK_CHAT, async () => {
        this.#stateMachine.send({ type: 'collapseChat', origin: 'command' });
      }),
    );
  }

  async #createOrDestroyHint() {
    const isExpandedAndActive =
      this.#stateMachine.getSnapshot().value.threadCollapsibleState ===
        QuickChatState.THREAD_EXPANDED &&
      this.#stateMachine.getSnapshot().value.documentState === 'inCurrentDocument';

    if (isExpandedAndActive) {
      this.#hint?.dispose();
      this.#hint = undefined;
    } else {
      this.#hint = this.#hint ?? new QuickChatHint();
    }
    await vscode.commands.executeCommand('setContext', 'gitlab:quickChatOpen', isExpandedAndActive);
  }

  triggerNewChat(context?: QuickChatOpenOptions) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    this.#trackChatOpenTelemetry(context);
    this.#stateMachine.send({ type: 'triggerQuickChat', openOptions: context });
  }

  async #handleUserMessage(input: SendMessageInput) {
    const { reply, openOptions } = input;

    this.#responseProcessor.init();

    this.#commentThreadService.addUserComment(reply.text);
    // shows 'GitLab Duo Chat is finding an answer' loading message
    this.#commentThreadService.addLoaderComment();

    let fileContext: GitLabChatFileContext | undefined;
    if (openOptions?.document && openOptions?.range) {
      fileContext = getFileContext(openOptions.document, openOptions.range);
    } else {
      fileContext = getActiveFileContext();
    }

    const subscriptionId = uuidv4();
    await this.#commentThreadService.setLoadingContext(true); // disables the 'Send' button
    await this.#api.subscribeToUpdates(this.#subscriptionUpdateHandler.bind(this), subscriptionId);
    try {
      const result = await this.#submitQuestion(reply, subscriptionId, fileContext);
      if (result?.aiAction?.threadId) {
        this.#stateMachine.send({
          type: 'updateAiActionThreadId',
          aiActionThreadId: result?.aiAction?.threadId,
        });
      }
      return result;
    } catch (error) {
      this.#stateMachine.send({ type: 'errorOccurred', error });
      throw error;
    }
  }

  async handleSendMessage(input: SendMessageInput) {
    const { reply } = input;
    this.#trackMessageSentTelemetry({ message: reply.text });
    const isHandled = await this.#tryHandleSpecialMessage(reply.text);
    if (isHandled) {
      return;
    }
    await this.#handleUserMessage(input);
  }

  async #submitQuestion(
    reply: vscode.CommentReply,
    subId: string,
    fileContext?: GitLabChatFileContext,
  ): Promise<AiActionResponseType> {
    await openAndShowDocument(reply.thread.uri);
    return this.#api.processNewUserPrompt(
      reply.text,
      subId,
      fileContext,
      undefined,
      ConversationType.DUO_QUICK_CHAT,
      this.#stateMachine.getSnapshot().context.aiActionThreadId,
    );
  }

  async #subscriptionUpdateHandler(data: AiCompletionResponseMessageType) {
    this.#stateMachine.send({ type: 'streamingResponse' });
    this.#commentThreadService.removeLoaderComment();
    this.#commentThreadService.addResponseComment(this.#responseProcessor.getResponse());
    this.#responseProcessor.processUpdate(data, () => {
      this.#stateMachine.send({ type: 'requestComplete' });
    });
    this.#commentThreadService.refreshComments();
    await this.#commentThreadService.setLoadingContext(false);
  }

  async #tryHandleSpecialMessage(text: string) {
    switch (text.trim().toLowerCase()) {
      case SPECIAL_MESSAGES.CLEAR:
        this.#stateMachine.send({ type: 'executeSpecialCommand', command: SPECIAL_MESSAGES.CLEAR });
        return true;
      case SPECIAL_MESSAGES.RESET:
        this.#stateMachine.send({ type: 'executeSpecialCommand', command: SPECIAL_MESSAGES.RESET });
        return true;
      default:
        // Not a special message
        return false;
    }
  }

  #trackChatOpenTelemetry(context?: QuickChatOpenOptions) {
    if (!getLocalFeatureFlagService().isEnabled(FeatureFlag.LanguageServer)) return;

    const trigger = context?.trigger || QUICK_CHAT_OPEN_TRIGGER.CLICK;

    doNotAwait(
      vscode.commands.executeCommand(COMMAND_QUICK_CHAT_OPEN_TELEMETRY, {
        trigger,
      }),
    );
  }

  #trackMessageSentTelemetry(context: QuickChatMessageSentOptions) {
    if (!getLocalFeatureFlagService().isEnabled(FeatureFlag.LanguageServer)) return;

    doNotAwait(
      vscode.commands.executeCommand(COMMAND_QUICK_CHAT_MESSAGE_TELEMETRY, {
        message: context.message,
      }),
    );
  }

  #isCollapseStateSync = (
    stateCollapsibleState:
      | QuickChatState.NO_QUICK_CHAT
      | QuickChatState.THREAD_COLLAPSED
      | QuickChatState.THREAD_EXPANDED,
    threadCollapsibleState?: vscode.CommentThreadCollapsibleState,
  ): boolean => {
    // If no thread state exists, check if the state is NO_QUICK_CHAT
    if (!threadCollapsibleState) {
      return stateCollapsibleState === QuickChatState.NO_QUICK_CHAT;
    }

    // Map thread collapsible states to corresponding quick chat states
    const stateMap = new Map([
      [vscode.CommentThreadCollapsibleState.Expanded, QuickChatState.THREAD_EXPANDED],
      [vscode.CommentThreadCollapsibleState.Collapsed, QuickChatState.THREAD_COLLAPSED],
    ]);

    // Check if the current state matches the expected state for the thread's collapsible state
    return stateCollapsibleState === stateMap.get(threadCollapsibleState);
  };

  dispose() {
    this.#disposables.forEach(disposable => disposable?.dispose());
  }
}
