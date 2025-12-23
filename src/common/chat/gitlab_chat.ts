import * as vscode from 'vscode';
import { GitLabPlatformManager } from '../platform/gitlab_platform';
import { QuickChat } from '../quick_chat/quick_chat';
import {
  COMMAND_COPY_CODE_SNIPPET_FROM_QUICK_CHAT,
  COMMAND_INSERT_CODE_SNIPPET_FROM_QUICK_CHAT,
} from '../quick_chat/constants';
import {
  addCopyAndInsertButtonsToCodeBlocks,
  insertQuickChatSnippetCommand,
  MarkdownProcessorPipeline,
} from '../quick_chat/utils';
import { LanguageServerFeatureStateProvider } from '../language_server/language_server_feature_state_provider';
import { QuickChatCommentThreadService } from '../quick_chat/comment_thread_service';
import { QuickChatResponseProcessor } from '../quick_chat/response_processor';
import { QuickChatGutterIcon } from '../quick_chat/quick_chat_gutter_icon';
import {
  FeatureFlag,
  getLocalFeatureFlagService,
} from '../feature_flags/local_feature_flag_service';
import { GitLabChatController } from './gitlab_chat_controller';
import { COMMAND_OPEN_GITLAB_CHAT, openGitLabChat } from './commands/open_gitlab_chat';
import {
  COMMAND_EXPLAIN_SELECTED_CODE,
  explainSelectedCode,
} from './commands/explain_selected_code';
import { COMMAND_GENERATE_TESTS, generateTests } from './commands/generate_tests';
import {
  COMMAND_NEW_CHAT_CONVERSATION,
  newChatConversation,
} from './commands/new_chat_conversation';
import { COMMAND_FIX_CODE, fixCode } from './commands/fix_code';
import { GitLabPlatformManagerForChat } from './get_platform_manager_for_chat';
import { CHAT_SIDEBAR_VIEW_ID } from './gitlab_chat_view';
import { COMMAND_REFACTOR_CODE, refactorCode } from './commands/refactor_code';
import { isDuoChatAvailable } from './utils/chat_availability_utils';
import { AIContextManager } from './ai_context_manager';
import { ChatStateManager } from './chat_state_manager';
import { closeGitLabChat, COMMAND_CLOSE_GITLAB_CHAT } from './commands/close_gitlab_chat';
import { COMMAND_FOCUS_GITLAB_CHAT, focusGitLabChat } from './commands/focus_gitlab_chat';
import { GitLabChatApi } from './gitlab_chat_api';

let quickChat: QuickChat | undefined;
let chatActive = false;

const setQuickChatAvailable = (
  context: vscode.ExtensionContext,
  manager: GitLabPlatformManager,
  aiContextManager: AIContextManager,
  isChatAvailable: boolean,
) => {
  if (isChatAvailable) {
    const platformManagerForChat = new GitLabPlatformManagerForChat(manager);
    const commentThreadService = new QuickChatCommentThreadService();
    const gutterIcon = new QuickChatGutterIcon(context);
    const responseProcessor = new QuickChatResponseProcessor(
      new MarkdownProcessorPipeline([addCopyAndInsertButtonsToCodeBlocks]),
    );
    const api = new GitLabChatApi(platformManagerForChat, [], aiContextManager);
    quickChat = new QuickChat(api, commentThreadService, gutterIcon, responseProcessor);
  } else {
    quickChat?.dispose();
    quickChat = undefined;
  }
};

const setChatAvailable = async (
  context: vscode.ExtensionContext,
  manager: GitLabPlatformManager,
  aiContextManager: AIContextManager,
) => {
  const isActive = await isDuoChatAvailable(manager);
  if (chatActive === isActive) return;
  chatActive = isActive;

  await vscode.commands.executeCommand('setContext', 'gitlab:chatAvailable', isActive);
  setQuickChatAvailable(context, manager, aiContextManager, isActive);
};

export const activateChat = async (
  context: vscode.ExtensionContext,
  manager: GitLabPlatformManager,
  aiContextManager: AIContextManager,
  languageServerFeatureStateProvider?: LanguageServerFeatureStateProvider,
) => {
  if (
    getLocalFeatureFlagService().isEnabled(FeatureFlag.LanguageServer) &&
    languageServerFeatureStateProvider
  ) {
    const chatStateManager = new ChatStateManager(languageServerFeatureStateProvider);
    context.subscriptions.push(
      chatStateManager,
      chatStateManager.onChange(chatState => {
        setQuickChatAvailable(context, manager, aiContextManager, chatState.chatAvailable);
      }),
    );
  } else {
    await setChatAvailable(context, manager, aiContextManager);

    manager.onAccountChange(async () => {
      await setChatAvailable(context, manager, aiContextManager);
    });
  }

  const platformManagerForChat = new GitLabPlatformManagerForChat(manager);
  const controller = new GitLabChatController(platformManagerForChat, context, aiContextManager);

  context.subscriptions.push(
    // sidebar view
    vscode.window.registerWebviewViewProvider(CHAT_SIDEBAR_VIEW_ID, controller),
  );

  context.subscriptions.push({ dispose: () => quickChat?.dispose() });

  // commands
  context.subscriptions.push(
    vscode.commands.registerCommand(COMMAND_OPEN_GITLAB_CHAT, async () => {
      await openGitLabChat(controller);
    }),
    vscode.commands.registerCommand(COMMAND_EXPLAIN_SELECTED_CODE, async () => {
      await explainSelectedCode(controller);
    }),
    vscode.commands.registerCommand(COMMAND_GENERATE_TESTS, async () => {
      await generateTests(controller);
    }),
    vscode.commands.registerCommand(COMMAND_REFACTOR_CODE, async () => {
      await refactorCode(controller);
    }),
    vscode.commands.registerCommand(COMMAND_FIX_CODE, async () => {
      await fixCode(controller);
    }),
    vscode.commands.registerCommand(COMMAND_NEW_CHAT_CONVERSATION, async () => {
      await newChatConversation(controller);
    }),

    vscode.commands.registerCommand(COMMAND_COPY_CODE_SNIPPET_FROM_QUICK_CHAT, async ({ code }) => {
      await vscode.env.clipboard.writeText(code);
      await vscode.window.showInformationMessage('Code copied to clipboard!');
    }),
    vscode.commands.registerCommand(
      COMMAND_INSERT_CODE_SNIPPET_FROM_QUICK_CHAT,
      insertQuickChatSnippetCommand,
    ),
    vscode.commands.registerCommand(COMMAND_CLOSE_GITLAB_CHAT, async () => {
      await closeGitLabChat(controller);
    }),
    vscode.commands.registerCommand(COMMAND_FOCUS_GITLAB_CHAT, async () => {
      await focusGitLabChat(controller);
    }),
  );
};
