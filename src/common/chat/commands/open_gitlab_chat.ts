import { GitLabChatController } from '../gitlab_chat_controller';

export const COMMAND_OPEN_GITLAB_CHAT = 'gl.openChat';

/**
 * Command will open GitLab Chat window
 */

export const openGitLabChat = async (controller: GitLabChatController) => {
  await controller.openChat();
};
