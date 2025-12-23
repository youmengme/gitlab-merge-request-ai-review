import { GitLabPlatformManagerForChat } from '../get_platform_manager_for_chat';
import { GitLabPlatformManager } from '../../platform/gitlab_platform';

export const isDuoChatAvailable = async (
  platformManager: GitLabPlatformManager,
): Promise<boolean> => {
  const platformManagerForChat = new GitLabPlatformManagerForChat(platformManager);
  try {
    const platformForChat = await platformManagerForChat.getGitLabPlatform();
    return Boolean(platformForChat);
  } catch {
    return false;
  }
};
