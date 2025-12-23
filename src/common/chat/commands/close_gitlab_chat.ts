import { GitLabChatController } from '../gitlab_chat_controller';

export const COMMAND_CLOSE_GITLAB_CHAT = 'gl.closeChat';

/**
 * Command will close GitLab Chat window by closing the sidebar
 */

export const closeGitLabChat = async (controller: GitLabChatController) => {
  await controller.closeChat();
};
