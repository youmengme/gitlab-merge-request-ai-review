import { GitLabChatController } from '../gitlab_chat_controller';

export const COMMAND_FOCUS_GITLAB_CHAT = 'gl.focusChat';

/**
 * Command will focus on GitLab Chat prompt
 */

export const focusGitLabChat = async (controller: GitLabChatController) => {
  await controller.focusChat();
};
